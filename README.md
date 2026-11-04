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

**Boss states — skip straight to any fight.** From the pause menu's
**BOSS STATES** screen you can jump straight to any major fight with a
hand-crafted save: the right stats, equipment, inventory, route flags and
plot value the fight expects, all computed the way the game's own scripts do
it (`scr_levelup` / `scr_weaponeq` / `scr_armoreq` / `scr_murderlv`):

- **TORIEL** — Ruins exit, LV 1 (Toy Knife + Bandage)
- **PAPYRUS** — the fog, LV 1 (Tough Glove + Manly Bandanna)
- **UNDYNE** — Waterfall, LV 1 (Ballet Shoes + Old Tutu)
- **UNDYNE THE UNDYING** — Genocide, LV 11, the murderlv chain armed
- **METTATON EX** — The Core stage, LV 12
- **METTATON NEO** — Genocide, LV 13
- **ASGORE** — the Barrier, LV 12 (Empty Gun + Cowboy Hat)
- **SANS** — Genocide, LV 19, Real Knife + The Locket, the Last Corridor

These are **not backups** — selecting one *replaces your current file*
(the menu says so and asks first; press Shift+Ctrl+E first if you want to
keep where you are). After the jump, CONTINUE starts you a few steps from
the fight, exactly as that route would arrive there.

**Determination Backup — snapshots of your own file.** **Shift+Ctrl+E**
(anywhere) snapshots your save into a slot tagged with everything the menu
needs to show it:

- **route state** — PACIFIST (no kills) / NEUTRAL / GENOCIDE (computed with
  the game's own `scr_murderlv` logic, from your save's flags)
- **boss checkpoint** — SANS, UNDYNE THE UNDYING, ASGORE, METTATON EX / NEO,
  FLOWEY, PAPYRUS, TORIEL, ASRIEL
- name, LV, area and timestamp — and slots can be restored or deleted from
  the menu

A small in-game overlay confirms it with a spinning SAVE star.
**AUTO-BACKUP** (on by default, toggle in the pause menu) snapshots your save
whenever it changes — no menu needed — at most once every 5 minutes. Up to 24
slots are kept; when full, the oldest automatic ones are pruned first.

Restoring writes the slot back over both the save mirror *and* the game's
own file system (IndexedDB), waits for the write to land, then reloads — you
come back exactly where the snapshot was taken.

Some browsers reserve Ctrl+Shift+E (Firefox opens its Network monitor with
it), so the combo is captured two ways: a plain keydown listener (enough
wherever the browser delivers the combo), and — while in fullscreen — the
Keyboard Lock API. **F4 toggles fullscreen** (same key as the official PC
release), so on Firefox: `F4` first, then `Shift+Ctrl+E` works as many
times as you like.

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

The equip message tells you what the set does. (game data v1.3 — the loading
footer shows the version; if your offline copy is older, re-download it.)

**More Sans death dialogue (genocide route).** Sans's rematch intro now has
unique lines for deaths 12 through 17 — he used to run out of material after
11 — and past 18 deaths he rotates through a set of one-liners instead of
always saying the same thing. He also has extra taunts during the long haul
of his fight (turn 24+).

Console helpers (F12):

    UndertaleBackups.list()          // show your snapshots (with route/boss tags)
    UndertaleBackups.make()          // make a snapshot now
    UndertaleBackups.restore(id)     // restore a snapshot over the live save
    UndertaleBackups.del(id)         // delete a snapshot
    UndertaleBackups.auto()          // show / set auto-backup
    UTSaveInfo.parse()               // name, LV, route, room, boss checkpoint
    UTBossStates.list                // the boss table (ids, stats, flags)
    UTBossStates.load('sans')        // jump to a boss (returns a Promise)

**Pause menu (ESC).** ESC pauses the engine for real (`GM_pause`) and opens
a menu drawn *in the game's own visual language*: a 640x480 canvas overlay
that shares the game canvas's pixel grid, an embedded 5x7 pixel font, the red
SOUL as the cursor, selected entries in yellow — plus a live stats strip
(name, LV, HP and route state):

    RESUME   BOSS STATES   MY BACKUPS   FULLSCREEN   QUIT

**BOSS STATES** is the skip-to-a-fight list described above (each entry shows
its route tag, LV and location). **MY BACKUPS** manages your own snapshots:
filter by route (ALL / PACIFIST / NEUTRAL / GENOCIDE), make a snapshot,
restore (Z), delete (D), toggle AUTO-BACKUP — all on the same pixel-font
screen.

Arrows (or WASD) select, Z/ENTER confirms, X/ESC goes back — mouse works
too. While in fullscreen the browser keeps ESC for exiting fullscreen, so
open the menu before going fullscreen (or use F11 to stay windowed).
QUIT returns to the loading screen. The same menu opens automatically on
GX Mobile when the app loses focus.

*(v1.3 also fixes a nasty bug from earlier builds: backup records were
imported by the save-sync into the game's file system, where they could
crash the boot with "EXCEPTION THROWN". Records now live outside the sync's
namespace, existing junk is cleaned up automatically, and the sync skips
record keys entirely. The save-sync also refuses to import a mirror that is
older than the file already stored, so a lagging mirror can no longer
overwrite a fresh save on boot.)*

*(The boot is armored in two more ways: a boot that crashes before the main
loop (a flaky WebGL context race) reloads itself once hands-free, and if the
browser kills the WebGL context mid-session (GPU reset, tab throttling), the
page recovers the same way instead of freezing on an error.)*

## Controls

Arrow keys move · Z / ENTER confirm · X cancel · C menu · ESC pause ·
F4 fullscreen · Shift+Ctrl+E make a backup snapshot

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
