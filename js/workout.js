'use strict';
/* Cap 100 — mode séance de renforcement (en direct, pensé pour le téléphone à la salle) */

const W = {};
W.REST = () => DB.setting('prefs', {}).rest || 90;

W.buildExercises = items => items.map(it => {
  const last = D.lastPerf(it.exId);
  const n = it.sets || (last ? last.sets.length : 3);
  const sets = Array.from({ length: n }, (_, i) => {
    const ls = last ? (last.sets[i] || last.sets[last.sets.length - 1]) : null;
    return { kg: ls ? ls.kg : (it.kg ?? null), reps: ls ? ls.reps : (it.reps ?? null), done: false };
  });
  return { exId: it.exId, target: { sets: it.sets, reps: it.reps, kg: it.kg }, sets };
});

W.start = async ({ templateId = null, actId = null, date = U.today(), title = '' } = {}) => {
  const running = D.acts().find(a => a.status === 'progress' && a.id !== actId);
  if (running) {
    const ok = await UI.confirm({ title: 'Séance en cours', text: `« ${U.esc(D.actTitle(running))} » n'est pas terminée. Veux-tu la reprendre ?`, ok: 'Reprendre' });
    if (ok) App.go('seance-' + running.id);
    return;
  }
  const tpl = templateId ? DB.get('templates', templateId) : null;
  let a = actId ? DB.get('activities', actId) : null;
  const base = {
    type: 'strength', status: 'progress', date: date > U.today() ? date : U.today(), time: U.nowTime(),
    startedAt: Date.now(), templateId: tpl ? tpl.id : null, intensity: 3
  };
  if (a) a = { ...a, ...base, wasPlanned: a.status === 'planned', title: a.title || (tpl ? tpl.name : 'Séance libre'), exercises: a.exercises && a.exercises.length ? a.exercises : W.buildExercises(tpl ? tpl.items : []) };
  else a = { id: U.uid(), ...base, title: title || (tpl ? tpl.name : 'Séance libre'), exercises: W.buildExercises(tpl ? tpl.items : []) };
  await DB.put('activities', a);
  App.go('seance-' + a.id);
};

let _tick = null, _rest = null, _wake = null;
const saveLater = U.debounce(a => { DB.put('activities', a); }, 350);

Pages.workout = {
  title: 'Séance',
  nav: 'sport',
  render(id) {
    const a = DB.get('activities', id);
    if (!a) return `<div class="card">${UI.empty('dumbbell', 'Séance introuvable', 'Elle a peut-être été supprimée.', '<a class="btn primary" href="#sport">Retour au sport</a>')}</div>`;
    const editing = a.status === 'done';
    const total = U.sum(a.exercises.map(e => e.sets.length)), done = D.workoutSetsDone(a);
    return `<div class="wk-bar">
      <div class="grow"><div class="muted xs" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700">${editing ? 'Modification' : 'Séance en cours'}</div><div style="font-weight:700;font-size:16px">${U.esc(D.actTitle(a))}</div></div>
      ${editing ? '' : `<div class="clock" id="wk-clock">00:00</div>`}
      <div class="muted small" id="wk-count">${done}/${total} séries</div>
      <div class="row" style="gap:6px">${editing ? `<a class="btn sm" href="#sport" style="background:transparent;color:inherit">Fermer</a><button class="btn sm primary" data-act="wkSaveEdit">Enregistrer</button>` : `<button class="btn sm" data-act="wkAbort" style="background:transparent;color:inherit;border-color:color-mix(in srgb,var(--bg) 30%,transparent)">Abandonner</button><button class="btn sm good" data-act="wkFinish">${U.icon('check', 'sm')}Terminer</button>`}</div>
    </div>
    <div class="stack" id="wk-list">
      ${a.exercises.length ? a.exercises.map((e, i) => exCard(a, e, i)).join('') : `<div class="card">${UI.empty('dumbbell', 'Séance libre', 'Ajoute ton premier exercice. Les charges de ta dernière fois seront reprises automatiquement.')}</div>`}
      <button class="btn lg block" data-act="wkAddEx">${U.icon('plus')}Ajouter un exercice</button>
      <label class="field"><span>Notes de séance</span><textarea id="wk-note" rows="2" placeholder="Réglages machine, sensations…">${U.esc(a.comment || '')}</textarea></label>
    </div>`;
  },
  mount(root, id) {
    const a = DB.get('activities', id); if (!a) return;
    Pages.workout.cur = a;
    if (a.status === 'progress') {
      const clock = root.querySelector('#wk-clock');
      const upd = () => { const s = Math.floor((Date.now() - (a.startedAt || Date.now())) / 1000); clock.textContent = s >= 3600 ? `${Math.floor(s / 3600)}:${U.pad(Math.floor(s / 60) % 60)}:${U.pad(s % 60)}` : `${U.pad(Math.floor(s / 60))}:${U.pad(s % 60)}`; };
      upd(); clearInterval(_tick); _tick = setInterval(upd, 1000);
      try { if (navigator.wakeLock && !_wake) navigator.wakeLock.request('screen').then(l => { _wake = l; }).catch(() => {}); } catch (e) { /* facultatif */ }
    }
    root.querySelector('#wk-list').addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'wk-note') { a.comment = t.value; saveLater(a); return; }
      if (!t.dataset.f) return;
      const ex = a.exercises[+t.dataset.e], set = ex.sets[+t.dataset.s];
      set[t.dataset.f] = U.parseNum(t.value);
      saveLater(a);
    });
  },
  leave() { clearInterval(_tick); _tick = null; W.stopRest(); if (_wake) { _wake.release().catch(() => {}); _wake = null; } }
};

