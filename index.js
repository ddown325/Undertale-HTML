/* [ut-gamestorage:start] =======================================================

   oprt.gameStorage POLYFILL  (SECOND-LINE DEFENSE - see index.html)
   ---------------------------------------------------------
   THE canonical copy of this polyfill is inlined in index.html, where it
   runs synchronously during page parse - guaranteed before the loader
   appends any dynamic script. That placement is THE save fix (v1.5):

   the runner picks its savedata mount ONCE - `window.oprt &&
   window.oprt.gameStorage ? GXMFS : IDBFS` (runner.js) - and its syncfs
   dispatcher no-ops any mount without a .zk method, so an IDBFS mount on
   a plain web host silently drops EVERY save. When this polyfill lived
   only here, index.js raced runner.js (both appended as dynamic async
   scripts): whenever the runner reached its mount first, all saves were
   lost on reload ("name picking again", "save states deleted").

   This copy stays as a guarded fallback for exotic embeds that load
   index.js standalone. It no-ops when the inline copy already ran.
   Keep BOTH copies in sync (or better: never edit this one).

   The polyfill implements the gameStorage API over the very same
   IndexedDB layout the runner's IDBFS uses ("/_savedata" database,
   FILE_DATA store, nodes shaped { timestamp, mode, contents }), so:

     - the mount works exactly as before (GXMFS -> here -> IndexedDB)
     - buffer_load_async finds undertale.sav  -> CONTINUE works
     - buffer_save_async persists undertale.sav -> saves survive reload
     - the save-sync mirror keeps seeing the same records as always

   Keys are normalized: relative names ("undertale.sav") are stored
   under "/_savedata/<name>", absolute keys ("/_savedata/...") pass
   through - so every layer converges on the same records.

   ========================================================= [ut-gamestorage:end] */
(function () {
  "use strict";
  if (window.oprt && window.oprt.gameStorage) return;   /* real platform - stay out */
  window.oprt = window.oprt || {};

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open("/_savedata", 21); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("FILE_DATA")) db.createObjectStore("FILE_DATA");
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      /* v1.6: never hard-fail on a version clash - fall back to a version-less
         open (see the inline polyfill in index.html for the full story). */
      req.onerror = function () {
        if (req.error && req.error.name === "VersionError") {
          var req2;
          try { req2 = indexedDB.open("/_savedata"); }
          catch (e2) { reject(e2); return; }
          req2.onsuccess = function (e2) { resolve(e2.target.result); };
          req2.onerror = function () { reject(req2.error); };
        } else {
          reject(req.error);
        }
      };
      req.onblocked = function () { reject(new Error("db blocked")); };
    });
  }



  /* v1.6: heal type-lost contents (plain numeric-key objects -> Uint8Array) */
  function saneNode(node) {
    if (!node || typeof node !== "object") return node;
    var c = node.contents;
    if (c instanceof Uint8Array || c instanceof ArrayBuffer || typeof c === "string" || c == null) return node;
    if (ArrayBuffer.isView(c)) return node;
    if (typeof c === "object") {
      var vals = Object.values(c);
      var bad = false;
      for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        if (typeof v !== "number" || v < 0 || v > 255 || Math.floor(v) !== v) { bad = true; break; }
      }
      return {
        timestamp: (node.timestamp instanceof Date) ? node.timestamp :
                    (node.timestamp ? new Date(Number(node.timestamp) || 0) : new Date(0)),
        mode: typeof node.mode === "number" ? node.mode : 33206,
        contents: bad ? new Uint8Array(0) : new Uint8Array(vals)
      };
    }
    return node;
  }

  function tx(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          var t = db.transaction(["FILE_DATA"], mode);
          var st = t.objectStore("FILE_DATA");
          var out = fn(st);
          t.oncomplete = function () { resolve(out && out.__req ? out.__req.result : out); db.close(); };
          t.onerror = function () { reject(t.error); db.close(); };
          t.onabort = function () { reject(t.error || new Error("abort")); db.close(); };
        } catch (e) { reject(e); }
      });
    });
  }

  function norm(key) {
    key = String(key);
    return key.charAt(0) === "/" ? key : "/_savedata/" + key;
  }

  function toNode(value) {
    if (value && typeof value === "object" && "contents" in value) return value;
    return { timestamp: new Date(), mode: 33206, contents: value };
  }

  /* [ut-savedata-healer] v1.8 - keep in sync with the inline copy in
     index.html (the canonical one; this fallback copy only runs in
     exotic embeds that load index.js standalone). See index.html for
     the full rationale: undertale.sav's JSON map is validated and
     repaired at gameStorage.get() so a short/missing file0 or a missing
     undertale.ini can never reach scr_load's fatal file reads. */
  function __utNodeText(node) {
    var c = node && node.contents;
    if (c == null) return "";
    if (typeof c === "string") return c;
    if (c instanceof Uint8Array || c instanceof ArrayBuffer) {
      try {
        return new TextDecoder("utf-8").decode(c instanceof Uint8Array ? c : new Uint8Array(c));
      } catch (e) { return ""; }
    }
    return String(c);
  }
  function __utFixFile0(txt) {
    if (typeof txt !== "string" || !txt) return null;
    var t = txt.replace(/\r\n?/g, "\n");
    if (t.charAt(t.length - 1) !== "\n") t += "\n";
    var L = t.split("\n");
    while (L.length && L[L.length - 1] === "") L.pop();
    if (L.length === 0) return null;
    for (var i = 0; i < 549; i++) {
      if (L[i] === undefined || L[i] === "") L[i] = "0";
    }
    L.length = 549;
    var out = "";
    for (var n = 0; n < 549; n++) out += L[n] + "\n";
    return out;
  }
  function __utSynthIni(txt) {
    var L = String(txt).replace(/\r\n?/g, "\n").split("\n");
    var g = function (i, d) { var v = (L[i] !== undefined) ? String(L[i]).replace(/^\s+|\s+$/g, "") : ""; return v || d; };
    return "[General]\nName=" + g(0, "FRISK") + "\nLove=" + g(1, "1") +
      "\nTime=" + g(548, "0") + "\nKills=" + g(11, "0") + "\nRoom=" + g(547, "5") + "\n";
  }
  function __utIniOk(txt) {
    return typeof txt === "string" && /^\s*\[General\]/i.test(txt);
  }
  function __utHealSavNode(node) {
    var txt = __utNodeText(node);
    if (txt.charCodeAt(txt.length - 1) === 0) txt = txt.slice(0, -1);
    var map, dead = false;
    try { map = JSON.parse(txt); } catch (e) { map = null; }
    if (!map || typeof map !== "object") { map = {}; dead = true; }
    var changed = dead;
    var f0 = __utFixFile0(map["file0"]);
    if (f0 === null) {
      var mir = null;
      try { mir = window.oprt.__utGetFSFile && window.oprt.__utGetFSFile("file0"); } catch (e1) {}
      f0 = __utFixFile0(mir);
      if (f0 === null) {
        f0 = "FRISK\n";
        for (var z = 1; z < 549; z++) f0 += (z === 547 ? "5" : "0") + "\n";
      }
    }
    if (map["file0"] !== f0) { map["file0"] = f0; changed = true; }
    if (map["file9"] !== undefined && map["file9"] !== null) {
      var f9 = __utFixFile0(map["file9"]);
      if (f9 === null) { delete map["file9"]; changed = true; }
      else if (map["file9"] !== f9) { map["file9"] = f9; changed = true; }
    }
    if (!__utIniOk(map["undertale.ini"])) {
      var iniMir = null;
      try { iniMir = window.oprt.__utGetFSFile && window.oprt.__utGetFSFile("undertale.ini"); } catch (e3) {}
      map["undertale.ini"] = __utIniOk(iniMir) ? iniMir : __utSynthIni(f0);
      changed = true;
    }
    if (!changed) return { node: node, changed: false };
    var out = JSON.stringify(map) + "\u0000";
    var healed = { timestamp: new Date(), mode: 33206, contents: new TextEncoder().encode(out) };
    try { console.log("[ut-heal] repaired undertale.sav" + (dead ? " (unparseable JSON - rebuilt)" : "")); } catch (e4) {}
    return { node: healed, changed: true };
  }
  function __utSweepLegacyTimestamps() {
    if (window.__utSweptTS) return;
    window.__utSweptTS = true;
    openDB().then(function (db) {
      return new Promise(function (resolve) {
        try {
          var t = db.transaction(["FILE_DATA"], "readwrite");
          var st = t.objectStore("FILE_DATA");
          var fixed = 0;
          var cur = st.openCursor();
          cur.onsuccess = function (e) {
            var c = e.target.result;
            if (!c) { if (fixed) console.log("[ut-heal] normalized " + fixed + " legacy record timestamp(s)"); db.close(); resolve(); return; }
            var n = c.value;
            if (n && typeof n === "object" && !(n.timestamp instanceof Date)) {
              try {
                var ts = n.timestamp ? new Date(Number(n.timestamp) || 0) : new Date(0);
                if (isNaN(ts.getTime())) ts = new Date(0);
                c.update({ timestamp: ts, mode: (typeof n.mode === "number" ? n.mode : 33206), contents: n.contents });
                fixed++;
              } catch (er) {}
            }
            c.continue();
          };
          cur.onerror = function () { db.close(); resolve(); };
          t.oncomplete = function () { db.close(); resolve(); };
        } catch (e) { db.close(); resolve(); }
      });
    }).catch(function () {});
  }

  window.oprt.__utGetFSFile = function (name) {
    try {
      var raw = localStorage.getItem("ut/_savedata/" + name);
      if (raw == null) return null;
      var leaf = null;
      if (raw.indexOf("OBJ:") === 0) {
        try {
          var nd = JSON.parse(raw.slice(4));
          leaf = nd && typeof nd === "object" ? nd.contents : null;
        } catch (e) { return null; }
      } else leaf = raw;
      if (typeof leaf !== "string" || leaf.indexOf("AB:") !== 0) return null;
      var b64 = leaf.slice(3), bin = atob(b64), s = "";
      for (var i = 0; i < bin.length; i++) s += String.fromCharCode(bin.charCodeAt(i) & 0xff);
      return s;
    } catch (e) { return null; }
  };

  window.oprt.gameStorage = {
    open: function (name) {
      if (!window.__gsTrace) window.__gsTrace = [];
      if (window.__gsTrace.length > 400) window.__gsTrace.splice(0, 200);  /* keep it bounded */
      window.__gsTrace.push("open:" + name);
      __utSweepLegacyTimestamps();
      /* handle contract used by the runner's GXMFS + the WASM save layer:
           list()             -> Promise<{ key: {timestamp: Date, mode} }>
           get(key)           -> Promise<node>
           put(node, key)     -> Promise
           delete(key)        -> Promise

         DELETE GUARD v2 (v1.5): NEVER delete through the polyfill.
         The runner's reconciles are NOT serialized ("FS.syncfs operations
         in flight at once"). At boot / game restart the savedata mount is
         torn down and re-mounted; a SAVE reconcile racing the fresh mount
         enumerates the still-EMPTY local FS and tries to delete every
         remote entry "missing" from it: undertale.sav, file0,
         undertale.ini - the player's whole save. GXMFS reuses its cached
         handle across remounts, so a seen-this-mount check is not enough
         (v1 guard was bypassed exactly that way). The game NEVER
         legitimately deletes these files: True Reset and the decomp wipe
         write NEW content over them (put). Refuse every delete. */
      var seen = {};
      function listAll() {
        return new Promise(function (resolve) {
          openDB().then(function (db) {
            try {
              var t = db.transaction(["FILE_DATA"], "readonly");
              var st = t.objectStore("FILE_DATA");
              var entries = {};
              var cur = st.openCursor();
              cur.onsuccess = function (e) {
                var c = e.target.result;
                if (!c) { resolve(entries); db.close(); return; }
                var n = c.value;
                entries[c.key] = {
                  timestamp: (n && n.timestamp instanceof Date) ? n.timestamp :
                              (n && n.timestamp ? new Date(n.timestamp) : new Date(0)),
                  mode: n ? n.mode : 33206
                };
                c.continue();
              };
              cur.onerror = function () { resolve({}); db.close(); };
            } catch (e) { resolve({}); db.close(); }
          }, function () { resolve({}); });
        });
      }
      return {
        list: function () {
          if (window.__gsTrace.length > 400) window.__gsTrace.splice(0, 200);
          window.__gsTrace.push("list:" + name); return listAll();
        },
        get: function (key) {
          if (window.__gsTrace.length > 400) window.__gsTrace.splice(0, 200);
          window.__gsTrace.push("get:" + name + "/" + key);
          seen[norm(key)] = true;
          return tx("readonly", function (st) {
            var r = st.get(norm(key));
            return { __req: r };
          }).then(function (node) {
            if (node === undefined) return node;
            var healed = saneNode(node);
            if (norm(key) === "/_savedata/undertale.sav" && healed) {
              try {
                var res = __utHealSavNode(healed);
                if (res.changed) {
                  healed = res.node;
                  tx("readwrite", function (st) {
                    st.put(healed, norm(key));
                  }).catch(function () {});
                }
              } catch (e) {}
            }
            return healed;
          });
        },
        put: function (node, key) {
          var n = saneNode(toNode(node));
          if (window.__gsTrace.length > 400) window.__gsTrace.splice(0, 200);
          window.__gsTrace.push("put:" + name + "/" + key + " len=" +
            (n && n.contents ? (n.contents.byteLength !== undefined ? n.contents.byteLength : n.contents.length) : "?"));
          seen[norm(key)] = true;
          return tx("readwrite", function (st) {
            st.put(n, norm(key));
          });
        },
        "delete": function (key) {
          /* DELETE GUARD v2: refuse EVERY delete (see comment above). */
          if (window.__gsTrace.length > 400) window.__gsTrace.splice(0, 200);
          window.__gsTrace.push("del-blocked:" + name + "/" + key);
          return Promise.resolve();
        }
      };
    }
  };
})();

/* [ut-hardersans-inline] ==================================================
   HARDER SANS session roll (1 in 3). index.html owns the roll for
   the normal online page; this guarded copy exists for embeds that load
   index.js standalone (e.g. the offline single-file edition), where the
   inline module is absent. Same rule as the polyfill copies: no-op when
   the roll already happened.

   The winner gets mus_zz_megalovania_alternate.ogg instead of Megalovania
   for every Sans fight this session (the VFS swap in the loader).
   v2.0: the hardmode.flag damage write is gone - that game-data hook
   never worked and its bytecode scaffolding is what crashed the Sans
   trigger. The alternate track is the feature. Session-scoped because
   the runner caches decoded audio per sound index per page.
   ========================================================================= */
if (!window.__utHardSansRolled) {
  window.__utHardSansRolled = true;
  var UT_HARD = (window.__utHardSans !== undefined)
    ? window.__utHardSans
    : (Math.random() < 1 / 3);
  window.__utHardSans = UT_HARD;
}
/* [ut-hardersans-inline:end] */

const CHANGE_ASPECT_RATIO = true;
var bodyElement = document.getElementsByTagName("body")[0];
var statusElement = document.getElementById("status");
var progressElement = document.getElementById("progress");
var spinnerElement = document.getElementById("spinner");
var canvasElement = document.getElementById("canvas");
var outputElement = document.getElementById("output");
var outputContainerElement = document.getElementById("output-container");
var qrElement = document.getElementById("QRCode");
var qr2Element = document.getElementById("QR2Code");
var qrButton = document.getElementById("QRButton");
var qr2Button = document.getElementById("QR2Button");
var pauseMenu = document.getElementById("pauseMenuContainer"); /* legacy (hidden) */
var resumeButton = document.getElementById("resumeButton");
var quitButton = document.getElementById("quitButton");
canvasElement.addEventListener("click", function() { canvasElement.focus(); });

const messageContainerElement = document.getElementById("message-container");
const messagesElement = document.getElementById("messages");
let rollbackMessages = [];

let clearRollbackMessagesTimeoutId = -1;
const showRollbackMessage = function (message) {
  let messages = "";
  rollbackMessages.push(message);
  rollbackMessages.forEach(m => messages += "<p>" + m + "</p>");

  messagesElement.innerHTML = messages;
  messageContainerElement.style.display = 'block';

  if (clearRollbackMessagesTimeoutId === -1) {
    clearTimeout(clearRollbackMessagesTimeoutId);
  }
  clearRollbackMessagesTimeoutId = setTimeout(clearRollbackMessages, 5000);
};

const clearRollbackMessages = function () {
  clearRollbackMessagesTimeoutId = -1;
  rollbackMessages = [];
  messageContainerElement.style.display = 'none';
};

var startingHeight, startingWidth;
var startingAspect;
var Module = {
  preRun: [],
  postRun: [],
  print: (function () {
    var element = document.getElementById("output");
    if (element) element.value = ""; // clear browser cache
    /* [ut-lagfix v1.7] the GM runner keeps printing while you play (room
       changes, audio warnings). "value +=" is O(n) EVERY line and the
       textarea grows without bound, so after a while each log line copies
       megabytes and the game starts stuttering - classic "lags after some
       time". Cap the buffer and collapse consecutive duplicate spam. */
    var MAX_LOG = 40000;      /* characters kept in the <textarea> */
    var lastText = null, repeats = 0;
    return function (text) {
      if (arguments.length > 1)
        text = Array.prototype.slice.call(arguments).join(" ");
      if (text === lastText) {
        repeats++;
        if (repeats % 100 !== 0) return;   /* identical line: swallow */
      } else {
        lastText = text;
        repeats = 0;
      }
      console.log(text);
      if (text === "Entering main loop.") {
        // It seems that this text ensures game is loaded.
        window.UT_BOOTED = true;                     /* boot survived - crash   */
        try { sessionStorage.removeItem("utBootRetry"); } catch (e) {}  /* retry restored */
        ensureAspectRatio();
      }
      if (element) {
        if (element.value.length > MAX_LOG)
          element.value = element.value.slice(-Math.floor(MAX_LOG / 2));
        element.value += text + "\n";
        element.scrollTop = element.scrollHeight; // focus on bottom
      }
    };
  })(),
  printErr: function (text) {
    if (arguments.length > 1)
      text = Array.prototype.slice.call(arguments).join(" ");
    console.error(text);
  },
  canvas: (function () {
    var canvas = document.getElementById("canvas");

    return canvas;
  })(),
  setStatus: function (text) {
    if (!Module.setStatus.last)
      Module.setStatus.last = { time: Date.now(), text: "" };
    if (text === Module.setStatus.last.text) return;
    var m = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
    var now = Date.now();
    if (m && now - Module.setStatus.last.time < 30) return; // if this is a progress update, skip it if too soon
    Module.setStatus.last.time = now;
    Module.setStatus.last.text = text;
    if (m) {
      text = m[1];
      progressElement.value = parseInt(m[2]) * 100;
      progressElement.max = parseInt(m[4]) * 100;
      progressElement.hidden = false;
      spinnerElement.hidden = false;
    } else {
      progressElement.value = null;
      progressElement.max = null;
      progressElement.hidden = true;

      // If there are no status text, we are finished and can display
      // the canvas and hide the spinner
      if (!text) {
        spinnerElement.style.display = "none";
        canvasElement.style.display = "block";
      }
    }
    statusElement.innerHTML = text;
  },
  totalDependencies: 0,
  monitorRunDependencies: function (left) {
    this.totalDependencies = Math.max(this.totalDependencies, left);
    Module.setStatus(
      left
        ? "Preparing... (" +
            (this.totalDependencies - left) +
            "/" +
            this.totalDependencies +
            ")"
        : "All downloads complete."
    );
  },
};
Module.setStatus("Downloading...");
var UT_BOOT_RETRIES = 1;   /* boot crashes (WebGL context race) are flaky -
                              a plain reload boots fine, so do it hands-free */
try { UT_BOOT_RETRIES = 1 - Number(sessionStorage.getItem("utBootRetry") || "0"); }
catch (e) { UT_BOOT_RETRIES = 1; }
window.UT_BOOTED = false;
window.onerror = function (event) {
  // TODO: do not warn on ok events like simulating an infinite loop or exitStatus
  Module.setStatus("Exception thrown, see JavaScript console");
  spinnerElement.style.display = "none";
  Module.setStatus = function (text) {
    if (text) Module.printErr("[post-exception status] " + text);
  };
  /* hands-free retry: a boot that died before the main loop gets ONE
     automatic reload (the same trick as closing and re-opening the tab) */
  if (!window.UT_BOOTED && UT_BOOT_RETRIES > 0) {
    try { sessionStorage.setItem("utBootRetry", "1"); } catch (e) {}
    Module.printErr("[ut] boot failed before the main loop - reloading once");
    setTimeout(function () { window.location.reload(); }, 1200);
  }
};

