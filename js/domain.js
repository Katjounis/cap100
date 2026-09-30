'use strict';
/* Cap 100 — logique métier : catalogues, calculs, tendances, estimations, badges */

const D = {};

/* ---------- Mémoïsation liée à la révision de la base ---------- */
const _memo = new Map();
D.memo = (key, fn) => {
  const hit = _memo.get(key);
  if (hit && hit.rev === DB.rev) return hit.val;
  const val = fn();
  _memo.set(key, { rev: DB.rev, val });
  return val;
};

/* ---------- Catalogues ---------- */
D.ACT = {
  strength: { label: 'Renforcement', icon: 'dumbbell', c: 'var(--c-strength)', met: 4, dist: false },
  run: { label: 'Course', icon: 'run', c: 'var(--c-run)', met: 9.8, dist: true },
  walk: { label: 'Marche', icon: 'walk', c: 'var(--c-walk)', met: 3.5, dist: true },
  hike: { label: 'Randonnée', icon: 'mountain', c: 'var(--c-hike)', met: 5.5, dist: true },
  bike: { label: 'Vélo', icon: 'bike', c: 'var(--c-bike)', met: 7.5, dist: true },
  swim: { label: 'Natation', icon: 'swim', c: 'var(--c-swim)', met: 7, dist: true },
  other: { label: 'Autre', icon: 'pulse', c: 'var(--c-other)', met: 5, dist: false }
};
D.STATUS = { planned: 'Prévu', done: 'Réalisé', cancelled: 'Annulé', progress: 'En cours' };
D.INTENSITY = ['Très légère', 'Légère', 'Modérée', 'Soutenue', 'Très intense'];
D.FEELING = ['Difficile', 'Moyen', 'Correct', 'Bien', 'Excellent'];
D.MOOD = ['Bas', 'Moyen', 'Correct', 'Bien', 'Top'];
D.SLOTS = [
  { id: 'breakfast', label: 'Petit-déjeuner', icon: 'sun' },
  { id: 'lunch', label: 'Déjeuner', icon: 'food' },
  { id: 'dinner', label: 'Dîner', icon: 'moon' },
  { id: 'snack', label: 'Collations', icon: 'star' }
];
D.slotLabel = id => (D.SLOTS.find(s => s.id === id) || {}).label || id;
D.MEASURES = [
  { id: 'waist', label: 'Tour de taille' },
  { id: 'chest', label: 'Tour de poitrine' },
  { id: 'shoulders', label: 'Épaules' },
  { id: 'arm', label: 'Bras' },
  { id: 'thigh', label: 'Cuisses' },
  { id: 'hips', label: 'Hanches' },
  { id: 'neck', label: 'Cou' }
];
D.ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sédentaire', f: 1.2, hint: 'Travail assis, peu de marche' },
  { id: 'light', label: 'Légèrement actif', f: 1.375, hint: '1 à 3 séances par semaine' },
  { id: 'moderate', label: 'Actif', f: 1.55, hint: '3 à 5 séances par semaine' },
  { id: 'high', label: 'Très actif', f: 1.725, hint: '6 séances ou plus, métier physique' }
];
D.PACES = [
  { id: 'gentle', label: 'Doux', kgw: 0.25, hint: '≈ 0,25 kg / semaine' },
  { id: 'moderate', label: 'Modéré', kgw: 0.5, hint: '≈ 0,5 kg / semaine' },
  { id: 'steady', label: 'Soutenu', kgw: 0.75, hint: '≈ 0,75 kg / semaine' }
];

