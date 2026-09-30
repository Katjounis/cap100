'use strict';
/* Cap 100 — base d'aliments complète.
   1. Les aliments « maison » de l'app (portions, rayons, prix) reçoivent les valeurs Ciqual de leur équivalent.
   2. Toute la table Ciqual (≈ 3 300 aliments bruts, cuits, plats, sauces…) devient cherchable.
   Nutriments pour 100 g : kcal, p (protéines), c (glucides), sug (dont sucres), f (lipides), sat (dont AG saturés), fib (fibres), salt (sel). */

D.NUTRIENTS = [
  { k: 'kcal', l: 'Énergie', u: 'kcal', d: 0 },
  { k: 'p', l: 'Protéines', u: 'g', d: 1 },
  { k: 'c', l: 'Glucides', u: 'g', d: 1 },
  { k: 'sug', l: 'dont sucres', u: 'g', d: 1, sub: true },
  { k: 'f', l: 'Lipides', u: 'g', d: 1 },
  { k: 'sat', l: 'dont AG saturés', u: 'g', d: 1, sub: true },
  { k: 'fib', l: 'Fibres', u: 'g', d: 1 },
  { k: 'salt', l: 'Sel', u: 'g', d: 2 }
];
D.EXTRA_KEYS = ['sug', 'fib', 'sat', 'salt'];

/* Aliments de l'app → code Ciqual équivalent */
D.CQ_MAP = {
  'Flocons d\'avoine': 32140, 'Pain de mie complet': 7111, 'Baguette': 7007, 'Œuf entier': 22000, 'Blanc de poulet cuit': 36018,
  'Cuisse de poulet rôtie': 36004, 'Steak haché 5 % (cuit)': 6251, 'Saumon cuit': 26230, 'Cabillaud cuit': 25997, 'Thon au naturel': 26039,
  'Crevettes cuites': 10086, 'Jambon blanc': 28902, 'Tofu nature': 20904, 'Riz basmati cuit': 9125, 'Pâtes cuites': 9811, 'Quinoa cuit': 9341,
  'Pomme de terre cuite': 4003, 'Patate douce cuite': 4102, 'Lentilles cuites': 20360, 'Petits pois': 20124, 'Haricots verts': 20071,
  'Brocoli cuit': 20351, 'Courgette cuite': 20021, 'Carottes': 20009, 'Tomate': 20385, 'Salade verte': 20031, 'Soupe de légumes': 25903,
  'Banane': 13005, 'Pomme': 13039, 'Avocat': 13004, 'Fromage blanc 0 %': 19644, 'Yaourt grec': 19860, 'Lait demi-écrémé': 19033,
  'Emmental': 12118, 'Mozzarella': 19590, 'Huile d\'olive': 17270, 'Beurre de cacahuète': 15202, 'Amandes': 15000, 'Chocolat noir 70 %': 31074,
  'Miel': 31008, 'Muesli': 32110, 'Galettes de riz': 7352, 'Jus d\'orange': 2070, 'Soda sucré': 18018, 'Sandwich jambon-beurre': 25517,
  'Pizza margherita': 25404, 'Burger (restauration rapide)': 25413, 'Frites': 4030, 'Kebab': 25429, 'Tortilla de blé (wrap)': 7815,
  'Pois chiches cuits': 20532, 'Haricots rouges cuits': 20524, 'Maïs doux (boîte)': 20066, 'Tomates concassées (boîte)': 20137, 'Feta': 12060,
  'Fromage de chèvre frais': 12805, 'Parmesan': 12120, 'Yaourt nature 0 %': 19594, 'Crème légère 15 %': 19404, 'Blanc de dinde (tranches)': 28964,
  'Concombre': 20019, 'Poivron': 20041, 'Oignon rouge': 20034, 'Épinards frais': 20059, 'Champignons de Paris': 20056, 'Citron (jus)': 2007,
  'Chou rouge': 20014, 'Fruits rouges surgelés': 13997, 'Semoule cuite': 9683, 'Houmous': 25621, 'Pesto': 11179, 'Sauce soja': 11104,
  'Moutarde': 11013, 'Aubergine': 20053, 'Poireau': 20039, 'Chou-fleur': 20016, 'Courge butternut': 20292, 'Betterave cuite': 20003,
  'Escalope de dinde cuite': 36306, 'Filet mignon de porc cuit': 28203, 'Saumon fumé': 26037, 'Surimi': 26046, 'Fromage frais allégé': 12069,
  'Ricotta': 19585, 'Bûche de chèvre': 12812, 'Pain pita': 7180, 'Boulgour cuit': 9691, 'Nouilles de riz cuites': 9901, 'Olives noires': 13186,
  'Cerneaux de noix': 15005
};
/* Aliments sans équivalent Ciqual : compléments indicatifs (étiquettes courantes) */
D.EXTRA_MANUAL = {
  'Skyr nature': { sug: 4, fib: 0, sat: 0.1, salt: 0.1 }, 'Whey protéine': { sug: 5, fib: 0, sat: 3, salt: 0.5 },
  'Cottage cheese': { sug: 3.5, fib: 0, sat: 2.9, salt: 0.8 }, 'Edamame surgelés': { sug: 2, fib: 5, sat: 0.6, salt: 0 },
  'Tortilla complète (wrap)': { sug: 2.5, fib: 6, sat: 1.4, salt: 1.2 }, 'Lait de coco léger': { sug: 1.5, fib: 0, sat: 6.2, salt: 0.05 },
  'Burger (restauration rapide)': {}, 'Salade verte': {}
};

