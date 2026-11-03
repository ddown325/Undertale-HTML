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

**Equipment set bonuses.** Wearing a matching weapon + armor pair from the
same area gives a small bonus, shown when you equip it and included in your
AT/DF stats:

| Set | Bonus |
|---|---|
| Stick + Bandage | DEF +1 |
| Toy Knife + Faded Ribbon | ATK +1, DEF +1 |
| Tough Glove + Manly Bandanna | ATK +2 |
| Ballet Shoes + Old Tutu | DEF +3 |
| Torn Notebook + Cloudy Glasses | ATK +1, DEF +2 |
| Burnt Pan + Stained Apron | DEF +3 |
| Empty Gun + Cowboy Hat | ATK +2, DEF +1 |
| Worn Dagger + Heart Locket | ATK +2, DEF +2 |

Deliberately small numbers — they're a reward for themed loadouts, not a
balance change.

**Determination Backup (Shift+Ctrl+E).** One keystroke snapshots your
save data (every save key the save-sync system maintains) into a timestamped
backup slot — the last 5 slots are kept, older ones pruned automatically.
A small in-game overlay confirms it with a spinning SAVE star:

    * (Knowing your progress is safe fills you with determination.)

Some browsers reserve Ctrl+Shift+E (Firefox opens its Network monitor with
it), so the combo is captured two ways: a plain keydown listener (enough
wherever the browser delivers the combo), and — while in fullscreen — the
Keyboard Lock API, so reserved combos still reach the game. **F4 toggles
fullscreen** (same key as the official PC release), so the reliable sequence
on Firefox is: `F4` first, then `Shift+Ctrl+E` works as many times as you
like.

Backups live in your browser storage under `ut::backup::*`. Power-user
helpers in the browser console (F12):

    UndertaleBackups.list()          // show the kept backup slots
    UndertaleBackups.make()          // trigger a backup now
    UndertaleBackups.restore(id)     // copy a slot back over the live save

(restore is best used with the tab freshly reloaded — the background
save-sync may otherwise overwrite an older restore from IndexedDB.)

**Pause menu (ESC).** The pause menu is built into the game: ESC (while
windowed) pauses the engine for real, blurs the screen and shows an
Undertale-styled menu with a red SOUL cursor:

    RESUME   FULLSCREEN   BACKUP SAVE   QUIT

Arrows (or W/S) select, Z/ENTER confirms, X/ESC resumes — mouse works too.
While in fullscreen the browser keeps ESC for exiting fullscreen, so open
the menu before going fullscreen (or use F11 to stay windowed while playing).
QUIT returns to the loading screen. The same menu opens automatically on
GX Mobile when the app loses focus.

## Controls

Arrow keys move · Z / ENTER confirm · X cancel · C menu · ESC pause ·
F4 fullscreen · Shift+Ctrl+E backup your save

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
