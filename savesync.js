/*
 * Undertale-HTML save mirror (v1.6 rewrite)
 * ============================================================
 * ONE job, and it is strictly READ-ONLY towards the game's storage:
 *
 *     IndexedDB (/_savedata FILE_DATA)  ->  localStorage ("ut/*" mirrors)
 *
 * The mirrors exist so the pause menu, boss states and the console can read
 * the current save cheaply. The runner's own file system is the ONLY writer.
 *
 * WHY THIS IS NOT THE OLD "UNIFIED SAVE SYNC"
 * ------------------------------------------------------------
 * The previous version (deltarune/WigdosXP heritage) also did the reverse
 * direction - it OPENED /_savedata WITHOUT A VERSION at page load and, when
 * it did not find the FILE_DATA store (which happens on every fresh profile
 * or racing page load), it CREATED a fresh empty one via a version upgrade.
 * That silently WIPED the player's whole save at boot: the runner's mount +
 * populate then found an empty remote, and the game booted to the name
 * picking menu - "saves are deleted constantly". Its mirror import also
 * wrote records back in a lossy format (plain objects instead of
 * Uint8Array), corrupting decomp_vars.ini/trophies.ini, and its version
 * ping-pong (no-version / +1 / fixed 21) could deadlock the gameStorage
 * polyfill entirely.
 *
 * None of that machinery is allowed back in. This file never opens the DB
 * with a version, never creates or upgrades stores, never writes a single
 * byte to IndexedDB, and never imports mirrors anywhere automatically.
 * ============================================================
 */