// Route URL GET parameters to argc+argv
if (typeof window === "object") {
  Module['arguments'] = window.location.search.substr(1).trim().split('&');
  // If no args were passed arguments = [''], in which case kill the single empty string.
  if (!Module['arguments'][0]) {
    Module['arguments'] = [];
  }

  /* [ut-ctxguard] If the browser kills the WebGL context (GPU reset, tab
     throttle, too many contexts), the runner's render loop dereferences a
     dead context and throws every frame ("reading 'depthRange'"). The
     runner has no restore path - reload the page once, hands-free, so the
     player lands back on the title with CONTINUE instead of a frozen
     error screen. */
  (function () {
    var c = document.getElementById("canvas");
    if (!c) return;
    var done = false;
    c.addEventListener("webglcontextlost", function (e) {
      if (done) return;
      done = true;
      try { e.preventDefault(); } catch (er) {}
      try {
        var once = sessionStorage.getItem("utCtxRetry") === "1";
        if (once) return;                 /* already retried - give up quietly */
        sessionStorage.setItem("utCtxRetry", "1");
      } catch (er) {}
      if (typeof Module.printErr === "function")
        Module.printErr("[ut] WebGL context lost - reloading to recover");
      setTimeout(function () { window.location.reload(); }, 900);
    }, false);
    /* the retry ticket is only valid until the game runs again */
    var clear = setInterval(function () {
      if (!window.UT_BOOTED) return;
      try { sessionStorage.removeItem("utCtxRetry"); } catch (e) {}
      clearInterval(clear);
    }, 1000);
  })();

  /* [ut-core-handshake] (v1.9) The service worker can keep serving an OLD
     runner.js long after a deploy (its update check is throttled, and a
     browser-cached index.html can pin the old CACHE_VERSION). runner.js now
     stamps window.__UT_CORE; this page (network-first, always fresh) checks
     it once the runner has loaded. On a mismatch or a missing stamp we
     unregister every SW, delete the whole site cache and reload ONCE with
     a cache-buster - so every player converges on the current engine even
     if the SW never noticed the deploy. */
  (function () {
    var WANT = "v1.9";
    var armed = false;
    try { armed = sessionStorage.getItem("utCorePurge") === "1"; } catch (e) {}
    function purgeAndReload() {
      if (armed) {           /* already purged this session - do not loop */
        try { console.warn("[ut-core] runner.js still stale after purge - giving up this session"); } catch (e) {}
        return;
      }
      try { sessionStorage.setItem("utCorePurge", "1"); } catch (e) {}
      try { console.warn("[ut-core] runner.js is stale - purging caches and reloading once"); } catch (e) {}
      var go = function () {
        window.location.replace(
          window.location.pathname + "?utcore=" + WANT + window.location.hash);
      };
      var left = 0;
      function done() { if (--left <= 0) go(); }
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        left++;
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          var q = regs.length;
          if (!q) return done();
          regs.forEach(function (rg) {
            rg.unregister().then(function () { if (--q <= 0) done(); },
                                  function () { if (--q <= 0) done(); });
          });
        }).catch(done);
      }
      if (window.caches && caches.keys) {
        left++;
        caches.keys().then(function (names) {
          var q = names.length;
          if (!q) return done();
          names.forEach(function (nm) {
            caches.delete(nm).then(function () { if (--q <= 0) done(); },
                                   function () { if (--q <= 0) done(); });
          });
        }).catch(done);
      }
      setTimeout(go, 4000);   /* never hang the player on a stuck promise */
    }
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      var core = window.__UT_CORE;
      if (core === WANT) {
        clearInterval(poll);
        try { sessionStorage.removeItem("utCorePurge"); } catch (e) {}
        return;
      }
      /* runner.js loaded but carries an old (or no) stamp?
         - no stamp AND the game already booted: an old runner that never
           defines it - treat as stale. */
      if (core !== undefined || window.UT_BOOTED || tries > 120) {
        clearInterval(poll);
        if (core !== WANT) purgeAndReload();
      }
    }, 500);
  })();
}

function toggleConsole() {
  var isShown = outputElement.style.display === "flex";
  if (isShown) {
    outputElement.style.display = "none";
    outputElement.scrollIntoView(false);
  } else {
    outputElement.style.display = "flex";
    outputElement.scrollIntoView(true);
  }
}

function toggleQRCode() {
  var isShown = !qrElement.hidden;
  if (isShown) {
    qrElement.hidden = true;
    qrButton.innerHTML = "Show QRCode";
  } else {
    qrElement.hidden = false;
    qrButton.innerHTML = "Hide QRCode";
  }
}

function toggleQRCode2() {
  var isShown = !qr2Element.hidden;
  if (isShown) {
    qr2Element.hidden = true;
    qr2Button.innerHTML = "Show Opera GX QRCode";
  } else {
    qr2Element.hidden = false;
    qr2Button.innerHTML = "Hide Opera GX QRCode";
  }
}

/*
var g_extLostContext = null;

function toggleWebGLContext() {
  if (g_extLostContext == null) {
    var canvas = document.getElementById('canvas');
    var gl = canvas.getContext('webgl2');
    g_extLostContext = gl.getExtension('WEBGL_lose_context');
  } // end if
  var button = document.getElementById("webglbutton");
  var text = button.textContent || button.innerText;
  if (text.trim() == "Lose WebGL Context") {
    g_extLostContext.loseContext();
    button.textContent = "Restore WebGL Context";
  } // end if
  else {
    g_extLostContext.restoreContext();
    button.textContent = "Lose WebGL Context";
    g_extLostContext = null;
  } // end else
}
*/
function toggleElement(id) {
  var elem = document.getElementById(id);
  if (elem) {
    elem.style.display = elem.style.display == 'block' ? 'none' : 'block';
  }
}

var g_pWadLoadCallback = undefined;
function setWadLoadCallback( _wadLoadCallback ) 
{
  g_pWadLoadCallback = _wadLoadCallback;
}

var g_pAddAsyncMethod = -1;

function setAddAsyncMethod( asyncMethod )
{
  g_pAddAsyncMethod = asyncMethod;
}

var g_pJSExceptionHandler = undefined;

function setJSExceptionHandler( exceptionHandler )
{
  if (typeof exceptionHandler == "function") {
      g_pJSExceptionHandler = exceptionHandler;
  } // end if
} // end setJSExceptionHandler

function hasJSExceptionHandler()
{
  return (g_pJSExceptionHandler != undefined) && (typeof g_pJSExceptionHandler == "function");
} // end hasJSExceptionHandler

function doJSExceptionHandler( exceptionJSON )
{
  if (typeof g_pJSExceptionHandler == "function") {
    var exception = JSON.parse( exceptionJSON );
    g_pJSExceptionHandler( exception );
  } // end if
} // end doJSExceptionHandler

function manifestFiles()
{
  return [ "runner.data",
"runner.js",
"runner.wasm",
"audio-worklet.js",
"game.unx",
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
"mus_coretransition.ogg",
"mus_core_ambience.ogg",
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
"mus_fallendown2.ogg",
"mus_fearsting.ogg",
"mus_flowey.ogg",
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
"mus_mettafly.ogg",
"mus_mettatonbattle.ogg",
"mus_mettaton_ex.ogg",
"mus_mettaton_neo.ogg",
"mus_mettaton_pretransform.ogg",
"mus_mettmusical1.ogg",
"mus_mettmusical2.ogg",
"mus_mettmusical3.ogg",
"mus_mettmusical4.ogg",
"mus_mettsad.ogg",
"mus_mett_applause.ogg",
"mus_mett_cheer.ogg",
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
"mus_star.ogg",
"mus_sticksnap.ogg",
"mus_story.ogg",
"mus_story_stuck.ogg",
"mus_st_happytown.ogg",
"mus_st_him.ogg",
"mus_st_meatfactory.ogg",
"mus_st_troubledingle.ogg",
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
"mus_xpart.ogg",
"mus_xpart_2.ogg",
"mus_xpart_a.ogg",
"mus_xpart_b.ogg",
"mus_xpart_back.ogg",
"mus_x_undyne.ogg",
"mus_x_undyne_pre.ogg",
"mus_yourbestfriend_3.ogg",
"mus_zzz_c.ogg",
"mus_zzz_c2.ogg",
"mus_zz_megalovania.ogg",
"mus_zz_megalovania_alternate.ogg",
"mus_z_ending.ogg",
"snd_ballchime.ogg",
"snd_curtgunshot.ogg",
"snd_mushroomdance.ogg",
"lang/lang_en.json",
"lang/lang_ja.json" ].join( ";");
}

function manifestFilesMD5()
{
  return [ "c796f9390f0ae1b05fdbf556311fb559",
"1647d3ad4762cc3e78e490b208a878a2",
"f71a3a6a351db50641cec0b037fb7aa3",
"e8f1e8db8cf996f8715a6f2164c2e44e",
"e07719cee5a04302565486e382d4ed6a",
"da78df4767592b0759de45f1a97f7c05",
"bc7c594cda5c6c1b0276fb86a11e175b",
"41833545251f09c1bec5c6dc9075c2d9",
"02e5c1016fbfdb38208f53ffbba7cc91",
"c822cce868d5d5da649042e0e0ebda87",
"69d74a2206407e2142852d93dd487c00",
"c874fac8074463f6553f31f187739d49",
"b21501e5480c84104fcd8c5bef3f794a",
"810736e47c62c892b35cd1351bb73253",
"ec530b41e8d5379630ce7d393e04010d",
"4c747a34751c7c4f929d0b327a16fd66",
"96f66dfb043bacc084456e0ce3a94ce1",
"fef4f2a0e5785983b50d59f1fa115301",
"2341ca2c35f2a794cef1a6a8b87297ea",
"f8930580c5cf369ee44e788d857bc812",
"cece597f19f2f58765583a4a0985bbbf",
"0133c414f18de420888ef91fa11e68d6",
"48354f04ed5cccdcd433e1338432b9e7",
"61ea58834a750cf19dce318bf14f872b",
"1a17b5d86a38824386f32dd5931fb9f5",
"993ab092a91281cef837031c27762eca",
"3bf0a505d6bed97ee719635cedb77ed0",
"8e697d78742f7ced3074d5b3de527bd2",
"c954bae75aecb0c5e0e61a623daa5058",
"0545056f0d3739fec900262d9cf3f71c",
"ee97d108bb6f00a9d5453ad92ba90ed4",
"c09d8614fc9e82c0ef9e8c3595eff48d",
"5a93189e2d83a227951409b2558dc20a",
"8da7797a0afc096c8ea80f7563a1a9e8",
"0a8d0a1a3a0f29edd196aaa9b25b965d",
"616bde2717ce1e3cfef6ecdc5d1e9cff",
"e6bbaf13bee8cf54abef390db8dc8043",
"7e9e17c8113258eb6841a0c19db50235",
"3cfb5982892bd0401ae51d487754469b",
"82376be6c01247648d2871d1e65670fe",
"6b5e3ddeaae0e7b266ad1dbe36f6c659",
"c2ef07fe8cf1065d7dc0ce7623afb461",
"34aac764846818ddfcd9fe51b1735840",
"bd620494ebf0d4c3f0e1420eb9ec29db",
"4174e48143428589c635ebd80be26ba4",
"d840f04fe2d489a493fb08b98fcd13f4",
"51297cd125bdf73dd20355076faf0686",
"2fa24b0cb78ee593cc46b6674adadbe6",
"0d7c7d90bf9bf7caffc9293baa6943ff",
"e71d40c71c88aefbfed05f4586f0b748",
"6bd25337cfc4b1953f6b5e89de525f60",
"f74d974714b5e30f7a6bddbb80a936c2",
"500e949e5553cffd7e74fcf53f7a8212",
"ec7a6f6a8ba9b9627818b22a4c4e60e5",
"f690c4f3644ed786ecfb2b9709f83a30",
"6cff8d3ca085b705737dce6821bee9d4",
"c18765d66495b4cedca021cab1892779",
"c548d533b1752d920c67a71e55d7c037",
"cd7e248be7d7e44ba4ab1cde58a2a698",
"ccb8c76d1fabe6a00900c260c8f60377",
"bdd050061a4f3acb331b24f2176a4372",
"477b5f728903d887f2fd7c324952619f",
"dc34c1a634d79e0e82f3d1c36b93139e",
"20c598f24e90dac10608ecd7cb0b1a88",
"69abab52827a32dbea1890dfcc47edd3",
"26753c34dab307bf604ac688309087d2",
"9ecacfbcc3d89804ad75557ca193286c",
"6101716cdcc8e729da8eda6a87ef9f14",
"62552e07865610b0cba57c9869de2401",
"8a4b010335b7beaddc8ac5c16ea7ed34",
"8578870bce59800cd8a928fa5fd4ad1b",
"4d31e6ac5eb05a80f32e3c601ddf8fec",
"19d021d650bf039d7bf85bde98120c56",
"0ce9d9e85f679905a1c18ca1baa0782b",
"4b1640dcf812a913d4dce69f1fe367ad",
"cfd7bfdd69ac76de8ae332c2f98bc948",
"4c0f1bfa9c6d60bd5ac7db8dca4f1c05",
"585d78ef45e579c5995cc2e8f5166c02",
"9cf26736eb1538df96ef22ddeae6cf1e",
"146db7658e6f5c595704313493da7071",
"2f9fef7ffb0cd349143dcf4b6d176658",
"36ed5ea40e8ae8e9514f0600bd2121e0",
"66a2b95cdf0f455aa466bc53cb7168a8",
"6710c4289b039b34bd30ac5fdb1750db",
"a1cfa99d1b1bbfb19a41e6dc1c516ad5",
"2efee86ec99598f51c243cb0b17dc15f",
"34f0a8d1d3c09d5d3ff820fcf609195c",
"5fe7944621b07bcc7cb8bc0c19742d79",
"9ff9e1a55aa5773201ee05fff26769cc",
"7a87bd383da4341f37f6812b17c71608",
"63f06968c583b4fa361d2872bdefde65",
"d926918de9a83dc7fc2e1229d8da974e",
"b1cc6eca637b37bef061e045fb0709fb",
"f0f6bb21d3e1d9d89af7d0613fe57b30",
"67a0d016462fc3579e4f6cb10d55c292",
"9e5182b87d248aafd6e2a11e03451e88",
"b36824389ff9122d7b21d383f76ebc9a",
"0351a00eec6902cbb945b82e8157aad8",
"60e7fbf5bba17bc754c5ed73c4cf2cc4",
"215e814833b0b295d9dc77f73424a927",
"22119044bd7163a6ef287c7ff8f44d93",
"682cfd2d63190792e90a446700006049",
"54c19b6cbd1e4843a25bfdcdd1c7e8c5",
"3218ef384b1cbe2fc25e5f0a4384ad3f",
"e4932be38e462f150790b5e3b9c4b8f9",
"7dc4b8849c4d59c07fb459056520fe02",
"8abff4631c86e01743bd797784d72444",
"6d5552fe33e1ba63593caa8cbea27154",
"d134f352d10695d1df309e66fe9af25b",
"318325bd0c1e0e30fe6ee6bc03b839de",
"dfd18d36b2fe83a6df0622562772ca67",
"f22b0910b3dcd87fefad32739911f254",
"318f7647b8633fcc78ccf3ecd1e00472",
"11214178c08bc4ff6c1e4153ad2fdb57",
"241eb6aac846b04de0ef88842d38d04b",
"2e05e6b6632a631ca584331d0883f879",
"591dbe91a6bb7a02a7997012eac176b7",
"3a1a149228180dc817c24abb052d0df0",
"0aa7d8ec42691b0917cc35ac731e7197",
"376b45ea459448c59176495b944a3c47",
"17f7bb881c3a2e010d0499257f97c3fb",
"39e201f39c9dacf6a61b3e82b5f23fbd",
"b16c38f631e93f7aa20c13df738da3f8",
"9f3154e798c6c0f224363c621c4a6c37",
"d616a3125a586a195629edd453610f1a",
"58afe5128c6debe061e8db4dd0a85a74",
"209f4dc46f070bcddb21d81a21e0c6e1",
"dd4c71773de6d1bc8b9cbdd19615c387",
"635f2a7d4fd56a1263b15e3a2b8023ab",
"54a537839b67aa3f714441163aefd7e8",
"4d5381f57585771d802ae50630807115",
"c14a14d94aa4ff21b0e41df35c23b456",
"be2e2f60dfc171596533200e5b48f937",
"1f732768f7048d0f731a5ff8d000ac2f",
"1cdc26560e7a51286ae5f6ada0d016e4",
"db41b8c83d1047089b7d6ecc4abab8e1",
"2fe041901d6b8ca2dd4cf95ff68a40ab",
"8d2ccf942cf631af6d2ebdeb1b059045",
"42c6da1ebeced3827ae1caacba31e75b",
"c2317932cce3bbb09607d4e5d63be3c1",
"568a7644a0365710f472d62f4bfb8418",
"fa311544cd39cfc95702ea51e40f00fc",
"0402adfe9c04d68f7abc361d54c357e2",
"1325bcfcbad515b7da08e499482e2516",
"f85c483a8b31c1fad2e0baadfa0857b4",
"53e4880b949686d31a09b24663209028",
"bdd03c6ef4f0addbc8fa2c5e2687dc53",
"716b582edd790f86bbb793bc7b78fedb",
"a328ccd3cd36e017f439f2af4311115b",
"f141e866d006c221609e94449450a76d",
"888b2a1adbdf1204a1aae3360d922f39",
"0b8697a09b0a61591e6a37760983ede7",
"5309cdf3e09e2e09cbcffd80dcf0a017",
"ed3b7afaa80d6f8c38bdd6a8299390d0",
"38b9b24895d830763ff507fc0b0afa32",
"40720c196ecd9958340529972480ba2f",
"6b2bf3b700cabbb7b508ffce3346828b",
"16db2039b368906470f55503da8d5169",
"01220afeec811fc56808faa077167d6f",
"5d3235b81d8500b31e6ceb2f87671569",
"4023b92ab4be3fb7d886daa1b122e3a6",
"948438ddd06e90813726c7f6c6e54bf8",
"ed9a555b41815270a181b257edb2b14a",
"efdb3eb023170311464126f66590ae28",
"edb5522c83c78e5e368fd3973abbc39e",
"dc682c776842e809cfee6e18aa820008",
"fbc9b8447bbaddc7e48fea0319ce40d3",
"afbffcc24ffab775f7d1fb0d28ec81a8",
"3a6905a36ff74139caeb3544b2e30e8f",
"1257acf00e253d95e8d6a5507a649d46",
"35a460242766b2df2bb4d7313f322dfb",
"75f1b4e92de4cf856dfebecef0e34158",
"05bedcc9f8a4f070972fcf9382d47c3c",
"d513016fc481d731cd38a6bae2aac3e1",
"1344e0cf66ce8366c4b152aed9da88ee",
"3eccb33888d5a963391b553b2393d1fe",
"30666f5f569bcc6c0d27b0ca52c45c39",
"34561ffe2507c9442be463ab25be9fc9",
"be36835ffe6ac8a0edbbcf35f0b8e0d8",
"63eca387303d5681440b4cfaac84b196",
"9ef01b4210a78e7b94c73c9d491f4859",
"74e2d70237d7b5ebcd508bd3f9c760a5",
"79e088ea1a4d4ea54bc39467174ab0c3",
"357c9755776d61ab22050ecb1be8f254",
"b324dad3e4cf89cdb45a94bcc5e3a3fe",
"f7aec17e2b187d496cf4b5465fba1a85",
"c633704bfd49470b4a0db47af2a87b9e",
"1a675a4b86626d986097b0f773277f0a",
"a2565e53ba3fda1ecd9d5f8052f851e6",
"1b2f4a710dcc7bf5883ca2dffd7e5a40",
"fe9ca2b9996bc9a7b385fa4b45199843",
"fc2af4edd8f1f399e49ea01c5988a44f",
"9ea4950364a7f592c89bcccf0eaeb322",
"b16aa92baca71fb77d0a744ac888b6e4",
"2b8198c8997e1a5414010334a1da81e5",
"639a5f915607bbae068e6a19cc3706a9",
"93e476326fc956008f705f22cdb7f9e4",
"7ace18338075b2914e78fc264a2eb934",
"fccd21261648b1cdbba0204d651746d5",
"df15bd9e1625d3cdaec94e86135fb8aa",
"121268d407994d04ae61d015eba20d5e",
"bc98c009f3f0bd0169e11ce663f8c298",
"adfefe6d1d9e80a90ed86233431928a0",
"b5afd6a71d09d9e97fb29cddbf2e3fe1",
"ff2d1e092e21f6c0aa77c1ddec8af823",
"886a07101fc0f98ccc90b63cc11ae3e9",
"6b33078dca0c53cf50b6b1c4f18d0c19",
"2bf06048e322754dc1cc4c98d5ee1c50",
"87395579cdf3fad32dbf1fcfbc8bcb10",
"1341aa450a89f60a8f8b5fa50f1fbb4d",
"dfe0ee8620f7f5b132b8890cfbd68fa4",
"f54e68ee70488442f4406e055bd3de64",
"f901f166487a0888c4bd69be1f030b90",
"29fd7ef535d0a61a8f1a8fc684f41246",
"3ea95393e37003490ed3707d3e9276f7",
"fc49ca134bbec186ac6b849740d208a8",
"68d404e8253721ac67ee2d530f837d91",
"5fe2c21c5239c9565c9e2c48b4b47566",
"6f8fab82c16339552993ac103942f632" ];
}

