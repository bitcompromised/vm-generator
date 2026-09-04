// Ad Snipe
//
// Port of Commands/AdSnipe.mjs from bitcompromised/mineflayer.
//
// Re-opens the server's ad menu on a timer and buys the first free ad slot
// it finds, then walks the two follow-up menus (ad style, plot) and posts
// the advert.
//
// The original does the same thing through a client wrapper that handed the
// handler a live window object with a `withdraw()` method. Nothing rich
// crosses this sandbox boundary: the window arrives as plain data, so
// clicking goes back through the proxy as bot.clickWindow(slot, 0, 0), and
// the item's custom name and lore have to be read out of its raw NBT by
// hand (prismarine-item exposes them through prototype getters, which are
// gone by the time a module sees the item).
//
// Three upstream bugs are fixed rather than carried over:
//
//   * The two branches deciding which ad slot to buy tested the same
//     condition, so the second was dead code.
//   * The "Pick Ad Style" and "Choose a Plot" branches referenced a bare
//     `slots` that was never defined in that scope - they would have thrown
//     every time.
//   * /ad went out every 250ms. Four commands a second gets the bot kicked
//     by any chat filter long before it buys anything; the default here is
//     5s.
//
// Commands:
//
//   /adsnipe                  toggle on/off
//   /adsnipe on | off
//   /adsnipe text <text>      what to advertise once a slot is bought
//   /adsnipe command <text>   the command that opens the ad menu
//   /adsnipe every <x> <s|m>  how often to re-open the menu
//   /adsnipe delay <min> <max> <ms|s>   pause before each menu click
//   /adsnipe slots <n>        how many leading slots are ad spots
//   /adsnipe style <n>        which slot to take in "Pick Ad Style"
//   /adsnipe plot <n>         which slot to take in "Choose a Plot"
//   /adsnipe owner add|remove|list [name]
//   /adsnipe status | help

// ---- defaults ------------------------------------------------------------
//
// Edit these before uploading. Every one can also be changed at runtime with
// the commands above - though runtime changes live in the module's memory
// and are gone the moment it is unloaded.

const DEFAULTS = {
  // Usernames allowed to run commands. Empty means anyone may.
  owners: [],

  // Start as soon as the module loads.
  enabled: false,

  // The command that opens the ad menu, and how often to re-open it.
  command: '/ad',
  every: 5000,

  // How many of the leading slots are ad spots.
  slots: 4,

  // Which option to take in the follow-up menus (upstream used these).
  styleSlot: 1,
  plotSlot: 0,

  // What to advertise once the slot is bought.
  text: '#1 op shop',

  // Menus need a beat between clicks or the server drops them as spam.
  minClickDelay: 300,
  maxClickDelay: 900,
}

// Window titles, matched with colour codes stripped. Not runtime-editable: a
// regex typed into chat is a good way to break the module silently.
const ADS_WINDOW = /Player Ads/i
const STYLE_WINDOW = /Pick Ad Style/i
const PLOT_WINDOW = /Choose a Plot/i

// Lore line that marks a slot as an unsold ad spot.
const FREE_SLOT_LORE = /Click here to purchase an ad/i

// ---- command plumbing ----------------------------------------------------
//
// Commands are '/'-prefixed, which changes how they have to reach the bot: a
// '/' line typed in game goes to the server as a command, not into public
// chat, so nobody's public message will ever carry one. Two channels do
// work:
//
//   * a whisper - /msg <bot> /adsnipe status - which arrives verbatim;
//   * the panel's chat box, which hands what you type to loaded modules
//     as '@panel'. A line matching a command this module declares below
//     is handled here and is not passed on to the server, so it draws no
//     "Unknown command" reply.

const PREFIX = '/'
const NAMES = ['adsnipe', 'adsniper']
const PANEL_SENDER = '@panel'

// Shown next to this module's commands in the panel's chat box.
const DESCRIPTION = "Buy free ad slots as they appear and post an advert."

// Splits "/adsnipe text buying all" into { sub: 'text', rest: 'buying all' }.
// `rest` keeps the original casing and spacing, which is what an advert body
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

// "<x> <unit>" is a fixed delay; "<min> <max> <unit>" is a range. Reversed
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

// ---- helpers -------------------------------------------------------------

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stripCodes(text) {
  return String(text == null ? '' : text).replace(/§[0-9a-fk-or]/gi, '')
}

// Window titles and chat both arrive as plain component data - flatten them
// by hand, since prismarine-chat's toString() does not survive the boundary.
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

