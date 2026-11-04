# UNDERTALE — Browser Edition

Play it live: **https://ddown325.github.io/Undertale-HTML/**

Fan project. UNDERTALE was created by Toby Fox — support the official game at
[undertale.com](https://undertale.com).

## Offline / single-file edition

Don't want to stream ~120 MB every time your browser cache clears? Grab the
**single-file offline edition** — the complete game (engine, data and all 211
music files) packed into one `.html` file. Save it anywhere, double-click it,
play with no internet:

**[Download UNDERTALE-offline.html](https://github.com/ddown325/Undertale-HTML/releases/latest/download/UNDERTALE-offline.html)** (~270 MB)

- Works fully offline, forever. Share the file however you like.
- Saves live in your browser's storage on that machine (Chrome/Edge recommended).
- More info on the [releases page](https://github.com/ddown325/Undertale-HTML/releases).

## Custom content in this build

Besides the vanilla game, this build adds a few extras. (All of the game-data
extras below shipped in **game data v1.1** — the loading-screen footer shows
the current version; if you're on an older offline copy, re-download it.)

**Saves actually work here — and so does your keyboard.** The stock runner
is the Opera GX Games build: its whole save system (saving *and* loading
`undertale.sav`) runs through a `window.oprt.gameStorage` API that only
exists inside the GX app. On a normal web host neither existed, so the game
could not load or persist **any** save — saving at a save point did nothing
and CONTINUE stayed empty. This build poly-fills `gameStorage` on top of the
very same IndexedDB layout the runner uses, so the save point, CONTINUE and
everything else behaves like it should — and your save survives reloads and
reboots.

**v1.5 — the "saves are deleted constantly" fix.** Two real bugs were left
in v1.4, and they are why saves still vanished after a reload and the game
kept asking you to pick a name:

1. **A load-order race.** The runner picks its save file system exactly once,
   at mount time: `window.oprt && window.oprt.gameStorage ? GXMFS : IDBFS`.
   The v1.4 polyfill lived in `index.js`, which the loader appends as a
   dynamic script *in parallel with* `runner.js`. Whenever the runner reached
   its mount first, it fell back to its broken IDBFS path (whose syncs
   silently no-op) and *nothing* could be saved or loaded that session. The
   polyfill is now inlined in `index.html`, where it runs synchronously
   during page parse — it always wins the race. (index.js keeps a guarded
   fallback copy for exotic embeds.)
2. **A save-wipe race inside the runner.** The runner's `FS.syncfs` calls are
   not serialized — it even warns *"FS.syncfs operations in flight at once"*
   itself. At boot and at every internal game restart the savedata mount is
   torn down and re-mounted: the LOAD reconcile starts fetching your files
   while a SAVE reconcile (the runner writes `decomp_vars.ini` /
   `trophies.ini` at boot) can enumerate the still-empty in-memory file
   system and **delete every remote file "missing" from it —
   `undertale.sav`, `file0`, `undertale.ini`, your whole save**. This is what
   made save states "be deleted constantly". The polyfill now **refuses
   every delete** on the savedata store: the game never legitimately deletes
   save files (True Reset and the decomp wipe overwrite them via writes),
   so nothing legitimate is lost — but the racing reconcile can no longer
   destroy anything. Both failure modes were reproduced in a live browser
   before the fix and verified gone after it.

The polyfill also exposed a second bug that had to be fixed in `runner.js`
itself: the runner decides "is this a touch device?" partly by checking
whether `window.oprt` exists — and the polyfill (or the real GX platform)
makes that true, so the game switched to touch mode and **ignored the
keyboard entirely** — no menu, no CONTINUE, nothing responded. The runner
now detects touch devices only by actual pointer/hover capability. (v1.4)

**v1.6 — the *real* "saves are deleted constantly" fix.** v1.5 fixed the
runner-side races, but one last wipe remained, and it fired on *every* page
load: the legacy save-sync (`savesync.js`, deltarune-embed heritage) opened
the save database **without a version** and, whenever it did not find the
`FILE_DATA` store yet (fresh browser profile, or simply racing the runner's
mount), **created a brand-new empty one** — an IndexedDB version upgrade
that silently erased the player's entire save before the game even booted.
The next boot then found nothing to load: back to the name-picking menu.
Its mirror-import also wrote records back in a lossy format (plain objects
instead of byte arrays), corrupting `decomp_vars.ini` / `trophies.ini`, and
its version ping-pong could block the gameStorage polyfill entirely.

`v1.6` replaces the whole file with a one-way, strictly **read-only mirror**
(IndexedDB → localStorage, for the menu and boss states to read). It never
opens the database with a version, never creates or upgrades stores, never
writes a single byte, and never imports mirrors anywhere automatically.
The gameStorage polyfill itself gained two more hardenings: it survives a
foreign version clash (VersionError → version-less open) and it *heals*
records whose contents lost their type in the old imports (rebuilt into
proper byte arrays on read/write). Deploys also reach you now: the service
worker re-checks for updates on every visit and revalidates shell files
with `cache: 'no-cache'` — a stale cached `index.js` could previously make
you run pre-fix save code for up to 10 minutes after a deploy.

**v1.8 — the crash fixes.** Three crash classes, all rooted in the same
save plumbing, are dead now:

1. **"Taking damage / dying crashes the game — in a lot of areas."** When
   you die, `scr_gameoverb` opens `undertale.ini`, bumps a counter, and
   re-saves the whole savedata buffer — and `scr_load` reads `file0` line
   by line, exactly 549 lines. A savedata map whose `file0` is short,
   truncated, or missing (old cloud-synced / pre-v1.7 copies) makes those
   file reads fail, which is a *fatal* GameMaker exception
   (`crash.log`: *"File is not opened for reading"* → the runner dies and
   the whole game re-boots). The gameStorage polyfill now **validates and
   repairs the savedata buffer at the exact door the runner reads it**:
   `file0` is normalized to 549 lines (recovering from the on-disk record
   or the mirror, or worst-case a fresh LV 1 file), `file9` is healed the
   same way, and a missing `undertale.ini` is synthesized from file0's
   own values. Repairs are written back so the next boot starts clean.
2. **The old `w.timestamp.getTime is not a function` boot/save crash.**
   Records written by pre-v1.6 code (or old WigdosXP imports) carry
   numeric/string timestamps, and the runner's own GXMFS syncfs throws on
   the first reconcile that touches them — forever, since the delete
   guard kept them around. The syncfs now normalizes timestamps at read
   time (runner.js), and each session runs a one-shot sweep that rewrites
   any non-Date timestamp in the save database into a proper `Date`,
   content untouched.
3. **Boss-state writes now go through the live database record** instead
   of the up-to-10-seconds-stale localStorage mirror (a stale merge could
   resurrect old `file0`/ini entries mid-write), and a failed write is
   reported on the menu instead of silently reloading into a half-written
   state.

Also in v1.8: the pause menu's stats strip shows your current equipment
**set bonus** (live, from the same exact-pair table the game data uses),
Undyne the Undying's state lands in `room_water19` and Mettaton NEO's at
LV 15 in `room_fire_turn` (verified against the bytecode triggers), and
loading a boss state stashes your old weapon/armor in the dimensional
box instead of eating them.

**v1.7 — boss states land where they should, set bonuses are real, and the
lag is gone.**

1. **The Annoying Dog room bug.** Loading a boss state (or any continue)
   used to dump you into the Annoying Dog room instead of the fight. Root
   cause, verified against the game's own bytecode: the built file0 was
   misaligned with `scr_load` by four lines, so the game read `0` as the
   room — and `scr_dogcheck` sends any room below `room_area1` straight to
   `room_of_dog`. The save builder now matches `scr_load` field-for-field
   (8 item pairs, weapon/armor, 512 flags, plot, menuchoice, song, **room**,
   time) and every boss room passes dogcheck.
2. **Set bonuses now actually do something — and the values you are shown
   are the values you get.** All five set checks compared
   `weapon*64 + armor` with *greater-than* against the exact pair's value,
   so a matching pair itself never qualified (you needed a *better* combo,
   which then stacked every lower set's message). The heal bonus (+5 with
   Stick + Bandage, +10 with Burnt Pan + Stained Apron) and the i-frame
   bonus (Ballet Shoes + Old Tutu — 60% longer) existed in
   `scr_recoitem` / `scr_damagestandard` but never fired for the actual
   sets; the item menu's live recompute carried an older, different value
   table on top of that. All checks are exact-pair now, the message values
   match the applied ones, and the heal/INV sets carry no ATK/DF side
   effects (the anti-cheat thresholds in `scr_load` were rebuilt to match
   too, so loading a save no longer applies a wrong set).
3. **"Lags a lot after some time" is fixed.** Three separate leaks fed it:
   the runner's console output was appended to a `<textarea>` with
   `value +=` — an O(n) copy per line that got slower the longer you
   played (the log is now capped and duplicate spam is collapsed); the
   save mirror leaked one IndexedDB connection per 10-second sync (each
   sync now closes its connection); and the sync ran on a plain
   `setInterval`, so a backgrounded tab queued a burst of overlapping
   syncs that all fired at once when you came back (the mirror now
   self-schedules, never overlaps itself and idles while the tab is
   hidden, catching up once when you return).

**Boss states — skip straight to any fight.** From the pause menu's
**BOSS STATES** screen you can jump straight to any major fight with a
hand-crafted save: the right stats, equipment, inventory, route flags and
plot value the fight expects, all computed the way the game's own scripts do it
(`scr_levelup` / `scr_weaponeq` / `scr_armoreq` / `scr_murderlv`):

- **TORIEL** — Ruins exit, LV 1 (Toy Knife + Faded Ribbon)
- **PAPYRUS** — the fog, LV 1 (Tough Glove + Manly Bandanna)
- **UNDYNE** — Waterfall, LV 1 (Ballet Shoes + Old Tutu)
- **UNDYNE THE UNDYING** — Genocide, LV 11, room_water19 (the
  waterfall bridge — walk through and the fight triggers)
- **METTATON EX** — The Core stage, LV 12
- **METTATON NEO** — Genocide, LV 15, the Hotland room before the
  Core entrance (plot 160, the murderlv chain complete through
  Undyne the Undying — the scene fires as soon as you walk up)
- **ASGORE** — the Barrier, LV 12 (Empty Gun + Cowboy Hat)
- **SANS** — Genocide, LV 19, Real Knife + The Locket, the Last Corridor

*(v1.8: every trigger's plot condition and the whole `scr_murderlv`
chain were re-verified instruction-by-instruction against the game's
bytecode. Two genocide states were genuinely broken before: UNDYNE THE
UNDYING landed in a neutral-route bridge room instead of
`room_water19`, and METTATON NEO landed on the neutral EX stage with a
plot value that disables the NEO scene — it now starts in
`room_fire_turn` at plot 160, LV 15 / 7000 EXP / 97 kills, exactly
what a real genocide run looks like at the Core entrance. The
GENOCIDE flag chains themselves were confirmed correct as they were,
and the menu's JavaScript port of `scr_murderlv` now matches the
bytecode comparison-for-comparison.)*

These are **not backups** — selecting one *replaces your current file*
(the menu says so and asks first). After the jump, CONTINUE starts you a few
steps from the fight, exactly as that route would arrive there. The files
are written through the same gameStorage client the runner itself uses, so
what the menu writes and what the game reads are one single, consistent
save record.

**Equipment set bonuses.** Wearing the *exact* matching weapon + armor pair
gives a small, pair-specific bonus — every set does something different now,
not just raw stats (the bonus is recomputed when you equip, so you see it
right away):

| Set | Bonus |
|---|---|
| Stick + Bandage | **Comfort food** — items heal +5 HP |
| Toy Knife + Faded Ribbon | ATK +2, DEF +1 |
| Tough Glove + Manly Bandanna | ATK +3, DEF +1 |
| Ballet Shoes + Old Tutu | **Pirouette** — i-frames last 60% longer |
| Torn Notebook + Cloudy Glasses | ATK +2, DEF +2 |
| Burnt Pan + Stained Apron | **Home cooking** — items heal +10 HP |
| Empty Gun + Cowboy Hat | ATK +3, DEF +2 |
| Worn Dagger + Heart Locket | ATK +2, DEF +4 |

The equip message tells you what the set does, the values it shows are the
values the game applies, and the bonuses are re-derived from your current
gear wherever it matters — healing items, the damage/i-frame calculation
and the item menu all agree. (game data v1.7)

**More Sans death dialogue (genocide route).** Sans's rematch intro now has
unique lines for deaths 12 through 17 — he used to run out of material after
11 — and past 18 deaths he rotates through a set of one-liners instead of
always saying the same thing. He also has extra taunts during the long haul
of his fight (turn 24+).

Console helpers (F12):

    UTSaveInfo.parse()               // name, LV, route, room, boss checkpoint
    UTBossStates.list                // the boss table (ids, stats, flags)
    UTBossStates.load('sans')        // jump to a boss (returns a Promise)
    UTMirror.exportNow()             // re-mirror the save files to localStorage

**Pause menu (ESC).** ESC pauses the engine for real (`GM_pause`) and opens
a menu drawn **with the game's own assets**: the real in-game font
(`fnt_maintext`, Determination Mono — extracted from `game.unx` itself, atlas
and all), the red SOUL as the cursor, selected entries in yellow, and a live
stats strip (name, LV, HP and route state). It sits on a 640x480 canvas
pinned to the game canvas, so it shares the game's pixel grid and scale:

    RESUME   BOSS STATES   FULLSCREEN   QUIT

**BOSS STATES** is the skip-to-a-fight list described above (each entry shows
its route tag, LV and location; the selected fight gets a confirmation box
before it replaces your file).

*(v1.6: the old MY BACKUPS screen and the Shift+Ctrl+E snapshot module were
removed — with the save system actually persisting now they only papered
over the wipe bugs. Boss states remain as the way to jump straight to any
fight, including the genocide runs: SANS, UNDYNE THE UNDYING, METTATON NEO.)*

Arrows (or WASD) select, Z/ENTER confirms, X/ESC goes back — mouse works
too. While in fullscreen the browser keeps ESC for exiting fullscreen, so
open the menu before going fullscreen (or use F11 to stay windowed).
QUIT returns to the loading screen. The same menu opens automatically on
GX Mobile when the app loses focus.

*(v1.3 fixed a nasty bug from earlier builds: backup records were
imported by the save-sync into the game's file system, where they could
crash the boot with "EXCEPTION THROWN". That whole module is gone in v1.6,
and its leftover records are cleaned up automatically.)*

*(The boot is armored in two more ways: a boot that crashes before the main
loop (a flaky WebGL context race) reloads itself once hands-free, and if the
browser kills the WebGL context mid-session (GPU reset, tab throttling), the
page recovers the same way instead of freezing on an error.)*

## Controls

Arrow keys move · Z / ENTER confirm · X cancel · C menu · ESC pause ·
F4 fullscreen

## Repo layout

| File | What it is |
|---|---|
| `index.html` | Minimal loader — downloads all game parts **in parallel** with a live SOUL progress screen, then boots the engine |
| `sw.js` | Service worker — caches the game files so repeat visits boot in ~2 s and keep working offline |
| `index.js`, `runner.js`, `runner.wasm`, `runner.data` | Stock GameMaker HTML5 runtime (plus this build's custom modules, all in `index.js`) |
| `game.unx.part1-5` | The game data (~100 MB), merged in the browser |
| `*.ogg` | Music & sounds (cached on demand as you hear them) |
| `lang/`, `fnames`, `savesync.js`, `audio-worklet.js` | Runtime support files |

## Updating the game files

Whenever you change any game file (`game.unx.part1-5`, `runner.*`, `lang/*`,
any `.ogg`), bump `CACHE_VERSION` in **both** `index.html` and `sw.js` so
visitors pick up the new version (old caches clean themselves up). Page code
(`index.html`, `index.js`, `style.css`, `savesync.js`) is fetched network-first
and needs no bump.
