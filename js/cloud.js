'use strict';
/* Cap 100 — comptes, synchronisation et communauté (Firebase, offre gratuite Spark).
   Sans configuration (js/cloud-config.js vide), rien ne sort de l'appareil.
   Avec un compte : les données (sauf les photos) sont copiées dans users/<ton id>/items sur ton projet Firebase,
   protégées par les règles de sécurité (firebase/firestore.rules) ; les recettes partagées vont dans community/.
   Appels directs aux API REST de Firebase : pas de bibliothèque externe à charger. */

const Cloud = (() => {
  const C = window.CAP_CLOUD || {};
  const on = !!(C.apiKey && C.projectId);
  const EMU = C.emulator || {};
  const AUTH = (EMU.auth ? EMU.auth + '/' : 'https://') + 'identitytoolkit.googleapis.com/v1/accounts:';
  const TOKEN = (EMU.auth ? EMU.auth + '/' : 'https://') + 'securetoken.googleapis.com/v1/token';
  const DOC = `projects/${C.projectId}/databases/(default)/documents`;
  const FS = (EMU.firestore || 'https://firestore.googleapis.com') + '/v1/' + DOC;
  const LOCAL_ONLY = new Set(['photos']); // les photos ne quittent jamais l'appareil
  const PAGE = 300;

  /* ---------- petit stockage de session (localStorage) ---------- */
  const ls = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* rien */ } }
  };
  let S = on ? ls.get('cap100-session') : null; // { uid, email, name, idToken, refreshToken, exp }
  /* Juste après une connexion, rien n'est synchronisé tant que l'appareil n'a pas été préparé (données d'un autre compte, démo) */
  let gate = false;
  if (S && ls.get('cap100-gate')) { S = null; ls.del('cap100-session'); ls.del('cap100-gate'); }
  const K = k => `cap100-${k}-${S.uid}`;
  let outbox = S ? ls.get(K('outbox')) || {} : {};
  let seq = Date.now(); // numéro de version des entrées de la file (unique même après rechargement)
  let status = S ? 'idle' : 'signedout', lastSync = S ? ls.get(K('last')) : null, lastError = '';
  const listeners = [];
  const emit = (what) => listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } });
  const setStatus = st => { if (st !== status) { status = st; emit('status'); } };

  /* ---------- HTTP ---------- */
  const ERR_FR = {
    EMAIL_EXISTS: 'Un compte existe déjà avec cette adresse. Connecte-toi plutôt.',
    EMAIL_NOT_FOUND: 'Adresse ou mot de passe incorrect.',
    INVALID_PASSWORD: 'Adresse ou mot de passe incorrect.',
    INVALID_LOGIN_CREDENTIALS: 'Adresse ou mot de passe incorrect.',
    INVALID_EMAIL: 'Adresse e-mail invalide.',
    MISSING_PASSWORD: 'Mot de passe manquant.',
    WEAK_PASSWORD: 'Mot de passe trop court : 6 caractères minimum.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Trop de tentatives. Réessaie dans quelques minutes.',
    USER_DISABLED: 'Ce compte a été désactivé.',
    OPERATION_NOT_ALLOWED: 'Les inscriptions par e-mail ne sont pas activées sur le projet Firebase.',
    ADMIN_ONLY_OPERATION: 'Les nouvelles inscriptions sont fermées.',
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Reconnecte-toi puis recommence.',
    PERMISSION_DENIED: 'Accès refusé par le serveur (règles de sécurité).',
    offline: 'Pas de connexion internet.'
  };
  const frErr = e => { const c = String((e && (e.code || e.message)) || ''); const key = Object.keys(ERR_FR).find(k => c.startsWith(k)); return key ? ERR_FR[key] : 'Erreur du serveur (' + c + ')'; };

  async function http(url, body, o = {}) {
    let r;
    const headers = {};
    if (body != null) headers['Content-Type'] = o.form ? 'application/x-www-form-urlencoded' : 'application/json';
    if (o.auth) headers.Authorization = 'Bearer ' + await idToken(o.forceRefresh);
    try { r = await fetch(url, { method: body != null ? 'POST' : 'GET', headers, body: body == null ? undefined : o.form ? body : JSON.stringify(body) }); }
    catch (e) { const err = new Error('offline'); err.code = 'offline'; err.offline = true; throw err; }
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { /* réponse non JSON */ }
    if (!r.ok) {
      if (r.status === 401 && o.auth && !o.forceRefresh) return http(url, body, { ...o, forceRefresh: true });
      const err = new Error((j && j.error && (j.error.message || j.error.status)) || 'HTTP ' + r.status);
      err.code = (j && j.error && (j.error.message || j.error.status)) || 'HTTP_' + r.status; err.status = r.status; throw err;
    }
    return j;
  }
  const key = () => '?key=' + encodeURIComponent(C.apiKey);

  /* ---------- session ---------- */
  function setSession(j, name) {
    const uid = j.localId || j.user_id;
    S = { uid, email: j.email || (S && S.email), name: j.displayName || name || (S && S.name) || '', idToken: j.idToken || j.id_token, refreshToken: j.refreshToken || j.refresh_token, exp: Date.now() + (+(j.expiresIn || j.expires_in) || 3600) * 1000 };
    ls.set('cap100-session', S);
    outbox = ls.get(K('outbox')) || {};
    lastSync = ls.get(K('last'));
  }
  async function idToken(force) {
    if (!S) throw Object.assign(new Error('signedout'), { code: 'signedout' });
    if (!force && S.exp - 120000 > Date.now()) return S.idToken;
    try {
      const j = await http(TOKEN + key(), 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(S.refreshToken), { form: true });
      S.idToken = j.id_token; S.refreshToken = j.refresh_token; S.exp = Date.now() + (+j.expires_in || 3600) * 1000;
      ls.set('cap100-session', S);
      return S.idToken;
    } catch (e) {
      if (!e.offline && /TOKEN_EXPIRED|USER_NOT_FOUND|USER_DISABLED|INVALID_REFRESH_TOKEN|INVALID_GRANT/.test(e.code)) expire();
      throw e;
    }
  }
  function expire() {
    S = null; ls.del('cap100-session'); setStatus('signedout'); emit('session');
    if (window.UI) UI.toast('Session expirée : reconnecte-toi dans Réglages pour reprendre la synchronisation', { type: 'err', ms: 7000 });
  }

  /* ---------- valeurs Firestore ---------- */
  const str = v => ({ stringValue: String(v) });
  const docId = (s, k) => s + '~' + encodeURIComponent(JSON.stringify(k));
  const tsNow = [{ fieldPath: 't', setToServerValue: 'REQUEST_TIME' }];
  const val = (f, k) => f && f[k] ? (f[k].stringValue ?? f[k].booleanValue ?? f[k].timestampValue ?? f[k].integerValue) : undefined;
  const commit = writes => http(FS + ':commit', { writes }, { auth: true });
  const query = (parent, q) => http(FS + parent + ':runQuery', { structuredQuery: q }, { auth: true }).then(r => (r || []).filter(x => x.document).map(x => x.document));

  /* ---------- file d'envoi : changements locaux à copier sur le serveur ---------- */
  let pushTimer = null;
  const saveOutbox = () => S && ls.set(K('outbox'), outbox);
  DB.hook = (s, keys) => {
    if (!S || gate || LOCAL_ONLY.has(s) || (window.D && D.isDemo && D.isDemo())) return;
    for (const k of keys) outbox[docId(s, k)] = { s, k, n: ++seq };
    saveOutbox();
    clearTimeout(pushTimer); pushTimer = setTimeout(() => push().catch(() => {}), 1500);
    if (status === 'ok' || status === 'idle') setStatus('pending');
  };

  let pushing = null, again = false;
  function push() {
    if (!S || gate) return Promise.resolve();
    if (pushing) { again = true; return pushing; }
    pushing = (async () => {
      try {
        do {
          again = false;
          const entries = Object.entries(outbox);
          for (let i = 0; i < entries.length; i += 200) {
            const chunk = entries.slice(i, i + 200), writes = [];
            for (const [id, e] of chunk) {
              const rec = DB.get(e.s, e.k), j = rec ? JSON.stringify(rec) : '';
              if (j.length > 900000) { console.warn('Élément trop gros pour la synchronisation', e.s, e.k); continue; }
              writes.push({ update: { name: `${DOC}/users/${S.uid}/items/${id}`, fields: { s: str(e.s), k: str(JSON.stringify(e.k)), j: str(j), d: { booleanValue: !rec } } }, updateTransforms: tsNow });
            }
            if (writes.length) await commit(writes);
            for (const [id, e] of chunk) if (outbox[id] && outbox[id].n === e.n) delete outbox[id];
            saveOutbox();
          }
        } while (again && S);
        await flushPublications();
        lastSync = Date.now(); if (S) ls.set(K('last'), lastSync);
        setStatus('ok');
      } catch (e) { fail(e); throw e; }
      finally { pushing = null; }
    })();
    return pushing;
  }
  function fail(e) {
    lastError = frErr(e);
    setStatus(!S ? 'signedout' : e.offline || !navigator.onLine ? 'offline' : 'error');
    if (!e.offline) console.warn('Synchronisation :', e.code || e);
  }

  /* ---------- réception : changements faits sur un autre appareil ---------- */
  async function pull(full) {
    const meta = full ? {} : ls.get(K('pull')) || {};
    const since = meta.t ? new Date(Date.parse(meta.t) - 60000).toISOString() : null; // marge : écritures arrivées en décalé
    const remote = new Set();
    let cursor = null, maxT = meta.t || null, changed = 0;
    for (;;) {
      const q = { from: [{ collectionId: 'items' }], orderBy: [{ field: { fieldPath: 't' }, direction: 'ASCENDING' }, { field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: PAGE };
      if (since) q.where = { fieldFilter: { field: { fieldPath: 't' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: since } } };
      if (cursor) q.startAt = { values: [{ timestampValue: cursor.t }, { referenceValue: cursor.name }], before: false };
      const docs = await query(`/users/${S.uid}`, q);
      changed += await apply(docs, remote);
      if (docs.length) {
        const last = docs[docs.length - 1];
        cursor = { t: last.fields.t.timestampValue, name: last.name };
        if (!maxT || Date.parse(cursor.t) > Date.parse(maxT)) maxT = cursor.t;
      }
      if (docs.length < PAGE) break;
    }
    ls.set(K('pull'), { t: maxT });
    return { changed, remote };
  }
  function apply(docs, remote) {
    const put = {}, del = {};
    let n = 0;
    for (const d of docs) {
      const id = d.name.split('/').pop(); remote.add(id);
      if (outbox[id]) continue; // modification locale en attente : elle est plus récente
      const f = d.fields || {}, s = val(f, 's');
      if (!s || !DB.STORES[s] || LOCAL_ONLY.has(s)) continue;
      let k; try { k = JSON.parse(val(f, 'k')); } catch (e) { continue; }
      const cur = DB.get(s, k);
      if (val(f, 'd') === true) { if (cur !== undefined) { (del[s] = del[s] || []).push(k); n++; } continue; }
      const j = val(f, 'j');
      if (cur !== undefined && JSON.stringify(cur) === j) continue;
      try { (put[s] = put[s] || []).push(JSON.parse(j)); n++; } catch (e) { /* ignoré */ }
    }
    if (!n) return Promise.resolve(0);
    return DB.quiet(() => Promise.all([
      ...Object.entries(put).map(([s, a]) => DB.putMany(s, a)),
      ...Object.entries(del).map(([s, a]) => DB.delMany(s, a))
    ])).then(() => n);
  }

  /* ---------- synchronisation complète ---------- */
  let syncing = null, lastRun = 0;
  function sync() {
    if (!S || gate) return Promise.resolve();
    if (syncing) return syncing;
    syncing = (async () => {
      setStatus('sync');
      try {
        const first = !ls.get(K('pull'));
        const { changed, remote } = await pull(first);
        if (first) seed(remote);
        ls.set('cap100-owner', S.uid);
        await push();
        fetchCommunity().catch(() => {});
        lastRun = Date.now();
        if (changed) emit('data');
        return changed;
      } catch (e) { fail(e); throw e; }
      finally { syncing = null; }
    })();
    return syncing;
  }
  /* Première connexion sur cet appareil : ce qui n'existe que localement part sur le serveur */
  function seed(remote) {
    if (D.isDemo && D.isDemo()) return;
    for (const s in DB.STORES) {
      if (LOCAL_ONLY.has(s)) continue;
      for (const o of DB.all(s)) { const k = o[DB.STORES[s]], id = docId(s, k); if (!remote.has(id)) outbox[id] = { s, k, n: ++seq }; }
    }
    saveOutbox();
  }

  /* ---------- comptes ---------- */
  async function signUp(name, email, password) {
    const j = await http(AUTH + 'signUp' + key(), { email, password, returnSecureToken: true });
    hold();
    setSession(j, name);
    const u = await http(AUTH + 'update' + key(), { idToken: S.idToken, displayName: name, returnSecureToken: true });
    setSession({ ...j, ...u, localId: j.localId }, name);
    emit('session');
    return S;
  }
  async function signIn(email, password) {
    const j = await http(AUTH + 'signInWithPassword' + key(), { email, password, returnSecureToken: true });
    hold();
    setSession(j);
    if (!S.name) { try { const l = await http(AUTH + 'lookup' + key(), { idToken: S.idToken }); const u = l && l.users && l.users[0]; if (u && u.displayName) { S.name = u.displayName; ls.set('cap100-session', S); } } catch (e) { /* prénom facultatif */ } }
    emit('session');
    return S;
  }
  function hold() { gate = true; ls.set('cap100-gate', 1); }
  function release() { gate = false; ls.del('cap100-gate'); }
  const resetPassword = email => http(AUTH + 'sendOobCode' + key(), { requestType: 'PASSWORD_RESET', email });
  const ownerMismatch = () => { const o = ls.get('cap100-owner'); return !!(S && o && o !== S.uid); };
  /* Efface les données locales sans les propager au serveur */
  function wipeLocal() {
    const uid = S && S.uid;
    const p = DB.quiet(() => DB.clearAll());
    ls.del('cap100-owner'); ls.del('cap100-community');
    if (uid) { ls.del(`cap100-pull-${uid}`); ls.del(`cap100-outbox-${uid}`); outbox = {}; }
    return p;
  }
  async function signOut(wipe) {
    try { await push(); } catch (e) { /* hors ligne : voir pending() avant d'appeler */ }
    if (wipe) await wipeLocal();
    S = null; ls.del('cap100-session'); outbox = {}; release();
    setStatus('signedout'); emit('session');
  }
  async function rename(name) {
    const u = await http(AUTH + 'update' + key(), { idToken: await idToken(), displayName: name, returnSecureToken: true });
    setSession({ ...u, localId: S.uid }, name); S.name = name; ls.set('cap100-session', S);
    const mine = comm.filter(c => c.u === S.uid);
    if (mine.length) await commit(mine.map(c => ({ update: { name: `${DOC}/community/${c.id}`, fields: { a: str(name) } }, updateMask: { fieldPaths: ['a'] }, updateTransforms: tsNow })));
    await fetchCommunity().catch(() => {});
    emit('session');
  }
  async function deleteAccount(password) {
    setSession(await http(AUTH + 'signInWithPassword' + key(), { email: S.email, password, returnSecureToken: true }));
    for (;;) {
      const docs = await query(`/users/${S.uid}`, { from: [{ collectionId: 'items' }], select: { fields: [{ fieldPath: '__name__' }] }, limit: PAGE });
      if (!docs.length) break;
      await commit(docs.map(d => ({ delete: d.name })));
    }
    const pubs = await query('', { from: [{ collectionId: 'community' }], where: { fieldFilter: { field: { fieldPath: 'u' }, op: 'EQUAL', value: str(S.uid) } } });
    if (pubs.length) await commit(pubs.map(d => ({ delete: d.name })));
    await http(AUTH + 'delete' + key(), { idToken: S.idToken });
    await wipeLocal();
    S = null; ls.del('cap100-session'); setStatus('signedout'); emit('session');
  }

  /* ---------- communauté ---------- */
  let comm = ls.get('cap100-community') || [], commRev = 0, commCache = null;
  const recipeCache = new Map(), foodCache = new Map();
  let baseIds = null;
  const isBase = id => { if (!baseIds) baseIds = new Set(D.BASE_FOODS.map(f => f.id)); return baseIds.has(id); };
  async function fetchCommunity() {
    if (!S) return comm;
    const docs = await query('', { from: [{ collectionId: 'community' }], orderBy: [{ field: { fieldPath: 't' }, direction: 'DESCENDING' }], limit: 500 });
    comm = docs.map(d => ({ id: d.name.split('/').pop(), u: val(d.fields, 'u'), a: val(d.fields, 'a'), t: val(d.fields, 't'), j: val(d.fields, 'j'), rid: val(d.fields, 'rid') }));
    ls.set('cap100-community', comm); commRev++; commCache = null;
    emit('community');
    return comm;
  }
  function toRecipe(c) {
    let o; try { o = JSON.parse(c.j); } catch (e) { return null; }
    const id = 'cm-' + c.id;
    const ing = (o.ing || []).map((i, n) => {
      if (i.foodId && isBase(i.foodId)) return { foodId: i.foodId, g: +i.g || 0 };
      const fid = `cmf-${c.id}-${n}`, s = i.snap || {};
      foodCache.set(fid, { id: fid, name: String(s.name || 'Ingrédient'), kcal: +s.kcal || 0, p: +s.p || 0, c: +s.c || 0, f: +s.f || 0, ...['sug', 'fib', 'sat', 'salt'].reduce((a, k) => (s[k] != null ? { ...a, [k]: +s[k] } : a), {}), portion: +s.portion || 100, base: true, aisle: s.aisle || 'au', community: true });
      return { foodId: fid, g: +i.g || 0 };
    });
    return {
      id, name: String(o.name || 'Recette').slice(0, 120), cat: D.CAT_SLOTS[o.cat] ? o.cat : 'plat', time: +o.time || null, tags: Array.isArray(o.tags) ? o.tags.filter(t => D.RECIPE_TAGS[t]) : [],
      ing, steps: Array.isArray(o.steps) ? o.steps.map(String) : [], pantry: Array.isArray(o.pantry) ? o.pantry.map(String) : [], tip: String(o.tip || ''),
      base: true, community: true, author: c.a, authorUid: c.u, mine: !!(S && c.u === S.uid), rid: c.rid, docId: c.id, at: c.t, v: Date.parse(c.t) || 0
    };
  }
  function communityRecipes() {
    if (!commCache) { recipeCache.clear(); commCache = comm.map(toRecipe).filter(Boolean); commCache.forEach(r => recipeCache.set(r.id, r)); }
    return commCache;
  }
  const communityRecipe = id => { communityRecipes(); return recipeCache.get(id); };
  const communityFood = id => { communityRecipes(); return foodCache.get(id); };

  const pubKey = () => S ? K('pub') : null;
  function payload(r) {
    return JSON.stringify({
      name: r.name, cat: r.cat, time: r.time, tags: r.tags || [], steps: r.steps || [], pantry: r.pantry || [], tip: r.tip || '',
      ing: r.ing.map(i => {
        if (isBase(i.foodId)) return { foodId: i.foodId, g: i.g };
        const f = D.food(i.foodId) || {};
        const snap = { name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, portion: f.portion, aisle: f.aisle };
        ['sug', 'fib', 'sat', 'salt'].forEach(k => { if (f[k] != null) snap[k] = f[k]; });
        return { g: i.g, snap };
      })
    });
  }
  /* Publier / retirer : mis en file puis envoyé (fonctionne aussi hors connexion, envoyé au retour du réseau) */
  function queuePub(rid, op) { if (!S) return; const q = ls.get(pubKey()) || {}; q[rid] = op; ls.set(pubKey(), q); return push().catch(() => {}); }
  async function flushPublications() {
    if (!S) return;
    const q = ls.get(pubKey()) || {};
    const ids = Object.keys(q); if (!ids.length) return;
    const writes = [];
    for (const rid of ids) {
      const name = `${DOC}/community/${S.uid}_${rid}`;
      const r = DB.get('recipes', rid);
      if (q[rid] === 'pub' && r) writes.push({ update: { name, fields: { u: str(S.uid), a: str(S.name || 'Anonyme'), j: str(payload(r)), rid: str(rid) } }, updateTransforms: tsNow });
      else writes.push({ delete: name });
    }
    await commit(writes);
    const q2 = ls.get(pubKey()) || {};
    for (const rid of ids) if (q2[rid] === q[rid]) delete q2[rid];
    ls.set(pubKey(), q2);
    await fetchCommunity().catch(() => {});
  }
  const publish = r => queuePub(r.id, 'pub');
  const unpublish = rid => queuePub(rid, 'unpub');
  /* Suppression par l'administrateur (autorisée par les règles pour l'e-mail admin) */
  async function removeCommunity(docIdStr) { await commit([{ delete: `${DOC}/community/${docIdStr}` }]); await fetchCommunity(); }

  /* ---------- déclencheurs ---------- */
  if (on) {
    window.addEventListener('online', () => sync().catch(() => {}));
    window.addEventListener('offline', () => S && setStatus('offline'));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S && Date.now() - lastRun > 30000) sync().catch(() => {}); });
    setInterval(() => { if (document.visibilityState === 'visible' && S) sync().catch(() => {}); }, 5 * 60000);
  }

  return {
    get on() { return on; },
    get user() { return S ? { uid: S.uid, email: S.email, name: S.name } : null; },
    get status() { return status; },
    get lastSync() { return lastSync; },
    get lastError() { return lastError; },
    get commRev() { return commRev; },
    pending: () => Object.keys(outbox).length + Object.keys((S && ls.get(pubKey())) || {}).length,
    listen: fn => listeners.push(fn),
    signUp, signIn, signOut, release, resetPassword, rename, deleteAccount, ownerMismatch, wipeLocal,
    sync, push, fetchCommunity, communityRecipes, communityRecipe, communityFood, publish, unpublish, removeCommunity,
    isAdmin: () => !!(S && C.adminEmail && S.email && S.email.toLowerCase() === String(C.adminEmail).toLowerCase()),
    frErr
  };
})();
