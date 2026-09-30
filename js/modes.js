'use strict';
/* Cap 100 — deux façons d'utiliser l'application :
   « lose »     : perdre du poids vers un objectif (paliers, échéance, projection) — le mode d'origine ;
   « maintain » : rester en forme — garder son poids dans une zone et bouger régulièrement (repère OMS : 150 min d'activité par semaine). */

D.MODES = [
  { id: 'lose', label: 'Perdre du poids', icon: 'trendDown', hint: 'Un poids visé, des paliers de 5 kg et une échéance' },
  { id: 'maintain', label: 'Rester en forme', icon: 'heart', hint: 'Garder mon poids et bouger régulièrement, sans régime' }
];
D.mode = () => D.profile().mode === 'maintain' ? 'maintain' : 'lose';
D.isMaintain = () => D.mode() === 'maintain';
D.WHO_MIN = 150;
/* Zone de maintien : poids de référence ± marge */
D.band = () => {
  const p = D.profile();
  const base = p.baseWeight || p.startWeight || 70, w = p.band || 2;
  return { base, w, lo: +(base - w).toFixed(1), hi: +(base + w).toFixed(1) };
};
D.weeklyGoal = () => { const p = D.profile(); return { min: p.weeklyMin || D.WHO_MIN, sessions: p.weeklySessions || 3 }; };

{
  /* Besoins : en maintien, pas de déficit */
  const estimate = D.estimate;
  D.estimate = (o = {}) => {
    const mode = o.mode || D.mode();
    const e = estimate(o);
    if (mode !== 'maintain') return e;
    const w = o.weight || 70;
    const kcal = U.round(e.tdee, 50);
    const protein = U.round(Math.max(1.5 * w, 60), 5);
    const fat = U.round(Math.max(0.8 * w, kcal * 0.28 / 9), 5);
    const carbs = Math.max(0, U.round((kcal - protein * 4 - fat * 9) / 4, 5));
    return { ...e, deficit: 0, kcal, protein, fat, carbs };
  };
  const progress = D.progress, milestones = D.milestones, projection = D.projection, requiredRate = D.requiredRate, planAt = D.planAt, goal = D.goal;
  D.goal = () => {
    const g = goal();
    if (!D.isMaintain()) return g;
    const b = D.band();
    return { ...g, start: b.base, goal: b.base, goalDate: U.addDays(U.today(), 365) };
  };
  D.progress = () => {
    if (!D.isMaintain()) return progress();
    const g = D.goal(), c = D.current(), b = D.band();
    const ref = c ? c.avg7 : g.start;
    const wk = D.weekSummary(U.weekStart(U.today()));
    return { ref, lost: g.start - ref, total: 0, remaining: 0, pct: U.clamp(wk.minutes / D.weeklyGoal().min, 0, 1), last: c, g, inBand: ref >= b.lo && ref <= b.hi, band: b };
  };
  D.milestones = () => D.isMaintain() ? [] : milestones();
  D.projection = () => D.isMaintain() ? null : projection();
  D.requiredRate = () => D.isMaintain() ? null : requiredRate();
  D.planAt = date => D.isMaintain() ? D.band().base : planAt(date);
}

/* Semaines actives d'affilée (objectif de minutes atteint), sans compter la semaine en cours si elle n'est pas finie */
D.activeStreak = () => D.memo('actStreak', () => {
  const goal = D.weeklyGoal().min;
  let ws = U.weekStart(U.today()), n = 0;
  if (D.weekSummary(ws).minutes >= goal) n++;
  ws = U.addDays(ws, -7);
  for (let i = 0; i < 104; i++, ws = U.addDays(ws, -7)) { if (D.weekSummary(ws).minutes >= goal) n++; else break; }
  return n;
});
D.weeksHistory = (n = 12) => {
  const out = []; let ws = U.addDays(U.weekStart(U.today()), -7 * (n - 1));
  for (let i = 0; i < n; i++, ws = U.addDays(ws, 7)) out.push({ ws, ...D.weekSummary(ws) });
  return out;
};