const CQ_BY_CODE = new Map(CIQUAL.map(r => [r[0], r]));
const cqVals = r => ({ kcal: r[3], p: r[4], c: r[5], f: r[6], sug: r[7], fib: r[8], sat: r[9], salt: r[10] });

/* 1. Enrichissement des aliments de l'app */
for (const f of D.BASE_FOODS) {
  const code = f.cq || D.CQ_MAP[f.name];
  const r = code && CQ_BY_CODE.get(code);
  if (r) { Object.assign(f, cqVals(r)); f.cq = code; }
  else if (D.EXTRA_MANUAL[f.name]) Object.assign(f, D.EXTRA_MANUAL[f.name]);
}

/* 2. Toute la table Ciqual */
D.CQ_AISLE = g => {
  if (/légumes|fruits$|pommes de terre|herbes/.test(g)) return 'fl';
  if (/pains|viennoiseries/.test(g)) return 'bo';
  if (/viandes|poissons|mollusques|charcuteries|produits à base de poissons/.test(g)) return 'vi';
  if (/fromages|laits|crèmes|produits laitiers|oeufs|beurres/.test(g)) return 'cr';
  if (/pâtes, riz|farines|céréales de petit/.test(g)) return 'fe';
  if (/légumineuses/.test(g)) return 'co';
  if (/glaces|desserts glacés|sorbets/.test(g)) return 'su';
  return 'ep';
};
(() => {
  const used = new Set(D.BASE_FOODS.map(f => f.cq).filter(Boolean));
  for (const r of CIQUAL) {
    if (used.has(r[0])) continue;
    const g = CIQUAL_GROUPS[r[2]];
    D.BASE_FOODS.push({ id: 'cq-' + r[0], name: r[1], ...cqVals(r), portion: 100, portionLabel: '', base: true, cq: r[0], grp: g, aisle: D.CQ_AISLE(g) });
  }
})();

/* 3. Calcul des nutriments pour une quantité */
D.macrosFor = (food, qty) => {
  const r = (qty || 0) / 100;
  const out = { kcal: Math.round((food.kcal || 0) * r), p: +((food.p || 0) * r).toFixed(1), c: +((food.c || 0) * r).toFixed(1), f: +((food.f || 0) * r).toFixed(1) };
  for (const k of D.EXTRA_KEYS) if (food[k] != null) out[k] = +(food[k] * r).toFixed(k === 'salt' ? 2 : 1);
  return out;
};
D.sumNutrients = arr => {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const m of arr) { t.kcal += m.kcal || 0; t.p += m.p || 0; t.c += m.c || 0; t.f += m.f || 0; for (const k of D.EXTRA_KEYS) if (m[k] != null) t[k] = (t[k] || 0) + m[k]; }
  return t;
};

/* 4. Recherche : tous les mots doivent apparaître ; aliments de l'app et fréquents en premier */
const _norm = new Map();
const normName = f => { let n = _norm.get(f.id); if (n == null || n.src !== f.name) { n = { src: f.name, v: U.norm(f.name).replace(/œ/g, 'oe') }; _norm.set(f.id, n); } return n.v; };
const stem = w => w.length > 3 ? w.replace(/[sx]$/, '') : w;
const wordAt = (n, t) => { let i = n.indexOf(t); while (i >= 0) { if (i === 0 || !/[a-z0-9]/.test(n[i - 1])) return i; i = n.indexOf(t, i + 1); } return -1; };
D.searchFoods = (q, limit = 60) => {
  const toks = U.norm(q).replace(/œ/g, 'oe').split(/[\s,']+/).filter(Boolean).map(stem);
  if (!toks.length) return [];
  const rec = D.recentFoods();
  const res = [];
  for (const f of D.foods()) {
    const n = normName(f);
    let ok = true, first = -1;
    for (const t of toks) { const i = wordAt(n, t); if (i < 0) { ok = false; break; } if (first < 0) first = i; }
    if (!ok) continue;
    let s = (f.cq && !D.CQ_MAP[f.name] ? 20 : 0) + (f.base ? 0 : -8) + (first === 0 ? 0 : (n[first - 1] === ' ' ? 4 : 8)) + n.length / 25;
    if (rec.has(f.id)) s -= 30 + Math.min(20, rec.get(f.id).count * 2);
    if (/préemballé|appertisé|déshydraté|surgelé|restauration/.test(n)) s += 3;
    if (/aliment moyen/.test(n)) s -= 2;
    res.push({ f, s });
  }
  return res.sort((a, b) => a.s - b.s).slice(0, limit).map(x => x.f);
};
D.foodCount = () => D.foods().length;
/* Cru → cuit : repère pour les féculents pesés crus */
D.cookHint = f => {
  const n = U.norm(f.name);
  if (!/(crue?s?\b|sec(he)?s?\b)/.test(n)) return null;
  if (/pates|nouille|spaghetti|coquillette|macaroni/.test(n)) return { x: 2.4, what: 'pâtes' };
  if (/\briz\b/.test(n)) return { x: 2.6, what: 'riz' };
  if (/semoule|couscous|boulgour/.test(n)) return { x: 2.3, what: 'semoule' };
  if (/lentille|pois chiche|haricot|flageolet|pois casse/.test(n)) return { x: 2.5, what: 'légumineuses' };
  if (/quinoa/.test(n)) return { x: 2.7, what: 'quinoa' };
  return null;
};