function onFirstFrameRendered()
{
    //console.log("First frame rendered!");
}

function onGameSetWindowSize(width,height)
{
    console.log("Window size set to width: " + width + ", height: " + height);

    startingHeight = height;
    startingWidth = width;
    startingAspect = startingWidth / startingHeight;
}

function ensureAspectRatio() {
  if (canvasElement === undefined) {
    return;
  }

  if (!CHANGE_ASPECT_RATIO) {
    return;
  }
  
  if (startingHeight === undefined && startingWidth === undefined) {
    return;
  }

  canvasElement.classList.add("active");

  const maxWidth = window.innerWidth;
  const maxHeight = window.innerHeight;
  var newHeight, newWidth;

  // Find the limiting dimension.
  var heightQuotient = startingHeight / maxHeight;
  var widthQuotient = startingWidth / maxWidth;

  if (heightQuotient > widthQuotient) {
    // Max out on height.
    newHeight = maxHeight;
    newWidth = newHeight * startingAspect;
  } else {
    // Max out on width.
    newWidth = maxWidth;
    newHeight = newWidth / startingAspect;
  }

  canvasElement.style.height = newHeight + "px";
  canvasElement.style.width = newWidth + "px";
}

function pause() { // Don't change the name - GX Mobile calls it when the app becomes inactive.
  if (!canvasElement.classList.contains("active")) { // Wait for the canvas to load.
    return
  }

  GM_pause();
  canvasElement.classList.add("paused");
  if (window.UTPauseMenu) { window.UTPauseMenu.open(); } /* the real in-game menu */
}

function resume() {
  GM_unpause();
  if (window.UTPauseMenu) { window.UTPauseMenu.close(); }
  canvasElement.classList.remove("paused");
  canvasElement.classList.add("unpaused");
  enterFullscreenIfSupported();
  lockOrientationIfSupported();
}

function quitIfSupported() {
  // Back to the loading screen (the browser build has no parent app to return to).
  window.location.reload();
}

function enterFullscreenIfSupported() {
  if (!window.oprt || !window.oprt.enterFullscreen) { /* GX Mobile API */
    return;
  }

  window.oprt.enterFullscreen();
  let viewStatus = GM_get_view_status();
  viewStatus.fullscreen = true;
  GM_set_view_status(viewStatus);
}

function lockOrientationIfSupported() {
  if (!window.oprt || !window.oprt.lockPortraitOrientation || !window.oprt.lockLandscapeOrientation) { /* GX Mobile API */
    return;
  }

  let viewStatus = GM_get_view_status();
  if (viewStatus.landscape === true && viewStatus.portrait === false) {
    window.oprt.lockPortraitOrientation();
  } else if (viewStatus.landscape === false && viewStatus.portrait === true) {
    window.oprt.lockPortraitOrientation();
  }
}

/* Observe the dimensions of body and ensureAspectRatio of the canvas (whilst taking up maximum space)
 *
 * NOTE(robertz):
 *  We also need to request an Animation Frame to do this, if we do not, resizeObserver might throw error
 *  "ResizeObserver loop limit exceeded", which means that
 *  "[...] ResizeObserver was not able to deliver all observations within a single animation frame"
 *  https://stackoverflow.com/a/50387233 (source).
 *
 *  There are different ways to solve the issue, since the error is benign (meaning it wont crash anything)
 *  we could choose to ignore it via changing the window.onerror method, i.e
 *  ```
 *  window.onerror((event)=> {
 *    if(event==="ResizeObserver loop limit exceeded") {
 *       return
 *    }
 *     ///...rest
 *  }
 *  ```
 *  But for now we request an animationFrame which seems to be the recommended way to go about it.
 *
 * NOTE(ddrechny):
 *  window.innerWidth/Height value updates are sometimes delayed in WebKit on iOS after an orientation
 *  change. Hence we're calling ensureAspectRatio one more time after a delay to minimize the risk of
 *  sizing the canvas with outdated values.
 */
const resizeObserver = new ResizeObserver(() => {
  window.requestAnimationFrame(ensureAspectRatio);
  setTimeout(() => window.requestAnimationFrame(ensureAspectRatio), 100);
});
resizeObserver.observe(document.body);

/* NOTE(ddrechny):
 *  Body needs to be scrollable on desktop browsers for debug buttons to be accessible.
 *  On mobile browsers scrolling can be activated accidentally and debug buttons aren't useful,
 *  so it's better to disable it.
 */
if (/Android|iPhone|iPod/i.test(navigator.userAgent)) {
  bodyElement.className = "scrollingDisabled";
  canvasElement.classList.add("animatedSizeTransitions");
  outputContainerElement.hidden = true;
}

/* QUIT is always available in the browser build - it reloads to the loading screen. */

setWadLoadCallback(() => {
  enterFullscreenIfSupported();
  lockOrientationIfSupported();
});

var read_ptr = 0;
read_int = () => {
  var heap_slice = Module["HEAPU8"].subarray(read_ptr, read_ptr + 4);
  var buffer = new ArrayBuffer(4);
  var barray = new Uint8Array(buffer);
  for (var i = 0; i < 4; i++) barray[i] = heap_slice[i];
  var int_array = new Int32Array(buffer);
  var int = int_array[0];
  read_ptr += 4;
  return int;
};

read_pointer = () => {
  var ptr = Module.getValue(read_ptr, "*");
  read_ptr += 8;
  return ptr;
};

readPeer = () => {
  var peer = {
    peer: read_int(),
    local_frames_ahead: read_int(),
    rtt: read_int(),
    remote_frame_rate: read_int(),
    remote_frame_delay: read_int(),
  }

  return peer;
}

readStats = (s) => {
  read_ptr = s;

  var stats = {
    kbps_sent: read_int(),
    kbps_received: read_int(),
    pps_sent: read_int(),
    pps_received: read_int(),
    frame_rate: read_int(),
    rollbacks: read_int(),
    frame_delay: read_int(),
    skipped_frames: read_int(),
    rejected_inputs: read_int(),
    relay_rtt: read_int(),
    peer: read_int(),
    num_peers: read_int(),

    serialization_stats: {
      state_size: read_int(),
      managed_instances_num: read_int()
    },
    peers: []
  }

  read_ptr = read_pointer();
  for (var j = 0; j < stats.num_peers; ++j) {
    stats.peers.push(readPeer());
  }

  return stats;

}

var acceptable_rollback_frames = 0;
var set_acceptable_rollback = (frames) => {
  acceptable_rollback_frames = frames;
}

drawLocal = (peers_elem, frame_delay_elem, relay_rtt_elem, peer_name, relay_rtt, frame_delay) => {
    drawPeer(peers_elem, frame_delay_elem, peer_name, 0, frame_delay, 0);

    const per_pixel = 100/16;
    const frames_rtt = relay_rtt/16; // To ceil, or not to ceil - that's the question.

    const y = 100 - frames_rtt * per_pixel;

    const relay_rtt_marker = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    relay_rtt_marker.setAttribute('x1', -2);
    relay_rtt_marker.setAttribute('y1', y);
    relay_rtt_marker.setAttribute('x2', 2);
    relay_rtt_marker.setAttribute('y2', y);

    relay_rtt_marker.setAttribute('data-relay-rtt', relay_rtt);

    relay_rtt_marker.classList.add(peer_name);
    relay_rtt_marker.classList.add('relay-rtt');

    relay_rtt_elem.appendChild(relay_rtt_marker);
}

drawPeer = (peers_elem, frame_delay_elem, peer_name, rtt, frame_delay, frames_ahead) => {
  const per_pixel = 100/16;
  const frames_rtt = rtt/16; // To ceil, or not to ceil - that's the question.
  const x = 50 + frames_ahead * per_pixel;
  const y = 100 - frames_rtt * per_pixel;

  const peer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  peer.setAttribute('cx', x);
  peer.setAttribute('cy', y);
  peer.setAttribute('r', 1);

  peer.setAttribute('data-rtt', rtt);
  peer.setAttribute('data-frame-delay', frame_delay);
  peer.setAttribute('data-frames-ahead', frames_ahead);

  peer.classList.add(peer_name);
  peer.classList.add('peer');

  peers_elem.appendChild(peer);

  const peer_frame_delay = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  peer_frame_delay.setAttribute('cx', x);
  peer_frame_delay.setAttribute('cy', y);
  peer_frame_delay.setAttribute('r', frame_delay * per_pixel);

  peer_frame_delay.classList.add(peer_name);
  peer_frame_delay.classList.add('peer-frame-delay');

  frame_delay_elem.appendChild(peer_frame_delay);

  if (acceptable_rollback_frames > 0) {
    const peer_acceptable_rollback = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    peer_acceptable_rollback.setAttribute('cx', x);
    peer_acceptable_rollback.setAttribute('cy', y);
    peer_acceptable_rollback.setAttribute('r', (frame_delay + acceptable_rollback_frames) * per_pixel);

    peer_acceptable_rollback.classList.add(peer_name);
    peer_acceptable_rollback.classList.add('peer-acceptable-rollback');
    frame_delay_elem.appendChild(peer_acceptable_rollback);
  }
}

report_stats = (stats_data) => {

  var stats = readStats(stats_data);

  var peers_elem = document.getElementById("stats-network-peers");
  var frame_delay_elem = document.getElementById("stats-network-peer-frame-delays");
  var relay_rtt_elem = document.getElementById("stats-network-relay-rtt");

  peers_elem.innerHTML = '';
  frame_delay_elem.innerHTML = '';
  relay_rtt_elem.innerHTML = '';

  stats.peers.forEach(p => {
    drawPeer(peers_elem, frame_delay_elem, 'peer' + p.peer, p.rtt, p.remote_frame_delay, p.local_frames_ahead);
  });

  drawLocal(peers_elem, frame_delay_elem, relay_rtt_elem, 'peer' + stats.peer, stats.relay_rtt, stats.frame_delay);
}

let wallpaperConfig = {};
const wallpaperConfigKey = 'wallpaper-config';

function wallpaper_init_config_controls(definitions) {
  const wallpaperContainer = document.getElementById("wallpaper-container");
  wallpaperContainer.style.display = "block";

  let configStyle = '<style type="text/css">' +
    'body { color: white; font-family: Averta, -apple-system, "Segoe UI", system-ui, sans-serif; font-style: normal; font-size: 10px; }' +
    '.config-row { display: flex; justify-content: flex-start; align-items: center; padding: .5em; }' +
    '.config-row > label { flex: 1 }' +
    '.config-row > input { flex: initial; }' +
    '.config-row > textarea { flex: 1; }' +
    '.config-row-label { font-size: 12px; font-weight: 600; }' +
    'button { padding: 8px 16px; border-radius: 4px; background-color: unset; border-color: rgb(199, 159, 234); color: rgb(199, 159, 234); }' +
    '</style>';
  let configHTML = '<html><head><title></title>' + configStyle + '</head><body>' +
    '<div class="wallpaper-header"><h1>Live Wallpaper Configurator</h1><button id="wallpaper-reset-parameters">Reset parameters</button></div>' +
    '<div class="wallpaper-config" id="wallpaper-config"></div>' +
    '</body></html>'

  const wallpaperConfigDocument = document.getElementById("wallpaper-config-iframe").contentDocument;
  wallpaperConfigDocument.open();
  wallpaperConfigDocument.write(configHTML);
  wallpaperConfigDocument.close();

  const storedConfig = JSON.parse(localStorage.getItem(wallpaperConfigKey));
  if (storedConfig) {
    wallpaperConfig = storedConfig;
  }

  const configElement = wallpaperConfigDocument.getElementById("wallpaper-config");
  const resetButton = wallpaperConfigDocument.getElementById("wallpaper-reset-parameters");
  resetButton.addEventListener("click", (e) => {
    wallpaper_reset_config();
    wallpaperConfig = {};
    add_config_elems(configElement, definitions);
    notify_config_change();
  }, false);

  add_config_elems(configElement, definitions);
  notify_config_change();
}

function add_config_elems(configElement, definitions) {
  while (configElement.hasChildNodes()) {
    configElement.removeChild(configElement.lastChild);
  }

  definitions.value
    .map(d => create_elems(d, wallpaperConfig, ""))
    .filter(e => e !== null && e !== undefined)
    .map(e => configElement.appendChild(e));
}

function create_elems(definition, config, prefixId) {
    if (definition.type === undefined || definition.name === undefined) {
      console.log("missing definition name or type for: ", definition);
      return null;
    }

    if  (definition.type === "section") {
      return create_section_elem(definition, config, prefixId);
    }


    if (definition.value === undefined ) {
      console.log("missing definition value for: ", definition);
      return null;
    }

    if (definition.type === "range") {
      return create_range_elem(definition, config, prefixId);
    }

    if (definition.type === "boolean") {
      return create_checkbox_elem(definition, config, prefixId);
    }

    if (definition.type === "color" || definition.type === "colour") {
      return create_color_elem(definition, config, prefixId);
    }

    if (definition.type === "string") {
      return create_text_elem(definition, config, prefixId);
    }

    if (definition.type === "string_multiline") {
      return create_multiline_text_elem(definition, config, prefixId);
    }

    if (definition.type === "select") {
      return create_select_elem(definition, config, prefixId);
    }

    if (definition.type === "file" || definition.type === "folder") {
      return create_not_supported_elem(definition, config);
    }
    
    console.log("missing config value for: ", definition);
    return null;
}

function create_section_elem(definition, config, prefixId) {
  const divElem = document.createElement("div");

  const headerElem = document.createElement("h2");
  headerElem.innerHTML = definition.label;

  divElem.appendChild(headerElem);

  const sectionId = prefixId + definition.name + "-"
  if (!config[definition.name]) {
    config[definition.name] = {};
  }

  definition.children
    .map(c => create_elems(c, config[definition.name], sectionId))
    .filter(e => e !== null && e !== undefined)
    .map(e => divElem.appendChild(e));

  return divElem;
}

function get_initial_value(definition, config) {
  let value =  definition.value;
  const configValue = config[definition.name];
  if (configValue && (typeof(configValue) === typeof(value))) {
    value = configValue;
  }

  return value;
}

function wrap_with_label(inputElem, definition, prefixId) {
  const controlElem = document.createElement("div");
  controlElem.classList.add(definition.name + "-control");
  controlElem.classList.add("config-row");

  const labelElem = document.createElement("label");
  labelElem.htmlFor = prefixId + definition.name;
  labelElem.innerHTML = "<span class='config-row-label'>" + (definition.label || definition.name) + "</span>";
  if (definition.description) {
    labelElem.innerHTML += "<p>" + definition.description + "</p>";
  }
  controlElem.appendChild(labelElem);

  inputElem.id = prefixId + definition.name;
  controlElem.appendChild(inputElem);

  return controlElem;
}

function create_range_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const valueElem = document.createElement("span");
  valueElem.style = "margin: 0.5em";
  valueElem.innerHTML = "(" + value + ")";

  const stepElem = document.createElement("input");
  stepElem.id = prefixId + definition.name;
  stepElem.type = "range";
  stepElem.min = definition.min || 0;
  stepElem.max = definition.max || 100;
  stepElem.step = definition.step || 1;
  stepElem.value = value;

  config[definition.name] = value;
  function range_value_updated(e) {
    const valueUpdate = Number(e.target.value);
    config[definition.name] = valueUpdate;
    valueElem.innerHTML = "(" + valueUpdate + ")";

    notify_config_change();
  }

  stepElem.addEventListener("change", range_value_updated, false);
  stepElem.addEventListener("input", range_value_updated, false);

  const valueWrapper = document.createElement("span");
  valueWrapper.appendChild(valueElem);
  valueWrapper.appendChild(stepElem);

  return wrap_with_label(valueWrapper, definition, prefixId);
}

function create_checkbox_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const checkboxElem = document.createElement("input");
  checkboxElem.type = "checkbox";
  checkboxElem.checked = value;
  
  config[definition.name] = value;
  checkboxElem.addEventListener("change", (e) => {
    const valueUpdate = Boolean(e.target.checked);
    config[definition.name] = valueUpdate;
    notify_config_change();
  });

  return wrap_with_label(checkboxElem, definition, prefixId);
}

function create_color_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const bgrColor = value;
  const r = (bgrColor & 0x0000ff);
  const g = (bgrColor & 0x00ff00) >> 8;
  const b = (bgrColor & 0xff0000) >> 16;
  const rgbColor = (r << 16) + (g << 8) + b;
  const color = "#" + rgbColor.toString(16).padStart(6, '0');

  const colorElem = document.createElement("input");
  colorElem.type = "color";
  colorElem.value = color;

  config[definition.name] = value;
  function color_value_updated(e) {
    const color = e.target.value;
    const rgbColor = parseInt(color.slice(1), 16);
    const r = (rgbColor & 0xff0000) >> 16;
    const g = (rgbColor & 0x00ff00) >> 8;
    const b = (rgbColor & 0x0000ff);
    const bgrColor = (b << 16) + (g << 8) + r;

    config[definition.name] = bgrColor;
    notify_config_change();
  }

  colorElem.addEventListener("change", color_value_updated, false);
  colorElem.addEventListener("input", color_value_updated, false);
  
  return wrap_with_label(colorElem, definition, prefixId);
}

function create_text_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const textElem = document.createElement("input");
  textElem.type = "text";
  textElem.value = value;
  console.log("text", value)
  if (definition.max_length && definition.max_length > 0) {
    textElem.maxLength = definition.max_length;
  }

  config[definition.name] = value;
  textElem.addEventListener("input", (e) => {
    config[definition.name] = e.target.value;
    notify_config_change();
  });
  
  return wrap_with_label(textElem, definition, prefixId);
}

function create_multiline_text_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const textareaElem = document.createElement("textarea");
  textareaElem.rows = 5;
  textareaElem.cols = 50;
  textareaElem.value = value;
  if (definition.max_length && definition.max_length > 0) {
    textareaElem.maxLength = definition.max_length;
  }

  config[definition.name] = value;
  textareaElem.addEventListener("input", (e) => {
    config[definition.name] = e.target.value;
    notify_config_change();
  });
  
  return wrap_with_label(textareaElem, definition, prefixId);
}

function create_select_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const selectElem = document.createElement("select");
  selectElem.value = value;
  
  const options = definition.options || [];
  options.forEach(o => {
    const option = document.createElement("option");
    option.value = o;
    option.text = o;
    option.selected = o == value ? "selected" : "";
    selectElem.appendChild(option);
  })

  config[definition.name] = value;
  selectElem.addEventListener("change", (e) => {
    e.selected = "selected";
    config[definition.name] = e.target.value;
    notify_config_change();
  });
  
  return wrap_with_label(selectElem, definition, prefixId);
}

function create_not_supported_elem(definition, config, prefixId) {
  const labelElem = document.createElement("label");
  labelElem.innerHTML = "Not supported in browser";

  config[definition.name] = definition.value;
  return wrap_with_label(labelElem, definition, prefixId);
}

function notify_config_change() {
  console.log(wallpaperConfig)
  localStorage.setItem(wallpaperConfigKey, JSON.stringify(wallpaperConfig));

  wallpaper_update_config(JSON.stringify(wallpaperConfig));
}

/* [ut-utilextras:start] ======================================================

   FULLSCREEN  --  F4 anywhere, and the pause menu's FULLSCREEN option.
   (v1.6: the DETERMINATION BACKUP module that lived here - save-state
   snapshots, Shift+Ctrl+E, auto-backup - was removed on request: the
   game's own saves + BOSS STATES cover the workflow. Leftover backup
   records from old versions are wiped once so they cannot confuse
   anything.)

   ====================================================== [ut-utilextras:end] */
