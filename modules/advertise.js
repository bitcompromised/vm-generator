// Advertise
//
// Port of Commands/Advertise.mjs from bitcompromised/mineflayer.
//
// Repeats a chat line on a randomised interval. The original was a toggle
// command that sent "[i]" every 61-78 seconds; the randomised gap is the
// whole point - a message that lands on an exact 60s boundary forever is
// the easiest kind of bot to spot, and most servers rate-limit repeated
// identical chat anyway.
//
// Two behaviours are fixed here relative to the original: the interval is
// re-rolled after every message (setInterval rolled the delay once, at
// startup, and then reused it forever), and the timer is torn down on
// unload instead of running until the process dies.
//
// Commands:
//
//   /ads                      toggle on/off
//   /ads on | off
//   /ads now                  send one message immediately
//   /ads add <text>           add a message to the rotation
//   /ads remove <n>           remove message n
//   /ads list                 list the rotation
//   /ads clear                empty the rotation
//   /ads timer <x> <s|m|h>    fixed gap between messages
//   /ads timer <min> <max> <unit>   random gap in that range
//   /ads owner add|remove|list [name]
//   /ads status | help

// ---- defaults ------------------------------------------------------------
//
// Edit these before uploading. Every one can also be changed at runtime with
// the commands above - though runtime changes live in the module's memory
// and are gone the moment it is unloaded.

const DEFAULTS = {
  // Usernames allowed to run commands. Empty means anyone may.
  owners: [],

  // One is picked at random each time. A single-entry list repeats that line.
  messages: ['[i]'],

  // Gap between messages, re-rolled every time.
  minInterval: 61000,
  maxInterval: 78000,

  // Start advertising as soon as the module loads.
  enabled: true,
}

// ---- command plumbing ----------------------------------------------------
//
// Commands are '/'-prefixed, which changes how they have to reach the bot: a
// '/' line typed in game goes to the server as a command, not into public
// chat, so nobody's public message will ever carry one. Two channels do
// work:
//
//   * a whisper - /msg <bot> /ads status - which arrives verbatim;
//   * the panel's chat box, which hands what you type to loaded modules
//     as '@panel'. A line matching a command this module declares below
//     is handled here and is not passed on to the server, so it draws no
//     "Unknown command" reply.

const PREFIX = '/'
const NAMES = ['ads', 'advert', 'advertise']
const PANEL_SENDER = '@panel'

// Shown next to this module's commands in the panel's chat box.
const DESCRIPTION = "Repeat a chat line on a randomised timer."

// Splits "/ads add hello world" into { sub: 'add', args: ['hello', 'world'],
// rest: 'hello world' }. `rest` keeps the original casing and spacing, which
// is what a message body needs.
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

// "<x> <unit>" is a fixed gap; "<min> <max> <unit>" is a range. Reversed
// bounds are swapped rather than rejected.
function parseDurationRange(args, defaultUnit) {
  if (args.length >= 2 && /^\d/.test(args[0]) && /^\d/.test(args[1])) {
    const unit = args[2] ? [args[2]] : []
    const min = parseDuration([args[0], ...unit], defaultUnit)
    const max = parseDuration([args[1], ...unit], defaultUnit)
    if (min == null || max == null) return null
    return min <= max ? { min, max } : { min: max, max: min }
  }
  const fixed = parseDuration(args, defaultUnit)
  return fixed == null ? null : { min: fixed, max: fixed }
}

function formatDuration(ms) {
  if (ms >= 3600000 && ms % 3600000 === 0) return `${ms / 3600000}h`
  if (ms >= 60000 && ms % 60000 === 0) return `${ms / 60000}m`
  if (ms % 1000 === 0) return `${ms / 1000}s`
  return `${ms}ms`
}

