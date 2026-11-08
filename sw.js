/*
 * UNDERTALE HTML - service worker
 * Keeps the big game files (game.unx parts, runner, music) on the player's
 * machine so repeat visits boot instantly and the game keeps working offline.
 *
 * Keep CACHE_VERSION in sync with the one in index.html.
 */
var CACHE_VERSION = 'v2.10';
var CACHE = 'undertale-html-' + CACHE_VERSION;

/* Immutable game data - cache-first (never changes unless you bump the version). */
var GAME_FILES = new Set([
    "game.unx.part1",
    "game.unx.part2",
    "game.unx.part3",
    "game.unx.part4",
    "game.unx.part5",
    "runner.data",
    "runner.js",
    "runner.wasm",
    "audio-worklet.js",
    "game.unx",
    "fnames",
    "favicon.png",
    "lang/lang_en.json",
    "lang/lang_ja.json",
    "mus_alphysfix.ogg",
    "mus_amalgam.ogg",
    "mus_ambientwater.ogg",
    "mus_anothermedium.ogg",
    "mus_bad.ogg",
    "mus_barrier.ogg",
    "mus_battle1.ogg",
    "mus_battle2.ogg",
    "mus_bergentruckung.ogg",
    "mus_bgflamea.ogg",
    "mus_birdnoise.ogg",
    "mus_birdsong.ogg",
    "mus_boss1.ogg",
    "mus_cast_1.ogg",
    "mus_cast_2.ogg",
    "mus_cast_3.ogg",
    "mus_cast_4.ogg",
    "mus_cast_5.ogg",
    "mus_cast_6.ogg",
    "mus_cast_7.ogg",
    "mus_chokedup.ogg",
    "mus_churchbell.ogg",
    "mus_computer.ogg",
    "mus_confession.ogg",
    "mus_coolbeat.ogg",
    "mus_core.ogg",
    "mus_core_ambience.ogg",
    "mus_coretransition.ogg",
    "mus_creepy_ambience.ogg",
    "mus_crickets.ogg",
    "mus_cymbal.ogg",
    "mus_dance_of_dog.ogg",
    "mus_date.ogg",
    "mus_date_fight.ogg",
    "mus_date_tense.ogg",
    "mus_deeploop2.ogg",
    "mus_disturbing.ogg",
    "mus_dogappear.ogg",
    "mus_dogmeander.ogg",
    "mus_dogroom.ogg",
    "mus_dogshrine_1.ogg",
    "mus_dogshrine_2.ogg",
    "mus_dogshrine_xbox.ogg",
    "mus_dogsong.ogg",
    "mus_dontgiveup.ogg",
    "mus_doorclose.ogg",
    "mus_dooropen.ogg",
    "mus_drone.ogg",
    "mus_dummybattle.ogg",
    "mus_dununnn.ogg",
    "mus_elevator.ogg",
    "mus_elevator_last.ogg",
    "mus_endarea_parta.ogg",
    "mus_endarea_partb.ogg",
    "mus_endingexcerpt1.ogg",
    "mus_endingexcerpt2.ogg",
    "mus_express_myself.ogg",
    "mus_f_6s_1.ogg",
    "mus_f_6s_2.ogg",
    "mus_f_6s_3.ogg",
    "mus_f_6s_4.ogg",
    "mus_f_6s_5.ogg",
    "mus_f_6s_6.ogg",
    "mus_f_alarm.ogg",
    "mus_f_destroyed.ogg",
    "mus_f_destroyed2.ogg",
    "mus_f_destroyed3.ogg",
    "mus_f_finale_1.ogg",
    "mus_f_finale_1_l.ogg",
    "mus_f_finale_2.ogg",
    "mus_f_finale_3.ogg",
    "mus_f_intro.ogg",
    "mus_f_newlaugh.ogg",
    "mus_f_newlaugh_low.ogg",
    "mus_f_part1.ogg",
    "mus_f_part2.ogg",
    "mus_f_part3.ogg",
    "mus_f_saved.ogg",
    "mus_f_wind1.ogg",
    "mus_f_wind2.ogg",
    "mus_fallendown2.ogg",
    "mus_fearsting.ogg",
    "mus_flowey.ogg",
    "mus_gameover.ogg",
    "mus_ghostbattle.ogg",
    "mus_harpnoise.ogg",
    "mus_hereweare.ogg",
    "mus_hotel.ogg",
    "mus_hotel_battle.ogg",
    "mus_house1.ogg",
    "mus_house2.ogg",
    "mus_intronoise.ogg",
    "mus_kingdescription.ogg",
    "mus_lab.ogg",
    "mus_leave.ogg",
    "mus_menu0.ogg",
    "mus_menu1.ogg",
    "mus_menu2.ogg",
    "mus_menu3.ogg",
    "mus_menu4.ogg",
    "mus_menu5.ogg",
    "mus_menu6.ogg",
    "mus_mett_applause.ogg",
    "mus_mett_cheer.ogg",
    "mus_mettafly.ogg",
    "mus_mettaton_ex.ogg",
    "mus_mettaton_neo.ogg",
    "mus_mettaton_pretransform.ogg",
    "mus_mettatonbattle.ogg",
    "mus_mettmusical1.ogg",
    "mus_mettmusical2.ogg",
    "mus_mettmusical3.ogg",
    "mus_mettmusical4.ogg",
    "mus_mettsad.ogg",
    "mus_mode.ogg",
    "mus_mtgameshow.ogg",
    "mus_muscle.ogg",
    "mus_musicbox.ogg",
    "mus_myemeow.ogg",
    "mus_mysteriousroom2.ogg",
    "mus_mystery.ogg",
    "mus_napstachords.ogg",
    "mus_napstahouse.ogg",
    "mus_news.ogg",
    "mus_news_battle.ogg",
    "mus_ohyes.ogg",
    "mus_oogloop.ogg",
    "mus_operatile.ogg",
    "mus_options_fall.ogg",
    "mus_options_summer.ogg",
    "mus_options_winter.ogg",
    "mus_papyrus.ogg",
    "mus_papyrusboss.ogg",
    "mus_piano.ogg",
    "mus_prebattle1.ogg",
    "mus_predummy.ogg",
    "mus_race.ogg",
    "mus_rain.ogg",
    "mus_rain_deep.ogg",
    "mus_repeat_1.ogg",
    "mus_repeat_2.ogg",
    "mus_reunited.ogg",
    "mus_rimshot.ogg",
    "mus_ruins.ogg",
    "mus_ruinspiano.ogg",
    "mus_sansdate.ogg",
    "mus_sfx_a_grab.ogg",
    "mus_sfx_chainsaw.ogg",
    "mus_sfx_hypergoner_charge.ogg",
    "mus_sfx_hypergoner_laugh.ogg",
    "mus_sfx_rainbowbeam_hold.ogg",
    "mus_shop.ogg",
    "mus_sigh_of_dog.ogg",
    "mus_silence.ogg",
    "mus_smallshock.ogg",
    "mus_smile.ogg",
    "mus_snoresymphony.ogg",
    "mus_snowwalk.ogg",
    "mus_snowy.ogg",
    "mus_spider.ogg",
    "mus_spoopy.ogg",
    "mus_spoopy_holiday.ogg",
    "mus_spoopy_wave.ogg",
    "mus_st_happytown.ogg",
    "mus_st_him.ogg",
    "mus_st_meatfactory.ogg",
    "mus_st_troubledingle.ogg",
    "mus_star.ogg",
    "mus_sticksnap.ogg",
    "mus_story.ogg",
    "mus_story_stuck.ogg",
    "mus_temshop.ogg",
    "mus_temvillage.ogg",
    "mus_tension.ogg",
    "mus_tone2.ogg",
    "mus_tone3.ogg",
    "mus_toomuch.ogg",
    "mus_toriel.ogg",
    "mus_town.ogg",
    "mus_tv.ogg",
    "mus_undyneboss.ogg",
    "mus_undynefast.ogg",
    "mus_undynepiano.ogg",
    "mus_undynescary.ogg",
    "mus_undynetheme.ogg",
    "mus_undynetruetheme.ogg",
    "mus_vsasgore.ogg",
    "mus_waterfall.ogg",
    "mus_waterquiet.ogg",
    "mus_wawa.ogg",
    "mus_whoopee.ogg",
    "mus_wind.ogg",
    "mus_woofenstein.ogg",
    "mus_woofenstein_loop.ogg",
    "mus_wrongnumbersong.ogg",
    "mus_wrongworld.ogg",
    "mus_x_undyne.ogg",
    "mus_x_undyne_pre.ogg",
    "mus_xpart.ogg",
    "mus_xpart_2.ogg",
    "mus_xpart_a.ogg",
    "mus_xpart_b.ogg",
    "mus_xpart_back.ogg",
    "mus_yourbestfriend_3.ogg",
    "mus_z_ending.ogg",
    "mus_zz_megalovania.ogg",
    "mus_zz_megalovania_alternate.ogg",
    "mus_zzz_c.ogg",
    "mus_zzz_c2.ogg",
    "snd_ballchime.ogg",
    "snd_curtgunshot.ogg",
    "snd_mushroomdance.ogg"
]);