(function () {
  "use strict";
  if (window.__utExtrasInit) return;
  window.__utExtrasInit = true;

  /* one-time cleanup of pre-v1.6 backup records */
  try {
    var stale = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && (k.indexOf("soulstate::") === 0 || k.indexOf("ut::backup::") === 0)) stale.push(k);
    }
    for (var j = 0; j < stale.length; j++) localStorage.removeItem(stale[j]);
  } catch (e) {}

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function lockReservedKeys() {
    try {
      if (navigator.keyboard && navigator.keyboard.lock) {
        var p = navigator.keyboard.lock(["ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight"]);
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }
  function unlockReservedKeys() {
    try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); }
    catch (e) {}
  }
  function toggleFullscreen() {
    var el = document.documentElement;
    if (fullscreenElement()) {
      if (document.exitFullscreen) {
        var p = document.exitFullscreen();
        if (p && p.catch) p.catch(function () {});
      } else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    try {
      var r;
      if (el.requestFullscreen) r = el.requestFullscreen();
      else if (el.webkitRequestFullscreen) r = el.webkitRequestFullscreen();
      if (r && r.then) r.then(lockReservedKeys).catch(function () {});
      else lockReservedKeys();
    } catch (e) {}
  }
  document.addEventListener("fullscreenchange", function () { if (!fullscreenElement()) unlockReservedKeys(); });
  document.addEventListener("webkitfullscreenchange", function () { if (!fullscreenElement()) unlockReservedKeys(); });

  window.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.key === "F4" || e.code === "F4") {
      e.preventDefault();
      toggleFullscreen();
    }
  }, true);

  window.UTFullscreen = { toggle: toggleFullscreen };
})();

/* [ut-saveinfo:start] ==========================================================

   SAVE INFO  --  reads the live save mirror and derives the route state
   ---------------------------------------------------------
   The save-sync mirrors GameMaker's virtual file system (IndexedDB /_savedata)
   into localStorage under "ut/_savedata/<file>". This module parses file0
   (the main save, 549 lines) and derives:

     name / LV / HP / gold / EXP / kills
     murderlv   - exact port of the game's own scr_murderlv (genocide tracker)
     route      - PACIFIST (kills 0) / NEUTRAL / GENOCIDE (murderlv >= 1)
     roomName   - from the embedded 342-room table
     area       - RUINS / SNOWDIN / WATERFALL / HOTLAND / CORE / NEW HOME ...
     boss       - the checkpoint this save sits at: SANS, UNDYNE THE UNDYING,
                  ASGORE, METTATON EX / NEO, FLOWEY, PAPYRUS, TORIEL, ASRIEL

   ========================================================== [ut-saveinfo:end] */
(function () {
  "use strict";
  if (window.UTSaveInfo) return;

  var ROOMS="room_xbox_engagement|room_start|room_introstory|room_introimage|room_intromenu|room_area1|room_area1_2|room_ruins1|room_ruins2|room_ruins3|room_ruins4|room_ruins5|room_ruins6|room_ruins7|room_ruins7A|room_ruins8|room_ruins9|room_ruins10|room_ruins11|room_ruins12A|room_ruins12|room_ruins12B|room_ruins13|room_ruins14|room_ruins15A|room_ruins15B|room_ruins15C|room_ruins15D|room_ruins15E|room_ruins16|room_ruins17|room_ruins18OLD|room_ruins19|room_torhouse1|room_torhouse2|room_torhouse3|room_torielroom|room_asrielroom|room_kitchen|room_basement1|room_basement2|room_basement3|room_basement4|room_basement5|room_ruinsexit|room_tundra1|room_tundra2|room_tundra3|room_tundra3A|room_tundra4|room_tundra5|room_tundra6|room_tundra6A|room_tundra7|room_tundra8|room_tundra8A|room_tundra9|room_tundra_spaghetti|room_tundra_snowpuzz|room_tundra_xoxosmall|room_tundra_xoxopuzz|room_tundra_randoblock|room_tundra_lesserdog|room_tundra_icehole|room_tundra_iceentrance|room_tundra_iceexit_new|room_tundra_iceexit|room_tundra_poffzone|room_tundra_dangerbridge|room_tundra_town|room_tundra_town2|room_tundra_dock|room_tundra_inn|room_tundra_inn_2f|room_tundra_grillby|room_tundra_library|room_tundra_garage|room_tundra_sanshouse|room_tundra_paproom|room_tundra_sansroom_dark|room_tundra_sansroom|room_tundra_sansbasement|room_fogroom|room_water1|room_water2|room_water3|room_water3A|room_water4|room_water_bridgepuzz1|room_water5|room_water5A|room_water6|room_water7|room_water8|room_water9|room_water_savepoint1|room_water11|room_water_nicecream|room_water12|room_water_shoe|room_water_bird|room_water_onionsan|room_water14|room_water_piano|room_water_dogroom|room_water_statue|room_water_prewaterfall|room_water_waterfall|room_water_waterfall2|room_water_waterfall3|room_water_waterfall4|room_water_preundyne|room_water_undynebridge|room_water_undynebridgeend|room_water_trashzone1|room_water_trashsavepoint|room_water_trashzone2|room_water_friendlyhub|room_water_undyneyard|room_water_undynehouse|room_water_blookyard|room_water_blookhouse|room_water_hapstablook|room_water_farm|room_water_prebird|room_water_shop|room_water_dock|room_water15|room_water16|room_water_temvillage|room_water17|room_water18|room_water19|room_water20|room_water21|room_water_undynefinal|room_water_undynefinal2|room_water_undynefinal3|room_fire1|room_fire2|room_fire_prelab|room_fire_dock|room_fire_lab1|room_fire_lab2|room_fire3|room_fire5|room_fire6|room_fire6A|room_fire_lasers1|room_fire7|room_fire8|room_fire_shootguy_2|room_fire9|room_fire_shootguy_1|room_fire_turn|room_fire_cookingshow|room_fire_savepoint1|room_fire_elevator_r1|room_fire_elevator_r2|room_fire_hotdog|room_fire_walkandbranch|room_fire_sorry|room_fire_apron|room_fire10|room_fire_rpuzzle|room_fire_mewmew2|room_fire_boysnightout|room_fire_newsreport|room_fire_coreview2|room_fire_elevator_l2|room_fire_elevator_l3|room_fire_spidershop|room_fire_walkandbranch2|room_fire_conveyorlaser|room_fire_shootguy_3|room_fire_preshootguy4|room_fire_shootguy_4|room_fire_savepoint2|room_fire_spider|room_fire_pacing|room_fire_operatest|room_fire_multitile|room_fire_hotelfront_1|room_fire_hotelfront_2|room_fire_hotellobby|room_fire_restaurant|room_fire_hoteldoors|room_fire_hotelbed|room_fire_elevator_r3|room_fire_precore|room_fire_core1|room_fire_core2|room_fire_core3|room_fire_core4|room_fire_core5|room_fire_core_freebattle|room_fire_core_laserfun|room_fire_core_branch|room_fire_core_bottomleft|room_fire_core_left|room_fire_core_topleft|room_fire_core_top|room_fire_core_topright|room_fire_core_right|room_fire_core_bottomright|room_fire_core_center|room_fire_shootguy_5|room_fire_core_treasureleft|room_fire_core_treasureright|room_fire_core_warrior|room_fire_core_bridge|room_fire_core_premett|room_fire_core_metttest|room_fire_core_final|room_fire_elevator|room_fire_elevator_l1|room_fire_finalelevator|room_castle_elevatorout|room_castle_precastle|room_castle_hook|room_castle_front|room_asghouse1|room_asghouse2|room_asghouse3|room_asgoreroom|room_asrielroom_final|room_kitchen_final|room_basement1_final|room_basement2_final|room_basement3_final|room_basement4_final|room_lastruins_corridor|room_sanscorridor|room_castle_finalshoehorn|room_castle_coffins1|room_castle_coffins2|room_castle_throneroom|room_castle_prebarrier|room_castle_barrier|room_castle_exit|room_undertale_end|room_castle_trueexit|room_outsideworld|room_fire_labelevator|room_truelab_elevatorinside|room_truelab_elevator|room_truelab_hall1|room_truelab_hub|room_truelab_hall2|room_truelab_operatingroom|room_truelab_redlever|room_truelab_prebed|room_truelab_bedroom|room_truelab_mirror|room_truelab_bluelever|room_truelab_hall3|room_truelab_shower|room_truelab_determination|room_truelab_tv|room_truelab_cooler|room_truelab_greenlever|room_truelab_fan|room_truelab_castle_elevator|room_truelab_prepower|room_truelab_power|room_gaster|room_icecave1|room_ice_dog|room2|room_water_fakehallway|room_mysteryman|room_soundtest|TESTROOM|room_water_redacted|room_water13|room_overworld|room_overworld3|bullettest|room_water16A|room_end_castroll|room_end_highway|room_end_beach|room_end_metta|room_end_school|room_end_mtebott|room_creditsdodger|room_end_myroom|room_end_theend|room_spritecheck|room_settings|room_controltest|room_f_start|room_f_intro|room_f_menu|room_f_room|room_floweyx|room_f_phrase|room_fire4|room_fire10_old|room_fire10A_old|room_tundra_placeholder|room_ruins12B_old|room_tundra_rollsnow|room_water7_older|room_meetundyne_old|room_water_mushroom|room_monsteralign_test|room_battle|room_floweybattle|room_fastbattle|room_storybattle|room_gameover|room_shop1|room_shop2|room_shop3|room_shop4|room_shop5|room_riverman_transition|room_papdate|room_adate|room_flowey_endchoice|room_flowey_regret|room_empty|room_emptywhite|room_emptyblack|room_nothingness|room_undertale|room_of_dog|room_quizholder|room_friendtest|room_bringitinguys|room_asrielappears|room_goodbyeasriel|room_asrielmemory|room_asrieltest|room_afinaltest|room_dogshrine|room_dogshrine_ruined|room_dogshrine_mewmew|room_of_bog|room_dogshrine_xbox|room_decomp_settings".split("|");

  /* mirror helpers ------------------------------------------------------- */
  /* mirror values are produced by the save-sync's serializer, so a file
     shows up in one of these shapes:
       "JS:<json>"                    primitive (string/number)
       "AB:<base64>"                  raw ArrayBuffer
       "TA:<ctor>:<base64>"           typed array
       "DATE:<ms>"                    Date
       "OBJ:{"contents":"AB:..",     an IDBFS file node - the usual case
             "mode":"JS:33206",
             "timestamp":"DATE:.."}
     decodeMirror turns any of these into the file's TEXT (or null). */
  function b64ToText(b64) {
    try {
      var bin = atob(b64), s = "";
      for (var i = 0; i < bin.length; i++) s += String.fromCharCode(bin.charCodeAt(i) & 0xff);
      return s;
    } catch (e) { return null; }
  }

  function decodeLeaf(str) {
    if (str === null || str === undefined) return null;
    str = String(str);
    if (str.indexOf("JS:") === 0) {
      try { return JSON.parse(str.slice(3)); } catch (e) { return null; }
    }
    if (str.indexOf("AB:") === 0) return b64ToText(str.slice(3));
    if (str.indexOf("TA:") === 0) {
      var rest = str.slice(3), c = rest.indexOf(":");
      return c === -1 ? b64ToText(rest) : b64ToText(rest.slice(c + 1));
    }
    return null;
  }

  function decodeMirror(raw) {
    if (!raw) return null;
    if (raw.indexOf("OBJ:") === 0) {
      /* file node: {"contents":<leaf>, "mode":<leaf>, "timestamp":<leaf>} */
      try {
        var node = JSON.parse(raw.slice(4));
        var txt = node && typeof node === "object" ? decodeLeaf(node.contents) : null;
        if (txt !== null && txt !== undefined) return txt;
        /* node JSON where contents itself is a nested serialized leaf */
        for (var k in node) {
          var v2 = decodeLeaf(node[k]);
          if (typeof v2 === "string" && v2.length) return v2;
        }
      } catch (e) { return null; }
      return null;
    }
    var d = decodeLeaf(raw);
    return d === undefined ? null : d;
  }

  function findFile(name) {
    /* The HTML5 port keeps every game file inside ONE buffer file,
       undertale.sav, whose content is a JSON object:
           {"file0":"<549 lines>","undertale.ini":"...","file9":"..."}
       (the game's ossafe_file_text_* wrappers read from the in-memory
       savedata ds_map, which obj_time fills by json_decoding that file).
       Read the entry from there first, then fall back to per-file mirrors
       (used by the runner's own files like decomp_vars.ini). */
    try {
      var sav = decodeMirror(localStorage.getItem("ut/_savedata/undertale.sav"));
      if (typeof sav === "string" && sav.charAt(0) === "{") {
        var json = sav.charCodeAt(sav.length - 1) === 0 ? sav.slice(0, -1) : sav;
        var map = JSON.parse(json);
        var lower = String(name).toLowerCase();
        if (Object.prototype.hasOwnProperty.call(map, lower) &&
            typeof map[lower] === "string") return map[lower];
      }
    } catch (e) {}
    var v = localStorage.getItem("ut/_savedata/" + name);
    if (v !== null) { var d = decodeMirror(v); if (d !== null) return d; }
    v = localStorage.getItem("ut" + name);
    if (v !== null) { var d2 = decodeMirror(v); if (d2 !== null) return d2; }
    return null;
  }

  /* exact port of scr_murderlv -------------------------------------------
     (v1.8: re-verified against the bytecode, comparison for comparison.
     The game uses GTE for the kill counters, EQU for the story flags,
     and flag 27 must be exactly 0 for the corridor step. flag 26 is a
     debug override that only fires when > 0, so it is not ported.) */
  function murderlv(f) {
    function g(i) { return (f && f.length > i) ? (+f[i] || 0) : 0; }
    var m = 0;
    if (g(202) >= 20) m = 1;
    if (m === 1 && g(45) === 4) m = 2;
    if (m === 2 && g(52) === 1) m = 3;
    if (m === 3 && g(53) === 1) m = 4;
    if (m === 4 && g(54) === 1) m = 5;
    if (m === 5 && g(57) === 2) m = 6;
    if (m === 6 && g(203) >= 16) m = 7;
    if (m === 7 && g(67) === 1) m = 8;
    if (m === 8 && g(81) === 1) m = 9;
    if (m === 9 && g(252) === 1) m = 10;
    if (m === 10 && g(204) >= 18) m = 11;
    if (m === 11 && g(251) === 1 && g(350) === 1) m = 12;
    if (m === 12 && g(402) === 1) m = 13;
    if (m === 13 && g(397) === 1) m = 14;
    if (m === 14 && g(205) >= 40) m = 15;
    if (m === 15 && g(425) === 1 && g(27) === 0) m = 16;
    return m;
  }

  function areaOf(rn) {
    if (rn === "room_sanscorridor") return "THE LAST CORRIDOR";
    if (/^room_ruins|^room_f_intro|^room_basement\d*$/.test(rn)) return "RUINS";
    if (/^room_tundra/.test(rn)) return "SNOWDIN";
    if (/^room_water/.test(rn)) return "WATERFALL";
    if (/^room_fire_core/.test(rn)) return "CORE";
    if (/^room_fire/.test(rn)) return "HOTLAND";
    if (/^room_castle|^room_lastruins|^room_basement.*_final|^room_asgore|^room_asriel|^room_kitchen|^room_sans/.test(rn)) return "NEW HOME";
    if (/^room_truelab/.test(rn)) return "TRUE LAB";
    if (/^room_end/.test(rn)) return "THE END";
    if (/^room_flowey/.test(rn)) return "???";
    return "THE UNDERGROUND";
  }

  function bossOf(info) {
    var rn = info.roomName, g = info.route === "GENOCIDE";
    if (rn === "room_sanscorridor" || rn === "room_lastruins_corridor") return "SANS";
    if (g && (rn === "room_water_trashsavepoint" || rn === "room_water_undynebridge" ||
              rn === "room_water_undynebridgeend" || rn === "room_water_preundyne" ||
              rn === "room_water19" || rn === "room_water20" || rn === "room_water21"))
      return "UNDYNE THE UNDYING";
    if (/^room_water_undynefinal/.test(rn)) return "UNDYNE";
    if (g && rn === "room_fire_turn") return "ROYAL GUARDS";
    if (g && (rn === "room_fire_core_metttest" || rn === "room_fire_core_final" ||
              rn === "room_fire_core_premett")) return "METTATON NEO";
    if (!g && (rn === "room_fire_core_metttest" || rn === "room_fire_core_final" ||
               rn === "room_fire_core_premett")) return "METTATON EX";
    if (rn === "room_asgoreroom" || rn === "room_castle_prebarrier" || rn === "room_castle_barrier") return "ASGORE";
    if (rn === "room_floweyx" || rn === "room_floweybattle") return "FLOWEY";
    if (rn === "room_asrielroom_final") return "ASRIEL";
    if (rn === "room_fogroom") return "PAPYRUS";
    if (/^room_basement[45](_final)?$/.test(rn)) return "TORIEL";
    return null;
  }

  function parse() {
    var txt = findFile("file0");
    if (!txt) return null;
    var L = txt.replace(/\r/g, "").split("\n");
    /* [v1.7] file0 layout fixed to match scr_load exactly:
       12+16 header lines, item pairs 12..27, weapon 28, armor 29,
       flags 30..541, plot 542, menuchoice 543-545, song 546, room 547,
       time 548. (The old reader was shifted 4 lines and misread REAL
       game saves too, not just boss states.) */
    if (L.length < 549) return null;
    var fl = [];
    for (var i = 30; i < 542; i++) fl.push(+L[i] || 0);
    var info = {
      raw: txt,
      name: (L[0] || "?").slice(0, 12),
      lv: +L[1] || 0,
      maxhp: +L[2] || 0,
      at: +L[4] || 0,
      df: +L[6] || 0,
      xp: +L[9] || 0,
      gold: +L[10] || 0,
      kills: +L[11] || 0,
      weapon: +L[28] || 0,
      armor: +L[29] || 0,
      plot: +L[542] || 0,
      room: +L[547] || 0,
      time: +L[548] || 0,
      flags: fl
    };
    info.murderlv = murderlv(fl);
    info.route = info.kills === 0 ? "NEUTRAL" : (info.murderlv >= 1 ? "GENOCIDE" : "NEUTRAL");
    /* v2.1: a zero-kill file is NEUTRAL, not PACIFIST - true pacifist needs
       the whole friendship chain (dates, Undyne hangout, True Lab). Only
       the shipped ASRIEL state is a real PACIFIST save. */
    info.roomName = ROOMS[info.room] || ("room " + info.room);
    info.area = areaOf(info.roomName);
    info.boss = bossOf(info);
    info.hp = info.maxhp;
    return info;
  }

  window.UTSaveInfo = {
    parse: parse, murderlv: murderlv, areaOf: areaOf, bossOf: bossOf,
    decodeMirror: decodeMirror, findFile: findFile, ROOMS: ROOMS
  };
})();

/* [ut-bossstates:start] ========================================================

   BOSS STATES  -  skip straight to any fight
   ---------------------------------------------------------
   These are not backups. A boss state is a hand-crafted save file that
   drops you at the door of a boss with the stats, equipment, inventory
   and route flags the fight expects, exactly as the game's own scripts
   compute them (scr_levelup / scr_weaponeq / scr_armoreq / scr_murderlv):

     stats   maxhp = 16 + 4*lv, at = 8 + 2*lv, df = 9 + ceil(lv/4)
             (LV20 caps at 99)
     weapon  AT bonus goes into wstrength, armor DF bonus into adef
     EXP     the game's own LV thresholds, verified in scr_levelup's
             bytecode: LV11=1700, LV12=2500, LV13=3500, LV15=7000,
             LV19=50000, LV20=99999
     plot    the value that arms the fight trigger, verified against the
             trigger objects' own bytecode (all use strictly-greater-than
             "done" checks, so the arming value itself survives):
             Toriel 24, Papyrus 100, Undyne 121, Undyne the Undying 114
             (arms obj_monsterkidtrigger7: plot <= 119, murderlv >= 11,
             flag 27 == 0 - reached through room_water19/20),
             Mettaton EX 197 (mettboss_event: plot > 197 kills it),
             Mettaton NEO 160 (killerboysnightout_event in room_fire_turn:
             plot <= 163, murderlv >= 12), Asgore 208, Sans 200
             (lastsans_trigger: plot > 200 kills it, murderlv >= 16)
     flags   genocide states set exactly the murderlv chain the fight
             needs - nothing more, so no story flags are lied about

   Selecting one merges the three entries into undertale.sav (the JSON
   ds_map the game's savedata system uses), writes it through the SAME
   gameStorage client the runner uses (plus the localStorage mirror the
   menu reads), awaits the IndexedDB transaction, then reloads. CONTINUE
   then starts at the boss. Your previous file is NOT kept.

   Console: window.UTBossStates.load('sans')  -  returns a Promise.

   ======================================================== [ut-bossstates:end] */