function formatRange(min, max) {
  return min === max ? formatDuration(min) : `${formatDuration(min)}-${formatDuration(max)}`
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

// ---- module --------------------------------------------------------------

module.exports = {
  name: 'Advertise',

  async onLoad(bot, api) {
    this.selfName = await bot.username
    this.settings = { ...DEFAULTS, owners: [...DEFAULTS.owners], messages: [...DEFAULTS.messages] }
    this.enabled = this.settings.enabled
    this.timer = null
    this.sent = 0

    this.send = async () => {
      const message = pick(this.settings.messages)
      if (!message) return
      try {
        await bot.chat(message);
        this.sent += 1;
      } catch (err) {
        // Chat fails while disconnected or muted - not worth stopping over.
        api.log(`Advert failed: ${err.message}`);
      }
    }

    // setTimeout rather than setInterval: the delay is re-rolled after every
    // message, so the pattern never settles into a fixed rhythm.
    this.schedule = () => {
      clearTimeout(this.timer)
      if (!this.enabled) return
      const delay = random(this.settings.minInterval, this.settings.maxInterval)
      this.timer = setTimeout(async () => {
        if (!this.enabled) return
        await this.send()
        this.schedule()
      }, delay)
    }

    this.setEnabled = (value, reply) => {
      this.enabled = value
      if (this.enabled) this.schedule()
      else clearTimeout(this.timer)
      reply(`Advertising ${this.enabled ? 'on' : 'off'} - ${this.settings.messages.length} message(s), every ${formatRange(this.settings.minInterval, this.settings.maxInterval)}.`)
    }

    this.handlers = {
      on: {
        usage: 'on',
        help: 'Start advertising.',
        run: (args, reply) => this.setEnabled(true, reply),
      },
      off: {
        usage: 'off',
        help: 'Stop advertising.',
        run: (args, reply) => this.setEnabled(false, reply),
      },
      now: {
        usage: 'now',
        help: 'Send one message immediately.',
        run: async (args, reply) => {
          if (this.settings.messages.length === 0) return reply('Nothing to send - the rotation is empty.')
          await this.send()
          reply('Sent.')
        },
      },
      add: {
        usage: 'add <text>',
        help: 'Add a message to the rotation.',
        run: (args, reply, rest) => {
          if (!rest) return reply('Usage: /ads add <text>')
          this.settings.messages.push(rest)
          reply(`Added #${this.settings.messages.length}: ${rest}`)
        },
      },
      remove: {
        usage: 'remove <n>',
        help: 'Remove message n (see /ads list).',
        run: (args, reply) => {
          const index = Number(args[0])
          if (!Number.isInteger(index) || index < 1 || index > this.settings.messages.length) {
            return reply(`Usage: /ads remove <1-${this.settings.messages.length || 1}>`)
          }
          const [removed] = this.settings.messages.splice(index - 1, 1)
          reply(`Removed #${index}: ${removed}`)
        },
      },
      list: {
        usage: 'list',
        help: 'Show the message rotation.',
        run: (args, reply) => {
          if (this.settings.messages.length === 0) return reply('The rotation is empty.')
          this.settings.messages.forEach((message, i) => reply(`  ${i + 1}. ${message}`))
        },
      },
      clear: {
        usage: 'clear',
        help: 'Empty the rotation (also stops advertising).',
        run: (args, reply) => {
          this.settings.messages = []
          this.enabled = false
          clearTimeout(this.timer)
          reply('Rotation cleared, advertising off.')
        },
      },
      timer: {
        usage: 'timer <x> <s|m|h> | timer <min> <max> <unit>',
        help: 'Set the gap between messages.',
        run: (args, reply) => {
          const range = parseDurationRange(args, 's')
          if (!range) return reply('Usage: /ads timer <x> <s|m|h>  or  /ads timer <min> <max> <unit>')
          if (range.min < 1000) return reply('Refusing a gap under 1s - that is a mute, not an advert.')
          this.settings.minInterval = range.min
          this.settings.maxInterval = range.max
          // Re-scheduling now rather than after the pending message means the
          // new gap takes effect immediately, which is what you expect after
          // typing it.
          this.schedule()
          reply(`Gap set to ${formatRange(range.min, range.max)}.`)
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
          reply(`Advertise: ${this.enabled ? 'on' : 'off'} | ${this.settings.messages.length} message(s) | every ${formatRange(this.settings.minInterval, this.settings.maxInterval)} | ${this.sent} sent | owners: ${this.settings.owners.length ? this.settings.owners.join(', ') : 'anyone'}`)
        },
      },
      help: {
        usage: 'help',
        help: 'List these commands.',
        run: (args, reply) => this.helpCommand(reply),
      },
    }

    // Shared by every module in this set: owners are a runtime setting like
    // any other, so they are editable the same way.

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
      return reply('Usage: /' + NAMES[0] + ' owner add|remove|list [name]')
    }

    this.helpCommand = (reply) => {
      reply(`/${NAMES[0]} - ${Object.keys(this.handlers).length} subcommands (aliases: ${NAMES.map((n) => PREFIX + n).join(', ')})`)
      for (const entry of Object.values(this.handlers)) reply(`  ${PREFIX}${NAMES[0]} ${entry.usage} - ${entry.help}`)
      reply(`  ${PREFIX}${NAMES[0]} - toggle on/off`)
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
        if (!parsed.sub) return this.setEnabled(!this.enabled, reply)
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

    api.on('chat', this.onChat)
    api.on('whisper', this.onWhisper)

    if (this.enabled) {
      await this.send()
      this.schedule()
    }

    api.log(`Advertise loaded - ${this.enabled ? 'running' : 'idle'}, every ${formatRange(this.settings.minInterval, this.settings.maxInterval)}. Try ${PREFIX}${NAMES[0]} help.`)
  },

  async onUnload(bot, api) {
    this.enabled = false
    clearTimeout(this.timer)
    api.off('chat', this.onChat)
    api.off('whisper', this.onWhisper)
    api.log(`Advertise stopped (${this.sent} sent).`)
  },
}
