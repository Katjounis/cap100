'use strict';
/* Cap 100 — interface des comptes : inscription, connexion, état de synchronisation, onglet Communauté. */

/* Recettes et ingrédients de la communauté : résolus comme les autres */
{
  const recipe = D.recipe, food = D.food;
  D.recipe = id => typeof id === 'string' && id.startsWith('cm-') ? Cloud.communityRecipe(id) : recipe(id);
  D.food = id => typeof id === 'string' && id.startsWith('cmf-') ? Cloud.communityFood(id) : food(id);
}

const Acc = {
  ago(ts) {
    if (!ts) return 'jamais';
    const s = Math.round((Date.now() - (typeof ts === 'number' ? ts : Date.parse(ts))) / 1000);
    if (s < 45) return 'à l\'instant';
    if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
    const d = Math.round(s / 86400); return d === 1 ? 'hier' : `il y a ${d} jours`;
  },
  statusInfo() {
    const st = Cloud.status, n = Cloud.pending();
    if (!Cloud.user) return { ic: 'lock', c: 'var(--ink-3)', t: 'Sans compte', s: 'Données sur cet appareil uniquement' };
    if (st === 'sync') return { ic: 'repeat', c: 'var(--accent)', t: 'Synchronisation…', s: '' };
    if (st === 'offline') return { ic: 'ban', c: 'var(--goal)', t: 'Hors connexion', s: n ? `${n} modification${n > 1 ? 's' : ''} en attente, envoi au retour du réseau` : 'Tout sera synchronisé au retour du réseau' };
    if (st === 'error') return { ic: 'info', c: 'var(--bad, #d33)', t: 'Synchronisation en échec', s: Cloud.lastError };
    if (n) return { ic: 'repeat', c: 'var(--accent)', t: 'Envoi en cours', s: `${n} modification${n > 1 ? 's' : ''} à envoyer` };
    return { ic: 'check', c: 'var(--good)', t: 'Synchronisé', s: Acc.ago(Cloud.lastSync) };
  },
  chip() {
    if (!Cloud.on) return '';
    if (!Cloud.user) return `<button class="cloud-chip off" data-act="accOpen" data-mode="signup">${U.icon('shield', 'sm')}<span><b>Sauvegarder mes données</b><small>Créer un compte gratuit</small></span></button>`;
    const i = Acc.statusInfo();
    return `<a class="cloud-chip" href="#reglages" title="${U.esc(i.s)}">${U.icon(i.ic, 'sm')}<span><b style="color:${i.c}">${i.t}</b><small>${U.esc(Cloud.user.name || Cloud.user.email)}</small></span></a>`;
  },
  card() {
    if (!Cloud.on) return '';
    const u = Cloud.user;
    if (!u) return `<section class="card acc-card"><div class="card-h"><span class="ic-badge sm" style="--c:var(--accent)">${U.icon('shield')}</span><h2>Compte</h2></div>
      <div class="stack"><p class="small muted" style="margin:0">Avec un compte gratuit, tes données sont sauvegardées en ligne et te suivent sur tous tes appareils : tu peux effacer ton navigateur ou changer de téléphone sans rien perdre. Tu accèdes aussi aux recettes de la <b>communauté</b>.</p>
      <div class="row wrap"><button class="btn primary" data-act="accOpen" data-mode="signup">${U.icon('plus', 'sm')}Créer mon compte</button><button class="btn" data-act="accOpen" data-mode="login">Se connecter</button></div>
      <p class="xs faint" style="margin:0">Tes données actuelles seront envoyées sur ton compte à la création. Les photos restent sur cet appareil.</p></div></section>`;
    const i = Acc.statusInfo();
    return `<section class="card acc-card"><div class="card-h"><span class="ic-badge sm" style="--c:var(--accent)">${U.icon('shield')}</span><h2>Compte</h2><span class="spacer"></span><span class="pill" style="color:${i.c}">${U.icon(i.ic, 'sm')}${i.t}</span></div>
      <div class="stack">
        <div class="list"><div class="li"><span class="grow"><span class="t">${U.esc(u.name || '—')}</span><span class="s">${U.esc(u.email)}</span></span><button class="btn sm ghost" data-act="accRename">${U.icon('edit', 'sm')}Prénom</button></div>
          <div class="li"><span class="grow"><span class="t">Dernière synchronisation</span><span class="s">${U.esc(i.s || Acc.ago(Cloud.lastSync))}</span></span><button class="btn sm" data-act="accSync">${U.icon('repeat', 'sm')}Synchroniser</button></div></div>
        <p class="xs faint" style="margin:0">Tes données sont copiées sur le serveur Firebase de Cap 100 (Europe), visibles par toi seul. Tes photos restent sur cet appareil. Ton prénom apparaît sur les recettes que tu partages.</p>
        <div class="row wrap"><button class="btn" data-act="accSignOut">Se déconnecter</button><button class="btn ghost" data-act="privacy">Confidentialité</button><span class="grow"></span><button class="btn ghost danger sm" data-act="accDelete">${U.icon('trash', 'sm')}Supprimer mon compte</button></div>
      </div></section>`;
  },
  dataNote() {
    if (Cloud.user) return `<div class="note">${U.icon('shield', 'sm')}<span>Tes données sont <b>sauvegardées sur ton compte</b> et synchronisées entre tes appareils. Les <b>photos</b> restent uniquement sur cet appareil : inclus-les dans un export de temps en temps.</span></div>`;
    return `<div class="note">${U.icon('lock', 'sm')}<span>Tout est enregistré <b>uniquement dans ce navigateur</b> (IndexedDB). Si tu effaces les données du navigateur, elles disparaissent.${Cloud.on ? ' Crée un compte (section Compte) pour les sauvegarder en ligne, ou exporte régulièrement.' : ' Exporte régulièrement une sauvegarde.'}</span></div>`;
  },
  welcome() {
    return `<div class="stack"><button class="ob-choice" data-act="accOpen" data-mode="signup"><span class="ic-badge" style="--c:var(--accent)">${U.icon('flag')}</span><span class="grow"><b>Créer mon compte</b><span>Prénom, e-mail, mot de passe. Tes données te suivent sur tous tes appareils.</span></span>${U.icon('chevR')}</button>
        <button class="ob-choice" data-act="accOpen" data-mode="login"><span class="ic-badge" style="--c:var(--goal)">${U.icon('lock')}</span><span class="grow"><b>J'ai déjà un compte</b><span>Récupère tes données sur cet appareil.</span></span>${U.icon('chevR')}</button></div>
      <div class="row wrap" style="gap:6px 16px;justify-content:center"><button class="btn ghost sm" data-act="obMine">Continuer sans compte</button><button class="btn ghost sm" data-act="obDemo">${U.icon('sparkle', 'sm')}Voir la démo</button></div>
      <div class="note">${U.icon('shield', 'sm')}<span>Tes photos restent toujours sur ton téléphone. Sans compte, tout reste dans ce navigateur.</span></div>`;
  },

  /* ---------- formulaire d'inscription / connexion ---------- */
  open(mode = 'signup') {
    const st = { mode, busy: false, err: '', name: (D.profile() || {}).name || '', email: '' };
    UI.open({
      title: mode === 'signup' ? 'Créer mon compte' : 'Se connecter', sub: mode === 'signup' ? 'Gratuit, pour toi et tes proches' : 'Retrouve tes données', size: 'sm',
      body: () => st.busy === 'sync' ? `<div class="stack" style="align-items:center;padding:24px 0;text-align:center"><div class="spin"></div><b>Synchronisation de tes données…</b><span class="small muted">Quelques secondes.</span></div>` : `<form id="acc-f" class="stack" autocomplete="on">
        ${st.mode === 'signup' ? `<label class="field"><span>Prénom</span><input id="acc-name" autocomplete="given-name" value="${U.esc(st.name)}" placeholder="Affiché sur tes recettes partagées" maxlength="40"></label>` : ''}
        <label class="field"><span>Adresse e-mail</span><input id="acc-email" type="email" autocomplete="email" inputmode="email" value="${U.esc(st.email)}" placeholder="toi@exemple.fr"></label>
        <label class="field"><span>Mot de passe ${st.mode === 'signup' ? '<small>(6 caractères minimum)</small>' : ''}</span><input id="acc-pw" type="password" autocomplete="${st.mode === 'signup' ? 'new-password' : 'current-password'}" value="${U.esc(st.pw || '')}"></label>
        ${st.mode === 'signup' ? `<label class="row small" style="align-items:flex-start;gap:10px"><span class="switch" style="flex:none"><input type="checkbox" id="acc-ok"><span></span></span><span>J'accepte que mes données (poids, repas, séances, mensurations) soient enregistrées sur le serveur de Cap 100 pour être synchronisées entre mes appareils. Mes photos restent sur mon appareil. <button type="button" class="linkish" data-act="privacy">En savoir plus</button></span></label>` : `<button type="button" class="linkish small" data-act="accReset" style="align-self:flex-start">Mot de passe oublié ?</button>`}
        ${st.err ? `<div class="note warn" role="alert">${U.icon('info', 'sm')}<span>${U.esc(st.err)}</span></div>` : ''}
        <button type="submit" hidden></button>
        <p class="small muted" style="margin:0;text-align:center">${st.mode === 'signup' ? 'Déjà inscrit ?' : 'Pas encore de compte ?'} <button type="button" class="linkish" data-accmode="${st.mode === 'signup' ? 'login' : 'signup'}">${st.mode === 'signup' ? 'Se connecter' : 'Créer un compte'}</button></p></form>`,
      footer: () => st.busy === 'sync' ? '' : `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="accSubmit" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Un instant…' : st.mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}</button>`,
      onMount: m => {
        m.st = st;
        m.read = () => { const g = id => m.el.querySelector(id); if (g('#acc-name')) st.name = g('#acc-name').value.trim(); if (g('#acc-email')) st.email = g('#acc-email').value.trim(); if (g('#acc-pw')) st.pw = g('#acc-pw').value; };
        const f = m.el.querySelector('#acc-f'); if (f) f.addEventListener('submit', e => { e.preventDefault(); A.accSubmit(); });
        m.el.querySelectorAll('[data-accmode]').forEach(b => b.addEventListener('click', () => { m.read(); st.mode = b.dataset.accmode; st.err = ''; m.opts.title = st.mode === 'signup' ? 'Créer mon compte' : 'Se connecter'; m.render(); }));
      }
    });
  },
  async afterAuth(m) {
    const st = m.st;
    if (D.isDemo()) await Cloud.wipeLocal();
    else if (Cloud.ownerMismatch()) {
      const ok = await UI.confirm({ title: 'Données d\'un autre compte', text: 'Cet appareil contient les données d\'un autre compte Cap 100. Elles vont être retirées de cet appareil (elles restent sauvegardées sur leur compte), puis remplacées par les tiennes.', ok: 'Continuer' });
      if (!ok) { await Cloud.signOut(false); st.busy = false; m.render(); return; }
      await Cloud.wipeLocal();
    }
    Cloud.release();
    st.busy = 'sync'; m.render();
    try { await Cloud.sync(); }
    catch (e) { UI.toast('Synchronisation impossible pour l\'instant : nouvel essai automatique', { type: 'info', ms: 5000 }); }
    UI.closeAll();
    const name = Cloud.user && Cloud.user.name;
    const prof = DB.setting('profile', null);
    if (name && prof && !prof.name) await DB.setSetting('profile', { ...prof, name });
    if (!D.meta().onboarded) {
      OB.start(1);
      UI.toast(`Compte prêt${name ? ', ' + name : ''} : encore 3 petites étapes`, { type: 'ok' });
    } else {
      OB.close(); App.boot();
      UI.toast(st.mode === 'signup' ? `Compte créé : tes données sont sauvegardées${name ? ', ' + name : ''}` : `Bon retour${name ? ' ' + name : ''} : tes données sont à jour`, { type: 'ok', ms: 4500 });
    }
  },

  /* ---------- onglet Communauté ---------- */
  tab() {
    if (!Cloud.on) return `<div class="card">${UI.empty('smile', 'Communauté indisponible ici', 'La communauté fonctionne dans l\'application en ligne, une fois le serveur Firebase configuré (voir le guide).')}</div>`;
    if (!Cloud.user) return `<div class="card">${UI.empty('smile', 'Les recettes de tes proches', 'Crée un compte gratuit pour voir les recettes partagées par les autres et partager les tiennes, avec ton prénom.', `<button class="btn primary" data-act="accOpen" data-mode="signup">Créer mon compte</button><button class="btn" data-act="accOpen" data-mode="login">Se connecter</button>`)}</div>`;
    const p = Pages.nutrition, q = U.norm(p.cq || '').split(/\s+/).filter(Boolean);
    const all = Cloud.communityRecipes();
    const people = [...new Set(all.map(r => r.author))].filter(Boolean);
    const list = all.filter(r => (!p.cwho || r.author === p.cwho) && (!q.length || q.every(t => U.norm(r.name + ' ' + r.author).includes(t))));
    if (p.csort === 'top') { const sc = r => { const x = Cloud.reactionsFor(r.docId); return x.tested * 2 + x.likes; }; list.sort((a, b) => sc(b) - sc(a)); }
    return `<div class="stack" style="gap:14px">
      <div class="row wrap"><div class="input-unit grow" style="min-width:200px;max-width:420px"><input class="input" id="cq" placeholder="Rechercher une recette ou un prénom" value="${U.esc(p.cq || '')}" autocomplete="off"><em>${U.icon('search', 'sm')}</em></div><div class="seg"><button data-act="commSort" data-v="" class="${!p.csort ? 'on' : ''}">Récentes</button><button data-act="commSort" data-v="top" class="${p.csort === 'top' ? 'on' : ''}">Les plus testées</button></div><button class="btn sm ghost" data-act="commRefresh">${U.icon('repeat', 'sm')}Actualiser</button></div>
      ${people.length > 1 ? `<div class="chips scroll"><button class="chip ${!p.cwho ? 'on' : ''}" data-act="commWho" data-v="">Tout le monde</button>${people.map(n => `<button class="chip ${p.cwho === n ? 'on' : ''}" data-act="commWho" data-v="${U.esc(n)}">${U.esc(n)}</button>`).join('')}</div>` : ''}
      <div class="grid g-3 recipe-grid" id="cgrid">${list.length ? list.map(r => recipeCard(r)).join('') : `<div class="card" style="grid-column:1/-1">${UI.empty('smile', all.length ? 'Aucune recette ne correspond' : 'Pas encore de recette partagée', all.length ? 'Essaie un autre mot.' : 'Crée une recette : elle apparaîtra ici avec ton prénom, pour tous les inscrits.', `<button class="btn primary" data-act="recipeNew">${U.icon('plus', 'sm')}Créer une recette</button>`)}</div>`}</div>
    </div>`;
  },
  /* Liste de courses partagée */
  shareCard() {
    if (!Cloud.on) return '';
    if (!Cloud.user) return `<div class="note share-note">${U.icon('smile', 'sm')}<span>Tu fais tes courses à deux ? Avec un compte, tu peux partager cette liste avec une personne de ton choix. <button class="linkish" data-act="accOpen" data-mode="signup">Créer mon compte</button></span></div>`;
    const c = Cloud.list();
    if (!c) return `<section class="card share-card"><div class="row wrap" style="gap:12px"><span class="ic-badge" style="--c:var(--c-walk)">${U.icon('smile')}</span>
      <div class="grow" style="min-width:200px"><b>Faire mes courses à deux</b><div class="small muted">Partage cette liste avec <b>une seule personne</b> (conjoint, coloc…). Vous la voyez et la cochez tous les deux, en direct.</div></div>
      <div class="row wrap" style="gap:6px"><button class="btn sm primary" data-act="listCreate">Partager ma liste</button><button class="btn sm" data-act="listJoin">J'ai un code</button></div></div></section>`;
    if (c.role === 'owner' && !c.partner) return `<section class="card share-card"><div class="row wrap" style="gap:12px"><span class="ic-badge" style="--c:var(--c-walk)">${U.icon('smile')}</span>
      <div class="grow" style="min-width:200px"><b>En attente de ton binôme</b><div class="small muted">Envoie ce code à la personne avec qui tu fais tes courses. Elle le saisit dans Courses → « J'ai un code ».</div></div>
      <div class="share-code">${c.code.slice(0, 4)}-${c.code.slice(4)}</div>
      <div class="row wrap" style="gap:6px"><button class="btn sm primary" data-act="listSend">${U.icon('upload', 'sm')}Envoyer le code</button><button class="btn sm ghost" data-act="listLeave">Annuler</button></div></div></section>`;
    return `<section class="card share-card on"><div class="row wrap" style="gap:12px"><span class="ic-badge" style="--c:var(--good)">${U.icon('smile')}</span>
      <div class="grow" style="min-width:200px"><b>Liste partagée avec ${U.esc(c.partner || 'ton binôme')}</b><div class="small muted">Tout ce que l'un ajoute ou coche apparaît chez l'autre (actualisation toutes les 15 secondes quand la liste est ouverte).</div></div>
      <div class="row wrap" style="gap:6px"><button class="btn sm" data-act="listRefresh">${U.icon('repeat', 'sm')}Actualiser</button><button class="btn sm ghost" data-act="listLeave">${c.role === 'owner' ? 'Arrêter le partage' : 'Quitter la liste'}</button></div></div></section>`;
  },
  pollList() {
    clearInterval(Acc._lp);
    if (!Cloud.list()) return;
    Acc._lp = setInterval(() => {
      const p = Pages.nutrition;
      if (!Cloud.list() || !(location.hash || '').startsWith('#repas') || p.tab !== 'courses' || document.visibilityState !== 'visible') { clearInterval(Acc._lp); return; }
      Cloud.syncList().catch(() => {});
    }, 15000);
  },
  /* Réactions sous une recette de la communauté */
  reactCounts(r) {
    const x = Cloud.reactionsFor(r.docId);
    if (!x.likes && !x.tested && !x.notes.length) return '';
    return `<span class="react-mini">${x.likes ? `<span>${U.icon('heart', 'sm')}${x.likes}</span>` : ''}${x.tested ? `<span>${U.icon('check', 'sm')}${x.tested} testé${x.tested > 1 ? 's' : ''}</span>` : ''}${x.notes.length ? `<span>${U.icon('note', 'sm')}${x.notes.length}</span>` : ''}</span>`;
  },
  reactionsBlock(r) {
    if (!Cloud.user) return '';
    const x = Cloud.reactionsFor(r.docId), me = x.mine || {};
    return `<div class="reactions"><div class="eyebrow">Avis des proches</div>
      ${r.mine ? `<p class="small muted" style="margin:0">${x.likes} j'aime · ${x.tested} personne${x.tested > 1 ? 's ont' : ' a'} testé ta recette.</p>` : `<div class="row wrap" style="gap:8px">
        <button class="btn sm ${me.liked ? 'primary' : ''}" data-act="commReact" data-k="liked" data-id="${r.docId}">${U.icon('heart', 'sm')}J'aime${x.likes ? ' · ' + x.likes : ''}</button>
        <button class="btn sm ${me.tested ? 'primary' : ''}" data-act="commReact" data-k="tested" data-id="${r.docId}">${U.icon('check', 'sm')}J'ai testé${x.tested ? ' · ' + x.tested : ''}</button></div>
        <div class="row" style="gap:8px;align-items:flex-end"><textarea id="react-note" class="input grow" rows="2" style="height:auto;padding:8px 12px;line-height:1.4" maxlength="280" placeholder="Ton avis, une astuce (facultatif) : « top avec du citron »">${U.esc(me.note || '')}</textarea><button class="btn sm" data-act="commNote" data-id="${r.docId}">${me.note ? 'Modifier' : 'Publier'}</button></div>`}
      ${x.notes.length ? `<div class="react-notes">${x.notes.map(n => `<div class="rn"><b>${U.esc(n.u === Cloud.user.uid ? 'Toi' : n.a)}</b>${n.tested ? ' <span class="pill planned" style="height:18px">testé</span>' : ''}<span class="xs faint"> · ${Acc.ago(n.t)}</span><p>${U.esc(n.note)}</p></div>`).join('')}</div>` : ''}
    </div>`;
  },
  /* Ingrédients venus d'une recette partagée (aliments perso de l'auteur) : copiés dans tes aliments */
  async adoptFoods(r) {
    const map = {};
    for (const i of r.ing) {
      if (!String(i.foodId).startsWith('cmf-')) continue;
      if (!map[i.foodId]) {
        const f = D.food(i.foodId) || {};
        const same = DB.all('foods').find(x => x.name === f.name && x.kcal === f.kcal);
        if (same) map[i.foodId] = same.id;
        else { const nf = { id: 'cf-' + U.uid(), name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, portion: f.portion || 100, portionLabel: '' }; ['sug', 'fib', 'sat', 'salt'].forEach(k => { if (f[k] != null) nf[k] = f[k]; }); await DB.put('foods', nf); map[i.foodId] = nf.id; }
      }
      i.foodId = map[i.foodId];
    }
  }
};