(function () {
    'use strict';

    var CONFIG = {
        debug: false,
        db: { name: '/_savedata', storeName: 'FILE_DATA' },
        localStoragePrefix: 'ut',
        syncIntervalMs: 10000
    };

    function log(msg, data) {
        if (CONFIG.debug) console.debug('[UTMirror]', msg, data || '');
    }

    /* ---------- serialization (binary-safe, read side only) ---------- */

    function arrayBufferToBase64(buffer) {
        var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        var s = '';
        for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s);
    }

    function base64ToArrayBuffer(b64) {
        var bin = atob(b64);
        var len = bin.length;
        var arr = new Uint8Array(len);
        for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
        return arr.buffer;
    }

    async function serializeForLocalStorage(value) {
        if (value === null) return 'JS:__NULL__';
        if (value === undefined) return 'JS:__UNDEFINED__';
        if (value instanceof Date) return 'DATE:' + value.getTime();
        if (value instanceof ArrayBuffer) return 'AB:' + arrayBufferToBase64(value);
        if (ArrayBuffer.isView(value)) return 'TA:' + (value.constructor && value.constructor.name || 'Uint8Array') +
            ':' + arrayBufferToBase64(value.buffer);
        if (value instanceof Blob) {
            var buf = await value.arrayBuffer();
            return 'BL:' + arrayBufferToBase64(buf);
        }
        if (typeof value === 'object') {
            var out = Array.isArray(value) ? [] : {};
            for (var k in value) {
                if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
                out[k] = await serializeForLocalStorage(value[k]);
            }
            return 'OBJ:' + JSON.stringify(out);
        }
        return 'JS:' + JSON.stringify(value);
    }

    function deserializeFromLocalStorage(str) {
        if (str === null || str === undefined) return null;
        str = String(str);
        if (str === 'JS:__NULL__') return null;
        if (str === 'JS:__UNDEFINED__') return undefined;
        if (str.indexOf('AB:') === 0) return base64ToArrayBuffer(str.slice(3));
        if (str.indexOf('TA:') === 0) {
            var rest = str.slice(3);
            var idx = rest.indexOf(':');
            if (idx === -1) return base64ToArrayBuffer(rest);
            var ctor = rest.slice(0, idx);
            var ab = base64ToArrayBuffer(rest.slice(idx + 1));
            try {
                var T = (typeof globalThis !== 'undefined' && globalThis[ctor]) || null;
                if (T) return new T(ab);
            } catch (e) {}
            return ab;
        }
        if (str.indexOf('BL:') === 0) return new Blob([base64ToArrayBuffer(str.slice(3))]);
        if (str.indexOf('DATE:') === 0) return new Date(Number(str.slice(5)));
        if (str.indexOf('JS:') === 0) { try { return JSON.parse(str.slice(3)); } catch (e) { return null; } }
        if (str.indexOf('OBJ:') === 0) {
            var inner;
            try { inner = JSON.parse(str.slice(4)); } catch (e) { return null; }
            function rev(v) {
                if (v === null) return null;
                if (typeof v === 'string') return deserializeFromLocalStorage(v);
                if (Array.isArray(v)) return v.map(rev);
                if (typeof v === 'object') {
                    var o = {};
                    for (var p in v) if (Object.prototype.hasOwnProperty.call(v, p)) o[p] = rev(v[p]);
                    return o;
                }
                return v;
            }
            return rev(inner);
        }
        return null;
    }

    /* ---------- IndexedDB: READ ONLY ---------- */

    function openDB() {
        /* no version, no upgrades, no store creation - ever */
        return new Promise(function (resolve, reject) {
            var req;
            try { req = indexedDB.open(CONFIG.db.name); }
            catch (e) { reject(e); return; }
            req.onsuccess = function () {
                var db = req.result;
                if (!db.objectStoreNames.contains(CONFIG.storeName)) {
                    db.close();
                    reject(new Error('store not created yet'));
                    return;
                }
                resolve(db);
            };
            req.onerror = function () { reject(req.error); };
        });
    }

    function getAllFromIndexedDB() {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var values = [], keys = [];
                try {
                    var tx = db.transaction([CONFIG.storeName], 'readonly');
                    var store = tx.objectStore(CONFIG.storeName);
                    var req = store.openCursor();
                    req.onsuccess = function (ev) {
                        var cur = ev.target.result;
                        if (!cur) return resolve({ keys: keys, values: values });
                        keys.push(cur.primaryKey);
                        values.push(cur.value);
                        cur.continue();
                    };
                    req.onerror = function (ev) { reject(ev.target.error); };
                } catch (e) { reject(e); }
            });
        });
    }

    /* export the file system records to the localStorage mirrors; corrupt or
       foreign records are skipped, not copied */
    function exportToLocalStorage() {
        return getAllFromIndexedDB().then(async function (data) {
            var ok = 0;
            for (var i = 0; i < data.keys.length; i++) {
                var key = String(data.keys[i]);
                var node = data.values[i];
                if (!node || typeof node !== 'object' || node.contents === undefined) continue;
                if (!(node.contents instanceof Uint8Array) && !(node.contents instanceof ArrayBuffer)) continue;
                var localKey = CONFIG.localStoragePrefix + key;
                try {
                    var serialized = await serializeForLocalStorage(node);
                    localStorage.setItem(localKey, serialized);
                    try { localStorage.setItem(localKey + '::ts', String(node.timestamp instanceof Date ? node.timestamp.getTime() : Number(node.timestamp) || 0)); } catch (e2) {}
                    ok++;
                } catch (e) { log('serialize failed for', key); }
            }
            log('mirrored', ok, 'files');
            return ok;
        });
    }

    /* ---------- WigdosXP parent-frame protocol (embed mode only) ----------
       Kept for the deltarune-embed heritage. Standalone it is inert. The
       handler only touches LOCALSTORAGE now - never the game's IndexedDB. */
    var WigdosXPSync = {
        isInIframe: window.parent !== window,
        lastSyncedData: null,

        notifySaveDataChanged: function () {
            if (!this.isInIframe) return;
            try {
                var all = {};
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    if (!key || key.indexOf('::') !== -1) continue;
                    all[key] = localStorage.getItem(key);
                }
                var s = JSON.stringify(all);
                if (s === this.lastSyncedData) return;
                this.lastSyncedData = s;
                window.parent.postMessage({ type: 'saveDataChanged', gameId: 'ut', allLocalStorageData: all }, '*');
            } catch (e) {}
        },

        initialize: function () {
            if (!this.isInIframe) { log('standalone - parent sync disabled'); return; }
            var self = this;
            window.addEventListener('message', function (event) {
                if (window.parent === window || !event.data || !event.data.type) return;
                if (event.data.type === 'setAllLocalStorageData' && event.data.allLocalStorageData) {
                    Object.keys(event.data.allLocalStorageData).forEach(function (key) {
                        try { localStorage.setItem(key, event.data.allLocalStorageData[key]); } catch (e) {}
                    });
                    if (event.source) event.source.postMessage({ type: 'loadDataResponse', messageId: event.data.messageId, success: true }, event.origin);
                }
            });
            setTimeout(function () {
                window.parent.postMessage({ type: 'wigdosxp-integration-ready', gameId: 'ut' }, '*');
            }, 1000);
            setInterval(function () { self.notifySaveDataChanged(); }, 5000);
        }
    };

    /* ---------- boot ---------- */

    window.addEventListener('load', function () {
        (async function waitForDB() {
            var tries = 0;
            for (;;) {
                try {
                    await openDB();
                    break;
                } catch (e) {
                    /* the runner + gameStorage polyfill create the store when the
                       game boots; until then there is simply nothing to mirror */
                    if (++tries % 40 === 0) log('waiting for the game to create /_savedata...');
                    await new Promise(function (r) { setTimeout(r, 1500); });
                }
            }
            log('file system found - mirroring starts');
            var tick = function () {
                exportToLocalStorage().then(function () { WigdosXPSync.notifySaveDataChanged(); },
                    function () { /* store vanished (page teardown) - retry next tick */ });
            };
            tick();
            setInterval(tick, CONFIG.syncIntervalMs);
            WigdosXPSync.initialize();
        })();
    });

    /* public debug helpers (read-only) */
    window.UTMirror = {
        exportNow: exportToLocalStorage,
        deserialize: deserializeFromLocalStorage,
        read: function (key) {
            var raw = localStorage.getItem(CONFIG.localStoragePrefix + key);
            return raw === null ? null : deserializeFromLocalStorage(raw);
        }
    };
})();
