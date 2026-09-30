'use strict';
/* Cap 100 — coach : modèle de dépense, prévisions, suggestions et conseils.
   Toutes les valeurs sont des estimations calculées localement à partir de tes données. */

/* ---------- Modèle de dépense énergétique ---------- */
D.weightOn = date => { const s = D.weightSeries(); let w = null; for (const p of s) { if (p.date > date) break; w = p.trend; } return w || (s.length ? s[0].trend : D.goal().start); };
D.bmr = (w = D.bodyWeight()) => { const p = D.profile(); return 10 * w + 6.25 * (p.height || 185) - 5 * (p.age || 25) + (p.sex === 'f' ? -161 : 5); };
D.STEP_K = 0.0004; // kcal par pas et par kg (marche à allure normale)
D.recentSteps = () => D.memo('recentSteps', () => { const t = U.today(); const v = U.range(U.addDays(t, -14), U.addDays(t, -1)).map(d => D.day(d).steps).filter(Boolean); return v.length >= 3 ? U.avg(v) : 5000; });
/* Dépense estimée d'une journée : métabolisme × 1,15 + pas + activités (hors marche si les pas sont notés) */
D.dayExpenditureRaw = (date, withPlanned = false) => {
  const w = D.weightOn(date);
  const base = D.bmr(w) * 1.15;
  const day = D.day(date);
  const today = U.today();
  const stepsKnown = !!day.steps;
  const steps = date === today ? Math.max(day.steps || 0, D.recentSteps()) : (day.steps || D.recentSteps());
  const stepK = steps * D.STEP_K * w;
  const acts = D.actsOn(date).filter(a => a.status === 'done' || a.status === 'progress' || (withPlanned && a.status === 'planned' && date >= today));
  const actK = U.sum(acts.filter(a => !(a.type === 'walk' && stepsKnown)).map(a => (a.kcal || D.estimateKcal(a.type, a.duration || 45, a.intensity || 3, a.distance, w) || 0) * (1 - 1 / (D.ACT[a.type] || D.ACT.other).met)));
  return { base, stepK, actK, steps, stepsKnown, total: base + stepK + actK, planned: acts.some(a => a.status === 'planned') };
};
/* Calibration : compare la dépense réelle (apports + variation de la tendance du poids) au modèle */
D.calibration = () => D.memo('calib', () => {
  const s = D.weightSeries(); const today = U.today();
  if (s.length < 6) return null;
  const end = U.addDays(today, -1);
  let start = U.addDays(end, -27);
  if (start < s[0].date) start = s[0].date;
  const span = U.diffDays(start, end);
  if (span < 13) return null;
  const days = U.range(start, end);
  const logged = days.filter(d => D.dayTotals(d).count >= 2);
  if (logged.length < 10) return { need: 10 - logged.length, logged: logged.length, span };
  const w0 = D.weightOn(start), w1 = D.weightOn(end);
  const intake = U.avg(logged.map(d => D.dayTotals(d).kcal));
  const tdee = intake - (w1 - w0) * 7700 / span;
  const model = U.avg(logged.map(d => D.dayExpenditureRaw(d).total));
  const ratio = logged.length / days.length;
  return { tdee, model, intake, k: U.clamp(tdee / model, 0.8, 1.2), logged: logged.length, span, conf: ratio > 0.8 && span >= 21 ? 'bonne' : ratio > 0.55 ? 'moyenne' : 'faible', dW: w1 - w0 };
});
D.calK = () => { const c = D.calibration(); return c && c.k ? c.k : 1; };
D.dayExpenditure = (date, withPlanned = false) => { const r = D.dayExpenditureRaw(date, withPlanned); const k = D.calK(); return { ...r, k, total: r.total * k }; };
D.plannedDeficit = () => { const p = D.profile(); const kgw = (D.PACES.find(x => x.id === p.pace) || D.PACES[1]).kgw; return kgw * 7700 / 7; };
/* Objectif calorique du jour : fixe, ou adapté aux activités si l'option est activée */
D.kcalTarget = date => {
  const tg = D.targets();
  if (!DB.setting('prefs', {}).dynamicTarget) return tg.kcal;
  return D.memo('kt-' + date, () => {
    const e = D.dayExpenditure(date, true).total;
    const def = Math.min(D.plannedDeficit(), e * 0.25);
    return Math.max(U.round(D.bmr(D.weightOn(date)), 50), U.round(e - def, 50));
  });
};

/* ---------- Bilan de la semaine ---------- */
D.weekBalance = ws => D.memo('wb-' + ws, () => {
  const today = U.today();
  const avgIntake = (() => { const v = U.range(U.addDays(today, -14), U.addDays(today, -1)).map(d => D.dayTotals(d)).filter(t => t.count >= 2).map(t => t.kcal); return v.length >= 3 ? U.avg(v) : null; })();
  const rows = U.range(ws, U.addDays(ws, 6)).map(d => {
    const e = D.dayExpenditure(d, d >= today);
    const t = D.dayTotals(d);
    const plan = D.planDayTotals(d);
    let intake = null, kind = 'none';
    if (d < today && t.count >= 2) { intake = t.kcal; kind = 'logged'; }
    else if (d === today) { intake = Math.max(t.kcal, plan.kcal || 0) || null; kind = t.count ? 'partial' : (plan.kcal ? 'planned' : 'none'); if (!intake && avgIntake) { intake = avgIntake; kind = 'avg'; } }
    else if (d > today) { if (plan.kcal) { intake = plan.kcal; kind = 'planned'; } else if (avgIntake) { intake = avgIntake; kind = 'avg'; } }
    return { d, e: e.total, intake, kind, bal: intake != null ? e.total - intake : null, future: d > today };
  });
  const known = rows.filter(r => r.kind === 'logged');
  const all = rows.filter(r => r.bal != null);
  return { rows, pastDef: U.sum(known.map(r => r.bal)), totalDef: U.sum(all.map(r => r.bal)), known: known.length, counted: all.length };
});