/* ---------- Actions : comptes ---------- */
A.accOpen = el => Acc.open(el && el.dataset.mode || 'signup');
A.accSubmit = async () => {
  const m = UI.top(); if (!m || !m.st) return;
  const st = m.st; m.read();
  const pw = st.pw || '';
  const fail = msg => { st.err = msg; st.busy = false; m.render(); };
  if (st.mode === 'signup' && !st.name) return fail('Indique ton prénom : il apparaît sur les recettes que tu partages.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(st.email)) return fail('Adresse e-mail invalide.');
  if (pw.length < 6) return fail('Mot de passe trop court : 6 caractères minimum.');
  if (st.mode === 'signup' && !m.el.querySelector('#acc-ok').checked) return fail('Coche la case d\'accord pour créer ton compte.');
  st.busy = true; st.err = ''; m.render();
  try {
    if (st.mode === 'signup') await Cloud.signUp(st.name, st.email, pw);
    else await Cloud.signIn(st.email, pw);
  } catch (e) { return fail(Cloud.frErr(e)); }
  await Acc.afterAuth(m);
};
A.accReset = async () => {
  const m = UI.top(); m.read && m.read();
  const email = m.st && m.st.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.toast('Écris d\'abord ton adresse e-mail', { type: 'err' }); return; }
  try { await Cloud.resetPassword(email); UI.toast('E-mail envoyé : suis le lien pour choisir un nouveau mot de passe', { type: 'ok', ms: 6000 }); }
  catch (e) { UI.toast(Cloud.frErr(e), { type: 'err' }); }
};
A.accSync = async () => {
  try { await Cloud.sync(); UI.toast('Données à jour', { type: 'ok' }); } catch (e) { UI.toast(Cloud.frErr(e), { type: 'err' }); }
  App.renderView(false);
};
A.accSignOut = async () => {
  const n = Cloud.pending(), photos = DB.all('photos').length;
  const choice = await new Promise(res => UI.open({
    title: 'Se déconnecter', size: 'sm',
    body: `<div class="stack small">${n ? `<div class="note warn">${U.icon('info', 'sm')}<span><b>${n} modification${n > 1 ? 's' : ''}</b> n'${n > 1 ? 'ont' : 'a'} pas encore été envoyée${n > 1 ? 's' : ''} (pas de réseau ?). Si tu effaces cet appareil maintenant, ${n > 1 ? 'elles seront perdues' : 'elle sera perdue'}.</span></div>` : ''}
      <p style="margin:0">Tes données restent sauvegardées sur ton compte. Que faire de celles de cet appareil ?</p>
      ${photos ? `<p class="muted" style="margin:0">Attention : tes ${photos} photo${photos > 1 ? 's' : ''} ne sont que sur cet appareil. Si tu effaces, exporte-les d'abord (Mes données → Exporter).</p>` : ''}</div>`,
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn" data-signout="keep">Garder ici</button><button class="btn primary" data-signout="wipe">Effacer de cet appareil</button>`,
    onMount: mm => { mm.el.querySelectorAll('[data-signout]').forEach(b => b.addEventListener('click', () => { res(b.dataset.signout); mm.close(); })); },
    onClose: () => res(null)
  }));
  if (!choice) return;
  await Cloud.signOut(choice === 'wipe');
  UI.closeAll();
  if (choice === 'wipe') { OB.start(0); } else { App.boot(); }
  UI.toast('Déconnecté', { type: 'info' });
};
A.accRename = async () => {
  const cur = Cloud.user.name || '';
  UI.open({
    title: 'Ton prénom', sub: 'Affiché sur tes recettes partagées', size: 'sm',
    body: `<label class="field"><span>Prénom</span><input id="acc-rn" value="${U.esc(cur)}" maxlength="40"></label>`,
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="accRenameGo">Enregistrer</button>`
  });
};
A.accRenameGo = async () => {
  const m = UI.top(); const v = m.el.querySelector('#acc-rn').value.trim();
  if (!v) { UI.toast('Prénom vide', { type: 'err' }); return; }
  try { await Cloud.rename(v); m.close(); UI.toast('Prénom mis à jour', { type: 'ok' }); App.renderView(false); }
  catch (e) { UI.toast(Cloud.frErr(e), { type: 'err' }); }
};
A.accDelete = () => {
  UI.open({
    title: 'Supprimer mon compte', size: 'sm',
    body: `<div class="stack small"><div class="note warn">${U.icon('info', 'sm')}<span>Ton compte, toutes les données enregistrées sur le serveur et tes recettes partagées seront <b>définitivement supprimés</b>, ainsi que les données de cet appareil. Exporte une sauvegarde avant si tu veux les garder.</span></div>
      <label class="field"><span>Confirme avec ton mot de passe</span><input id="acc-delpw" type="password" autocomplete="current-password"></label></div>`,
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn danger" data-act="accDeleteGo">Supprimer définitivement</button>`
  });
};
A.accDeleteGo = async el => {
  const m = UI.top(); const pw = m.el.querySelector('#acc-delpw').value;
  if (!pw) { UI.toast('Mot de passe requis', { type: 'err' }); return; }
  el.disabled = true; el.textContent = 'Suppression…';
  try { await Cloud.deleteAccount(pw); UI.closeAll(); OB.start(0); UI.toast('Compte supprimé', { type: 'info' }); }
  catch (e) { el.disabled = false; el.textContent = 'Supprimer définitivement'; UI.toast(Cloud.frErr(e), { type: 'err' }); }
};
A.privacy = () => UI.open({
  title: 'Confidentialité', size: 'md',
  body: `<div class="stack small privacy">
    <p><b>Qui gère les données ?</b> Cap 100 est une application personnelle partagée entre proches, gérée par son créateur. Les données sont hébergées par Google Firebase (Cloud Firestore), sur des serveurs situés dans l'Union européenne.</p>
    <p><b>Ce qui est enregistré sur le serveur</b> : ton prénom et ton adresse e-mail (pour le compte), et les données que tu saisis — poids, mensurations, repas, activités, séances, habitudes, recettes, réglages. Ce sont des données relatives à ta santé : elles ne sont enregistrées qu'avec ton accord, donné à la création du compte.</p>
    <p><b>Ce qui reste sur ton appareil</b> : tes photos. Elles ne sont jamais envoyées.</p>
    <p><b>Qui peut voir quoi</b> : tes données personnelles ne sont lisibles que par toi (règles de sécurité du serveur). Les recettes que tu partages sont visibles par tous les inscrits, avec ton prénom.</p>
    <p><b>Pourquoi</b> : uniquement pour synchroniser tes données entre tes appareils et partager des recettes. Aucune publicité, aucune revente, aucune analyse.</p>
    <p><b>Tes droits</b> : tu peux exporter tes données (Réglages → Mes données → Exporter), modifier ton prénom, et supprimer ton compte avec toutes ses données à tout moment (Réglages → Compte). Pour toute question, contacte la personne qui t'a invité.</p></div>`,
  footer: `<button class="btn primary" data-close-top>Compris</button>`
});