/* Aliments de base : valeurs moyennes indicatives pour 100 g (ou 100 ml) */
D.BASE_FOODS = [
  ['Flocons d\'avoine', 370, 13.5, 58.7, 7, 50, '1 bol'],
  ['Pain de mie complet', 255, 9, 44, 4, 25, '1 tranche'],
  ['Baguette', 270, 9, 55, 1.2, 60, '1/4 de baguette'],
  ['Œuf entier', 140, 12.5, 0.7, 9.8, 60, '1 œuf'],
  ['Blanc de poulet cuit', 150, 30, 0, 3, 120, '1 filet'],
  ['Cuisse de poulet rôtie', 210, 25, 0, 12, 150, '1 cuisse'],
  ['Steak haché 5 % (cuit)', 160, 27, 0, 5.5, 100, '1 steak'],
  ['Saumon cuit', 200, 21, 0, 13, 120, '1 pavé'],
  ['Cabillaud cuit', 85, 19, 0, 0.7, 150, '1 filet'],
  ['Thon au naturel', 115, 26, 0, 1, 80, '1 petite boîte'],
  ['Crevettes cuites', 100, 22, 0, 1.2, 100, '1 portion'],
  ['Jambon blanc', 115, 20, 1, 3.5, 45, '1 tranche'],
  ['Tofu nature', 130, 13, 1.5, 8, 100, '1 portion'],
  ['Riz basmati cuit', 130, 3, 28, 0.3, 150, '1 assiette'],
  ['Pâtes cuites', 150, 5.5, 30, 0.9, 180, '1 assiette'],
  ['Quinoa cuit', 120, 4.4, 21, 1.9, 150, '1 portion'],
  ['Pomme de terre cuite', 85, 2, 18.5, 0.1, 200, '2 moyennes'],
  ['Patate douce cuite', 90, 2, 20, 0.1, 200, '1 portion'],
  ['Lentilles cuites', 115, 9, 17, 0.5, 150, '1 portion'],
  ['Petits pois', 80, 5.5, 11, 0.5, 150, '1 portion'],
  ['Haricots verts', 30, 2, 4, 0.2, 150, '1 portion'],
  ['Brocoli cuit', 35, 2.8, 4, 0.4, 150, '1 portion'],
  ['Courgette cuite', 17, 1.2, 2.2, 0.3, 200, '1 portion'],
  ['Carottes', 35, 0.8, 7, 0.2, 120, '1 portion'],
  ['Tomate', 19, 0.9, 3, 0.2, 120, '1 tomate'],
  ['Salade verte', 15, 1.3, 1.5, 0.2, 50, '1 bol'],
  ['Soupe de légumes', 35, 1, 5, 1, 300, '1 bol'],
  ['Banane', 90, 1.1, 20, 0.3, 120, '1 banane'],
  ['Pomme', 53, 0.3, 12, 0.2, 150, '1 pomme'],
  ['Avocat', 170, 2, 1.5, 17, 100, '1/2 avocat'],
  ['Skyr nature', 60, 10.5, 4, 0.2, 150, '1 pot'],
  ['Fromage blanc 0 %', 48, 7.5, 4, 0.1, 100, '1 pot'],
  ['Yaourt grec', 120, 4, 4, 10, 150, '1 pot'],
  ['Lait demi-écrémé', 46, 3.3, 4.8, 1.6, 250, '1 verre'],
  ['Emmental', 380, 28, 0, 29, 30, '1 portion'],
  ['Mozzarella', 250, 18, 1, 19, 60, '1/2 boule'],
  ['Huile d\'olive', 900, 0, 0, 100, 10, '1 c. à soupe'],
  ['Beurre de cacahuète', 600, 25, 16, 50, 15, '1 c. à soupe'],
  ['Amandes', 610, 21, 7, 53, 25, '1 poignée'],
  ['Whey protéine', 380, 75, 8, 5, 30, '1 dose'],
  ['Chocolat noir 70 %', 580, 8, 33, 42, 20, '2 carrés'],
  ['Miel', 320, 0.4, 80, 0, 10, '1 c. à café'],
  ['Muesli', 370, 9, 64, 6, 50, '1 bol'],
  ['Galettes de riz', 380, 8, 80, 3, 10, '1 galette'],
  ['Jus d\'orange', 45, 0.7, 10, 0.1, 200, '1 verre'],
  ['Soda sucré', 42, 0, 10.6, 0, 330, '1 canette'],
  ['Sandwich jambon-beurre', 270, 12, 32, 10, 250, '1 sandwich'],
  ['Pizza margherita', 250, 11, 30, 9, 300, '1/2 pizza'],
  ['Burger (restauration rapide)', 250, 13, 25, 11, 220, '1 burger'],
  ['Frites', 300, 3.5, 38, 15, 150, '1 portion'],
  ['Kebab', 230, 12, 22, 10, 350, '1 kebab']
].map(([name, kcal, p, c, f, portion, portionLabel], i) => ({ id: 'base-' + i, name, kcal, p, c, f, portion, portionLabel, base: true }));

/* Matériel d'entraînement à la maison */
D.EQUIPMENT = [
  { id: 'corps', label: 'Poids du corps', icon: 'body', fixed: true },
  { id: 'tapis', label: 'Tapis', icon: 'grid' },
  { id: 'halteres', label: 'Haltères', icon: 'dumbbell' },
  { id: 'kettlebell', label: 'Kettlebell', icon: 'target' },
  { id: 'banc', label: 'Banc', icon: 'bed' },
  { id: 'elastique', label: 'Élastiques', icon: 'repeat' },
  { id: 'traction', label: 'Barre de traction', icon: 'flag' },
  { id: 'corde', label: 'Corde à sauter', icon: 'pulse' }
];
D.myEquipment = () => new Set(['corps', ...DB.setting('equipment', ['tapis', 'halteres'])]);

