// Auto Fish
//
// Port of Commands/AutoFish.mjs from bitcompromised/mineflayer.
//
// The upstream file is a stub - a handler containing nothing but the plan,
// written as comments:
//
//   Find Waterblock Position / Look at Water / Fish / on Collect ->
//   Clear Inventory into water / out of rods -> quit
//
// So this is that plan actually built, against this sandbox. Two things in
// it are worth knowing:
//
//   * bot.fish() resolves when the catch lands. There is no 'playerCollect'
//     in the module event list, and there does not need to be - the wait
//     happens on the far side of the boundary, inside mineflayer.
//   * Positions are passed as plain {x, y, z}. A Vec3 loses its prototype
//     crossing the boundary either way; the host rebuilds one before
//     handing it to mineflayer, so bot.lookAt() works on a plain object.
//
// Commands:
//
//   /fish                     toggle on/off
//   /fish on | off
//   /fish radius <n>          how far to look for water
//   /fish delay <x> <s|ms>    pause between catch and next cast
//   /fish delay <min> <max> <unit>
//   /fish toss on|off         throw the catch back when nearly full
//   /fish free <n>            free slots left before tossing starts
//   /fish keep add|remove|list [item]   never tossed
//   /fish owner add|remove|list [name]
//   /fish status | help

// ---- defaults ------------------------------------------------------------
//
// Edit these before uploading. Every one can also be changed at runtime with
// the commands above - though runtime changes live in the module's memory
// and are gone the moment it is unloaded.

const DEFAULTS = {
  // Usernames allowed to run commands. Empty means anyone may.
  owners: [],

  // Start as soon as the module loads.
  enabled: true,

  // How far to look for water to cast into.
  radius: 32,

  // Pause between a catch and the next cast, to avoid a perfectly even
  // rhythm.
  minRecast: 700,
  maxRecast: 1800,

  // Throw the catch back once the inventory is nearly full ("clear inventory
  // into water" in the original outline). Off means stop when there is no
  // room.
  toss: true,

  // Start tossing when fewer than this many inventory slots are free.
  freeSlots: 4,

  // Never tossed, whatever else goes.
  keep: ['fishing_rod'],
}

const ROD_NAME = 'fishing_rod'

// Slots in the main inventory, used to work out how full it is.
const INVENTORY_SLOTS = 36

// ---- command plumbing ----------------------------------------------------
//
// Commands are '/'-prefixed, which changes how they have to reach the bot: a
// '/' line typed in game goes to the server as a command, not into public
// chat, so nobody's public message will ever carry one. Two channels do
// work:
//
//   * a whisper - /msg <bot> /fish status - which arrives verbatim;
//   * the panel's chat box, which hands what you type to loaded modules
//     as '@panel'. A line matching a command this module declares below
//     is handled here and is not passed on to the server, so it draws no
//     "Unknown command" reply.

const PREFIX = '/'
const NAMES = ['fish', 'af', 'autofish']
const PANEL_SENDER = '@panel'

// Shown next to this module's commands in the panel's chat box.
const DESCRIPTION = "Fish automatically, throwing the catch back when full."

// Splits "/fish delay 1 3 s" into { sub: 'delay', args: ['1', '3', 's'] }.
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

function onOff(args) {
  const word = (args[0] || '').toLowerCase()
  if (['on', 'true', 'yes', 'enable', 'enabled'].includes(word)) return true
  if (['off', 'false', 'no', 'disable', 'disabled'].includes(word)) return false
  return null
}

// ---- helpers -------------------------------------------------------------

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---- module --------------------------------------------------------------