/* ---------- Projection du poids ---------- */
D.coachRate = () => {
  const r = D.rate();
  if (r != null) return { rate: r, src: 'tendance des 4 dernières semaines' };
  const c = D.calibration();
  if (c && c.intake) return { rate: -(c.tdee - c.intake) * 7 / 7700, src: 'bilan apports / dépense' };
  const p = D.profile(); const kgw = (D.PACES.find(x => x.id === p.pace) || D.PACES[1]).kgw;
  return { rate: -kgw, src: 'rythme choisi dans ton profil (pas encore assez de données)' };
};
/* Simulation jour par jour : le déficit diminue un peu à mesure que le poids baisse (≈ 15 kcal/j par kg perdu) */
D.simulate = ({ extraKcal = 0, rate = D.coachRate().rate, maxDays = 1100 } = {}) => {
  const cur = D.current(); const g = D.goal();
  const w0 = cur ? cur.trend : g.start; const d0 = cur ? cur.date : U.today();
  const def0 = -rate * 7700 / 7 + extraKcal;
  const pts = [{ x: d0, y: w0 }];
  let w = w0, goalDate = null;
  for (let i = 1; i <= maxDays; i++) {
    const def = def0 - 15 * (w0 - w);
    w -= def / 7700;
    if (!goalDate && w <= g.goal) goalDate = U.addDays(d0, i);
    if (i % 7 === 0) pts.push({ x: U.addDays(d0, i), y: +w.toFixed(2) });
    if (goalDate && i > U.diffDays(d0, goalDate) + 28) break;
    if (def <= 0 && w > g.goal && i > 60) break;
  }
  const at = date => { const n = U.diffDays(d0, date); if (n <= 0) return w0; let ww = w0; for (let i = 1; i <= n; i++) ww -= (def0 - 15 * (w0 - ww)) / 7700; return ww; };
  return { pts, goalDate, at, w0, d0, def0 };
};

/* ---------- Renforcement : charge suggérée ---------- */
D.suggestLoad = exId => {
  const ex = D.exercise(exId);
  const h = D.exHistory(exId);
  if (!h.length) return null;
  const last = h[h.length - 1];
  const act = DB.get('activities', last.actId);
  const exo = act && act.exercises ? act.exercises.find(e => e.exId === exId) : null;
  const target = exo && exo.target && exo.target.reps ? exo.target.reps : Math.max(...last.sets.map(s => s.reps || 0));
  const sets = last.sets;
  const allHit = sets.every(s => (s.reps || 0) >= target);
  const missed = sets.filter(s => (s.reps || 0) < target - 1).length;
  const minDone = Math.min(...sets.map(s => s.reps || 0));
  if (ex.kind === 'reps') { if (!allHit) return null; if (minDone >= 20) return { reps: minDone, kg: null, delta: 'variante plus dure', why: 'plus de 20 répétitions : passe à une variante plus difficile ou ajoute un haltère', up: true }; return { reps: minDone + 1, kg: null, delta: '+1 rép.', why: `${minDone} répétitions réussies sur chaque série la dernière fois`, up: true }; }
  if (ex.kind === 'time') return allHit ? { reps: minDone + 5, kg: null, delta: '+5 s', why: 'toutes les séries tenues la dernière fois', up: true } : null;
  const kg = last.topKg;
  if (!kg) return null;
  if (allHit) {
    const inc = (ex.eq || []).includes('kettlebell') ? 4 : kg < 10 ? 1 : 2;
    return { kg: kg + inc, reps: target, delta: `+${U.num(inc, inc % 1 ? 1 : 0)} kg`, why: 'toutes les séries réussies la dernière fois', up: true };
  }
  if (h.length >= 2) {
    const prev = h[h.length - 2];
    const prevMiss = prev.sets.filter(s => (s.reps || 0) < target - 1).length;
    if (missed >= 2 && prevMiss >= 2 && prev.topKg === kg) { const nk = Math.round(kg * 0.9 / 2.5) * 2.5; return { kg: nk, reps: target, delta: `−${U.num(kg - nk, 1)} kg`, why: 'deux séances difficiles d\'affilée : on allège pour repartir', down: true }; }
  }
  return { kg, reps: target, delta: 'même charge', why: 'consolide avant d\'augmenter', keep: true };
};

/* ---------- Course : prédictions (formule de Riegel) ---------- */
D.runPredict = () => {
  const t = U.today();
  const runs = D.doneActs().filter(a => a.type === 'run' && a.distance >= 2.5 && a.duration && a.date >= U.addDays(t, -90));
  if (!runs.length) return null;
  const best = runs.map(a => ({ a, t5: a.duration * Math.pow(5 / a.distance, 1.06) })).sort((x, y) => x.t5 - y.t5)[0];
  const pred = km => best.a.duration * Math.pow(km / best.a.distance, 1.06);
  return { from: best.a, k5: pred(5), k10: pred(10), semi: pred(21.1) };
};
U.hms = min => { const s = Math.round(min * 60); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60; return h ? `${h} h ${U.pad(m)}` : `${m}'${U.pad(ss)}"`; };