(function () {
  "use strict";
  if (window.__utBossInit) return;
  window.__utBossInit = true;

  /* ---------- genocide flag chains (exact scr_murderlv port) ----------
     v2.0: kill counts raised to the natural genocide-route values a real
     save has at that point (Flowey's Time Machine's Sans preset uses the
     same numbers: 202=21, 203=17, 204=21, 205=44) - the murderlv chain
     thresholds are all still met, and any strictly-greater checks in the
     world see a truthful count. */
  var GEN_RUINS   = { 202: 21, 45: 4, 52: 1, 53: 1, 54: 1, 57: 2 };
  var GEN_SNOWDIN = { 203: 17, 67: 1, 81: 1, 252: 1 };
  var GEN_WATER   = { 204: 21 };
  var GEN_AFTER_UT   = { 251: 1, 350: 1 };          /* Undyne the Undying dead */
  var GEN_AFTER_NEO  = { 402: 1, 397: 1 };           /* royal guards + Muffet dead */
  var GEN_HOTLAND = { 205: 44 };                      /* 44 Hotland/Core kills   */
  var GEN_ENDGAME = { 205: 44, 425: 1, 27: 0 };     /* Hotland clear + corridor */

  function genFlags(chain) {
    var f = {};
    for (var i = 0; i < chain.length; i++) {
      var src = chain[i];
      for (var k in src) f[k] = src[k];
    }
    return f;
  }

  /* ---------- boss table (ids = save slots) ----------
     v2.1 inventory rules (user request: research the proper heals per
     fight, no impossible dupes):
       - Butterscotch Pie x1 max (one per run, from Toriel's kitchen)
       - Snowman Piece x1 max carried (the snowman refuses a second;
         he only re-gifts one if you LOST yours)
       - Instant Noodles x1 max (one fridge take in the MTT Resort
         restaurant; no shop sells them) - never before Mettaton EX
       - Cinnamon Bun / Nice Cream / Sea Tea / Crab Apple / Spider
         Donut & Cider / Monster Candy = shop-bought, multiples legit
         (candy bowl: genocide caps you at 3 pieces)
       - Legendary Hero / Starfait / Glamburger (Burger Emporium),
         Face Steak (emporium, 500G) - post-Hotland only
     Zero-kill states are labeled NEUTRAL (true pacifist needs the whole
     friendship chain - only the ASRIEL state is a real PACIFIST save). */
  var BOSSES = [
    { id: "toriel",   name: "TORIEL",               area: "RUINS EXIT",
      route: "NEUTRAL", lv: 1,  xp: 0,     kills: 0,   gold: 25,
      room: 42,  plot: 24,
      weapon: 13, armor: 12, wstrength: 3,  adef: 3,      /* Toy Knife + Faded Ribbon */
      items: [11, 1, 1, 7, 7, 10, 10, 1],    /* Butterscotch Pie, 2x Monster Candy (bowl), 2x Spider Donut (8G), 2x Spider Cider (18G), Monster Candy */
      phone: [206],                           /* Toriel's Phone - picked up at the flower patch */
      time: 900, sub: "RUINS - THE EXIT" },
    { id: "papyrus",  name: "PAPYRUS",              area: "SNOWDIN FOREST",
      route: "NEUTRAL", lv: 1,  xp: 0,     kills: 0,   gold: 60,
      room: 82,  plot: 100,
      weapon: 14, armor: 15, wstrength: 5,  adef: 7,     /* Tough Glove + Bandanna */
      items: [11, 16, 17, 21, 19, 1, 7, 10], /* Pie kept, 1x Snowman Piece, Nice Cream, Cinnamon Bun, Bisicle (Snowdin shop), Monster Candy, Spider Donut, Spider Cider */
      phone: [206],                           /* before the Papyrus date - his number not yet added */
      time: 1800, sub: "SNOWDIN - THE FOG" },
    { id: "undyne",   name: "UNDYNE",               area: "WATERFALL",
      route: "NEUTRAL", lv: 1,  xp: 0,     kills: 0,   gold: 120,
      room: 135, plot: 121,
      weapon: 25, armor: 24, wstrength: 7,  adef: 10,    /* Ballet Shoes + Old Tutu */
      items: [11, 16, 21, 41, 41, 37, 17, 1],/* Pie, Snowman Piece, Cinnamon Bun, 2x Sea Tea (Gerson), Crab Apple (Gerson), Nice Cream, Monster Candy */
      phone: [206, 210],                     /* Toriel's + Papyrus's numbers */
      time: 2400, sub: "WATERFALL - THE YARD" },
    { id: "undyneut", name: "UNDYNE THE UNDYING",   area: "WATERFALL",
      route: "GENOCIDE", lv: 11, xp: 1700,  kills: 56,  gold: 60,
      room: 132, plot: 114,                       /* room_water19 - the bridge  */
      flags: genFlags([GEN_RUINS, GEN_SNOWDIN, GEN_WATER]),
      weapon: 25, armor: 24, wstrength: 7,  adef: 10,
      items: [11, 16, 41, 41, 37, 1, 1, 7],   /* Pie kept, 1x Snowman Piece, 2x Sea Tea (Gerson stays in genocide), Crab Apple, 2x Monster Candy (bowl cap 3 in hellish world), Spider Donut */
      phone: [206],                           /* genocide: no friends, no upgrades */
      time: 3000, sub: "WATERFALL - THE BRIDGE" },
    { id: "mettatonex", name: "METTATON EX",        area: "THE CORE",
      route: "NEUTRAL", lv: 12, xp: 2500,  kills: 0,   gold: 240,  /* LV12 = 2500 xp */
      room: 212, plot: 197,                      /* room_fire_core_metttest - the stage */
      weapon: 47, armor: 46, wstrength: 10, adef: 11,   /* Burnt Pan + Stained Apron */
      items: [11, 16, 36, 43, 40, 42, 38, 21], /* Pie, Snowman Piece, Instant Noodles (the one restaurant-fridge take - first fight they can exist at), Legendary Hero, Glamburger, Starfait, Hot Dog...?, Cinnamon Bun */
      phone: [220],                           /* Alphys' upgrade: Dimensional Box A (contact apps replaced) */
      time: 3600, sub: "THE CORE - THE STAGE" },
    { id: "mettatonneo", name: "METTATON NEO",      area: "THE CORE",
      route: "GENOCIDE", lv: 15, xp: 7000,  kills: 97,  gold: 100,
      room: 212, plot: 160,   /* v2.0 fix: the SAME stage room the EX fight
                              uses - obj_mettboss_event's genocide branch
                              (murderlv >= 12, plot <= 197) transforms into
                              Mettaton NEO right there, exactly like the
                              real route (the old room 154 = room_fire_turn
                              was the Royal Guards mourning fight, which is
                              why you spawned 'at the two guards') */
      flags: genFlags([GEN_RUINS, GEN_SNOWDIN, GEN_WATER, GEN_AFTER_UT, GEN_AFTER_NEO, GEN_HOTLAND]),
      weapon: 47, armor: 46, wstrength: 10, adef: 11,
      items: [11, 16, 36, 43, 43, 41, 41, 40],/* Pie kept, 1x Snowman Piece, the one Instant Noodles take, 2x Legendary Hero (emporium open in genocide - burgerpants stayed), 2x Sea Tea, Glamburger (trash can find) */
      phone: [206],                           /* genocide: no friends, no upgrades */
      time: 3900, sub: "THE CORE - THE STAGE" },
    { id: "asgore",   name: "ASGORE",               area: "THE BARRIER",
      route: "NEUTRAL", lv: 12, xp: 2500,  kills: 0,   gold: 300,
      room: 238, plot: 208,
      weapon: 49, armor: 48, wstrength: 12, adef: 12,   /* Empty Gun AT12 + Cowboy Hat DF12 */
      items: [11, 16, 36, 43, 43, 61, 41, 21],/* Pie, Snowman Piece, the one Instant Noodles, 2x Legendary Hero, 1x Face Steak (500G - one is all a wallet survives), Sea Tea, Cinnamon Bun */
      phone: [220, 221],                     /* Dimensional Box A + B (post-EX-fight upgrade) */
      time: 4200, sub: "NEW HOME - THE BARRIER" },
    { id: "asriel",   name: "ASRIEL DREEMURR",      area: "THE TRUE FINALE",
      route: "PACIFIST", lv: 1,  xp: 0,     kills: 0,   gold: 300,  /* a real true-pacifist run: LV1 all game */
      room: 334, plot: 235,                      /* room_asrieltest - the Asriel fight room;
                                                 plot may need tuning to the trigger's
                                                 exact gate on first live test */
      weapon: 51, armor: 50, wstrength: 15, adef: 15,   /* Worn Dagger AT15 + Heart Locket DF15 - New Home's pacifist gear, the Determination set ("best i-frame set": locket + dagger is the strongest true-pacifist loadout) */
      items: [11, 16, 43, 61, 42, 21, 41, 17],/* Pie kept all game, Snowman Piece, Legendary Hero, Face Steak, Starfait, Cinnamon Bun, Sea Tea, Nice Cream - no Instant Noodles (they only heal 4 outside serious mode) */
      phone: [220, 221],                     /* Dimensional Box A + B */
      time: 6600, sub: "THE TRUE PACIFIST FINALE" },
    { id: "sans",     name: "SANS",                 area: "THE LAST CORRIDOR",
      route: "GENOCIDE", lv: 19, xp: 50000, kills: 109, gold: 120,  /* FTM's Sans preset values */
      room: 231, plot: 199,   /* v2.0: room_lastruins_corridor + plot 199 -
                              the same spawn Flowey's Time Machine uses.
                              Walk right: the corridor loads, the trigger
                              fires, Megalovania starts - exactly like the
                              real route (the old room 232 spawn landed
                              inside the trigger's mask). */
      flags: genFlags([GEN_RUINS, GEN_SNOWDIN, GEN_WATER, GEN_AFTER_UT, GEN_AFTER_NEO, GEN_HOTLAND, GEN_ENDGAME]),
      weapon: 52, armor: 53, wstrength: 99, adef: 99,   /* Real Knife + The Locket */
      items: [11, 16, 36, 43, 61, 41, 41, 37],/* Pie kept, 1x Snowman Piece, the one Instant Noodles (90 HP in serious mode), Legendary Hero, Face Steak, 2x Sea Tea, Crab Apple */
      phone: [206],                           /* genocide: no friends, no upgrades */
      time: 4800, sub: "NEW HOME - THE JUDGMENT HALL" }
  ];

  /* ---------- stat formulas (ported from scr_levelup) ---------- */
  function statsFor(lv) {
    var maxhp = 16 + 4 * lv, at = 8 + 2 * lv, df = 9 + Math.ceil(lv / 4);
    if (lv >= 20) { maxhp = at = df = 99; }
    return { maxhp: maxhp, at: at, df: df };
  }

  /* ---------- file0 builder: the 549-line save ---------- */
  /* Layout MUST match scr_load exactly (bytecode-verified against game.unx):
     0-11 name,lv,maxhp,maxen,at,wstrength,df,adef,sp,xp,gold,kills
     12-27 item[i],phone[i] interleaved (i = 0..7)
     28 weapon, 29 armor, 30-541 flag[0..511], 542 plot,
     543-545 menuchoice[0..2], 546 currentsong, 547 currentroom, 548 time.
     The game reads line 547 as the room; a shift here makes scr_dogcheck
     see room 0 (< room_area1) and dump you in room_of_dog.
     keep (optional): { boxA: [8 ids], boxB: [8 ids] } - the dimensional
     boxes, flag 300..307 / 312..319 (obj_itemswapper's own layout, box A
     at 300, box B at 312 when boxtype == 1). */
  function buildFile0(b, name, keep) {
    var st = statsFor(b.lv);
    var L = [];
    L[0] = name || "FRISK";
    L[1] = b.lv;
    L[2] = st.maxhp;
    L[3] = 0;              /* maxen */
    L[4] = st.at;
    L[5] = b.wstrength;
    L[6] = st.df;
    L[7] = b.adef;
    L[8] = 0;              /* sp */
    L[9] = b.xp;
    L[10] = b.gold;
    L[11] = b.kills;
    /* 12..27: item[i], phone[i] interleaved (i = 0..7). phone[] holds the
       CELL menu apps - ids from the game's own phonename table
       (lang_en.json): 206 "Toriel's Phone" (picked up with the phone in the
       Ruins), 210 "Papyrus's Phone" (after his Snowdin date), 220/221
       "Dimensional Box A/B" (Alphys' upgrades replace the phone, dropping
       the old contact apps - exactly like the real routes). v2.0: a boss
       state used to ship phone[] = all 0 - a save the real game can never
       produce, because the CELL button only unlocks once you own the phone,
       and owning the phone means at least app 206. With menuchoice forced
       to 1,1,1 (v1.9) the CELL button was visible over an empty app list:
       the one menu that was still broken. */
    for (var i = 0; i <= 7; i++) {
      L[12 + 2 * i] = (b.items && b.items[i]) || 0;
      L[13 + 2 * i] = (b.phone && b.phone[i]) || 0;
    }
    L[28] = b.weapon;
    L[29] = b.armor;
    /* 30..541: flags (0..511) */
    for (var f = 0; f <= 511; f++) L[30 + f] = 0;
    if (b.flags) for (var k in b.flags) L[30 + Number(k)] = b.flags[k];
    /* dimensional boxes: flag 300..307 (A) and 312..319 (B) */
    var boxA = (keep && keep.boxA) || [];
    var boxB = (keep && keep.boxB) || [];
    for (var s = 0; s < 8; s++) {
      L[30 + 300 + s] = boxA[s] || 0;
      L[30 + 312 + s] = boxB[s] || 0;
    }
    L[542] = b.plot;
    /* v1.9: menuchoice[0..2] gate the ITEM/STAT/CELL buttons in the actual
       game menu (obj_overworldcontroller_Draw only draws a button when its
       menuchoice slot == 1). Every built state had 0,0,0 there, so loading
       a boss state gave you a menu with an invisible button row - you
       could move the SOUL between three buttons you could not see, and
       never reach the ITEM or STAT pages. Every state we ship sits past
       the phone pickup, so all three buttons are unlocked: 1,1,1. */
    L[543] = 1; L[544] = 1; L[545] = 1;
    L[546] = 0;                           /* currentsong */
    L[547] = b.room;
    L[548] = b.time;
    var out = "";
    for (var n = 0; n <= 548; n++) out += (L[n] === undefined ? 0 : L[n]) + "\n";
    return out;
  }

  /* ---------- undertale.ini builder (GameMaker ini format) ---------- */
  function buildIni(b, name, existing) {
    var st = {};
    /* keep any sections the game wrote that we do not manage */
    var section = null;
    var lines = existing ? existing.replace(/\r/g, "").split("\n") : [];
    for (var i = 0; i < lines.length; i++) {
      var m = /^\[(.+)\]\s*$/.exec(lines[i]);
      if (m) { section = m[1]; continue; }
      if (!section || section === "General" || section === "Toriel" ||
          section === "Papyrus" || section === "Undyne") continue;
      (st[section] = st[section] || []).push(lines[i]);
    }
    var out = "";
    out += "[General]\n";
    out += "Name=" + (name || "FRISK") + "\n";
    out += "Love=" + b.lv + "\n";
    out += "Time=" + b.time + "\n";
    out += "Kills=" + b.kills + "\n";
    out += "Room=" + b.room + "\n";
    out += "\n";
    out += "[Toriel]\nTK=" + (b.route === "GENOCIDE" ? 1 : 0) + "\nTS=0\n\n";
    out += "[Papyrus]\nPD=0\n\n";
    out += "[Undyne]\nUD=0\n\n";
    for (var s in st) {
      out += "[" + s + "]\n";
      out += st[s].join("\n");
      out += "\n\n";
    }
    return out;
  }

  /* ---------- writers: mirror + GameMaker file system ---------- */
  function textToB64(text) {
    try { return btoa(unescape(encodeURIComponent(text))); }
    catch (e) {
      var s = "", arr = new TextEncoder().encode(text);
      for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
      return btoa(s);
    }
  }

  function encodeMirror(text, tsMs) {
    return 'OBJ:{"contents":"AB:' + textToB64(text) + '","mode":"JS:33206","timestamp":"DATE:' + tsMs + '"}';
  }

  function idbPut(key, text, tsMs) {
    /* v1.6: write through window.oprt.gameStorage - the SAME client the
       runner uses for its own saves - so there is exactly one writer with
       one node format for /_savedata. (The raw indexedDB.open fallback
       remains for exotic embeds without the polyfill.) */
    var bytes;
    try { bytes = new TextEncoder().encode(text); }
    catch (e) {
      var s = unescape(encodeURIComponent(text));
      var arr = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
      bytes = arr;
    }
    var node = { timestamp: new Date(tsMs || Date.now()), mode: 33206, contents: bytes };
    if (window.oprt && window.oprt.gameStorage) {
      var st = window.oprt.gameStorage.open("/_savedata");
      return Promise.resolve(st.put(node, key)).then(function () { return true; },
        function () { return rawPut(node, key); });
    }
    return rawPut(node, key);
  }

  function rawPut(node, key) {
    return new Promise(function (resolve) {
      var req;
      try { req = indexedDB.open("/_savedata"); }
      catch (e) { resolve(false); return; }
      req.onsuccess = function (e) {
        try {
          var db = e.target.result;
          var tx = db.transaction(["FILE_DATA"], "readwrite");
          tx.objectStore("FILE_DATA").put(node, key);
          tx.oncomplete = function () { resolve(true); db.close(); };
          tx.onerror = function () { resolve(false); db.close(); };
        } catch (er) { resolve(false); }
      };
      req.onerror = function () { resolve(false); };
    });
  }

  function writeGameFile(name, text, tsMs) {
    var mirrorKey = "ut/_savedata/" + name;
    try {
      localStorage.setItem(mirrorKey, encodeMirror(text, tsMs));
      try { localStorage.setItem(mirrorKey + "::ts", String(tsMs)); } catch (e2) {}
    } catch (e) {}
    return idbPut("/_savedata/" + name, text, tsMs);
  }

  /* ---------- the real save file: undertale.sav ----------
     The HTML5 port does not keep file0/undertale.ini as disk files. Every
     game file lives inside ONE buffer, undertale.sav, holding a JSON
     object that the game json_decodes into its savedata ds_map:

       { "file0": "<549 lines>", "file9": "...", "undertale.ini": "..." }

     obj_time loads it with buffer_load_async at boot; scr_save writes it
     with buffer_save_async. The buffer format is the JSON text plus a
     trailing NUL (buffer_string). Boss states merge their three entries
     into any existing map (config.ini and other files are preserved). */
  function readSavedataMap() {
    /* v1.8: the DB is the source of truth - the localStorage mirror can be
       up to 10s stale (the mirror scheduler), and merging boss states on
       top of a stale map could resurrect old file0/ini entries mid-write.
       Read the live record through the same gameStorage client the
       runner uses; fall back to the mirror only if that fails. */
    function fromMirror() {
      var txt = window.UTSaveInfo ? window.UTSaveInfo.findFile("undertale.sav") : null;
      if (typeof txt === "string" && txt.charAt(0) === "{") {
        var json = txt.charCodeAt(txt.length - 1) === 0 ? txt.slice(0, -1) : txt;
        try {
          var m = JSON.parse(json);
          if (m && typeof m === "object") return m;
        } catch (e) {}
      }
      return null;
    }
    if (window.oprt && window.oprt.gameStorage) {
      var st = window.oprt.gameStorage.open("/_savedata");
      return Promise.resolve(st.get("undertale.sav")).then(function (node) {
        var txt = null;
        try {
          if (node && node.contents) {
            var c = node.contents;
            txt = typeof c === "string" ? c : new TextDecoder("utf-8").decode(c);
          }
        } catch (e) { txt = null; }
        if (typeof txt === "string" && txt.charAt(0) === "{") {
          var json = txt.charCodeAt(txt.length - 1) === 0 ? txt.slice(0, -1) : txt;
          try {
            var m2 = JSON.parse(json);
            if (m2 && typeof m2 === "object") return m2;
          } catch (e2) {}
        }
        return fromMirror() || {};
      }, function () {
        return fromMirror() || {};
      });
    }
    return Promise.resolve(fromMirror() || {});
  }

  function buildSavedata(entries) {
    return Promise.resolve(readSavedataMap()).then(function (map) {
      for (var k in entries) map[k] = entries[k];
      return JSON.stringify(map);
    });
  }

  function player() {
    if (window.UTSaveInfo) {
      try {
        var info = window.UTSaveInfo.parse();
        if (info && info.name) return info.name;
      } catch (e) {}
    }
    return null;
  }

  /* v1.8: the old gear is not lost - it goes to the dimensional box.
     Boxes are flag 300..307 (A) / 312..319 (B) in file0's flag region
     (obj_itemswapper reads exactly these slots), 8 items each. */
  function stashOldGear(b) {
    var txt = window.UTSaveInfo ? window.UTSaveInfo.findFile("file0") : null;
    if (typeof txt !== "string") return null;
    var L = txt.replace(/\r/g, "").split("\n");
    if (L.length < 549) return null;
    var oldW = +L[28] || 0, oldA = +L[29] || 0;
    var boxA = [], boxB = [];
    for (var i = 0; i < 8; i++) {
      boxA.push(+L[30 + 300 + i] || 0);
      boxB.push(+L[30 + 312 + i] || 0);
    }
    /* what deserves a slot: real gear that the state does not hand you
       anyway (no point duplicating what you are about to equip) */
    var stash = [];
    if (oldW > 0 && oldW !== b.weapon) stash.push(oldW);
    if (oldA > 0 && oldA !== b.armor) stash.push(oldA);
    if (!stash.length) {
      /* nothing new to store, but keep whatever the boxes already hold */
      var had = boxA.some(function (v) { return v > 0; }) ||
                boxB.some(function (v) { return v > 0; });
      return had ? { boxA: boxA, boxB: boxB } : null;
    }
    var all = boxA.concat(boxB);
    for (var s = 0; s < stash.length; s++) {
      var slot = all.indexOf(0);
      if (slot < 0) {
        console.log("[UTBossStates] both boxes full - could not stash item " + stash[s]);
        break;
      }
      all[slot] = stash[s];
    }
    return { boxA: all.slice(0, 8), boxB: all.slice(8, 16) };
  }

  function load(bossId) {
    var b = null;
    for (var i = 0; i < BOSSES.length; i++) if (BOSSES[i].id === bossId) b = BOSSES[i];
    if (!b) return Promise.reject(new Error("no such boss state: " + bossId));
    var name = player() || "FRISK";
    var existingIni = window.UTSaveInfo ? window.UTSaveInfo.findFile("undertale.ini") : null;
    var keep = stashOldGear(b);
    var file0 = buildFile0(b, name, keep);
    var ini = buildIni(b, name, typeof existingIni === "string" ? existingIni : null);
    return buildSavedata({
      "file0": file0,
      "file9": file0,               /* temp-save: CONTINUE after death */
      "undertale.ini": ini
    }).then(function (savJson) {
      /* v1.9: DEFERRED WRITE. Writing while the runner is live loses a
         race with its own teardown: as the page unloads, the runner's
         syncfs can flush the OLD in-memory savedata back over the fresh
         records - and you boot straight back into the previous save
         (that is what made boss states "not take" when picked from the
         in-game pause menu). Instead: build the three finished texts
         NOW, stash them in sessionStorage, reload, and let index.html's
         inline module (runs at page parse, before the runner mounts)
         write them. The dying page can not clobber what it never races. */
      var stashed = false;
      try {
        sessionStorage.setItem("utBossWrite", JSON.stringify({
          label: b.name, file0: file0, ini: ini, sav: savJson
        }));
        stashed = true;
      } catch (eStash) { stashed = false; }
      if (stashed) {
        console.log("[UTBossStates] " + b.name + " state built - reloading to write it safely");
        setTimeout(function () { window.location.reload(); }, 150);
        return { boss: b, name: name, deferred: true };
      }
      /* sessionStorage unavailable (rare embeds): old immediate write */
      var ts = Date.now();
      var jobs = [
        writeGameFile("undertale.sav", savJson + "\u0000", ts),
        writeGameFile("file0", file0, ts),       /* kept as real files too, harmless */
        writeGameFile("undertale.ini", ini, ts)
      ];
      return Promise.all(jobs).then(function (ok) {
        console.log("[UTBossStates] wrote " + b.name + " state (undertale.sav + file0/ini) - reload and CONTINUE");
        return { boss: b, name: name, wrote: ok };
      });
    });
  }

  window.UTBossStates = {
    list: BOSSES, load: load, buildFile0: buildFile0, buildIni: buildIni,
    stashOldGear: stashOldGear
  };
})();