/* ---------- Actions : communauté ---------- */
A.commRefresh = async () => { try { await Cloud.fetchCommunity(); UI.toast('Communauté à jour'); } catch (e) { UI.toast(Cloud.frErr(e), { type: 'err' }); } };
A.listCreate = async el => {
  const ok = await UI.confirm({ title: 'Partager ma liste de courses ?', text: 'Tu obtiens un code à envoyer à <b>une seule personne</b>. Une fois qu\'elle l\'a saisi, vous voyez la même liste : articles, quantités et cases cochées. Tes repas, ton poids et le reste de tes données restent privés.', ok: 'Créer le code' });
  if (!ok) return;
  el.disabled = true;
  try { await Cloud.listCreate(); App.renderView(false); UI.toast('Code créé : envoie-le à ton binôme'); }
  catch (e) { el.disabled = false; UI.toast(Cloud.frErr(e), { type: 'err' }); }
};
A.listJoin = () => UI.open({
  title: 'Rejoindre une liste', sub: 'Code reçu de ton binôme', size: 'sm',
  body: `<div class="stack"><label class="field"><span>Code (8 caractères)</span><input id="list-code" autocomplete="off" autocapitalize="characters" placeholder="ABCD-2345" maxlength="9" style="font:700 22px var(--display);letter-spacing:.08em;text-transform:uppercase"></label>
    <p class="small muted" style="margin:0">Ta liste actuelle sera ajoutée à la liste commune. Ensuite, tout ce que l'un ajoute ou coche apparaît chez l'autre.</p></div>`,
  footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="listJoinGo">Rejoindre</button>`
});
A.listJoinGo = async el => {
  const v = document.getElementById('list-code').value;
  el.disabled = true; el.textContent = 'Un instant…';
  try { const who = await Cloud.listJoin(v); UI.closeAll(); UI.toast(`Liste partagée avec ${who || 'ton binôme'}`); App.changed(); Acc.pollList(); }
  catch (e) { el.disabled = false; el.textContent = 'Rejoindre'; UI.toast(Cloud.frErr(e), { type: 'err' }); }
};
A.listSend = async () => {
  const c = Cloud.list(); if (!c) return;
  const code = c.code.slice(0, 4) + '-' + c.code.slice(4);
  const text = `Rejoins ma liste de courses sur Cap 100 : ouvre l'app, onglet Alimentation → Courses → « J'ai un code », puis saisis ${code}`;
  try { if (navigator.share) { await navigator.share({ title: 'Liste de courses Cap 100', text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); UI.toast('Message copié : colle-le dans une conversation'); } catch (e) { UI.toast('Code : ' + code, { type: 'info', ms: 8000 }); }
};
A.listRefresh = async () => { try { await Cloud.syncList(); UI.toast('Liste à jour'); App.renderView(false); } catch (e) { UI.toast(Cloud.frErr(e), { type: 'err' }); } };
A.listLeave = async () => {
  const c = Cloud.list(); if (!c) return;
  const owner = c.role === 'owner';
  const ok = await UI.confirm({ title: owner ? (c.partner ? 'Arrêter le partage ?' : 'Annuler le partage ?') : 'Quitter la liste ?', text: owner ? `${c.partner ? `${U.esc(c.partner)} ne verra plus ta liste. ` : ''}Tu gardes la liste actuelle sur ton téléphone.` : `Tu ne verras plus la liste de ${U.esc(c.partner || 'ton binôme')}. Tu gardes une copie de la liste actuelle.`, ok: owner ? 'Arrêter' : 'Quitter' });
  if (!ok) return;
  try { await Cloud.listLeave(); UI.toast('Partage terminé'); App.renderView(false); } catch (e) { UI.toast(Cloud.frErr(e), { type: 'err' }); }
};
A.commSort = el => { Pages.nutrition.csort = el.dataset.v || ''; App.renderView(false); };
A.commReact = async el => {
  const x = Cloud.reactionsFor(el.dataset.id), me = x.mine || {};
  el.disabled = true;
  try { await Cloud.react(el.dataset.id, { [el.dataset.k]: !me[el.dataset.k] }); UI.refreshAll(); }
  catch (e) { el.disabled = false; UI.toast(Cloud.frErr(e), { type: 'err' }); }
};
A.commNote = async el => {
  const t = document.getElementById('react-note'); if (!t) return;
  el.disabled = true;
  try { await Cloud.react(el.dataset.id, { note: t.value }); UI.toast(t.value.trim() ? 'Avis publié' : 'Avis retiré'); UI.refreshAll(); }
  catch (e) { el.disabled = false; UI.toast(Cloud.frErr(e), { type: 'err' }); }
};
A.commWho = el => { Pages.nutrition.cwho = el.dataset.v || ''; App.renderView(false); };
A.commShare = async el => { const r = DB.get('recipes', el.dataset.id); if (!r) return; r.shared = true; await DB.put('recipes', r); await Cloud.publish(r); UI.toast('Recette partagée dans la communauté', { type: 'ok' }); UI.refreshAll(); };
A.commUnshare = async el => {
  const r = D.recipe(el.dataset.id); if (!r) return;
  const ok = await UI.confirm({ title: 'Retirer de la communauté ?', text: 'La recette ne sera plus visible par les autres. Tu la gardes dans tes recettes.', ok: 'Retirer' });
  if (!ok) return;
  const rid = r.community ? r.rid : r.id;
  const own = DB.get('recipes', rid); if (own) { own.shared = false; await DB.put('recipes', own); }
  await Cloud.unpublish(rid);
  UI.closeAll(); UI.toast('Recette retirée de la communauté'); App.renderView(false);
};
A.commAdminDel = async el => {
  const r = D.recipe(el.dataset.id); if (!r) return;
  const ok = await UI.confirm({ title: 'Retirer cette recette ?', text: `« ${U.esc(r.name)} » de ${U.esc(r.author)} sera retirée de la communauté pour tout le monde.`, ok: 'Retirer', danger: true });
  if (!ok) return;
  try { await Cloud.removeCommunity(r.docId); UI.closeAll(); UI.toast('Recette retirée'); App.renderView(false); } catch (e) { UI.toast(Cloud.frErr(e), { type: 'err' }); }
};

/* ---------- Réactions aux événements de synchronisation ---------- */
Cloud.listen(what => {
  if (what === 'status' || what === 'session') { const c = document.getElementById('cloud-chip'); if (c) c.innerHTML = Acc.chip(); if (location.hash === '#reglages' && !UI.stack.length) App.renderView(false); }
  if (what === 'data') {
    if (!document.getElementById('ob').hidden && D.meta().onboarded) { OB.close(); App.boot(); return; }
    if (D.meta().onboarded) { App.renderView(false); App.updateChrome(); }
  }
  if (what === 'list' && (location.hash || '').startsWith('#repas') && !UI.stack.length) App.renderView(false);
  if (what === 'community' && Pages.nutrition.tab === 'communaute' && (location.hash || '').startsWith('#repas') && !UI.stack.length) App.renderView(false);
});