/* ---------- Conseils ---------- */
D.TIPS = [
  ['scale', 'Le poids varie de ±1 kg d\'un jour à l\'autre (eau, sel, glucides). Regarde la moyenne sur 7 jours, pas la pesée du jour.'],
  ['food', 'Une assiette simple : la moitié en légumes, un quart en protéines, un quart en féculents.'],
  ['moon', 'Dormir moins de 6 h augmente la faim le lendemain. Le sommeil fait partie du programme.'],
  ['bolt', 'Répartir les protéines sur 3 à 4 repas (25 à 40 g chacun) aide à préserver la masse musculaire.'],
  ['droplet', 'Un grand verre d\'eau avant le repas aide à mieux percevoir la satiété.'],
  ['walk', '10 minutes de marche après chaque repas, c\'est environ 3 000 pas de plus par jour, sans effort de motivation.'],
  ['dumbbell', 'Augmente la charge seulement quand toutes les séries sont réussies : c\'est ce qui rend la progression durable.'],
  ['body', 'Sans salle, la progression passe aussi par le tempo : 3 secondes à la descente rendent un exercice nettement plus difficile avec les mêmes haltères.'],
  ['heart', 'Un écart n\'efface pas une semaine : c\'est la moyenne qui compte, pas un repas.'],
  ['pot', 'Prépare 2 ou 3 bases le dimanche (riz, poulet, légumes rôtis) : la semaine devient beaucoup plus simple.'],
  ['flame', 'Les boissons sucrées et l\'alcool apportent des calories qui ne rassasient pas. Ce sont souvent les plus faciles à réduire.'],
  ['star', 'Garde des collations protéinées prêtes (skyr, œufs durs, dinde) pour éviter le grignotage improvisé.'],
  ['ruler', 'Mesure ton tour de taille toutes les 2 à 4 semaines : il bouge parfois quand la balance stagne.']
];
D.insights = () => D.memo('insights', () => {
  const out = [];
  const today = U.today(), y = U.addDays(today, -1);
  const tg = D.targets(), p = D.progress(), g = p.g;
  const last7 = U.range(U.addDays(today, -7), y);
  const logged = last7.filter(d => D.dayTotals(d).count >= 2);
  const w = D.bodyWeight();
  const add = (level, icon, title, text, action = null, prio = 0) => out.push({ level, icon, title, text, action, prio: prio + { warn: 300, info: 200, good: 100, tip: 0 }[level] });
  const sinceStart = U.diffDays(g.startDate, today);

  // Alimentation
  if (sinceStart >= 3 && logged.length < 4) add('info', 'note', 'Note tes repas plus souvent', `Seulement ${logged.length} jour${logged.length > 1 ? 's' : ''} notés sur les 7 derniers. À partir de 4 à 5 jours par semaine, les prévisions deviennent fiables.`, { label: 'Ouvrir le journal', act: 'goToday' }, 20);
  if (logged.length >= 3) {
    const pAvg = U.avg(logged.map(d => D.dayTotals(d).p)), kAvg = U.avg(logged.map(d => D.dayTotals(d).kcal));
    if (pAvg < tg.protein * 0.85) add('warn', 'bolt', 'Protéines un peu justes', `${U.num(pAvg)} g par jour en moyenne pour une cible de ${U.num(tg.protein)} g. ${D.isMaintain() ? 'Elles aident à récupérer après l\'effort et à garder tes muscles.' : 'En perte de poids, c\'est ce qui aide le plus à garder tes muscles et ta carrure.'}`, { label: 'Recettes riches en protéines', act: 'goRecipes', data: { tag: 'proteine' } }, 30);
    else if (pAvg >= tg.protein * 0.95) add('good', 'bolt', 'Protéines au rendez-vous', `${U.num(pAvg)} g par jour en moyenne cette semaine : exactement ce qu'il faut pour préserver la masse musculaire.`);
    const bmr = D.bmr(w);
    if (kAvg < bmr * 0.95) add('warn', 'flame', 'Tu manges peut-être trop peu', `Moyenne de ${U.num(kAvg)} kcal, sous ton métabolisme de base estimé (${U.num(bmr)} kcal). Si tes repas sont bien tous notés, une restriction aussi forte fait perdre du muscle et se tient mal dans la durée.`, { label: 'Voir mes cibles', act: 'goSettings' }, 40);
  }
  // Effet week-end
  const d14 = U.range(U.addDays(today, -14), y).filter(d => D.dayTotals(d).count >= 2);
  const we = d14.filter(d => U.dow(d) >= 5), wd = d14.filter(d => U.dow(d) < 5);
  if (we.length >= 2 && wd.length >= 3) {
    const a = U.avg(we.map(d => D.dayTotals(d).kcal)), b = U.avg(wd.map(d => D.dayTotals(d).kcal));
    if (a > b * 1.2) add('info', 'calendar', 'Effet week-end', `Tu manges environ ${U.num(a - b)} kcal de plus le samedi et le dimanche. Prévoir un repas du week-end dans le planning aide souvent à garder le cap.`, { label: 'Planifier le week-end', act: 'goPlanning' }, 5);
  }
  // Rythme de perte (ou dérive du poids en maintien)
  const rate = D.rate();
  if (D.isMaintain()) {
    const pr = D.progress(), wk = D.weekSummary(U.addDays(U.weekStart(today), -7));
    if (pr.last && !pr.inBand) add('warn', 'scale', pr.ref > pr.band.hi ? 'Poids au-dessus de ta zone' : 'Poids sous ta zone', pr.ref > pr.band.hi ? `Moyenne sur 7 jours : ${U.kg(pr.ref)} kg pour une zone de ${U.num(pr.band.lo, 1)} à ${U.num(pr.band.hi, 1)} kg. Regarde tes repas des deux dernières semaines ou ajoute un peu d'activité.` : `Moyenne sur 7 jours : ${U.kg(pr.ref)} kg, sous ta zone. Mange à ta faim, surtout les jours de séance.`, null, 20);
    else if (pr.last) add('good', 'scale', 'Poids stable', `Ta moyenne sur 7 jours (${U.kg(pr.ref)} kg) est dans ta zone de ${U.num(pr.band.lo, 1)} à ${U.num(pr.band.hi, 1)} kg.`);
    if (sinceStart >= 7 && wk.minutes < D.weeklyGoal().min) add('info', 'heart', `${U.num(wk.minutes)} min d'activité la semaine dernière`, `Le repère est de ${D.weeklyGoal().min} minutes par semaine : 30 minutes de marche rapide 5 jours sur 7 suffisent.`, { label: 'Ajouter une activité', act: 'quickActivity' }, 12);
  }
  if (rate != null && sinceStart > 21 && !D.isMaintain()) {
    if (rate < -0.01 * w) add('warn', 'trendDown', 'Perte très rapide', `${U.sign(rate, 2)} kg par semaine, soit plus de 1 % de ton poids. Pour protéger tes muscles, ajoute 150 à 250 kcal par jour (idéalement des glucides autour des séances) et garde tes protéines hautes.`, null, 25);
    else if (rate > -0.1) {
      const ms = DB.all('measurements').sort((x, z) => x.date < z.date ? -1 : 1).filter(m => m.waist);
      const waistDown = ms.length >= 2 && ms[ms.length - 1].waist < ms[ms.length - 2].waist && U.diffDays(ms[ms.length - 2].date, today) < 60;
      if (waistDown) add('good', 'ruler', 'La taille diminue', `La balance stagne (${U.sign(rate, 2)} kg/sem.) mais ton tour de taille a baissé de ${U.num(ms[ms.length - 2].waist - ms[ms.length - 1].waist, 1)} cm : tu perds du gras en gardant du muscle.`);
      else add('info', 'pulse', 'Plateau', `Tendance à ${U.sign(rate, 2)} kg/sem. sur 4 semaines. Pistes simples : vérifier que tout est noté (huile, sauces, boissons), ajouter 2 000 pas par jour, ou retirer 150 kcal par jour.`, { label: 'Simuler', act: 'goCoach' }, 15);
    } else if (rate <= -0.2) add('good', 'trendDown', 'Rythme idéal', `${U.sign(rate, 2)} kg par semaine : un rythme soutenable qui préserve la masse musculaire.`);
  }
  // Paliers
  const next = D.milestones().find(m => !m.date);
  if (next && p.ref - next.kg <= 1.5 && p.ref > next.kg) add('good', 'flag', `Plus que ${U.kg(p.ref - next.kg)} kg avant ${U.num(next.kg)} kg`, 'Le prochain palier est tout proche. Il sera validé quand ta moyenne sur 7 jours passera dessous.', null, 10);
  // Renforcement
  const str = D.doneActs().filter(a => a.type === 'strength');
  const lastStr = str.length ? str[str.length - 1] : null;
  const daysSince = lastStr ? U.diffDays(lastStr.date, today) : null;
  const plannedToday = D.actsOn(today).filter(a => a.status === 'planned');
  if (sinceStart >= 7 && (daysSince == null || daysSince >= 8) && !plannedToday.some(a => a.type === 'strength')) add('warn', 'dumbbell', daysSince == null ? 'Pas encore de renforcement' : `Pas de renforcement depuis ${daysSince} jours`, 'Pour garder ta carrure et tes épaules pendant la perte de gras, vise 2 à 3 séances de renforcement par semaine.', { label: 'Démarrer une séance', act: 'trStart' }, 20);
  const str7 = str.filter(a => a.date >= U.addDays(today, -6)).length;
  if (str7 >= 2) add('good', 'dumbbell', `${str7} séances de renforcement cette semaine`, D.isMaintain() ? 'Le repère recommandé est de 2 séances par semaine : c\'est fait.' : 'C\'est le signal qui dit au corps de garder ses muscles pendant le déficit.');
  const ups = D.templates().flatMap(t => t.items.map(i => i.exId)).filter((v, i, a) => a.indexOf(v) === i).map(id => ({ id, s: D.suggestLoad(id) })).filter(x => x.s && x.s.up);
  if (ups.length) add('info', 'trendUp', `${ups.length} exercice${ups.length > 1 ? 's' : ''} prêt${ups.length > 1 ? 's' : ''} à progresser`, `${ups.slice(0, 3).map(x => `${D.exercise(x.id).name} → ${x.s.kg != null ? U.num(x.s.kg, x.s.kg % 1 ? 1 : 0) + ' kg' : x.s.delta}`).join(', ')}. La suggestion s'affiche pendant ta prochaine séance.`, { label: 'Voir le détail', act: 'goCoach' }, 2);
  // Séance prévue aujourd'hui
  for (const a of plannedToday.slice(0, 1)) add('info', D.ACT[a.type].icon, `Séance prévue${a.time ? ' à ' + a.time.replace(':', 'h') : ''} : ${D.actTitle(a)}`, `Dépense estimée ≈ ${U.num(a.kcal || D.estimateKcal(a.type, a.duration || 45, a.intensity || 3, a.distance))} kcal. Un repas avec 25 à 40 g de protéines dans les 2 heures autour de la séance aide la récupération.`, { label: a.type === 'strength' ? 'Démarrer' : 'Voir', act: a.type === 'strength' ? 'actStart' : 'actOpen', data: { id: a.id } }, 35);
  // Pas
  const st = last7.map(d => D.day(d).steps).filter(Boolean);
  if (st.length >= 3 && U.avg(st) < tg.steps * 0.75) add('info', 'steps', 'Un peu plus de marche', `${U.num(U.avg(st))} pas par jour en moyenne pour un objectif de ${U.num(tg.steps)}. 10 minutes après le déjeuner et le dîner comblent l'écart (≈ ${U.num(tg.steps - U.avg(st) > 0 ? (tg.steps - U.avg(st)) * D.STEP_K * w : 0)} kcal par jour).`, null, 5);
  // Pesées
  const lw = D.current();
  if (sinceStart >= 5 && (!lw || U.diffDays(lw.date, today) >= 5)) add('info', 'scale', 'Pèse-toi cette semaine', 'Trois ou quatre pesées par semaine suffisent pour une tendance fiable. Le matin, à jeun, après être passé aux toilettes.', { label: 'Ajouter une pesée', act: 'quickWeight' }, 10);
  // Planning
  const next3 = U.range(today, U.addDays(today, 2)).some(d => D.planOn(d).length);
  if (!next3 && DB.all('plan').length === 0) add('info', 'calendar', 'Organise tes repas', 'Le planning propose une semaine équilibrée en un clic et prépare ta liste de courses.', { label: 'Proposer ma semaine', act: 'goPlanning' }, 0);
  // Mensurations
  const lm = DB.all('measurements').map(m => m.date).sort().pop();
  if (sinceStart >= 14 && (!lm || U.diffDays(lm, today) > 28)) add('info', 'ruler', lm ? 'Nouvelles mensurations ?' : 'Prends tes mensurations', 'Taille, épaules, bras : elles montrent la recomposition même quand la balance stagne.', { label: 'Mesurer', act: 'measNew' }, 0);
  // Astuce du jour
  const doy = Math.floor((U.parse(today) - new Date(U.parse(today).getFullYear(), 0, 0)) / 864e5);
  const tip = D.TIPS[doy % D.TIPS.length];
  add('tip', tip[0], 'Astuce du jour', tip[1]);
  return out.sort((a, b) => b.prio - a.prio);
});

