// Balance
//
// Port of Commands/Balance.mjs from bitcompromised/mineflayer.
//
// The original ran `/balance` and then blocked on the client's own
// `awaitMessage(/Balance:/)` helper. Nothing like that exists here, and the
// sandbox has no synchronous access to the bot at all, so the wait is
// rebuilt from the two things the sandbox does give you: an
// api.on('message') listener and a promise a timeout can settle. Every
// caller waiting for a balance is parked in `waiters` until either the
// server answers or the timeout fires - so two overlapping requests never
// deadlock each other, and a server that silently ignores /balance never
// wedges the module.
//
// Commands:
//
//   /bal                      read the balance and report it
//   /bal command <text>       the command to send (default /balance)
//   /bal poll <x> <s|m|h>     log the balance on a timer
//   /bal poll off             stop polling
//   /bal timeout <x> <s|ms>   how long to wait for the server's answer
//   /bal announce on|off      also say the balance in public chat
//   /bal owner add|remove|list [name]
//   /bal status | help

// ---- defaults ------------------------------------------------------------
//
// Edit these before uploading. Every one can also be changed at runtime with
// the commands above - though runtime changes live in the module's memory
// and are gone the moment it is unloaded.

const DEFAULTS = {
  // Usernames allowed to run commands. Empty means anyone may.
  owners: [],

  // What the server wants.
  command: '/balance',

  // How long to wait for the server to answer before giving up.
  timeout: 5000,

  // Log the balance every N ms. 0 disables.
  poll: 0,

  // Reply in public chat as well as logging. Off by default - a bot that
  // announces its balance to the server every time anyone asks is a bot that
  // gets noticed.
  announce: false,
}

// What the server's answer looks like. Not runtime-editable: a regex typed
// into chat is a good way to lock yourself out of your own module.
const BALANCE_PATTERN = /balance/i

// ---- command plumbing ----------------------------------------------------
//
// Commands are '/'-prefixed, which changes how they have to reach the bot: a
// '/' line typed in game goes to the server as a command, not into public
// chat, so nobody's public message will ever carry one. Two channels do
// work:
//
//   * a whisper - /msg <bot> /bal status - which arrives verbatim;
//   * the panel's chat box, which hands what you type to loaded modules
//     as '@panel'. A line matching a command this module declares below
//     is handled here and is not passed on to the server, so it draws no
//     "Unknown command" reply.

const PREFIX = '/'
const NAMES = ['bal', 'balance', 'money']
const PANEL_SENDER = '@panel'

// Shown next to this module's commands in the panel's chat box.
const DESCRIPTION = "Read the bot's in-game balance."

// Splits "/bal poll 5 m" into { sub: 'poll', args: ['5', 'm'], rest: '5 m' }.
// `rest` keeps the original casing and spacing, which is what a text value
// needs.
function parseCommand(message) {
  if (typeof message !== 'string') return null
  const trimmed = message.trim()
  if (!trimmed.startsWith(PREFIX)) return null

  const head = /^(\S+)(?:\s+([\s\S]*))?$/.exec(trimmed.slice(PREFIX.length))
  if (!head || !NAMES.includes(head[1].toLowerCase())) return null

  const tail = (head[2] || '').trim()
  if (!tail) return { sub: '', args: [], rest: '' }

  const parts = /^(\S+)(?:\s+([\s\S]*))?$/.exec(tail)
  const rest = (parts[2] || '').trim()
  return { sub: parts[1].toLowerCase(), args: rest ? rest.split(/\s+/) : [], rest }
}

const DURATION_UNITS = { ms: 1, s: 1000, sec: 1000, m: 60000, min: 60000, h: 3600000, hr: 3600000 }

// Accepts "5 m", "5m", or a bare number in `defaultUnit`.
function parseDuration(args, defaultUnit) {
  if (!args.length) return null
  const match = /^(\d+(?:\.\d+)?)(ms|sec|min|hr|[smh])?$/i.exec(args.join(''))
  if (!match) return null
  const scale = DURATION_UNITS[(match[2] || defaultUnit).toLowerCase()]
  if (!scale) return null
  return Math.round(Number(match[1]) * scale)
}