/* Petit encart de la barre latérale */
D.miniGoal = () => {
  const prog = D.progress();
  if (D.isMaintain()) {
    const wk = D.weekSummary(U.weekStart(U.today())), g = D.weeklyGoal();
    return `<div class="row between"><span>Cette semaine</span><b>${U.num(wk.minutes)} / ${g.min} min</b></div>${UI.bar(wk.minutes / g.min, 'var(--c-walk)')}<div class="xs faint" style="margin-top:6px">${prog.last ? `${U.kg(prog.ref)} kg · ${prog.inBand ? 'dans ta zone' : prog.ref > prog.band.hi ? 'au-dessus de ta zone' : 'sous ta zone'}` : 'Ajoute une pesée'}</div>`;
  }
  return `<div class="row between"><span>Vers ${U.num(prog.g.goal)} kg</span><b>${U.num(prog.pct * 100)} %</b></div>${UI.bar(prog.pct, 'var(--accent)')}<div class="xs faint" style="margin-top:6px">${U.kg(prog.ref)} kg · moyenne 7 jours</div>`;
};

/* Carte principale de l'accueil en mode maintien */
D.maintainHero = () => {
  const prog = D.progress(), b = prog.band, g = D.weeklyGoal();
  const wk = D.weekSummary(U.weekStart(U.today()));
  const streak = D.activeStreak();
  const pct = U.clamp(wk.minutes / g.min, 0, 1);
  const cur = prog.last;
  const zone = !cur ? 'À saisir' : prog.inBand ? 'Dans ta zone' : prog.ref > b.hi ? `+${U.kg(prog.ref - b.hi)} kg au-dessus` : `${U.kg(b.lo - prog.ref)} kg en dessous`;
  const left = Math.max(0, g.min - wk.minutes);
  const daysLeft = 7 - wk.pastDays;
  const tip = !cur ? 'Ajoute une pesée de temps en temps (une par semaine suffit) pour vérifier que ton poids reste stable.'
    : !prog.inBand ? (prog.ref > b.hi ? 'Ton poids moyen est au-dessus de ta zone : regarde tes repas des deux dernières semaines, ou ajoute un peu d\'activité. Pas d\'inquiétude pour quelques centaines de grammes.' : 'Ton poids moyen est sous ta zone : pense à manger à ta faim, surtout les jours de séance.')
      : left <= 0 ? 'Objectif d\'activité de la semaine atteint. Tout ce que tu fais en plus est du bonus.'
        : `Encore ${U.num(left)} min d'activité cette semaine${daysLeft > 0 ? `, soit environ ${U.num(Math.ceil(left / daysLeft / 5) * 5)} min par jour restant` : ''}. La marche rapide compte.`;
  return `<section class="card span-8 clickable" data-act="goGoal" aria-label="Ma forme">
    <div class="card-h"><div><div class="eyebrow">Forme & régularité</div><h2>Rester actif, garder la forme</h2></div><span class="spacer"></span><span class="pill ${prog.inBand || !cur ? 'planned' : 'rest'}">${U.icon('scale', 'sm')}zone ${U.num(b.lo, 1)} – ${U.num(b.hi, 1)} kg</span></div>
    <div class="hero">
      <div class="gauge-wrap">${Charts.gauge({ pct, nodes: [] })}
        <div class="gauge-center"><span class="cap">Cette semaine</span><span class="big"><span data-count="${wk.minutes}">${U.num(wk.minutes)}</span><span class="unit">min</span></span><span class="pct">sur ${g.min} min conseillées</span></div></div>
      <div class="journey">
        <div class="kpis">
          <div class="kpi"><span class="l">Séances</span><span class="v">${wk.sessions}<small>/ ${g.sessions}</small></span><span class="d faint">cette semaine</span></div>
          <div class="kpi"><span class="l">Semaines actives</span><span class="v ${streak ? 'good-c' : ''}">${streak}</span><span class="d faint">d'affilée à ${g.min} min</span></div>
          <div class="kpi"><span class="l">Poids moyen 7 j</span><span class="v">${cur ? U.kg(prog.ref) : '–'}<small>kg</small></span><span class="d ${cur && !prog.inBand ? 'goal-c' : 'faint'}">${zone}</span></div>
          <div class="kpi"><span class="l">Pas par jour</span><span class="v">${wk.steps ? U.num(Math.round(wk.steps / 100) * 100) : '–'}</span><span class="d faint">moyenne de la semaine</span></div>
        </div>
        <div class="note">${U.icon('info', 'sm')}<span>${tip}</span></div>
      </div>
    </div>
  </section>`;
};

