'use strict';
/* Cap 100 — formulaires de saisie partagés (ajout rapide, calendrier, pages) */

const F = {};

/* ---------- Ajout rapide ---------- */
F.quick = (date = U.today()) => {
  const items = [
    ['weight', 'Poids', 'scale', 'var(--c-weight)'],
    ['food', 'Repas', 'food', 'var(--c-food)'],
    ['activity', 'Activité', 'pulse', 'var(--c-walk)'],
    ['workout', 'Séance muscu', 'dumbbell', 'var(--c-strength)'],
    ['plan', 'Programmer', 'calendar', 'var(--accent)'],
    ['steps', 'Pas', 'steps', 'var(--c-walk)'],
    ['measure', 'Mensurations', 'ruler', 'var(--c-bike)'],
    ['photo', 'Photo', 'camera', 'var(--c-run)'],
    ['note', 'Ressenti', 'smile', 'var(--goal)']
  ];
  UI.open({
    title: 'Ajouter', sub: U.relDay(date), size: 'md',
    body: `<div class="quick-grid">${items.map(([k, l, ic, c]) => `<button data-act="quickGo" data-k="${k}" data-date="${date}"><span class="ic-badge" style="--c:${c}">${U.icon(ic, 'lg')}</span>${l}</button>`).join('')}</div>
      <p class="hint center" style="margin:0">Raccourcis clavier : <kbd>P</kbd> poids · <kbd>R</kbd> repas · <kbd>A</kbd> activité · <kbd>N</kbd> ce menu</p>`
  });
};
A.quickGo = el => {
  const t = UI.top(); if (t) t.close();
  const d = el.dataset.date || U.today(), k = el.dataset.k;
  setTimeout(() => ({
    weight: () => F.weight(d), food: () => F.food({ date: d }), activity: () => F.activity({ date: d }),
    workout: () => F.startWorkoutPicker(d), plan: () => F.activity({ date: d > U.today() ? d : U.addDays(U.today(), 1), status: 'planned', type: 'strength' }),
    steps: () => F.steps(d), measure: () => F.measure(d), photo: () => F.photo(d), note: () => F.note(d)
  }[k] || (() => {}))(), 60);
};