function exCard(a, e, i) {
  const ex = D.exercise(e.exId);
  const last = D.lastPerf(e.exId, a.id);
  const colL = ex.kind === 'time' ? 'Sec.' : 'Rép.';
  const kgL = ex.kind === 'weight' ? 'Kg' : 'Lest';
  return `<article class="card ex-card" data-ex="${i}">
    <div class="ex-h"><span class="ic-badge sm" style="--c:var(--c-strength)">${U.icon('dumbbell')}</span><div class="grow"><h3>${U.esc(ex.name)}</h3><div class="xs faint">${U.esc(ex.group)}${e.target && e.target.sets ? ` · objectif ${e.target.sets} × ${e.target.reps ?? '?'}${ex.kind === 'time' ? ' s' : ''}` : ''}</div></div>
      <button class="icon-btn sm" data-act="wkExHist" data-id="${e.exId}" title="Historique">${U.icon('history')}</button>
      <button class="icon-btn sm" data-act="wkExDel" data-i="${i}" title="Retirer l'exercice">${U.icon('x')}</button></div>
    ${ex.tip ? `<details class="ex-tip"><summary>${U.icon('info', 'sm')}Technique</summary><p>${U.esc(ex.tip)}</p></details>` : ''}
    <div class="ex-last">${last ? `${U.icon('history', 'sm')}<span>Dernière fois (${U.fmtShort(last.date)}) :</span><b>${U.esc(D.setsLabel(last.sets, ex.kind))}</b>` : `${U.icon('sparkle', 'sm')}<span>Première fois : choisis une charge confortable, tu pourras progresser ensuite.</span>`}</div>
    ${(() => { const sg = a.status === 'progress' ? D.suggestLoad(e.exId) : null; if (!sg || sg.keep || (sg.kg != null ? e.sets.every(s => s.kg === sg.kg) : e.sets.every(s => s.reps === sg.reps))) return ''; return `<div class="ex-sug ${sg.up ? 'up' : 'down'}">${U.icon(sg.up ? 'trendUp' : 'trendDown', 'sm')}<span class="grow">Suggestion : <b>${sg.kg != null ? U.num(sg.kg, sg.kg % 1 ? 1 : 0) + ' kg × ' : ''}${sg.reps}${ex.kind === 'time' ? ' s' : ''}</b> <span class="faint">(${sg.delta}, ${U.esc(sg.why)})</span></span><button class="btn sm" data-act="wkApplySug" data-e="${i}">Appliquer</button></div>`; })()}
    <div class="sets"><span class="hd center">#</span><span class="hd center">${kgL}</span><span class="hd center">${colL}</span><span class="hd center">OK</span><span></span>
      ${e.sets.map((s, j) => `<span class="sn">${j + 1}</span>
        <input inputmode="decimal" data-f="kg" data-e="${i}" data-s="${j}" value="${s.kg != null ? U.num(s.kg, s.kg % 1 ? 1 : 0) : ''}" placeholder="${ex.kind === 'weight' ? 'kg' : '0'}" aria-label="Charge série ${j + 1}" class="${s.done ? 'done-in' : ''}">
        <input inputmode="numeric" data-f="reps" data-e="${i}" data-s="${j}" value="${s.reps ?? ''}" placeholder="${e.target && e.target.reps ? e.target.reps : ''}" aria-label="Répétitions série ${j + 1}">
        <button class="set-ok ${s.done ? 'on' : ''}" data-act="wkSet" data-e="${i}" data-s="${j}" aria-label="Valider la série ${j + 1}">${U.icon('check')}</button>
        <button class="icon-btn sm" data-act="wkSetDel" data-e="${i}" data-s="${j}" aria-label="Supprimer la série">${U.icon('minus')}</button>`).join('')}
    </div>
    <div class="ex-f"><button class="btn sm" data-act="wkSetAdd" data-e="${i}">${U.icon('plus', 'sm')}Série</button></div>
  </article>`;
}
function cur() { return Pages.workout.cur; }
function rerender() { const y = scrollY; App.renderView(false); scrollTo(0, y); }
function updCount() { const a = cur(); const el = document.getElementById('wk-count'); if (el) el.textContent = `${D.workoutSetsDone(a)}/${U.sum(a.exercises.map(e => e.sets.length))} séries`; }

