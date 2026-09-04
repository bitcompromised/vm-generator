# Ported command modules

Seven of the commands from
[bitcompromised/mineflayer](https://github.com/bitcompromised/mineflayer),
rewritten as marketplace modules for this panel.

These are **source files, not installed modules**. Nothing here is wired into
the server: to use one, open `/marketplace`, start an upload, and paste the
file into the code box. It is validated on submit and then sits in *pending*
until a mod or admin approves it, exactly like any other upload.

| Module | From | Command | On by default |
| --- | --- | --- | --- |
| [balance.js](balance.js) | `idk_but_its_better/Commands/Balance.mjs` | `/bal` | n/a (on demand) |
| [advertise.js](advertise.js) | `Commands/Advertise.mjs` | `/ads` | yes |
| [auto-fish.js](auto-fish.js) | `Commands/AutoFish.mjs` | `/fish` | yes |
| [ad-snipe.js](ad-snipe.js) | `Commands/AdSnipe.mjs` | `/adsnipe` | no |
| [ah-sniper.js](ah-sniper.js) | `Commands/AhSniper.mjs` | `/ahs` | no |
| [cf-spoof.js](cf-spoof.js) | `Commands/CfSpoof.mjs` | `/cfs` | no |
| [check-plots.js](check-plots.js) | `Commands/CheckPlots.mjs` | `/checkplots` | n/a (on demand) |

`Balance.mjs` is not in `Commands/` upstream — the only copy in that repo is
under `idk_but_its_better/Commands/`, and that is what was ported.

## How a command reaches the bot

This matters more than it looks. A `/`-prefixed line typed in game **goes to
the server as a command, not into public chat**, so no player's public message
will ever carry one, and the bot's own outgoing chat never comes back to it as
a `chat` event either. Two channels work:

**Whisper.** `/msg <bot> /ads status` arrives verbatim on the `whisper` event.
The module answers by whisper as well as logging, so you get the reply in game.
This is the channel to use from another account.

**The panel's chat box.** Typing `/ads status` on the bot's page reaches loaded
modules — [`src/botChild.js`](../src/botChild.js) forwards whatever you type to
them as coming from `@panel`, which is always allowed past the owner check.
Replies show up in that bot's log.

Each module exports a `commands` array (built from its own subcommand table, so
there is one source of truth), and the panel uses it twice: the chat box
completes these commands as you type them, and the bot recognises a declared
command as belonging to a module and does **not** pass it on to the Minecraft
server — so none of them draw an `Unknown command` reply.

## Subcommands

Every module takes its defaults from a `DEFAULTS` block at the top of the file
— edit that before uploading — and every value in it can also be changed while
the module is running. **Runtime changes live in the module's memory and are
gone when it is unloaded**; the file is still the source of truth across
reloads.

Common to all seven: bare `/<name>` toggles (or runs, for `bal` and
`checkplots`), plus `status`, `help`, and
`owner add|remove|list [name]`. With no owners set, anyone may run the
commands; add one and only those names (and `@panel`) can.

Everything below is also offered by the chat box's completion, with these same
descriptions — `this.handlers` is the table the module dispatches on *and* the
table its `commands` export is generated from, so the two cannot drift.

Durations accept `5 m`, `5m`, or a bare number, and take a range wherever the
setting is a range: `/ads timer 30 90 s`. Money accepts `500b`, `1.5t`,
`2,000,000` and `15000000` alike.

**`/bal`** — read the balance ·
`command <text>` · `poll <x> <s|m|h>|off` · `timeout <x> <s|ms>` ·
`announce on|off`

**`/ads`** — toggle · `on`/`off` · `now` ·
`add <text>` · `remove <n>` · `list` · `clear` ·
`timer <x> <s|m|h>` · `timer <min> <max> <unit>`

**`/fish`** — toggle · `on`/`off` ·
`radius <n>` · `delay <min> <max> <unit>` · `toss on|off` · `free <n>` ·
`keep add|remove|list [item]`

**`/adsnipe`** — toggle · `on`/`off` ·
`text <text>` · `command <text>` · `every <x> <s|m>` ·
`delay <min> <max> <unit>` · `slots <n>` · `style <n>` · `plot <n>`

**`/ahs`** — toggle · `on`/`off` · `collect` ·
`rules` · `cap <n|label> <price>` · `enable <n|label>` · `disable <n|label>` ·
`add <item> <price> [name]` · `remove <n|label>` · `command <text>` ·
`every <x> <s|m>` · `delay <min> <max> <unit>`

The buy rules are a live table: `/ahs rules` numbers them, and `cap`, `enable`,
`disable`, `add` and `remove` all take either that number or a prefix of the
rule's label (`/ahs cap Omega 1b`). A cap keeps whichever kind it already was —
per stack or per item — because silently switching those changes what a rule
buys by the stack size.

**`/cfs`** — toggle · `on`/`off` ·
`bet <amount>` · `stoploss <amount|off>` · `target <amount|off>` ·
`maxbet <amount|off>` · `maxgames <n|off>` · `delay <min> <max> <unit>` ·
`command <text>` · `reset`

**`/checkplots`** — scan everyone · `<player>` (a player the bot has seen) ·
`run [player]` (anyone) · `stop` · `seen` ·
`radius <n>` · `max <n>` · `wait <x> <s|ms>` · `delay <min> <max> <unit>` ·
`home <text>` · `want add|remove|list [text]` · `strict on|off` ·
`announce on|off`

## Read this before enabling the money ones

`ah-sniper.js` and `cf-spoof.js` spend the bot's in-game balance without
asking, and both ship with the upstream author's numbers for one specific
server's economy:

- **ah-sniper** buys anything matching a rule under its price cap. A cap that
  is generous on your server is a bot emptying your balance into bad listings
  as fast as it can click. It starts disabled; run `/ahs rules`, re-price what
  looks wrong, then turn it on and watch the log.
- **cf-spoof** plays a doubling ladder on the server's coinflip. A doubling
  ladder does not beat a coinflip — the losing streak that breaks it is not
  unlikely, it is scheduled. It starts disabled and stops itself at
  `/cfs stoploss`; set that to something you are willing to lose.

The upstream versions of both also sent commands far faster than any server
allows (`/ad` every 250ms in `AdSnipe.mjs`). The defaults here are slower,
every menu click has a randomised delay in front of it, and the `every`
subcommands refuse an interval under a second.

## What changed from upstream, and why

The originals are written against that repo's own client wrapper: a `sender`
object with `sender.bot`, `sender.settings`, `sender.utils` and a live window
object with a `withdraw()` method. None of that exists here, and the
differences are not cosmetic — they come from the module sandbox being a
separate worker thread that never holds the real bot.

**Everything on `bot` is a Promise.** Property reads included:
`await bot.entity.position`, not `bot.entity.position`.

**Events come from `api.on`, not `bot.on`.** Listener functions cannot cross
the thread boundary. The forwarded event list lives in `MODULE_EVENTS` in
[`src/botChild.js`](../src/botChild.js).

**Rich objects arrive as plain data.** This is the one that bites hardest:

- `window.withdraw(...)` does not exist. Clicking a slot is
  `bot.clickWindow(slot, 0, 0)` back through the proxy.
- An item's custom name, lore and enchants are prismarine-item *prototype
  getters*, so they are gone by the time a module sees the item. All that
  survives is `item.nbt`. Every module that reads item text therefore carries
  an inlined copy of prismarine-nbt's `simplify()` — the sandbox cannot
  `require('prismarine-nbt')` unless an admin allowlists it.
- `block.getSignText()` is likewise gone. `check-plots.js` reads the text out
  of `block.signText` or the block-entity NBT instead.
- Chat components lose `toString()`, so each module has a small `plainText()`
  that flattens the component tree by hand.

**Positions are passed as plain `{x, y, z}`.** A Vec3 is flattened by the
structured clone on the way out of the sandbox no matter what you do, so
`bot.blockAt`, `bot.lookAt` and friends used to throw when a module called
them. The host now rebuilds a Vec3 from any `{x, y, z}` argument before
handing it to mineflayer (see `reviveVectors` in
[`src/moduleSandbox.js`](../src/moduleSandbox.js)), so passing a plain object
is correct and works.

**`matching` cannot be a function.** `bot.findBlocks({ matching })` takes an
array of block ids here, because a matcher function cannot be cloned across
the boundary. `check-plots.js` and `auto-fish.js` resolve the ids they need
from `bot.registry.blocksByName` at load — the registry is plain data, so a
single property read gets them.

Beyond the sandbox, a handful of upstream bugs were fixed rather than carried
across; each one is called out in a comment where it was. The largest is in
`ah-sniper.js`, where the ~300-line `switch` of one `case` per item became the
`RULES` table — which is also what makes `/ahs cap` and `/ahs add` possible.
Every threshold in it is upstream's, unchanged.

## What is not ported

`AutoFish.mjs` upstream is a stub — a handler containing nothing but a plan
written as comments. `auto-fish.js` is that plan implemented, so it is the one
module here that is new code rather than a translation.