/* Bibliothèque d'exercices sans salle : [nom, groupe, mesure, matériel requis, conseil] */
D.BASE_EXERCISES = [
  // Pectoraux
  ['Pompes', 'Pectoraux', 'reps', [], 'Corps gainé, coudes à 45°. Trop dur : mains sur une chaise ou genoux au sol.'],
  ['Pompes inclinées (mains surélevées)', 'Pectoraux', 'reps', [], 'Mains sur une chaise ou un canapé : la version la plus accessible des pompes.'],
  ['Pompes déclinées (pieds surélevés)', 'Pectoraux', 'reps', [], 'Pieds sur une chaise : insiste sur le haut des pectoraux et les épaules.'],
  ['Développé au sol haltères', 'Pectoraux', 'weight', ['halteres'], 'Allongé au sol, les coudes touchent le sol à chaque répétition : sûr sans banc.'],
  ['Développé couché haltères', 'Pectoraux', 'weight', ['halteres', 'banc'], 'Omoplates serrées, descente contrôlée jusqu\'à la poitrine.'],
  ['Écarté au sol haltères', 'Pectoraux', 'weight', ['halteres'], 'Bras légèrement fléchis, ouvre jusqu\'à ce que les coudes touchent le sol.'],
  // Dos
  ['Rowing haltère un bras', 'Dos', 'weight', ['halteres'], 'Main et genou en appui sur une chaise, tire le coude vers la hanche.'],
  ['Rowing penché deux haltères', 'Dos', 'weight', ['halteres'], 'Buste penché à 45°, dos plat, tire les haltères vers le nombril.'],
  ['Pull-over haltère', 'Dos', 'weight', ['halteres'], 'Allongé, un haltère tenu à deux mains passe derrière la tête, bras presque tendus.'],
  ['Superman', 'Dos', 'reps', [], 'À plat ventre, lève bras et jambes 2 secondes. Excellent pour le bas du dos.'],
  ['Rowing élastique', 'Dos', 'weight', ['elastique'], 'Élastique accroché à une porte, tire vers le ventre en serrant les omoplates.'],
  ['Tractions', 'Dos', 'reps', ['traction'], 'Trop dur au début : descentes lentes (5 s) depuis la position haute.'],
  // Épaules
  ['Développé militaire haltères', 'Épaules', 'weight', ['halteres'], 'Assis ou debout, abdos serrés, pousse au-dessus de la tête sans cambrer.'],
  ['Élévations latérales', 'Épaules', 'weight', ['halteres'], 'Coudes légèrement fléchis, monte jusqu\'à l\'horizontale. Charge légère, mouvement lent.'],
  ['Oiseau haltères', 'Épaules', 'weight', ['halteres'], 'Buste penché, ouvre les bras sur les côtés : arrière des épaules et posture.'],
  ['Arnold press', 'Épaules', 'weight', ['halteres'], 'Paumes vers toi en bas, tourne les poignets en poussant vers le haut.'],
  ['Pompes piquées (pike)', 'Épaules', 'reps', [], 'Fesses en l\'air, la tête descend entre les mains : développé épaules au poids du corps.'],
  ['Face pull élastique', 'Épaules', 'weight', ['elastique'], 'Tire l\'élastique vers le visage, coudes hauts. Idéal pour les épaules et la posture.'],
  // Bras
  ['Curl biceps haltères', 'Bras', 'weight', ['halteres'], 'Coudes collés au corps, pas d\'élan.'],
  ['Curl marteau', 'Bras', 'weight', ['halteres'], 'Paumes face à face : biceps et avant-bras.'],
  ['Extension triceps haltère (nuque)', 'Bras', 'weight', ['halteres'], 'Un haltère à deux mains derrière la tête, coudes pointés vers le haut.'],
  ['Kickback triceps', 'Bras', 'weight', ['halteres'], 'Buste penché, coude fixe au niveau du buste, tends le bras vers l\'arrière.'],
  ['Dips sur chaise', 'Bras', 'reps', [], 'Mains sur le bord d\'une chaise stable, descends en pliant les coudes à 90°.'],
  // Jambes
  ['Squat goblet', 'Jambes', 'weight', ['halteres'], 'Haltère tenu contre la poitrine, descends en gardant le dos droit.'],
  ['Squat au poids du corps', 'Jambes', 'reps', [], 'Pieds largeur d\'épaules, descends comme pour t\'asseoir sur une chaise.'],
  ['Fentes arrière haltères', 'Jambes', 'weight', ['halteres'], 'Grand pas en arrière, genou arrière près du sol. Plus facile pour les genoux que les fentes avant.'],
  ['Fentes au poids du corps', 'Jambes', 'reps', [], 'Alterne les jambes, buste droit.'],
  ['Squat bulgare haltères', 'Jambes', 'weight', ['halteres'], 'Pied arrière sur une chaise : très efficace avec peu de charge.'],
  ['Soulevé de terre roumain haltères', 'Jambes', 'weight', ['halteres'], 'Jambes presque tendues, bascule le bassin vers l\'arrière, dos plat : ischios et fessiers.'],
  ['Step-up sur chaise', 'Jambes', 'reps', [], 'Monte sur une chaise stable en poussant sur le talon. Avec haltères pour progresser.'],
  ['Mollets debout', 'Jambes', 'weight', ['halteres'], 'Sur une marche, talons dans le vide, monte et descends lentement.'],
  ['Chaise (wall sit)', 'Jambes', 'time', [], 'Dos au mur, cuisses parallèles au sol.'],
  // Fessiers
  ['Pont fessier haltère', 'Fessiers', 'weight', ['halteres'], 'Haltère sur les hanches, pousse le bassin vers le haut et serre les fessiers 1 s.'],
  ['Pont fessier', 'Fessiers', 'reps', [], 'Au sol, pieds proches des fesses, monte le bassin.'],
  ['Kettlebell swing', 'Fessiers', 'weight', ['kettlebell'], 'Le mouvement part des hanches, pas des bras. Dos plat.'],
  // Abdos & gainage
  ['Gainage planche', 'Abdos', 'time', [], 'Coudes sous les épaules, corps aligné, ne laisse pas tomber le bassin.'],
  ['Gainage latéral', 'Abdos', 'time', [], 'Sur un coude, bassin haut. Temps par côté.'],
  ['Crunch', 'Abdos', 'reps', [], 'Monte les épaules sans tirer sur la nuque.'],
  ['Relevés de jambes', 'Abdos', 'reps', [], 'Allongé, mains sous les fesses, bas du dos collé au sol.'],
  ['Russian twist', 'Abdos', 'reps', [], 'Assis, pieds décollés ou au sol, tourne le buste de chaque côté. Avec haltère pour progresser.'],
  ['Mountain climbers', 'Abdos', 'time', [], 'En position de pompe, ramène les genoux vers la poitrine en alternant, rythme soutenu.'],
  ['Dead bug', 'Abdos', 'reps', [], 'Sur le dos, bras et jambes opposés s\'allongent lentement, bas du dos collé au sol.'],
  ['Hollow hold', 'Abdos', 'time', [], 'Sur le dos, épaules et jambes décollées, corps en banane.'],
  // Cardio
  ['Burpees', 'Cardio', 'reps', [], 'Version sans saut possible : recule les pieds un par un.'],
  ['Jumping jacks', 'Cardio', 'time', [], 'Échauffement ou finisher, 30 à 60 secondes.'],
  ['Corde à sauter', 'Cardio', 'time', ['corde'], 'Petits sauts sur l\'avant du pied.']
].map(([name, group, kind, eq, tip]) => ({ id: 'hx-' + U.norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, group, kind, eq, tip, base: true }));
/* Anciens exercices de salle : gardés uniquement pour l'historique éventuel */
D.LEGACY_EXERCISES = [
  ['Développé couché', 'Pectoraux', 'weight'], ['Développé incliné haltères', 'Pectoraux', 'weight'], ['Pompes', 'Pectoraux', 'reps'],
  ['Écarté à la poulie', 'Pectoraux', 'weight'], ['Dips', 'Pectoraux', 'reps'],
  ['Tirage horizontal', 'Dos', 'weight'], ['Tirage vertical', 'Dos', 'weight'], ['Rowing haltère', 'Dos', 'weight'],
  ['Tractions', 'Dos', 'reps'], ['Soulevé de terre', 'Dos', 'weight'],
  ['Développé militaire haltères', 'Épaules', 'weight'], ['Élévations latérales', 'Épaules', 'weight'], ['Oiseau', 'Épaules', 'weight'], ['Face pull', 'Épaules', 'weight'],
  ['Curl biceps', 'Bras', 'weight'], ['Curl marteau', 'Bras', 'weight'], ['Extension triceps poulie', 'Bras', 'weight'], ['Barre au front', 'Bras', 'weight'],
  ['Squat', 'Jambes', 'weight'], ['Squat goblet', 'Jambes', 'weight'], ['Presse à cuisses', 'Jambes', 'weight'], ['Fentes', 'Jambes', 'weight'],
  ['Soulevé de terre roumain', 'Jambes', 'weight'], ['Leg curl', 'Jambes', 'weight'], ['Leg extension', 'Jambes', 'weight'], ['Mollets debout', 'Jambes', 'weight'],
  ['Hip thrust', 'Fessiers', 'weight'],
  ['Gainage planche', 'Abdos', 'time'], ['Crunch', 'Abdos', 'reps'], ['Relevés de jambes', 'Abdos', 'reps'],
  ['Rameur', 'Cardio', 'time'], ['Corde à sauter', 'Cardio', 'time']
].map(([name, group, kind], i) => ({ id: 'ex-' + i, name, group, kind, eq: [], base: true, legacy: true }));
D.EX_GROUPS = ['Pectoraux', 'Dos', 'Épaules', 'Bras', 'Jambes', 'Fessiers', 'Abdos', 'Cardio', 'Autre'];
D.exAvailable = e => (e.eq || []).every(x => D.myEquipment().has(x));