// prismarine-nbt's simplify(), inlined - the sandbox cannot require it
// unless an admin allowlists the package, and item.nbt is the only place a
// custom name or lore still exists once an item has crossed the boundary.
function simplifyCompound(value) {
  const out = {}
  for (const key of Object.keys(value || {})) out[key] = simplifyNbt(value[key])
  return out
}

function simplifyNbt(node) {
  if (node == null || typeof node !== 'object') return node
  if (node.type === 'compound') return simplifyCompound(node.value)
  if (node.type === 'list') {
    const list = node.value || {}
    const items = Array.isArray(list.value) ? list.value : []
    if (list.type === 'compound') return items.map(simplifyCompound)
    if (list.type === 'list') return items.map((item) => simplifyNbt({ type: 'list', value: item }))
    return items
  }
  if ('value' in node) return node.value
  return node
}

// Custom name and lore, colour codes stripped. Lore is a list on modern
// versions and a single string on some older ones.
function itemInfo(item) {
  const tag = simplifyNbt(item && item.nbt) || {}
  const display = tag.display || {}
  let lore = display.Lore
  if (typeof lore === 'string') lore = [lore]
  if (!Array.isArray(lore)) lore = []
  return {
    name: stripCodes(display.Name || ''),
    lore: lore.map(stripCodes),
  }
}

// The whole windowOpen payload is dropped if any slot's NBT fails to
// serialise, so fall back to reading the live window through the proxy
// rather than silently doing nothing.
async function readWindow(bot, fromEvent) {
  if (fromEvent && Array.isArray(fromEvent.slots)) return fromEvent
  const [title, slots] = await Promise.all([bot.currentWindow.title, bot.currentWindow.slots])
  if (!Array.isArray(slots)) return null
  return { title, slots }
}

// ---- module --------------------------------------------------------------