/* Page code - network-first so your updates apply immediately, cache fallback offline. */
var SHELL_FILES = new Set([
    "index.html",
    "index.js",
    "savesync.js",
    "style.css"
]);

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function basename (u) {
  try { return new URL(u).pathname.replace(/\/$/, '').split('/').pop(); } catch (e) { return ''; }
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = req.url;
  if (url.indexOf('blob:') === 0 || url.indexOf('data:') === 0) return;

  var origin;
  try { origin = new URL(url).origin; } catch (e) { return; }
  if (origin !== self.location.origin) return;

  var name = basename(url);
  if (!name) return;

  var isShell = SHELL_FILES.has(name);
  var isGame = GAME_FILES.has(name);
  if (!isShell && !isGame) return;               /* everything else: straight to network */

  if (isShell) {
    /* network-first: updates apply, cache saves us offline.
       v1.6: bypass the browser HTTP cache when revalidating shell files -
       a stale index.js/savesync.js (GitHub Pages sends max-age=600) made
       players run old save code for up to 10 minutes after a deploy, which
       looked exactly like "the save fix didn't work". */
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).then(function (resp) {
        if (resp && resp.ok) {
          var clone = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, clone); });
        }
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || Response.error();
        });
      })
    );
    return;
  }

  /* game data: cache-first */
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var clone = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, clone); });
        }
        return resp;
      });
    })
  );
});