function formatDuration(ms) {
  if (ms >= 3600000 && ms % 3600000 === 0) return `${ms / 3600000}h`
  if (ms >= 60000 && ms % 60000 === 0) return `${ms / 60000}m`
  if (ms % 1000 === 0) return `${ms / 1000}s`
  return `${ms}ms`
}

function onOff(args) {
  const word = (args[0] || '').toLowerCase()
  if (['on', 'true', 'yes', 'enable', 'enabled'].includes(word)) return true
  if (['off', 'false', 'no', 'disable', 'disabled'].includes(word)) return false
  return null
}

// ---- helpers -------------------------------------------------------------

// Legacy section-sign colour codes survive in chat, item names and window
// titles on the servers this targets. Strip them before matching text.
function stripCodes(text) {
  return String(text == null ? '' : text).replace(/§[0-9a-fk-or]/gi, '')
}

// Chat components arrive as plain data - prismarine-chat's toString() is a
// prototype method and does not survive the sandbox boundary - so flatten
// them by hand. Handles the raw component, the ChatMessage wrapper (whose
// own `json` field does survive), and a JSON string.
function plainText(node) {
  if (node == null) return ''
  if (typeof node === 'string') {
    const trimmed = node.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return plainText(JSON.parse(trimmed))
      } catch {
        return stripCodes(node)
      }
    }
    return stripCodes(node)
  }
  if (Array.isArray(node)) return node.map(plainText).join('')
  if (typeof node !== 'object') return String(node)
  if (node.json) return plainText(node.json)

  let out = ''
  if (typeof node.text === 'string') out += stripCodes(node.text)
  if (typeof node[''] === 'string') out += stripCodes(node[''])
  if (Array.isArray(node.with)) out += node.with.map(plainText).join(' ')
  if (Array.isArray(node.extra)) out += node.extra.map(plainText).join('')
  return out
}

// These servers write money as "1,250,000" and as "1.25B" interchangeably,
// often in the same message. Accept both.
const SUFFIXES = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }

function parseMoney(text) {
  const match = /(\d[\d,]*(?:\.\d+)?)\s*([kmbt])?/i.exec(String(text))
  if (!match) return null
  const amount = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(amount)) return null
  const suffix = match[2] && SUFFIXES[match[2].toLowerCase()]
  return suffix ? amount * suffix : amount
}

function formatMoney(amount) {
  if (!Number.isFinite(amount)) return String(amount)
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]
  for (const [size, tag] of units) {
    if (Math.abs(amount) >= size) return `${(amount / size).toFixed(2)}${tag}`
  }
  return String(Math.round(amount))
}

// ---- module --------------------------------------------------------------

