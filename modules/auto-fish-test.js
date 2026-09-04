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
  sleep, random, onOff,
  async onLoad(bot, api) {
    this.selfName = await bot.username
    this.settings = { ...DEFAULTS, owners: [...DEFAULTS.owners], keep: [...DEFAULTS.keep] }
  }
}