D.defaultTemplates = () => {
  const ex = n => { const e = D.BASE_EXERCISES.find(x => x.name === n); if (!e) throw new Error('Exercice inconnu ' + n); return e.id; };
  return [
    { id: 'tpl-home-upper', name: 'Haut du corps (haltères)', order: 0, items: [
      { exId: ex('Pompes'), sets: 3, reps: 10, kg: null },
      { exId: ex('Rowing haltère un bras'), sets: 3, reps: 12, kg: 12 },
      { exId: ex('Développé au sol haltères'), sets: 3, reps: 10, kg: 12 },
      { exId: ex('Développé militaire haltères'), sets: 3, reps: 10, kg: 8 },
      { exId: ex('Élévations latérales'), sets: 3, reps: 15, kg: 4 },
      { exId: ex('Curl biceps haltères'), sets: 3, reps: 12, kg: 8 },
      { exId: ex('Extension triceps haltère (nuque)'), sets: 3, reps: 12, kg: 10 }
    ] },
    { id: 'tpl-home-lower', name: 'Bas du corps & fessiers', order: 1, items: [
      { exId: ex('Squat goblet'), sets: 4, reps: 12, kg: 14 },
      { exId: ex('Fentes arrière haltères'), sets: 3, reps: 10, kg: 8 },
      { exId: ex('Soulevé de terre roumain haltères'), sets: 3, reps: 10, kg: 14 },
      { exId: ex('Pont fessier haltère'), sets: 3, reps: 12, kg: 16 },
      { exId: ex('Mollets debout'), sets: 3, reps: 15, kg: 10 },
      { exId: ex('Chaise (wall sit)'), sets: 3, reps: 40, kg: null }
    ] },
    { id: 'tpl-home-core', name: 'Abdos & gainage', order: 2, items: [
      { exId: ex('Gainage planche'), sets: 3, reps: 40, kg: null },
      { exId: ex('Gainage latéral'), sets: 3, reps: 25, kg: null },
      { exId: ex('Crunch'), sets: 3, reps: 15, kg: null },
      { exId: ex('Relevés de jambes'), sets: 3, reps: 10, kg: null },
      { exId: ex('Russian twist'), sets: 3, reps: 20, kg: null },
      { exId: ex('Dead bug'), sets: 3, reps: 10, kg: null },
      { exId: ex('Mountain climbers'), sets: 3, reps: 30, kg: null }
    ] },
    { id: 'tpl-home-full', name: 'Full body express (25 min)', order: 3, items: [
      { exId: ex('Squat goblet'), sets: 3, reps: 12, kg: 14 },
      { exId: ex('Pompes'), sets: 3, reps: 10, kg: null },
      { exId: ex('Rowing penché deux haltères'), sets: 3, reps: 12, kg: 10 },
      { exId: ex('Fentes arrière haltères'), sets: 3, reps: 10, kg: 8 },
      { exId: ex('Gainage planche'), sets: 3, reps: 40, kg: null },
      { exId: ex('Burpees'), sets: 3, reps: 8, kg: null }
    ] }
  ];
};

