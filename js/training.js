'use strict';
/* Cap 100 — sport : historique, séances types, exercices, performances */

Pages.training = {
  title: 'Sport',
  nav: 'sport',
  tab: 'history',
  typeFilter: 'all',
  perfType: 'run',
  render() {
    const running = D.acts().find(a => a.status === 'progress');
    const done = D.doneActs();
    const m0 = U.monthStart(U.today());
    const month = done.filter(a => a.date >= m0);
    const tabs = [['history', 'Historique', 'history'], ['templates', 'Séances types', 'dumbbell'], ['exercises', 'Exercices', 'list'], ['perf', 'Performances', 'chart']];
    return `<div class="page-head"><div><h1>Sport</h1><div class="sub">${U.plural(done.length, 'activité réalisée', 'activités réalisées')} depuis le début · ${U.num(D.totalDistance(), 1)} km parcourus</div></div>
      <div class="actions"><button class="btn" data-act="quickActivity">${U.icon('pulse', 'sm')}Activité</button><button class="btn primary" data-act="trStart">${U.icon('play', 'sm')}Séance muscu</button></div></div>
    ${running ? `<div class="card" style="margin-bottom:18px;border-color:var(--goal);background:var(--goal-soft)"><div class="row wrap"><span class="ic-badge" style="--c:var(--goal)">${U.icon('timer')}</span><div class="grow"><b>Séance en cours : ${U.esc(D.actTitle(running))}</b><div class="small muted">Commencée à ${running.time ? running.time.replace(':', 'h') : '?'} · ${D.workoutSetsDone(running)} séries validées</div></div><a class="btn primary" href="#seance-${running.id}">Reprendre</a></div></div>` : ''}
    <div class="grid g-4" style="margin-bottom:18px">
      <div class="card flat"><div class="kpi"><span class="l">Ce mois-ci</span><span class="v">${month.length}<small>séances</small></span></div></div>
      <div class="card flat"><div class="kpi"><span class="l">Renforcement (mois)</span><span class="v">${month.filter(a => a.type === 'strength').length}<small>séances</small></span></div></div>
      <div class="card flat"><div class="kpi"><span class="l">Temps (mois)</span><span class="v">${U.dur(U.sum(month.map(a => a.duration || 0)))}</span></div></div>
      <div class="card flat"><div class="kpi"><span class="l">Distance (mois)</span><span class="v">${U.num(U.sum(month.map(a => a.distance || 0)), 1)}<small>km</small></span></div></div>
    </div>
    <div class="tabs">${tabs.map(([v, l, ic]) => `<button data-act="trTab" data-v="${v}" class="${this.tab === v ? 'on' : ''}">${U.icon(ic, 'sm')}${l}</button>`).join('')}</div>
    <div id="tr-body">${this['tab_' + this.tab]()}</div>`;
  },
  tab_history() {
    const f = this.typeFilter;
    const list = D.acts().filter(a => (a.status === 'done' || a.status === 'cancelled') && (f === 'all' || a.type === f)).reverse();
    const byMonth = new Map();
    list.forEach(a => { const k = U.monthStart(a.date); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(a); });
    return `<div class="chips scroll" style="margin-bottom:14px"><button class="chip ${f === 'all' ? 'on' : ''}" data-act="trFilter" data-v="all">Tout</button>${Object.entries(D.ACT).map(([k, t]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="trFilter" data-v="${k}"><i class="dot" style="color:${t.c}"></i>${t.label}</button>`).join('')}</div>
      ${list.length ? [...byMonth.entries()].map(([mo, arr]) => { const d = arr.filter(a => a.status === 'done'); return `<section class="card" style="margin-bottom:14px"><div class="card-h"><h3>${U.fmtMonth(mo)}</h3><span class="spacer"></span><span class="small muted">${d.length} séance${d.length > 1 ? 's' : ''} · ${U.dur(U.sum(d.map(a => a.duration || 0)))}${U.sum(d.map(a => a.distance || 0)) ? ' · ' + U.num(U.sum(d.map(a => a.distance || 0)), 1) + ' km' : ''}</span></div>
        <div class="list">${arr.map(a => { const t = D.ACT[a.type] || D.ACT.other; const pace = (a.type === 'run' || a.type === 'walk') ? U.pace(a.duration, a.distance) : null; return `<div class="li act" data-act="actOpen" data-id="${a.id}"><span class="ic-badge ${a.status === 'cancelled' ? 'cancelled' : ''}" style="--c:${t.c}">${U.icon(t.icon)}</span><span class="grow"><span class="t">${U.esc(D.actTitle(a))}</span><span class="s">${U.fmtLong(a.date)}${a.feeling && a.status === 'done' ? ' · ressenti ' + D.FEELING[a.feeling - 1].toLowerCase() : ''}${a.comment ? ' · ' + U.esc(a.comment) : ''}</span></span>
          <span class="end small">${a.status === 'cancelled' ? '<span class="pill cancelled">Annulé</span>' : `<b>${a.distance ? U.num(a.distance, a.distance % 1 ? 1 : 0) + ' km' : a.type === 'strength' && a.exercises ? D.workoutSetsDone(a) + ' séries' : U.dur(a.duration)}</b><br><span class="faint xs">${[a.distance ? U.dur(a.duration) : '', pace || '', a.kcal ? '≈ ' + U.num(a.kcal) + ' kcal' : ''].filter(Boolean).join(' · ')}</span>`}</span></div>`; }).join('')}</div></section>`; }).join('')
      : `<div class="card">${UI.empty('pulse', f === 'all' ? 'Aucune activité pour l\'instant' : 'Aucune activité de ce type', 'Chaque marche compte. Enregistre ta première activité ou démarre une séance guidée.', '<div class="row"><button class="btn" data-act="quickActivity">Ajouter une activité</button><button class="btn primary" data-act="trStart">Séance muscu</button></div>')}</div>`}`;
  },
  tab_templates() {
    const tpls = D.templates();
    return `<div class="grid g-3">${tpls.map(t => { const lastA = D.doneActs().filter(a => a.templateId === t.id).pop(); return `<section class="card tpl-card"><div class="card-h"><span class="ic-badge sm" style="--c:var(--c-strength)">${U.icon('dumbbell')}</span><div class="grow"><h3>${U.esc(t.name)}</h3><div class="xs faint">${lastA ? 'Dernière fois ' + U.relDay(lastA.date).toLowerCase() : 'Jamais réalisée'}</div></div><button class="icon-btn sm" data-act="tplEdit" data-id="${t.id}" title="Modifier">${U.icon('edit')}</button></div>
        <div>${t.items.map(it => { const ex = D.exercise(it.exId); const l = D.lastPerf(it.exId); return `<div class="ex-mini"><span>${U.esc(ex.name)}</span><b>${it.sets} × ${it.reps ?? '?'}${ex.kind === 'time' ? ' s' : ''}${l && ex.kind === 'weight' ? ' · ' + U.num(l.topKg, l.topKg % 1 ? 1 : 0) + ' kg' : it.kg ? ' · ' + U.num(it.kg) + ' kg' : ''}</b></div>`; }).join('') || '<p class="faint small">Aucun exercice.</p>'}</div>
        <div class="row" style="margin-top:14px"><button class="btn sm primary grow" data-act="tplStart" data-id="${t.id}">${U.icon('play', 'sm')}Démarrer</button><button class="btn sm" data-act="tplPlan" data-id="${t.id}">${U.icon('calendar', 'sm')}Programmer</button></div></section>`; }).join('')}
      <button class="card clickable" data-act="tplEdit" style="border-style:dashed;box-shadow:none;display:grid;place-items:center;min-height:180px;color:var(--ink-2)"><span class="stack" style="align-items:center">${U.icon('plus', 'lg')}<b>Nouvelle séance type</b><span class="small faint">Ex. Push, Pull, Jambes…</span></span></button></div>`;
  },
  tab_exercises() {
    const exs = D.exercises();
    const mine = D.myEquipment();
    const ok = exs.filter(D.exAvailable), other = exs.filter(e => !D.exAvailable(e));
    const row = e => { const h = D.exHistory(e.id); const l = h[h.length - 1]; const eq = (e.eq || []).map(x => (D.EQUIPMENT.find(q => q.id === x) || {}).label).filter(Boolean); return `<div class="li act" data-act="wkExHist" data-id="${e.id}"><span class="grow"><span class="t">${U.esc(e.name)}</span><span class="s">${l ? U.esc(D.setsLabel(l.sets, e.kind)) + ' · ' + U.fmtShort(l.date) : (eq.length ? eq.join(' + ') : 'Poids du corps')}</span></span>${h.length > 1 ? Charts.spark(h.map(x => e.kind === 'weight' ? x.e1rm : x.totalReps), { w: 70, h: 26, color: 'var(--c-strength)' }) : ''}<button class="icon-btn sm" data-act="exEditOpen" data-id="${e.id}" title="Modifier">${U.icon('edit')}</button></div>`; };
    return `<section class="card" style="margin-bottom:16px"><div class="card-h"><div><div class="eyebrow">Sans salle</div><h3>Mon matériel</h3></div><span class="spacer"></span><span class="xs faint">${ok.length} exercices disponibles</span></div>
        <div class="chips">${D.EQUIPMENT.map(q => `<button class="chip ${mine.has(q.id) ? 'on' : ''}" ${q.fixed ? 'disabled' : `data-act="toggleEq" data-v="${q.id}"`}>${U.icon(q.icon, 'sm')}${q.label}</button>`).join('')}</div>
        <p class="hint" style="margin:10px 0 0">Coche ce que tu as à la maison : les exercices proposés et le mode séance s'adaptent.</p></section>
      <div class="row" style="margin-bottom:14px"><span class="muted small grow">Touche un exercice pour voir sa technique et ta progression</span><button class="btn sm" data-act="exCreate">${U.icon('plus', 'sm')}Créer un exercice</button></div>
      <div class="grid g-2">${D.EX_GROUPS.map(g => { const items = ok.filter(e => e.group === g); return items.length ? `<section class="card"><div class="card-h"><h3>${g}</h3><span class="spacer"></span><span class="xs faint">${items.length}</span></div><div class="list">${items.map(row).join('')}</div></section>` : ''; }).join('')}</div>
      ${other.length ? `<details class="card" style="margin-top:16px"><summary class="row" style="cursor:pointer"><b>Avec d'autres matériels</b><span class="xs faint">${other.length} exercices</span></summary><div class="list" style="margin-top:8px">${other.map(row).join('')}</div></details>` : ''}`;
  },
  tab_perf() {
    const types = Object.entries(D.ACT).filter(([k, t]) => t.dist);
    const pt = this.perfType;
    const acts = D.doneActs().filter(a => a.type === pt);
    const withD = acts.filter(a => a.distance);
    const best = withD.length ? withD.reduce((b, a) => a.distance > b.distance ? a : b) : null;
    const paces = withD.filter(a => a.duration).map(a => ({ a, p: a.duration / a.distance }));
    const bestPace = paces.length ? paces.reduce((b, x) => x.p < b.p ? x : b) : null;
    // Renforcement : progression des exercices (premier vs dernier max estimé)
    const prog = D.exercises().map(e => ({ e, h: D.exHistory(e.id) })).filter(x => x.h.length >= 2 && x.e.kind === 'weight').map(x => ({ ...x, first: x.h[0].e1rm, last: x.h[x.h.length - 1].e1rm })).sort((a, b) => (b.last - b.first) / b.first - (a.last - a.first) / a.first);
    return `<div class="grid g-dash">
      <section class="card span-7"><div class="card-h"><div><div class="eyebrow">Cardio</div><h2>${D.ACT[pt].label}</h2></div><span class="spacer"></span></div>
        <div class="chips scroll" style="margin-bottom:12px">${types.map(([k, t]) => `<button class="chip ${pt === k ? 'on' : ''}" data-act="perfType" data-v="${k}"><i class="dot" style="color:${t.c}"></i>${t.label}</button>`).join('')}</div>
        ${acts.length ? `<div class="grid g-3" style="gap:12px;margin-bottom:14px">
          <div class="kpi"><span class="l">Sorties</span><span class="v">${acts.length}</span></div>
          <div class="kpi"><span class="l">Plus longue</span><span class="v">${best ? U.num(best.distance, 1) : '–'}<small>km</small></span><span class="d faint">${best ? U.fmtShort(best.date) : ''}</span></div>
          <div class="kpi"><span class="l">Meilleure allure</span><span class="v">${bestPace ? U.pace(bestPace.a.duration, bestPace.a.distance).replace('/km', '') : '–'}<small>/km</small></span><span class="d faint">${bestPace ? U.fmtShort(bestPace.a.date) : ''}</span></div></div>
          <div class="eyebrow" style="margin-bottom:6px">Allure (min/km) · plus bas = plus rapide</div><div id="perf-pace" data-h="190"></div>
          <div class="eyebrow" style="margin:14px 0 6px">Distance par sortie</div><div id="perf-dist" data-h="160"></div>`
          : UI.empty(D.ACT[pt].icon, `Aucune sortie « ${D.ACT[pt].label.toLowerCase()} »`, 'Enregistre la durée et la distance de tes sorties pour comparer tes performances dans le temps.', `<button class="btn sm primary" data-act="perfAdd" data-v="${pt}">Ajouter une sortie</button>`)}
      </section>
      <section class="card span-5"><div class="card-h"><div><div class="eyebrow">Renforcement</div><h2>Progression des charges</h2></div></div>
        ${prog.length ? `<div class="list">${prog.slice(0, 10).map(x => { const d = (x.last - x.first) / x.first; return `<div class="li act" data-act="wkExHist" data-id="${x.e.id}"><span class="grow"><span class="t">${U.esc(x.e.name)}</span><span class="s">Max estimé ${U.num(x.first, 1)} → ${U.num(x.last, 1)} kg · ${x.h.length} séances</span></span>${Charts.spark(x.h.map(h => h.e1rm), { w: 64, h: 24, color: 'var(--c-strength)' })}<span class="end small"><b class="${d > 0 ? 'good-c' : d < 0 ? 'goal-c' : 'faint'}">${d > 0 ? '+' : ''}${U.num(d * 100)} %</b></span></div>`; }).join('')}</div>
          <p class="hint">Pendant une perte de poids, maintenir ses charges est déjà une réussite : c'est le signe que la masse musculaire est préservée.</p>`
          : UI.empty('dumbbell', 'Pas encore assez de séances', 'Après deux séances d\'un même exercice, sa progression apparaîtra ici.')}
      </section></div>`;
  },
  mount(root) {
    if (this.tab === 'perf') {
      const acts = D.doneActs().filter(a => a.type === this.perfType && a.distance);
      const pe = root.querySelector('#perf-pace'), de = root.querySelector('#perf-dist');
      const t = D.ACT[this.perfType];
      if (pe) {
        const pts = acts.filter(a => a.duration).map(a => ({ x: a.date, y: +(a.duration / a.distance).toFixed(2) }));
        if (pts.length) Charts.line(pe, { height: 190, label: 'Allure', series: [{ name: 'Allure', color: t.c, dots: true, endDot: true, points: pts }], minRange: 1, yFmt: v => { const m = Math.floor(v); return `${m}'${U.pad(Math.round((v - m) * 60) % 60)}`; }, tip: (d, v) => `${U.fmtShort(d)}<br><b>${U.pace(v[0].p.y, 1).replace('/km', '')}</b> /km` });
      }
      if (de) Charts.bars(de, { height: 160, color: t.c, data: acts.slice(-24).map(a => ({ label: U.fmtShort(a.date), total: a.distance, color: t.c, tip: `${U.fmtLong(a.date)}<br><b>${U.num(a.distance, 1)} km</b><div class="xs" style="opacity:.8">${U.dur(a.duration)}${U.pace(a.duration, a.distance) ? ' · ' + U.pace(a.duration, a.distance) : ''}</div>` })), yFmt: v => U.num(v, v % 1 ? 1 : 0) });
    }
  }
};
A.trTab = el => { Pages.training.tab = el.dataset.v; App.renderView(false); };
A.trFilter = el => { Pages.training.typeFilter = el.dataset.v; App.renderView(false); };
A.perfType = el => { Pages.training.perfType = el.dataset.v; App.renderView(false); };
A.perfAdd = el => F.activity({ date: U.today(), type: el.dataset.v });
A.trStart = () => F.startWorkoutPicker(U.today());
A.tplStart = el => W.start({ templateId: el.dataset.id });
A.tplPlan = el => { const t = DB.get('templates', el.dataset.id); F.activity({ date: U.addDays(U.today(), 1), status: 'planned', type: 'strength', time: '18:00' }); setTimeout(() => { const s = document.getElementById('a-tpl'); if (s) { s.value = t.id; document.getElementById('a-title').value = t.name; } }, 30); };
A.exEditOpen = (el, e) => { e && e.stopPropagation(); F.exEdit(el.dataset.id); };
A.toggleEq = async el => { const cur = new Set(DB.setting('equipment', ['tapis', 'halteres'])); const v = el.dataset.v; if (cur.has(v)) cur.delete(v); else cur.add(v); await DB.setSetting('equipment', [...cur]); App.changed(); };