/* [ut-pausemenu:start] ==========================================================

   PAUSE MENU  -  drawn with the game's own assets (v1.6)
   ---------------------------------------------------------
   Esc pauses the engine for real (GM_pause) and renders this menu on a
   640x480 canvas overlay pinned exactly on top of the game canvas, so it
   shares the game's pixel grid and scale.

   TEXT: real in-game font. fnt_maintext (Determination Mono) was extracted
   from game.unx itself (FONT chunk + its texture atlas) and is embedded
   below as UTFONT; glyphs are tinted per color and blitted from the atlas,
   exactly like GameMaker blits them. The SOUL cursor is the game's heart.

     RESUME       back to the game
     BOSS STATES  skip straight to any fight: TORIEL, PAPYRUS, UNDYNE,
                  UNDYNE THE UNDYING, METTATON EX, METTATON NEO, ASGORE,
                  SANS. Each state is a crafted save - right stats, gear,
                  inventory and route flags - written through the same
                  gameStorage the runner uses, then the page reloads and
                  CONTINUE starts at the fight.
     FULLSCREEN   same as F4
     QUIT         back to the loading screen

   Keyboard: arrows (or WASD) select, Z/ENTER confirm, X/ESC back. Mouse
   works too. While open, game keys are swallowed. GX Mobile's pause()
   opens the same menu.

   (v1.6: MY BACKUPS / save-state snapshots were removed - the game's own
   saves now persist reliably, which is what they were papering over.)

   ========================================================== [ut-pausemenu:end] */
