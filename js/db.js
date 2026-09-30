'use strict';
/* Cap 100 — stockage local IndexedDB avec cache mémoire.
   Sans compte, tout reste dans le navigateur. Avec un compte, js/cloud.js synchronise ces données avec ton serveur Firebase. */

const DB = (() => {
  const NAME = 'cap100';
  const VERSION = 2;
  const STORES = {
    settings: 'key',
    weights: 'date',
    measurements: 'date',
    days: 'date',
    foods: 'id',
    meals: 'id',
    favorites: 'id',
    activities: 'id',
    exercises: 'id',
    templates: 'id',
    habits: 'id',
    habitLogs: 'id',
    photos: 'id',
    recipes: 'id',
    plan: 'id',
    shopping: 'id'
  };
  const cache = {};
  for (const s in STORES) cache[s] = new Map();
  let idb = null;
  let rev = 0;
  let onError = () => {};
  let hook = null, silent = 0;
  const notify = (s, keys) => { if (hook && !silent && keys.length) { try { hook(s, keys); } catch (e) { console.error(e); } } };

  function open() {
    return new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open(NAME, VERSION); } catch (e) { rej(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [s, k] of Object.entries(STORES)) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: k });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
      req.onblocked = () => rej(new Error('blocked'));
    });
  }
  const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  async function init() {
    try {
      idb = await open();
      for (const s in STORES) {
        const all = await reqP(idb.transaction(s, 'readonly').objectStore(s).getAll());
        cache[s].clear();
        for (const o of all) cache[s].set(o[STORES[s]], o);
      }
    } catch (e) {
      console.warn('IndexedDB indisponible, stockage en mémoire uniquement', e);
      idb = null;
    }
    rev++;
    return !!idb;
  }

  function write(stores, fn) {
    rev++;
    if (!idb) return Promise.resolve();
    return new Promise((res, rej) => {
      let t;
      try { t = idb.transaction(stores, 'readwrite'); } catch (e) { onError(e); rej(e); return; }
      fn(t);
      t.oncomplete = () => res();
      t.onerror = () => { onError(t.error); rej(t.error); };
      t.onabort = () => { onError(t.error); rej(t.error); };
    }).catch(e => { console.error(e); });
  }

  const key = (s, o) => o[STORES[s]];
  const all = s => Array.from(cache[s].values());
  const get = (s, k) => cache[s].get(k);
  function putMany(s, arr) {
    for (const o of arr) cache[s].set(key(s, o), o);
    notify(s, arr.map(o => key(s, o)));
    return write([s], t => { const os = t.objectStore(s); for (const o of arr) os.put(o); });
  }
  const put = (s, o) => putMany(s, [o]);
  function delMany(s, keys) {
    for (const k of keys) cache[s].delete(k);
    notify(s, keys);
    return write([s], t => { const os = t.objectStore(s); for (const k of keys) os.delete(k); });
  }
  const del = (s, k) => delMany(s, [k]);
  function clear(s) { notify(s, [...cache[s].keys()]); cache[s].clear(); return write([s], t => t.objectStore(s).clear()); }
  function clearAll() {
    for (const s in STORES) { notify(s, [...cache[s].keys()]); cache[s].clear(); }
    return write(Object.keys(STORES), t => { for (const s in STORES) t.objectStore(s).clear(); });
  }
  const setting = (k, def) => { const o = cache.settings.get(k); return o ? o.value : def; };
  const setSetting = (k, value) => put('settings', { key: k, value });

  return {
    STORES, init, all,
    /* Synchronisation : écoute des changements locaux, et écriture « silencieuse » des données reçues du serveur */
    set hook(fn) { hook = fn; },
    quiet(fn) { silent++; try { return fn(); } finally { silent--; } }, // fn doit lancer ses écritures sans « await » intermédiaire
    get, put, putMany, del, delMany, clear, clearAll, setting, setSetting,
    get rev() { return rev; },
    get persistent() { return !!idb; },
    set onError(fn) { onError = fn; }
  };
})();
