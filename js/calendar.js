'use strict';
/* Cap 100 — calendrier mensuel interactif */

Pages.calendar = {
  title: 'Calendrier',
  nav: 'calendrier',
  month: null,
  sel: null,
  filter: 'all',
  render() {
    const today = U.today();
    if (!this.month) this.month = U.monthStart(today);
    const m = this.month;
    const start = U.weekStart(m);
    const endM = U.monthEnd(m);
    const weeks = Math.ceil((U.diffDays(start, endM) + 1) / 7);
    const days = U.range(start, U.addDays(start, weeks * 7 - 1));
    const f = this.filter;
    const cells = days.map(d => {
      const out = d.slice(0, 7) !== m.slice(0, 7);
      const acts = f === 'food' ? [] : D.actsOn(d);
      const w = f === 'all' || f === 'body' ? DB.get('weights', d) : null;
      const day = D.day(d);
      const tot = D.dayTotals(d);
      const shown = acts.slice(0, 3);
      const cls = ['cell', out ? 'out' : '', d === today ? 'today' : '', d === this.sel ? 'sel' : '', day.rest && !acts.some(a => a.status === 'done') ? 'rest' : ''].join(' ');
      const dots = [];
      if ((f === 'all' || f === 'food') && tot.count) dots.push(`<i style="--c:var(--c-food)" title="Alimentation notée"></i>`);
      if ((f === 'all' || f === 'body') && w) dots.push(`<i style="--c:var(--c-weight)" title="Pesée"></i>`);
      if (f === 'all' && (day.steps || 0) >= D.targets().steps) dots.push(`<i style="--c:var(--c-bike)" title="Objectif de pas atteint"></i>`);
      if (f === 'all' && (day.note || day.mood)) dots.push(`<i style="--c:var(--goal)" title="Note ou ressenti"></i>`);
      const label = `${U.fmtLong(d)}${acts.length ? ', ' + acts.map(a => D.actTitle(a) + ' ' + D.STATUS[a.status].toLowerCase()).join(', ') : ''}`;
      return `<button class="${cls}" data-act="calDay" data-date="${d}" aria-label="${U.esc(label)}">
        <div class="top"><span class="dn">${U.parse(d).getDate()}</span>${w ? `<span class="wt">${U.kg(w.kg)}</span>` : ''}</div>
        <div class="evs">${shown.map(a => { const t = D.ACT[a.type] || D.ACT.other; return `<span class="ev ${a.status}" style="--c:${t.c}">${U.icon(t.icon)}<span>${U.esc(D.actTitle(a))}</span></span>`; }).join('')}${acts.length > 3 ? `<span class="more">+${acts.length - 3}</span>` : ''}</div>
        <div class="foot">${dots.join('')}</div></button>`;
    }).join('');
    // Synthèse du mois
    const mDays = U.range(m, endM).filter(d => d <= today);
    const mActs = U.range(m, endM).flatMap(d => D.actsOn(d));
    const done = mActs.filter(a => a.status === 'done');
    const upcoming = D.acts().filter(a => a.status === 'planned' && a.date >= today).slice(0, 6);
    const missed = D.acts().filter(a => a.status === 'planned' && a.date < today).slice(-4);
    const wMonth = D.weights().filter(x => x.date >= m && x.date <= endM);
    return `<div class="page-head"><div><h1>Calendrier</h1><div class="sub">Touchez un jour pour voir le détail ou ajouter quelque chose.</div></div>
      <div class="actions"><button class="btn" data-act="calPlan">${U.icon('calendar', 'sm')}Programmer une séance</button></div></div>
    <div class="grid g-dash">
      <section class="card span-8">
        <div class="cal-head"><button class="icon-btn" data-act="calNav" data-d="-1" aria-label="Mois précédent">${U.icon('chevL')}</button><h2>${U.fmtMonth(m)}</h2><button class="icon-btn" data-act="calNav" data-d="1" aria-label="Mois suivant">${U.icon('chevR')}</button>
          <button class="btn sm" data-act="calToday">Aujourd'hui</button><span class="grow"></span>
          <div class="seg">${[['all', 'Tout'], ['sport', 'Sport'], ['food', 'Repas'], ['body', 'Poids']].map(([v, l]) => `<button data-act="calFilter" data-v="${v}" class="${f === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="cal">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(x => `<div class="dow">${x}</div>`).join('')}${cells}</div>
        <div class="cal-legend">
          ${['strength', 'run', 'walk', 'bike', 'swim', 'hike'].map(k => `<span><i class="dot" style="color:${D.ACT[k].c}"></i>${D.ACT[k].label}</span>`).join('')}
          <span><i class="dot" style="color:var(--c-food)"></i>Alimentation notée</span><span><i class="dot" style="color:var(--c-weight)"></i>Pesée</span>
          <span><i class="lg-planned"></i>Prévu</span><span><i class="lg-done"></i>Réalisé</span><span><i class="lg-rest"></i>Repos</span><span><i class="lg-cancel"></i>Annulé</span>
        </div>
      </section>
      <div class="span-4 stack">
        <section class="card"><div class="card-h"><div><div class="eyebrow">${U.fmtMonth(m)}</div><h2>Bilan du mois</h2></div></div>
          <div class="grid g-2" style="gap:14px 12px">
            <div class="kpi"><span class="v">${mDays.filter(D.isActiveDay).length}<small>/ ${mDays.length} j</small></span><span class="l">Jours actifs</span></div>
            <div class="kpi"><span class="v">${done.length}</span><span class="l">Séances réalisées</span></div>
            <div class="kpi"><span class="v">${U.num(U.sum(done.map(a => a.distance || 0)), 1)}<small>km</small></span><span class="l">Distance</span></div>
            <div class="kpi"><span class="v">${mDays.filter(d => D.dayTotals(d).count).length}<small>j</small></span><span class="l">Alimentation notée</span></div>
            <div class="kpi"><span class="v">${U.dur(U.sum(done.map(a => a.duration || 0)))}</span><span class="l">Temps d'activité</span></div>
            <div class="kpi"><span class="v">${wMonth.length > 1 ? U.sign(wMonth[wMonth.length - 1].kg - wMonth[0].kg) : '–'}<small>kg</small></span><span class="l">Variation du poids</span></div>
          </div></section>
        <section class="card"><div class="card-h"><div><div class="eyebrow">Planning</div><h2>À venir</h2></div><span class="spacer"></span><button class="btn sm" data-act="calPlan">${U.icon('plus', 'sm')}</button></div>
          ${upcoming.length ? `<div class="list">${upcoming.map(a => { const t = D.ACT[a.type] || D.ACT.other; return `<div class="li act" data-act="actOpen" data-id="${a.id}"><span class="ic-badge planned" style="--c:${t.c}">${U.icon(t.icon)}</span><span class="grow"><span class="t">${U.esc(D.actTitle(a))}</span><span class="s">${U.relDay(a.date)}${a.time ? ' · ' + a.time.replace(':', 'h') : ''}</span></span>${a.type === 'strength' && a.date === today ? `<button class="btn sm primary" data-act="actStart" data-id="${a.id}">${U.icon('play', 'sm')}</button>` : ''}</div>`; }).join('')}</div>`
            : UI.empty('calendar', 'Rien de programmé', 'Programme tes prochaines séances pour les retrouver ici et dans le calendrier.')}
          ${missed.length ? `<div class="eyebrow" style="margin-top:14px">Prévu, pas encore validé</div><div class="list">${missed.map(a => actRow(a, true)).join('')}</div>` : ''}
        </section>
      </div>
    </div>`;
  }
};
A.calNav = el => { const c = Pages.calendar; c.month = U.addMonths(c.month, +el.dataset.d); App.renderView(); };
A.calToday = () => { const c = Pages.calendar; c.month = U.monthStart(U.today()); c.sel = U.today(); App.renderView(); F.day(U.today()); };
A.calFilter = el => { Pages.calendar.filter = el.dataset.v; App.renderView(false); };
A.calDay = el => { Pages.calendar.sel = el.dataset.date; U.$$('.cell.sel').forEach(c => c.classList.remove('sel')); el.classList.add('sel'); F.day(el.dataset.date); };
A.calPlan = () => { const s = Pages.calendar.sel; F.activity({ date: s && s >= U.today() ? s : U.addDays(U.today(), 1), status: 'planned', type: 'strength' }); };