D.HABIT_AUTO = {
  steps: { label: 'Pas ≥ objectif quotidien', check: date => (D.day(date).steps || 0) >= D.targets().steps },
  workout: { label: 'Activité réalisée', check: date => D.actsOn(date).some(a => a.status === 'done') },
  protein: { label: 'Protéines ≥ 90 % de la cible', check: date => { const t = D.dayTotals(date); return t.count > 0 && t.p >= D.targets().protein * 0.9; } },
  kcal: { label: 'Calories dans la cible (± 10 %)', check: date => { const t = D.dayTotals(date); const k = D.kcalTarget ? D.kcalTarget(date) : D.targets().kcal; return t.count > 0 && t.kcal >= k * 0.8 && t.kcal <= k * 1.1; } },
  weigh: { label: 'Pesée enregistrée', check: date => !!DB.get('weights', date) },
  food: { label: 'Alimentation notée', check: date => D.dayTotals(date).count >= 2 }
};
D.HABIT_COLORS = ['var(--c-walk)', 'var(--c-swim)', 'var(--c-strength)', 'var(--accent)', 'var(--c-bike)', 'var(--c-food)', 'var(--c-run)', 'var(--c-hike)'];
D.HABIT_ICONS = ['walk', 'droplet', 'dumbbell', 'bolt', 'moon', 'pot', 'heart', 'steps', 'food', 'star', 'sun', 'note'];
D.defaultHabits = () => [
  { id: 'h-walk', name: 'Marcher', icon: 'walk', color: 0, auto: 'steps', perWeek: 6, order: 0 },
  { id: 'h-water', name: 'Boire suffisamment', icon: 'droplet', color: 1, auto: null, perWeek: 7, order: 1 },
  { id: 'h-sport', name: 'Faire du sport', icon: 'dumbbell', color: 2, auto: 'workout', perWeek: 4, order: 2 },
  { id: 'h-protein', name: 'Protéines suffisantes', icon: 'bolt', color: 3, auto: 'protein', perWeek: 6, order: 3 },
  { id: 'h-sleep', name: 'Dormir correctement', icon: 'moon', color: 4, auto: null, perWeek: 6, order: 4 },
  { id: 'h-prep', name: 'Préparer mes repas', icon: 'pot', color: 5, auto: null, perWeek: 3, order: 5 }
];

/* ---------- Réglages ---------- */
D.profile = () => DB.setting('profile', null) || {};
D.targets = () => Object.assign({ kcal: 2600, protein: 160, carbs: 280, fat: 80, steps: 8000, activeMin: 40 }, DB.setting('targets', {}));
D.meta = () => DB.setting('meta', {});
D.isDemo = () => !!D.meta().demo;

/* ---------- Poids ---------- */
D.weights = () => D.memo('weights', () => DB.all('weights').sort((a, b) => a.date < b.date ? -1 : 1));
D.weightSeries = () => D.memo('wseries', () => {
  const w = D.weights();
  let trend = null, prev = null;
  return w.map((e, i) => {
    const from = U.addDays(e.date, -6);
    let s = 0, n = 0;
    for (let j = i; j >= 0 && w[j].date >= from; j--) { s += w[j].kg; n++; }
    if (trend == null) trend = e.kg;
    else { const gap = Math.max(1, U.diffDays(prev, e.date)); trend += (1 - Math.pow(0.9, gap)) * (e.kg - trend); }
    prev = e.date;
    return { date: e.date, kg: e.kg, avg7: s / n, trend };
  });
});
D.current = () => { const s = D.weightSeries(); return s.length ? s[s.length - 1] : null; };
D.goal = () => {
  const p = D.profile();
  return { start: p.startWeight || 130, goal: p.goalWeight || 100, startDate: p.startDate || U.today(), goalDate: p.goalDate || '2027-11-30' };
};
/* Progression calculée sur la moyenne 7 jours : une pesée isolée ne fait pas bouger l'objectif */
D.progress = () => {
  const g = D.goal(), c = D.current();
  const ref = c ? c.avg7 : g.start;
  const total = g.start - g.goal;
  const lost = g.start - ref;
  return { ref, lost, total, remaining: Math.max(0, ref - g.goal), pct: total > 0 ? U.clamp(lost / total, 0, 1) : 0, last: c, g };
};
D.planAt = date => {
  const g = D.goal();
  const span = U.diffDays(g.startDate, g.goalDate);
  if (span <= 0) return g.goal;
  const t = U.clamp(U.diffDays(g.startDate, date) / span, 0, 1);
  return g.start + (g.goal - g.start) * t;
};
/* Pente (kg/semaine) sur les 28 derniers jours de moyenne lissée */
D.rate = () => D.memo('rate', () => {
  const s = D.weightSeries();
  if (s.length < 4) return null;
  const last = s[s.length - 1].date;
  const pts = s.filter(p => U.diffDays(p.date, last) <= 28);
  if (pts.length < 4 || U.diffDays(pts[0].date, last) < 10) return null;
  const xs = pts.map(p => U.diffDays(pts[0].date, p.date)), ys = pts.map(p => p.trend);
  const mx = U.avg(xs), my = U.avg(ys);
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? (num / den) * 7 : null;
});
D.requiredRate = () => {
  const p = D.progress();
  const from = p.last ? p.last.date : U.today();
  const weeks = U.diffDays(from, p.g.goalDate) / 7;
  return weeks > 0 ? p.remaining / weeks : null;
};
D.projection = () => {
  const r = D.rate(), p = D.progress();
  if (r == null || r > -0.05 || !p.last) return null;
  const days = Math.round(p.remaining / (-r / 7));
  if (days > 365 * 4) return null;
  return U.addDays(p.last.date, days);
};
D.milestones = () => D.memo('milestones', () => {
  const g = D.goal();
  const list = (D.profile().milestones || [125, 120, 115, 110, 105, 100]).filter(m => m < g.start && m >= g.goal).sort((a, b) => b - a);
  if (!list.includes(g.goal)) list.push(g.goal);
  const s = D.weightSeries();
  return list.map(kg => {
    const hit = s.find(p => p.date >= g.startDate && p.avg7 <= kg + 1e-9);
    return { kg, date: hit ? hit.date : null, goal: kg === g.goal };
  });
});
D.monthsTimeline = () => D.memo('months', () => {
  const g = D.goal(), today = U.today(), out = [];
  const w = D.weights();
  const firstMonth = U.monthStart(w.length && w[0].date < g.startDate ? w[0].date : g.startDate);
  let m = firstMonth;
  const endMonth = U.monthStart(g.goalDate > today ? g.goalDate : today);
  let prevAvg = null;
  const ms = D.milestones();
  while (m <= endMonth && out.length < 60) {
    const end = U.monthEnd(m);
    const entries = w.filter(e => e.date >= m && e.date <= end);
    const avg = entries.length ? U.avg(entries.map(e => e.kg)) : null;
    out.push({
      month: m, avg, count: entries.length, delta: avg != null && prevAvg != null ? avg - prevAvg : null,
      plan: D.planAt(end), state: end < today ? 'past' : (m <= today ? 'current' : 'future'),
      reached: ms.filter(x => x.date && x.date >= m && x.date <= end),
      isGoal: m === U.monthStart(g.goalDate)
    });
    if (avg != null) prevAvg = avg;
    m = U.addMonths(m, 1);
  }
  return out;
});