/* ---------- Poids ---------- */
F.weight = (date = U.today()) => {
  const existing = DB.get('weights', date);
  const last = D.current();
  let kg = existing ? existing.kg : (last ? last.kg : D.goal().start);
  UI.open({
    title: 'Poids', sub: 'Pesée du matin, à jeun, de préférence', size: 'sm',
    body: () => `<form id="wf" class="stack">
      <div class="stepper">
        <button type="button" data-act="wStep" data-d="-0.1" aria-label="Moins 0,1">−</button>
        <div class="input-unit grow"><input class="input" id="w-kg" name="kg" inputmode="decimal" value="${U.num(kg, 1)}" autocomplete="off" aria-label="Poids en kilogrammes"><em>kg</em></div>
        <button type="button" data-act="wStep" data-d="0.1" aria-label="Plus 0,1">+</button>
      </div>
      <div class="fields keep">
        <label class="field"><span>Date</span><input type="date" name="date" id="w-date" value="${date}" max="${U.today()}"></label>
        <label class="field"><span>Note</span><input name="note" id="w-note" value="${U.esc(existing?.note || '')}" placeholder="Optionnel"></label>
      </div>
      ${last ? `<p class="hint" style="margin:0">Dernière pesée : <b>${U.kg(last.kg)} kg</b> (${U.relDay(last.date).toLowerCase()}) · moyenne 7 jours ${U.kg(last.avg7)} kg. Une variation d'un jour à l'autre reflète surtout l'eau et la digestion.</p>` : ''}
    </form>`,
    footer: `${existing ? `<button class="btn ghost danger" data-act="wDel" data-date="${date}">${U.icon('trash')}Supprimer</button><span class="spacer"></span>` : ''}<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="wSave">Enregistrer</button>`,
    onMount: m => {
      const f = m.el.querySelector('#wf');
      f.addEventListener('submit', e => { e.preventDefault(); A.wSave(); });
      const inp = f.querySelector('#w-kg');
      if (!U.isMobile()) { inp.focus(); inp.select(); }
    }
  });
};
A.wStep = el => {
  const inp = document.getElementById('w-kg');
  const v = (U.parseNum(inp.value) || 0) + +el.dataset.d;
  inp.value = U.num(Math.max(0, v), 1);
};
A.wSave = async () => {
  const f = document.getElementById('wf'); if (!f) return;
  const o = UI.form(f);
  const kg = U.parseNum(f.querySelector('#w-kg').value);
  if (!kg || kg < 30 || kg > 400) { UI.toast('Indique un poids entre 30 et 400 kg', { type: 'err' }); return; }
  if (!o.date) { UI.toast('Choisis une date', { type: 'err' }); return; }
  const prev = D.current();
  await DB.put('weights', { date: o.date, kg: Math.round(kg * 10) / 10, note: o.note || '' });
  UI.top().close();
  const cur = D.current();
  UI.toast(`${U.kg(kg)} kg enregistré${prev && cur ? ` · moyenne 7 j ${U.kg(cur.avg7)} kg` : ''}`);
  App.changed();
};
A.wDel = async el => {
  const date = el.dataset.date, old = DB.get('weights', date);
  await DB.del('weights', date);
  UI.top().close();
  UI.toast('Pesée supprimée', { action: { label: 'Annuler', fn: async () => { await DB.put('weights', old); App.changed(); } } });
  App.changed();
};

/* ---------- Activité (réalisée ou programmée) ---------- */
F.activity = (opts = {}) => {
  const existing = opts.id ? DB.get('activities', opts.id) : null;
  const date = opts.date || U.today();
  const a = existing ? { ...existing } : {
    id: U.uid(), date, time: opts.time || (opts.status === 'planned' ? '18:00' : U.nowTime()),
    type: opts.type || 'walk', status: opts.status || (date > U.today() ? 'planned' : 'done'),
    duration: null, distance: null, kcal: null, intensity: 3, feeling: 4, comment: '', title: '', templateId: null
  };
  if (opts.markDone) { a.status = 'done'; if (!a.feeling) a.feeling = 4; }
  const isNew = !existing;
  const tpls = D.templates();
  UI.open({
    title: isNew ? (a.status === 'planned' ? 'Programmer' : 'Activité') : (opts.markDone ? 'Valider la séance' : 'Modifier'),
    sub: isNew ? (a.status === 'planned' ? 'Une séance à venir, visible dans le calendrier' : 'Course, marche, vélo, renforcement…') : D.actTitle(a),
    size: 'md',
    body: () => `<form id="af" class="stack">
      <div class="type-pick" data-pick="type">${Object.entries(D.ACT).map(([k, t]) => `<button type="button" data-act="pick" data-v="${k}" class="${a.type === k ? 'on' : ''}" style="--c:${t.c}">${U.icon(t.icon)}${t.label}</button>`).join('')}</div><input type="hidden" name="type" value="${a.type}">
      <div class="field"><span>Statut</span>${UI.pick('status', [{ v: 'planned', l: 'Prévu' }, { v: 'done', l: 'Réalisé' }, ...(isNew ? [] : [{ v: 'cancelled', l: 'Annulé' }])], a.status, 'seg full')}</div>
      <label class="field" data-show="tpl"><span>Séance type</span><select name="templateId" id="a-tpl"><option value="">Séance libre</option>${tpls.map(t => `<option value="${t.id}" ${a.templateId === t.id ? 'selected' : ''}>${U.esc(t.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Titre <small>(optionnel)</small></span><input name="title" id="a-title" value="${U.esc(a.title || '')}" placeholder="Ex. Renforcement haut du corps"></label>
      <div class="fields keep">
        <label class="field"><span>Date</span><input type="date" name="date" id="a-date" value="${a.date}"></label>
        <label class="field"><span>Heure</span><input type="time" name="time" id="a-time" value="${a.time || ''}"></label>
        <label class="field"><span>Durée</span><div class="input-unit"><input name="duration" id="a-dur" inputmode="numeric" value="${a.duration ?? ''}" placeholder="45"><em>min</em></div></label>
        <label class="field" data-show="dist"><span>Distance</span><div class="input-unit"><input name="distance" id="a-dist" inputmode="decimal" value="${a.distance != null ? U.num(a.distance, a.distance % 1 ? 2 : 0) : ''}" placeholder="5,2"><em>km</em></div></label>
        <label class="field" data-show="done"><span>Calories estimées</span><div class="input-unit"><input name="kcal" id="a-kcal" inputmode="numeric" value="${a.kcalManual ? a.kcal : ''}" placeholder="auto"><em>kcal</em></div><small id="a-kcal-h">Estimation selon durée, intensité et poids</small></label>
        <div class="field" data-show="pace"><span>Allure</span><div class="input" style="display:flex;align-items:center;background:var(--surface-2);border-color:transparent" id="a-pace">–</div></div>
      </div>
      <div class="field"><span>Intensité</span>${UI.pick('intensity', D.INTENSITY.map((l, i) => ({ v: i + 1, html: `${i + 1}<small>${l.split(' ').pop()}</small>` })), a.intensity || 3, 'scale-pick')}</div>
      <div class="field" data-show="done"><span>Ressenti</span>${UI.pick('feeling', D.FEELING.map((l, i) => ({ v: i + 1, html: `${i + 1}<small>${l}</small>` })), a.feeling || 4, 'scale-pick')}</div>
      <label class="field"><span>Commentaire</span><textarea name="comment" id="a-com" rows="2" placeholder="Sensations, parcours, météo…">${U.esc(a.comment || '')}</textarea></label>
      ${isNew ? `<label class="field" data-show="repeat"><span>Répéter</span><select name="repeat" id="a-rep"><option value="0">Ne pas répéter</option><option value="4">Chaque semaine, 4 semaines</option><option value="8">Chaque semaine, 8 semaines</option><option value="12">Chaque semaine, 12 semaines</option></select></label>` : ''}
    </form>`,
    footer: () => `${!isNew ? `<button class="btn ghost danger" data-act="actDel" data-id="${a.id}">${U.icon('trash')}</button>` : ''}<span class="spacer"></span>
      <button class="btn" data-act="actStartWorkout" data-show-f="strength" hidden>${U.icon('play', 'sm')}Mode séance</button>
      <button class="btn primary" data-act="actSave">${isNew ? 'Enregistrer' : 'Mettre à jour'}</button>`,
    onMount: m => {
      const f = m.el.querySelector('#af');
      m.state = { a, isNew };
      const sync = () => {
        const o = UI.form(f);
        const t = D.ACT[o.type] || D.ACT.other;
        f.querySelectorAll('[data-show="dist"]').forEach(e => { e.hidden = !t.dist; });
        f.querySelectorAll('[data-show="tpl"]').forEach(e => { e.hidden = o.type !== 'strength'; });
        f.querySelectorAll('[data-show="done"]').forEach(e => { e.hidden = o.status !== 'done'; });
        f.querySelectorAll('[data-show="repeat"]').forEach(e => { e.hidden = o.status !== 'planned'; });
        const est = D.estimateKcal(o.type, o.duration, +o.intensity, t.dist ? o.distance : null);
        f.querySelector('#a-kcal').placeholder = est ? String(est) : 'auto';
        const pace = (o.type === 'run' || o.type === 'walk' || o.type === 'hike') ? U.pace(o.duration, o.distance) : null;
        const pw = f.querySelector('[data-show="pace"]'); pw.hidden = !pace; if (pace) f.querySelector('#a-pace').textContent = pace;
        const sb = m.el.querySelector('[data-show-f="strength"]'); if (sb) sb.hidden = !(o.type === 'strength' && o.status !== 'cancelled' && (isNew || a.status === 'planned'));
      };
      f.addEventListener('input', sync);
      f.addEventListener('submit', e => { e.preventDefault(); A.actSave(); });
      f.querySelector('#a-tpl').addEventListener('change', e => {
        const tp = DB.get('templates', e.target.value);
        const ti = f.querySelector('#a-title');
        if (tp && !ti.value) ti.value = tp.name;
      });
      sync();
    }
  });
};
function readActivityForm() {
  const m = UI.top(); const f = document.getElementById('af');
  const o = UI.form(f);
  const { a, isNew } = m.state;
  const t = D.ACT[o.type] || D.ACT.other;
  const out = {
    ...a, type: o.type, status: o.status, title: o.title, date: o.date, time: o.time,
    duration: o.duration, distance: t.dist ? o.distance : null, intensity: +o.intensity || 3,
    feeling: o.status === 'done' ? +o.feeling || null : a.feeling, comment: o.comment,
    templateId: o.type === 'strength' ? (o.templateId || null) : null
  };
  if (o.kcal) { out.kcal = o.kcal; out.kcalManual = true; }
  else { out.kcal = D.estimateKcal(out.type, out.duration, out.intensity, out.distance); out.kcalManual = false; }
  return { out, isNew, repeat: +(o.repeat || 0), m };
}
A.actSave = async () => {
  const { out, isNew, repeat, m } = readActivityForm();
  if (!out.date) { UI.toast('Choisis une date', { type: 'err' }); return; }
  if (out.status === 'done' && !out.duration) { UI.toast('Indique la durée de l\'activité', { type: 'err' }); document.getElementById('a-dur').focus(); return; }
  const wasDone = !isNew && m.state.a.status === 'done';
  const list = [out];
  if (isNew && out.status === 'planned' && repeat) {
    out.seriesId = U.uid();
    for (let k = 1; k < repeat; k++) list.push({ ...out, id: U.uid(), date: U.addDays(out.date, 7 * k) });
  }
  await DB.putMany('activities', list);
  m.close();
  if (out.status === 'done' && !wasDone) {
    UI.burst({ n: 40 });
    UI.toast(`${D.actTitle(out)} validé${out.kcal ? ` · ≈ ${U.num(out.kcal)} kcal` : ''}`);
  } else if (out.status === 'planned') UI.toast(list.length > 1 ? `${list.length} séances programmées` : `Programmé ${U.relDay(out.date).toLowerCase()}${out.time ? ' à ' + out.time.replace(':', 'h') : ''}`);
  else UI.toast('Activité enregistrée');
  App.changed();
};
A.actStartWorkout = () => {
  const { out, isNew, m } = readActivityForm();
  m.close();
  W.start({ templateId: out.templateId, actId: isNew ? null : out.id, date: out.date <= U.today() ? U.today() : out.date, title: out.title });
};
A.actDel = async el => {
  const old = DB.get('activities', el.dataset.id);
  const ok = await UI.confirm({ title: 'Supprimer ?', text: `« ${U.esc(D.actTitle(old))} » du ${U.fmtDate(old.date)} sera supprimé.`, ok: 'Supprimer', danger: true });
  if (!ok) return;
  await DB.del('activities', old.id);
  const t = UI.top(); if (t && t.state && t.state.a) t.close();
  UI.toast('Activité supprimée', { action: { label: 'Annuler', fn: async () => { await DB.put('activities', old); App.changed(); } } });
  App.changed();
};
A.actStatus = async el => {
  const a = DB.get('activities', el.dataset.id); if (!a) return;
  const s = el.dataset.s;
  if (s === 'done') { F.activity({ id: a.id, markDone: true }); return; }
  const old = { ...a };
  await DB.put('activities', { ...a, status: s });
  UI.toast(s === 'cancelled' ? 'Séance annulée' : 'Séance remise en prévu', { action: { label: 'Annuler', fn: async () => { await DB.put('activities', old); App.changed(); } } });
  App.changed();
};
A.actOpen = el => {
  const a = DB.get('activities', el.dataset.id); if (!a) return;
  if (a.status === 'progress') { App.go('seance-' + a.id); return; }
  if (a.type === 'strength' && a.status === 'done' && a.exercises && a.exercises.length) { F.workoutView(a.id); return; }
  F.activity({ id: a.id });
};
A.actStart = el => { const a = DB.get('activities', el.dataset.id); W.start({ templateId: a.templateId, actId: a.id, title: a.title, date: U.today() }); };

/* Choisir une séance type à démarrer */
F.startWorkoutPicker = (date = U.today()) => {
  const tpls = D.templates();
  UI.open({
    title: 'Séance muscu', sub: 'Les charges de ta dernière séance seront pré-remplies', size: 'sm',
    body: `<div class="list">${tpls.map(t => `<button class="li act" data-act="wkPick" data-id="${t.id}" data-date="${date}" style="text-align:left;width:calc(100% + 16px)"><span class="ic-badge" style="--c:var(--c-strength)">${U.icon('dumbbell')}</span><span class="grow"><span class="t">${U.esc(t.name)}</span><span class="s">${t.items.length} exercices · ${U.sum(t.items.map(i => i.sets))} séries</span></span>${U.icon('play', 'sm')}</button>`).join('')}
      <button class="li act" data-act="wkPick" data-id="" data-date="${date}" style="text-align:left;width:calc(100% + 16px)"><span class="ic-badge" style="--c:var(--ink-3)">${U.icon('plus')}</span><span class="grow"><span class="t">Séance libre</span><span class="s">Ajoute les exercices au fur et à mesure</span></span></button></div>`,
    footer: `<button class="btn ghost" data-act="goTemplates">Gérer mes séances types</button>`
  });
};
A.wkPick = el => { UI.top().close(); W.start({ templateId: el.dataset.id || null, date: el.dataset.date <= U.today() ? U.today() : el.dataset.date }); };
A.goTemplates = () => { UI.closeAll(); Pages.training.tab = 'templates'; App.go('sport'); };

/* Détail d'une séance de renforcement terminée */
F.workoutView = id => {
  const a = DB.get('activities', id);
  UI.open({
    title: D.actTitle(a), sub: `${U.fmtLong(a.date)}${a.time ? ' · ' + a.time.replace(':', 'h') : ''}`, size: 'md', live: true,
    body: () => {
      const cur = DB.get('activities', id); if (!cur) return UI.empty('dumbbell', 'Séance supprimée', '');
      return `<div class="g-3 grid" style="gap:10px">
        <div class="kpi"><span class="v">${U.dur(cur.duration)}</span><span class="l">Durée</span></div>
        <div class="kpi"><span class="v">${U.num(D.workoutSetsDone(cur))}</span><span class="l">Séries</span></div>
        <div class="kpi"><span class="v">${U.num(D.workoutVolume(cur))}<small>kg</small></span><span class="l">Volume soulevé</span></div></div>
        <div class="list">${cur.exercises.map(e => { const ex = D.exercise(e.exId); const sets = e.sets.filter(s => s.done); return `<div class="li"><span class="grow"><span class="t">${U.esc(ex.name)}</span><span class="s">${sets.length ? U.esc(D.setsLabel(sets, ex.kind)) : 'Non réalisé'}</span></span></div>`; }).join('')}</div>
        ${cur.comment ? `<div class="note">${U.icon('note', 'sm')}<span>${U.esc(cur.comment)}</span></div>` : ''}`;
    },
    footer: `<button class="btn ghost danger" data-act="actDel" data-id="${id}">${U.icon('trash')}</button><span class="spacer"></span><button class="btn" data-act="wkEditDone" data-id="${id}">${U.icon('edit', 'sm')}Modifier les séries</button><button class="btn" data-act="wkEditMeta" data-id="${id}">Infos</button>`
  });
};
A.wkEditDone = el => { UI.closeAll(); App.go('seance-' + el.dataset.id); };
A.wkEditMeta = el => { UI.top().close(); F.activity({ id: el.dataset.id }); };

/* ---------- Pas ---------- */
F.steps = (date = U.today()) => {
  const d = D.day(date);
  UI.open({
    title: 'Pas', sub: U.relDay(date), size: 'sm',
    body: `<form id="sf" class="stack">
      <div class="input-unit"><input class="input" id="s-val" name="steps" inputmode="numeric" value="${d.steps || ''}" placeholder="8 000" style="height:64px;font:700 40px/1 var(--display);text-align:center"><em>pas</em></div>
      <div class="chips">${[1000, 2000, 5000].map(v => `<button type="button" class="chip" data-act="stepsAdd" data-v="${v}">+ ${U.num(v)}</button>`).join('')}</div>
      <p class="hint" style="margin:0">Objectif quotidien : ${U.num(D.targets().steps)} pas. Recopie le total indiqué par ton téléphone ou ta montre.</p></form>`,
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="stepsSave" data-date="${date}">Enregistrer</button>`,
    onMount: m => m.el.querySelector('#sf').addEventListener('submit', e => { e.preventDefault(); A.stepsSave(m.el.querySelector('[data-act="stepsSave"]')); })
  });
};
A.stepsAdd = el => { const i = document.getElementById('s-val'); i.value = (U.parseNum(i.value) || 0) + +el.dataset.v; };
A.stepsSave = async el => {
  const v = U.parseNum(document.getElementById('s-val').value);
  const date = el.dataset.date;
  await DB.put('days', { ...D.day(date), date, steps: v ? Math.round(v) : null });
  UI.top().close();
  UI.toast(v ? `${U.num(v)} pas enregistrés` : 'Pas effacés');
  App.changed();
};

/* ---------- Ressenti & note ---------- */
F.note = (date = U.today()) => {
  const d = D.day(date);
  UI.open({
    title: 'Ressenti', sub: U.relDay(date), size: 'sm',
    body: `<form id="nf" class="stack">
      <div class="field"><span>Humeur / ressenti général</span>${UI.pick('mood', D.MOOD.map((l, i) => ({ v: i + 1, html: `${i + 1}<small>${l}</small>` })), d.mood || '', 'scale-pick')}</div>
      <div class="field"><span>Énergie</span>${UI.pick('energy', ['Faible', 'Moyenne', 'Bonne'].map((l, i) => ({ v: i + 1, l })), d.energy || '', 'seg full')}</div>
      <label class="field"><span>Note</span><textarea name="note" id="n-note" rows="4" placeholder="Sommeil, faim, stress, douleurs…">${U.esc(d.note || '')}</textarea></label>
      <label class="row"><span class="switch"><input type="checkbox" name="rest" id="n-rest" ${d.rest ? 'checked' : ''}><span></span></span><span>Journée de repos</span></label></form>`,
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="noteSave" data-date="${date}">Enregistrer</button>`
  });
};
A.noteSave = async el => {
  const o = UI.form(document.getElementById('nf'));
  const date = el.dataset.date;
  await DB.put('days', { ...D.day(date), date, mood: +o.mood || null, energy: +o.energy || null, note: o.note, rest: o.rest });
  UI.top().close(); UI.toast('Ressenti enregistré'); App.changed();
};

/* ---------- Mensurations ---------- */
F.measure = (date = U.today()) => {
  const existing = DB.get('measurements', date);
  const all = DB.all('measurements').sort((a, b) => a.date < b.date ? -1 : 1);
  const last = all.filter(m => m.date < date).pop();
  UI.open({
    title: 'Mensurations', sub: 'Mètre ruban souple, même endroit, même moment de la journée', size: 'md',
    body: `<form id="mf" class="stack">
      <label class="field" style="max-width:220px"><span>Date</span><input type="date" name="date" id="m-date" value="${date}" max="${U.today()}"></label>
      <div class="fields">${D.MEASURES.map(me => `<label class="field"><span>${me.label}</span><div class="input-unit"><input name="${me.id}" id="m-${me.id}" inputmode="decimal" value="${existing && existing[me.id] != null ? U.num(existing[me.id], 1) : ''}" placeholder="${last && last[me.id] != null ? U.num(last[me.id], 1) : ''}"><em>cm</em></div></label>`).join('')}</div>
      <p class="hint" style="margin:0">${last ? `En gris : tes valeurs du ${U.fmtDate(last.date)}.` : 'Taille : au niveau du nombril. Épaules : tour complet au point le plus large.'} Les mensurations montrent la transformation même quand la balance stagne.</p></form>`,
    footer: `${existing ? `<button class="btn ghost danger" data-act="measDel" data-date="${date}">${U.icon('trash')}</button><span class="spacer"></span>` : ''}<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="measSave">Enregistrer</button>`
  });
};
A.measSave = async () => {
  const o = UI.form(document.getElementById('mf'));
  const rec = { date: o.date };
  let n = 0;
  for (const me of D.MEASURES) { const v = U.parseNum(document.getElementById('m-' + me.id).value); if (v) { rec[me.id] = v; n++; } }
  if (!n) { UI.toast('Renseigne au moins une mesure', { type: 'err' }); return; }
  await DB.put('measurements', rec);
  UI.top().close(); UI.toast('Mensurations enregistrées'); App.changed();
};
A.measDel = async el => {
  const old = DB.get('measurements', el.dataset.date);
  await DB.del('measurements', el.dataset.date);
  UI.top().close();
  UI.toast('Mensurations supprimées', { action: { label: 'Annuler', fn: async () => { await DB.put('measurements', old); App.changed(); } } });
  App.changed();
};

/* ---------- Photo ---------- */
F.photo = (date = U.today()) => {
  UI.open({
    title: 'Photo de progression', size: 'sm',
    body: `<form id="pf" class="stack">
      <label class="btn lg block" style="position:relative;overflow:hidden">${U.icon('camera')}<span id="p-lbl">Choisir ou prendre une photo</span><input type="file" id="p-file" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
      <img id="p-prev" alt="" hidden style="border-radius:12px;max-height:240px;object-fit:contain;background:var(--surface-2)">
      <div class="fields keep">
        <label class="field"><span>Date</span><input type="date" name="date" id="p-date" value="${date}" max="${U.today()}"></label>
        <label class="field"><span>Angle</span><select name="pose" id="p-pose"><option value="face">Face</option><option value="profil">Profil</option><option value="dos">Dos</option><option value="autre">Autre</option></select></label>
      </div>
      <label class="field"><span>Note</span><input name="note" id="p-note" placeholder="Optionnel"></label>
      <div class="note">${U.icon('shield', 'sm')}<span>La photo est réduite puis enregistrée uniquement dans ce navigateur. Elle n'est jamais envoyée sur internet.</span></div></form>`,
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="photoSave" id="p-save" disabled>Enregistrer</button>`,
    onMount: m => {
      m.el.querySelector('#p-file').addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        m.el.querySelector('#p-lbl').textContent = 'Préparation…';
        try {
          m.blob = await U.resizeImage(file);
          const img = m.el.querySelector('#p-prev');
          img.src = URL.createObjectURL(m.blob); img.hidden = false;
          m.el.querySelector('#p-lbl').textContent = 'Changer de photo';
          m.el.querySelector('#p-save').disabled = false;
        } catch (err) { UI.toast('Image illisible, essaie un autre fichier', { type: 'err' }); m.el.querySelector('#p-lbl').textContent = 'Choisir ou prendre une photo'; }
      });
    }
  });
};
A.photoSave = async () => {
  const m = UI.top(); if (!m.blob) return;
  const o = UI.form(document.getElementById('pf'));
  await DB.put('photos', { id: U.uid(), date: o.date, pose: o.pose, note: o.note, blob: m.blob, created: Date.now() });
  m.close(); UI.toast('Photo enregistrée sur cet appareil'); App.changed();
};

/* ---------- Aliments : recherche, quantité au gramme, repas composé ---------- */
F.food = (opts = {}) => {
  const st = { date: opts.date || U.today(), slot: opts.slot || F.guessSlot(), q: '', sel: null, qty: null, tab: 'search', basket: [], mealName: '', asRecipe: false, editIdx: null };
  const m = UI.open({
    title: 'Ajouter au repas', sub: () => `${D.slotLabel(st.slot)} · ${U.relDay(st.date)}`, size: 'md',
    body: () => st.sel ? foodQtyBody(st) : foodSearchBody(st),
    footer: () => {
      if (st.sel) return `<button class="btn ghost" data-act="foodBack">${U.icon('chevL', 'sm')}Retour</button><span class="spacer"></span><button class="btn" data-act="foodAdd" data-more="1">${U.icon('plus', 'sm')}${st.editIdx != null ? 'Mettre à jour' : 'Autre aliment'}</button><button class="btn primary" data-act="foodAdd">${U.icon('check', 'sm')}Valider</button>`;
      if (st.tab === 'quick') return `<button class="btn ghost" data-close-top>Fermer</button><button class="btn primary" data-act="foodQuickAdd">Ajouter</button>`;
      const t = D.sumNutrients(st.basket);
      return `<button class="btn ghost" data-act="foodCreate">${U.icon('plus', 'sm')}Créer un aliment</button><span class="spacer"></span>${st.basket.length ? `<button class="btn primary" data-act="foodSave">${U.icon('check', 'sm')}Enregistrer · ${U.num(t.kcal)} kcal</button>` : '<button class="btn ghost" data-close-top>Fermer</button>'}`;
    },
    onMount: mm => {
      mm.st = st;
      const q = mm.el.querySelector('#fq');
      if (q) {
        q.addEventListener('input', U.debounce(() => { st.q = q.value; mm.el.querySelector('#fres').innerHTML = foodResults(st); }, 90));
        q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); st.q = q.value; mm.el.querySelector('#fres').innerHTML = foodResults(st); const first = mm.el.querySelector('#fres [data-act="foodSel"]'); if (first) first.click(); } });
        if (!U.isMobile()) setTimeout(() => q.focus(), 50);
      }
      const qi = mm.el.querySelector('#fqty');
      if (qi) {
        const upd = () => { st.qty = U.parseNum(qi.value) || 0; mm.el.querySelector('#flive').innerHTML = foodLive(st); };
        qi.addEventListener('input', upd);
        qi.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); A.foodAdd({ dataset: { more: '1' } }); } });
        if (!U.isMobile()) setTimeout(() => { qi.focus(); qi.select(); }, 50);
      }
      const mn = mm.el.querySelector('#f-meal-name'); if (mn) mn.addEventListener('input', () => { st.mealName = mn.value; });
      const ar = mm.el.querySelector('#f-as-recipe'); if (ar) ar.addEventListener('change', () => { st.asRecipe = ar.checked; });
      mm.el.querySelectorAll('[data-slotpick]').forEach(b => b.addEventListener('click', () => { st.slot = b.dataset.slotpick; mm.render(); }));
    }
  });
  return m;
};
F.guessSlot = () => { const h = new Date().getHours(); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner'; };
function slotSeg(st) { return `<div class="seg full">${D.SLOTS.map(s => `<button type="button" data-slotpick="${s.id}" class="${st.slot === s.id ? 'on' : ''}">${s.label}</button>`).join('')}</div>`; }
function basketPanel(st) {
  if (!st.basket.length) return '';
  const t = D.sumNutrients(st.basket);
  return `<div class="basket"><div class="row between"><b>Ton repas · ${st.basket.length} aliment${st.basket.length > 1 ? 's' : ''}</b><span class="small tabnum">${U.num(t.kcal)} kcal</span></div>
    <div class="list">${st.basket.map((b, i) => `<div class="li" style="padding:7px 0"><button class="grow" data-act="foodBasketEdit" data-i="${i}" style="text-align:left;min-width:0"><span class="t" style="white-space:normal">${U.esc(b.name)}</span><span class="s">${U.num(b.qty)} g · P ${U.num(b.p)} · G ${U.num(b.c)} · L ${U.num(b.f)}</span></button><span class="end small"><b>${U.num(b.kcal)}</b></span><button class="icon-btn sm" data-act="foodBasketDel" data-i="${i}" aria-label="Retirer">${U.icon('x')}</button></div>`).join('')}</div>
    <div class="macro-line"><span class="m-p">Protéines <b>${U.num(t.p, 0)} g</b></span><span class="m-c">Glucides <b>${U.num(t.c, 0)} g</b></span><span class="m-f">Lipides <b>${U.num(t.f, 0)} g</b></span>${t.fib != null ? `<span>Fibres <b>${U.num(t.fib, 1)} g</b></span>` : ''}</div>
    ${st.basket.length > 1 ? `<div class="row wrap" style="gap:8px"><input class="input grow" id="f-meal-name" placeholder="Nom du repas (facultatif) : pâtes bolo maison…" value="${U.esc(st.mealName)}" style="height:38px;font-size:14px;min-width:180px"><label class="row small"><span class="switch"><input type="checkbox" id="f-as-recipe" ${st.asRecipe ? 'checked' : ''}><span></span></span>Garder comme recette</label></div>` : ''}</div>`;
}
function foodSearchBody(st) {
  return `${slotSeg(st)}
    <div class="seg full"><button type="button" data-act="foodTab" data-t="search" class="${st.tab === 'search' ? 'on' : ''}">${U.icon('search', 'sm')} Rechercher</button><button type="button" data-act="foodTab" data-t="quick" class="${st.tab === 'quick' ? 'on' : ''}">${U.icon('bolt', 'sm')} Saisie rapide</button></div>
    ${st.tab === 'search' ? `${basketPanel(st)}<div class="input-unit"><input class="input" id="fq" placeholder="pâtes crues, sauce tomate, poulet…" value="${U.esc(st.q)}" autocomplete="off" enterkeyhint="search"><em>${U.icon('search', 'sm')}</em></div><div class="food-results" id="fres">${foodResults(st)}</div>`
    : `<form id="fqf" class="stack"><label class="field"><span>Nom</span><input name="name" id="fq-name" placeholder="Ex. Plat du restaurant"></label>
      <div class="fields keep"><label class="field"><span>Calories</span><div class="input-unit"><input name="kcal" id="fq-kcal" inputmode="numeric" placeholder="650"><em>kcal</em></div></label>
      <label class="field"><span>Protéines</span><div class="input-unit"><input name="p" id="fq-p" inputmode="decimal" placeholder="35"><em>g</em></div></label>
      <label class="field"><span>Glucides</span><div class="input-unit"><input name="c" id="fq-c" inputmode="decimal" placeholder="—"><em>g</em></div></label>
      <label class="field"><span>Lipides</span><div class="input-unit"><input name="f" id="fq-f" inputmode="decimal" placeholder="—"><em>g</em></div></label></div>
      <p class="hint" style="margin:0">Au restaurant ou chez quelqu'un : une estimation vaut mieux qu'un repas pas noté.</p></form>`}`;
}
function foodResults(st) {
  const q = U.norm(st.q);
  if (!q) {
    const rec = D.recentFoods();
    const foods = D.foods();
    const recent = foods.filter(f => rec.has(f.id)).sort((a, b) => rec.get(b.id).count - rec.get(a.id).count).slice(0, 12);
    const mine = foods.filter(f => !f.base).slice(0, 12);
    const ess = foods.filter(f => f.base && (!f.cq || D.CQ_MAP[f.name] || f.id.startsWith('ing-') || f.id.startsWith('base-')) && !rec.has(f.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return `<p class="hint" style="margin:4px 0 8px">Tape n'importe quel aliment : ${U.num(D.foodCount())} aliments avec toutes leurs valeurs (table Ciqual de l'Anses). Précise « cru » ou « cuit » pour les pâtes, le riz, la viande…</p>`
      + (recent.length ? `<div class="eyebrow" style="padding:6px 10px">Fréquents</div>${recent.map(foodRow).join('')}` : '')
      + (mine.length ? `<div class="eyebrow" style="padding:10px 10px 6px">Mes aliments</div>${mine.map(foodRow).join('')}` : '')
      + `<div class="eyebrow" style="padding:10px 10px 6px">Essentiels</div>${ess.map(foodRow).join('')}`;
  }
  const list = D.searchFoods(st.q, 60);
  if (!list.length) return UI.empty('search', 'Aucun aliment trouvé', `Essaie un autre mot (« pâtes », « sauce », « poulet »), crée « ${U.esc(st.q)} » ou utilise la saisie rapide.`, `<button class="btn primary sm" data-act="foodCreate" data-name="${U.esc(st.q)}">${U.icon('plus', 'sm')}Créer cet aliment</button>`);
  return list.map(foodRow).join('');
}
function foodRow(f) {
  const por = f.portion || 100;
  const tag = !f.base ? ' <span class="pill demo" style="height:18px;font-size:10px">perso</span>' : '';
  const sub = f.grp ? U.cap(f.grp) : (f.portionLabel ? f.portionLabel : '');
  return `<button type="button" class="food-row" data-act="foodSel" data-id="${f.id}"><span class="grow" style="min-width:0"><span class="t">${U.esc(f.name)}${tag}</span><br><span class="s">${sub ? U.esc(sub) + ' · ' : ''}${f.cq && !f.portionLabel ? '100 g' : U.num(por) + ' g'} : ${U.num(f.kcal * por / 100)} kcal · P ${U.num(f.p * por / 100, 0)} · G ${U.num(f.c * por / 100, 0)} · L ${U.num(f.f * por / 100, 0)}</span></span><span class="icon-btn sm">${U.icon('plus')}</span></button>`;
}
function nutriTable(f, qty) {
  const m = D.macrosFor(f, qty);
  return `<table class="t nutri"><thead><tr><th></th><th class="r">100 g</th><th class="r">${U.num(qty)} g</th></tr></thead><tbody>${D.NUTRIENTS.map(n => { const a = f[n.k], b = m[n.k]; return `<tr class="${n.sub ? 'sub' : ''}"><td>${n.l}</td><td class="r">${a == null ? '<span class="faint">–</span>' : U.num(a, n.d) + ' ' + n.u}</td><td class="r"><b>${b == null ? '–' : U.num(b, n.d) + ' ' + n.u}</b></td></tr>`; }).join('')}</tbody></table>`;
}
function foodQtyBody(st) {
  const f = st.sel;
  const chips = [];
  if (f.portionLabel) chips.push([f.portion, `${f.portionLabel} · ${U.num(f.portion)} g`]);
  const ch = D.cookHint(f);
  const base = ch ? [60, 80, 100, 125, 150] : /sauce|huile|vinaigrette|mayonnaise|ketchup|pesto|beurre|crème/i.test(f.name) ? [10, 15, 20, 30, 50, 100] : [30, 50, 100, 150, 200, 250];
  base.forEach(v => { if (v !== f.portion || !f.portionLabel) chips.push([v, `${v} g`]); });
  return `${slotSeg(st)}
    <div><div class="eyebrow">${f.grp ? U.esc(U.cap(f.grp)) : 'Aliment'}${f.cq ? ' · Ciqual' : ''}</div><h3 style="margin:4px 0 2px;font-size:18px;line-height:1.3">${U.esc(f.name)}</h3></div>
    <label class="field"><span>Quantité</span><div class="input-unit"><input class="input" id="fqty" inputmode="decimal" value="${U.num(st.qty, 0)}" style="height:56px;font:700 30px var(--display)"><em>g</em></div></label>
    <div class="chips">${chips.map(([v, l]) => `<button type="button" class="chip" data-act="foodQty" data-v="${v}">${U.esc(l)}</button>`).join('')}</div>
    <div id="flive">${foodLive(st)}</div>`;
}
function foodLive(st) {
  const m = D.macrosFor(st.sel, st.qty || 0);
  const ch = D.cookHint(st.sel);
  return `<div class="qty-live"><div><b>${U.num(m.kcal)}</b><span>kcal</span></div><div><b class="m-p">${U.num(m.p, 0)}</b><span>protéines</span></div><div><b class="m-c">${U.num(m.c, 0)}</b><span>glucides</span></div><div><b class="m-f">${U.num(m.f, 0)}</b><span>lipides</span></div></div>
    ${ch && st.qty ? `<div class="note" style="margin-top:10px">${U.icon('info', 'sm')}<span>${U.num(st.qty)} g de ${ch.what} crus ≈ <b>${U.num(Math.round(st.qty * ch.x / 5) * 5)} g une fois cuits</b>. Pèse cru pour être précis : le poids cuit varie selon la cuisson.</span></div>` : ''}
    <details class="nutri-wrap" ${U.isMobile() ? '' : 'open'}><summary>Valeurs nutritionnelles complètes</summary>${nutriTable(st.sel, st.qty || 0)}</details>`;
}
A.foodTab = el => { const m = UI.top(); m.st.tab = el.dataset.t; m.render(); };
A.foodSel = el => {
  const m = UI.top(); const f = D.food(el.dataset.id); if (!f) return;
  const rec = D.recentFoods().get(f.id);
  const ch = D.cookHint(f);
  m.st.sel = f; m.st.editIdx = null; m.st.qty = rec ? rec.lastQty : (f.portionLabel ? f.portion : ch ? 80 : 100);
  m.render();
};
A.foodBack = () => { const m = UI.top(); m.st.sel = null; m.st.editIdx = null; m.render(); };
A.foodQty = el => { const m = UI.top(); m.st.qty = +el.dataset.v; const i = document.getElementById('fqty'); i.value = U.num(m.st.qty); m.el.querySelector('#flive').innerHTML = foodLive(m.st); };
function basketItem(f, qty) { return { foodId: f.id, name: f.name, qty, unit: 'g', ...D.macrosFor(f, qty) }; }
A.foodAdd = async el => {
  const m = UI.top(); const st = m.st;
  const qty = U.parseNum(document.getElementById('fqty').value);
  if (!qty || qty <= 0) { UI.toast('Indique une quantité', { type: 'err' }); return; }
  const item = basketItem(st.sel, qty);
  if (st.editIdx != null) st.basket[st.editIdx] = item; else st.basket.push(item);
  st.sel = null; st.editIdx = null; st.q = '';
  if (el.dataset && el.dataset.more) { m.render(); return; }
  await saveBasket(m);
};
A.foodBasketDel = el => { const m = UI.top(); m.st.basket.splice(+el.dataset.i, 1); m.render(); };
A.foodBasketEdit = el => { const m = UI.top(); const b = m.st.basket[+el.dataset.i]; const f = D.food(b.foodId); if (!f) return; m.st.sel = f; m.st.qty = b.qty; m.st.editIdx = +el.dataset.i; m.render(); };
A.foodSave = async () => saveBasket(UI.top());
async function saveBasket(m) {
  const st = m.st;
  if (!st.basket.length) { m.close(); return; }
  const t0 = Date.now(), groupId = st.basket.length > 1 ? U.uid() : null;
  const name = (st.mealName || '').trim();
  const meals = st.basket.map((b, i) => ({ id: U.uid() + i, date: st.date, slot: st.slot, t: t0 + i, ...b, groupId, group: groupId && name ? name : null }));
  await DB.putMany('meals', meals);
  if (st.asRecipe && st.basket.length > 1) {
    const r = { id: 'rc-' + U.uid(), name: name || `Repas du ${U.fmtShort(st.date)}`, cat: st.slot === 'breakfast' ? 'petitdej' : st.slot === 'snack' ? 'collation' : 'plat', time: null, tags: [], ing: st.basket.map(b => ({ foodId: b.foodId, g: b.qty })), pantry: [], steps: [], tip: '', v: Date.now() };
    r.slots = D.CAT_SLOTS[r.cat];
    await DB.put('recipes', r);
  }
  const t = D.sumNutrients(meals);
  m.close();
  UI.toast(`${meals.length > 1 ? (name || meals.length + ' aliments') : meals[0].name} · ${U.num(t.kcal)} kcal ajouté${st.asRecipe && meals.length > 1 ? ' · recette enregistrée' : ''}`, { action: { label: 'Annuler', fn: async () => { await DB.delMany('meals', meals.map(x => x.id)); App.changed(); } } });
  App.changed();
}
A.foodQuickAdd = async () => {
  const m = UI.top(); const st = m.st;
  const o = UI.form(document.getElementById('fqf'));
  const kcal = U.parseNum(o.kcal);
  if (!kcal) { UI.toast('Indique au moins les calories', { type: 'err' }); return; }
  await DB.put('meals', { id: U.uid(), date: st.date, slot: st.slot, t: Date.now(), foodId: null, name: o.name || 'Saisie rapide', qty: null, unit: null, kcal: Math.round(kcal), p: U.parseNum(o.p) || 0, c: U.parseNum(o.c) || 0, f: U.parseNum(o.f) || 0 });
  m.close(); UI.toast('Ajouté'); App.changed();
};
A.foodCreate = el => F.foodEdit(null, el.dataset.name || (UI.top().st ? UI.top().st.q : ''));
F.foodEdit = (id, name = '') => {
  const f = id ? D.food(id) : { name, kcal: '', p: '', c: '', f: '', portion: 100, portionLabel: '' };
  UI.open({
    title: id ? 'Modifier l\'aliment' : 'Nouvel aliment', sub: 'Valeurs pour 100 g (indiquées sur l\'étiquette)', size: 'sm',
    body: `<form id="fef" class="stack"><label class="field"><span>Nom</span><input name="name" id="fe-name" value="${U.esc(f.name)}" placeholder="Ex. Wrap poulet maison" required></label>
      <div class="fields keep"><label class="field"><span>Calories</span><div class="input-unit"><input name="kcal" id="fe-kcal" inputmode="decimal" value="${f.kcal}"><em>kcal</em></div></label>
      <label class="field"><span>Protéines</span><div class="input-unit"><input name="p" id="fe-p" inputmode="decimal" value="${f.p}"><em>g</em></div></label>
      <label class="field"><span>Glucides</span><div class="input-unit"><input name="c" id="fe-c" inputmode="decimal" value="${f.c}"><em>g</em></div></label>
      <label class="field"><span>Lipides</span><div class="input-unit"><input name="f" id="fe-f" inputmode="decimal" value="${f.f}"><em>g</em></div></label>
      <label class="field"><span>dont sucres</span><div class="input-unit"><input id="fe-sug" inputmode="decimal" value="${f.sug ?? ''}" placeholder="facultatif"><em>g</em></div></label>
      <label class="field"><span>dont AG saturés</span><div class="input-unit"><input id="fe-sat" inputmode="decimal" value="${f.sat ?? ''}" placeholder="facultatif"><em>g</em></div></label>
      <label class="field"><span>Fibres</span><div class="input-unit"><input id="fe-fib" inputmode="decimal" value="${f.fib ?? ''}" placeholder="facultatif"><em>g</em></div></label>
      <label class="field"><span>Sel</span><div class="input-unit"><input id="fe-salt" inputmode="decimal" value="${f.salt ?? ''}" placeholder="facultatif"><em>g</em></div></label>
      <label class="field"><span>Portion habituelle</span><div class="input-unit"><input name="portion" id="fe-por" inputmode="decimal" value="${f.portion || ''}"><em>g</em></div></label>
      <label class="field"><span>Nom de la portion</span><input name="portionLabel" id="fe-pl" value="${U.esc(f.portionLabel || '')}" placeholder="1 part"></label></div></form>`,
    footer: `${id ? `<button class="btn ghost danger" data-act="foodDel" data-id="${id}">${U.icon('trash')}</button><span class="spacer"></span>` : ''}<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="foodEditSave" data-id="${id || ''}">Enregistrer</button>`
  });
};
A.foodEditSave = async el => {
  const o = UI.form(document.getElementById('fef'));
  const num = k => U.parseNum(document.getElementById(k).value);
  const rec = { name: o.name, kcal: num('fe-kcal'), p: num('fe-p') || 0, c: num('fe-c') || 0, f: num('fe-f') || 0, sug: num('fe-sug'), sat: num('fe-sat'), fib: num('fe-fib'), salt: num('fe-salt'), portion: num('fe-por') || 100, portionLabel: o.portionLabel };
  if (!rec.name || rec.kcal == null) { UI.toast('Nom et calories sont nécessaires', { type: 'err' }); return; }
  const id = el.dataset.id;
  const orig = id ? D.food(id) : null;
  let saved;
  if (orig && orig.base) saved = { ...rec, id: 'cf-' + U.uid(), overrides: orig.id };
  else saved = { ...rec, id: id || 'cf-' + U.uid(), overrides: orig ? orig.overrides : undefined };
  await DB.put('foods', saved);
  UI.top().close();
  UI.toast(id ? 'Aliment mis à jour' : 'Aliment créé');
  const parent = UI.top();
  if (parent && parent.st && parent.st.basket && !parent.st.sel && parent.st.tab === 'search') { parent.st.sel = saved; parent.st.qty = saved.portion || 100; parent.render(); }
  App.changed();
};
A.foodDel = async el => {
  const f = D.food(el.dataset.id);
  const ok = await UI.confirm({ title: 'Supprimer cet aliment ?', text: 'Les repas déjà enregistrés ne sont pas modifiés.', ok: 'Supprimer', danger: true });
  if (!ok) return;
  if (f.base) await DB.setSetting('hiddenFoods', [...DB.setting('hiddenFoods', []), f.id]);
  else await DB.del('foods', f.id);
  UI.top().close(); UI.toast('Aliment supprimé'); App.changed();
};

/* ---------- Panneau d'une journée (calendrier) ---------- */
F.day = date => {
  const st = { date };
  const m = UI.open({
    drawer: true, live: true, size: 'md', focus: false,
    title: () => U.fmtLong(st.date),
    sub: () => { const diff = U.diffDays(U.today(), st.date); return diff === 0 ? "Aujourd'hui" : diff === -1 ? 'Hier' : diff === 1 ? 'Demain' : diff > 0 ? `Dans ${diff} jours` : `Il y a ${-diff} jours`; },
    body: () => dayBody(st.date),
    onMount: mm => {
      mm.st = st;
      const note = mm.el.querySelector('#d-note');
      if (note) note.addEventListener('input', U.debounce(() => { DB.put('days', { ...D.day(st.date), date: st.date, note: note.value }); }, 400));
      const stp = mm.el.querySelector('#d-steps');
      if (stp) stp.addEventListener('change', async () => { const v = U.parseNum(stp.value); await DB.put('days', { ...D.day(st.date), date: st.date, steps: v ? Math.round(v) : null }); UI.toast(v ? `${U.num(v)} pas enregistrés` : 'Pas effacés'); App.changed(); });
    }
  });
  return m;
};
A.dayNav = el => { const m = UI.top(); m.st.date = U.addDays(m.st.date, +el.dataset.d); m.render(); Pages.calendar.sel = m.st.date; App.renderView(); };
A.dayAdd = el => { const d = UI.top().st.date; ({ workout: () => d <= U.today() ? F.startWorkoutPicker(d) : F.activity({ date: d, status: 'planned', type: 'strength' }), activity: () => F.activity({ date: d }), plan: () => F.activity({ date: d, status: 'planned', type: 'strength' }), food: () => F.food({ date: d }), weight: () => F.weight(d), note: () => F.note(d), steps: () => F.steps(d), measure: () => F.measure(d) }[el.dataset.k])(); };
A.dayMood = async el => { const d = UI.top().st.date; const cur = D.day(d); const v = +el.dataset.v; await DB.put('days', { ...cur, date: d, mood: cur.mood === v ? null : v }); App.changed(); };
A.dayRest = async el => { const d = UI.top().st.date; await DB.put('days', { ...D.day(d), date: d, rest: el.checked }); UI.toast(el.checked ? 'Journée de repos notée' : 'Repos retiré'); App.changed(); };
function dayBody(date) {
  const future = date > U.today();
  const w = DB.get('weights', date);
  const ws = D.weightSeries().find(p => p.date === date);
  const acts = D.actsOn(date);
  const tot = D.dayTotals(date);
  const tg = { ...D.targets(), kcal: D.kcalTarget(date) };
  const day = D.day(date);
  const meals = D.mealsOn(date);
  const quick = future
    ? [['plan', 'Programmer', 'calendar'], ['note', 'Note', 'note']]
    : [['workout', 'Séance', 'dumbbell'], ['activity', 'Activité', 'pulse'], ['food', 'Repas', 'food'], ['weight', 'Poids', 'scale'], ['note', 'Note', 'note']];
  return `<div class="row between"><button class="btn sm ghost" data-act="dayNav" data-d="-1">${U.icon('chevL', 'sm')}Veille</button><button class="btn sm ghost" data-act="dayNav" data-d="1">Lendemain${U.icon('chevR', 'sm')}</button></div>
  <div class="chips">${quick.map(([k, l, ic]) => `<button class="chip" data-act="dayAdd" data-k="${k}">${U.icon(ic, 'sm')}${l}</button>`).join('')}</div>
  <section class="day-sec"><h4>${U.icon('pulse', 'sm')}Activités<span class="spacer"></span>${future ? '' : `<button class="card-link" data-act="dayAdd" data-k="plan">+ Programmer</button>`}</h4>
    ${acts.length ? `<div class="list">${acts.map(a => actRow(a, true)).join('')}</div>` : `<p class="faint small" style="margin:0">${future ? 'Rien de programmé.' : day.rest ? 'Journée de repos.' : 'Aucune activité.'}</p>`}
  </section>
  ${future ? '' : `<section class="day-sec"><h4>${U.icon('scale', 'sm')}Poids</h4>
    ${w ? `<div class="row between"><div><span class="mid">${U.kg(w.kg)}</span><span class="unit">kg</span>${ws ? `<div class="xs faint">Moyenne 7 jours : ${U.kg(ws.avg7)} kg</div>` : ''}</div><button class="btn sm" data-act="dayAdd" data-k="weight">${U.icon('edit', 'sm')}Modifier</button></div>` : `<button class="btn sm" data-act="dayAdd" data-k="weight">${U.icon('plus', 'sm')}Ajouter un poids</button>`}
  </section>
  <section class="day-sec"><h4>${U.icon('food', 'sm')}Alimentation<span class="spacer"></span><a class="card-link" href="#repas" data-act="goNutrition" data-date="${date}">Ouvrir</a></h4>
    ${tot.count ? `<div class="macro"><div class="row between"><span>Calories</span><b>${U.num(tot.kcal)} <span class="faint">/ ${U.num(tg.kcal)} kcal</span></b></div>${UI.bar(tot.kcal / tg.kcal, 'var(--c-food)')}
      <div class="row between"><span>Protéines</span><b>${U.num(tot.p)} <span class="faint">/ ${U.num(tg.protein)} g</span></b></div>${UI.bar(tot.p / tg.protein, 'var(--c-strength)')}</div>
      <div class="list">${D.SLOTS.map(s => { const arr = meals.filter(x => x.slot === s.id); return arr.length ? `<div class="li"><span class="grow"><span class="t">${s.label}</span><span class="s">${arr.map(x => U.esc(x.name)).join(', ')}</span></span><span class="end small"><b>${U.num(U.sum(arr.map(x => x.kcal)))}</b> kcal</span></div>` : ''; }).join('')}</div>`
      : `<button class="btn sm" data-act="dayAdd" data-k="food">${U.icon('plus', 'sm')}Ajouter un repas</button>`}
  </section>
  <section class="day-sec"><h4>${U.icon('steps', 'sm')}Pas</h4>
    <div class="row"><div class="input-unit grow" style="max-width:220px"><input class="input" id="d-steps" inputmode="numeric" value="${day.steps || ''}" placeholder="0"><em>pas</em></div><span class="small faint">Objectif ${U.num(tg.steps)}</span></div>
  </section>
  <section class="day-sec"><h4>${U.icon('smile', 'sm')}Ressenti</h4>
    <div class="mood">${D.MOOD.map((l, i) => `<button class="${day.mood === i + 1 ? 'on' : ''}" data-act="dayMood" data-v="${i + 1}">${l}</button>`).join('')}</div>
  </section>`}
  <section class="day-sec"><h4>${U.icon('note', 'sm')}Note</h4>
    <div class="field"><textarea id="d-note" rows="3" placeholder="Sommeil, faim, stress, douleurs…">${U.esc(day.note || '')}</textarea><small>Enregistrée automatiquement</small></div>
    <label class="row"><span class="switch"><input type="checkbox" data-change="dayRest" ${day.rest ? 'checked' : ''}><span></span></span><span>Journée de repos</span></label>
  </section>`;
}
/* Ligne d'activité réutilisable */
function actRow(a, actions = false) {
  const t = D.ACT[a.type] || D.ACT.other;
  const bits = [];
  if (a.time) bits.push(a.time.replace(':', 'h'));
  if (a.duration) bits.push(U.dur(a.duration));
  if (a.distance) bits.push(`${U.num(a.distance, a.distance % 1 ? 1 : 0)} km`);
  if (a.type === 'strength' && a.exercises && a.status === 'done') bits.push(`${D.workoutSetsDone(a)} séries`);
  if (a.status === 'done' && a.kcal) bits.push(`≈ ${U.num(a.kcal)} kcal`);
  let act = '';
  if (actions && a.status === 'planned') {
    act = `<div class="row" style="gap:4px">${a.type === 'strength' && a.date <= U.today() ? `<button class="btn sm primary" data-act="actStart" data-id="${a.id}">${U.icon('play', 'sm')}Démarrer</button>` : `<button class="btn sm" data-act="actStatus" data-s="done" data-id="${a.id}" title="Marquer réalisé">${U.icon('check', 'sm')}</button>`}<button class="icon-btn sm" data-act="actStatus" data-s="cancelled" data-id="${a.id}" title="Annuler la séance">${U.icon('ban')}</button></div>`;
  } else if (actions && a.status === 'cancelled') {
    act = `<button class="icon-btn sm" data-act="actStatus" data-s="planned" data-id="${a.id}" title="Remettre en prévu">${U.icon('repeat')}</button>`;
  } else if (actions && a.status === 'progress') {
    act = `<a class="btn sm primary" href="#seance-${a.id}">Reprendre</a>`;
  }
  return `<div class="li act" data-act="actOpen" data-id="${a.id}"><span class="ic-badge ${a.status === 'planned' ? 'planned' : ''} ${a.status === 'cancelled' ? 'cancelled' : ''}" style="--c:${t.c}">${U.icon(t.icon)}</span>
    <span class="grow"><span class="t">${U.esc(D.actTitle(a))}</span><span class="s">${bits.join(' · ') || t.label}</span></span>
    <span class="pill ${a.status}">${D.STATUS[a.status]}</span>${act}</div>`;
}
A.goNutrition = el => { UI.closeAll(); Pages.nutrition.date = el.dataset.date; App.go('repas'); };