/* ---------- Rendu ---------- */
function insightRow(i, compact = false) {
  const c = { warn: 'var(--goal)', info: 'var(--accent)', good: 'var(--good)', tip: 'var(--ink-3)' }[i.level];
  const data = i.action && i.action.data ? Object.entries(i.action.data).map(([k, v]) => `data-${k}="${U.esc(v)}"`).join(' ') : '';
  return `<div class="insight ${i.level}" style="--c:${c}"><span class="ic-badge sm" style="--c:${c}">${U.icon(i.icon)}</span><div class="grow" style="min-width:0"><b>${U.esc(i.title)}</b><p>${U.esc(i.text)}</p>${i.action ? `<button class="card-link" data-act="${i.action.act}" ${data}>${U.esc(i.action.label)}${U.icon('chevR', 'sm')}</button>` : ''}</div></div>`;
}
D.insightRow = insightRow;
A.goCoach = () => { UI.closeAll(); App.go('coach'); };
A.goSettings = () => App.go('reglages');

Pages.coach = {
  title: 'Coach',
  nav: 'coach',
  sim: { steps: 0, sessions: 0, kcal: 0 },
  render() {
    const ins = D.insights();
    const cal = D.calibration();
    const p = D.profile();
    const formula = D.estimate({ sex: p.sex, age: p.age, height: p.height, weight: D.bodyWeight(), activity: p.activity, pace: p.pace, goalWeight: p.goalWeight }).tdee;
    const ws = U.weekStart(U.today());
    const wb = D.weekBalance(ws);
    const max = Math.max(...wb.rows.map(r => Math.max(r.e, r.intake || 0))) * 1.05;
    const eToday = D.dayExpenditure(U.today(), true);
    const cr = D.coachRate();
    const sim = D.simulate();
    const g = D.goal();
    const run = D.runPredict();
    const exs = D.templates().flatMap(t => t.items.map(i => i.exId)).filter((v, i, a) => a.indexOf(v) === i).map(id => ({ ex: D.exercise(id), s: D.suggestLoad(id), last: D.lastPerf(id) })).filter(x => x.s);
    return `<div class="page-head"><div><h1>Coach</h1><div class="sub">Prévisions et conseils calculés à partir de tes pesées, repas et activités. Ce sont des estimations, pas des avis médicaux.</div></div></div>
    <div class="grid g-dash">
      <section class="card span-7"><div class="card-h"><div><div class="eyebrow">Conseils du moment</div><h2>${ins.filter(i => i.level !== 'tip').length} point${ins.filter(i => i.level !== 'tip').length > 1 ? 's' : ''} à regarder</h2></div></div>
        <div class="insights">${ins.map(i => insightRow(i)).join('')}</div></section>
      <div class="span-5 stack" style="gap:18px">
        <section class="card"><div class="card-h"><div><div class="eyebrow">Aujourd'hui</div><h2>Dépense estimée</h2></div></div>
          <div class="row" style="gap:10px;align-items:baseline"><span class="big">${U.num(eToday.total)}</span><span class="muted">kcal</span></div>
          <div class="stack" style="gap:6px;margin-top:12px">${[['Métabolisme et vie courante', eToday.base * eToday.k, 'var(--c-rest)'], [`Marche (${U.num(eToday.steps)} pas${eToday.stepsKnown ? '' : ', estimés'})`, eToday.stepK * eToday.k, 'var(--c-walk)'], [`Activités${eToday.planned ? ' (dont prévues)' : ''}`, eToday.actK * eToday.k, 'var(--c-strength)']].map(([l, v, c]) => `<div><div class="row between small"><span class="muted">${l}</span><b class="tabnum">${U.num(v)}</b></div>${UI.bar(v / eToday.total, c)}</div>`).join('')}</div>
          ${DB.setting('prefs', {}).dynamicTarget ? `<p class="hint">Objectif calorique du jour adapté : <b>${U.num(D.kcalTarget(U.today()))} kcal</b>.</p>` : `<p class="hint">Tu peux adapter ton objectif calorique à ces activités dans <a href="#reglages">Réglages</a>.</p>`}</section>
        <section class="card"><div class="card-h"><div><div class="eyebrow">Calibration</div><h2>Ta dépense réelle</h2></div></div>
          ${cal && cal.tdee ? `<div class="grid g-2" style="gap:12px"><div class="kpi"><span class="l">Mesurée sur tes données</span><span class="v">${U.num(U.round(cal.tdee, 10))}<small>kcal/j</small></span><span class="d faint">fiabilité ${cal.conf}</span></div><div class="kpi"><span class="l">Estimée par la formule</span><span class="v faint">${U.num(formula)}<small>kcal/j</small></span><span class="d faint">profil « ${(D.ACTIVITY_LEVELS.find(a => a.id === p.activity) || {}).label || '—'} »</span></div></div>
            <p class="hint">Calcul : apports moyens (${U.num(cal.intake)} kcal sur ${cal.logged} jours notés) + variation de ta tendance de poids (${U.sign(cal.dW)} kg en ${cal.span} jours × 7 700 kcal/kg). Le modèle de dépense est ajusté de ${U.sign((cal.k - 1) * 100, 0)} % pour coller à ta réalité.</p>`
            : `<div class="note">${U.icon('info', 'sm')}<span>${cal && cal.need ? `Encore ${cal.need} jour${cal.need > 1 ? 's' : ''} de repas notés (sur 2 à 4 semaines) pour mesurer ta dépense réelle.` : 'Il faut au moins 2 semaines de pesées et une dizaine de jours de repas notés pour mesurer ta dépense réelle.'} En attendant, la formule estime ${U.num(formula)} kcal par jour.</span></div>`}</section>
      </div>

      <section class="card span-7"><div class="card-h"><div><div class="eyebrow">Semaine du ${U.fmtShort(ws)}</div><h2>Bilan énergétique</h2></div></div>
        <div class="bal">${wb.rows.map((r, i) => `<div class="bal-r ${r.future ? 'future' : ''}"><span class="bal-d">${U.dayShort(i)}<small>${U.parse(r.d).getDate()}</small></span>
          <div class="bal-t"><i class="bal-in ${r.kind}" style="width:${r.intake ? (r.intake / max * 100).toFixed(1) : 0}%"></i><i class="bal-e" style="left:${(r.e / max * 100).toFixed(1)}%" title="Dépense ${U.num(r.e)} kcal"></i></div>
          <span class="bal-v ${r.bal == null ? 'faint' : r.bal >= 0 ? 'good-c' : 'goal-c'}">${r.bal == null ? 'non noté' : (r.bal >= 0 ? '−' : '+') + U.num(Math.abs(r.bal))}</span></div>`).join('')}</div>
        <div class="legend" style="margin-top:10px"><span><i style="--c:var(--c-food);height:8px"></i>Apports notés</span><span><i class="dash" style="--c:var(--c-food);height:8px"></i>Prévus (planning ou moyenne)</span><span><i style="--c:var(--ink);width:3px;height:12px"></i>Dépense estimée</span></div>
        <div class="grid g-2" style="gap:12px;margin-top:14px"><div class="kpi"><span class="l">Déficit des jours notés</span><span class="v ${wb.pastDef >= 0 ? 'good-c' : 'goal-c'}">${U.num(wb.pastDef)}<small>kcal</small></span><span class="d faint">≈ ${U.num(wb.pastDef / 7700, 2)} kg de masse grasse · ${wb.known} j</span></div>
          <div class="kpi"><span class="l">Prévision sur la semaine</span><span class="v">${U.sign(-wb.totalDef / 7700, 2)}<small>kg</small></span><span class="d faint">avec tes repas et séances prévus</span></div></div></section>

      <section class="card span-5"><div class="card-h"><div><div class="eyebrow">Et si…</div><h2>Simulateur</h2></div></div>
        <div class="stack" style="gap:14px">
          <label class="field"><span>Pas en plus par jour <b id="sv-steps" class="acc-c">+${U.num(this.sim.steps)}</b></span><input type="range" id="sim-steps" min="0" max="6000" step="500" value="${this.sim.steps}"></label>
          <label class="field"><span>Séances en plus par semaine <b id="sv-sessions" class="acc-c">+${this.sim.sessions}</b></span><input type="range" id="sim-sessions" min="0" max="4" step="1" value="${this.sim.sessions}"></label>
          <label class="field"><span>Calories par jour <b id="sv-kcal" class="acc-c">${this.sim.kcal > 0 ? '+' : ''}${U.num(this.sim.kcal)}</b></span><input type="range" id="sim-kcal" min="-400" max="400" step="50" value="${this.sim.kcal}"></label>
          <div id="sim-out"></div>
        </div></section>

      <section class="card span-12"><div class="card-h"><div><div class="eyebrow">Projection</div><h2>${D.isMaintain() ? 'Ton poids dans les prochains mois' : `Vers ${U.num(g.goal)} kg`}</h2></div><span class="spacer"></span><span class="xs faint">Base : ${U.esc(cr.src)} (${U.sign(cr.rate, 2)} kg/sem.)</span></div>
        <div class="grid g-4" style="gap:12px;margin-bottom:12px">${[[28, 'Dans 4 semaines'], [91, 'Dans 3 mois'], [182, 'Dans 6 mois']].map(([n, l]) => `<div class="kpi"><span class="l">${l}</span><span class="v">${U.kg(sim.at(U.addDays(sim.d0, n)))}<small>kg</small></span></div>`).join('')}
          ${D.isMaintain() ? `<div class="kpi"><span class="l">Ta zone</span><span class="v" style="font-size:22px">${U.num(D.band().lo, 1)} – ${U.num(D.band().hi, 1)}<small>kg</small></span><span class="d faint">poids de référence ± ${U.num(D.band().w, 1)} kg</span></div>` : `<div class="kpi"><span class="l">${U.num(g.goal)} kg vers</span><span class="v" style="font-size:22px">${sim.goalDate ? U.fmtMonth(sim.goalDate) : 'au-delà de 3 ans'}</span><span class="d faint">${sim.goalDate ? (sim.goalDate <= g.goalDate ? 'avant' : 'après') + ' ' + U.fmtMonth(g.goalDate).toLowerCase() : 'à ce rythme'}</span></div>`}</div>
        <div id="proj-chart" data-h="260"></div>
        <p class="hint">La courbe ralentit légèrement avec le temps : en perdant du poids, tu dépenses un peu moins d'énergie (≈ 15 kcal par jour et par kilo perdu). Recalculée à chaque pesée, jamais une promesse.</p></section>

      <section class="card span-7"><div class="card-h"><div><div class="eyebrow">Renforcement</div><h2>Prochaine séance : charges suggérées</h2></div></div>
        ${exs.length ? `<div class="list">${exs.map(x => `<div class="li"><span class="ic-badge sm" style="--c:${x.s.up ? 'var(--good)' : x.s.down ? 'var(--goal)' : 'var(--ink-3)'}">${U.icon(x.s.up ? 'trendUp' : x.s.down ? 'trendDown' : 'repeat')}</span><span class="grow"><span class="t">${U.esc(x.ex.name)}</span><span class="s">Dernière fois : ${U.esc(D.setsLabel(x.last.sets, x.ex.kind))} · ${U.esc(x.s.why)}</span></span><span class="end"><b>${x.s.kg != null ? U.num(x.s.kg, x.s.kg % 1 ? 1 : 0) + ' kg' : ''}${x.s.kg != null ? ' × ' : ''}${x.s.reps}${x.ex.kind === 'time' ? ' s' : ''}</b><br><span class="xs ${x.s.up ? 'good-c' : 'faint'}">${x.s.delta}</span></span></div>`).join('')}</div>
          <p class="hint">Règle simple : +1 à 2 kg par haltère (+1 répétition ou +5 s au poids du corps) quand toutes les séries atteignent l'objectif. Au-delà de 20 répétitions, passe à une variante plus difficile. Ces suggestions apparaissent dans le mode séance.</p>`
          : UI.empty('dumbbell', 'Pas encore d\'historique', 'Après ta première séance guidée, je te proposerai les charges de la suivante.', '<button class="btn sm primary" data-act="trStart">Démarrer une séance</button>')}</section>
      <section class="card span-5"><div class="card-h"><div><div class="eyebrow">Course</div><h2>Temps estimés</h2></div></div>
        ${run ? `<div class="grid g-3" style="gap:12px"><div class="kpi"><span class="l">5 km</span><span class="v">${U.hms(run.k5)}</span></div><div class="kpi"><span class="l">10 km</span><span class="v">${U.hms(run.k10)}</span></div><div class="kpi"><span class="l">Semi</span><span class="v" style="font-size:22px">${U.hms(run.semi)}</span></div></div>
          <p class="hint">D'après ta meilleure sortie récente (${U.num(run.from.distance, 1)} km en ${U.dur(run.from.duration)}, le ${U.fmtShort(run.from.date)}), avec la formule de Riegel. Plus la distance est éloignée, plus l'estimation est optimiste : l'endurance se construit progressivement.</p>`
          : UI.empty('run', 'Aucune course récente', 'Enregistre une sortie d\'au moins 2,5 km avec sa durée pour estimer tes temps sur 5 km, 10 km et semi-marathon.')}</section>
    </div>`;
  },
  mount(root) {
    const g = D.goal();
    const s = D.weightSeries();
    const from = U.addDays(U.today(), -90);
    const hist = s.filter(p => p.date >= from).map(p => ({ x: p.date, y: +p.trend.toFixed(2) }));
    const sim = D.simulate();
    const end = sim.goalDate && sim.goalDate > g.goalDate ? U.addDays(sim.goalDate, 30) : U.addDays(g.goalDate, 30);
    const cap = U.addDays(U.today(), 730);
    const xTo = end > cap ? cap : end;
    const series = [
      { name: 'Repère', color: 'var(--goal)', dash: '4 6', width: 1.5, points: [{ x: g.startDate, y: g.start }, { x: g.goalDate, y: g.goal }].filter(p => p.x >= (hist[0] ? hist[0].x : from)) },
      { name: 'Tendance', color: 'var(--accent)', style: 'area', width: 2.6, endDot: true, points: hist },
      { name: 'Projection', color: 'var(--accent)', dash: '6 5', width: 2.2, points: sim.pts.filter(p => p.x <= xTo) }
    ];
    if (series[0].points.length < 2) series[0].points = [{ x: hist[0] ? hist[0].x : from, y: D.planAt(hist[0] ? hist[0].x : from) }, { x: g.goalDate, y: g.goal }];
    const el = root.querySelector('#proj-chart');
    if (hist.length) Charts.line(el, { height: 260, label: 'Projection du poids', xFrom: hist[0].x, xTo, series, primary: 2, refs: [{ y: g.goal, label: `${U.num(g.goal)} kg`, color: 'var(--goal)', include: true }], yFmt: v => U.num(v),
      tip: (d, v) => `${U.fmtFull(d)}<br>${v.map(x => `<div class="tr"><i style="background:${x.se.color}"></i>${x.se.name} : <b style="font-size:14px">${U.kg(x.p.y)} kg</b></div>`).join('')}` });
    else el.innerHTML = UI.empty('scale', 'Pas encore de pesée', 'La projection apparaîtra dès tes premières pesées.');
    // Simulateur
    const upd = () => {
      const st = this.sim;
      st.steps = +root.querySelector('#sim-steps').value; st.sessions = +root.querySelector('#sim-sessions').value; st.kcal = +root.querySelector('#sim-kcal').value;
      root.querySelector('#sv-steps').textContent = '+' + U.num(st.steps);
      root.querySelector('#sv-sessions').textContent = '+' + st.sessions;
      root.querySelector('#sv-kcal').textContent = (st.kcal > 0 ? '+' : '') + U.num(st.kcal);
      const w = D.bodyWeight();
      const recent = D.doneActs().filter(a => a.date >= U.addDays(U.today(), -30) && a.type !== 'walk');
      const sessK = recent.length ? U.avg(recent.map(a => a.kcal || 0)) : 400;
      const extra = st.steps * D.STEP_K * w + st.sessions * sessK / 7 - st.kcal;
      const base = D.simulate(), alt = D.simulate({ extraKcal: extra });
      const newRate = -(alt.def0 * 7 / 7700);
      const diffW = base.goalDate && alt.goalDate ? Math.round(U.diffDays(alt.goalDate, base.goalDate) / 7) : null;
      const atGoal = alt.at(g.goalDate);
      root.querySelector('#sim-out').innerHTML = `<div class="sim-res"><div class="kpi"><span class="l">${U.num(g.goal)} kg atteint vers</span><span class="v" style="font-size:26px">${alt.goalDate ? U.fmtMonth(alt.goalDate) : 'au-delà de 3 ans'}</span><span class="d ${diffW > 0 ? 'good-c' : diffW < 0 ? 'goal-c' : 'faint'}">${diffW == null || !extra ? 'rythme actuel' : diffW > 0 ? `${diffW} semaine${diffW > 1 ? 's' : ''} plus tôt` : diffW < 0 ? `${-diffW} semaine${diffW < -1 ? 's' : ''} plus tard` : 'pas de changement notable'}</span></div>
        <div class="kpi"><span class="l">Poids estimé en ${U.fmtMonth(g.goalDate).toLowerCase()}</span><span class="v" style="font-size:26px">${U.kg(Math.max(atGoal, 0))}<small>kg</small></span><span class="d faint">${U.sign(newRate, 2)} kg/sem. au départ</span></div></div>
        ${-newRate > w * 0.01 ? `<div class="note warn" style="margin-top:10px">${U.icon('info', 'sm')}<span>Au-delà de 1 % du poids par semaine, le risque de perdre du muscle augmente. Préfère ajouter de l'activité plutôt que de trop couper les calories.</span></div>` : ''}
        ${extra ? `<p class="hint" style="margin:8px 0 0">Soit ${extra > 0 ? '' : '+'}${U.num(Math.abs(extra))} kcal de ${extra > 0 ? 'déficit en plus' : 'déficit en moins'} par jour${sessK && st.sessions ? ` (séance moyenne ≈ ${U.num(sessK)} kcal)` : ''}.</p>` : ''}`;
    };
    ['#sim-steps', '#sim-sessions', '#sim-kcal'].forEach(id => root.querySelector(id).addEventListener('input', upd));
    upd();
  }
};

/* Bandeau coach du tableau de bord */
D.coachStrip = () => {
  const ins = D.insights().filter(i => i.level !== 'tip').slice(0, 3);
  const tip = D.insights().find(i => i.level === 'tip');
  const wb = D.weekBalance(U.weekStart(U.today()));
  const e = D.dayExpenditure(U.today(), true);
  const list = ins.length < 3 && tip ? [...ins, tip] : ins;
  return `<section class="card span-12 coach-strip o2"><div class="card-h"><div><div class="eyebrow">Coach</div><h2>Prévisions et conseils</h2></div><span class="spacer"></span><a class="card-link" href="#coach">Tout voir${U.icon('chevR', 'sm')}</a></div>
    <div class="coach-grid"><div class="coach-kpi"><div class="kpi"><span class="l">Dépense estimée aujourd'hui</span><span class="v">${U.num(e.total)}<small>kcal</small></span>${DB.setting('prefs', {}).dynamicTarget ? `<span class="d faint">objectif du jour ${U.num(D.kcalTarget(U.today()))} kcal</span>` : ''}</div>
      <div class="kpi"><span class="l">Prévision de la semaine</span><span class="v ${wb.totalDef > 0 ? 'good-c' : ''}">${wb.counted ? U.sign(-wb.totalDef / 7700, 2) : '–'}<small>kg</small></span><span class="d faint">selon repas et séances</span></div></div>
      ${list.map(i => insightRow(i, true)).join('')}</div></section>`;
};
