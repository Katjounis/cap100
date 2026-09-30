'use strict';
/* Cap 100 — bilan de la semaine : ce qui s'est passé la semaine dernière, un point fort, un seul objectif pour la suivante. */

D.weekReport = (ws = U.addDays(U.weekStart(U.today()), -7)) => D.memo('report-' + ws, () => {
  const w = D.weekSummary(ws), prev = D.weekSummary(U.addDays(ws, -7));
  const tg = D.targets(), goal = D.weeklyGoal(), we = U.addDays(ws, 6);
  const habits = D.habits().map(h => ({ h, n: D.habitCount(h, ws, we), goal: h.perWeek || 7 }));
  const habitPct = habits.length ? U.avg(habits.map(x => Math.min(1, x.n / x.goal))) : null;
  const wts = D.weightSeries().filter(p => p.date <= we);
  const avgEnd = wts.length ? wts[wts.length - 1].avg7 : null;
  const prevW = D.weightSeries().filter(p => p.date <= U.addDays(ws, -1));
  const avgStart = prevW.length ? prevW[prevW.length - 1].avg7 : null;
  const dW = avgEnd != null && avgStart != null && wts[wts.length - 1].date >= ws ? avgEnd - avgStart : null;
  const kcalOk = w.loggedDays >= 3 ? Math.abs(w.kcal - tg.kcal) / tg.kcal <= 0.1 : null;
  const protOk = w.loggedDays >= 3 ? w.prot >= tg.protein * 0.9 : null;
  const r = { ws, we, w, prev, dW, avgEnd, habits, habitPct, kcalOk, protOk, goal, tg };

  /* Point fort : le meilleur signal de la semaine */
  const wins = [];
  if (w.minutes >= goal.min) wins.push(['heart', `${U.num(w.minutes)} min d'activité`, `Objectif de ${goal.min} min atteint${w.minutes > prev.minutes && prev.minutes ? `, et ${U.num(w.minutes - prev.minutes)} min de plus que la semaine d'avant` : ''}.`]);
  if (w.strength >= 2) wins.push(['dumbbell', `${w.strength} séances de renforcement`, 'Le repère de 2 par semaine est atteint.']);
  if (!D.isMaintain() && dW != null && dW <= -0.2) wins.push(['trendDown', `${U.sign(dW, 1)} kg sur la semaine`, 'En moyenne sur 7 jours, sans à-coup.']);
  if (D.isMaintain() && avgEnd != null && avgEnd >= D.band().lo && avgEnd <= D.band().hi) wins.push(['scale', 'Poids stable', `Moyenne de ${U.kg(avgEnd)} kg, dans ta zone.`]);
  if (protOk) wins.push(['bolt', 'Protéines au rendez-vous', `${U.num(w.prot)} g par jour en moyenne.`]);
  if (w.loggedDays >= 6) wins.push(['note', `${w.loggedDays} jours de repas notés`, 'C\'est ce qui rend les conseils fiables.']);
  if (habitPct != null && habitPct >= 0.8) wins.push(['check', 'Habitudes tenues', `${U.num(habitPct * 100)} % de tes habitudes réalisées.`]);
  if (w.steps && w.steps >= tg.steps) wins.push(['steps', `${U.num(Math.round(w.steps / 100) * 100)} pas par jour`, `Au-dessus de ton objectif de ${U.num(tg.steps)}.`]);
  r.win = wins[0] || (w.sessions ? ['pulse', `${w.sessions} activité${w.sessions > 1 ? 's' : ''} réalisée${w.sessions > 1 ? 's' : ''}`, 'Chaque séance compte : on continue.'] : null);

  /* Un seul objectif pour la semaine suivante : le plus utile d'abord */
  let focus;
  if (w.minutes < goal.min * 0.6) focus = ['heart', `Viser ${goal.min} min d'activité`, `Tu étais à ${U.num(w.minutes)} min. 30 minutes de marche rapide 5 jours sur 7 suffisent.`];
  else if (w.strength < 2) focus = ['dumbbell', '2 séances de renforcement', `${w.strength ? 'Une seule' : 'Aucune'} la semaine dernière. Deux séances de 30 minutes suffisent pour garder ou gagner du muscle.`];
  else if (w.loggedDays < 4) focus = ['note', 'Noter ses repas 5 jours sur 7', `${w.loggedDays} jour${w.loggedDays > 1 ? 's' : ''} notés : à partir de 4 à 5, tes moyennes deviennent fiables.`];
  else if (protOk === false) focus = ['bolt', `${U.num(tg.protein)} g de protéines par jour`, `Moyenne de ${U.num(w.prot)} g. Un skyr ou deux œufs de plus par jour comblent souvent l'écart.`];
  else if (kcalOk === false && w.kcal > tg.kcal) focus = ['flame', `Rester autour de ${U.num(tg.kcal)} kcal`, `Moyenne de ${U.num(w.kcal)} kcal. Regarde le week-end et les boissons en premier.`];
  else if (w.steps && w.steps < tg.steps * 0.8) focus = ['steps', `${U.num(tg.steps)} pas par jour`, `Moyenne de ${U.num(Math.round(w.steps / 100) * 100)}. 10 minutes de marche après le déjeuner et le dîner.`];
  else focus = ['repeat', 'Garder le même rythme', 'Tout est au vert : la régularité fait le reste. Tu peux ajouter une séance si tu te sens en forme.'];
  r.focus = focus;
  return r;
});

D.reportStrip = () => {
  const ws = U.addDays(U.weekStart(U.today()), -7);
  const dow = U.dow(U.today());
  if (dow > 2 || DB.setting('reportSeen', '') === ws) return '';
  if (!D.trackedDays().size || [...D.trackedDays()].every(d => d > U.addDays(ws, 6))) return '';
  const r = D.weekReport(ws);
  return `<section class="card span-12 report-strip"><div class="rs-in">
    <span class="ic-badge" style="--c:var(--accent)">${U.icon('chart')}</span>
    <div class="grow" style="min-width:0"><div class="eyebrow">Semaine du ${U.fmtShort(ws)} au ${U.fmtShort(r.we)}</div><h2 style="margin:2px 0 0">Ton bilan de la semaine est prêt</h2>
      <div class="rs-kpis"><span><b>${U.num(r.w.minutes)}</b> min d'activité</span><span><b>${r.w.sessions}</b> séance${r.w.sessions > 1 ? 's' : ''}</span>${r.dW != null ? `<span><b>${U.sign(r.dW, 1)}</b> kg</span>` : ''}${r.w.loggedDays ? `<span><b>${U.num(r.w.kcal)}</b> kcal/j</span>` : ''}</div></div>
    <button class="btn primary" data-act="reportOpen" data-ws="${ws}">Voir le bilan</button><button class="icon-btn sm" data-act="reportHide" data-ws="${ws}" aria-label="Masquer">${U.icon('x')}</button></div></section>`;
};

A.reportHide = async el => { await DB.setSetting('reportSeen', el.dataset.ws); App.renderView(false); };
A.reportOpen = el => {
  const st = { ws: el && el.dataset.ws ? el.dataset.ws : U.addDays(U.weekStart(U.today()), -7) };
  if (el && el.dataset.ws) DB.setSetting('reportSeen', el.dataset.ws);
  const row = (ic, c, t, d) => `<div class="li"><span class="ic-badge sm" style="--c:${c}">${U.icon(ic)}</span><span class="grow"><span class="t" style="white-space:normal">${t}</span><span class="s" style="white-space:normal">${d}</span></span></div>`;
  UI.open({
    title: 'Bilan de la semaine', sub: () => `Du ${U.fmtLong(st.ws)} au ${U.fmtLong(U.addDays(st.ws, 6))}`, size: 'md',
    body: () => {
      const r = D.weekReport(st.ws), w = r.w, p = r.prev;
      const delta = (a, b, unit = '', dec = 0) => b ? `<span class="xs ${a >= b ? 'good-c' : 'faint'}">${a >= b ? '+' : '−'}${U.num(Math.abs(a - b), dec)}${unit} vs sem. préc.</span>` : '';
      return `<div class="stack">
        <div class="seg full"><button data-rw="-7">${U.icon('chevL', 'sm')} Semaine d'avant</button><button data-rw="7" ${U.addDays(st.ws, 7) >= U.weekStart(U.today()) ? 'disabled' : ''}>Semaine suivante ${U.icon('chevR', 'sm')}</button></div>
        <div class="grid g-2 report-kpis" style="gap:10px">
          <div class="kpi"><span class="l">Activité</span><span class="v">${U.num(w.minutes)}<small>/ ${r.goal.min} min</small></span>${delta(w.minutes, p.minutes, ' min')}</div>
          <div class="kpi"><span class="l">Séances</span><span class="v">${w.sessions}<small>dont ${w.strength} renfo</small></span>${delta(w.sessions, p.sessions)}</div>
          <div class="kpi"><span class="l">Poids moyen</span><span class="v">${r.avgEnd != null ? U.kg(r.avgEnd) : '–'}<small>kg</small></span><span class="xs faint">${r.dW != null ? U.sign(r.dW, 1) + ' kg sur la semaine' : 'pas de pesée cette semaine'}</span></div>
          <div class="kpi"><span class="l">Pas par jour</span><span class="v">${w.steps ? U.num(Math.round(w.steps / 100) * 100) : '–'}</span><span class="xs faint">objectif ${U.num(r.tg.steps)}</span></div>
          <div class="kpi"><span class="l">Calories</span><span class="v">${w.loggedDays ? U.num(w.kcal) : '–'}<small>kcal/j</small></span><span class="xs faint">${w.loggedDays} jour${w.loggedDays > 1 ? 's' : ''} notés · cible ${U.num(r.tg.kcal)}</span></div>
          <div class="kpi"><span class="l">Protéines</span><span class="v ${r.protOk === false ? 'goal-c' : r.protOk ? 'good-c' : ''}">${w.loggedDays ? U.num(w.prot) : '–'}<small>g/j</small></span><span class="xs faint">cible ${U.num(r.tg.protein)} g</span></div>
        </div>
        ${r.habits.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Habitudes${r.habitPct != null ? ` · ${U.num(r.habitPct * 100)} %` : ''}</div><div class="habit-mini">${r.habits.map(x => `<span class="${x.n >= x.goal ? 'on' : ''}">${U.esc(x.h.name)} <b>${x.n}/${x.goal}</b></span>`).join('')}</div></div>` : ''}
        <div class="list">
          ${r.win ? row(r.win[0], 'var(--good)', `<b>Point fort</b> · ${U.esc(r.win[1])}`, U.esc(r.win[2])) : row('info', 'var(--ink-3)', '<b>Semaine calme</b>', 'Peu de données cette semaine. Ce n\'est pas grave : on repart lundi.')}
          ${row(r.focus[0], 'var(--accent)', `<b>Pour cette semaine</b> · ${U.esc(r.focus[1])}`, U.esc(r.focus[2]))}
        </div>
      </div>`;
    },
    footer: `<button class="btn ghost" data-act="goStats" data-close-top>Statistiques détaillées</button><span class="spacer"></span><button class="btn primary" data-close-top>Compris</button>`,
    onMount: m => m.el.querySelectorAll('[data-rw]').forEach(b => b.addEventListener('click', () => { st.ws = U.addDays(st.ws, +b.dataset.rw); m.render(); }))
  });
};
A.goStats = () => App.go('stats');