module.exports = {
  name: 'Balance',

  async onLoad(bot, api) {
    this.selfName = await bot.username
    this.settings = { ...DEFAULTS, owners: [...DEFAULTS.owners] }
    this.waiters = []
    this.lastBalance = null
    this.pollTimer = null

    // Settles every request currently waiting on a reply. Called from the
    // message listener and from onUnload, so a pending read can never
    // outlive the module.
    this.settle = (value) => {
      const waiting = this.waiters
      this.waiters = []
      for (const waiter of waiting) {
        clearTimeout(waiter.timer)
        waiter.resolve(value)
      }
    }

    this.onMessage = (jsonMsg) => {
      if (this.waiters.length === 0) return
      const text = plainText(jsonMsg)
      if (!BALANCE_PATTERN.test(text)) return

      // Read the number that follows the word "balance" rather than the
      // first number in the line - "Balance: $1,000" and "Your balance is
      // 1,000" both have the amount after the label, but a prefixed rank or
      // timestamp would otherwise win.
      const after = text.split(BALANCE_PATTERN)[1]
      const amount = parseMoney(after == null ? text : after)
      if (amount == null) return

      this.lastBalance = amount
      this.settle(amount)
    }

    // Resolves to the balance, or null if the server never answered.
    this.readBalance = () => new Promise((resolve) => {
      const waiter = { resolve, timer: null }
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter)
        resolve(null)
      }, this.settings.timeout)
      // Registered before the command goes out, or a server that answers
      // inside the same tick would answer nobody.
      this.waiters.push(waiter)
      bot.chat(this.settings.command).catch((err) => {
        api.log(`Could not send ${this.settings.command}: ${err.message}`)
      })
    })

    this.report = async (reply, announce) => {
      const balance = await this.readBalance()
      if (balance == null) {
        reply(`No answer to ${this.settings.command} within ${formatDuration(this.settings.timeout)}.`)
        return null
      }
      reply(`Balance: ${formatMoney(balance)} (${balance})`)
      if (announce && this.settings.announce) await bot.chat(`Balance: ${formatMoney(balance)}`)
      return balance
    }

    this.reschedulePoll = () => {
      clearInterval(this.pollTimer)
      this.pollTimer = null
      if (this.settings.poll > 0) {
        this.pollTimer = setInterval(() => { this.report((text) => api.log(text), false) }, this.settings.poll)
      }
    }

    this.handlers = {
      now: {
        usage: 'now',
        help: 'Read the balance (same as bare /bal).',
        run: (args, reply) => this.report(reply, true),
      },
      command: {
        usage: 'command <text>',
        help: 'The command to send to the server.',
        run: (args, reply, rest) => {
          if (!rest) return reply(`Command is ${this.settings.command}. Usage: /bal command </balance>`)
          this.settings.command = rest
          reply(`Will send ${this.settings.command}.`)
        },
      },
      poll: {
        usage: 'poll <x> <s|m|h> | poll off',
        help: 'Log the balance on a timer.',
        run: (args, reply) => {
          if (onOff(args) === false) {
            this.settings.poll = 0
            this.reschedulePoll()
            return reply('Polling off.')
          }
          const every = parseDuration(args, 's')
          if (every == null) return reply('Usage: /bal poll <x> <s|m|h>  or  /bal poll off')
          if (every < 5000) return reply('Refusing to poll faster than every 5s.')
          this.settings.poll = every
          this.reschedulePoll()
          reply(`Polling every ${formatDuration(every)}.`)
        },
      },
      timeout: {
        usage: 'timeout <x> <s|ms>',
        help: "How long to wait for the server's answer.",
        run: (args, reply) => {
          const value = parseDuration(args, 's')
          if (value == null) return reply('Usage: /bal timeout <x> <s|ms>')
          if (value < 250) return reply('Refusing a timeout under 250ms - no server answers that fast.')
          this.settings.timeout = value
          reply(`Timeout set to ${formatDuration(value)}.`)
        },
      },
      announce: {
        usage: 'announce on|off',
        help: 'Also say the balance in public chat.',
        run: (args, reply) => {
          const value = onOff(args)
          if (value == null) return reply(`Announce is ${this.settings.announce ? 'on' : 'off'}. Usage: /bal announce on|off`)
          this.settings.announce = value
          reply(`Announce ${value ? 'on' : 'off'}.`)
        },
      },
      owner: {
        usage: 'owner add|remove|list [name]',
        help: 'Who may run these commands (empty list = anyone).',
        run: (args, reply) => this.ownerCommand(args, reply),
      },
      status: {
        usage: 'status',
        help: 'Show current settings.',
        run: (args, reply) => {
          reply(`Balance: command ${this.settings.command} | timeout ${formatDuration(this.settings.timeout)} | poll ${this.settings.poll ? formatDuration(this.settings.poll) : 'off'} | announce ${this.settings.announce ? 'on' : 'off'} | last ${this.lastBalance == null ? 'unknown' : formatMoney(this.lastBalance)} | owners: ${this.settings.owners.length ? this.settings.owners.join(', ') : 'anyone'}`)
        },
      },
      help: {
        usage: 'help',
        help: 'List these commands.',
        run: (args, reply) => this.helpCommand(reply),
      },
    }


    // Published to the panel, and read by the host after onLoad: the same
    // table without the handlers. The chat box builds its completion list
    // from this, and the bot uses it to tell a module command apart from a
    // real server command - so there is one source of truth for both, and
    // adding a subcommand above is all it takes to have it offered.
    this.commands = [{
      name: NAMES[0],
      aliases: NAMES.slice(1),
      usage: PREFIX + NAMES[0],
      description: DESCRIPTION,
      subcommands: Object.keys(this.handlers).map((name) => ({
        name,
        usage: PREFIX + NAMES[0] + ' ' + this.handlers[name].usage,
        description: this.handlers[name].help,
      })),
    }]
    this.ownerCommand = (args, reply) => {
      const action = (args[0] || 'list').toLowerCase()
      const name = args[1]
      if (action === 'list') {
        return reply(`Owners: ${this.settings.owners.length ? this.settings.owners.join(', ') : 'anyone'}`)
      }
      if (!name) return reply(`Usage: /${NAMES[0]} owner ${action} <name>`)
      if (action === 'add') {
        if (this.settings.owners.includes(name)) return reply(`${name} is already an owner.`)
        this.settings.owners.push(name)
        return reply(`Added owner ${name}. Only ${this.settings.owners.join(', ')} may run these commands now.`)
      }
      if (action === 'remove') {
        const index = this.settings.owners.indexOf(name)
        if (index === -1) return reply(`${name} is not an owner.`)
        this.settings.owners.splice(index, 1)
        return reply(this.settings.owners.length ? `Removed ${name}.` : `Removed ${name} - anyone may run these commands now.`)
      }
      return reply(`Usage: /${NAMES[0]} owner add|remove|list [name]`)
    }

    this.helpCommand = (reply) => {
      reply(`/${NAMES[0]} - ${Object.keys(this.handlers).length} subcommands (aliases: ${NAMES.map((n) => PREFIX + n).join(', ')})`)
      for (const entry of Object.values(this.handlers)) reply(`  ${PREFIX}${NAMES[0]} ${entry.usage} - ${entry.help}`)
      reply(`  ${PREFIX}${NAMES[0]} - read the balance`)
    }

    this.allowed = (username) => {
      if (username === PANEL_SENDER) return true
      if (this.settings.owners.length === 0) return true
      return this.settings.owners.includes(username)
    }

    this.dispatch = async (source, username, message) => {
      // The bot's own public chat is never a command; a whisper from itself
      // is, because that is how the panel can reach a module through the
      // server.
      if (!username || (source === 'chat' && username === this.selfName)) return

      const parsed = parseCommand(message)
      if (!parsed) return
      if (!this.allowed(username)) return

      const reply = (text) => {
        api.log(text)
        if (source === 'whisper' && username !== PANEL_SENDER && username !== this.selfName) {
          bot.whisper(username, text).catch(() => {})
        }
      }

      try {
        if (!parsed.sub) return await this.report(reply, true)
        const entry = this.handlers[parsed.sub]
        if (!entry) {
          reply(`Unknown subcommand "${parsed.sub}".`)
          return this.helpCommand(reply)
        }
        await entry.run(parsed.args, reply, parsed.rest)
      } catch (err) {
        api.log(`Command failed: ${err.message}`)
      }
    }

    this.onChat = (username, message) => this.dispatch('chat', username, message)
    this.onWhisper = (username, message) => this.dispatch('whisper', username, message)

    api.on('message', this.onMessage)
    api.on('chat', this.onChat)
    api.on('whisper', this.onWhisper)
    this.reschedulePoll()

    api.log(`Balance ready - ${PREFIX}${NAMES[0]} runs ${this.settings.command}. Try ${PREFIX}${NAMES[0]} help.`)
  },

  async onUnload(bot, api) {
    clearInterval(this.pollTimer)
    api.off('message', this.onMessage)
    api.off('chat', this.onChat)
    api.off('whisper', this.onWhisper)
    // Anything still waiting would hang forever once the listener is gone.
    this.settle?.(null)
    api.log('Balance stopped.')
  },
}