module.exports = {
  name: 'Auto Fish',

  async onLoad(bot, api) {
    this.selfName = await bot.username
    this.settings = { ...DEFAULTS, owners: [...DEFAULTS.owners], keep: [...DEFAULTS.keep] }
    this.enabled = false
    this.looping = false
    this.caught = 0

    // The registry is plain data, so a single property read gets the block
    // id without pulling the whole block table across.
    this.waterIds = []
    for (const name of ['water', 'flowing_water']) {
      const block = await bot.registry.blocksByName[name]
      if (block && typeof block.id === 'number') this.waterIds.push(block.id)
    }
    if (this.waterIds.length === 0) api.log('Warning: no water block in this server\'s registry - casting will be blind.')

    // Equips a rod, returning false when the bot has none left. This is the
    // "out of rods -> quit" branch: rods break, and a bot that keeps
    // right-clicking empty-handed at a lake is doing nothing but looking
    // suspicious.
    this.equipRod = async () => {
      const held = await bot.heldItem
      if (held && held.name === ROD_NAME) return true

      const items = (await bot.inventory.items()) || []
      const rod = items.find((item) => item.name === ROD_NAME)
      if (!rod) return false

      await bot.equip(rod, 'hand')
      return true
    }

    this.faceWater = async () => {
      if (this.waterIds.length === 0) return true
      const water = await bot.findBlock({ matching: this.waterIds, maxDistance: this.settings.radius })
      if (!water || !water.position) return false
      // Aim at the middle of the block's top face, not its corner.
      await bot.lookAt({
        x: water.position.x + 0.5,
        y: water.position.y + 1,
        z: water.position.z + 0.5,
      }, true)
      return true
    }

    this.dumpCatch = async () => {
      if (!this.settings.toss) return
      const items = (await bot.inventory.items()) || []
      // Below the threshold, start throwing the catch back before the next
      // one has nowhere to land.
      if (INVENTORY_SLOTS - items.length > this.settings.freeSlots) return

      for (const item of items) {
        if (this.settings.keep.includes(item.name)) continue
        try {
          await bot.toss(item.type, item.metadata == null ? null : item.metadata, item.count)
          await sleep(120)
        } catch (err) {
          api.log(`Could not toss ${item.name}: ${err.message}`)
        }
      }
    }

    this.loop = async () => {
      if (this.looping) return
      this.looping = true
      try {
        while (this.enabled) {
          if (!await this.equipRod()) {
            api.log('Out of fishing rods - stopping.')
            this.enabled = false
            break
          }

          if (!await this.faceWater()) {
            api.log(`No water within ${this.settings.radius} blocks - stopping.`)
            this.enabled = false
            break
          }

          try {
            // Resolves when the catch lands; rejects if the bobber is lost,
            // the bot is moved, or the rod breaks mid-cast.
            await bot.fish()
            this.caught += 1
            if (this.caught % 10 === 0) api.log(`Caught ${this.caught} so far.`)
          } catch (err) {
            api.log(`Cast failed: ${err.message}`)
            await sleep(2000)
            continue
          }

          await this.dumpCatch()
          await sleep(random(this.settings.minRecast, this.settings.maxRecast))
        }
      } finally {
        this.looping = false
      }
    }

    this.setEnabled = (value, reply) => {
      if (value === this.enabled) return reply(`Already ${value ? 'fishing' : 'stopped'}.`)
      this.enabled = value
      reply(`Fishing ${this.enabled ? 'started' : 'stopping'} (caught ${this.caught}).`)
      if (this.enabled) this.loop()
    }

    this.handlers = {
      on: {
        usage: 'on',
        help: 'Start fishing.',
        run: (args, reply) => this.setEnabled(true, reply),
      },
      off: {
        usage: 'off',
        help: 'Stop after the current cast.',
        run: (args, reply) => this.setEnabled(false, reply),
      },
      radius: {
        usage: 'radius <n>',
        help: 'How far to look for water.',
        run: (args, reply) => {
          const value = Number(args[0])
          if (!Number.isFinite(value) || value < 1 || value > 128) return reply('Usage: /fish radius <1-128>')
          this.settings.radius = Math.round(value)
          reply(`Water search radius ${this.settings.radius}.`)
        },
      },
      delay: {
        usage: 'delay <x> <s|ms> | delay <min> <max> <unit>',
        help: 'Pause between a catch and the next cast.',
        run: (args, reply) => {
          const range = parseDurationRange(args, 's')
          if (!range) return reply('Usage: /fish delay <x> <s|ms>  or  /fish delay <min> <max> <unit>')
          this.settings.minRecast = range.min
          this.settings.maxRecast = range.max
          reply(`Recast delay ${formatRange(range.min, range.max)}.`)
        },
      },
      toss: {
        usage: 'toss on|off',
        help: 'Throw the catch back when the inventory is nearly full.',
        run: (args, reply) => {
          const value = onOff(args)
          if (value == null) return reply(`Toss is ${this.settings.toss ? 'on' : 'off'}. Usage: /fish toss on|off`)
          this.settings.toss = value
          reply(`Toss ${value ? 'on' : 'off'}.`)
        },
      },
      free: {
        usage: 'free <n>',
        help: 'Free slots left before tossing starts.',
        run: (args, reply) => {
          const value = Number(args[0])
          if (!Number.isInteger(value) || value < 0 || value >= INVENTORY_SLOTS) {
            return reply(`Usage: /fish free <0-${INVENTORY_SLOTS - 1}>`)
          }
          this.settings.freeSlots = value
          reply(`Tossing starts with fewer than ${value} free slot(s).`)
        },
      },
      keep: {
        usage: 'keep add|remove|list [item]',
        help: 'Items never tossed.',
        run: (args, reply) => {
          const action = (args[0] || 'list').toLowerCase()
          const item = args[1]
          if (action === 'list') return reply(`Keeping: ${this.settings.keep.join(', ') || 'nothing'}`)
          if (!item) return reply(`Usage: /fish keep ${action} <item_name>`)
          if (action === 'add') {
            if (this.settings.keep.includes(item)) return reply(`Already keeping ${item}.`)
            this.settings.keep.push(item)
            return reply(`Keeping ${item}.`)
          }
          if (action === 'remove') {
            const index = this.settings.keep.indexOf(item)
            if (index === -1) return reply(`${item} is not on the keep list.`)
            this.settings.keep.splice(index, 1)
            // The rod is what makes this module work at all, so removing it
            // is almost certainly a mistake worth naming.
            if (item === ROD_NAME) return reply(`No longer keeping ${item} - the bot will now throw away its own rods.`)
            return reply(`No longer keeping ${item}.`)
          }
          return reply('Usage: /fish keep add|remove|list [item]')
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
          reply(`Auto Fish: ${this.enabled ? 'fishing' : 'idle'} | ${this.caught} caught | radius ${this.settings.radius} | recast ${formatRange(this.settings.minRecast, this.settings.maxRecast)} | toss ${this.settings.toss ? `on below ${this.settings.freeSlots} free` : 'off'} | keep ${this.settings.keep.join(', ') || 'nothing'} | owners: ${this.settings.owners.length ? this.settings.owners.join(', ') : 'anyone'}`)
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

    api.on('chat', this.onChat)
    api.on('whisper', this.onWhisper)

    if (this.settings.enabled) {
      this.enabled = true
      this.loop()
    }

    api.log(`Auto Fish loaded - ${this.enabled ? 'fishing' : 'idle'}. Try ${PREFIX}${NAMES[0]} help.`)
  },

  async onUnload(bot, api) {
    // The loop checks this between casts, so it winds itself down rather
    // than being cut off mid-await.
    this.enabled = false
    api.off('chat', this.onChat)
    api.off('whisper', this.onWhisper)
    api.log(`Auto Fish stopped after ${this.caught} catches.`)
  },
}