module.exports = {
  name: 'Ad Snipe',

  async onLoad(bot, api) {
    this.selfName = await bot.username
    this.settings = { ...DEFAULTS, owners: [...DEFAULTS.owners] }
    this.enabled = this.settings.enabled
    this.busy = false
    this.bought = 0

    this.click = async (slot) => {
      await sleep(random(this.settings.minClickDelay, this.settings.maxClickDelay))
      await bot.clickWindow(slot, 0, 0)
    }

    this.handleAdsWindow = async (slots) => {
      for (let i = 0; i < this.settings.slots; i++) {
        const item = slots[i]
        if (!item) continue
        const info = itemInfo(item)
        if (!info.lore.some((line) => FREE_SLOT_LORE.test(line))) continue

        api.log(`Buying ad slot #${i + 1}.`)
        await this.click(i)
        return true
      }
      return false
    }

    this.onWindowOpen = async (windowFromEvent) => {
      if (!this.enabled) return
      // One menu chain at a time. Without this, an in-flight click and the
      // next /ad both drive the same window and the bot buys twice.
      if (this.busy) return
      this.busy = true

      try {
        const window = await readWindow(bot, windowFromEvent)
        if (!window) return
        const title = plainText(window.title)
        const slots = window.slots

        if (ADS_WINDOW.test(title)) {
          await this.handleAdsWindow(slots)
        } else if (STYLE_WINDOW.test(title)) {
          if (slots[this.settings.styleSlot]) await this.click(this.settings.styleSlot)
        } else if (PLOT_WINDOW.test(title)) {
          if (slots[this.settings.plotSlot]) await this.click(this.settings.plotSlot)
          // The plot menu is the last step - the advert itself is typed.
          await sleep(random(this.settings.minClickDelay, this.settings.maxClickDelay))
          await bot.chat(this.settings.text)
          this.bought += 1
          api.log(`Posted advert #${this.bought}: ${this.settings.text}`)
        }
      } catch (err) {
        api.log(`Ad menu failed: ${err.message}`)
      } finally {
        this.busy = false
      }
    }

    this.tick = async () => {
      if (!this.enabled || this.busy) return
      try {
        await bot.chat(this.settings.command)
      } catch (err) {
        api.log(`Could not send ${this.settings.command}: ${err.message}`)
      }
    }

    this.rescheduleTicks = () => {
      clearInterval(this.timer)
      this.timer = setInterval(() => { this.tick() }, this.settings.every)
    }

    this.setEnabled = (value, reply) => {
      this.enabled = value
      reply(`Ad Snipe ${this.enabled ? 'on' : 'off'} (${this.bought} adverts posted).`)
      if (this.enabled) this.tick()
    }

    // Shared shape for the three plain slot-index settings.
    this.slotSetting = (key, label, args, reply) => {
      const value = Number(args[0])
      if (!Number.isInteger(value) || value < 0 || value > 53) {
        return reply(`${label} is slot ${this.settings[key]}. Usage: /${NAMES[0]} ${label.toLowerCase()} <0-53>`)
      }
      this.settings[key] = value
      reply(`${label} set to slot ${value}.`)
    }

    this.handlers = {
      on: {
        usage: 'on',
        help: 'Start sniping ad slots.',
        run: (args, reply) => this.setEnabled(true, reply),
      },
      off: {
        usage: 'off',
        help: 'Stop.',
        run: (args, reply) => this.setEnabled(false, reply),
      },
      text: {
        usage: 'text <text>',
        help: 'What to advertise once a slot is bought.',
        run: (args, reply, rest) => {
          if (!rest) return reply(`Advert is "${this.settings.text}". Usage: /${NAMES[0]} text <text>`)
          this.settings.text = rest
          reply(`Advert set to "${rest}".`)
        },
      },
      command: {
        usage: 'command <text>',
        help: 'The command that opens the ad menu.',
        run: (args, reply, rest) => {
          if (!rest) return reply(`Command is ${this.settings.command}. Usage: /${NAMES[0]} command </ad>`)
          this.settings.command = rest
          reply(`Will send ${rest}.`)
        },
      },
      every: {
        usage: 'every <x> <s|m>',
        help: 'How often to re-open the menu.',
        run: (args, reply) => {
          const value = parseDuration(args, 's')
          if (value == null) return reply(`Usage: /${NAMES[0]} every <x> <s|m>`)
          if (value < 1000) return reply('Refusing to re-open faster than once a second - that is how the upstream version got kicked.')
          this.settings.every = value
          this.rescheduleTicks()
          reply(`Re-opening every ${formatDuration(value)}.`)
        },
      },
      delay: {
        usage: 'delay <x> <ms|s> | delay <min> <max> <unit>',
        help: 'Pause before each menu click.',
        run: (args, reply) => {
          const range = parseDurationRange(args, 'ms')
          if (!range) return reply(`Usage: /${NAMES[0]} delay <x> <ms|s>  or  /${NAMES[0]} delay <min> <max> <unit>`)
          this.settings.minClickDelay = range.min
          this.settings.maxClickDelay = range.max
          reply(`Click delay ${formatRange(range.min, range.max)}.`)
        },
      },
      slots: {
        usage: 'slots <n>',
        help: 'How many leading slots are ad spots.',
        run: (args, reply) => {
          const value = Number(args[0])
          if (!Number.isInteger(value) || value < 1 || value > 54) return reply(`Usage: /${NAMES[0]} slots <1-54>`)
          this.settings.slots = value
          reply(`Scanning the first ${value} slot(s) for a free ad spot.`)
        },
      },
      style: {
        usage: 'style <n>',
        help: 'Which slot to take in "Pick Ad Style".',
        run: (args, reply) => this.slotSetting('styleSlot', 'Style', args, reply),
      },
      plot: {
        usage: 'plot <n>',
        help: 'Which slot to take in "Choose a Plot".',
        run: (args, reply) => this.slotSetting('plotSlot', 'Plot', args, reply),
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
          reply(`Ad Snipe: ${this.enabled ? 'on' : 'off'} | ${this.bought} posted | ${this.settings.command} every ${formatDuration(this.settings.every)} | click delay ${formatRange(this.settings.minClickDelay, this.settings.maxClickDelay)} | ad slots 0-${this.settings.slots - 1}, style ${this.settings.styleSlot}, plot ${this.settings.plotSlot} | text "${this.settings.text}" | owners: ${this.settings.owners.length ? this.settings.owners.join(', ') : 'anyone'}`)
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

    api.on('windowOpen', this.onWindowOpen)
    api.on('chat', this.onChat)
    api.on('whisper', this.onWhisper)
    this.rescheduleTicks()

    if (this.enabled) this.tick()
    api.log(`Ad Snipe loaded - ${this.enabled ? 'running' : 'idle'}. Try ${PREFIX}${NAMES[0]} help.`)
  },

  async onUnload(bot, api) {
    this.enabled = false
    clearInterval(this.timer)
    api.off('windowOpen', this.onWindowOpen)
    api.off('chat', this.onChat)
    api.off('whisper', this.onWhisper)
    api.log(`Ad Snipe stopped (${this.bought} adverts posted).`)
  },
}
