'use strict';
/* Cap 100 — réglages, sauvegarde/restauration, démarrage */

Pages.settings = {
  title: 'Réglages',
  nav: 'reglages',
  render() {
    const p = D.profile(), tg = D.targets(), prefs = DB.setting('prefs', {}), meta = D.meta();
    const est = D.estimate({ sex: p.sex, age: p.age, height: p.height, weight: D.bodyWeight(), activity: p.activity, pace: p.pace, goalWeight: p.goalWeight });
    const lastExp = meta.lastExport ? U.diffDays(meta.lastExport.slice(0, 10), U.today()) : null;
    return `<div class="page-head"><div><h1>Réglages</h1><div class="sub">Profil, objectifs, apparence et sauvegarde de tes données.</div></div></div>
    <div class="grid g-2" style="align-items:start">
      <div class="stack" style="gap:18px">
        <section class="card"><div class="card-h"><span class="ic-badge sm">${U.icon('body')}</span><h2>Profil</h2></div>
          <form id="set-profile" class="stack"><div class="fields">
            <label class="field"><span>Prénom</span><input id="sp-name" value="${U.esc(p.name || '')}" placeholder="Optionnel"></label>
            <div class="field"><span>Sexe</span>${UI.pick('sex', [{ v: 'm', l: 'Homme' }, { v: 'f', l: 'Femme' }], p.sex || 'm', 'seg full')}</div>
            <label class="field"><span>Âge</span><div class="input-unit"><input id="sp-age" inputmode="numeric" value="${p.age || ''}"><em>ans</em></div></label>
            <label class="field"><span>Taille</span><div class="input-unit"><input id="sp-height" inputmode="numeric" value="${p.height || ''}"><em>cm</em></div></label>
            <label class="field"><span>Poids de départ</span><div class="input-unit"><input id="sp-start" inputmode="decimal" value="${p.startWeight ? U.num(p.startWeight, 1) : ''}"><em>kg</em></div></label>
            <label class="field"><span>Date de départ</span><input type="date" id="sp-sdate" value="${p.startDate || U.today()}"></label>
          </div><div class="row"><span class="grow"></span><button class="btn primary" data-act="saveProfile">Enregistrer</button></div></form></section>

        <section class="card"><div class="card-h"><span class="ic-badge sm" style="--c:var(--goal)">${U.icon('flag')}</span><h2>Objectif</h2></div>
          <form id="set-goal" class="stack"><div class="fields">
            <label class="field"><span>Poids visé</span><div class="input-unit"><input id="sg-goal" inputmode="decimal" value="${p.goalWeight ? U.num(p.goalWeight, 1) : 100}"><em>kg</em></div></label>
            <label class="field"><span>Échéance visée</span><input type="date" id="sg-date" value="${p.goalDate || '2027-11-30'}"></label>
            <label class="field full"><span>Paliers intermédiaires</span><input id="sg-ms" value="${(p.milestones || [125, 120, 115, 110, 105, 100]).join(', ')}"><small>Séparés par des virgules. Validés quand la moyenne sur 7 jours passe dessous.</small></label>
          </div><div class="note">${U.icon('info', 'sm')}<span>L'échéance est un repère personnel, pas une promesse. Si ton corps va moins vite, l'application montre simplement ta progression réelle.</span></div>
          <div class="row"><span class="grow"></span><button class="btn primary" data-act="saveGoal">Enregistrer</button></div></form></section>

        <section class="card"><div class="card-h"><span class="ic-badge sm" style="--c:var(--c-food)">${U.icon('food')}</span><h2>Objectifs quotidiens</h2></div>
          <form id="set-nut" class="stack">
            <div class="fields"><label class="field"><span>Niveau d'activité</span><select id="sn-act">${D.ACTIVITY_LEVELS.map(a => `<option value="${a.id}" ${p.activity === a.id ? 'selected' : ''}>${a.label} · ${a.hint}</option>`).join('')}</select></label>
              <label class="field"><span>Rythme souhaité</span><select id="sn-pace">${D.PACES.map(a => `<option value="${a.id}" ${p.pace === a.id ? 'selected' : ''}>${a.label} · ${a.hint}</option>`).join('')}</select></label></div>
            <div class="est" id="sn-est">${estBlock(est)}</div>
            <label class="row" style="align-items:flex-start"><span class="switch"><input type="checkbox" id="sn-dyn" data-change="setDynamic" ${prefs.dynamicTarget ? 'checked' : ''}><span></span></span><span class="small"><b>Adapter l'objectif du jour à mes activités</b><br><span class="muted">L'objectif calorique devient : dépense estimée du jour (pas, séances réalisées ou prévues) moins ton déficit visé, jamais sous le métabolisme de base. Les jours de sport, tu manges un peu plus ; les jours calmes, un peu moins.</span></span></label>
            <button type="button" class="btn sm" data-act="applyEstimate">${U.icon('repeat', 'sm')}Appliquer cette estimation</button>
            <div class="fields three">
              <label class="field"><span>Calories</span><div class="input-unit"><input id="sn-kcal" inputmode="numeric" value="${tg.kcal}"><em>kcal</em></div></label>
              <label class="field"><span>Protéines</span><div class="input-unit"><input id="sn-p" inputmode="numeric" value="${tg.protein}"><em>g</em></div></label>
              <label class="field"><span>Glucides</span><div class="input-unit"><input id="sn-c" inputmode="numeric" value="${tg.carbs}"><em>g</em></div></label>
              <label class="field"><span>Lipides</span><div class="input-unit"><input id="sn-f" inputmode="numeric" value="${tg.fat}"><em>g</em></div></label>
              <label class="field"><span>Pas</span><input id="sn-steps" inputmode="numeric" value="${tg.steps}"></label>
              <label class="field"><span>Activité</span><div class="input-unit"><input id="sn-min" inputmode="numeric" value="${tg.activeMin}"><em>min</em></div></label>
            </div>
            <p class="hint" id="sn-check" style="margin:0"></p>
            <div class="note warn">${U.icon('info', 'sm')}<span>Estimations indicatives (formule de Mifflin-St Jeor), sans valeur médicale. Pour une perte de 30 kg, un suivi par un médecin ou un diététicien est une vraie aide.</span></div>
            <div class="row"><span class="grow"></span><button class="btn primary" data-act="saveTargets">Enregistrer</button></div></form></section>
      </div>
      <div class="stack" style="gap:18px">
        <section class="card"><div class="card-h"><span class="ic-badge sm">${U.icon('sun')}</span><h2>Apparence et séance</h2></div>
          <div class="stack"><div class="field"><span>Thème</span><div class="seg full">${[['system', 'Système', 'monitor'], ['light', 'Clair', 'sun'], ['dark', 'Sombre', 'moon']].map(([v, l, ic]) => `<button data-act="setTheme" data-v="${v}" class="${(prefs.theme || 'system') === v ? 'on' : ''}">${U.icon(ic, 'sm')} ${l}</button>`).join('')}</div></div>
          <label class="field"><span>Enseigne principale pour les courses</span><select data-change="setMainStore" id="set-store">${D.STORES.map(x => `<option value="${x.id}" ${x.id === D.mainStore() ? 'selected' : ''}>${x.name}</option>`).join('')}</select><small>Sert à estimer le prix des recettes, du planning et de la liste de courses.</small></label>
          <div class="field"><span>Mon matériel (sans salle)</span><div class="chips">${D.EQUIPMENT.map(q => `<button class="chip ${D.myEquipment().has(q.id) ? 'on' : ''}" ${q.fixed ? 'disabled' : `data-act="toggleEq" data-v="${q.id}"`}>${q.label}</button>`).join('')}</div></div>
          <div class="field"><span>Repos entre les séries</span><div class="seg full">${[60, 90, 120, 180].map(v => `<button data-act="setRest" data-v="${v}" class="${W.REST() === v ? 'on' : ''}">${v >= 120 ? v / 60 + ' min' : v + ' s'}</button>`).join('')}</div></div></div></section>

        <section class="card"><div class="card-h"><span class="ic-badge sm" style="--c:var(--good)">${U.icon('shield')}</span><h2>Mes données</h2></div>
          <div class="stack">
            <div class="note">${U.icon('lock', 'sm')}<span>Tout est enregistré <b>uniquement dans ce navigateur</b> (IndexedDB). Rien n'est envoyé sur un serveur. Conséquence : si tu effaces les données du navigateur, elles disparaissent. Exporte régulièrement une sauvegarde.</span></div>
            <div class="row wrap small"><span>${DB.persistent ? `<b class="good-c">Stockage local actif</b>` : '<b class="goal-c">Stockage indisponible : données en mémoire seulement</b>'}</span><span class="faint" id="storage-est"></span><span class="grow"></span><button class="btn sm" data-act="persist" id="persist-btn">${U.icon('shield', 'sm')}Protéger le stockage</button></div>
            <div class="row wrap small"><span class="${lastExp == null || lastExp > 14 ? 'goal-c' : 'muted'}">${lastExp == null ? 'Aucune sauvegarde exportée pour l\'instant.' : lastExp === 0 ? 'Dernière sauvegarde : aujourd\'hui.' : `Dernière sauvegarde : il y a ${lastExp} jour${lastExp > 1 ? 's' : ''}.`}</span></div>
            <label class="row"><span class="switch"><input type="checkbox" id="exp-photos" checked><span></span></span><span>Inclure les photos dans l'export (${DB.all('photos').length})</span></label>
            <div class="row wrap"><button class="btn primary" data-act="exportData">${U.icon('download', 'sm')}Exporter (JSON)</button>
              <label class="btn" style="position:relative;overflow:hidden">${U.icon('upload', 'sm')}Importer une sauvegarde<input type="file" accept="application/json,.json" data-change="importData" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label></div>
            ${U.inFrame ? `<p class="hint" style="margin:0">Aperçu intégré : le téléchargement de fichiers peut être bloqué ici. Tes sauvegardes fonctionnent normalement depuis l'application hébergée sur GitHub Pages.</p>` : ''}
            <hr style="border:0;border-top:1px solid var(--line);width:100%;margin:4px 0">
            ${meta.demo ? `<div class="note warn">${U.icon('info', 'sm')}<span>Les données actuelles sont des <b>données de démonstration</b>.</span></div><button class="btn primary" data-act="clearDemo">Supprimer la démo et commencer avec mes données</button>` : ''}
            <button class="btn danger" data-act="resetAll">${U.icon('trash', 'sm')}Tout effacer</button>
          </div></section>

        <section class="card"><div class="card-h"><span class="ic-badge sm" style="--c:var(--c-bike)">${U.icon('download')}</span><h2>Installer sur le téléphone</h2></div>
          <div class="stack small muted">
            ${App.installPrompt ? `<button class="btn primary" data-act="install">${U.icon('download', 'sm')}Installer Cap 100</button>` : ''}
            <p style="margin:0"><b>Android (Chrome)</b> : menu ⋮ → « Installer l'application » ou « Ajouter à l'écran d'accueil ».</p>
            <p style="margin:0"><b>iPhone (Safari)</b> : bouton Partager → « Sur l'écran d'accueil ».</p>
            <p style="margin:0">Une fois installée, l'application s'ouvre en plein écran et fonctionne hors connexion. Attention : les données de l'application installée et celles du navigateur peuvent être séparées selon les appareils — utilise l'export/import pour passer de l'un à l'autre.</p>
          </div></section>

        <section class="card"><div class="card-h"><span class="ic-badge sm">${U.icon('keyboard')}</span><h2>Raccourcis clavier</h2></div>
          <div class="grid g-2 small" style="gap:8px">${SHORTCUTS.map(([k, l]) => `<div class="row"><kbd>${k}</kbd><span class="muted">${l}</span></div>`).join('')}</div></section>
      </div>
    </div>`;
  },
  mount(root) {
    const upd = () => {
      const p = { ...D.profile(), activity: root.querySelector('#sn-act').value, pace: root.querySelector('#sn-pace').value };
      root.querySelector('#sn-est').innerHTML = estBlock(D.estimate({ sex: p.sex, age: p.age, height: p.height, weight: D.bodyWeight(), activity: p.activity, pace: p.pace, goalWeight: p.goalWeight }));
    };
    root.querySelector('#sn-act').addEventListener('change', upd);
    root.querySelector('#sn-pace').addEventListener('change', upd);
    const chk = () => {
      const g = id => U.parseNum(root.querySelector(id).value) || 0;
      const k = g('#sn-kcal'), sum = g('#sn-p') * 4 + g('#sn-c') * 4 + g('#sn-f') * 9;
      const est = D.estimate({ ...D.profile(), weight: D.bodyWeight() });
      let msg = `Protéines × 4 + glucides × 4 + lipides × 9 = ${U.num(sum)} kcal${Math.abs(sum - k) > 80 ? ` (objectif : ${U.num(k)} kcal, ajuste les macros)` : ' ✓'}`;
      if (k && k < est.bmr) msg += ` · Attention : en dessous de ton métabolisme de base estimé (${U.num(est.bmr)} kcal). Une restriction trop forte fait perdre du muscle et se tient mal dans la durée.`;
      root.querySelector('#sn-check').textContent = msg;
    };
    root.querySelector('#set-nut').addEventListener('input', chk); chk();
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { const el = root.querySelector('#storage-est'); if (el) el.textContent = `· ${U.num((e.usage || 0) / 1048576, 1)} Mo utilisés`; }).catch(() => {});
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(v => { const b = root.querySelector('#persist-btn'); if (b && v) { b.disabled = true; b.innerHTML = `${U.icon('check', 'sm')}Stockage protégé`; } }).catch(() => {});
  }
};
function estBlock(e) {
  return `<div><b>${U.num(e.bmr)}</b><span>Métabolisme de base</span></div><div><b>${U.num(e.tdee)}</b><span>Dépense estimée / jour</span></div>
    <div><b>${U.num(e.kcal)}</b><span>Calories suggérées (−${U.num(e.deficit)})</span></div><div><b>${e.protein} · ${e.carbs} · ${e.fat}</b><span>Prot. · gluc. · lip. (g)</span></div>`;
}
const SHORTCUTS = [['N', 'Ajout rapide'], ['P', 'Pesée'], ['R', 'Ajouter un repas'], ['A', 'Ajouter une activité'], ['S', 'Démarrer une séance'], ['1 à 9', 'Changer de page'], ['Échap', 'Fermer une fenêtre'], ['?', 'Aide raccourcis']];

A.saveProfile = async () => {
  const f = document.getElementById('set-profile');
  const o = UI.form(f); const num = id => U.parseNum(document.getElementById(id).value);
  const p = { ...D.profile(), name: document.getElementById('sp-name').value.trim(), sex: o.sex, age: num('sp-age'), height: num('sp-height'), startWeight: num('sp-start') || D.profile().startWeight, startDate: document.getElementById('sp-sdate').value || D.profile().startDate };
  await DB.setSetting('profile', p); UI.toast('Profil enregistré'); App.changed();
};
A.saveGoal = async () => {
  const goal = U.parseNum(document.getElementById('sg-goal').value);
  const date = document.getElementById('sg-date').value;
  const ms = document.getElementById('sg-ms').value.split(/[,;\s]+/).map(U.parseNum).filter(v => v && v > 30).sort((a, b) => b - a);
  const p = D.profile();
  if (!goal || goal >= (p.startWeight || 999)) { UI.toast('Le poids visé doit être inférieur au poids de départ', { type: 'err' }); return; }
  if (!date || date <= (p.startDate || U.today())) { UI.toast('L\'échéance doit être après la date de départ', { type: 'err' }); return; }
  await DB.setSetting('profile', { ...p, goalWeight: goal, goalDate: date, milestones: ms.length ? ms : undefined });
  UI.toast('Objectif enregistré'); App.changed();
};
A.applyEstimate = () => {
  const p = { ...D.profile(), activity: document.getElementById('sn-act').value, pace: document.getElementById('sn-pace').value };
  const e = D.estimate({ sex: p.sex, age: p.age, height: p.height, weight: D.bodyWeight(), activity: p.activity, pace: p.pace, goalWeight: p.goalWeight });
  document.getElementById('sn-kcal').value = e.kcal; document.getElementById('sn-p').value = e.protein; document.getElementById('sn-c').value = e.carbs; document.getElementById('sn-f').value = e.fat;
  document.getElementById('set-nut').dispatchEvent(new Event('input'));
  UI.toast('Estimation appliquée, pense à enregistrer', { type: 'info' });
};
A.saveTargets = async () => {
  const n = id => U.parseNum(document.getElementById(id).value);
  const t = { kcal: n('sn-kcal'), protein: n('sn-p'), carbs: n('sn-c'), fat: n('sn-f'), steps: n('sn-steps'), activeMin: n('sn-min') };
  if (!t.kcal || t.kcal < 1200) { UI.toast('Objectif calorique trop bas : 1 200 kcal minimum', { type: 'err' }); return; }
  await DB.setSetting('targets', t);
  await DB.setSetting('profile', { ...D.profile(), activity: document.getElementById('sn-act').value, pace: document.getElementById('sn-pace').value });
  UI.toast('Objectifs enregistrés'); App.changed();
};
A.setTheme = async el => { await DB.setSetting('prefs', { ...DB.setting('prefs', {}), theme: el.dataset.v }); App.applyTheme(); App.renderView(false); };
A.setDynamic = async el => { await DB.setSetting('prefs', { ...DB.setting('prefs', {}), dynamicTarget: el.checked }); UI.toast(el.checked ? `Objectif du jour adapté : ${U.num(D.kcalTarget(U.today()))} kcal aujourd'hui` : 'Objectif calorique fixe'); App.changed(); };
A.setRest = async el => { await DB.setSetting('prefs', { ...DB.setting('prefs', {}), rest: +el.dataset.v }); App.renderView(false); UI.toast(`Repos par défaut : ${el.textContent}`); };
A.persist = async () => {
  try { const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; UI.toast(ok ? 'Stockage protégé : le navigateur ne l\'effacera pas automatiquement' : 'Le navigateur a refusé. Installe l\'application pour une meilleure protection.', { type: ok ? 'ok' : 'info' }); App.renderView(false); }
  catch (e) { UI.toast('Fonction non disponible sur ce navigateur', { type: 'info' }); }
};
A.install = async () => { const p = App.installPrompt; if (!p) return; p.prompt(); try { await p.userChoice; } catch (e) { /* rien */ } App.installPrompt = null; App.renderView(false); };

/* ---------- Export / import ---------- */
A.exportData = async () => {
  const withPhotos = document.getElementById('exp-photos').checked;
  UI.toast('Préparation de la sauvegarde…', { type: 'info', ms: 1500 });
  const data = {};
  for (const s of Object.keys(DB.STORES)) {
    if (s === 'photos') {
      data.photos = withPhotos ? await Promise.all(DB.all('photos').map(async p => ({ ...p, blob: undefined, dataUrl: await U.blobToDataURL(p.blob) }))) : [];
    } else data[s] = DB.all(s);
  }
  const payload = { app: 'cap100', version: 1, exportedAt: new Date().toISOString(), includesPhotos: withPhotos, data };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  U.download(`cap100-sauvegarde-${U.today()}.json`, blob);
  await DB.setSetting('meta', { ...D.meta(), lastExport: new Date().toISOString() });
  UI.toast(`Sauvegarde exportée (${blob.size > 1048576 ? U.num(blob.size / 1048576, 1) + ' Mo' : U.num(Math.max(1, blob.size / 1024)) + ' Ko'})`);
  App.renderView(false);
};
A.importData = async el => {
  const file = el.files[0]; el.value = '';
  if (!file) return;
  let payload;
  try { payload = JSON.parse(await file.text()); } catch (e) { UI.toast('Fichier illisible : ce n\'est pas une sauvegarde JSON valide', { type: 'err' }); return; }
  if (!payload || payload.app !== 'cap100' || !payload.data) { UI.toast('Ce fichier n\'est pas une sauvegarde Cap 100', { type: 'err' }); return; }
  const d = payload.data;
  const summary = `${(d.weights || []).length} pesées, ${(d.activities || []).length} activités, ${(d.meals || []).length} aliments notés, ${(d.photos || []).length} photos`;
  const ok = await UI.confirm({ title: 'Restaurer la sauvegarde ?', text: `Sauvegarde du ${U.fmtFull(payload.exportedAt.slice(0, 10))} : ${summary}.<br><br>Toutes les données actuelles de ce navigateur seront <b>remplacées</b>.`, ok: 'Remplacer mes données', danger: true });
  if (!ok) return;
  try {
    await DB.clearAll();
    for (const s of Object.keys(DB.STORES)) {
      if (!Array.isArray(d[s])) continue;
      if (s === 'photos') {
        const photos = [];
        for (const p of d.photos) { if (!p.dataUrl) continue; const { dataUrl, ...rest } = p; photos.push({ ...rest, blob: await U.dataURLToBlob(dataUrl) }); }
        if (photos.length) await DB.putMany('photos', photos);
      } else if (d[s].length) await DB.putMany(s, d[s]);
    }
    D.checkNew(true);
    UI.toast('Données restaurées');
    App.applyTheme();
    App.go('accueil');
    App.changed();
  } catch (e) { console.error(e); UI.toast('La restauration a échoué : ' + (e.message || 'erreur inconnue'), { type: 'err' }); }
};
A.clearDemo = async () => {
  const ok = await UI.confirm({ title: 'Supprimer la démo ?', text: 'Toutes les données de démonstration seront effacées. Tu repartiras de zéro avec ton propre profil.', ok: 'Supprimer et commencer' });
  if (!ok) return;
  await DB.clearAll();
  UI.closeAll();
  OB.start(1);
};
A.resetAll = async () => {
  const ok = await UI.confirm({ title: 'Tout effacer ?', text: 'Poids, repas, séances, photos, réglages : tout sera supprimé de ce navigateur. <b>Cette action est définitive.</b> Exporte une sauvegarde avant si besoin.', ok: 'Tout effacer', danger: true });
  if (!ok) return;
  await DB.clearAll();
  UI.closeAll();
  OB.start(0);
};

/* ---------- Premier lancement ---------- */
const OB = {
  st: null,
  ms(w, g) { const out = []; for (let m = Math.floor((w - 0.01) / 5) * 5; m > g; m -= 5) out.push(m); out.push(g); return out; },
  start(step = 0) {
    const today = U.today();
    this.st = { step, name: '', sex: 'm', age: '', height: 185, weight: 130, startDate: today, goal: 100, goalDate: '2027-11-30', activity: 'light', pace: 'moderate', targets: null };
    document.getElementById('ob').hidden = false;
    document.body.style.overflow = 'hidden';
    this.render();
  },
  close() { document.getElementById('ob').hidden = true; document.getElementById('ob').innerHTML = ''; document.body.style.overflow = ''; },
  render() {
    const s = this.st;
    const steps = `<div class="ob-steps">${[1, 2, 3].map(i => `<i class="${s.step >= i ? 'on' : ''}"></i>`).join('')}</div>`;
    let h;
    if (s.step === 0) h = `<div class="brand" style="padding:0"><span class="brand-mark">100</span><span class="brand-name">Cap 100</span></div>
      <h1>Ta transformation,<br><em>pas à pas.</em></h1>
      <p class="lead">Un centre de contrôle personnel pour suivre ton poids, ton alimentation, tes séances et tes habitudes, du point de départ jusqu'à ton objectif.</p>
      <div class="ob-path"><span>130 kg</span>${U.icon('chevR', 'lg')}<span>perte de masse grasse</span>${U.icon('chevR', 'lg')}<span class="to">100 kg</span></div>
      <div class="stack"><button class="ob-choice" data-act="obMine"><span class="ic-badge" style="--c:var(--accent)">${U.icon('flag')}</span><span class="grow"><b>Commencer avec mes données</b><span>Profil, objectif et cibles en 3 étapes rapides.</span></span>${U.icon('chevR')}</button>
        <button class="ob-choice" data-act="obDemo"><span class="ic-badge" style="--c:var(--goal)">${U.icon('sparkle')}</span><span class="grow"><b>Explorer avec des données de démo</b><span>7 semaines fictives pour découvrir l'interface. Supprimables en un clic.</span></span>${U.icon('chevR')}</button></div>
      <div class="note">${U.icon('lock', 'sm')}<span>Tes données restent dans ce navigateur. Aucun compte, aucun serveur.</span></div>`;
    else if (s.step === 1) h = `${steps}<h1>Ton point<br><em>de départ</em></h1><p class="lead">Ces informations servent à estimer tes besoins. Tu pourras tout modifier ensuite.</p>
      <form id="ob-f" class="stack"><div class="fields keep">
        <label class="field"><span>Prénom</span><input id="ob-name" value="${U.esc(s.name)}" placeholder="Optionnel"></label>
        <div class="field"><span>Sexe</span>${UI.pick('sex', [{ v: 'm', l: 'Homme' }, { v: 'f', l: 'Femme' }], s.sex, 'seg full')}</div>
        <label class="field"><span>Âge</span><div class="input-unit"><input id="ob-age" inputmode="numeric" value="${s.age}" placeholder="—"><em>ans</em></div></label>
        <label class="field"><span>Taille</span><div class="input-unit"><input id="ob-height" inputmode="numeric" value="${s.height}"><em>cm</em></div></label>
        <label class="field"><span>Poids actuel</span><div class="input-unit"><input id="ob-weight" inputmode="decimal" value="${U.num(s.weight, 1)}"><em>kg</em></div></label>
        <label class="field"><span>Date de départ</span><input type="date" id="ob-sdate" value="${s.startDate}"></label>
      </div></form>
      <div class="row"><button class="btn ghost" data-act="obBack">Retour</button><span class="grow"></span><button class="btn primary lg" data-act="obNext">Continuer</button></div>`;
    else if (s.step === 2) {
      const weeks = U.diffDays(s.startDate, s.goalDate) / 7;
      const rate = weeks > 0 ? (s.weight - s.goal) / weeks : 0;
      const pct = rate / s.weight * 100;
      h = `${steps}<h1>Ton <em>cap</em></h1><p class="lead">Un objectif chiffré et une échéance, pour se situer. Ce n'est pas une obligation : l'application te montrera ta progression réelle.</p>
      <form id="ob-f" class="stack"><div class="fields keep">
        <label class="field"><span>Poids visé</span><div class="input-unit"><input id="ob-goal" inputmode="decimal" value="${U.num(s.goal, 1)}"><em>kg</em></div></label>
        <label class="field"><span>Échéance visée</span><input type="date" id="ob-gdate" value="${s.goalDate}"></label></div></form>
      <div class="note ${pct > 1 ? 'warn' : ''}">${U.icon('info', 'sm')}<span>Soit environ <b>${U.num(rate, 2)} kg par semaine</b> (${U.num(pct, 2)} % du poids). ${pct > 1 ? 'C\'est un rythme soutenu : une échéance plus lointaine préserverait mieux la masse musculaire.' : 'Un rythme progressif, compatible avec le maintien de la masse musculaire.'}</span></div>
      <p class="hint">Des paliers tous les 5 kg seront créés automatiquement : ${OB.ms(s.weight, s.goal).map(v => U.num(v)).join(' → ')} kg.</p>
      <div class="row"><button class="btn ghost" data-act="obBack">Retour</button><span class="grow"></span><button class="btn primary lg" data-act="obNext">Continuer</button></div>`;
    } else {
      const e = D.estimate({ sex: s.sex, age: s.age || 25, height: s.height, weight: s.weight, activity: s.activity, pace: s.pace, goalWeight: s.goal });
      const t = s.targets || { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat };
      h = `${steps}<h1>Tes repères <em>du quotidien</em></h1><p class="lead">Une estimation de départ, à ajuster selon ton ressenti et ta progression.</p>
      <form id="ob-f" class="stack"><div class="fields keep">
        <label class="field"><span>Niveau d'activité</span><select id="ob-act">${D.ACTIVITY_LEVELS.map(a => `<option value="${a.id}" ${s.activity === a.id ? 'selected' : ''}>${a.label}</option>`).join('')}</select></label>
        <label class="field"><span>Rythme</span><select id="ob-pace">${D.PACES.map(a => `<option value="${a.id}" ${s.pace === a.id ? 'selected' : ''}>${a.label} (${a.hint})</option>`).join('')}</select></label></div>
        <div class="est"><div><b>${U.num(e.bmr)}</b><span>Métabolisme de base</span></div><div><b>${U.num(e.tdee)}</b><span>Dépense estimée</span></div></div>
        <div class="fields keep">
          <label class="field"><span>Calories / jour</span><div class="input-unit"><input id="ob-kcal" inputmode="numeric" value="${t.kcal}"><em>kcal</em></div></label>
          <label class="field"><span>Protéines</span><div class="input-unit"><input id="ob-p" inputmode="numeric" value="${t.protein}"><em>g</em></div></label>
          <label class="field"><span>Glucides</span><div class="input-unit"><input id="ob-c" inputmode="numeric" value="${t.carbs}"><em>g</em></div></label>
          <label class="field"><span>Lipides</span><div class="input-unit"><input id="ob-fat" inputmode="numeric" value="${t.fat}"><em>g</em></div></label></div></form>
      ${!s.age ? `<p class="hint" style="margin:0">Âge non renseigné : 25 ans utilisé pour le calcul.</p>` : ''}
      <div class="note warn">${U.icon('info', 'sm')}<span>Estimation indicative, jamais en dessous du métabolisme de base. Des protéines suffisantes et le renforcement musculaire aident à garder ta carrure pendant la perte de gras. Pour une perte importante, un avis médical ou diététique reste recommandé.</span></div>
      <div class="row"><button class="btn ghost" data-act="obBack">Retour</button><span class="grow"></span><button class="btn primary lg" data-act="obFinish">${U.icon('check', 'sm')}C'est parti</button></div>`;
    }
    document.getElementById('ob').innerHTML = `<div class="ob-in">${h}</div>`;
    if (s.step === 3) {
      const reEst = () => { OB.read(); s.targets = null; OB.render(); };
      document.getElementById('ob-act').addEventListener('change', reEst);
      document.getElementById('ob-pace').addEventListener('change', reEst);
    }
    if (s.step === 2) U.$$('#ob-goal, #ob-gdate').forEach(i => i.addEventListener('change', () => { OB.read(); OB.render(); }));
  },
  read() {
    const s = this.st, v = id => { const e = document.getElementById(id); return e ? e.value : null; };
    if (s.step === 1) {
      s.name = v('ob-name').trim(); s.sex = document.querySelector('#ob-f input[name="sex"]').value; s.age = U.parseNum(v('ob-age')) || ''; s.height = U.parseNum(v('ob-height')) || 185;
      s.weight = U.parseNum(v('ob-weight')) || 130; s.startDate = v('ob-sdate') || U.today();
    } else if (s.step === 2) { s.goal = U.parseNum(v('ob-goal')) || 100; s.goalDate = v('ob-gdate') || s.goalDate; }
    else if (s.step === 3) { s.activity = v('ob-act'); s.pace = v('ob-pace'); s.targets = { kcal: U.parseNum(v('ob-kcal')), protein: U.parseNum(v('ob-p')), carbs: U.parseNum(v('ob-c')), fat: U.parseNum(v('ob-fat')) }; }
  }
};
A.obMine = () => { OB.st.step = 1; OB.render(); };
A.obDemo = async () => {
  document.getElementById('ob').innerHTML = `<div class="ob-in" style="justify-content:center;align-items:center"><div class="skel" style="width:60%;height:18px"></div><div class="skel" style="width:40%;height:18px"></div><p class="muted">Préparation de la démo…</p></div>`;
  await Demo.generate();
  OB.close();
  App.boot();
  UI.toast('Démo chargée : supprime-la depuis le bandeau quand tu veux', { type: 'info', ms: 5000 });
};
A.obBack = () => { OB.read(); OB.st.step = Math.max(0, OB.st.step - 1); OB.render(); };
A.obNext = () => {
  OB.read(); const s = OB.st;
  if (s.step === 1 && (s.weight < 30 || s.weight > 400)) { UI.toast('Poids invalide', { type: 'err' }); return; }
  if (s.step === 2) {
    if (s.goal >= s.weight) { UI.toast('Le poids visé doit être inférieur au poids actuel', { type: 'err' }); return; }
    if (s.goalDate <= s.startDate) { UI.toast('L\'échéance doit être après la date de départ', { type: 'err' }); return; }
  }
  s.step++; OB.render();
};
A.obFinish = async () => {
  OB.read(); const s = OB.st;
  const e = D.estimate({ sex: s.sex, age: s.age || 25, height: s.height, weight: s.weight, activity: s.activity, pace: s.pace, goalWeight: s.goal });
  const t = s.targets;
  const ms = OB.ms(s.weight, s.goal);
  await DB.setSetting('profile', { name: s.name, sex: s.sex, age: s.age || null, height: s.height, startWeight: s.weight, startDate: s.startDate, goalWeight: s.goal, goalDate: s.goalDate, activity: s.activity, pace: s.pace, milestones: ms });
  await DB.setSetting('targets', { kcal: t.kcal || e.kcal, protein: t.protein || e.protein, carbs: t.carbs || e.carbs, fat: t.fat || e.fat, steps: 8000, activeMin: 40 });
  await DB.put('weights', { date: s.startDate, kg: s.weight, note: 'Point de départ' });
  await DB.putMany('templates', D.defaultTemplates());
  await DB.setSetting('exLib', 2);
  await DB.putMany('habits', D.defaultHabits());
  await DB.setSetting('meta', { onboarded: true, demo: false, createdAt: new Date().toISOString() });
  D.checkNew(true);
  OB.close();
  App.boot();
  UI.celebrate({ icon: 'flag', title: 'C\'est parti', text: `Point de départ enregistré : ${U.kg(s.weight)} kg le ${U.fmtFull(s.startDate)}. Prochaine étape : ta première séance ou ton premier repas.` });
};
