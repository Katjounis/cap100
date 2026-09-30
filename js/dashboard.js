'use strict';
/* Cap 100 — tableau de bord (la page ouverte chaque jour) */

const PERIODS = [['7', '7 j'], ['30', '30 j'], ['90', '3 mois'], ['180', '6 mois'], ['365', '1 an'], ['all', 'Tout']];

/* Graphique du poids partagé (tableau de bord, corps, statistiques) */
function weightChart(el, { period = '30', layers = { raw: true, avg: true, trend: false, plan: true } } = {}) {
  const s = D.weightSeries();
  const g = D.goal();
  const today = U.today();
  if (!s.length) {
    el.innerHTML = UI.empty('scale', 'Aucune pesée pour l\'instant', 'Ta courbe apparaîtra dès la première pesée. Pèse-toi le matin, à jeun, pour des mesures comparables.', '<button class="btn primary sm" data-act="quickWeight">Ajouter mon poids</button>');
    return;
  }
  let from, to = today > s[s.length - 1].date ? today : s[s.length - 1].date;
  if (period === 'all') { from = s[0].date < g.startDate ? s[0].date : g.startDate; if (g.goalDate > to) to = g.goalDate; }
  else from = U.addDays(today, -(+period) + 1);
  const pts = s.filter(p => p.date >= from && p.date <= to);
  const series = [];
  if (layers.plan) {
    const a = from > g.startDate ? from : g.startDate, b = to < g.goalDate ? to : g.goalDate;
    if (a < b) series.push({ name: 'Repère', color: 'var(--goal)', dash: '5 6', width: 1.6, points: [{ x: a, y: D.planAt(a) }, { x: b, y: D.planAt(b) }] });
  }
  if (layers.raw) series.push({ name: 'Pesée', color: 'var(--c-weight)', style: layers.avg ? 'dots' : 'line', dots: !layers.avg, points: pts.map(p => ({ x: p.date, y: p.kg })) });
  if (layers.avg) series.push({ name: 'Moyenne 7 j', color: 'var(--c-weight)', style: 'area', endDot: true, width: 2.6, points: pts.map(p => ({ x: p.date, y: +p.avg7.toFixed(2) })) });
  if (layers.trend) series.push({ name: 'Tendance', color: 'var(--c-strength)', width: 2, points: pts.map(p => ({ x: p.date, y: +p.trend.toFixed(2) })) });
  if (!pts.length) {
    el.innerHTML = UI.empty('scale', 'Pas de pesée sur cette période', 'Choisis une période plus longue ou ajoute une pesée.');
    return;
  }
  const primaryIdx = series.findIndex(x => x.name === 'Pesée' || x.name === 'Moyenne 7 j');
  Charts.line(el, {
    height: el.dataset.h ? +el.dataset.h : 260, label: 'Évolution du poids', xFrom: from, xTo: to,
    series: series.length ? series : [{ name: 'Pesée', color: 'var(--c-weight)', points: pts.map(p => ({ x: p.date, y: p.kg })) }],
    primary: Math.max(0, primaryIdx),
    refs: period === 'all' ? [{ y: g.goal, label: `Objectif ${U.num(g.goal)} kg`, color: 'var(--goal)', include: true }] : [],
    yFmt: v => U.num(v, v % 1 ? 1 : 0),
    tip: date => {
      const p = s.find(x => x.date === date);
      let h = `<div class="xs" style="opacity:.75">${U.fmtLong(date)}</div>`;
      if (p) {
        h += `<b>${U.kg(p.kg)} kg</b><div class="xs" style="opacity:.85">Moyenne 7 j : ${U.kg(p.avg7)} kg`;
        if (layers.trend) h += `<br>Tendance : ${U.kg(p.trend)} kg`;
        if (date >= g.startDate && date <= g.goalDate) h += `<br>Repère : ${U.kg(D.planAt(date))} kg`;
        h += '</div>';
      }
      return h;
    }
  });
}
A.quickWeight = () => F.weight();

