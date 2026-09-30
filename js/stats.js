'use strict';
/* Cap 100 — statistiques par période */

Pages.stats = {
  title: 'Statistiques',
  nav: 'stats',
  period: '90',
  exId: null,
  measure: 'waist',
  range() {
    const today = U.today();
    if (this.period === 'all') {
      const cands = [D.goal().startDate, ...D.weights().slice(0, 1).map(w => w.date), ...D.doneActs().slice(0, 1).map(a => a.date)];
      const m = DB.all('meals').reduce((a, x) => x.date < a ? x.date : a, today);
      cands.push(m);
      return [cands.reduce((a, b) => b < a ? b : a, today), today];
    }
    return [U.addDays(today, -(+this.period) + 1), today];
  },
  buckets() {
    const [from, to] = this.range();
    const span = U.diffDays(from, to) + 1;
    const gran = span <= 31 ? 'day' : span <= 200 ? 'week' : 'month';
    const out = [];
    if (gran === 'day') U.range(from, to).forEach(d => out.push({ a: d, b: d, label: span <= 7 ? U.dayShort(U.dow(d)) : String(U.parse(d).getDate()), name: U.fmtLong(d) }));
    else if (gran === 'week') for (let w = U.weekStart(from); w <= to; w = U.addDays(w, 7)) out.push({ a: w < from ? from : w, b: U.addDays(w, 6) > to ? to : U.addDays(w, 6), label: U.fmtShort(w), name: `Semaine du ${U.fmtShort(w)}` });
    else for (let m = U.monthStart(from); m <= to; m = U.addMonths(m, 1)) out.push({ a: m < from ? from : m, b: U.monthEnd(m) > to ? to : U.monthEnd(m), label: U.cap(U.fmtMonthShort(m)), name: U.fmtMonth(m) });
    return { gran, out };
  },
  render() {
    const [from, to] = this.range();
    const days = U.range(from, to);
    const acts = D.doneActs().filter(a => a.date >= from && a.date <= to);
    const logged = days.filter(d => D.dayTotals(d).count);
    const steps = days.map(d => D.day(d).steps).filter(Boolean);
    const w = D.weightSeries().filter(p => p.date >= from && p.date <= to);
    const dW = w.length > 1 ? w[w.length - 1].avg7 - w[0].avg7 : null;
    const exs = D.exercises().filter(e => D.exHistory(e.id).length);
    if (!this.exId || !exs.find(e => e.id === this.exId)) this.exId = exs.length ? exs.sort((a, b) => D.exHistory(b.id).length - D.exHistory(a.id).length || Math.max(...D.exHistory(b.id).map(x => x.e1rm)) - Math.max(...D.exHistory(a.id).map(x => x.e1rm)))[0].id : null;
    const hasMeas = DB.all('measurements').length > 0;
    const k = (l, v, u = '', sub = '') => `<div class="card flat"><div class="kpi"><span class="l">${l}</span><span class="v">${v}${u ? `<small>${u}</small>` : ''}</span>${sub ? `<span class="d faint">${sub}</span>` : ''}</div></div>`;
    return `<div class="page-head"><div><h1>Statistiques</h1><div class="sub">${U.fmtFull(from)} → ${U.fmtFull(to)}</div></div>
      <div class="actions"><div class="seg">${[['30', '30 j'], ['90', '3 mois'], ['180', '6 mois'], ['365', '1 an'], ['all', 'Tout']].map(([v, l]) => `<button data-act="statPeriod" data-v="${v}" class="${this.period === v ? 'on' : ''}">${l}</button>`).join('')}</div></div></div>
    <div class="grid g-4" style="margin-bottom:18px">
      ${k('Poids (moy. 7 j)', dW != null ? U.sign(dW) : '–', 'kg', w.length ? `${U.kg(w[0].avg7)} → ${U.kg(w[w.length - 1].avg7)} kg` : 'aucune pesée')}
      ${k('Séances', acts.length, '', `${acts.filter(a => a.type === 'strength').length} en renforcement`)}
      ${k('Temps de sport', U.dur(U.sum(acts.map(a => a.duration || 0))), '', `${U.num(U.sum(acts.map(a => a.distance || 0)), 1)} km parcourus`)}
      ${k('Calories moyennes', logged.length ? U.num(U.avg(logged.map(d => D.dayTotals(d).kcal))) : '–', 'kcal', `${logged.length} jours notés · P ${logged.length ? U.num(U.avg(logged.map(d => D.dayTotals(d).p))) : '–'} g`)}
    </div>
    <div class="grid g-dash">
      <section class="card span-8"><div class="card-h"><div><div class="eyebrow">Poids</div><h2>Évolution</h2></div></div><div id="st-w" data-h="240"></div></section>
      <section class="card span-4"><div class="card-h"><div><div class="eyebrow">Pas</div><h2>${steps.length ? U.num(U.avg(steps)) + ' / jour' : 'Pas'}</h2></div></div><div id="st-steps" data-h="240"></div></section>
      <section class="card span-6"><div class="card-h"><div><div class="eyebrow">Alimentation</div><h2>Calories moyennes</h2></div></div><div id="st-kcal" data-h="200"></div></section>
      <section class="card span-6"><div class="card-h"><div><div class="eyebrow">Alimentation</div><h2>Protéines moyennes</h2></div></div><div id="st-prot" data-h="200"></div></section>
      <section class="card span-6"><div class="card-h"><div><div class="eyebrow">Activité</div><h2>Temps de sport</h2></div></div><div id="st-time" data-h="200"></div><div class="legend" style="margin-top:8px">${Object.entries(D.ACT).filter(([kk]) => acts.some(a => a.type === kk)).map(([kk, t]) => `<span><i class="dotl" style="--c:${t.c}"></i>${t.label}</span>`).join('')}</div></section>
      <section class="card span-6"><div class="card-h"><div><div class="eyebrow">Activité</div><h2>Séances et distance</h2></div></div><div id="st-sess" data-h="200"></div></section>
      <section class="card span-${hasMeas ? 6 : 12}"><div class="card-h"><div><div class="eyebrow">Renforcement</div><h2>Progression d'un exercice</h2></div><span class="spacer"></span>
        ${exs.length ? `<select class="input" style="width:auto;max-width:220px;height:36px;font-size:14px" data-change="statEx" id="st-ex-sel">${exs.map(e => `<option value="${e.id}" ${e.id === this.exId ? 'selected' : ''}>${U.esc(e.name)}</option>`).join('')}</select>` : ''}</div>
        <div id="st-ex" data-h="200">${exs.length ? '' : UI.empty('dumbbell', 'Aucune donnée', 'Réalise une séance en mode guidé pour suivre tes charges.')}</div></section>
      ${hasMeas ? `<section class="card span-6"><div class="card-h"><div><div class="eyebrow">Mensurations</div><h2>Évolution</h2></div><span class="spacer"></span><select class="input" style="width:auto;height:36px;font-size:14px" data-change="statMeas" id="st-m-sel">${D.MEASURES.map(m => `<option value="${m.id}" ${m.id === this.measure ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div><div id="st-meas" data-h="200"></div></section>` : ''}
    </div>`;
  },
  mount(root) {
    const [from, to] = this.range();
    const { gran, out } = this.buckets();
    const tg = D.targets();
    const per = gran === 'day' ? '' : gran === 'week' ? ' (moyenne de la semaine)' : ' (moyenne du mois)';
    weightChart(root.querySelector('#st-w'), { period: this.period === 'all' ? 'all' : this.period, layers: { raw: true, avg: true, trend: false, plan: true } });
    // Calories / protéines : moyenne des jours notés du bucket
    const nut = out.map(b => { const ds = U.range(b.a, b.b).filter(d => D.dayTotals(d).count); return { ...b, n: ds.length, kcal: U.avg(ds.map(d => D.dayTotals(d).kcal)) || 0, p: U.avg(ds.map(d => D.dayTotals(d).p)) || 0 }; });
    const emptyNut = UI.empty('food', 'Aucun repas noté', 'Les moyennes apparaîtront dès les premiers repas enregistrés.');
    Charts.bars(root.querySelector('#st-kcal'), { height: 200, empty: emptyNut, target: { v: tg.kcal, label: 'cible' }, data: nut.map(b => ({ label: b.label, total: Math.round(b.kcal), color: 'var(--c-food)', tip: `${b.name}<br><b>${U.num(b.kcal)} kcal</b>${per}<div class="xs" style="opacity:.8">${b.n} jour${b.n > 1 ? 's' : ''} noté${b.n > 1 ? 's' : ''}</div>` })) });
    Charts.bars(root.querySelector('#st-prot'), { height: 200, empty: emptyNut, target: { v: tg.protein, label: 'cible' }, data: nut.map(b => ({ label: b.label, total: Math.round(b.p), color: 'var(--c-strength)', tip: `${b.name}<br><b>${U.num(b.p)} g</b>${per}` })) });
    // Temps de sport empilé par type
    const acts = D.doneActs().filter(a => a.date >= from && a.date <= to);
    const time = out.map(b => { const arr = acts.filter(a => a.date >= b.a && a.date <= b.b); const segs = Object.entries(D.ACT).map(([k, t]) => ({ v: U.sum(arr.filter(a => a.type === k).map(a => a.duration || 0)), c: t.c, name: t.label })); return { label: b.label, total: U.sum(segs.map(s => s.v)), segs, tip: `${b.name}<br><b>${U.dur(U.sum(segs.map(s => s.v)))}</b>${segs.filter(s => s.v).map(s => `<div class="tr xs"><i style="background:${s.c}"></i>${s.name} · ${U.dur(s.v)}</div>`).join('')}` }; });
    const emptyAct = UI.empty('pulse', 'Aucune activité', 'Tes séances réalisées apparaîtront ici.');
    Charts.bars(root.querySelector('#st-time'), { height: 200, empty: emptyAct, data: time, stepUnit: 60, yFmt: v => v >= 60 ? U.num(v / 60, v % 60 ? 1 : 0) + ' h' : U.num(v) + ' min' });
    Charts.bars(root.querySelector('#st-sess'), { height: 200, empty: emptyAct, data: out.map(b => { const arr = acts.filter(a => a.date >= b.a && a.date <= b.b); const km = U.sum(arr.map(a => a.distance || 0)); return { label: b.label, total: arr.length, color: 'var(--accent)', tip: `${b.name}<br><b>${arr.length} séance${arr.length > 1 ? 's' : ''}</b><div class="xs" style="opacity:.8">${U.num(km, 1)} km</div>` }; }), yFmt: v => U.num(v, v % 1 ? 1 : 0), minMax: 2 });
    // Pas : moyenne par bucket
    const st = out.map(b => { const v = U.range(b.a, b.b).map(d => D.day(d).steps).filter(Boolean); return { label: b.label, total: Math.round(U.avg(v) || 0), color: 'var(--c-bike)', tip: `${b.name}<br><b>${U.num(U.avg(v) || 0)} pas</b>${gran === 'day' ? '' : ' / jour'}` }; });
    Charts.bars(root.querySelector('#st-steps'), { height: 240, empty: UI.empty('steps', 'Aucun pas noté', 'Recopie le total de ton téléphone depuis le calendrier ou l\'ajout rapide.'), data: st, target: { v: tg.steps, label: '' }, yFmt: v => v >= 1000 ? U.num(v / 1000, v % 1000 ? 1 : 0) + ' k' : U.num(v) });
    // Exercice
    const exEl = root.querySelector('#st-ex');
    if (this.exId) {
      const ex = D.exercise(this.exId);
      const h = D.exHistory(this.exId).filter(x => this.period === 'all' || x.date >= from);
      if (h.length) Charts.line(exEl, { height: 200, label: ex.name, series: [{ name: ex.name, color: 'var(--c-strength)', style: 'area', dots: true, endDot: true, points: h.map(x => ({ x: x.date, y: ex.kind === 'weight' ? +x.e1rm.toFixed(1) : x.totalReps })) }], minRange: 4, tip: (d, v) => { const x = h.find(q => q.date === d); return `${U.fmtShort(d)}<br><b>${ex.kind === 'weight' ? U.num(x.e1rm, 1) + ' kg' : x.totalReps + (ex.kind === 'time' ? ' s' : ' rép.')}</b><div class="xs" style="opacity:.8">${U.esc(D.setsLabel(x.sets, ex.kind))}</div>`; } });
      else exEl.innerHTML = '<p class="faint small">Pas de séance sur cette période.</p>';
    }
    const mEl = root.querySelector('#st-meas');
    if (mEl) {
      const pts = DB.all('measurements').filter(r => r[this.measure] != null).sort((a, b) => a.date < b.date ? -1 : 1).map(r => ({ x: r.date, y: r[this.measure] }));
      if (pts.length) Charts.line(mEl, { height: 200, label: 'Mensuration', series: [{ name: 'cm', color: 'var(--c-bike)', dots: true, endDot: true, points: pts }], minRange: 4, tip: (d, v) => `${U.fmtFull(d)}<br><b>${U.num(v[0].p.y, 1)} cm</b>` });
      else mEl.innerHTML = '<p class="faint small">Pas de valeur pour cette mesure.</p>';
    }
  }
};
A.statPeriod = el => { Pages.stats.period = el.dataset.v; App.renderView(false); };
A.statEx = el => { Pages.stats.exId = el.value; App.renderView(false); };
A.statMeas = el => { Pages.stats.measure = el.value; App.renderView(false); };
