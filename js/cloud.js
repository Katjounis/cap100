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
    offline: 'Pas de connexion internet.',
    BAD_CODE: 'Le code fait 8 caractères (lettres et chiffres).',
    NO_LIST: 'Aucune liste avec ce code. Vérifie-le avec la personne qui te l\'a envoyé.',
    OWN_LIST: 'C\'est ta propre liste : envoie ce code à la personne avec qui tu fais tes courses.',
    LIST_FULL: 'Cette liste est déjà partagée avec quelqu\'un d\'autre.'
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
    lout = ls.get(K('lout')) || {};
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
    if (!S || gate || LOCAL_ONLY.has(s) || (typeof D !== 'undefined' && D.isDemo && D.isDemo())) return;
    const L = s === 'shopping' && listCfg();
    for (const k of keys) { if (L) lout[lid(k)] = { k, n: ++seq }; else outbox[docId(s, k)] = { s, k, n: ++seq }; }
    saveOutbox(); saveLout();
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
        await pushList();
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
      if (!s || !DB.STORES[s] || LOCAL_ONLY.has(s) || (s === 'shopping' && listCfg())) continue;
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
        let lchanged = 0;
        if (listCfg()) { try { lchanged = await syncList(true); } catch (e) { if (e.offline) throw e; console.warn('Liste partagée :', e.code || e); } }
        ls.set('cap100-owner', S.uid);
        await push();
        fetchCommunity().catch(() => {});
        lastRun = Date.now();
        if (changed || lchanged) emit('data');
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

  /* ---------- liste de courses partagée à deux ---------- */
  /* lists/<code> : { o: propriétaire, on: son prénom, m: membre invité, mn: son prénom }. Connaître le code = être invité.
     Les articles sont dans lists/<code>/items : la liste locale « shopping » est alors synchronisée avec elle au lieu du compte. */
  const listCfg = () => { if (!S || typeof D === 'undefined') return null; const c = DB.setting('sharedList', null); return c && c.code ? c : null; };
  const lid = k => encodeURIComponent(JSON.stringify(k));
  let lout = S ? ls.get(K('lout')) || {} : {};
  const saveLout = () => S && ls.set(K('lout'), lout);
  const LISTS = code => `${DOC}/lists/${code}`;
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => { const a = new Uint32Array(8); crypto.getRandomValues(a); return [...a].map(x => ALPH[x % ALPH.length]).join(''); };
  async function getList(code) {
    try { const d = await http(`${FS}/lists/${code}`, null, { auth: true }); return { o: val(d.fields, 'o'), on: val(d.fields, 'on'), m: val(d.fields, 'm'), mn: val(d.fields, 'mn') }; }
    catch (e) { if (e.status === 404) return null; throw e; }
  }
  async function pushList() {
    const c = listCfg(); if (!c) return;
    const entries = Object.entries(lout);
    for (let i = 0; i < entries.length; i += 200) {
      const chunk = entries.slice(i, i + 200);
      const writes = chunk.map(([id, e]) => { const rec = DB.get('shopping', e.k); return { update: { name: `${LISTS(c.code)}/items/${id}`, fields: { k: str(JSON.stringify(e.k)), j: str(rec ? JSON.stringify(rec) : ''), d: { booleanValue: !rec } } }, updateTransforms: tsNow }; });
      try { await commit(writes); }
      catch (e) { if (e.status === 403 || e.status === 404) { await listGone(); return; } throw e; }
      for (const [id, e] of chunk) if (lout[id] && lout[id].n === e.n) delete lout[id];
      saveLout();
    }
  }
  async function pullList(full) {
    const c = listCfg(); if (!c) return { changed: 0, remote: new Set() };
    const key2 = K('lpull') + '-' + c.code;
    const meta = full ? {} : ls.get(key2) || {};
    const since = meta.t ? new Date(Date.parse(meta.t) - 60000).toISOString() : null;
    const remote = new Set(); let cursor = null, maxT = meta.t || null;
    const put = [], del = [];
    for (;;) {
      const q = { from: [{ collectionId: 'items' }], orderBy: [{ field: { fieldPath: 't' }, direction: 'ASCENDING' }, { field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: PAGE };
      if (since) q.where = { fieldFilter: { field: { fieldPath: 't' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: since } } };
      if (cursor) q.startAt = { values: [{ timestampValue: cursor.t }, { referenceValue: cursor.name }], before: false };
      const docs = await query(`/lists/${c.code}`, q);
      for (const d of docs) {
        const id = d.name.split('/').pop(); remote.add(id);
        if (lout[id]) continue;
        let k; try { k = JSON.parse(val(d.fields, 'k')); } catch (e) { continue; }
        const cur = DB.get('shopping', k), j = val(d.fields, 'j');
        if (val(d.fields, 'd') === true) { if (cur !== undefined) del.push(k); continue; }
        if (cur !== undefined && JSON.stringify(cur) === j) continue;
        try { put.push(JSON.parse(j)); } catch (e) { /* ignoré */ }
      }
      if (docs.length) { const last = docs[docs.length - 1]; cursor = { t: last.fields.t.timestampValue, name: last.name }; if (!maxT || Date.parse(cursor.t) > Date.parse(maxT)) maxT = cursor.t; }
      if (docs.length < PAGE) break;
    }
    ls.set(key2, { t: maxT });
    if (put.length || del.length) await DB.quiet(() => Promise.all([put.length ? DB.putMany('shopping', put) : null, del.length ? DB.delMany('shopping', del) : null]));
    return { changed: put.length + del.length, remote };
  }
  /* Vérifie que la liste existe toujours et que tu en fais partie, puis synchronise les articles */
  async function syncList(fromSync, seedLocal = false) {
    const c = listCfg(); if (!c) return 0;
    const L = await getList(c.code);
    if (!L || (c.role === 'member' && L.m !== S.uid) || (c.role === 'owner' && L.o !== S.uid)) { await listGone(L ? 'removed' : 'deleted'); return 1; }
    const partner = c.role === 'owner' ? L.mn || '' : L.on || '';
    if (partner !== (c.partner || '')) await DB.setSetting('sharedList', { ...c, partner });
    const first = !ls.get(K('lpull') + '-' + c.code);
    const { changed, remote } = await pullList(first);
    if (first) {
      const localOnly = DB.all('shopping').filter(o => !remote.has(lid(o.id)));
      if (seedLocal) { for (const o of localOnly) lout[lid(o.id)] = { k: o.id, n: ++seq }; saveLout(); }
      else if (localOnly.length) await DB.quiet(() => DB.delMany('shopping', localOnly.map(o => o.id))); // ancienne copie sur un autre appareil
    }
    if (!fromSync) { await pushList(); if (changed) emit('data'); emit('list'); }
    return changed;
  }
  async function listGone(why) {
    const c = listCfg(); if (!c) return;
    ls.del(K('lpull') + '-' + c.code); lout = {}; saveLout();
    await DB.setSetting('sharedList', null);
    emit('list'); emit('data');
    if (typeof UI !== 'undefined') UI.toast(c.role === 'member' ? `La liste partagée avec ${c.partner || 'ton proche'} a été arrêtée. Ta liste reste sur ton téléphone.` : 'Le partage de la liste est terminé. Ta liste reste sur ton téléphone.', { type: 'info', ms: 6000 });
  }
  async function listCreate() {
    const code = newCode();
    await commit([{ update: { name: LISTS(code), fields: { o: str(S.uid), on: str(S.name || 'Anonyme'), m: str(''), mn: str('') } }, updateTransforms: tsNow, currentDocument: { exists: false } }]);
    await DB.setSetting('sharedList', { code, role: 'owner', partner: '' });
    for (const o of DB.all('shopping')) lout[lid(o.id)] = { k: o.id, n: ++seq };
    saveLout(); ls.set(K('lpull') + '-' + code, { t: null });
    await pushList(); emit('list');
    return code;
  }
  async function listJoin(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) throw Object.assign(new Error('BAD_CODE'), { code: 'BAD_CODE' });
    const L = await getList(code);
    if (!L) throw Object.assign(new Error('NO_LIST'), { code: 'NO_LIST' });
    if (L.o === S.uid) throw Object.assign(new Error('OWN_LIST'), { code: 'OWN_LIST' });
    if (L.m && L.m !== S.uid) throw Object.assign(new Error('LIST_FULL'), { code: 'LIST_FULL' });
    if (L.m !== S.uid) await commit([{ update: { name: LISTS(code), fields: { m: str(S.uid), mn: str(S.name || 'Anonyme') } }, updateMask: { fieldPaths: ['m', 'mn'] }, updateTransforms: tsNow }]);
    await DB.setSetting('sharedList', { code, role: 'member', partner: L.on || '' });
    await syncList(false, true);
    return L.on;
  }
  async function listLeave() {
    const c = listCfg(); if (!c) return;
    try { await pushList(); } catch (e) { /* pas grave */ }
    if (c.role === 'owner') {
      for (;;) { const docs = await query(`/lists/${c.code}`, { from: [{ collectionId: 'items' }], select: { fields: [{ fieldPath: '__name__' }] }, limit: PAGE }); if (!docs.length) break; await commit(docs.map(d => ({ delete: d.name }))); }
      await commit([{ delete: LISTS(c.code) }]);
    } else await commit([{ update: { name: LISTS(c.code), fields: { m: str(''), mn: str('') } }, updateMask: { fieldPaths: ['m', 'mn'] }, updateTransforms: tsNow }]);
    ls.del(K('lpull') + '-' + c.code); lout = {}; saveLout();
    await DB.setSetting('sharedList', null);
    /* la liste locale redevient personnelle : on la renvoie sur ton compte */
    for (const o of DB.all('shopping')) outbox[docId('shopping', o.id)] = { s: 'shopping', k: o.id, n: ++seq };
    saveOutbox(); await push().catch(() => {});
    emit('list');
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
    ls.del('cap100-owner'); ls.del('cap100-community'); ls.del('cap100-reactions'); reacts = [];
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
    const rx = await query('', { from: [{ collectionId: 'reactions' }], where: { fieldFilter: { field: { fieldPath: 'u' }, op: 'EQUAL', value: str(S.uid) } } });
    if (rx.length) await commit(rx.map(d => ({ delete: d.name })));
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
    try { await fetchReactions(); } catch (e) { /* réactions indisponibles : la liste reste utilisable */ }
    ls.set('cap100-community', comm); commRev++; commCache = null;
    emit('community');
    return comm;
  }
  /* ---------- réactions : « j'aime », « j'ai testé », petit avis ---------- */
  let reacts = ls.get('cap100-reactions') || [];
  async function fetchReactions() {
    const docs = await query('', { from: [{ collectionId: 'reactions' }], limit: 3000 });
    reacts = docs.map(d => ({ id: d.name.split('/').pop(), c: val(d.fields, 'c'), u: val(d.fields, 'u'), a: val(d.fields, 'a'), liked: val(d.fields, 'liked') === true, tested: val(d.fields, 'tested') === true, note: val(d.fields, 'note') || '', t: val(d.fields, 't') }));
    ls.set('cap100-reactions', reacts);
  }
  function reactionsFor(docIdStr) {
    const arr = reacts.filter(x => x.c === docIdStr && (x.liked || x.tested || x.note));
    return { likes: arr.filter(x => x.liked).length, tested: arr.filter(x => x.tested).length, notes: arr.filter(x => x.note).sort((a, b) => (b.t || '') > (a.t || '') ? 1 : -1), mine: S ? arr.find(x => x.u === S.uid) || null : null, all: arr };
  }
  async function react(docIdStr, patch) {
    if (!S) throw Object.assign(new Error('signedout'), { code: 'signedout' });
    const cur = reacts.find(x => x.c === docIdStr && x.u === S.uid) || { liked: false, tested: false, note: '' };
    const next = { ...cur, ...patch };
    next.note = String(next.note || '').trim().slice(0, 280);
    const name = `${DOC}/reactions/${docIdStr}__${S.uid}`;
    if (!next.liked && !next.tested && !next.note) await commit([{ delete: name }]);
    else await commit([{ update: { name, fields: { c: str(docIdStr), u: str(S.uid), a: str(S.name || 'Anonyme'), liked: { booleanValue: !!next.liked }, tested: { booleanValue: !!next.tested }, note: str(next.note) } }, updateTransforms: tsNow }]);
    await fetchReactions(); commRev++; emit('community');
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
    sync, push, fetchCommunity, reactionsFor, react,
    list: () => listCfg(), listCreate, listJoin, listLeave, syncList, communityRecipes, communityRecipe, communityFood, publish, unpublish, removeCommunity,
    isAdmin: () => !!(S && C.adminEmail && S.email && S.email.toLowerCase() === String(C.adminEmail).toLowerCase()),
    frErr
  };
})();