A.wkSet = el => {
  const a = cur(); const s = a.exercises[+el.dataset.e].sets[+el.dataset.s];
  const card = el.closest('.ex-card');
  const inputs = card.querySelectorAll(`input[data-s="${el.dataset.s}"]`);
  inputs.forEach(i => { const v = U.parseNum(i.value); s[i.dataset.f] = v; });
  s.done = !s.done;
  el.classList.toggle('on', s.done);
  inputs.forEach(i => i.parentElement && i.classList.toggle('done-in', s.done));
  DB.put('activities', a);
  updCount();
  if (s.done && a.status === 'progress') { if (navigator.vibrate) navigator.vibrate(20); W.startRest(); }
};
A.wkApplySug = el => {
  const a = cur(); const ex = a.exercises[+el.dataset.e]; const sg = D.suggestLoad(ex.exId); if (!sg) return;
  ex.sets.forEach(s => { if (!s.done) { if (sg.kg != null) s.kg = sg.kg; s.reps = sg.reps; } });
  DB.put('activities', a); rerender(); UI.toast('Suggestion appliquée aux séries restantes');
};
A.wkSetAdd = el => { const a = cur(); const ex = a.exercises[+el.dataset.e]; const l = ex.sets[ex.sets.length - 1]; ex.sets.push({ kg: l ? l.kg : null, reps: l ? l.reps : null, done: false }); DB.put('activities', a); rerender(); };
A.wkSetDel = el => { const a = cur(); const ex = a.exercises[+el.dataset.e]; ex.sets.splice(+el.dataset.s, 1); DB.put('activities', a); rerender(); };
A.wkExDel = async el => {
  const a = cur(); const i = +el.dataset.i; const ex = a.exercises[i];
  if (ex.sets.some(s => s.done)) { const ok = await UI.confirm({ title: 'Retirer l\'exercice ?', text: 'Les séries déjà validées seront perdues.', ok: 'Retirer', danger: true }); if (!ok) return; }
  a.exercises.splice(i, 1); DB.put('activities', a); rerender();
};
A.wkAddEx = () => F.exPicker(exId => {
  const a = cur();
  a.exercises.push(...W.buildExercises([{ exId, sets: 3, reps: null, kg: null }]));
  DB.put('activities', a); rerender();
  setTimeout(() => { const cards = document.querySelectorAll('.ex-card'); const c = cards[cards.length - 1]; if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
});
A.wkExHist = el => F.exHistory(el.dataset.id);
A.wkSaveEdit = async () => {
  const a = cur(); a.kcal = a.kcalManual ? a.kcal : D.estimateKcal('strength', a.duration, a.intensity);
  await DB.put('activities', a); UI.toast('Séance mise à jour'); App.go('sport'); App.changed();
};
A.wkAbort = async () => {
  const a = cur();
  const ok = await UI.confirm({ title: 'Abandonner la séance ?', text: a.wasPlanned ? 'La séance redeviendra « prévue » dans ton calendrier.' : 'La séance et ses séries seront supprimées.', ok: 'Abandonner', danger: true });
  if (!ok) return;
  if (a.wasPlanned) await DB.put('activities', { ...a, status: 'planned', exercises: null, startedAt: null });
  else await DB.del('activities', a.id);
  App.go('sport'); App.changed();
};
A.wkFinish = () => {
  const a = cur();
  const done = D.workoutSetsDone(a);
  const mins = Math.max(1, Math.round((Date.now() - (a.startedAt || Date.now())) / 60000));
  // Records (charge maximale estimée) par rapport à l'historique
  const prs = [];
  for (const e of a.exercises) {
    const sets = e.sets.filter(s => s.done && s.kg && s.reps);
    if (!sets.length) continue;
    const prev = D.exHistory(e.exId).filter(h => h.actId !== a.id);
    if (!prev.length) continue;
    const best = Math.max(...prev.map(h => h.e1rm));
    const top = sets.reduce((b, s) => D.e1rm(s.kg, s.reps) > D.e1rm(b.kg, b.reps) ? s : b);
    if (D.e1rm(top.kg, top.reps) > best + 0.01) prs.push({ name: D.exercise(e.exId).name, kg: top.kg, reps: top.reps });
  }
  UI.open({
    title: 'Terminer la séance', size: 'sm',
    body: `<form id="wkf" class="stack">
      <div class="g-3 grid" style="gap:10px"><div class="kpi"><span class="v">${done}</span><span class="l">Séries validées</span></div><div class="kpi"><span class="v">${U.num(D.workoutVolume(a))}<small>kg</small></span><span class="l">Volume</span></div><div class="kpi"><span class="v">${prs.length}</span><span class="l">Record${prs.length > 1 ? 's' : ''}</span></div></div>
      ${done ? '' : `<div class="note warn">${U.icon('info', 'sm')}<span>Aucune série validée. Tu peux quand même enregistrer la séance.</span></div>`}
      <label class="field"><span>Durée</span><div class="input-unit"><input name="duration" id="wkf-dur" inputmode="numeric" value="${mins}"><em>min</em></div></label>
      <div class="field"><span>Intensité</span>${UI.pick('intensity', D.INTENSITY.map((l, i) => ({ v: i + 1, html: `${i + 1}<small>${l.split(' ').pop()}</small>` })), 3, 'scale-pick')}</div>
      <div class="field"><span>Ressenti</span>${UI.pick('feeling', D.FEELING.map((l, i) => ({ v: i + 1, html: `${i + 1}<small>${l}</small>` })), 4, 'scale-pick')}</div></form>`,
    footer: `<button class="btn ghost" data-close-top>Continuer la séance</button><button class="btn good" data-act="wkFinishSave">${U.icon('check', 'sm')}Valider</button>`,
    onMount: m => { m.prs = prs; }
  });
};
A.wkFinishSave = async () => {
  const m = UI.top(); const o = UI.form(document.getElementById('wkf'));
  const a = cur();
  const note = document.getElementById('wk-note');
  Object.assign(a, { status: 'done', duration: o.duration || 1, intensity: +o.intensity || 3, feeling: +o.feeling || 4, comment: note ? note.value : a.comment, finishedAt: Date.now() });
  a.kcal = D.estimateKcal('strength', a.duration, a.intensity);
  delete a.wasPlanned;
  await DB.put('activities', a);
  const prs = m.prs || [];
  m.close();
  W.stopRest();
  App.go('sport');
  App.changed();
  setTimeout(() => UI.celebrate({
    icon: prs.length ? 'trophy' : 'check', title: 'Séance validée',
    text: `${D.workoutSetsDone(a)} séries en ${U.dur(a.duration)} · ${U.num(D.workoutVolume(a))} kg soulevés.`,
    extra: prs.length ? `<div class="list" style="width:100%;text-align:left">${prs.map(p => `<div class="li"><span class="ic-badge sm" style="--c:var(--goal)">${U.icon('trophy')}</span><span class="grow"><span class="t">${U.esc(p.name)}</span><span class="s">Nouveau record : ${U.num(p.kg, p.kg % 1 ? 1 : 0)} kg × ${p.reps}</span></span></div>`).join('')}</div>` : ''
  }), 250);
};

/* Minuteur de repos */
W.startRest = (sec = W.REST()) => {
  W.stopRest();
  const box = document.createElement('div');
  box.className = 'rest-timer'; box.id = 'rest';
  box.innerHTML = `${U.icon('timer')}<div><div class="xs" style="opacity:.7">Repos</div><b id="rest-t"></b></div><button class="btn sm" data-act="restAdd" data-v="-15">−15</button><button class="btn sm" data-act="restAdd" data-v="15">+15</button><button class="btn sm" data-act="restSkip">Passer</button>`;
  document.body.appendChild(box);
  let end = Date.now() + sec * 1000;
  const t = box.querySelector('#rest-t');
  const tick = () => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    t.textContent = `${Math.floor(left / 60)}:${U.pad(left % 60)}`;
    if (left <= 0) { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); W.stopRest(); UI.toast('Repos terminé, série suivante', { type: 'info' }); }
  };
  _rest = { box, int: setInterval(tick, 250), add: v => { end += v * 1000; tick(); } };
  tick();
};
W.stopRest = () => { if (_rest) { clearInterval(_rest.int); _rest.box.remove(); _rest = null; } };
A.restAdd = el => _rest && _rest.add(+el.dataset.v);
A.restSkip = () => W.stopRest();

