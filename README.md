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

**More Sans death dialogue (genocide route).** Sans's rematch intro now has
unique lines for deaths 12 through 17 — he used to run out of material after
11 — and past 18 deaths he rotates through a set of one-liners instead of
always saying the same thing. He also has extra taunts during the long haul
of his fight (turn 24+).

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

**Save States + Determination Backup.** Your saves are snapshotted into
tagged *save states* — every state records its route and where you were:

- **route state** — PACIFIST (no kills) / NEUTRAL / GENOCIDE (computed with
  the game's own `scr_murderlv` logic, from your save's flags)
- **boss checkpoint** — SANS, UNDYNE THE UNDYING, ASGORE, METTATON EX / NEO,
  FLOWEY, PAPYRUS, TORIEL, ASRIEL
- name, LV, area and timestamp — and slots can be restored or deleted from
  the menu

**Shift+Ctrl+E** makes a state instantly (a small in-game overlay confirms
it with a spinning SAVE star), and **AUTO-BACKUP** (on by default, toggle in
the pause menu's SAVE STATES screen) snapshots your save whenever it changes
— no menu needed — at most once every 5 minutes. Up to 24 states are kept;
the oldest automatic ones are pruned first.

Restoring writes the state back over both the save mirror *and* the game's
own file system (IndexedDB), then reloads — you come back exactly where the
state was taken.

Some browsers reserve Ctrl+Shift+E (Firefox opens its Network monitor with
it), so the combo is captured two ways: a plain keydown listener (enough
wherever the browser delivers the combo), and — while in fullscreen — the
Keyboard Lock API. **F4 toggles fullscreen** (same key as the official PC
release), so on Firefox: `F4` first, then `Shift+Ctrl+E` works as many
times as you like.

Console helpers (F12):

    UndertaleBackups.list()          // show the save states (with route/boss tags)
    UndertaleBackups.make()          // make a state now
    UndertaleBackups.restore(id)     // restore a state over the live save
    UndertaleBackups.del(id)         // delete a state
    UndertaleBackups.auto()          // show / set auto-backup

**Pause menu (ESC).** ESC pauses the engine for real and opens a menu
drawn *in the game's own visual language*: a 640x480 canvas overlay that
shares the game canvas's pixel grid, an embedded 5x7 pixel font, the red
SOUL as the cursor, selected entries in yellow — plus a live stats strip
(name, LV, HP and route state):

    RESUME   SAVE STATES   FULLSCREEN   QUIT

**SAVE STATES** is the save-state manager described above: filter by route
(ALL / PACIFIST / NEUTRAL / GENOCIDE), make a state, restore (Z), delete
(D), toggle AUTO-BACKUP — all on the same pixel-font screen.

Arrows (or WASD) select, Z/ENTER confirms, X/ESC goes back — mouse works
too. While in fullscreen the browser keeps ESC for exiting fullscreen, so
open the menu before going fullscreen (or use F11 to stay windowed).
QUIT returns to the loading screen. The same menu opens automatically on
GX Mobile when the app loses focus.

*(v1.3 also fixes a nasty bug from earlier builds: backup records were
imported by the save-sync into the game's file system, where they could
crash the boot with "EXCEPTION THROWN". Records now live outside the sync's
namespace, existing junk is cleaned up automatically, and the sync skips
record keys entirely.)*

## Controls

Arrow keys move · Z / ENTER confirm · X cancel · C menu · ESC pause ·
F4 fullscreen · Shift+Ctrl+E make a save state

## Repo layout

| File | What it is |
|---|---|
| `index.html` | Minimal loader — downloads all game parts **in parallel** with a live SOUL progress screen, then boots the engine |
| `sw.js` | Service worker — caches the game files so repeat visits boot in ~2 s and keep working offline |
| `index.js`, `runner.js`, `runner.wasm`, `runner.data` | Stock GameMaker HTML5 runtime |
| `game.unx.part1-5` | The game data (~100 MB), merged in the browser |
| `*.ogg` | Music & sounds (cached on demand as you hear them) |
| `lang/`, `fnames`, `savesync.js`, `audio-worklet.js` | Runtime support files |

## Updating the game files

Whenever you change any game file (`game.unx.part1-5`, `runner.*`, `lang/*`,
any `.ogg`), bump `CACHE_VERSION` in **both** `index.html` and `sw.js` so
visitors pick up the new version (old caches clean themselves up). Page code
(`index.html`, `index.js`, `style.css`, `savesync.js`) is fetched network-first
and needs no bump.