/* ---------- Nutrition ---------- */
D.mealIndex = () => D.memo('mealIdx', () => {
  const idx = new Map();
  for (const m of DB.all('meals')) { if (!idx.has(m.date)) idx.set(m.date, []); idx.get(m.date).push(m); }
  for (const arr of idx.values()) arr.sort((a, b) => (a.t || 0) - (b.t || 0));
  return idx;
});
D.mealsOn = date => D.mealIndex().get(date) || [];
D.dayTotals = date => {
  const arr = D.mealsOn(date);
  return { ...D.sumNutrients(arr), count: arr.length };
};
D.foods = () => D.memo('foods', () => {
  const custom = DB.all('foods');
  const hidden = new Set(DB.setting('hiddenFoods', []));
  const overrides = new Map(custom.filter(f => f.overrides).map(f => [f.overrides, f]));
  const base = D.BASE_FOODS.filter(f => !hidden.has(f.id) && !overrides.has(f.id));
  return [...custom, ...base];
});
D.food = id => DB.get('foods', id) || D.BASE_FOODS.find(f => f.id === id);
D.macrosFor = (food, qty) => {
  const r = qty / 100;
  return { kcal: Math.round(food.kcal * r), p: +(food.p * r).toFixed(1), c: +(food.c * r).toFixed(1), f: +(food.f * r).toFixed(1) };
};
D.recentFoods = () => D.memo('recentFoods', () => {
  const seen = new Map();
  const meals = DB.all('meals').filter(m => m.foodId).sort((a, b) => (b.date + (b.t || 0)) > (a.date + (a.t || 0)) ? 1 : -1);
  for (const m of meals) {
    if (!seen.has(m.foodId)) seen.set(m.foodId, { count: 0, lastQty: m.qty });
    seen.get(m.foodId).count++;
  }
  return seen;
});
/* Estimation Mifflin-St Jeor — indicative, jamais sous le métabolisme de base */
D.estimate = ({ sex = 'm', age = 25, height = 185, weight = 130, activity = 'light', pace = 'moderate', goalWeight = 100 }) => {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'f' ? -161 : 5);
  const f = (D.ACTIVITY_LEVELS.find(a => a.id === activity) || D.ACTIVITY_LEVELS[1]).f;
  const tdee = bmr * f;
  const kgw = (D.PACES.find(p => p.id === pace) || D.PACES[1]).kgw;
  const deficit = Math.min(kgw * 7700 / 7, tdee * 0.25);
  const kcal = U.round(Math.max(tdee - deficit, bmr), 50);
  const ref = Math.min(weight, Math.max(goalWeight || weight * 0.8, weight * 0.7));
  const protein = U.round(Math.max(1.6 * ref, 120), 5);
  const fat = U.round(Math.max(0.8 * ref, kcal * 0.25 / 9), 5);
  const carbs = Math.max(0, U.round((kcal - protein * 4 - fat * 9) / 4, 5));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), deficit: Math.round(tdee - kcal), kcal, protein, fat, carbs };
};