/* Page « Ma forme » (remplace la page Objectif en mode maintien) */
D.maintainPage = () => {
  const prog = D.progress(), b = prog.band, g = D.weeklyGoal();
  const hist = D.weeksHistory(12);
  const done = hist.filter(h => h.minutes >= g.min).length;
  const badges = D.badgeState();
  const unlocked = badges.filter(x => x.on).length;
  const avgMin = U.avg(hist.slice(0, -1).map(h => h.minutes));
  return `<div class="page-head"><div><h1>Ma forme</h1><div class="sub">Rester actif et garder un poids stable : pas de régime, de la régularité. Repère de l'OMS pour les adultes : au moins ${D.WHO_MIN} minutes d'activité modérée par semaine, et du renforcement musculaire 2 fois par semaine.</div></div>
    <div class="actions"><a class="btn" href="#reglages">${U.icon('sliders', 'sm')}Ajuster</a></div></div>
  <div class="grid g-dash">
    <section class="card span-12"><div class="card-h"><div><div class="eyebrow">12 dernières semaines</div><h2>Minutes d'activité par semaine</h2></div><span class="spacer"></span><span class="pill planned">${done} / 12 semaines à ${g.min} min</span></div>
      <div id="mt-weeks" data-h="220"></div>
      <div class="grid g-3" style="gap:12px;margin-top:12px">
        <div class="kpi"><span class="l">Moyenne (11 sem. complètes)</span><span class="v">${U.num(avgMin)}<small>min/sem</small></span></div>
        <div class="kpi"><span class="l">Semaines actives d'affilée</span><span class="v good-c">${D.activeStreak()}</span></div>
        <div class="kpi"><span class="l">Renforcement (4 sem.)</span><span class="v">${U.num(U.sum(hist.slice(-4).map(h => h.strength)) / 4, 1)}<small>/ sem.</small></span><span class="d faint">repère : 2 par semaine</span></div></div>
    </section>
    <section class="card span-7"><div class="card-h"><div><div class="eyebrow">Poids</div><h2>Ta zone : ${U.num(b.lo, 1)} – ${U.num(b.hi, 1)} kg</h2></div><span class="spacer"></span><span class="pill ${prog.inBand || !prog.last ? 'planned' : 'rest'}">${!prog.last ? 'aucune pesée' : prog.inBand ? 'dans ta zone' : 'hors zone'}</span></div>
      <div id="mt-weight" data-h="230"></div>
      <p class="hint">Le poids varie naturellement de 1 à 2 kg d'un jour à l'autre (eau, sel, repas). C'est la moyenne sur 7 jours qui compte. Une pesée par semaine suffit en maintien.</p></section>
    <section class="card span-5"><div class="card-h"><div><div class="eyebrow">Jalons</div><h2>${unlocked} / ${badges.length} débloqués</h2></div></div>
      <div class="badges">${badges.map(x => `<div class="badge ${x.on ? 'on' : ''}"><span class="md">${U.icon(x.on ? x.icon : 'lock')}</span><span class="bt">${U.esc(x.label)}</span><span class="bd">${x.on ? (x.date ? 'Obtenu le ' + U.fmtShort(x.date) : 'Obtenu') : U.esc(x.desc || '')}</span></div>`).join('')}</div></section>
  </div>`;
};
D.maintainMount = root => {
  const g = D.weeklyGoal(), b = D.band();
  const hist = D.weeksHistory(12);
  Charts.bars(root.querySelector('#mt-weeks'), { height: 220, target: { v: g.min, label: `${g.min} min` }, data: hist.map(h => ({ label: U.fmtShort(h.ws), total: Math.round(h.minutes), color: h.minutes >= g.min ? 'var(--c-walk)' : 'var(--c-rest)', tip: `Semaine du ${U.fmtShort(h.ws)}<br><b>${U.num(h.minutes)} min</b> · ${h.sessions} séance${h.sessions > 1 ? 's' : ''}` })) });
  const s = D.weightSeries().filter(p => p.date >= U.addDays(U.today(), -180));
  const el = root.querySelector('#mt-weight');
  if (!s.length) { el.innerHTML = UI.empty('scale', 'Pas encore de pesée', 'Ajoute une pesée pour voir si ton poids reste dans ta zone.'); return; }
  Charts.line(el, {
    height: 230, label: 'Poids et zone de maintien', xFrom: s[0].date, xTo: U.today(),
    series: [{ name: 'Pesées', color: 'var(--c-weight)', style: 'dots', points: s.map(p => ({ x: p.date, y: p.kg })) }, { name: 'Moyenne 7 jours', color: 'var(--c-weight)', width: 2.4, endDot: true, points: s.map(p => ({ x: p.date, y: +p.avg7.toFixed(2) })) }],
    primary: 1, refs: [{ y: b.hi, label: `${U.num(b.hi, 1)}`, color: 'var(--goal)', include: true }, { y: b.lo, label: `${U.num(b.lo, 1)}`, color: 'var(--goal)', include: true }],
    yFmt: v => U.num(v), tip: (d, v) => `${U.fmtFull(d)}<br>${v.map(x => `${x.se.name} : <b>${U.kg(x.p.y)} kg</b>`).join('<br>')}`
  });
};

