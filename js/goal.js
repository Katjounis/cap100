'use strict';
/* Cap 100 — objectif 100 kg : jauge, paliers, timeline, badges */

Pages.goal = {
  title: 'Objectif',
  nav: 'objectif',
  render() {
    if (D.isMaintain()) return D.maintainPage();
    const prog = D.progress(), g = prog.g;
    const ms = D.milestones();
    const nodes = [{ kg: g.start, pct: 0, on: true }, ...ms.map(m => ({ kg: m.kg, pct: g.start > g.goal ? (g.start - m.kg) / (g.start - g.goal) : 1, on: !!m.date, goal: m.goal }))];
    const rate = D.rate(), req = D.requiredRate(), proj = D.projection();
    const nextIdx = ms.findIndex(m => !m.date);
    const months = D.monthsTimeline();
    const badges = D.badgeState();
    const unlocked = badges.filter(b => b.on).length;
    const rungs = [{ kg: g.start, date: g.startDate, start: true }, ...ms];
    return `<div class="page-head"><div><h1>Cap sur ${U.num(g.goal)} kg</h1><div class="sub">Un repère personnel pour ${U.fmtMonth(g.goalDate).toLowerCase()}, pas une obligation : ce qui compte, c'est la direction et la régularité.</div></div>
      <div class="actions"><a class="btn" href="#reglages">${U.icon('sliders', 'sm')}Ajuster l'objectif</a></div></div>
    <div class="grid g-dash">
      <section class="card span-5"><div class="gauge-wrap" style="max-width:340px">${Charts.gauge({ pct: prog.pct, nodes: nodes.map(n => ({ ...n, label: U.num(n.kg) })) })}
        <div class="gauge-center"><span class="cap">Moyenne 7 j</span><span class="big">${U.kg(prog.ref)}<span class="unit">kg</span></span><span class="pct">${U.num(prog.pct * 100)} %</span></div></div>
        <div class="grid g-3" style="gap:12px;margin-top:6px">
          <div class="kpi center"><span class="v good-c">${U.sign(-prog.lost)}</span><span class="l">kg depuis le départ</span></div>
          <div class="kpi center"><span class="v">${U.kg(prog.remaining)}</span><span class="l">kg restants</span></div>
          <div class="kpi center"><span class="v">${Math.max(0, Math.round(U.diffDays(U.today(), g.goalDate) / 7))}</span><span class="l">semaines</span></div></div>
      </section>
      <section class="card span-7"><div class="card-h"><div><div class="eyebrow">Rythme</div><h2>Où tu en es, où tu vas</h2></div></div>
        <div class="grid g-3" style="gap:12px;margin-bottom:14px">
          <div class="kpi"><span class="l">Rythme réel (4 sem.)</span><span class="v">${rate != null ? U.sign(rate, 2) : '–'}<small>kg/sem</small></span><span class="d faint">${rate == null ? 'Pas encore assez de pesées' : 'moyenne lissée'}</span></div>
          <div class="kpi"><span class="l">Rythme repère</span><span class="v">${req != null ? '−' + U.num(req, 2) : '–'}<small>kg/sem</small></span><span class="d faint">pour ${U.fmtMonth(g.goalDate).toLowerCase()}</span></div>
          <div class="kpi"><span class="l">Estimation à ce rythme</span><span class="v" style="font-size:22px">${proj ? U.fmtMonth(proj) : '–'}</span><span class="d faint">indicative, change avec toi</span></div></div>
        <div id="goal-chart" data-h="230"></div>
        <p class="hint">Ligne pointillée : repère linéaire entre ton départ et l'objectif. Au-dessus ou en dessous de quelques kilos, c'est normal : la perte n'est jamais parfaitement régulière. Un rythme de 0,5 à 1 % du poids par semaine permet généralement de préserver la masse musculaire.</p>
      </section>
      <section class="card span-12"><div class="card-h"><div><div class="eyebrow">Timeline</div><h2>Mois après mois</h2></div><span class="spacer"></span><span class="xs faint">Moyenne des pesées du mois</span></div>
        <div class="tl" id="tl">${months.map(mo => `<div class="tl-m ${mo.state} ${mo.isGoal ? 'goalm' : ''}"><span class="mn">${U.fmtMonth(mo.month)}</span>
          ${mo.avg != null ? `<span class="mv">${U.kg(mo.avg)}<span class="unit">kg</span></span><span class="md ${mo.delta == null ? 'faint' : mo.delta < 0 ? 'good-c' : 'goal-c'}">${mo.delta == null ? `${mo.count} pesée${mo.count > 1 ? 's' : ''}` : U.sign(mo.delta) + ' kg'}</span>`
            : mo.state === 'future' ? `<span class="mv faint" style="font-size:20px">${mo.isGoal ? U.num(prog.g.goal) + ' kg' : '—'}</span><span class="md faint">${mo.isGoal ? 'objectif' : `repère ${U.num(mo.plan)} kg`}</span>` : `<span class="mv faint" style="font-size:20px">—</span><span class="md faint">aucune pesée</span>`}
          ${mo.reached.map(r => `<span class="ms">${U.icon('flag', 'sm')}${U.num(r.kg)} kg</span>`).join('')}</div>`).join('')}</div>
      </section>
      <section class="card span-5"><div class="card-h"><div><div class="eyebrow">Paliers</div><h2>${ms.filter(m => m.date).length} / ${ms.length} franchis</h2></div></div>
        <div class="ladder">${rungs.map((r, i) => { const on = r.start || !!r.date; const next = !r.start && i - 1 === nextIdx; return `<div class="rung ${on ? 'on' : ''} ${next ? 'next' : ''} ${r.goal ? 'goal' : ''}"><span class="kg">${U.num(r.kg)}</span><span class="node"></span><span class="info">${r.start ? `<b>Départ</b> · ${U.fmtFull(r.date)}` : r.date ? `<b>Franchi</b> le ${U.fmtFull(r.date)}` : next ? `<b>Prochain palier</b> · encore ${U.kg(Math.max(0, prog.ref - r.kg))} kg` : r.goal ? '<b>Objectif</b>' : `encore ${U.kg(Math.max(0, prog.ref - r.kg))} kg`}</span>${on && !r.start ? `<span class="pill done">${U.icon('check', 'sm')}</span>` : ''}</div>`; }).join('')}</div>
        <p class="hint">Un palier est validé quand ta <b>moyenne sur 7 jours</b> passe dessous : une pesée isolée ne suffit pas, une remontée passagère ne l'efface pas.</p>
      </section>
      <section class="card span-7"><div class="card-h"><div><div class="eyebrow">Jalons</div><h2>${unlocked} / ${badges.length} débloqués</h2></div></div>
        <div class="badges">${badges.map(b => `<div class="badge ${b.on ? 'on' : ''}"><span class="md">${U.icon(b.on ? b.icon : 'lock')}</span><span class="bt">${U.esc(b.label)}</span><span class="bd">${b.on ? (b.date ? 'Obtenu le ' + U.fmtShort(b.date) : 'Obtenu') : U.esc(b.desc)}</span>${b.on ? '' : `${UI.bar(b.pct, 'var(--goal)')}<span class="bd">${U.num(Math.min(b.v, b.goal), b.unit === 'kg' || b.unit === 'km' ? 1 : 0)} / ${U.num(b.goal)}${b.unit ? ' ' + b.unit : ''}</span>`}</div>`).join('')}</div>
      </section>
    </div>`;
  },
  mount(root) {
    if (D.isMaintain()) { D.maintainMount(root); return; }
    weightChart(root.querySelector('#goal-chart'), { period: 'all', layers: { raw: false, avg: true, trend: false, plan: true } });
    const tl = root.querySelector('#tl'), cur = tl && tl.querySelector('.current');
    if (cur) tl.scrollLeft = Math.max(0, cur.offsetLeft - tl.offsetLeft - 20);
  }
};