Pages.dashboard = {
  title: 'Accueil',
  nav: 'accueil',
  period: '30',
  layers: { raw: true, avg: true, trend: false, plan: true },
  render() {
    const p = D.profile(), today = U.today();
    const prog = D.progress(), g = prog.g, cur = prog.last;
    const h = new Date().getHours();
    const hello = h < 5 ? 'Bonsoir' : h < 18 ? 'Bonjour' : 'Bonsoir';
    const dayN = U.diffDays(g.startDate, today) + 1;
    const weekN = Math.floor(Math.max(0, dayN - 1) / 7) + 1;
    return `<div class="hello"><div><h1>${hello}${p.name ? ' ' + U.esc(p.name) : ''}</h1>
      <div class="sub">${U.fmtLong(today)}${dayN >= 1 ? ` · jour ${U.num(dayN)} · semaine ${weekN} ${D.isMaintain() ? 'de ton suivi' : 'de ta transformation'}` : ` · départ dans ${-dayN + 1} jours`}</div></div>
      <div class="actions row"><button class="btn" data-act="quickWeight">${U.icon('scale', 'sm')}Pesée</button><button class="btn primary" data-act="quickOpen">${U.icon('plus', 'sm')}Ajouter</button></div></div>
    <div class="grid g-dash">
      ${D.reportStrip()}
      ${D.isMaintain() ? D.maintainHero() : this.heroCard(prog)}
      ${this.todayCard()}
      ${D.coachStrip()}
      <section class="card span-8 o2"><div class="card-h"><div><div class="eyebrow">Progression</div><h2>Évolution du poids</h2></div><span class="spacer"></span>
        <div class="seg" id="dash-period">${PERIODS.map(([v, l]) => `<button data-act="dashPeriod" data-v="${v}" class="${this.period === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div id="dash-wchart"></div>
        <div class="legend" style="margin-top:10px">${[['raw', 'Pesées', 'dotl', 'var(--c-weight)'], ['avg', 'Moyenne 7 jours', '', 'var(--c-weight)'], ['trend', 'Tendance lissée', '', 'var(--c-strength)'], ['plan', 'Repère linéaire', 'dash', 'var(--goal)']].map(([k, l, cls, c]) => `<button data-act="dashLayer" data-k="${k}" class="${this.layers[k] ? '' : 'off'}"><i class="${cls}" style="--c:${c}"></i>${l}</button>`).join('')}</div>
      </section>
      ${this.weekCard()}
      ${this.feedCard()}
      ${this.habitsCard()}
      ${this.nextCard(prog)}
    </div>`;
  },
  heroCard(prog) {
    const g = prog.g, cur = prog.last;
    const ms = D.milestones();
    const nodes = [{ kg: g.start, pct: 0, on: true }, ...ms.map(m => ({ kg: m.kg, pct: g.start > g.goal ? (g.start - m.kg) / (g.start - g.goal) : 1, on: !!m.date, goal: m.goal }))];
    const rate = D.rate(), req = D.requiredRate(), proj = D.projection();
    const monthsLeft = Math.max(0, Math.round(U.diffDays(U.today(), g.goalDate) / 30.4));
    let insight;
    if (!cur) insight = `<div class="note">${U.icon('info', 'sm')}<span>Ajoute ta première pesée pour lancer le suivi. La progression est calculée sur ta moyenne des 7 derniers jours, pas sur une pesée isolée.</span></div>`;
    else if (rate == null) insight = `<div class="note">${U.icon('info', 'sm')}<span>Encore quelques pesées sur 10 jours minimum pour estimer ton rythme réel. La tendance compte plus qu'un chiffre isolé.</span></div>`;
    else insight = `<div class="row wrap small" style="gap:6px 18px"><span>Rythme actuel <b class="${rate < 0 ? 'good-c' : ''}">${U.sign(rate, 2)} kg/sem.</b></span>${req ? `<span class="muted">Repère pour ${U.cap(U.fmtMonthShort(g.goalDate))} ${U.parse(g.goalDate).getFullYear()} : <b>−${U.num(req, 2)} kg/sem.</b></span>` : ''}${proj ? `<span class="muted">À ce rythme : ${U.fmtMonth(proj).toLowerCase()} <span class="faint">(estimation indicative)</span></span>` : ''}</div>`;
    const pathPct = (prog.pct * 100).toFixed(1);
    return `<section class="card span-8 clickable" data-act="goGoal" aria-label="Objectif">
      <div class="card-h"><div><div class="eyebrow">Transformation</div><h2>${U.num(g.start)} kg → ${U.num(g.goal)} kg</h2></div><span class="spacer"></span><span class="pill planned">${U.icon('flag', 'sm')}${U.cap(U.fmtMonth(g.goalDate).toLowerCase())}</span></div>
      <div class="hero">
        <div class="gauge-wrap">${Charts.gauge({ pct: prog.pct, nodes: nodes.map(n => ({ ...n, label: n.goal || n.pct === 0 ? U.num(n.kg) : '' })) })}
          <div class="gauge-center"><span class="cap">Moyenne 7 j</span><span class="big"><span data-count="${prog.ref.toFixed(1)}" data-dec="1" data-from="${g.start}">${U.kg(prog.ref)}</span><span class="unit">kg</span></span><span class="pct">${U.num(prog.pct * 100)} % du chemin</span></div></div>
        <div class="journey">
          <div class="kpis">
            <div class="kpi"><span class="l">Dernière pesée</span><span class="v">${cur ? U.kg(cur.kg) : '–'}<small>kg</small></span><span class="d faint">${cur ? U.relDay(cur.date) : 'À saisir'}</span></div>
            <div class="kpi"><span class="l">Depuis le départ</span><span class="v ${prog.lost > 0 ? 'good-c' : ''}">${U.sign(-prog.lost)}<small>kg</small></span><span class="d faint">départ ${U.fmtShort(g.startDate)}</span></div>
            <div class="kpi"><span class="l">Restant</span><span class="v">${U.kg(prog.remaining)}<small>kg</small></span><span class="d faint">jusqu'à ${U.num(g.goal)} kg</span></div>
            <div class="kpi"><span class="l">Échéance visée</span><span class="v">${monthsLeft}<small>mois</small></span><span class="d faint">${U.fmtMonth(g.goalDate).toLowerCase()}</span></div>
          </div>
          <div class="path-wrap"><div class="path"><div class="path-line"><i style="--w:0%" data-w="${pathPct}%"></i></div>
            ${nodes.map(n => `<span class="path-stop ${n.on ? 'on' : ''} ${n.goal ? 'goal' : ''}" style="left:${(n.pct * 100).toFixed(2)}%"><em>${U.num(n.kg)}</em></span>`).join('')}
            <span class="path-me" style="left:${pathPct}%">Toi</span></div></div>
          ${insight}
        </div>
      </div>
    </section>`;
  },
  todayCard() {
    const t = U.today(), tg = { ...D.targets(), kcal: D.kcalTarget(t) }, tot = D.dayTotals(t), day = D.day(t);
    const acts = D.actsOn(t);
    const mins = U.sum(acts.filter(a => a.status === 'done').map(a => a.duration || 0));
    const ring = (pct, c, ic) => Charts.ring(pct, { color: c, icon: U.icon(ic, 'sm') });
    const rk = (act, pct, c, ic, v, unit, l) => `<button class="ring-kpi" data-act="${act}" style="text-align:left">${ring(pct, c, ic)}<div style="min-width:0"><div class="v">${v}<small> ${unit}</small></div><div class="l">${l}</div></div></button>`;
    const kLeft = tg.kcal - tot.kcal;
    let sess;
    const planned = acts.filter(a => a.status !== 'cancelled');
    if (planned.length) sess = planned.map(a => { const t = D.ACT[a.type] || D.ACT.other; const bits = [a.time ? a.time.replace(':', 'h') : '', a.duration ? U.dur(a.duration) : '', a.distance ? U.num(a.distance, 1) + ' km' : ''].filter(Boolean).join(' · ');
      let btn = '';
      if (a.status === 'planned') btn = a.type === 'strength' ? `<button class="btn sm primary" data-act="actStart" data-id="${a.id}">${U.icon('play', 'sm')}Démarrer</button>` : `<button class="btn sm" data-act="actStatus" data-s="done" data-id="${a.id}">${U.icon('check', 'sm')}Fait</button>`;
      else if (a.status === 'progress') btn = `<a class="btn sm primary" href="#seance-${a.id}">Reprendre</a>`;
      return `<div class="session-card clickable" data-act="actOpen" data-id="${a.id}"><span class="ic-badge ${a.status === 'planned' ? 'planned' : ''}" style="--c:${t.c}">${U.icon(t.icon)}</span><div class="grow" style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(D.actTitle(a))}</b><div class="xs faint">${bits}</div><span class="pill ${a.status}" style="margin-top:4px">${D.STATUS[a.status]}</span></div>${btn}</div>`; }).join('');
    else if (day.rest) sess = `<div class="session-card"><span class="ic-badge" style="--c:var(--c-rest)">${U.icon('bed')}</span><div class="grow"><b>Journée de repos</b><div class="xs faint">La récupération fait partie du programme.</div></div></div>`;
    else sess = `<div class="session-card"><span class="ic-badge" style="--c:var(--ink-3)">${U.icon('calendar')}</span><div class="grow"><b>Rien de prévu</b><div class="xs faint">Séance, marche ou repos : à toi de voir.</div></div><button class="btn sm" data-act="todayPlan">Choisir</button></div>`;
    return `<section class="card span-4 o1"><div class="card-h"><div><div class="eyebrow">Aujourd'hui</div><h2>${U.fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div></div>
      <div class="today-rings">
        ${rk('goToday', tot.kcal / tg.kcal, 'var(--c-food)', 'flame', `<span data-count="${tot.kcal}">${U.num(tot.kcal)}</span>`, `/ ${U.num(tg.kcal)}`, tot.count ? (kLeft >= 0 ? `${U.num(kLeft)} kcal restantes` : `${U.num(-kLeft)} kcal au-dessus`) : 'Calories · rien noté')}
        ${rk('goToday', tot.p / tg.protein, 'var(--c-strength)', 'bolt', `<span data-count="${Math.round(tot.p)}">${U.num(tot.p)}</span>`, `/ ${U.num(tg.protein)} g`, 'Protéines')}
        ${rk('quickActivity', mins / tg.activeMin, 'var(--c-walk)', 'pulse', `<span data-count="${mins}">${mins}</span>`, 'min', 'Activité')}
        ${rk('quickSteps', (day.steps || 0) / tg.steps, 'var(--c-bike)', 'steps', `<span data-count="${day.steps || 0}">${U.num(day.steps || 0)}</span>`, '', `Pas · objectif ${U.num(tg.steps)}`)}
      </div>
      <div class="eyebrow" style="margin-top:16px">Séance</div>${sess}
    </section>`;
  },
  weekCard() {
    const ws = U.weekStart(U.today()), w = this.weekData = D.weekSummary(ws), prev = D.weekSummary(U.addDays(ws, -7));
    const t = U.today();
    const dW = w.weight != null && prev.weight != null ? w.weight - prev.weight : null;
    return `<section class="card span-4 o1"><div class="card-h"><div><div class="eyebrow">Cette semaine</div><h2>${U.fmtShort(ws)} – ${U.fmtShort(U.addDays(ws, 6))}</h2></div><span class="spacer"></span><button class="card-link" data-act="reportOpen" title="Bilan de la semaine dernière">${U.icon('chart', 'sm')}Bilan</button><a class="card-link" href="#calendrier">Calendrier${U.icon('chevR', 'sm')}</a></div>
      <div class="week-strip">${w.days.map((d, i) => {
        const acts = D.actsOn(d).filter(a => a.status !== 'cancelled');
        const dots = [...new Set(acts.map(a => a.type))].slice(0, 3).map(tp => `<i style="--c:${D.ACT[tp].c};${acts.find(a => a.type === tp).status === 'planned' ? 'background:transparent;box-shadow:inset 0 0 0 1.5px var(--c)' : ''}"></i>`);
        if (D.dayTotals(d).count) dots.push('<i style="--c:var(--c-food)"></i>');
        return `<button class="wd ${D.isActiveDay(d) ? 'active' : ''} ${d === t ? 'today' : ''} ${d > t ? 'future' : ''}" data-act="openDay" data-date="${d}"><span class="n">${U.dayLetter(i)}</span><span class="d">${U.parse(d).getDate()}</span><span class="dots">${dots.slice(0, 4).join('')}</span></button>`;
      }).join('')}</div>
      <div class="grid g-2" style="margin-top:16px;gap:14px 12px">
        <div class="kpi"><span class="v">${w.activeDays}<small>/ ${w.pastDays} j</small></span><span class="l">Jours actifs</span></div>
        <div class="kpi"><span class="v">${w.sessions}</span><span class="l">Séance${w.sessions > 1 ? 's' : ''} réalisée${w.sessions > 1 ? 's' : ''}</span></div>
        <div class="kpi"><span class="v">${U.dur(w.minutes)}</span><span class="l">Temps d'activité</span></div>
        <div class="kpi"><span class="v">${w.weight != null ? U.kg(w.weight) : '–'}<small>kg</small></span><span class="l">Poids moyen ${dW != null ? `<b class="${dW < 0 ? 'good-c' : dW > 0 ? 'goal-c' : 'faint'}">${U.sign(dW)}</b>` : ''}</span></div>
        <div class="kpi"><span class="v">${w.kcal != null ? U.num(w.kcal) : '–'}<small>kcal</small></span><span class="l">Calories moy. (${w.loggedDays} j notés)</span></div>
        <div class="kpi"><span class="v">${w.prot != null ? U.num(w.prot) : '–'}<small>g</small></span><span class="l">Protéines moy.</span></div>
      </div></section>`;
  },
  feedCard() {
    const ev = [];
    D.weights().slice(-8).forEach(w => ev.push({ d: w.date, t: 0, ic: 'scale', c: 'var(--c-weight)', title: `${U.kg(w.kg)} kg`, sub: 'Pesée', act: `data-act="editWeight" data-date="${w.date}"` }));
    D.doneActs().slice(-8).forEach(a => { const t = D.ACT[a.type] || D.ACT.other; ev.push({ d: a.date, t: a.time || '', ic: t.icon, c: t.c, title: D.actTitle(a), sub: [a.duration ? U.dur(a.duration) : '', a.distance ? U.num(a.distance, 1) + ' km' : '', a.type === 'strength' && a.exercises ? D.workoutSetsDone(a) + ' séries' : ''].filter(Boolean).join(' · '), act: `data-act="actOpen" data-id="${a.id}"` }); });
    DB.all('measurements').forEach(m => ev.push({ d: m.date, t: 0, ic: 'ruler', c: 'var(--c-bike)', title: 'Mensurations', sub: m.waist ? `Taille ${U.num(m.waist, 1)} cm` : '', act: 'data-act="goBody" data-tab="measures"' }));
    DB.all('photos').forEach(p => ev.push({ d: p.date, t: 0, ic: 'camera', c: 'var(--c-run)', title: 'Photo de progression', sub: p.pose, act: 'data-act="goBody" data-tab="photos"' }));
    ev.sort((a, b) => (b.d + b.t) > (a.d + a.t) ? 1 : -1);
    const top = ev.filter(e => e.d <= U.today()).slice(0, 6);
    return `<section class="card span-4 o3 feed"><div class="card-h"><div><div class="eyebrow">Récemment</div><h2>Ce que tu as fait</h2></div></div>
      ${top.length ? `<div class="list">${top.map(e => `<div class="li act" ${e.act}><span class="ic-badge sm" style="--c:${e.c}">${U.icon(e.ic)}</span><span class="grow"><span class="t">${U.esc(e.title)}</span><span class="s">${U.esc(e.sub || '')}</span></span><span class="end xs faint">${U.diffDays(e.d, U.today()) <= 1 ? U.relDay(e.d) : U.fmtShort(e.d)}</span></div>`).join('')}</div>`
      : UI.empty('history', 'Rien pour l\'instant', 'Tes pesées, activités et mensurations apparaîtront ici.')}</section>`;
  },
  habitsCard() {
    const hs = D.habits(), t = U.today();
    const done = hs.filter(h => D.habitDone(h, t)).length;
    return `<section class="card span-4 o3"><div class="card-h"><div><div class="eyebrow">Habitudes</div><h2>${done} / ${hs.length} aujourd'hui</h2></div><span class="spacer"></span><a class="card-link" href="#habitudes">Tout voir${U.icon('chevR', 'sm')}</a></div>
      ${hs.length ? `<div class="list">${hs.slice(0, 6).map(h => { const on = D.habitDone(h, t); const c = D.HABIT_COLORS[h.color % D.HABIT_COLORS.length]; const wk = D.habitCount(h, U.weekStart(t), U.addDays(U.weekStart(t), 6)); return `<div class="li"><span class="ic-badge sm" style="--c:${c}">${U.icon(h.icon)}</span><span class="grow"><span class="t">${U.esc(h.name)}</span><span class="s">${wk} / ${h.perWeek} cette semaine${h.auto ? ' · automatique' : ''}</span></span>${h.auto ? `<span class="set-ok ${on ? 'on' : ''}" style="width:38px;height:34px;--c:${c}">${U.icon('check', 'sm')}</span>` : `<button class="set-ok ${on ? 'on' : ''}" style="width:38px;height:34px" data-act="habitToggle" data-id="${h.id}" data-date="${t}" aria-label="Cocher ${U.esc(h.name)}">${U.icon('check', 'sm')}</button>`}</div>`; }).join('')}</div>`
      : UI.empty('repeat', 'Aucune habitude', 'Crée tes habitudes pour suivre ta régularité.', '<a class="btn sm primary" href="#habitudes">Créer</a>')}</section>`;
  },
  nextCard(prog) {
    const ms = D.milestones();
    const next = ms.find(m => !m.date);
    const prevKg = ms.filter(m => m.date).map(m => m.kg).pop() ?? prog.g.start;
    const badges = D.badgeState().filter(b => !b.on).sort((a, b) => b.pct - a.pct).slice(0, 3);
    let top;
    if (D.isMaintain()) {
      const wk = D.weekSummary(U.weekStart(U.today())), g = D.weeklyGoal();
      top = `<div class="row between"><div><div class="xs faint">Activité de la semaine</div><div class="mid">${U.num(wk.minutes)}<span class="unit">/ ${g.min} min</span></div></div><div style="text-align:right"><div class="xs faint">séances</div><b class="mid acc-c">${wk.sessions}</b><span class="unit">/ ${g.sessions}</span></div></div>
        <div style="margin:10px 0 4px">${UI.bar(wk.minutes / g.min, 'var(--c-walk)', 'thick')}</div><div class="xs faint">Toutes tes activités terminées comptent : marche, vélo, renforcement…</div>`;
    } else if (next) {
      const left = Math.max(0, prog.ref - next.kg), pct = U.clamp((prevKg - prog.ref) / (prevKg - next.kg), 0, 1);
      top = `<div class="row between"><div><div class="xs faint">Prochain palier</div><div class="mid">${U.num(next.kg)}<span class="unit">kg</span></div></div><div style="text-align:right"><div class="xs faint">encore</div><b class="mid acc-c">${U.kg(left)}</b><span class="unit">kg</span></div></div>
        <div style="margin:10px 0 4px">${UI.bar(pct, 'var(--accent)', 'thick')}</div><div class="xs faint">Validé automatiquement quand ta moyenne sur 7 jours passe sous ${U.num(next.kg)} kg.</div>`;
    } else top = `<div class="celebrate" style="padding:0"><div class="md" style="width:56px;height:56px">${U.icon('flag')}</div><b>Tous les paliers sont franchis</b></div>`;
    return `<section class="card span-4 o3 o-last clickable" data-act="goGoal"><div class="card-h"><div><div class="eyebrow">Objectifs</div><h2>La suite</h2></div><span class="spacer"></span><span class="card-link">${D.isMaintain() ? 'Ma forme' : 'Objectif'}${U.icon('chevR', 'sm')}</span></div>
      ${top}
      <div class="list" style="margin-top:12px">${badges.map(b => `<div class="li"><span class="ic-badge sm" style="--c:var(--goal)">${U.icon(b.icon)}</span><span class="grow"><span class="t">${U.esc(b.label)}</span>${UI.bar(b.pct, 'var(--goal)')}</span><span class="end xs faint">${U.num(Math.min(b.v, b.goal), b.unit === 'kg' ? 1 : 0)}/${U.num(b.goal)}${b.unit ? ' ' + b.unit : ''}</span></div>`).join('')}</div>
    </section>`;
  },
  mount(root) {
    weightChart(root.querySelector('#dash-wchart'), { period: this.period, layers: this.layers });
    UI.countUp(root);
  }
};
A.dashPeriod = el => { Pages.dashboard.period = el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); weightChart(document.getElementById('dash-wchart'), Pages.dashboard); };
A.dashLayer = el => { const L = Pages.dashboard.layers; L[el.dataset.k] = !L[el.dataset.k]; if (!L.raw && !L.avg && !L.trend) L.avg = true; App.renderView(false); };
A.quickOpen = () => F.quick();
A.goToday = () => { Pages.nutrition.date = U.today(); App.go('repas'); };
A.quickActivity = () => F.activity({ date: U.today() });
A.quickSteps = () => F.steps(U.today());
A.todayPlan = () => F.quick(U.today());
A.goGoal = (el, e) => { if (e && e.target.closest('button:not([data-act="goGoal"]), a')) return; App.go('objectif'); };
A.openDay = el => F.day(el.dataset.date);
A.editWeight = el => F.weight(el.dataset.date);
A.goBody = el => { Pages.body.tab = el.dataset.tab; App.go('corps'); };