/* Jalons : ceux de la perte de poids ne comptent pas en maintien ; jalons de régularité pour tout le monde */
D.activeWeeksStats = () => D.memo('actWeeks', () => {
  const goal = D.weeklyGoal().min, first = D.doneActs()[0];
  if (!first) return { count: 0, maxStreak: 0 };
  let ws = U.weekStart(first.date), count = 0, run = 0, maxStreak = 0;
  const end = U.weekStart(U.today());
  for (let i = 0; ws <= end && i < 520; i++, ws = U.addDays(ws, 7)) {
    if (D.weekSummary(ws).minutes >= goal) { count++; run++; maxStreak = Math.max(maxStreak, run); } else if (ws < end) run = 0;
  }
  return { count, maxStreak };
});
for (const b of D.BADGES) if (b.unit === 'kg' || b.id === 'goal') { const v = b.val; b.val = () => D.isMaintain() ? 0 : v(); b.loseOnly = true; }
D.BADGES.splice(D.BADGES.findIndex(b => b.id === 'kg5'), 0,
  { id: 'wk150', label: 'Semaine active', desc: `${D.WHO_MIN} min d'activité en une semaine`, icon: 'heart', val: () => D.activeWeeksStats().count, goal: 1 },
  { id: 'streak4', label: '4 semaines actives', desc: 'D\'affilée, objectif de minutes atteint', icon: 'repeat', val: () => D.activeWeeksStats().maxStreak, goal: 4 },
  { id: 'streak12', label: '12 semaines actives', desc: 'Trois mois de régularité', icon: 'trophy', val: () => D.activeWeeksStats().maxStreak, goal: 12 }
);
{
  const badgeState = D.badgeState;
  D.badgeState = () => { const all = badgeState(); return D.isMaintain() ? all.filter(b => !b.loseOnly) : all; };
}