/* Éditeur de séance type */
A.tplEdit = el => {
  const id = el.dataset.id;
  const src = id ? DB.get('templates', id) : null;
  const st = { t: src ? JSON.parse(JSON.stringify(src)) : { id: 'tpl-' + U.uid(), name: '', items: [] } };
  UI.open({
    title: src ? 'Modifier la séance' : 'Nouvelle séance type', size: 'md',
    body: () => `<form id="tplf" class="stack"><label class="field"><span>Nom</span><input id="tpl-name" value="${U.esc(st.t.name)}" placeholder="Ex. Push — pectoraux, épaules, triceps"></label>
      <div class="list">${st.t.items.map((it, i) => { const ex = D.exercise(it.exId); return `<div class="li" style="flex-wrap:wrap;gap:8px"><span class="grow" style="min-width:140px"><span class="t">${U.esc(ex.name)}</span><span class="s">${U.esc(ex.group)}</span></span>
        <div class="row" style="gap:6px"><div class="input-unit" style="width:74px"><input class="input" data-i="${i}" data-k="sets" inputmode="numeric" value="${it.sets ?? ''}" aria-label="Séries" style="height:38px;padding-right:30px"><em>sér.</em></div>
        <div class="input-unit" style="width:74px"><input class="input" data-i="${i}" data-k="reps" inputmode="numeric" value="${it.reps ?? ''}" aria-label="Répétitions" style="height:38px;padding-right:30px"><em>${ex.kind === 'time' ? 's' : 'rép'}</em></div>
        ${ex.kind === 'weight' ? `<div class="input-unit" style="width:78px"><input class="input" data-i="${i}" data-k="kg" inputmode="decimal" value="${it.kg ?? ''}" aria-label="Charge" style="height:38px;padding-right:28px"><em>kg</em></div>` : ''}
        <button type="button" class="icon-btn sm" data-tplmv="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Monter">${U.icon('chevL')}</button><button type="button" class="icon-btn sm" data-tplmv="${i}" data-d="1" ${i === st.t.items.length - 1 ? 'disabled' : ''} aria-label="Descendre">${U.icon('chevR')}</button><button type="button" class="icon-btn sm" data-tpldel="${i}" aria-label="Retirer">${U.icon('x')}</button></div></div>`; }).join('') || '<p class="faint small">Ajoute les exercices de cette séance.</p>'}</div>
      <button type="button" class="btn block" data-tpladd>${U.icon('plus', 'sm')}Ajouter un exercice</button>
      <p class="hint" style="margin:0">La charge sert de point de départ. Ensuite, le mode séance reprend automatiquement ce que tu as réalisé la dernière fois.</p></form>`,
    footer: `${src ? `<button class="btn ghost danger" data-act="tplDel" data-id="${src.id}">${U.icon('trash')}</button><span class="spacer"></span>` : ''}<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="tplSave">Enregistrer</button>`,
    onMount: m => {
      m.st = st;
      const f = m.el.querySelector('#tplf');
      f.querySelector('#tpl-name').addEventListener('input', e => { st.t.name = e.target.value; });
      f.addEventListener('input', e => { const i = e.target.dataset.i; if (i == null) return; st.t.items[+i][e.target.dataset.k] = U.parseNum(e.target.value); });
      f.querySelectorAll('[data-tplmv]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.tplmv, j = i + +b.dataset.d; const arr = st.t.items; [arr[i], arr[j]] = [arr[j], arr[i]]; m.render(); }));
      f.querySelectorAll('[data-tpldel]').forEach(b => b.addEventListener('click', () => { st.t.items.splice(+b.dataset.tpldel, 1); m.render(); }));
      f.querySelector('[data-tpladd]').addEventListener('click', () => F.exPicker(exId => { const l = D.lastPerf(exId); st.t.items.push({ exId, sets: 3, reps: l ? l.topReps : 10, kg: l ? l.topKg : null }); m.render(); }));
    }
  });
};
A.tplSave = async () => {
  const m = UI.top(); const t = m.st.t;
  if (!t.name.trim()) { UI.toast('Donne un nom à la séance', { type: 'err' }); return; }
  if (!t.items.length) { UI.toast('Ajoute au moins un exercice', { type: 'err' }); return; }
  await DB.put('templates', t); m.close(); UI.toast('Séance type enregistrée'); App.changed();
};
A.tplDel = async el => {
  const old = DB.get('templates', el.dataset.id);
  const ok = await UI.confirm({ title: 'Supprimer la séance type ?', text: 'Les séances déjà réalisées restent dans l\'historique.', ok: 'Supprimer', danger: true });
  if (!ok) return;
  await DB.del('templates', old.id); UI.top().close(); UI.toast('Séance type supprimée', { action: { label: 'Annuler', fn: async () => { await DB.put('templates', old); App.changed(); } } }); App.changed();
};