/* ---------- Activités ---------- */
D.acts = () => D.memo('acts', () => DB.all('activities').sort((a, b) => (a.date + (a.time || '99')) < (b.date + (b.time || '99')) ? -1 : 1));
D.actIndex = () => D.memo('actIdx', () => {
  const idx = new Map();
  for (const a of D.acts()) { if (!idx.has(a.date)) idx.set(a.date, []); idx.get(a.date).push(a); }
  return idx;
});
D.actsOn = date => D.actIndex().get(date) || [];
D.doneActs = () => D.memo('done', () => D.acts().filter(a => a.status === 'done'));
D.actTitle = a => a.title || (D.ACT[a.type] || D.ACT.other).label;
D.bodyWeight = () => { const c = D.current(); return c ? c.avg7 : (D.profile().startWeight || 130); };
D.estimateKcal = (type, min, intensity = 3, km = null, kg = D.bodyWeight()) => {
  if (!min) return null;
  const t = D.ACT[type] || D.ACT.other;
  let met = t.met;
  const speed = km ? km / (min / 60) : null;
  if (type === 'run' && speed) met = U.clamp(speed * 1.0, 6, 16);
  else if (type === 'walk' && speed) met = U.clamp(0.8 * speed - 0.2, 2.3, 6.5);
  else if (type === 'bike' && speed) met = U.clamp(0.4 * speed, 4, 12);
  const factor = [0.75, 0.88, 1, 1.15, 1.3][U.clamp((intensity || 3) - 1, 0, 4)];
  return Math.round(met * factor * kg * (min / 60));
};
D.totalDistance = () => U.sum(D.doneActs().map(a => a.distance || 0));
D.day = date => DB.get('days', date) || { date };

/* ---------- Renforcement ---------- */
D.exercises = () => D.memo('exercises', () => {
  const custom = DB.all('exercises');
  const hidden = new Set(DB.setting('hiddenExercises', []));
  const used = new Set(DB.all('activities').flatMap(a => (a.exercises || []).map(e => e.exId)));
  return [...D.BASE_EXERCISES.filter(e => !hidden.has(e.id)), ...D.LEGACY_EXERCISES.filter(e => used.has(e.id)), ...custom].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
});
D.exercise = id => DB.get('exercises', id) || D.BASE_EXERCISES.find(e => e.id === id) || D.LEGACY_EXERCISES.find(e => e.id === id) || { id, name: 'Exercice supprimé', group: 'Autre', kind: 'weight' };
D.templates = () => DB.all('templates').sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, 'fr'));
D.e1rm = (kg, reps) => kg && reps ? kg * (1 + Math.min(reps, 15) / 30) : 0;
D.exHistory = exId => D.memo('exh-' + exId, () => {
  const out = [];
  for (const a of D.doneActs()) {
    if (a.type !== 'strength' || !a.exercises) continue;
    const ex = a.exercises.find(e => e.exId === exId);
    if (!ex) continue;
    const sets = ex.sets.filter(s => s.done && (s.reps || s.kg));
    if (!sets.length) continue;
    const best = sets.reduce((b, s) => D.e1rm(s.kg, s.reps) > D.e1rm(b.kg, b.reps) ? s : b, sets[0]);
    const top = sets.reduce((b, s) => (s.kg || 0) > (b.kg || 0) ? s : b, sets[0]);
    out.push({ date: a.date, actId: a.id, sets, topKg: top.kg || 0, topReps: top.reps || 0, e1rm: D.e1rm(best.kg, best.reps), volume: U.sum(sets.map(s => (s.kg || 0) * (s.reps || 0))), totalReps: U.sum(sets.map(s => s.reps || 0)) });
  }
  return out;
});
D.lastPerf = (exId, excludeId) => {
  const h = D.exHistory(exId).filter(x => x.actId !== excludeId);
  return h.length ? h[h.length - 1] : null;
};
D.setsLabel = (sets, kind = 'weight') => {
  if (!sets || !sets.length) return '';
  if (kind === 'time') return sets.map(s => `${s.reps || 0} s`).join(' · ');
  if (kind === 'reps') return sets.map(s => s.reps || 0).join(' · ') + ' rép.';
  const sameKg = sets.every(s => s.kg === sets[0].kg);
  if (sameKg) return `${U.num(sets[0].kg || 0, sets[0].kg % 1 ? 1 : 0)} kg × ${sets.map(s => s.reps || 0).join(', ')}`;
  return sets.map(s => `${U.num(s.kg || 0, s.kg % 1 ? 1 : 0)}×${s.reps || 0}`).join(' · ');
};
D.workoutVolume = a => U.sum((a.exercises || []).flatMap(e => e.sets.filter(s => s.done).map(s => (s.kg || 0) * (s.reps || 0))));
D.workoutSetsDone = a => U.sum((a.exercises || []).map(e => e.sets.filter(s => s.done).length));

/* ---------- Semaines, régularité ---------- */
D.isActiveDay = date => D.actsOn(date).some(a => a.status === 'done') || (D.day(date).steps || 0) >= D.targets().steps;
D.weekSummary = ws => {
  const days = U.range(ws, U.addDays(ws, 6));
  const today = U.today();
  const past = days.filter(d => d <= today);
  const acts = days.flatMap(d => D.actsOn(d)).filter(a => a.status === 'done');
  const logged = past.filter(d => D.dayTotals(d).count > 0);
  const kcal = U.avg(logged.map(d => D.dayTotals(d).kcal));
  const prot = U.avg(logged.map(d => D.dayTotals(d).p));
  const wts = D.weights().filter(w => w.date >= ws && w.date <= days[6]);
  const steps = past.map(d => D.day(d).steps).filter(Boolean);
  return {
    days, sessions: acts.length, strength: acts.filter(a => a.type === 'strength').length,
    minutes: U.sum(acts.map(a => a.duration || 0)), distance: U.sum(acts.map(a => a.distance || 0)),
    kcal, prot, loggedDays: logged.length, weight: wts.length ? U.avg(wts.map(w => w.kg)) : null,
    steps: U.avg(steps), activeDays: past.filter(D.isActiveDay).length, pastDays: past.length
  };
};
D.trackedDays = () => D.memo('tracked', () => {
  const s = new Set();
  DB.all('weights').forEach(w => s.add(w.date));
  DB.all('meals').forEach(m => s.add(m.date));
  D.doneActs().forEach(a => s.add(a.date));
  DB.all('days').forEach(d => { if (d.steps || d.note || d.mood) s.add(d.date); });
  return s;
});