/* Choix d'un exercice */
F.exPicker = onPick => {
  const st = { q: '', all: false };
  const list = () => {
    const q = U.norm(st.q);
    const pool = D.exercises().filter(e => !q || U.norm(e.name).includes(q) || U.norm(e.group).includes(q));
    const all = st.all ? pool : pool.filter(D.exAvailable);
    const hiddenN = pool.length - all.length;
    if (!all.length) return UI.empty('search', 'Aucun exercice', hiddenN ? `${hiddenN} exercice(s) demandent du matériel que tu n'as pas coché.` : 'Crée-le en quelques secondes.', `<button class="btn primary sm" data-act="exCreate" data-name="${U.esc(st.q)}">${U.icon('plus', 'sm')}Créer « ${U.esc(st.q)} »</button>`);
    return D.EX_GROUPS.map(g => { const items = all.filter(e => e.group === g); return items.length ? `<div class="eyebrow" style="padding:10px 10px 4px">${g}</div>${items.map(e => { const l = D.lastPerf(e.id); const eq = (e.eq || []).map(x => (D.EQUIPMENT.find(q => q.id === x) || {}).label).filter(Boolean); return `<button class="food-row" data-act="exPick" data-id="${e.id}"><span class="grow"><span class="t">${U.esc(e.name)}</span><br><span class="s">${eq.length ? eq.join(' + ') : 'Poids du corps'}${l ? ' · dernière fois : ' + U.esc(D.setsLabel(l.sets, e.kind)) : ''}${D.exAvailable(e) ? '' : ' · matériel manquant'}</span></span>${U.icon('plus', 'sm')}</button>`; }).join('')}` : ''; }).join('') + (hiddenN && !st.all ? `<p class="hint center">${hiddenN} exercice${hiddenN > 1 ? 's' : ''} masqué${hiddenN > 1 ? 's' : ''} (matériel non coché).</p>` : '');
  };
  const m = UI.open({
    title: 'Exercice', size: 'md',
    body: `<div class="input-unit"><input class="input" id="exq" placeholder="Rechercher un exercice ou un muscle" autocomplete="off"><em>${U.icon('search', 'sm')}</em></div>
      <label class="row small"><span class="switch"><input type="checkbox" id="ex-all"><span></span></span><span>Afficher aussi le matériel que je n'ai pas</span></label>
      <div class="food-results" id="exres">${list()}</div>`,
    footer: `<button class="btn ghost" data-act="exCreate">${U.icon('plus', 'sm')}Créer un exercice</button><span class="spacer"></span><button class="btn ghost" data-close-top>Fermer</button>`,
    onMount: mm => {
      mm.onPick = onPick;
      const q = mm.el.querySelector('#exq');
      q.addEventListener('input', () => { st.q = q.value; mm.el.querySelector('#exres').innerHTML = list(); });
      mm.el.querySelector('#ex-all').addEventListener('change', e => { st.all = e.target.checked; mm.el.querySelector('#exres').innerHTML = list(); });
    }
  });
  return m;
};
A.exPick = el => { const m = UI.top(); const cb = m.onPick; m.close(); cb(el.dataset.id); };
A.exCreate = el => F.exEdit(null, el.dataset.name || '');
F.exEdit = (id, name = '') => {
  const e = id ? D.exercise(id) : { name, group: 'Pectoraux', kind: 'weight', eq: ['halteres'] };
  UI.open({
    title: id ? 'Modifier l\'exercice' : 'Nouvel exercice', size: 'sm',
    body: `<form id="exf" class="stack"><label class="field"><span>Nom</span><input name="name" id="exf-name" value="${U.esc(e.name)}" placeholder="Ex. Pull-over poulie"></label>
      <label class="field"><span>Groupe musculaire</span><select name="group" id="exf-group">${D.EX_GROUPS.map(g => `<option ${g === e.group ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <div class="field"><span>Matériel nécessaire</span><div class="chips">${D.EQUIPMENT.filter(q => !q.fixed).map(q => `<label class="chip ${(e.eq || []).includes(q.id) ? 'on' : ''}"><input type="checkbox" name="eq-${q.id}" ${(e.eq || []).includes(q.id) ? 'checked' : ''} hidden onchange="this.parentElement.classList.toggle('on', this.checked)">${q.label}</label>`).join('')}</div><small>Rien de coché = poids du corps.</small></div>
      <div class="field"><span>Mesure</span>${UI.pick('kind', [{ v: 'weight', l: 'Charge × répétitions' }, { v: 'reps', l: 'Répétitions' }, { v: 'time', l: 'Durée' }], e.kind, 'seg full')}</div></form>`,
    footer: `${id ? `<button class="btn ghost danger" data-act="exDel" data-id="${id}">${U.icon('trash')}</button><span class="spacer"></span>` : ''}<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="exSave" data-id="${id || ''}">Enregistrer</button>`
  });
};
A.exSave = async el => {
  const o = UI.form(document.getElementById('exf'));
  if (!o.name) { UI.toast('Donne un nom à l\'exercice', { type: 'err' }); return; }
  const id = el.dataset.id;
  const orig = id ? D.exercise(id) : null;
  let rec;
  if (orig && orig.base) { rec = { id: 'cx-' + U.uid(), name: o.name, group: o.group, kind: o.kind }; await DB.setSetting('hiddenExercises', [...DB.setting('hiddenExercises', []), orig.id]); rec.replaces = orig.id; }
  else rec = { id: id || 'cx-' + U.uid(), name: o.name, group: o.group, kind: o.kind };
  rec.eq = D.EQUIPMENT.filter(q => !q.fixed && o['eq-' + q.id]).map(q => q.id);
  if (orig && orig.tip) rec.tip = orig.tip;
  if (orig && orig.base) {
    // Conserve l'historique : on remplace l'identifiant dans les séances et modèles
    const acts = DB.all('activities').filter(a => a.exercises && a.exercises.some(x => x.exId === orig.id)).map(a => ({ ...a, exercises: a.exercises.map(x => x.exId === orig.id ? { ...x, exId: rec.id } : x) }));
    if (acts.length) await DB.putMany('activities', acts);
    const tpls = DB.all('templates').filter(t => t.items.some(x => x.exId === orig.id)).map(t => ({ ...t, items: t.items.map(x => x.exId === orig.id ? { ...x, exId: rec.id } : x) }));
    if (tpls.length) await DB.putMany('templates', tpls);
  }
  await DB.put('exercises', rec);
  UI.top().close();
  UI.toast(id ? 'Exercice mis à jour' : 'Exercice créé');
  const parent = UI.top();
  if (parent && parent.onPick && !id) { const cb = parent.onPick; parent.close(); cb(rec.id); }
  App.changed();
};
A.exDel = async el => {
  const e = D.exercise(el.dataset.id);
  const ok = await UI.confirm({ title: 'Supprimer l\'exercice ?', text: 'Il disparaîtra de la liste. L\'historique des séances passées est conservé.', ok: 'Supprimer', danger: true });
  if (!ok) return;
  if (e.base) await DB.setSetting('hiddenExercises', [...DB.setting('hiddenExercises', []), e.id]);
  else await DB.del('exercises', e.id);
  UI.top().close(); UI.toast('Exercice supprimé'); App.changed();
};

/* Historique d'un exercice */
F.exHistory = exId => {
  const ex = D.exercise(exId);
  const h = D.exHistory(exId);
  UI.open({
    title: ex.name, sub: `${ex.group} · ${h.length} séance${h.length > 1 ? 's' : ''}`, size: 'md',
    body: (ex.tip ? `<div class="note">${U.icon('info', 'sm')}<span>${U.esc(ex.tip)}</span></div>` : '') + (h.length ? `<div id="exh-chart"></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Séries</th>${ex.kind === 'weight' ? '<th class="r">Max estimé</th>' : ''}</tr></thead><tbody>${h.slice().reverse().map(x => `<tr><td>${U.fmtShort(x.date)}</td><td>${U.esc(D.setsLabel(x.sets, ex.kind))}</td>${ex.kind === 'weight' ? `<td class="r">${U.num(x.e1rm, 1)} kg</td>` : ''}</tr>`).join('')}</tbody></table></div>
      ${ex.kind === 'weight' ? '<p class="hint" style="margin:0">Max estimé : charge théorique sur une répétition (formule d\'Epley), utile pour comparer des séries différentes. À ne pas tester réellement.</p>' : ''}`
      : UI.empty('history', 'Pas encore d\'historique', 'Valide des séries de cet exercice pendant une séance pour suivre ta progression.')),
    onMount: m => {
      const el = m.el.querySelector('#exh-chart');
      if (el && h.length) {
        const key = ex.kind === 'weight' ? 'e1rm' : 'totalReps';
        Charts.line(el, { height: 200, label: 'Progression', series: [{ name: ex.kind === 'weight' ? 'Max estimé' : 'Répétitions', color: 'var(--c-strength)', style: 'area', dots: true, endDot: true, points: h.map(x => ({ x: x.date, y: x[key] })) }], minRange: 4, tip: (d, v) => `${U.fmtShort(d)}<br><b>${U.num(v[0].p.y, 1)} ${ex.kind === 'weight' ? 'kg' : ex.kind === 'time' ? 's' : 'rép.'}</b>` });
      }
    }
  });
};
