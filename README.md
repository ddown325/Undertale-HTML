# UNDERTALE — Browser Edition

Play it live: **https://ddown325.github.io/Undertale-HTML/**

Fan project. UNDERTALE was created by Toby Fox — support the official game at
[undertale.com](https://undertale.com).

## Offline / single-file edition

Don't want to stream ~120 MB every time your browser cache clears? Grab the
**single-file offline edition** — the complete game (engine, data and all 212
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

**v3.0 — run button, set-bonus pages, and a third pass on his voice.**

1. **Hold X to run.** In the overworld, hold X (or Shift) to move at 1.45x
   speed with a 1.45x-speed walk animation (`image_speed` 0.2 → 0.29). The
   boost is applied after each frame's movement and collision resolution and
   re-checked with `place_meeting` against the wall objects, so it can never
   push you through geometry; it's disabled during dialogue, menus, and
   cutscenes. Note the random-encounter counter ticks per frame moved, so
   running covers 1.45x ground per tick — running is also a (gentle) way to
   see fewer encounters per distance.
2. **The set bonus is a second page now.** Checking the Old Tutu or Ballet
   Shoes via item INFO reads like the vanilla Punch Card: page 1 is the
   normal description, press Z and page 2 shows the SET BONUS lines, press Z
   to close — no grown text box. The Japanese mirror is split to match
   (`item_desc_24_1` / `item_desc_25_1`).
3. **Bonus fix:** the Torn Notebook's second INFO page (the INV explanation)
   was unreachable forever — `item_desc_45_0` ended with `/%` (close) instead
   of `/` (advance). Now readable.
4. **Third voice pass, 78 lines, opus-reviewed.** Fight-count taunts 5-11
   rebuilt ("mutant hand" twice → a finger-count arc and a half-dozen bakery
   arc that pays off F12's "like eggs"; the spider fact was wrong — spiders
   have legs, not fingers — and the punchline apologized for the joke; "the
   big one-oh" → "double digits."); the post-kill tiers swapped
   fortune-cookie lines for concrete material (a doubled Grillby's tab he
   insists is "counting wrong", dust doing his sentry-station job for him,
   Papyrus's saved plate he doesn't remember eating, echo flowers repeating
   words he doesn't remember saying, penciling his own death in like a
   dentist appointment, tipping the reaper); the corridor post-kill greetings
   decay across tiers (heya → hey → oh, hey → well → silence → a hollow
   heya); "welp." openers cut from 8 pages to 2; two 5-line death-screen
   pages rewrapped to 4. The SK1-5 rule (he doesn't know he died) re-verified
   clean across all 90 lines.
5. **Housekeeping:** `sw.js` CACHE_VERSION was stale since v2.9 (README says
   keep it in sync) — now bumped with each release again.
   `CACHE_VERSION → v3.0`, `SIZES.part5 = 20043444`; lang mirrors regenerated
   (en 17251 / ja 16457 keys).

**v2.9 — the death text fully recut, and Sans learns (slowly) that something
is very wrong.**

1. **A kill counter he doesn't know about.** New `[Sans] SK` in
   undertale.ini, incremented when Sans actually dies (`obj_sansb_body`
   death sequence). The game-over screen reads it: before your first kill
   you get the 400-series interrupts (Asgore's speech replaced by one of 15
   Sans lines cycling by fight count — no trailing "..." anymore, he steps
   on the king's line sharp); after you've killed him you get the new
   **500-series: 90 lines in 6 tiers of 15**, cycling by fight count.
2. **SK tiers 1-5: he doesn't know.** Dying to him after killing him plays
   faint wrongness only — déjà vu, bones aching, a nap that felt too long, a
   dream where nobody wakes him up. No memory of death, no "last time".
   **Tier 6+:** he's deduced it ("when you die, you come back. when i die,
   i'm supposed to take the long nap." / "do me a favor, pal. make it quick
   next time.").
3. **Corridor post-kill greetings** in the same 6 tiers, ending on the
   payoff against his canon dying words: "i'm going to grillby's. ...
   that's what i said last time, isn't it?"
4. **The glowing eye is in his socket.** Two new frames on
   `spr_face_sansnoeyes` (cyan/yellow flicker drawn IN the right socket —
   it used to float low over the nose), wired to a new `faceemotion 5` so
   every other no-eyes use stays stock. The F17 finale uses it.
5. **Dialoguer boxes auto-grow** (line-count simulation incl. comicsans
   kerning) for any page that would exceed 3 lines — dormant safety net now
   that every page fits, but nothing overflows either.

**v2.8 — the taunts polished, the finale finds its voice, and Sans cuts
Asgore off on every single death.**

1. **Deaths 12-17, second pass.** Playtesting called the v2.7 arc "weird" in
   places, so the middle deaths got re-cut: 12 now pays off "count for me"
   as patronizing praise ("hey, look at you. counted that all by yourself.
   ... guess i can count on you, huh." → dozen → "one more and it's a
   baker's dozen."); 13 collects it as a "kept promise" before the E3 crack
   ("...but bad luck keeps missing you. wonder where it all lands."); 14
   calls back 7's lucky-seven jackpot and flips it ("too bad you're not
   playing slots. you're playing the house... and the house never loses.");
   15's number joke dies mid-sentence ("somewhere in there, i quit having
   fun. but you keep loading back in... so i guess one of us still is.");
   16 stays a past-tense eulogy but lands harder ("everybody liked him...
   he liked everybody." → "welp."); 17 stays the flat ritual-break it was.
   Deaths 2-11 remain byte-identical.
2. **The death-17 finale now has a voice.** The closing block (typer 21 —
   silent by design in vanilla, used by the neutral judgment) played with
   no typewriter sound. New `typer 125` in `SCR_TEXTTYPE`: identical slow
   pacing and font, but `snd_nosound` → `snd_txtsans`. The canon pair
   "Then why'd you kill my brother?" / "You dirty brother killer." still
   lands verbatim, black sockets and all — now you can hear it.
3. **Sans takes over the GAME OVER screen.** In vanilla, dying to him only
   got you the dunked-on easter egg (msg 300, spare-trap deaths). Now
   `obj_heartdefeated` checks for a live `obj_sansb` on every death: Asgore
   starts his "You cannot give up just yet..." and Sans cuts him off with
   one of **15 unique lines** picked by death count (`400 + (F-1) mod 15`,
   reading [Sans] F from undertale.ini, so they cycle after 15). The arc:
   casual teasing about the opening barrage and blue bones (1-3) →
   determination/save mockery (4-7) → karma and KR poison (8-9) → the
   mercy-trap gloat (10) → "that's not determination you've got... that's
   just stubbornness." (11) → the jokes stop (12-14) → "my brother
   would've forgiven you... that's the worst part." (15). They use the
   same game-over sans voice as the dunked-on line (typer 110); the
   dunked-on easter egg itself still plays on spare-trap deaths.
   lang/*.json reference mirrors regenerated (17050 entries);
   `CACHE_VERSION → v2.8`, `SIZES.part5 = 20005556`.

**v2.7 — Sans's death taunts 12-17 rewritten: the jokes die and the hate
becomes real, ending on the dirty brother killer.**

1. **The arc.** Toby's taunts 2-11 each riff on the number; the old custom
   12-17 didn't escalate — "most fun i've had in a while" and "good times"
   read almost cheerful. The rewrite keeps the ritual ("hmm. that
   expression... that's the expression of someone who's died N times in a
   row.") while it curdles: 12 pays off 11's "count for me... we'll start
   from 12" with the dozen → baker's-dozen chain that 13 collects; 14's
   "i think i'm the last one doing this." / "tough crowd." aims the joke at
   the empty underground; 15's "i keep waiting for you to get tired of
   this. but you never do, do you." drops the mask; 16 is Papyrus in past
   tense ("knew a guy who never got tired of anything. big guy, loud.")
   cut off with "...anyway."; and 17 breaks the format entirely — no
   opener, just a flat "seventeen." and "i'm done counting."
2. **The finale.** After 17's speech a second, silent text block plays
   (typer 21 — no typewriter sound, same as the neutral-route judgment)
   with the black-sockets face: "...all right. here it is." → "Then why'd
   you kill my brother?" → "You dirty brother killer." — the last two
   byte-identical to the game's own judgment lines, capitals and all. A new
   `con 114` stage in `obj_lastsans_trigger` chains it to the fight start,
   mirroring vanilla's own back-to-back-dialoguer pattern (`con 20/21`).
3. **Faces rebuilt.** The portraits now carry the escalation: E1/E2 smug
   early, the first weary E3 crack at 13, E4 (empty black sockets)
   dominating from 15 on. The 18+ pool ("still waiting on that answer, by
   the way." / "one of these times it's gonna stick." / "...nothin'
   personal, pal." / "...he believed in you, y'know.") is E3/E4 only, and
   even vanilla's "right on time." is re-faced from grin to black sockets
   so the mood never bounces back to cheerful. Deaths 2-11 and the ≥18
   branch logic are otherwise untouched (byte-diffed); the lang/*.json
   reference mirrors were regenerated to match.

**v2.6 — the true-pacifist finale fixed for real: the Asriel fight
triggers, and Go Back no longer skips it.**

1. **The ASRIEL state carried post-fight values — the fight-skip bug.**
   v2.5 spawned you at the barrier with `plot 999`, `flag 510 = 1` and
   `flag 7` — three values the game only sets in `obj_asriel_overworldanim`,
   the goodbye scene *after* the Asriel fight is over (they are
   post-finale markers, not prerequisites). The smoking gun: `flag 510`
   is exactly what arms `obj_friendc_event` in the prebarrier corridor —
   so the moment you picked **Go Back** at Asgore's Continue/Go Back
   choice (or walked left through the door), room 237 loaded, the
   post-Asriel "Frisk! This is all just a bad dream…!" ending walk fired,
   `flag 510` flipped to 2, and the finale was marked complete — the
   Asriel fight permanently skipped for that file. v2.6 gives the state
   the values a real true-pacifist player has standing at the barrier:
   `plot 208` (set by `obj_asgore_prebarrier_event` as Asgore walks in)
   and **only** `flag 493 = 12` (the friendship chain
   `obj_asgore_finalintro` gates the pacifist interrupt on). With 510/7
   unset, Go Back is the vanilla postpone — re-enter and Asgore asks
   "Back so soon? Ready / Go Back" — and Continue plays the whole chain:
   Asgore's speech, battlegroup 100, Toriel's interruption, the friends
   scene, Flowey absorbing the souls, the transformation, and battlegroup
   255 — the real Asriel fight. Verified end-to-end in a headless
   browser through the actual save-load path (title → Continue →
   barrier → … → fighting Asriel's SAVE-your-friends phase), plus
   independent code audit of every gate in the chain.
2. **The "heals are wrong" report was the set-bonus text, and it now
   renders.** The three `item_use_setbonus_*` strings carried `\[1\]`
   tokens — 5 characters — while `scr_gettext`'s substitution matcher
   expects the 4-character `\[1]` form (it checks the character at
   i+3 for `]`), so the numbers never substituted and the equip message
   showed literal `\[1\]`. The strings are fixed in place; equipping a
   set now reads e.g. "Set bonus! INV +30" with the real numbers.
   (The heal *values* themselves were already wiki-exact — `scr_itemuseb`
   is byte-identical to the clean baseline.)
3. **A fresh-boot DF typo is corrected.** `SCR_GAMESTART` initialized
   `global.setdf = 1` instead of 0 (a one-byte typo from the set-bonus
   feature pass), giving a phantom +1 DF on new games until the first
   save load recomputed it. Now 0, matching `scr_load`.
4. **UNDYNE THE UNDYING spawns on the bridge.** Same class of bug as the
   old Sans spawn: the state saved into room 132 (`room_water19`, the
   savepoint room) while its trigger — `obj_monsterkidtrigger7` — lives
   one room later in room 133 (`room_water20`). It now spawns at the
   room's own spawn point; walk right into the Monster Kid cutscene and
   the fight.
5. **Boss-state labels at the barrier.** The ESC menu now tells ASGORE
   and ASRIEL saves apart at room 238 the same way the game does — by
   the friendship flag 493, not by the kills-derived route (the
   zero-kill ASGORE state was mislabeled for a moment there).

**v2.5 — the Sans fight intro restored, boss states at the right rooms, and
the reload crash killed for real.**

1. **The reload crash is fixed (the real one).** After a first visit, a
   normal reload could leave the engine dead on a black "LOADING ENGINE"
   screen — only a hard reload brought it back. Root cause: the page loaded
   `index.js` and `runner.js` as two independent dynamic scripts. Dynamic
   scripts execute in whatever order they arrive, and on a reload the
   service worker serves `runner.js` from its cache *instantly* while
   `index.js` is revalidated over the *network* (network-first by design,
   so updates apply). The runner then booted before `index.js` had executed
   and called `manifestFiles()` — a function only `index.js` defines —
   which threw `ReferenceError: manifestFiles is not defined` and killed
   the boot silently (reproduced live on this site's v2.4). v2.5 chains
   the two scripts: `runner.js` is not even appended until `index.js` has
   finished loading, restoring the template's original order no matter
   which one the network delivers first. The 45 s boot watchdog stays as
   the safety net.
2. **The Sans fight intro plays properly again.** v2.1's "instant battler"
   hack had silently swapped two comparisons inside `obj_sansb`'s Step
   event, so the battle always started in its dead debug branch: the menu
   was live while Sans' intro talk was still playing (you could attack him
   mid-speech) and his intro text double-printed into the battle box. The
   two operands are restored to the original values with a 3-byte in-place
   patch — the event now decompiles byte-identical to the clean baseline,
   so the fight opens with the birds-are-singing intro, the dialogue, and
   then Megalovania, exactly like the real route.
3. **The SANS boss state spawns in the Judgment Hall.** It used to save
   into room 231 — `room_lastruins_corridor`, the gray New Home story
   corridor *one room before* the hall. It now saves into room 232
   (`room_sanscorridor`), on the savepoint at the left of the hall; walk
   right and `obj_lastsans_trigger` runs the full "it's a beautiful day
   outside" cutscene (death-count lines included) straight into the fight.
4. **The ASRIEL boss state starts at the barrier — the way the fight is
   actually reached.** It used to drop you directly into the
   transformation room (`room_asrielappears`), skipping the entire
   finale. It now saves into room 238 (`room_castle_barrier`) ~~with the
   authentic end-of-true-lab plot value (999) and flags (493 = 12, 510,
   7)~~ *(v2.6 corrected those three values — see above — to the actual
   pre-fight plot 208 and flag 493 alone.)* Arriving there plays the
   whole vanilla chain: Asgore's speech, Toriel's interruption and the
   friends scene (the pacifist-only branch `obj_asgore_finalintro` gates
   on flag 493), Flowey absorbing everyone, the transformation — and
   then the real Asriel fight with Hopes and Dreams playing.

**v2.4 — the deep repair: rebuilt from the clean baseline, Asriel truly
fightable, bullet cleanup restored, heals wiki-exact, boot self-healing.**

0. **The game data was rebuilt from the October baseline.** The files
   re-uploaded on Nov 5 had silently lost the code of **302 code entries**
   (cutscene drivers like `obj_asrielappear_Alarm_4`, bullet border
   collisions, room scripts) and carried 36 more entries with corrupted
   local-variable tables — the v2.3 pass was built on top of that damage
   without noticing. v2.4 rebuilds from the intact October data and
   re-applies every intended feature on top, so all 302 entries carry their
   original code again. Verified: 0 duplicate code entries (v2.3 had 13),
   0 decompile failures (v2.3 had 245), all object-event bindings at their
   original positions.
1. **ASRIEL is actually fightable now.** The v2.3 state dropped you into
   `room_asrieltest` (room 334) — a leftover *dev test room* that just
   floats a static Asriel with no battle controller (and could crash the
   boot outright). The state now saves into `room_asrielappears` (room 331,
   whitelisted in `scr_dogcheck`), where the vanilla self-contained
   transformation cutscene auto-plays and ends by launching battlegroup
   255 — the real Asriel fight (`obj_asrielb`, Hopes and Dreams) in
   `room_battle`. The cutscene itself was dead before (its `Alarm_4`
   driver was one of the 302 emptied entries) and runs again.
2. **The "crashes when equipping the ballet set" class is gone.** The
   parent bullet object's border-collision handlers (`blt_parent`
   Collision rborder/dborder, plus loopbulletgrow/soapbul) were among the
   emptied entries — bullets never destroyed themselves at the room edges,
   so bullet-heavy fights (Undyne — exactly where the ballet set is your
   gear) accumulated instances until the runner died. Border cleanup is
   restored; the Ballet Shoes + Old Tutu INV+30 set bonus is unchanged.
3. **Heals are wiki-exact.** The item-use table already matched the wiki
   (verified per item), but v1.1's custom set bonuses made equipped sets
   heal *extra* (Pan+Apron +10, Stick+Bandage +5) on top of the item
   value. Those two hidden bonuses are removed — food now heals exactly
   what the wiki says (the vanilla Burnt Pan +4 is authentic and stays).
4. **"After a save state the game won't load without a hard reload" is
   fixed at both ends.** The ASRIEL state's dev-room crash is gone (the
   main trigger), and the loader is now self-healing: parts are read only
   from the *current version's* cache (a stale same-sized part from an old
   deploy's cache can no longer be stitched into the boot), old caches are
   purged at page parse before anything is fetched, and a 45-second boot
   watchdog purges the caches and reloads once — the hands-free equivalent
   of the hard reload players had to do by hand.
5. **The Last Corridor flow keeps the v2.3 restore** (trigger starts at
   `con=0`, the battlegroup launch is writer-guarded, the death-count
   speech plays, then Megalovania) — now on the clean baseline.

**v2.3 — the nine-fix pass: Asriel state fixed, corridor cutscene restored,
set bonus finished, texts polished.**

1. **ASRIEL boss state works now.** The state saves into `room_asrieltest`
   (room 334), which fails `scr_dogcheck`'s valid-room range check (5–266)
   and dumped you into `room_of_dog` instead of the fight. The game data now
   whitelists the room, and the state ships the true-lab friendship flag
   (`flag[493] = 12`) so it really is the pacifist-finale save it claims.
2. **The Sans judgment cutscene plays again.** v2.1's "speech-skip +
   instant battler" edit left the Last Corridor trigger starting the battle
   on the first frame — unguarded, so it re-ran every tick — and the extra
   death-count dialogue was dead code. The trigger is back to vanilla flow:
   walk in, the speech plays (death-count lines included), then Megalovania.
3. **Ballet Shoes + Old Tutu set bonus is real and labeled.** The i-frame
   set now grants **INV +30** after every hit (was +12 while the equip
   message claimed +30), covers the ~16 mod-added bullet types that bypassed
   `scr_damagestandard`, and both item descriptions state
   **SET BONUS (CUSTOM)** in EN and JA. The pause menu's set readout matches.
4. **Heal values verified against the wiki** — every consumable already
   matched (pie full, noodles 90/15/4 by context, snowman 45, dog salad
   2/10/30/MAX...). The two text lies are fixed: Last Dream's description
   said 12 HP (heals 17, now also named "Last Dream"), and the Cinnamon
   Bunny was misnamed "Cinnamon Bun" (battle name now "CinnaBun").
5. **Sans's extra death-count texts (12–17 deaths) rewritten** in the
   requested tone — he hates you for emptying the underground, never says
   it outright, and is having the time of his life killing you over and
   over — plus the 18+ random pool, and a stray `%%` that cut off the
   "again." beat on death 17.
6. **PACI labels are back.** A zero-kill file is LV1 by definition, so the
   pause menu badges it PACI (blue) again instead of NEUTRAL.
7. **Faster boot.** `index.js`/`runner.js` prefetch in parallel with the
   game data, and the `lang/*.json` mirrors (pure reference — the game
   reads its text from data compiled into `game.unx`) load in the
   background instead of blocking the loader.
8. **Quieter console.** The wasm audio engine's
   "Prevented call into an uninitialised yyal" spam is filtered (the
   runner already guards the actual call). The old `.ck`/timestamp crashes
   from error.txt were already fixed by the v1.9 runner armor — verified
   still in place.
9. **lang/*.json regenerated** from the game data's own text tables, so
   the reference mirrors match the shipped text exactly (they were missing
   the v1.1 Sans additions entirely), and the runner cache manifest's MD5
   list is recomputed. `CACHE_VERSION → v2.3`.

**v2.0 — Megalovania plays again, and Harder Sans is music-only.** The v1.8
Harder Sans shipped a game-data hook: the Last Corridor trigger read a
`hardmode.flag` from the save DB to scale Sans's karma damage ×1.3. That hook
never worked in any shipped version, and its bytecode scaffolding is what
kept crashing the trigger — and the trigger is what *starts the Sans fight
and plays Megalovania*. That's why neither song ever played: the fight never
got that far on the broken branches. v2.0 removes every game-data Sans patch:
the trigger, the bone/blaster event, the menu bones and the KR-drain draw are
**byte-identical to the original release** (verified instruction-by-instruction),
so the corridor fires exactly like vanilla. Harder Sans is now purely the
1-in-3 cursed-session music roll it always wanted to be — the alternate track
replaces `mus_zz_megalovania.ogg` at the loader level, nothing in game data
conditions on it, and a failed alternate download just means the normal song.

Also in v2.0 — the boss-state overhauls:

1. **Mettaton NEO spawns at his stage.** The genocide state dropped you at
   `room_fire_turn` — the Royal Guards' mourning fight ("the two guards in
   Hotland"). NEO's real fight is `obj_mettboss_event`'s genocide branch at
   the stage room (`room_fire_core_metttest`), exactly where the EX state
   lands; the boss-room detector now knows the Royal Guards room too.
2. **Sans spawns at the corridor entrance** (`room_lastruins_corridor`,
   plot 199 — the same spawn Flowey's Time Machine uses). The old spawn
   was inside the trigger's mask, so the fight could re-fire behind you.
3. **Every state ships 2 equipped items + 8 heals.** No more half-empty
   inventories: two Butterscotch Pies (full heal) on every state, two
   Instant Noodles (vanilla behavior — 90 HP in serious boss fights, which
   is full at these LVs), and the rest tiered per route (Snowman Pieces,
   Legendary Heroes, Face Steaks, Sea Teas…). Noodle behavior is
   deliberately untouched game data.
4. **The CELL menu works.** Every state now carries the phone apps a real
   save has at that point (Toriel's Phone everywhere, Papyrus's number
   after his date, Dimensional Boxes A/B after Alphys' upgrade) — a save
   with the CELL button unlocked but zero apps can't exist in the real
   game, and that's what the broken Cell menu was.
5. **Every state is labeled.** PACI chips for the pacifist saves, GEN for
   genocide — nothing ships blank; genocide kills are the natural route
   numbers (21 / 17 / 21 / 44) so world triggers see a truthful count.
6. **`CACHE_VERSION` → v2.0** — every visitor re-downloads the clean game
   data; the offline single-file edition is rebuilt from it (offline-v2.0).
   The 17 branch retargets from v1.9 survive: `scr_damagestandard`'s
   i-frame branch is fixed in place (one byte), and all 244,712 variable
   references in live code were re-verified to resolve identically to
   vanilla — the v1.9 file had a chain walking out of the file; v2.0
   doesn't.

**v1.9 — the "black screen when you die" fix, for real this time.** All three
crash reports ("hit by Undyne twice", "Sans", "the Judgment Hall") were the
same event: you **die**, `scr_gameoverb` re-saves the whole savedata buffer,
and the runner's sync reconcile hit a save record whose timestamp was not a
`Date` — a raw `.getTime()` threw, killed the save mid-flight, and the game
froze on a black screen. v1.8 armed the wrong layer (the IDBFS copy — dead
code when the gameStorage polyfill is present). v1.9 armors the layer that
actually runs:

1. **The live GXMFS reconcile (`runner.js`) normalizes every timestamp** it
   compares — numeric/string/garbage legacy values (pre-v1.6 code, old
   WigdosXP mirror imports, external tools writing into the save DB) can
   never crash a save again, in either sync direction. Verified live with a
   poison record injected into the database: boot, save and quit syncs all
   reconcile clean, and the record gets normalized to a proper `Date`.
2. **`CACHE_VERSION` → v1.9** so every visitor re-downloads the armed
   runner.
3. **A runtime version handshake.** `runner.js` stamps `window.__UT_CORE`;
   `index.js` (always network-fresh) verifies it. If the service worker is
   still serving an older engine, the page unregisters it, deletes the whole
   site cache and reloads once — so a stale cache can no longer keep you on
   pre-fix code after a deploy.
4. **The offline single-file edition was rebuilt from the current tree.**
   The previous offline download (offline-v1) predated *every* save fix —
   and it still embedded the ancient "WigdosXP unified save sync", the very
   code that wrote those non-Date timestamps in the first place. The new
   build (offline-v1.9) carries the current engine, the read-only mirror,
   the healer, the armor, **and the v1.8 Harder Sans music file that the
   old offline build never had**. If you play offline, re-download it —
   this is very likely why the crashes "came back".

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

**v1.9 — THE "hit twice / Sans crashes" black-screen class is dead.** Every
crash you could repro was one root cause with two faces, plus one crash
trap in the Harder Sans plumbing, all found by diffing the rebuilt
bytecode against the originals instruction-by-instruction:

1. **"Getting hit twice crashes the game" (Undyne with Ballet Shoes +
   Old Tutu, Sans, everywhere).** The v1.7/v1.8 blob rebuilds inserted
   code mid-script, and every branch that sat *before* an insertion but
   jumped *across* it kept its original target — landing mid-operand,
   executing raw bytes as bytecode, fatal error, black screen. The
   i-frames check in `scr_damagestandard` was exactly such a branch
   (hit while invincible = hit twice = crash), and the INV set makes
   your i-frames 60% longer, so the crash clustered there. 17 un-shifted
   branches fixed across `scr_damagestandard`, the menu bones, the
   bone/blaster karma event (6) and the Sans fight's KR-drain draw (7,
   every frame while karma is on you).
2. **Harder Sans's trigger read `hardmode.flag` with no default.** When
   the flag is missing (the old offline build! blocked IndexedDB!) it
   read `global.death_t` before anything had written it — fatal "global
   variable not set" on entering the corridor. The trigger was rebuilt:
   default 1 first, then read the flag straight from the savedata map
   (no `ossafe` file handles at all — Undertale's `ossafe_close` ignores
   its argument and would have destroyed the game's live file handle),
   `is_undefined`-guarded, `max(x,1)`-clamped.
3. **Boss states picked from the in-game pause menu could "not take"**
   — you reloaded into your *previous* save. The write raced the dying
   page's own teardown sync, which flushed the old in-memory savedata
   over the fresh records. States are now *built* at selection, stashed,
   and written at the next page parse — before the runner mounts, where
   nothing can race them. (Verified end-to-end in a live browser.)
4. **The game's own ITEM / STAT / CELL buttons were invisible** on every
   save the menu built: the game only draws a button when its
   `menuchoice` slot is 1, and the builder wrote 0,0,0. You could move
   the SOUL between three buttons you could not see, and never reach the
   item or stat pages. All three slots now write 1 (every state ships
   past the phone pickup, same as a real save).

Also in v1.9: the rebuilt game data keeps the FORM/AUDO chunk headers the
runner validates consistent, the pause menu's FULLSCREEN entry is gone
(F4 still works), LV 1 / zero-kill states are labelled PACIFIST instead
of branded "NEU", and the offline single-file edition is rebuilt from
this exact data (its stale predecessor crashed at the corridor because
of bug 2 above — `hardmode.flag` never existed offline).

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

**v1.8 — HARDER SANS: the 1-in-3 cursed session.** Each page load rolls a
die. One time in three, **the whole session plays out under the alternate
Megalovania** — `mus_zz_megalovania_alternate.ogg` instead of the normal
track for every Sans fight that session — and while it plays, Sans hits
**1.3× harder, karma included**: every karma gain from contact with his
bones, Gaster Blasters and the menu bones, *and* every tick of the purple
KR drain, is multiplied by 1.3. The roll is session-scoped on purpose —
the engine decodes each sound once and keeps it for the life of the page,
so a per-fight swap could silently desync music vs. damage; this way the
music and the multiplier always agree. The chance is handed to the game
through `hardmode.flag` in the same storage your save lives in, and the
game clamps it to ≥ 1, so even a storage failure can never *reduce* his
damage. Reload for a fresh 1-in-3. (Game data v1.8 — loader footer.)

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

*(v1.9: the pause menu's stats strip shows your set's bonus live — that
includes the heal sets' "ITEMS HEAL +5/+10" and the i-frame set's
"I-FRAMES +60%". The game's own STAT page shows the stat sets' ATK/DF
bonuses folded into its AT/DF numbers, the same way the original game
folds weapon bonuses; it has no dedicated line for heal/INV sets, and
adding one would mean creating a new callable script in the game data.)*

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

    RESUME   BOSS STATES   QUIT

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