/* ---------- Habitudes ---------- */
D.habits = () => DB.all('habits').filter(h => !h.archived).sort((a, b) => (a.order || 0) - (b.order || 0));
D.habitDone = (h, date) => h.auto ? (D.HABIT_AUTO[h.auto] ? D.HABIT_AUTO[h.auto].check(date) : false) : !!DB.get('habitLogs', h.id + '|' + date);
D.habitCount = (h, from, to) => U.range(from, to).filter(d => d <= U.today() && D.habitDone(h, d)).length;

/* ---------- Badges ---------- */
D.BADGES = [
  { id: 'first-weigh', label: 'Premier relevé', desc: 'Première pesée enregistrée', icon: 'scale', val: () => DB.all('weights').length, goal: 1 },
  { id: 'first-workout', label: 'Premier entraînement', desc: 'Une première séance réalisée', icon: 'dumbbell', val: () => D.doneActs().length, goal: 1 },
  { id: 's10', label: '10 séances', desc: '10 activités réalisées', icon: 'pulse', val: () => D.doneActs().length, goal: 10 },
  { id: 's25', label: '25 séances', desc: '25 activités réalisées', icon: 'pulse', val: () => D.doneActs().length, goal: 25 },
  { id: 's50', label: '50 séances', desc: '50 activités réalisées', icon: 'pulse', val: () => D.doneActs().length, goal: 50 },
  { id: 's100', label: '100 séances', desc: '100 activités réalisées', icon: 'trophy', val: () => D.doneActs().length, goal: 100 },
  { id: 'km100', label: '100 km parcourus', desc: 'Marche, course, vélo, natation…', icon: 'walk', val: () => D.totalDistance(), goal: 100, unit: 'km' },
  { id: 'km250', label: '250 km parcourus', desc: 'Distance cumulée', icon: 'run', val: () => D.totalDistance(), goal: 250, unit: 'km' },
  { id: 'km500', label: '500 km parcourus', desc: 'Distance cumulée', icon: 'bike', val: () => D.totalDistance(), goal: 500, unit: 'km' },
  { id: 'kg5', label: 'Premier −5 kg', desc: 'Moyenne 7 jours', icon: 'trendDown', val: () => D.progress().lost, goal: 5, unit: 'kg' },
  { id: 'kg10', label: 'Premier −10 kg', desc: 'Moyenne 7 jours', icon: 'trendDown', val: () => D.progress().lost, goal: 10, unit: 'kg' },
  { id: 'kg15', label: '−15 kg', desc: 'La moitié du chemin', icon: 'trendDown', val: () => D.progress().lost, goal: 15, unit: 'kg' },
  { id: 'kg20', label: '−20 kg', desc: 'Moyenne 7 jours', icon: 'trendDown', val: () => D.progress().lost, goal: 20, unit: 'kg' },
  { id: 'goal', label: 'Objectif atteint', desc: 'Poids cible atteint', icon: 'flag', val: () => D.progress().pct * 100, goal: 100, unit: '%' },
  { id: 'd7', label: '7 jours de suivi', desc: 'Jours avec au moins une donnée', icon: 'calendar', val: () => D.trackedDays().size, goal: 7 },
  { id: 'd30', label: '30 jours de suivi', desc: 'Jours avec au moins une donnée', icon: 'calendar', val: () => D.trackedDays().size, goal: 30 },
  { id: 'd100', label: '100 jours de suivi', desc: 'Jours avec au moins une donnée', icon: 'calendar', val: () => D.trackedDays().size, goal: 100 },
  { id: 'steps10k', label: 'Journée à 10 000 pas', desc: 'Au moins une fois', icon: 'steps', val: () => Math.max(0, ...DB.all('days').map(d => d.steps || 0)), goal: 10000 },
  { id: 'photo', label: 'Point de départ', desc: 'Première photo de progression', icon: 'camera', val: () => DB.all('photos').length, goal: 1 },
  { id: 'measure', label: 'Mètre ruban', desc: 'Premières mensurations', icon: 'ruler', val: () => DB.all('measurements').length, goal: 1 }
];
D.badgeState = () => {
  const unlocked = DB.setting('unlocked', {});
  return D.BADGES.map(b => { const v = b.val() || 0; return { ...b, v, on: !!unlocked[b.id] || v >= b.goal, date: unlocked[b.id] || null, pct: U.clamp(v / b.goal, 0, 1) }; });
};
/* Retourne les nouveautés (badges, paliers) depuis la dernière vérification */
D.checkNew = (silent = false) => {
  const unlocked = { ...DB.setting('unlocked', {}) };
  const seenMs = { ...DB.setting('milestonesSeen', {}) };
  const fresh = [];
  for (const b of D.BADGES) {
    if (!unlocked[b.id] && (b.val() || 0) >= b.goal) { unlocked[b.id] = U.today(); fresh.push({ kind: 'badge', b }); }
  }
  for (const m of D.milestones()) {
    if (m.date && !seenMs[m.kg]) { seenMs[m.kg] = m.date; fresh.push({ kind: 'milestone', m }); }
  }
  if (fresh.length) {
    DB.setSetting('unlocked', unlocked);
    DB.setSetting('milestonesSeen', seenMs);
  }
  return silent ? [] : fresh;
};