(function () {
  "use strict";
  if (window.__utMenuInit) return;
  window.__utMenuInit = true;

/* REAL GAME FONT (fnt_maintext / Determination Mono, extracted from game.unx) */
/* Real in-game font: fnt_maintext (Determination Mono) extracted from
   game.unx (FONT chunk + its texture atlas). Glyphs are pre-positioned:
   draw each at the line top, advance by shift. */
var UTFONT = {
  src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAqs0lEQVR4nO1dDXLcvA7LjXsEHeEdWW/axg4FASRle6P0W2JG07X4B1IUd5M26Ufv/aPW+67Cm2N3A9aqAVDYiN0NWKsGQGEjdjdgrRoAhY3Y3YC1ltaBGgCFZ/AvNWut52taeHP8Q83K/GX3PF93eXbHh/J7JR5iVV4DoDDjRuN/92KNjXuZ108OgMhPdm8199XnGgAFDtFonTRRtsmUfdZ/ZPsBf6IPfJ3h4HHJ5BpddtRhsZ688IpvDYDCiBc22dNNbJ+70FF6dy4uwht4mYGKuoyvp3Ol1jUAChwLTfR0U9557kIH42e4MR/ZWF3sX73c2Vge3xoAhTwWmmi1ye7685670MHL78k9nUws5iPK4YnB9sTZ1AAo/MWNpnq6STP+7Z6K3+FP9lrh6gDIXvarA+Ducw2AAscLm+wVTWz3lDx6nfVj5a8cAKt8agAUnoNotC6aKJJnG53ZZ3zb/Si+pxP5Wd1Tvq74jjhfldcAKMxwmiNqpKflS437putuzWsAFEYsXMi7zzUAXj8ArE6qloU3h9M8rIHuymsA/LBVeHPsbsBaNQAKG7G7AWvVAChsxO4GrFUDoLARuxuwVg2AwkbsbsBaNQAKG7G7AWvVAChsxIWmOXBVP/uMeIpfFP+76uHldlee1dndfoXd+MaGX72Aq3F2DIB+wX61HqvPSzkV3hyLzbnaYJG95ycj85o/I48u0BUOP+25BkBBY6Gxf8oAWL0A6rkHco/HHfsr8VZqvGRfeHOQxlFYHQKvkkcNv/LM8rv7HA04hmi4oI4ni/zXACh8IWgsr3nuyDMxosb/rgFw9R33Vfzv+qsBUPjCxea+2vw/bQDcefZyyMh2PdcAKHxBNUZyqebymi7boNn9737+aXxu8S+8OZzGvjoE3IZbaFgE8+HJ7lwQz/9TA8Dz/2p5DYDCXwTN/YoBUOsHrcKbY3cD1qoBUNiI3Q1YqwZAYSN2N2CtGgCFjdjdgLVqABQ2YncD1qoBUNiI3Q1YqwZAYSOgIRBXmkrZKjwdH/1csfHsI7/KPvIfPUf1yXCvAVAYsdiAdwZApPfd8Z+62FcH4d16rD7XACjMuNBQncgy73BPDICMbyW7Eu/JAbeyz3SY/HY+hTfHQgNlGyzTeFGD3xkYiBoANQAKCgsNlG2wTONFDX5lAKzuq+dOZN85ALLyq/xrABS+cKHB7g6Au3ZRk3t+ItsneD4xoJgO8kad6LkGQGHGQgNlGyxqvKzdpYYO9BAr8e/yrwFQ+HlYaKC7Df70APju+Lvt7z7XACjMeFGDdUeetfNsMz5WB0DkX+Epfri/6j9jXwOgMCJqkFr/7VV4c+xuwFo1AAobsbsBa9UAKGzE7gasVQOgsBG7G7BWDYDCRuxuwH9wHdjNowZA4T6cxr7S6IgVOcMKvyj2XX6vHgAZv0/wrwFQ+ILTgKuNHtm/+nl1/6r/V60o3kv4F94ciw2EeKcBgFD+Pb0VmZLXACg8hwcbbPfzUuP/QP8rz53Ir3Dc3X6F3SBNg3jyAnn+o9gZ/9nmj2w9H1f9R3ZRfvbZ45jhVwOg8BcLDZi9wE81/FX9VT/f5T8aMFF8+6x81AAorOFiA155/gkDYEX2tP/VeFk+t1bhzfFgQ640LJNFDZ71v7r/U/yvPmfj1AAoaCw2HIMnV83pyTLNneXWF+Q/0X+Uv6dTA6AQI9sotf6bq/Dm2N2AtWoAFDZidwPWqgFQ2IjdDVirBkBhI3Y3YK0aAIWN2N2AtWoAFDbCNAMDk999VjEiOdPx+N1dq/4i/Ux+kf+M7yWdwpvDaeBXP1+9QFf97x4A36GvdKRt4c3hNMmrn797AGT0GTKyJ/P17B73WXhzLDTw089PNferBsgr870qu2orbQpvjocbHOHJVuVZ/z9hAHhcsrld8bE6iHa3X2E3FhvnTnO6jZiQ32r0hP7q88pwWslxNY9btS+8ORYb/k6T32nsJy/oqwdAVLvVwfZEDaVd4c1xoeEfb8KL8izfHQPgiv2dwVADoHANpEm61zAXLsKqncdhRZbVycqZ/pUB4MWPLnemdks6hTfHQgPW+g+uwptjdwPWqgFQ2IjdDVirBkBhI3Y3YK0aAIWN2N2AtWoAFDZidwP+Q+vAq/RrABS+H0EDb2/QxcuGl05dQqWv7CL9Ff92L+tvtQ5R/jUACn+RbKR/ZUUXLpOfp5+pC+p4zxl/NQAKr0PyAvwrS3HPXoxoP1MbZa+eM7zuyF2+hTfHYoPdvZi98zgKP2UAPFkb5HH3gkd5unwKb44XNLjXlB2erwwQz0d2f9X+lfV5Va1Tq/Dm+CFNrvDUBcD9rN5PqE0NgMLr8I82+o4B8C+sZf6FN8dTjfRDFuOd3fsJwwFj3H2uAVDwETTj7gu9enGyF0LpXx0aNQAK/yZe3NC1rg0B7/nRVXhz/ICGr7Xp8vcaAIWFxrTYfVFq1QAoPIHdDVirBkBhI3Y3YK0aAIWN2N2AtWoAFDZidwPWqgFQ2IjdDVirBkBhI0wzHNjelLVqABS+CdAQB7Y3Zq0aAIVvwO4GrFUDoLARuxuwVg2AwkbsbsBaNQAKG7G7AWvVAChsxO4GrFUDoLARuxuwVg2AwkbsbsBaNQAKG7G7AWvVAChsxO4GrFUDoLARuxuwVg2AwkbsbsBaNQAKG7G7AWvVAChsxO4GrFUDoLARuxuwVg2AwkbsbsBaNQAKG7G7AWvVAChsxO4GrFUDoLARuxuwVg2AwkbsbsBaNQAKG7G7AWvVAChsxO4GrFUDoLARuxuwVg2AwkbsbsBaNQAKG7G7AWvVACgUCoVCoVAo/Eh8fmT8jfbNcQ8sfWy1dmZvxZ7qrn50Fj4a42ZlGA90z3OwMnY+8JHf9W1q1h0fMk8m93rmkGV8ZmKDTcM8wOY4gylf9I0xSA6d8c0giu9xUntY89WelUH7iG8ZBBAznQw73Ky915i2sTy5aRzWIKjDZL8wb6N71h9sp3OxuYi41hcrG21srKPxTeMLm4NbM68HnmRZWQc7peed05isrp0abqcLiHtyE2ePmM5R5I/yKQVlfwuM8KLt5YHBCrliB8UJfRi7hj6OPZVX5w2qBgA7KCs7zYkc8xnsjMzGsNy8AWDznXiC70N2+MZ3nikXqLOFx/PqABiDzud0qlg77B9HTu0xtCM/lYzOEJf0rpVj/OsDQClCoJ52OB70lBCLTZIeK3kTGe7sgMxBHgc4Fd+R2+E1+YWDo7F7cLiMLNFvVoXI0QW9pE4uVt6YjPDw5KsDQPp1OB3w/E9yUht2Hq3PA8DKf1k9wc/aR/yZ/PCduhwDaXJxTqexN+63jwVkRfeSbUQ+fa3jFGiKBzwxZuu6IRgvKReXBj8eIn43yP+QN2moZvQPqP2MvPVxCDcjw1pb2R++Ti1VnU/brvtBXdAmuHSj58X18hm4J+XTOTnnhfcLfTewR3lqgNg40SX9sprloY7wOxTDkLRFa9an0BsS6n5TImwsr4ka2pjaZC64lAcc2bsDkw2+4Fza52IXCS+4NzgYn3ORZqY6pLfS3wjsc89khrdbPxKzWz/E7kD4iYdwjHQ8+Zkf6E61gVwGeSfn4IIlDfLWZzSwbxgYE0JdSFQ1iXpXaMRPdGFYHraA7qDr4tIQnuxSsdgtIfMuxWHHLuhpg2cRPbMF55G6/La3PBn4V7lmBgDWEblPcnHurE8jOfoeOCTkqn/sEKJykwfGOPmFQENHdgYH+RHMvj4I4QDAr1O71UPSfW7W0Ug3gtcAzSzvkNigO/R+kVwmOfHtfXxDmZXbvWFf1cCpoXzufb7w6tnZszkhx1BG8nnZAGA1Onix+NALKja1deTsgisfkVzmSMEMvaL1sVDNmgAxq8eKjL6HhAyHU2aeqU2HwyONMsSEBkKfNmd1wfFj4iQnuQ8UGC/FjZzdtG/9ieb+jgGAwEE6yBQPKyecowukBsAv68eTe/49DoeM6JxyrB/WIiMH37aeB9f4e3adQ333NDMAmB474GbinMlZfSVD32Qf42KRvDyPWDTPZF4DN6fOihfmdvjEbx4O+0Z25iMuVlbOBkDrZpPoNPSLMhUDbKMBYGWqVydeVg734JCfgxvWICcX8OR0yIjOKcf62XxQjvmiDPpLxpogimYLa+XNkXsHfCr0r+nELgfbt/4y09DilBM+mTxZLhNXwlPlYvdR58+zqgXkRvfFueKAUwNFydlzs/GiZ8Er6kc2DDwO7PyHC2Jqy0o21KTPNZ7kEPfSACCyX+jD+KFyyG3qN1pokvSRWLOOQG4JMHkzCw/E7qnCYlGatSWNgDaWO4tp/bXDmPnE2H3G6Zs01sQZdNThMs5syAy+7T40Vu+jf/TtyQ+fLGcqYz3l9VvQj78cv9PXwKJv8ILQfgMZQp3TJLf2cO5U7nA+887IoX40jkQfD5NOH5D1zhuJFWM6DMuJ6Zh9y4sWkciwSKh3yL08m4ht7aZ8mNz6JrU+dZTMyo3ewRHreObjNR3hTeWs2Uk8yjchn/w6cpb/5FOcYyh3enHwYbhJ+U37ZmqBcHub5Hb6nxqINBQNKBrJkrA6rfd5GhN7NrEOn82LRfbVX7U10BsK0edip4aWWRNXr/mIzpRvVAtyASZZR0XCSZzpIAefikPmXG1fsVwnmanT5RoZv4qnlLP62Xyd+iL/fpyHxwH8tC56N5KTsz73UwDjyVAVk8mjGGT/SEZdGHY5j0LQIijuXi4rOa7IszpPxPLOLXseGdsV/0rnijx5hv3oD6F7ylfie1jRWc01kW+6piHuJHsp4AO+M4XJ+LtjuyJf1cnkHflZ2b/C8ZW4Wwc1PDzbK7306jqsxPtuTj8Gb5t44SX4KUPwW3B8NNrNYwdemXs33294ta9ucEX+EMeX+v/piPJX8qs9+FjvWkc7m6Sbb3Bk5d7FyFxAr4jZAqs4dwcAnMvgizwPFzySqzgOj+mfgTPfKE/6bursifylw9r6x7xYfa/KWY4XOId2PdOD1pFDculrD6WL/j9tEI3ZoPzTViZoDmE6YHZAXl2cXBpyMDUIiw88WN4vHQC4h3TB5+TC7P0CXXa2qoYIVy7qGPVnY7n2r7Oa/AturY/9RPldlYvY2BdoO/Wo4XrozvWJSHoF7mPx0E8kx4aiyShuEKMxvhA3NQAOeR+bogEX5NeQQ4e8sWYoH5Lihzg1MPGNtZFyEtvmxLhhDSY54fdB9KY3ic7PIVUj8MN8Kz+TDQthcsNeGuoL9tPARv9O/6neH86H2LJ/23JwH3irCzIEO5IGXbWUD0+OA2D6l19Czt5lmrUV3Bq8RvnUIOQQBpmSswNHlcB/i+TO2Z3+HflkD8/qwhzPjfiPzsHasUv6G8e/wf8f0Rn4E98d9pic/kOuPqOBjNWbDYQvIdQT5EN97KD5ABAOwyU2fJGbzIsFQKJykpI15A17GblsElKM31C/MHMMNDfXVAiSO8oPGf3xy+gCC9kpJzllf6sPXhoWOyNXDa7O5I+c1HaSgw7zO/Wf02tYByY7eYjYB+xvLlJDUsUd4gjZH7no17/OIU/oI/pOD5ddDZSDr+p7eqlYEZrVJTqMhDpwljQSHfbEpEOfDewn/guyZl/faEz2T4Gb3YB4aI952tfqgNuNZzUAlE1aLs77tBO9NXBjcnIWvyH/CTaTgw6VQ9zpF8A4Fxw/wstfuWb8T75J7qrWLCbre/oJOyTCZDYIITxcHAaUKxv7CIVQDTLImYzw7Z0MABXT8d1hT/mw8Q6Z/flyq4+26Pv0hc+YD4nt+Y/iZ+VPXBIp76ZnTOxpgMPr6Xwje6dvLRfWPywX+3zEHOrSeT1p7oSDspV/g2MnRbOFII4y03wqhIiHX+s3JGf99/EwUedMjBSiMzvmE3mxmN0vsrqkUwxizz7GIb+hRtaX15DOM/VP+F2V25g2V/w+CZVDToPc2mIfmPjna+xz7ENh34ALPjN7jEefyUIZ5ou5W3nr+iwmG3UhrfGZGF5Glii7jFY/iEWb28ZkxWeXlNieNoJL63NzsQEw/AYYkutZD+Sjagu6Z1zlywbCBkQ/JJaSW/+sYaW88/raPNSF6cammUdX3ud6f4BvrOeH+XOSm3hqoMv697ke1q5BPpMc7pMF2tp9xQ2fm/FLv6eEd4gV4iSKl7HDoZDLYklMF5jJGblITuLifmYAsENgX/6wn01HO/aLQpuQH/lbOTYNi4/+qazrJlDxXzUAzmfkS3Jdkvc+9JbsT6KDnFHH2h+v1a9WV7KWlDcmwwFAeukDdFjv2NhDPLxDWITOlIDwecjksrTuH0yD/WU58FL71CfLG4o1FUxgGhzWHg+R2YtDO3yz+PhXoFQm+HkDqvU+XxwmZ5cJ5TAA8BukH8B/SW72p8stzpb1YkqnO/U3+TFZVt4gp06e2SdD7H2vl5DP/KU5MZiUkOBhpwqe2etz4ZEwHU6mSMxuoCkF2n76CNv1xzgrZxes477Rx1oMMvBvfeBFYHIcQEo+5e7w6mDH6oufkPASnbmRGg/xjc4gx/jsOdKxf3o6/Ub9oXaq/jY3tD1kOCi8AdX7fG6/rN4HAxjME8Iki3aZoqu9DgfRxwvFDmWQO4VonoxwaVYGMXsnXEW+R8Hxf/RpXXO39T9lcC72fLBBPd9STpq8gy3WXH1sHuyFzuCf1H+Kz3oz6qlM36kedHR6JxxN7kN9SV8NchsPakOHm43DuPcR7M1r6K8PBEs6o6N0vUNAOYsZPT/JQemoZ9SN8lM8vXpeWRk/LNdsXk9wfAVndYZRz0Q66pye1LmKK+el8qXkmFJ0ABmSnlz5uipjcVa5eg2UqYWX48pFiORPXaYVX9/F8e6y55jV8c460sHe8XTuINOH6V59oiFYUJV0Rscl/AJkc3l6KQ6rXKyOssF9lvdqIz2R/xWdKJds7TI5ruhk+uoJZDikeRqF1v/iTnP1Lr7jLmKGOlkcsVdlGXkQ9/LFFnp/zoHJ7/CCfRoD7GlN4IybfVacn2jUTD88rfNUDz89AF6CTFMkfPQ7Pm5exGgAsEv1G/SfSPYRDWRurfr4jbGletz1nYmdOWuR9+D3ao53caVX7/TWXajY2bM2PrBHb9kvkcnANF+60EskfT8yrr0UzIbl7jV3tvBX8rnrG+RhPRydSYY2Kzl2jeVLGdXIiV8DwCGYPkxhfzbFou1EkvlIJOs2Fds/9pTv6OC8eBn7RB7yPBJxKbekb1WPZv1F+Ud5ZW2FryW7GzYv46vqzOTsvHrQh0SeGgDHRWZfz/ZO/o7e7DfPD9s3NvInxlixkB9LEm1Ecahe0naICblmY6tzkLXAWkJNKDcjH3wKHcld1aj33Ne7Hc7b0Yvyk1xIrKmeifQuD2Mnbg/kLWOv4hBe6IcPrz43TuukmW0sWJIv+LFJyoZlOXn87GGJArBhZmWN2Fqwd72Dx2lLcp3sPV4sf8yrk5qBzNanRbagP/ggPSIvuSdz4rPBFl7yg69XUydXlq/kreoBOoM8EVfKI3uIOe17cpqnCEbfzZQO2W/4mpBihzT9u3DGkyVjEzXyBv56nw+BXZQpX1VYyC/zLjzJ+nhA6C/kBvYWw7sskaMtrSXk5g0AyU3oTH5s/C7Ov/fhAtOYndQOfXv1IDULP14L20PPxmRnLWMwuRdXyTs7O5LIQNRLts8FPPYO/ZVp2MxrbwBMzdjJIQWx1eAZigdxp0uKr1nDEHuPk63n1ATkYJFrdJ6HbPqbD6JzckYdBhGb+Whsn+QX9miiN9vg6CMeAKQezMYd8uADOaUGAMSYOIh+YBxcORIdmpQUuPWZzG+s/Mgj/RFFocOG0NUBoC5u6yRfVhuINfkktVP2U2zhO3MWGM/qsE8mNqb83oWV46Vwemi6VESvMRHGFZyGWorzwtpMH80J38GHyEcNrKbknZ+Xzeu0Qx+YK/oQNYs+pZx1Y4laMochOvH+e2wMpt511ACIfrnlX6ec9yAnsdVz7zz31kXxbExSK2vvDYBubBp5jRzZp4dmbUzep45o5qmexz5coKZ8kEZX/tVH04Z+IDfGKxqmk38nRjgAvJiHzMTzco1+oSwdACQX+3qoFdaLyUl6bpIDGbPXQY8Vd0jU7KvfbJuVZ2Uot3zOvIDjyVvkKy9Y102lho43ADCHdsQhl4T9+PHEm8Q+fOCPBWPTWb0pP9FDU37iUjTHD+bs9el5xtFZqNgsJqn1WEzSC73HX78DJ8xz8EFysT5sXO/T8iCngADUAILSRiAkvQveQG6nIJMr+3YQ7SOQA146eUEhFza9vxzNxcaaHjKWzxHTym1M9luIrC3LN5IP+ZIeOGXgy9pHQ8D6QJ1BhjrMnsjPmqCOx/VIRNg1IpO1hFy8c2oOL7vH6uLKWSy7T+pJv4RRCbc+F34IRIioS9aMzV+hiQtcWKEsL3w3srJjH+OrwUJzIrmgP+RhOWTsZT6isbzBdAY1skZ8WA42vpKxQUUX6aODA71k3fQWyS09AAgXj+sBHBysFux7BKxXLU/Mqxk/Z97kLql7FcllTch5nHJ3AJgL2EUQebiYGBLAgkVysjrza2U2QaFz8hYHoRoxtBPxO+igb7uYbIhJzmriZ8okdeCc0R75nPLoUlibzPkqf6wmWNfMGUOMPzLC9eCk6uENAIxN9bu5E9A/3pctrpzwGPIjvTLJqaLa8xIlBVUfz5oqrpILP5KfaAx1gVydQC5zyfrKLJuf4s/iKDtVsyjGlfhOD6XOdrWW2RhevZSc6WX4MURcPD72nMC2q3ifelqebaSVIkd+svLI92pRPb2I45WmXLHP5L8S+9Dx4lgdddaqVld6QnHK8lytX7bXGK72Kb5Wfr1Y3nlEPLIx3USfbPSrB5opSrYwGb2VPJFLlNuVumbOJxM3k6fXDxGPzFmu5HElRraXo1iZOmTyZTZouxrreH3Vp4xx9/Cyy/g5sBTX8B3sWQEyzeLlhTqRvXqdqQfjsnKImSbMNmlCNtV+kSc9+5V6eTnc8XESc85j9awYorp7sVZ8rsgPhcYO51NuZXiI7SicKCzKB3uPqNDx4vcefB/BHnR0aMTHUYd27GW5Y3zwPfF25DaFsOFN/Gb9kJpOdQP59B9wQm6Db5K/RXgRmB/2WtXVqWWmL5rwZfcPNOKrTUWK+0LqAufTd5DnpCdBkkO5dWZrNQWKioH2HkRR8KCRW2Pc4dBWBpKVH76GGDZnLxfrj+TUlL2VC/tM43ncM/Hlfy4JZVX2WH6mx4ZGs68POeaKjk2+FpM9I9b1JbP7p0/kj9w82JwZH3TTyTli3VQOEZGmorJisUCeX/N8kleH0Pv0D4OonCQ6yIQc+U8+wf6Udyi+4D9xYyAxaHxSs9O+z7VtkUzVR9WB5UBqQ/mDXP/31F/6+GaEeU99gbEyvJW8w7kSfud+kLeyn/CkPMNBYjFw2OQZuZJ1ctAOtzNR5CbkTIcOKJR/+vrzH384/DMDYPLfxf9B78mN/6lxiezw8b/s2SbOXtpl5Aod6obngn4x17vo+gLb+mItBs7In/B2+TIOnu9sDqEyGnoyJ/GoMKl3uygpVXDDN5If3LCp8R2eyle4e3LFLyNn+QjZFFvo009XCf6XzlToH3Wn/KEUDXnehfLnxUHOlt9q3J77tPRczUlx1YWYnNqiXJGvEMcDEAVHvp78KHj0sTlzCQbbjLzPTTMcfCRX9e2J748Q30OqSp6pfYfvt6Dc4078tx6ci/Kr+K/IjU+6nz3rw0fGjtVK6E3++9f5SXuXrDXs4wHJj8d9PPRQbomSBCjx3udvrsChDP5ZsTC+sccLh/aT3C5RK1lniH2gEf9UTnzQ+hrZUDfIZfmnNM25MthzpHKIb2NY7hMXdibYs8S3hRqskZydB9aTnjX0Ku0N1ROOzlkr4b8JFzNsMb1Ci6TOPUsskgdFGHyADP3dGgDWz+fryR44DPawzoqz/JgcbKdLADXBTweoY/MMG5KdI+ZGfNPaMF6qrmbv8ElzJ/VJfSp0csN9OlwIN8tL7Uu+Qs54Yr2mehMOTB7WRCIo9CTruQGhPk2oIkyJYfIsWbRdkFuuHfchl4626lAW5b9h/9tpOQCgHrRuwn8DfVWjpeFie4PFZnKwO3MT3KPcGtZN5Ub6icr73DMs1lSPgK+E4OP+XkwDNmhYfHnvBudRkUTC9JATcpaQ1VNAbsc6ZdC8kxyLERUtkP8G/W1JC/IGvKWc6NDcmCzjn8SZcmeXBX2Ty4Qcjv2Qv3PB/3ATdaG18y4r4wy9RLmgjuDB0IheM36iL1voAOG3XACDQZFOGSaM9pYII0UKppI6Ynk5ZwZMKP/88/Qr7Cc5ylgdiS2TDzpOE6v4p8+MzJ4ty11ckCk25MdiW//ux2FHZ6iXONOzbqT/GspFb0s7xodxwXo4csWF1bp34GRreiySD/0UT9HHS+jKMCHQmb42zchZERzZkTTKJ46HnZJDwY6CqkaY5AdXkpt9ZrbDM4kz1YrIO+7bWnlnBzWd+EVy4D3577w+8jI4PqbchB1705KXgckJt0O2OgB6IJ96n+WDeiIO+3KclcyHStbKkASQazboqpwlqQrnrOkgWcHUgfb5wskmUnGNzNaL+Z4+KRmOwwGSHA4cuQy1PWy8s0MuWBcldzg3ZhvUPXN2U24eNyKP7Kf6mNenreK0mEump6daOr3fiU7EbeLgBWCHSR2EAYQfz9Y5tMs6kf3dOCre6rOq1fHs1dPqqNyYjSeP7FRNMjVb1fFq5elkfEANW9dDSb0ZpHLK5Bz17VWddCHwwK8EZzHU66eaB/WzchYH7SIdL+bK8xM6DMg5K/fqoeoScfhunZ1cor59gm/2jFKOPaJXCaxcquzFjPxnB4CX/4qO4rNaowzv1Qvq2UfybH88cSm/U+eJy53RyfiI+N65X1YnlcCVBiM6f5DxcSX21csVxVdxMjoq3hWOWZusDsshK1+p/3cMgEysVZ2Ii4cnco5irVzubG+lAjiX5bzg5HK0/oX0gFGXDJ5t6CXO5nl0MNdi4K7q5V0YZx21aUT2Zz/gPfxMPtRnkAc8GCevwU7OjNvnXsbP0kXAmqj6Bj5uD4CETjNncr6OfKzWTNT93gDIFJQQmZrQyI6kjsSmJFHX+DnQVGGtXBVIFcTGEDkO3BVUray9sJHOj7wC3tEAGEKwhfwzOSO3wwdwbdYB5qt4qboa+6kmKi92NguxbB0YX0925t7nnqb1sbqMn+gBKYd4KpfhDGXRIjkpgGwoVhBVACQKcuu3ZRIVsm74RCrpeiEfYSOdA2/WwL8xvcMz3ya/hvsYP8HLHQAdzl35ZT5YPftYU0q9z3WX5+LpwFK1krmw3Pvc07K+qCtkU1zMieTl2rIDOAyGf2+u5KoAKLe2QdzVAZBKVMgycjyoYa/PxT9Af22WE1/x793PL5RnmkhwxIveDn/O+TWlZ3SYi6GeqKPyQlvww3Lmje/Ay5vwPnXhdXoAqPjZXGz9GHe3Dn2+wLQJrsihIEMSxG6ohpC7hxkUaSqMyGPiD7ynYhsMv3WHyFl+iGhApOSZ+oA/eYGDesm4nj3j49TUzcuxxXxDzsg7qjPTJTl2sh/WNqrVI7aQgEt0Vc6Kl5Fl5JnE00UQ8s+96BdiXpbf4bYi/9SZ6mNK616EHn86HHyws2M1YDJiO8X2fHp1Ib5xGGb4DLZ9YQD08ac+J13kqXIRnOSnbsxVBjOO1bv4kryLBkGZx0vJM0VLF4HIX1kXliPL9a48yt87H2vj1baTc2K8RPxsbmk7tM/Wg5HN2HZyzg5XOQCUT08OsDLahyuFaIeNkmeeveARsZB4kMfdWCIvemCeHOpo5Vc+st6Se7kfKseCHA4d+TGfybuoe8Rb1dTxI2VB3OV+QdlRH8PXHVZGF/1IWSS/mgs1NkRDef/6JkfrpNG7OKAO3zy5RJz46n3+ZpLIYdCD4p55MT59POxQbhbKsSG9/2v+CXmzeUPNmpX3uaYDd6jjGRtr2/X5W16DAthjPvTcYI/2RJ/rPdUE+X0QsJgoI+crv0EuuE51A76Trc1fcWKET2NROEbEI44+JzkWhxILDsEm22EIkQIMORAuUwFV2G4coR+Ui1ho/xu/4M+U3PiTcsj/PAe1D8vKvxSdM3J8sDNTQ5HWi53NYYv6AsjhtIW0ZO91cl9InVl+7Oys/sCli9r3cQDY13QAqDxoAUlwNWE94mpADAA/k9izhVgfah9iNLNHGxDlol42t2wTePLfsL8Tr3Vj4Mk9e1KjIU9SO7RpfQb+WrLTp22+wA/GV7wGOfhm3LqpF0Mz1NkAoD4VV8zXuUvHHrMdYmZyJP6b2Ke9rQaAV/RT7gwAFdjGUElECWbl0ztIH4toD2qSH/veACB5TnqRjqqTya2ZXJrhJuXKnsQb6gA9MNSJ1Q74DHJWg8A/uyTeAIkuh7LPDiTm08Yd9ki+gz45nygP5N+OPYjh9q/wTfvZa/A/wZ0DPcmJFcnlJcsAuHTFtY8N6w2AFMdsDszG4dcMjwa6y3LGJcPXNAvGUOc61Y7l69XN2HTjF22bOt8onpODhaqJzZVecFK/IQfiQ3GROkENzzMgfNohUDmypL0GSZGKDsXTycKzi3JgPpwDonlEPLwGjQ5S1FPKvUZQ8RydjjpeTTI1S+p061PVzqvnVZ1kXZZzj3hl68WQ5evphklmk80cwLHn6WRirHKN8lR8snll46g8V+Nm/K5wyeSUzWWVO+qw+JnL8YQO4xTljnLF/Wrvruow7iz3VJLZgq02I4ubjXGlqNlG9g4vwzlTzyjOSiNe4RLpZM5lJc9VHdyLuLyCV7bPovpm/dlcPfuV/DI+JFaDRomgjyhOlgvTuXKoKt6VZkWdlQNaPXTGZbVBVU4ZG5t3xCmrE+XrcVO2qzrZemZ0rpx5ph+u9FcaHf4KiiWeJc98qEJ+7v0G/XFXlly2sBFvj5+no/aiemT5slplG9vLI3rOxIliXtHJ2KgzfUpH7SlbL9fVmJl+WO2ZTJ3RsHViFRD5Y4NYsD/Wb/wSLk47L0Hv8DNFUzYOZ9ncSiezr2qnXkd1jvxlYzKsxsz49Gyi2q/qqD2rz3h5OWR65WpvRTpMN41OBkB3LvhnAE9+yFrUUJ96cgCogmWTzsgyrzOHGnH1asEO/E4emTpe8ZPhs6Kj4ts99BXVNVt7pcu4RPVb7YuMndLJnk2IztE+ZY0JnSI2I7e27VMe+jYhLL8WJecVJCoUs8fXypbZK59MLyvL2nr5Rv6VzirnDO8odlTjzDlEOhEivazcyz967fVU1NeZHOkAII6aETezj6sd9mB3PFt769OiQWy2N8RCPuoQnBrkC7boY/WAMgcbxX9Kh9l49c3kdDXvV+g8gSyXqH4eL+88otiZBI6LqH7pw3BZSXLyAjMfGBf0TvvOB0QzcZk9GzSn3e1iOVj1kTnsd0Im76d0nkQ23tP5PZZnNABAh13ucABYH+rZ+HIHAOFkMQ0rouPyLBTeCisDIOPHkbMLPF1oYRf9rDsbHOH3MQqFt4a6HHhBkgNAvqteHSB2jwyAfgwRYlcXvFCI4AwA+/Xz7QHhDQdPRw0A2A+Hy7vhv16O/qbfJ3kJene/qabAPooPfzuAPgIOg47h1Lv+K8Rpn8XfBaiB+4x2KFvNCWM9hZ9U24PHT+H0z8IbAKhD9o/Lzy7vKTOXla1Bx/g4+RgdjD9tPt0QDu9QR3Fy6pmKl+GM/p7AVV9P5BT5K9yAuXDNa0yyPw0NMgCmyw/6f3QUH6tDGlvZenkuNVB0KVcGxIo/Ff8qvyfqscohG2f1Iq+cXyEJ54IuFTvyscLF4xA1o5cfa74VTlETrw4E5dPjnanNnaGR0Yv8XalnpJ+JdWWIFT7yl8eTRfaZ2P/iAGA6ilPmsjFd9Lvqy7PJ5Ll6jh6iPO9wqQGwgOhQo8tyZQBEh5nVxWZRHBXXjP8rnKIhE130lUt3NafMAPDyjrhEPFVsxSXDNdqPZFf0/nmsXN6sjrLLNN6qH2tv9bO5rl6WK5fLu1Qr3LJnc3UAPJlzlqvCSs0i/hn51b7753G1yTw9z/ZKHO+QvDhWpnK9c3G8JlWv2XM2drauq7ZKtnL+Kq+reis1i+qSkWfyzub3T0Il6DWy8pH1zeSKA/PzXQNgtVZR864MAM8+y+OJAaB4s7gRXjUAvDyiXP7Tl1uBFcHTWW1cpqP8rxwaGwAqVrbBs5df5ZP1s3Jpv3MARPwztblysa/qeHpRDd/ysjN4lwXlK5fi7gBgcsV35XK8cgAozhnbbE5eDbL8VgfLTx0Aq71YA0Age1lWLtZKQ3ocDpnyE8XKXvKrfKNcojwjrizeSm4RN+8cs3lfqauH7OW82k8rMf7zyFwMrxmVj4xv5i+KpfRXLtVqo169YCuNl+Xj1e/uAIhsFf+VM44uXkZH8WCyq0PoLXGl+NnG83Szw8DjuHIJMvmvDgBlt8JdPSv/kX0Uf/XyK24ZrPbGk74ytSl8InsAK/qvjP8kVoZH9nIznez+qv8I2XfNyMcrsJJf9mwyw7IA2F2g3fELhUKhUCgUCoVCoVAoFAqFQqFQKBQKhUKhUCgUCoVCoVAoFAqFQqFQKBQKhUKhUCgUCoWfgf8Do+ywpMQ25R4AAAAASUVORK5CYII=",
  w: 256, h: 256,
  glyphs: (function(){var m={},p="32=79,81,3,16,3,0|33=73,81,4,13,6,1|34=92,81,5,8,6,0|35=60,2,7,13,8,0|36=105,2,6,15,7,0|37=51,2,7,13,8,0|38=78,2,7,13,8,0|39=119,81,2,8,3,0|40=67,81,4,13,5,0|41=55,81,4,13,5,0|42=2,20,8,11,9,0|43=98,66,6,11,7,0|44=103,81,2,15,3,0|45=41,81,6,9,7,0|46=111,81,2,13,3,0|47=20,20,6,14,7,0|48=106,36,6,13,7,0|49=74,36,6,13,7,0|50=58,51,6,13,7,0|51=108,20,6,13,7,0|52=76,20,6,13,7,0|53=66,36,6,13,7,0|54=116,20,6,13,7,0|55=26,36,6,13,7,0|56=66,51,6,13,7,0|57=26,51,6,13,7,0|58=107,81,2,13,3,0|59=99,81,2,15,3,0|60=2,81,5,13,6,0|61=33,81,6,10,7,0|62=106,66,5,13,6,0|63=114,51,6,13,7,0|64=106,51,6,13,7,0|65=2,36,6,13,7,0|66=92,20,6,13,7,0|67=34,36,6,13,7,0|68=2,66,6,13,7,0|69=34,66,6,13,7,0|70=26,66,6,13,7,0|71=100,20,6,13,7,0|72=2,51,6,13,7,0|73=36,20,6,13,7,0|74=82,36,6,13,7,0|75=98,36,6,13,7,0|76=50,66,6,13,7,0|77=87,2,7,13,8,0|78=60,20,6,13,7,0|79=18,51,6,13,7,0|80=34,51,6,13,7,0|81=113,2,6,15,7,0|82=114,36,6,13,7,0|83=42,66,6,13,7,0|84=90,36,6,13,7,0|85=42,51,6,13,7,0|86=10,66,6,13,7,0|87=42,2,7,13,8,0|88=28,20,6,13,7,0|89=18,66,6,13,7,0|90=90,66,6,13,7,0|91=61,81,4,13,5,0|92=12,20,6,14,7,0|93=49,81,4,13,5,0|94=84,81,6,7,7,0|95=9,81,4,16,5,0|96=2,99,3,5,4,0|97=10,51,6,13,7,0|98=98,51,6,13,7,0|99=68,20,6,13,7,0|100=66,66,6,13,7,0|101=42,36,6,13,7,0|102=50,36,6,13,7,0|103=2,2,6,16,7,0|104=52,20,6,13,7,0|105=74,51,6,13,7,0|106=18,2,6,16,7,0|107=82,66,6,13,7,0|108=50,51,6,13,7,0|109=69,2,7,13,8,0|110=10,36,6,13,7,0|111=44,20,6,13,7,0|112=34,2,6,16,7,0|113=26,2,6,16,7,0|114=74,66,6,13,7,0|115=90,51,6,13,7,0|116=18,36,6,13,7,0|117=58,66,6,13,7,0|118=58,36,6,13,7,0|119=96,2,7,13,8,0|120=84,20,6,13,7,0|121=10,2,6,16,7,0|122=82,51,6,13,7,0|123=120,66,5,13,6,0|124=115,81,2,13,3,0|125=113,66,5,13,6,0|126=24,81,7,9,8,0".split("|");
    for(var i=0;i<p.length;i++){var kv=p[i].split("="),v=kv[1].split(",");
      m[+kv[0]]=[+v[0],+v[1],+v[2],+v[3],+v[4],+v[5]];}
    return m;})()
};

  var HEART = [0x18c, 0x3de, 0x7ff, 0x7ff, 0x7ff, 0x3fe, 0x1fc, 0xf8, 0x70, 0x20];  /* 11x10 SOUL */

  var W = 640, H = 480;
  var canvas = null, ctx = null, raf = -1;

  var S = {
    open: false, mode: "main",        /* main | boss | confirm */
    sel: 0,
    bossSel: 0, bossScroll: 0,
    confirm: null,                    /* {kind, boss, yes} */
    info: null, tick: 0
  };

  /* ---------- font: tinted atlas cache ---------- */
  var atlasImg = null, tintCache = {};
  var COL = {
    white: "#ffffff", sel: "#ffff00", hint: "#7f7f7f",
    red: "#ff0000", pac: "#00c0ff", gen: "#ff4040", neu: "#ffffff"
  };

  function loadFont() {
    if (atlasImg) return;
    atlasImg = new Image();
    atlasImg.onload = function () { tintCache = {}; };
    atlasImg.src = UTFONT.src;
  }

  function tinted(color) {
    if (tintCache[color]) return tintCache[color];
    if (!atlasImg || !atlasImg.complete || !atlasImg.naturalWidth) return null;
    var c = document.createElement("canvas");
    c.width = UTFONT.w;
    c.height = UTFONT.h;
    var t = c.getContext("2d");
    t.drawImage(atlasImg, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = color;
    t.fillRect(0, 0, c.width, c.height);
    tintCache[color] = c;
    return c;
  }

  /* draw text with the real font. Glyphs are pre-positioned in the atlas:
     each glyph draws at the line TOP; advance by its shift. */
  function text(str, x, y, scale, color) {
    var src = tinted(color || COL.white);
    if (!src) return;
    str = String(str);
    var pen = x;
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code === 10) continue;
      var g = UTFONT.glyphs[code];
      if (!g) g = UTFONT.glyphs[63]; /* '?' */
      if (!g) continue;
      if (code !== 32) {
        ctx.drawImage(src, g[0], g[1], g[2], g[3],
          pen + g[5] * scale, y, g[2] * scale, g[3] * scale);
      }
      pen += g[4] * scale;
    }
  }

  function textW(str, scale) {
    str = String(str);
    var w = 0;
    for (var i = 0; i < str.length; i++) {
      var g = UTFONT.glyphs[str.charCodeAt(i)];
      w += (g ? g[4] : 6) * scale;
    }
    return w - (str.length ? scale : 0);
  }

  function heart(x, y, scale, color) {
    ctx.fillStyle = color || COL.red;
    for (var r = 0; r < HEART.length; r++) {
      var row = HEART[r];
      for (var c = 0; c < 11; c++) {
        if (row & (1 << (10 - c))) ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }

  /* Undertale dialogue box: black interior, white frame */
  function box(x, y, w, h) {
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, w, 5);
    ctx.fillRect(x, y + h - 5, w, 5);
    ctx.fillRect(x, y, 5, h);
    ctx.fillRect(x + w - 5, y, 5, h);
  }

  function routeColor(route) {
    return route === "PACIFIST" ? COL.pac : route === "GENOCIDE" ? COL.gen : COL.neu;
  }

  /* ---------- data ---------- */
  function refresh() {
    S.info = window.UTSaveInfo ? window.UTSaveInfo.parse() : null;
  }

  /* ---------- canvas plumbing (pinned to the game canvas) ---------- */
  function gameCanvas() {
    return document.querySelector("canvas.emscripten") || document.getElementById("canvas");
  }
  function ensureCanvas() {
    if (canvas) return true;
    var gc = gameCanvas();
    if (!gc) return false;
    canvas = document.createElement("canvas");
    canvas.id = "utPauseMenu";
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText =
      "position:fixed;z-index:99998;image-rendering:pixelated;image-rendering:crisp-edges;" +
      "background:transparent;cursor:default;display:none;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return true;
  }
  function placeCanvas() {
    if (!canvas) return;
    var gc = gameCanvas();
    var r = gc ? gc.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    canvas.style.left = r.left + "px";
    canvas.style.top = r.top + "px";
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
  }

  /* ---------- layout helpers ---------- */
  var rows = [];   /* hit-test rows rebuilt every frame */

  function menuRow(x, y, label, selected, color) {
    var s = 2;
    var w = textW(label, s) + 30;
    if (selected) heart(x + 2, y + 5, 2, COL.red);
    text(label, x + 34, y, s, color || (selected ? COL.sel : COL.white));
    rows.push({ x: x, y: y - 6, w: w + 40, h: 36, act: label, sel: selected });
    return y + 34;
  }

  /* ---------- screens ---------- */
  /* v1.8: equipment set bonuses (exact weapon+armor pairs, same table the
     game's scr_weaponeq/scr_armoreq/scr_itemname patches use - see the
     pair thresholds in game data v1.7: 196/844/911/1624/2924/3054/3184/3314).
     weapon/armor here are file0's line-28/29 values (the equipment ids). */
  var SET_BONUS = (function () {
    var t = {};
    t[3 * 64 + 4] = "SET: COMFORT FOOD - ITEMS HEAL +5";        /* Stick + Bandage */
    t[13 * 64 + 12] = "SET: TOY KNIFE + RIBBON - ATK +2 DF +1"; /* Toy Knife + Faded Ribbon */
    t[14 * 64 + 15] = "SET: GLOVE + BANDANNA - ATK +3 DF +1";    /* Tough Glove + Manly Bandanna */
    t[25 * 64 + 24] = "SET: SHOES + TUTU - I-FRAMES +60%";      /* Ballet Shoes + Old Tutu */
    t[45 * 64 + 44] = "SET: NOTEBOOK + GLASSES - ATK +2 DF +2"; /* Torn Notebook + Cloudy Glasses */
    t[47 * 64 + 46] = "SET: HOME COOKING - ITEMS HEAL +10";     /* Burnt Pan + Stained Apron */
    t[49 * 64 + 48] = "SET: GUN + HAT - ATK +3 DF +2";          /* Empty Gun + Cowboy Hat */
    t[51 * 64 + 50] = "SET: DAGGER + LOCKET - ATK +2 DF +4";    /* Worn Dagger + Heart Locket */
    return t;
  })();
  function setBonusLine(info) {
    if (!info || typeof info.weapon !== "number" || typeof info.armor !== "number") return null;
    var key = info.weapon * 64 + info.armor;
    return SET_BONUS[key] || null;
  }

  function drawMain() {
    var info = S.info;
    if (info) {
      var name = info.name || "FRISK";
      text(name, 36, 14, 2, COL.white);
      var x2 = 36 + textW(name, 2) + 20;
      text("LV " + info.lv, x2, 14, 2, COL.white);
      text("HP " + info.hp + "/" + info.maxhp, x2 + textW("LV " + info.lv, 2) + 20, 14, 2, COL.white);
      var badge = info.route;
      text(badge, W - 36 - textW(badge, 2), 14, 2, routeColor(info.route));
      var loc = (info.boss ? info.boss + " - " : "") + info.area;
      text(loc, 36, 48, 1, COL.hint);
      /* v1.8: live set-bonus readout under the stats strip */
      var sb = setBonusLine(info);
      if (sb) text(sb, W - 36 - textW(sb, 1), 48, 1, COL.sel);
    }

    box(32, 84, 576, 246);
    var title = "PAUSED";
    text(title, 320 - textW(title, 3) / 2, 106, 3, COL.white);

    var items = ["RESUME", "BOSS STATES", "QUIT"];   /* v1.9: FULLSCREEN removed
       from the menu per request - F4 still toggles it anywhere */
    var y = 152;
    for (var i = 0; i < items.length; i++) {
      y = menuRow(96, y, items[i], S.sel === i);
    }

    var hint = "ARROWS: SELECT   Z: CONFIRM   X: RESUME";
    text(hint, 320 - textW(hint, 1) / 2, 396, 1, COL.hint);
  }

  function bossList() {
    return window.UTBossStates ? window.UTBossStates.list : [];
  }

  function drawBoss() {
    text("BOSS STATES", 36, 14, 2, COL.white);
    var hint0 = "SKIP STRAIGHT TO A FIGHT - REPLACES YOUR FILE";
    text(hint0, W - 36 - textW(hint0, 1), 16, 1, COL.hint);

    box(32, 56, 576, 300);

    var bl = bossList();
    var visible = Math.min(bl.length, 7);
    if (S.bossScroll > bl.length - visible) S.bossScroll = Math.max(0, bl.length - visible);
    var y = 82;
    for (var r = 0; r < visible; r++) {
      var idx = S.bossScroll + r;
      var b = bl[idx];
      if (!b) break;
      var sel = S.bossSel === idx;
      if (sel) heart(58, y + 5, 2, COL.red);
      var rc = routeColor(b.route);
      /* v2.0: every state gets its route chip - PACI for the zero-kill
         pacifist saves (blue), GEN for genocide (red), NEU for a
         neutral file (white). Nothing is left un-labeled. */
      var chip = b.route === "PACIFIST" ? "PACI" : (b.route === "GENOCIDE" ? "GEN" : "NEU");
      text(chip, 92, y, 2, rc);
      text(b.name, 92 + textW("GEN", 2) + 20, y, 2, sel ? COL.sel : COL.white);
      var lvTxt = "LV " + b.lv;
      text(lvTxt, 480 - textW(lvTxt, 2), y, 2, sel ? COL.sel : COL.white);
      rows.push({ x: 52, y: y - 6, w: 490, h: 36, act: "boss" + idx, sel: sel });
      y += 34;
    }

    var cur = bl[S.bossSel];
    if (cur) {
      var d = cur.sub + "   " + (cur.route === "GENOCIDE" ? "GENOCIDE ROUTE"
        : cur.route === "PACIFIST" ? "PACIFIST ROUTE" : "NEUTRAL ROUTE");
      text(d.slice(0, 62), 58, 340, 1, COL.hint);
    }
    if (bl.length > 7) {
      var more = bl.length - (S.bossScroll + visible);
      if (more > 0) {
        var sc = "MORE " + more;
        text(sc, W - 40 - textW(sc, 1), 322, 1, COL.hint);
      }
    }
    var hint = "ARROWS: SELECT   Z: SKIP TO BOSS   X: BACK";
    text(hint, 320 - textW(hint, 1) / 2, 396, 1, COL.hint);
  }

  function confirmBox(title, sub) {
    box(140, 160, 360, 160);
    text(title, 320 - textW(title, 2) / 2, 184, 2, COL.white);
    if (sub) text(sub, 320 - textW(sub, 1) / 2, 216, 1, COL.hint);
    var y = 258;
    var opts = ["YES", "NO"];
    S.confirm.yesPos = [];
    for (var i = 0; i < opts.length; i++) {
      var x = 240 + i * 100;
      var on = (S.confirm.yes ? i === 0 : i === 1);
      if (on) heart(x - 6, y + 4, 2, COL.red);
      text(opts[i], x + 20, y, 2, on ? COL.sel : COL.white);
      rows.push({ x: x - 14, y: y - 8, w: 96, h: 40, act: "confirm" + i, sel: on });
    }
  }

  function drawConfirm() {
    var c = S.confirm;
    if (c.kind === "boss") {
      var b = c.boss || {};
      confirmBox("SKIP TO " + (b.name || "THIS BOSS") + "?",
        "LV " + (b.lv || 1) + "  " + (b.sub || b.area || "") +
        (b.route === "GENOCIDE" ? "  -  GENOCIDE" : ""));
      text("YOUR CURRENT FILE WILL BE REPLACED", 320 - textW("YOUR CURRENT FILE WILL BE REPLACED", 1) / 2, 236, 1, COL.hint);
    } else if (c.kind === "quit") {
      confirmBox("QUIT THE GAME?", "BACK TO THE LOADING SCREEN");
    }
    var hint = "Z: CONFIRM   X: CANCEL";
    text(hint, 320 - textW(hint, 1) / 2, 346, 1, COL.hint);
  }

  function draw() {
    if (!ctx) return;
    rows = [];
    S.tick++;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    if (S.mode === "main") drawMain();
    else if (S.mode === "boss") drawBoss();
    else drawConfirm();
  }

  function loop() {
    if (!S.open) return;
    placeCanvas();
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* ---------- actions ---------- */
  function doBossGo() {
    var b = S.confirm.boss;
    if (!b || !window.UTBossStates) { S.confirm = null; S.mode = "boss"; return; }
    close();
    window.UTBossStates.load(b.id).then(function () {
      setTimeout(function () { window.location.reload(); }, 150);
    }, function (err) {
      /* v1.8: the write failed (IndexedDB blocked/full). Do not reload into
         a half-written state - report and stay on the menu. */
      console.log("[UTBossStates] write FAILED, not reloading:", err);
      try {
        showRollbackMessage("COULD NOT WRITE SAVE - STORAGE FULL OR BLOCKED");
      } catch (e) {}
      S.confirm = null;
    });
  }
  function bossUp() {
    var bl = bossList();
    if (!bl.length) return;
    S.bossSel = (S.bossSel + bl.length - 1) % bl.length;
    if (S.bossSel < S.bossScroll) S.bossScroll = S.bossSel;
  }
  function bossDown() {
    var bl = bossList();
    if (!bl.length) return;
    S.bossSel = (S.bossSel + 1) % bl.length;
    if (S.bossSel > S.bossScroll + 6) S.bossScroll = S.bossSel - 6;
  }
  function bossGo() {
    var bl = bossList();
    var b = bl[S.bossSel];
    if (!b) return;
    S.confirm = { kind: "boss", boss: b, yes: true };
    S.mode = "confirm";
  }

  function confirmSel(i) {
    S.confirm.yes = i === 0;
  }
  function confirmBack() {
    var kind = S.confirm && S.confirm.kind;
    S.confirm = null;
    S.mode = kind === "boss" ? "boss" : "main";
  }
  function confirmGo() {
    if (S.confirm.yes) {
      if (S.confirm.kind === "boss") doBossGo();
      else { S.confirm = null; close(); if (typeof quitIfSupported === "function") quitIfSupported(); }
    } else {
      confirmBack();
    }
  }

  /* ---------- input ---------- */
  function mainAction(i) {
    if (i === 0) close();
    else if (i === 1) { S.mode = "boss"; S.bossSel = 0; S.bossScroll = 0; }
    else if (i === 2) {
      S.confirm = { kind: "quit", yes: false };
      S.mode = "confirm";
    }
  }

  var GAME_KEYS = {
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
    Enter: 1, z: 1, Z: 1, x: 1, X: 1, c: 1, C: 1,
    w: 1, W: 1, s: 1, S: 1, a: 1, A: 1, d: 1, D: 1,
    " ": 1, Shift: 1, Control: 1, Tab: 1
  };

  function onKey(e) {
    if (e.repeat) { if (S.open) e.preventDefault(); return; }
    if (!S.open) {
      if (e.key === "Escape" && !fullscreenElementActive()) {
        e.preventDefault();
        open();
      }
      return;
    }
    var k = e.key;
    var handled = true;
    if (S.mode === "main") {
      if (k === "ArrowUp" || k === "w" || k === "W") S.sel = (S.sel + 2) % 3;
      else if (k === "ArrowDown" || k === "s" || k === "S") S.sel = (S.sel + 1) % 3;
      else if (k === "Enter" || k === "z" || k === "Z" || k === " ") mainAction(S.sel);
      else if (k === "Escape" || k === "x" || k === "X") close();
      else handled = false;
    } else if (S.mode === "boss") {
      if (k === "ArrowUp" || k === "w" || k === "W") bossUp();
      else if (k === "ArrowDown" || k === "s" || k === "S") bossDown();
      else if (k === "Enter" || k === "z" || k === "Z" || k === " ") bossGo();
      else if (k === "Escape" || k === "x" || k === "X") { S.mode = "main"; S.sel = 1; }
      else handled = false;
    } else {  /* confirm */
      if (k === "ArrowLeft" || k === "a" || k === "A") confirmSel(0);
      else if (k === "ArrowRight" || k === "d" || k === "D") confirmSel(1);
      else if (k === "Enter" || k === "z" || k === "Z" || k === " ") confirmGo();
      else if (k === "Escape" || k === "x" || k === "X") confirmBack();
      else handled = false;
    }
    if (handled || GAME_KEYS[k]) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  }

  function fullscreenElementActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  /* ---------- mouse ---------- */
  function onMouse(e) {
    if (!S.open || !canvas) return;
    var r = canvas.getBoundingClientRect();
    var x = (e.clientX - r.left) * W / r.width;
    var y = (e.clientY - r.top) * H / r.height;
    if (e.type === "mousemove") {
      for (var i = 0; i < rows.length; i++) {
        var w = rows[i];
        if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) {
          if (S.mode === "main") S.sel = i;
          else if (S.mode === "boss") {
            if (w.act.indexOf("boss") === 0) S.bossSel = Number(w.act.slice(4));
          } else if (S.mode === "confirm" && w.act.indexOf("confirm") === 0) {
            confirmSel(Number(w.act.slice(7)));
          }
          break;
        }
      }
    } else if (e.type === "click") {
      for (var j = 0; j < rows.length; j++) {
        var t = rows[j];
        if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
          if (S.mode === "main") mainAction(j);
          else if (S.mode === "boss") {
            if (t.act.indexOf("boss") === 0) {
              S.bossSel = Number(t.act.slice(4));
              bossGo();
            }
          } else if (S.mode === "confirm" && t.act.indexOf("confirm") === 0) {
            confirmSel(Number(t.act.slice(7)));
            confirmGo();
          }
          break;
        }
      }
    }
  }

  /* ---------- open/close ---------- */
  function enginePause() {
    try { if (typeof GM_pause === "function") GM_pause(); } catch (e) {}
    var gc = gameCanvas();
    if (gc) gc.classList.add("paused");
  }
  function engineResume() {
    try { if (typeof GM_unpause === "function") GM_unpause(); } catch (e) {}
    var gc = gameCanvas();
    if (gc) { gc.classList.remove("paused"); gc.classList.add("unpaused"); }
  }
  function gameLive() {
    var gc = gameCanvas();
    return !!(gc && gc.classList.contains("active"));
  }

  function open() {
    if (S.open) return;
    if (!gameLive()) return;
    if (!ensureCanvas()) return;
    loadFont();
    attachLazy();
    refresh();
    S.open = true;
    S.mode = "main";
    S.sel = 0;
    canvas.style.display = "block";
    cancelAnimationFrame(raf);
    loop();
    enginePause();
  }
  function close() {
    if (!S.open) return;
    S.open = false;
    cancelAnimationFrame(raf);
    if (canvas) canvas.style.display = "none";
    engineResume();
  }
  function isOpen() { return S.open; }

  window.addEventListener("keydown", onKey, true);
  var lazyAttached = false;
  function attachLazy() {
    if (lazyAttached) return;
    lazyAttached = true;
    window.addEventListener("mousemove", onMouse, true);
    window.addEventListener("click", onMouse, true);
    window.addEventListener("resize", placeCanvas);
    window.addEventListener("blur", function () { if (S.open) close(); });
  }

  window.UTPauseMenu = { open: open, close: close, isOpen: isOpen, toggle: function () { S.open ? close() : open(); } };
  window.togglePauseMenu = window.UTPauseMenu.toggle;
})();
/* [ut-pausemenu v1.2 DOM overlay removed - the canvas menu above replaced it] */

