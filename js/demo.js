'use strict';
/* Cap 100 — données de démonstration (7 semaines fictives, supprimables) */

const Demo = {};
Demo.generate = async () => {
  let seed = 20260928;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const today = U.today();
  const start = U.addDays(today, -49);
  const days = U.range(start, today);
  await DB.clearAll();

  const profile = { name: '', sex: 'm', age: 25, height: 185, startWeight: 130.3, startDate: start, goalWeight: 100, goalDate: '2027-11-30', activity: 'light', pace: 'moderate', milestones: [125, 120, 115, 110, 105, 100] };
  await DB.setSetting('profile', profile);
  const e = D.estimate({ ...profile, weight: 130.3, goalWeight: 100 });
  await DB.setSetting('targets', { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, steps: 8000, activeMin: 40 });

  // Poids : perte initiale d'eau puis ~0,5 kg/sem, avec bruit quotidien réaliste
  const weights = [];
  days.forEach((d, i) => {
    if (rnd() < 0.12 && d !== today && i > 0) return;
    const base = 130.3 - 2.0 * (1 - Math.exp(-i / 10)) - 0.075 * i;
    const wd = U.dow(d);
    const noise = (rnd() - 0.5) * 0.9 + (wd === 0 ? 0.35 : 0);
    weights.push({ date: d, kg: Math.round((base + noise) * 10) / 10, note: i === 0 ? 'Point de départ' : '' });
  });
  await DB.putMany('weights', weights);

  // Repas
  const F_ = n => D.BASE_FOODS.find(f => f.name === n);
  const item = (n, q) => { const f = F_(n); return { foodId: f.id, name: f.name, qty: q, unit: 'g', ...D.macrosFor(f, q) }; };
  const B = [
    [['Flocons d\'avoine', 60], ['Skyr nature', 150], ['Banane', 120]],
    [['Pain de mie complet', 50], ['Œuf entier', 120], ['Jus d\'orange', 200]],
    [['Fromage blanc 0 %', 200], ['Muesli', 50], ['Pomme', 150]]
  ];
  const L = [
    [['Blanc de poulet cuit', 150], ['Riz basmati cuit', 200], ['Brocoli cuit', 150], ['Huile d\'olive', 10]],
    [['Pâtes cuites', 220], ['Steak haché 5 % (cuit)', 100], ['Haricots verts', 150]],
    [['Sandwich jambon-beurre', 250], ['Pomme', 150]],
    [['Saumon cuit', 120], ['Pomme de terre cuite', 250], ['Salade verte', 50], ['Huile d\'olive', 10]]
  ];
  const Dn = [
    [['Cabillaud cuit', 150], ['Quinoa cuit', 150], ['Courgette cuite', 200], ['Huile d\'olive', 10]],
    [['Œuf entier', 180], ['Salade verte', 60], ['Baguette', 60], ['Emmental', 30]],
    [['Lentilles cuites', 200], ['Blanc de poulet cuit', 120], ['Carottes', 150]],
    [['Soupe de légumes', 300], ['Jambon blanc', 90], ['Pain de mie complet', 50], ['Yaourt grec', 150]]
  ];
  const S = [[['Skyr nature', 150], ['Amandes', 25]], [['Whey protéine', 30], ['Banane', 120]], [['Galettes de riz', 20], ['Beurre de cacahuète', 15]]];
  const meals = [];
  const hour = new Date().getHours();
  days.forEach((d, i) => {
    if (d !== today && rnd() < 0.1) return;
    const wd = U.dow(d);
    const plan = [['breakfast', pick(B)], ['lunch', pick(L)], ['dinner', wd >= 5 && rnd() < 0.5 ? [['Pizza margherita', 300], ['Salade verte', 50]] : pick(Dn)]];
    if (rnd() < 0.75) plan.push(['snack', pick(S)]);
    plan.forEach(([slot, items], k) => {
      if (d === today && ((slot === 'lunch' && hour < 12) || slot === 'dinner' || (slot === 'snack' && hour < 16))) return;
      items.forEach(([n, q], j) => meals.push({ id: U.uid() + i + k + j, date: d, slot, t: i * 100 + k * 10 + j, ...item(n, Math.round(q * (1.2 + rnd() * 0.3))) }));
    });
  });
  await DB.putMany('meals', meals);
  await DB.putMany('favorites', [{ id: 'fav-demo', name: 'Petit-déjeuner habituel', slot: 'breakfast', items: B[0].map(([n, q]) => item(n, q)) }]);
  await DB.put('foods', { id: 'cf-demo', name: 'Wrap poulet maison', kcal: 210, p: 16, c: 22, f: 6, portion: 220, portionLabel: '1 wrap' });

  // Séances types et activités
  const tpls = D.defaultTemplates();
  await DB.putMany('templates', tpls);
  await DB.setSetting('exLib', 2);
  const exId = n => D.BASE_EXERCISES.find(x => x.name === n).id;
  const acts = [];
  const strength = (d, tpl, week, status = 'done') => {
    const prog = Math.floor(week / 2);
    const loads = {
      'Pompes': [0, 8 + Math.min(4, week)], 'Rowing haltère un bras': [12 + prog * 2, 12], 'Développé au sol haltères': [12 + prog * 2, 10],
      'Développé militaire haltères': [8 + prog * 1, 10], 'Élévations latérales': [4 + (week >= 4 ? 1 : 0), 15], 'Curl biceps haltères': [8 + (week >= 3 ? 2 : 0), 12],
      'Extension triceps haltère (nuque)': [10 + prog * 1, 12], 'Squat goblet': [14 + prog * 2, 12], 'Fentes arrière haltères': [8 + prog * 1, 10],
      'Soulevé de terre roumain haltères': [14 + prog * 2, 10], 'Pont fessier haltère': [16 + prog * 2, 12], 'Mollets debout': [10 + prog * 2, 15], 'Chaise (wall sit)': [0, 30 + week * 5]
    };

    const exs = tpl.items.map(it => {
      const ex = D.exercise(it.exId); const L0 = loads[ex.name] || [0, 10];
      return { exId: it.exId, target: { sets: it.sets, reps: it.reps, kg: it.kg }, sets: Array.from({ length: it.sets }, (_, j) => ({ kg: ex.kind === 'weight' ? L0[0] : 0, reps: Math.max(1, L0[1] - (j === it.sets - 1 && rnd() < 0.5 ? 1 + Math.floor(rnd() * 2) : 0)), done: status === 'done' })) };
    });
    const dur = 50 + Math.round(rnd() * 20);
    acts.push({ id: U.uid() + d, type: 'strength', status, date: d, time: '18:15', title: tpl.name, templateId: tpl.id, duration: status === 'done' ? dur : 60, intensity: 3 + (rnd() < 0.4 ? 1 : 0), feeling: 3 + Math.floor(rnd() * 3), kcal: status === 'done' ? D.estimateKcal('strength', dur, 3, null, 128) : null, exercises: status === 'done' ? exs : null, comment: '' });
  };
  const cardio = (d, type, min, km, time, status = 'done', title = '') => acts.push({ id: U.uid() + d + type, type, status, date: d, time, title, duration: min, distance: km, intensity: 3, feeling: 3 + Math.floor(rnd() * 2), kcal: status === 'done' ? D.estimateKcal(type, min, 3, km, 128) : null, comment: '' });
  days.forEach((d, i) => {
    const wd = U.dow(d), week = Math.floor(i / 7);
    const isToday = d === today;
    if (wd === 0) strength(d, tpls[0], week, isToday ? 'planned' : 'done');
    if (wd === 1 && !isToday) cardio(d, 'walk', 45 + Math.round(rnd() * 15), +(3.8 + rnd() * 1.2).toFixed(1), '12:30');
    if (wd === 2 && !isToday) { if (week % 3 === 2) cardio(d, 'run', 25, 0, '19:00', 'cancelled', 'Course fractionnée'); else cardio(d, 'run', 26 + week, +(3.0 + week * 0.18 + rnd() * 0.2).toFixed(2), '19:00', 'done', week < 3 ? 'Course / marche' : 'Course'); }
    if (wd === 3 && !isToday) strength(d, tpls[1], week);
    if (wd === 4 && !isToday && rnd() < 0.6) cardio(d, 'walk', 35, 3.1, '12:30');
    if (wd === 5 && !isToday) { if (week % 2) cardio(d, 'bike', 60 + Math.round(rnd() * 20), +(16 + rnd() * 6).toFixed(1), '10:00'); else cardio(d, 'hike', 150, +(9 + rnd() * 3).toFixed(1), '09:30', 'done', 'Randonnée Pilat'); }
  });
  // À venir : la semaine prochaine
  for (let k = 1; k <= 8; k++) {
    const d = U.addDays(today, k), wd = U.dow(d);
    if (wd === 0) acts.push({ id: U.uid() + 'p' + k, type: 'strength', status: 'planned', date: d, time: '18:00', title: 'Renforcement haut du corps', templateId: tpls[0].id, duration: 60, intensity: 3 });
    if (wd === 1) cardio(d, 'walk', 45, null, '12:30', 'planned', 'Marche');
    if (wd === 2) cardio(d, 'run', 30, null, '19:00', 'planned', 'Course');
    if (wd === 3) acts.push({ id: U.uid() + 'p' + k, type: 'strength', status: 'planned', date: d, time: '18:00', title: tpls[1].name, templateId: tpls[1].id, duration: 60, intensity: 3 });
    if (wd === 5) cardio(d, 'hike', 120, null, '09:30', 'planned', 'Randonnée');
  }
  await DB.putMany('activities', acts);

  // Pas, repos, ressenti
  const dayRecs = days.map((d, i) => {
    const wd = U.dow(d);
    const r = { date: d, steps: d === today ? 3200 + Math.round(rnd() * 1500) : Math.round(5200 + rnd() * 5200 + (wd === 5 ? 4000 : 0)) };
    if (wd === 6) r.rest = true;
    if (rnd() < 0.3) r.mood = 3 + Math.floor(rnd() * 3);
    if (i === 20) r.note = 'Bien dormi, faim sous contrôle. Les séances deviennent plus faciles.';
    if (i === 34) r.note = 'Poids en hausse après le repas de famille de samedi, rien d\'inquiétant.';
    return r;
  });
  await DB.putMany('days', dayRecs);

  // Mensurations
  await DB.putMany('measurements', [
    { date: start, waist: 128, chest: 132, shoulders: 136, arm: 41, thigh: 72, hips: 126, neck: 45 },
    { date: U.addDays(start, 21), waist: 125.5, chest: 131, shoulders: 136, arm: 41, thigh: 71, hips: 124.5, neck: 44.5 },
    { date: U.addDays(start, 42), waist: 123, chest: 130, shoulders: 136.5, arm: 41, thigh: 70.5, hips: 123, neck: 44 }
  ]);

  // Habitudes
  const habits = D.defaultHabits();
  await DB.putMany('habits', habits);
  const logs = [];
  days.forEach(d => habits.filter(h => !h.auto).forEach(h => { if (d !== today && rnd() < (h.id === 'h-prep' ? 0.45 : 0.75)) logs.push({ id: h.id + '|' + d, habitId: h.id, date: d }); }));
  await DB.putMany('habitLogs', logs);

  // Cuisine : favoris, planning des deux prochaines semaines, liste de courses
  await DB.setSetting('recipeFavs', ['r-wrap-cesar', 'r-bowl-teriyaki', 'r-pdj-oats', 'r-sal-grecque', 'r-bowl-chili']);
  await DB.setSetting('meta', { onboarded: true, demo: true, createdAt: new Date().toISOString() });
  const plan = D.autoPlan({ from: U.weekStart(today), days: 14, slots: ['breakfast', 'lunch', 'dinner'], favFirst: true, batch: true });
  await DB.putMany('plan', plan);
  const to = U.addDays(U.weekStart(today), 6);
  const shop = D.shoppingFromPlan(today, to).map((i, k) => ({ ...i, checked: k % 5 === 0 }));
  await DB.putMany('shopping', shop);
  await DB.setSetting('shopRange', { from: today, to });
  D.checkNew(true);
};
