'use strict';
/* Cap 100 — cuisine : recettes, planning des repas, liste de courses */

/* ---------- Données : fusion des ingrédients et résolution des recettes ---------- */
D.BASE_FOODS.push(...D.EXTRA_FOODS);
D.BASE_FOODS.forEach(f => { if (D.SHOP_INFO[f.name]) Object.assign(f, D.SHOP_INFO[f.name]); });
D.SHOP_INFO['Lait demi-écrémé'] && Object.assign(D.BASE_FOODS.find(f => f.name === 'Lait demi-écrémé'), { ml: true });
D.BASE_FOODS.find(f => f.name === 'Jus d\'orange').ml = true;
(() => {
  const byName = new Map(D.BASE_FOODS.map(f => [f.name, f.id]));
  for (const r of D.BASE_RECIPES) {
    r.base = true;
    r.ing = r.ing.map(i => { const id = byName.get(i.name); if (!id) console.warn('Ingrédient inconnu', i.name); return { foodId: id, g: i.g }; });
  }
})();
D.CAT_SLOTS = { wrap: ['lunch', 'dinner'], salade: ['lunch', 'dinner'], bowl: ['lunch', 'dinner'], plat: ['dinner', 'lunch'], gratin: ['dinner', 'lunch'], pates: ['lunch', 'dinner'], soupe: ['dinner', 'lunch'], petitdej: ['breakfast'], collation: ['snack'] };
D.CAT_COLOR = { wrap: 'var(--c-run)', salade: 'var(--c-walk)', bowl: 'var(--c-swim)', plat: 'var(--c-strength)', gratin: 'var(--c-hike)', pates: 'var(--c-pasta)', soupe: 'var(--c-weight)', petitdej: 'var(--c-food)', collation: 'var(--c-bike)' };

D.recipes = () => D.memo('recipes', () => {
  const hidden = new Set(DB.setting('hiddenRecipes', []));
  return [...DB.all('recipes'), ...D.BASE_RECIPES.filter(r => !hidden.has(r.id))];
});
D.recipe = id => DB.get('recipes', id) || D.BASE_RECIPES.find(r => r.id === id);
D.recipeMacros = (r, portions = 1) => {
  const calc = () => {
    return D.sumNutrients(r.ing.map(i => { const f = D.food(i.foodId); return f ? D.macrosFor(f, i.g) : {}; }));
  };
  const b = r.id === 'draft' ? calc() : D.memo('rm-' + r.id + '-' + (r.v || 0), calc);
  const out = { kcal: Math.round(b.kcal * portions), p: +(b.p * portions).toFixed(1), c: +(b.c * portions).toFixed(1), f: +(b.f * portions).toFixed(1) };
  for (const k of D.EXTRA_KEYS) if (b[k] != null) out[k] = +(b[k] * portions).toFixed(k === 'salt' ? 2 : 1);
  return out;
};
D.recipeTags = r => {
  const m = D.recipeMacros(r);
  const tags = new Set(r.tags || []);
  if (m.p >= 35 || (m.p * 4) / Math.max(1, m.kcal) >= 0.3) tags.add('proteine');
  if ((r.time || 99) <= 15) tags.add('rapide');
  return [...tags];
};
D.recipeSlots = r => r.slots && r.slots.length ? r.slots : (D.CAT_SLOTS[r.cat] || ['lunch', 'dinner']);
D.recipeFavs = () => new Set(DB.setting('recipeFavs', []));

/* Quantité lisible pour une ligne d'ingrédient */
D.qtyLabel = (food, g) => {
  if (!food) return U.num(g) + ' g';
  const u = food.ml ? 'ml' : 'g';
  if (food.unitG && food.unitG <= 150) {
    const n = g / food.unitG;
    const nice = Math.abs(n - Math.round(n)) < 0.15 ? U.num(Math.round(n)) : U.num(Math.round(n * 2) / 2, n % 1 ? 1 : 0);
    return `${nice} ${Math.round(n * 2) / 2 > 1 ? food.units : food.unit} · ${U.num(g)} ${u}`;
  }
  return `${U.num(g)} ${u}`;
};

/* ---------- Planning ---------- */
D.planOn = date => D.memo('planIdx', () => {
  const idx = new Map();
  for (const p of DB.all('plan')) { if (!idx.has(p.date)) idx.set(p.date, []); idx.get(p.date).push(p); }
  return idx;
}).get(date) || [];
D.planEntry = (date, slot) => DB.get('plan', date + '|' + slot);
D.planLogged = p => D.mealsOn(p.date).some(m => m.planId === p.id);
D.planDayTotals = date => {
  const t = { kcal: 0, p: 0 };
  for (const e of D.planOn(date)) { const r = D.recipe(e.recipeId); if (!r) continue; const m = D.recipeMacros(r, e.portions || 1); t.kcal += m.kcal; t.p += m.p; }
  return t;
};

/* Génération d'une semaine équilibrée, déterministe */
D.autoPlan = ({ from, days = 7, slots = ['breakfast', 'lunch', 'dinner'], favFirst = true, batch = true, replace = false }) => {
  let seed = [...from].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const favs = D.recipeFavs();
  const all = D.recipes();
  const bySlot = {}; for (const s of D.SLOTS.map(x => x.id)) bySlot[s] = all.filter(r => D.recipeSlots(r).includes(s));
  const used = new Map();
  const out = [];
  const tg = D.targets();
  const today = U.today();
  let prevDinner = null;
  for (let k = 0; k < days; k++) {
    const d = U.addDays(from, k);
    if (d < today) { prevDinner = null; continue; }
    const existing = D.planOn(d);
    const fixed = replace ? [] : existing;
    const toFill = slots.filter(s => !fixed.some(e => e.slot === s));
    if (!toFill.length) { const dn = fixed.find(e => e.slot === 'dinner'); prevDinner = dn ? dn.recipeId : null; continue; }
    const base = fixed.reduce((t, e) => { const r = D.recipe(e.recipeId); if (!r) return t; const m = D.recipeMacros(r, e.portions || 1); return { kcal: t.kcal + m.kcal, p: t.p + m.p }; }, { kcal: 0, p: 0 });
    const kTarget = (D.kcalTarget ? D.kcalTarget(d) : tg.kcal) * 0.95;
    let best = null, bestScore = Infinity;
    for (let n = 0; n < 400; n++) {
      const combo = [];
      let kcal = base.kcal, p = base.p, pen = 0;
      for (const s of toFill) {
        const cand = bySlot[s]; if (!cand.length) continue;
        let r;
        if (batch && s === 'lunch' && prevDinner && rnd() < 0.5) r = D.recipe(prevDinner);
        if (!r) {
          const pool = favFirst && rnd() < 0.5 ? cand.filter(x => favs.has(x.id)) : cand;
          const list = pool.length ? pool : cand;
          r = list[Math.floor(rnd() * list.length)];
        }
        const por = s === 'lunch' || s === 'dinner' ? [1, 1, 1.25, 1.5][Math.floor(rnd() * 4)] : 1;
        const m = D.recipeMacros(r, por);
        kcal += m.kcal; p += m.p;
        pen += (used.get(r.id) || 0) * 9;
        if (combo.some(c => c.r.id === r.id)) pen += 40;
        if (s === 'lunch' && batch && prevDinner === r.id && (r.tags || []).some(t => t === 'batch' || t === 'lunchbox')) pen -= 8;
        if (s === 'lunch' && (r.tags || []).includes('lunchbox')) pen -= 2;
        combo.push({ s, r, por });
      }
      const score = Math.abs(kcal - kTarget) / kTarget * 100 + Math.max(0, tg.protein - p) / tg.protein * 70 + Math.max(0, kcal - kTarget * 1.08) / kTarget * 60 + pen;
      if (score < bestScore) { bestScore = score; best = combo; }
    }
    for (const c of best || []) {
      out.push({ id: d + '|' + c.s, date: d, slot: c.s, recipeId: c.r.id, portions: c.por });
      used.set(c.r.id, (used.get(c.r.id) || 0) + 1);
    }
    const dn = (best || []).find(c => c.s === 'dinner') || fixed.find(e => e.slot === 'dinner');
    prevDinner = dn ? (dn.r ? dn.r.id : dn.recipeId) : null;
  }
  return out;
};

/* ---------- Liste de courses ---------- */
D.shoppingFromPlan = (from, to) => {
  const need = new Map(), pantry = new Map();
  for (const e of DB.all('plan')) {
    if (e.date < from || e.date > to) continue;
    const r = D.recipe(e.recipeId); if (!r) continue;
    for (const i of r.ing) {
      const cur = need.get(i.foodId) || { g: 0, recipes: new Set() };
      cur.g += i.g * (e.portions || 1); cur.recipes.add(r.name); need.set(i.foodId, cur);
    }
    for (const p of r.pantry || []) { if (!pantry.has(p)) pantry.set(p, new Set()); pantry.get(p).add(r.name); }
  }
  const items = [];
  for (const [foodId, v] of need) {
    const f = D.food(foodId) || { name: foodId };
    const buy = f.buy;
    items.push({ id: 'auto|' + foodId, foodId, name: buy ? buy.name : f.name, g: Math.round(v.g * (buy ? buy.factor : 1)), aisle: f.aisle || 'au', recipes: [...v.recipes], auto: true });
  }
  for (const [name, rs] of pantry) items.push({ id: 'pantry|' + U.norm(name), name, g: null, aisle: 'pl', recipes: [...rs], auto: true, pantry: true });
  return items;
};
D.shopQty = it => {
  if (it.g == null) return '';
  const f = it.foodId ? D.food(it.foodId) : null;
  const u = f && f.ml ? 'ml' : 'g';
  const w = it.g >= 1000 ? `${U.num(it.g / 1000, 1)} ${u === 'ml' ? 'L' : 'kg'}` : `${U.num(Math.max(5, Math.round(it.g / 10) * 10))} ${u}`;
  if (f && f.unitG && !(f.buy)) {
    const n = Math.max(1, Math.ceil(it.g / f.unitG - 0.1));
    return { main: `${n} ${n > 1 ? f.units : f.unit}`, sub: `≈ ${w}` };
  }
  return { main: w, sub: '' };
};

/* ---------- Onglets de la page Alimentation ---------- */
const NUT_TABS = [['journal', 'Journal', 'note'], ['recettes', 'Recettes', 'food'], ['communaute', 'Communauté', 'smile'], ['planning', 'Planning', 'calendar'], ['courses', 'Courses', 'list']];
const journalRender = Pages.nutrition.render, journalMount = Pages.nutrition.mount;
Object.assign(Pages.nutrition, {
  tab: 'journal',
  render() {
    const shopLeft = DB.all('shopping').filter(i => !i.checked).length;
    const tabs = `<div class="tabs nut-tabs">${NUT_TABS.map(([v, l, ic]) => `<button data-act="nutTab" data-v="${v}" class="${this.tab === v ? 'on' : ''}">${U.icon(ic, 'sm')}${l}${v === 'courses' && shopLeft ? ` <span class="pill planned" style="height:18px">${shopLeft}</span>` : ''}</button>`).join('')}</div>`;
    if (this.tab === 'journal') return `<div class="nutwrap">${journalRender.call(this).replace('<div class="row wrap" style="margin-bottom:16px">', tabs + '<div class="row wrap" style="margin-bottom:16px">')}</div>`;
    const head = {
      recettes: ['Recettes', 'Des idées simples et riches en protéines, calculées pour une portion. Planifie-les ou ajoute-les à ton journal en un geste.', `<button class="btn primary" data-act="recipeNew">${U.icon('plus', 'sm')}Créer une recette</button>`],
      communaute: ['Communauté', 'Les recettes partagées par tes proches, avec leur prénom. Toute recette que tu crées y apparaît aussi (tu peux choisir de ne pas la partager).', Cloud.user ? `<button class="btn primary" data-act="recipeNew">${U.icon('plus', 'sm')}Partager une recette</button>` : ''],
      planning: ['Planning des repas', 'Organise ta semaine, vérifie qu\'elle colle à tes cibles, puis génère la liste de courses.', `<button class="btn" data-act="planShop">${U.icon('list', 'sm')}Liste de courses</button><button class="btn primary" data-act="planAuto">${U.icon('sparkle', 'sm')}Proposer ma semaine</button>`],
      courses: ['Liste de courses', 'Générée depuis ton planning, regroupée par rayon, avec les quantités à acheter (riz sec, viande crue…).', '']
    }[this.tab];
    return `<div class="nutwrap"><div class="page-head"><div><h1>${head[0]}</h1><div class="sub">${head[1]}</div></div><div class="actions">${head[2]}</div></div>${tabs}<div>${this['tab_' + this.tab]()}</div></div>`;
  },
  mount(root) {
    if (this.tab === 'journal') { journalMount.call(this, root); return; }
    if (this.tab === 'recettes') { const q = root.querySelector('#rq'); if (q) q.addEventListener('input', U.debounce(() => { this.rq = q.value; this.rshow = 24; const g = root.querySelector('#rgrid'); g.innerHTML = this.recipeGrid(); Charts.animateArcs(g); }, 120)); }
    if (this.tab === 'communaute') {
      const q = root.querySelector('#cq'); if (q) q.addEventListener('input', U.debounce(() => { this.cq = q.value; const g = root.querySelector('#cgrid'); const tmp = document.createElement('div'); tmp.innerHTML = Acc.tab(); g.innerHTML = tmp.querySelector('#cgrid').innerHTML; Charts.animateArcs(g); }, 150));
      if (Cloud.user && Date.now() - (this.cfetch || 0) > 60000) { this.cfetch = Date.now(); Cloud.fetchCommunity().catch(() => {}); }
    }
    if (this.tab === 'courses') { const f = root.querySelector('#shop-add'); if (f) f.addEventListener('submit', e => { e.preventDefault(); A.shopAdd(); }); }
  },

  /* ----- Recettes ----- */
  rcat: 'all', rtags: [], rsort: 'reco', rq: '',
  tab_communaute() { return Acc.tab(); },
  tab_recettes() {
    const cats = [['all', 'Toutes'], ...D.RECIPE_CATS.map(c => [c.id, c.label]), ['fav', 'Favoris']];
    return `${this.suggestBlock()}
      <div class="stack" style="gap:10px;margin-bottom:16px">
        <div class="row wrap"><div class="input-unit grow" style="min-width:200px;max-width:420px"><input class="input" id="rq" placeholder="Rechercher : poulet, wrap, feta…" value="${U.esc(this.rq)}" autocomplete="off"><em>${U.icon('search', 'sm')}</em></div>
          <select class="input" id="rsort" data-change="rSort" style="width:auto;height:44px;font-size:14px">${[['reco', 'Recommandées'], ['p', 'Plus de protéines'], ['kcal', 'Moins de calories'], ['eur', 'Moins chères'], ['time', 'Plus rapides']].map(([v, l]) => `<option value="${v}" ${this.rsort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="chips scroll">${cats.map(([v, l]) => `<button class="chip ${this.rcat === v ? 'on' : ''}" data-act="rCat" data-v="${v}">${v === 'fav' ? U.icon('star', 'sm') : ''}${l}</button>`).join('')}</div>
        <div class="chips scroll">${Object.entries(D.RECIPE_TAGS).map(([k, l]) => `<button class="chip ${this.rtags.includes(k) ? 'on' : ''}" data-act="rTag" data-v="${k}" style="height:28px;font-size:12px">${l}</button>`).join('')}</div>
      </div>
      <div class="recipe-grid" id="rgrid">${this.recipeGrid()}</div>`;
  },
  filteredRecipes() {
    const qt = U.norm(this.rq).split(/[\s,]+/).filter(Boolean).map(t => t.length > 3 ? t.replace(/s$/, '') : t), favs = D.recipeFavs();
    let list = D.recipes().filter(r => {
      if (this.rcat === 'fav' ? !favs.has(r.id) : (this.rcat !== 'all' && r.cat !== this.rcat)) return false;
      const tags = D.recipeTags(r);
      if (this.rtags.some(t => !tags.includes(t))) return false;
      if (qt.length) { const hay = U.norm(r.name + ' ' + r.ing.map(i => (D.food(i.foodId) || {}).name).join(' ') + ' ' + ((D.RECIPE_CATS.find(c => c.id === r.cat) || {}).label || '')); if (qt.some(t => !hay.includes(t))) return false; }
      return true;
    });
    const M = r => D.recipeMacros(r);
    const sorters = {
      reco: (a, b) => (favs.has(b.id) - favs.has(a.id)) || (M(b).p / M(b).kcal - M(a).p / M(a).kcal),
      p: (a, b) => M(b).p - M(a).p, kcal: (a, b) => M(a).kcal - M(b).kcal, eur: (a, b) => D.recipeCost(a).eur - D.recipeCost(b).eur, time: (a, b) => (a.time || 99) - (b.time || 99)
    };
    return list.sort(sorters[this.rsort]);
  },
  recipeGrid() {
    const list = this.filteredRecipes();
    if (!list.length) return `<div class="card" style="grid-column:1/-1">${UI.empty('food', 'Aucune recette ne correspond', this.rcat === 'fav' ? 'Touche l\'étoile d\'une recette pour la retrouver ici.' : 'Retire un filtre ou crée ta propre recette.', `<button class="btn sm primary" data-act="recipeNew">Créer une recette</button>`)}</div>`;
    const n = this.rshow || 24, more = list.length - n;
    return list.slice(0, n).map(r => recipeCard(r)).join('') + (more > 0 ? `<div style="grid-column:1/-1;text-align:center"><button class="btn" data-act="rMore">${U.icon('plus', 'sm')}Voir ${Math.min(more, 24)} recettes de plus <span class="faint">(${list.length} au total)</span></button></div>` : '');
  },
  suggestBlock() {
    const today = U.today();
    const tot = D.dayTotals(today), tg = D.targets();
    const kLeft = (D.kcalTarget ? D.kcalTarget(today) : tg.kcal) - tot.kcal, pLeft = tg.protein - tot.p;
    if (kLeft < 250) return '';
    const h = new Date().getHours();
    const loggedSlots = new Set(D.mealsOn(today).map(m => m.slot));
    const order = h < 10 ? ['breakfast', 'lunch', 'dinner'] : h < 15 ? ['lunch', 'snack', 'dinner'] : h < 18 ? ['snack', 'dinner'] : ['dinner', 'snack'];
    const slot = order.find(s => !loggedSlots.has(s)) || order[order.length - 1];
    const share = slot === 'snack' ? 0.25 : slot === 'breakfast' ? 0.3 : (slot === 'dinner' || loggedSlots.has('dinner')) ? 1 : 0.55;
    const kAim = kLeft * share, pAim = Math.max(20, pLeft * share);
    const best = D.recipes().filter(r => D.recipeSlots(r).includes(slot)).map(r => { const m = D.recipeMacros(r); return { r, m, s: Math.abs(m.kcal - kAim) / kAim + Math.max(0, pAim - m.p) / pAim * 1.5 + (m.kcal > kLeft ? 2 : 0) }; }).sort((a, b) => a.s - b.s).slice(0, 3);
    if (!best.length) return '';
    return `<section class="card suggest" style="margin-bottom:18px"><div class="card-h"><span class="ic-badge sm" style="--c:var(--goal)">${U.icon('sparkle')}</span><div class="grow"><div class="eyebrow">Suggestions · ${D.slotLabel(slot).toLowerCase()}</div><h3 style="margin:2px 0 0;font-size:15px">Il te reste ≈ ${U.num(kLeft)} kcal${pLeft > 5 ? ` et ${U.num(pLeft)} g de protéines` : ''} aujourd'hui</h3></div></div>
      <div class="grid g-3 sug-grid" style="gap:10px">${best.map(({ r, m }) => `<div class="mini-recipe clickable" data-act="recipeOpen" data-id="${r.id}"><span class="ic-badge sm" style="--c:${D.CAT_COLOR[r.cat]}">${U.icon((D.RECIPE_CATS.find(c => c.id === r.cat) || {}).icon || 'food')}</span><div class="grow" style="min-width:0"><b>${U.esc(r.name)}</b><div class="xs faint">${U.num(m.kcal)} kcal · P ${U.num(m.p)} g · ${r.time} min</div></div><button class="icon-btn sm" data-act="recipeLogQuick" data-id="${r.id}" data-slot="${slot}" title="Ajouter à aujourd'hui">${U.icon('plus')}</button></div>`).join('')}</div></section>`;
  },

  /* ----- Planning ----- */
  pweek: null,
  tab_planning() {
    const today = U.today();
    const ws = this.pweek || (this.pweek = U.weekStart(today));
    const days = U.range(ws, U.addDays(ws, 6));
    const tg = D.targets();
    const tot = days.map(d => D.planDayTotals(d));
    const planned = days.filter((d, i) => tot[i].kcal > 0);
    const uniq = new Set(days.flatMap(d => D.planOn(d).map(e => e.recipeId)));
    const weekCost = U.sum(days.flatMap(d => D.planOn(d).map(e => { const r = D.recipe(e.recipeId); return r ? D.recipeCost(r, e.portions || 1).eur : 0; })));
    return `<div class="row wrap" style="margin-bottom:16px"><div class="datebar"><button class="icon-btn" data-act="planWeek" data-d="-7" aria-label="Semaine précédente">${U.icon('chevL')}</button><span class="lbl">${ws === U.weekStart(today) ? 'Cette semaine' : ws > today ? 'Semaine prochaine' : 'Semaine du'} · ${U.fmtShort(ws)}</span><button class="icon-btn" data-act="planWeek" data-d="7" aria-label="Semaine suivante">${U.icon('chevR')}</button></div>
        <span class="grow"></span>${planned.length ? `<button class="btn sm ghost danger" data-act="planClear">${U.icon('trash', 'sm')}Vider la semaine</button>` : ''}</div>
      <div class="grid g-4" style="margin-bottom:16px">
        <div class="card flat"><div class="kpi"><span class="l">Jours planifiés</span><span class="v">${planned.length}<small>/ 7</small></span></div></div>
        <div class="card flat"><div class="kpi"><span class="l">Calories moyennes prévues</span><span class="v">${planned.length ? U.num(U.avg(tot.filter(t => t.kcal).map(t => t.kcal))) : '–'}<small>kcal</small></span><span class="d faint">cible ${U.num(tg.kcal)}</span></div></div>
        <div class="card flat"><div class="kpi"><span class="l">Protéines moyennes prévues</span><span class="v">${planned.length ? U.num(U.avg(tot.filter(t => t.kcal).map(t => t.p))) : '–'}<small>g</small></span><span class="d faint">cible ${U.num(tg.protein)}</span></div></div>
        <div class="card flat clickable" data-act="planShop"><div class="kpi"><span class="l">Budget repas prévus</span><span class="v">${U.eur0(weekCost)}</span><span class="d faint">${planned.length ? `≈ ${U.eur(weekCost / planned.length)} / jour · ${uniq.size} recettes` : `chez ${U.esc(D.store(D.mainStore()).name)}`}</span></div></div>
      </div>
      <div class="planner">${days.map((d, i) => {
        const t = tot[i]; const k = D.kcalTarget ? D.kcalTarget(d) : tg.kcal; const r = t.kcal / k;
        const st = !t.kcal ? '' : r < 0.85 ? 'low' : r > 1.1 ? 'high' : 'ok';
        return `<div class="pl-day ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}"><div class="pl-h"><b>${U.dayShort(i)} ${U.parse(d).getDate()}</b>${d === today ? '<span class="pill planned">Aujourd\'hui</span>' : ''}</div>
          ${D.SLOTS.map(s => { const e = D.planEntry(d, s.id); const rc = e && D.recipe(e.recipeId); if (!rc) return `<button class="pl-cell empty" data-act="planPick" data-date="${d}" data-slot="${s.id}"><span class="xs faint">${s.label}</span>${U.icon('plus', 'sm')}</button>`; const m = D.recipeMacros(rc, e.portions || 1); const logged = D.planLogged(e); return `<button class="pl-cell ${logged ? 'logged' : ''}" data-act="planCell" data-id="${e.id}" style="--c:${D.CAT_COLOR[rc.cat]}"><span class="xs faint">${s.label}${logged ? ' · noté ✓' : ''}</span><span class="pl-n">${U.esc(rc.name)}</span><span class="xs faint">${e.portions && e.portions !== 1 ? '× ' + U.num(e.portions, 2) + ' · ' : ''}${U.num(m.kcal)} kcal · P ${U.num(m.p)} · ${U.eur(D.recipeCost(rc, e.portions || 1).eur)}</span></button>`; }).join('')}
          <div class="pl-f ${st}">${t.kcal ? `<div class="row between xs"><span>${U.num(t.kcal)} kcal</span><span>P ${U.num(t.p)} g</span></div>${UI.bar(r, st === 'ok' ? 'var(--good)' : 'var(--goal)')}` : '<span class="xs faint">Rien de prévu</span>'}</div></div>`;
      }).join('')}</div>
      <p class="hint">Barre verte : journée prévue entre 85 et 110 % de ta cible calorique. Les repas du planning apparaissent dans ton journal, prêts à être validés en un geste.</p>`;
  },

  /* ----- Courses ----- */
  tab_courses() {
    const items = DB.all('shopping');
    const range = DB.setting('shopRange', null);
    const left = items.filter(i => !i.checked).length;
    const main = D.mainStore();
    const bk = D.basket(items.filter(i => !i.checked));
    const bkAll = D.basket(items);
    const multi = bk.byStore.size > 1 || (bk.byStore.size === 1 && !bk.byStore.has(main));
    const head = `<div class="grid g-dash" style="margin-bottom:16px">
      <section class="card span-7"><div class="row wrap" style="gap:12px">
        <div class="grow"><div class="eyebrow">${range ? `Planning du ${U.fmtShort(range.from)} au ${U.fmtShort(range.to)}` : 'Liste libre'}</div><div class="row" style="gap:10px;margin-top:4px"><b class="mid">${items.length - left}<span class="unit">/ ${items.length}</span></b><span class="muted small">articles dans le panier</span></div>
          <div style="margin-top:8px;max-width:360px">${UI.bar(items.length ? (items.length - left) / items.length : 0, 'var(--good)')}</div></div>
        <div class="row wrap" style="gap:6px"><button class="btn sm" data-act="planShop">${U.icon('repeat', 'sm')}Depuis le planning</button><button class="btn sm" data-act="shopCopy" ${items.length ? '' : 'disabled'}>${U.icon('copy', 'sm')}Copier</button>${navigator.share ? `<button class="btn sm" data-act="shopShare" ${items.length ? '' : 'disabled'}>${U.icon('upload', 'sm')}Partager</button>` : ''}<button class="btn sm ghost" data-act="shopClearDone" ${items.length - left ? '' : 'disabled'}>Retirer les cochés</button></div></div>
      <form id="shop-add" class="row wrap" style="margin-top:14px;gap:8px"><input class="input grow" id="shop-name" placeholder="Ajouter un article : lessive, café…" style="min-width:160px"><select class="input" id="shop-aisle" style="width:auto">${D.AISLES.filter(a => a.id !== 'pl').map(a => `<option value="${a.id}" ${a.id === 'au' ? 'selected' : ''}>${a.label}</option>`).join('')}</select><button class="btn primary" type="submit">${U.icon('plus', 'sm')}Ajouter</button></form></section>
      <section class="card span-5 budget"><div class="card-h"><div><div class="eyebrow">Budget estimé</div><h3>Reste à acheter</h3></div><span class="spacer"></span><button class="btn sm" data-act="shopCompare" ${items.length ? '' : 'disabled'}>${U.icon('chart', 'sm')}Comparer</button></div>
        <div class="row" style="gap:8px;align-items:baseline"><span class="big">${U.eur0(bk.till)}</span><span class="muted small">à la caisse</span></div>
        <div class="small muted" style="margin-top:4px">Dont <b>${U.eur(bk.used)}</b> réellement utilisés par tes repas prévus${bk.till - bk.used > 0.5 ? ` · ${U.eur(bk.till - bk.used)} restent en stock (paquets entiers)` : ''}.${bk.unknown ? ` ${bk.unknown} article${bk.unknown > 1 ? 's' : ''} sans prix.` : ''}</div>
        <label class="field" style="margin-top:12px"><span>Mon enseigne principale</span><select class="input" data-change="setMainStore" id="main-store">${D.STORES.map(x => `<option value="${x.id}" ${x.id === main ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
        ${multi ? `<div class="stack" style="gap:4px;margin-top:10px">${[...bk.byStore.entries()].sort((a, b) => b[1] - a[1]).map(([sid, v]) => `<div class="row between small"><span>${U.esc(D.store(sid).name)}</span><b class="tabnum">${U.eur(v)}</b></div>`).join('')}</div>` : ''}
        <p class="hint" style="margin:10px 0 0">Estimation en marque distributeur${bkAll.till !== bk.till ? `, liste complète ≈ ${U.eur0(bkAll.till)}` : ''}. Touche un article pour changer d'enseigne ou saisir ton prix réel.</p></section></div>`;
    if (!items.length) return head + `<div class="card">${UI.empty('list', 'Liste vide', 'Planifie quelques repas puis génère la liste : les quantités sont additionnées et converties en quantités à acheter.', '<button class="btn primary sm" data-act="goPlanning">Ouvrir le planning</button>')}</div>`;
    return head + `<div class="shop-cols">${D.AISLES.map(a => {
      const arr = items.filter(i => (i.aisle || 'au') === a.id).sort((x, y) => (x.checked - y.checked) || x.name.localeCompare(y.name, 'fr'));
      if (!arr.length) return '';
      return `<section class="card shop-sec"><div class="card-h"><span class="ic-badge sm" style="--c:${a.id === 'pl' ? 'var(--ink-3)' : 'var(--c-walk)'}">${U.icon(a.icon)}</span><h3>${a.label}</h3><span class="spacer"></span><span class="small tabnum muted">${U.eur(D.basket(arr.filter(i => !i.checked)).till)}</span><span class="xs faint">${arr.filter(i => !i.checked).length}</span></div>
        <div class="list">${arr.map(i => { const q = D.shopQty(i); return `<div class="shop-it ${i.checked ? 'done' : ''}"><button class="shop-ck" data-act="shopToggle" data-id="${U.esc(i.id)}" aria-label="${i.checked ? 'Décocher' : 'Cocher'} ${U.esc(i.name)}">${U.icon('check', 'sm')}</button><button class="grow shop-body" data-act="shopItem" data-id="${U.esc(i.id)}" style="min-width:0;text-align:left"><div class="row between" style="gap:8px"><span class="t">${U.esc(i.name)}</span>${q && q.main ? `<b class="tabnum small" style="white-space:nowrap">${q.main}</b>` : ''}</div><div class="row between xs" style="gap:8px"><span class="faint" style="min-width:0">${q && q.sub ? q.sub + (i.recipes && i.recipes.length ? ' · ' : '') : ''}${i.recipes ? U.esc(i.recipes.slice(0, 2).join(', ')) + (i.recipes.length > 2 ? '…' : '') : ''}</span>${(() => { const c = D.itemCost(i); const sid = D.itemStore(i); const chip = sid !== main ? `<span class="store-chip">${U.esc(D.store(sid).name)}</span>` : ''; return c.pantry ? '' : `<span style="white-space:nowrap">${chip}${c.known ? `<b class="tabnum price">${U.eur(c.till)}</b>` : '<span class="faint">prix ?</span>'}</span>`; })()}</div></button><button class="icon-btn sm" data-act="shopDel" data-id="${U.esc(i.id)}" aria-label="Retirer">${U.icon('x')}</button></div>`; }).join('')}</div></section>`;
    }).join('')}</div>`;
  }
});

/* ---------- Carte recette (avec anneau de répartition des macros) ---------- */
function macroDonut(m, size = 58) {
  const kp = m.p * 4, kc = m.c * 4, kf = m.f * 9, tot = kp + kc + kf || 1;
  const segs = [[kp, 'var(--c-strength)'], [kc, 'var(--c-food)'], [kf, 'var(--c-swim)']];
  let acc = 0;
  const arcs = segs.map(([v, c]) => { const len = v / tot * 100; const s = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="${Math.max(0, len - 1.5).toFixed(2)} ${(100 - Math.max(0, len - 1.5)).toFixed(2)}" stroke-dashoffset="${(25 - acc).toFixed(2)}"/>`; acc += len; return s; }).join('');
  return `<svg viewBox="0 0 42 42" width="${size}" height="${size}" aria-label="Protéines ${Math.round(kp / tot * 100)} %, glucides ${Math.round(kc / tot * 100)} %, lipides ${Math.round(kf / tot * 100)} %"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--surface-3)" stroke-width="5"/>${arcs}<text x="21" y="23.5" text-anchor="middle" style="font:700 8px var(--display);fill:var(--ink)">${Math.round(kp / tot * 100)}%</text></svg>`;
}
function recipeCard(r) {
  const m = D.recipeMacros(r), tags = D.recipeTags(r), fav = D.recipeFavs().has(r.id);
  const cat = D.RECIPE_CATS.find(c => c.id === r.cat) || D.RECIPE_CATS[0];
  return `<article class="card recipe clickable" data-act="recipeOpen" data-id="${r.id}" style="--c:${D.CAT_COLOR[r.cat]}">
    <div class="rc-top"><span class="rc-cat">${U.icon(cat.icon, 'sm')}${cat.label}</span><span class="grow"></span><span class="xs faint">${U.icon('clock', 'sm')} ${r.time || '?'} min</span>${r.community ? '' : `<button class="icon-btn sm rc-fav ${fav ? 'on' : ''}" data-act="recipeFav" data-id="${r.id}" aria-label="${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${U.icon('star')}</button>`}</div>
    <h3>${U.esc(r.name)}</h3>
    <div class="rc-body">${macroDonut(m)}<div class="grow"><div class="rc-kcal"><b>${U.num(m.kcal)}</b> kcal <span class="faint xs">/ portion</span><span class="rc-eur">≈ ${U.eur(D.recipeCost(r).eur)}</span></div><div class="macro-line"><span class="m-p">P <b>${U.num(m.p)}</b></span><span class="m-c">G <b>${U.num(m.c)}</b></span><span class="m-f">L <b>${U.num(m.f)}</b></span></div></div></div>
    <div class="rc-tags">${tags.slice(0, 3).map(t => `<span class="pill ${t === 'proteine' ? 'planned' : 'rest'}">${D.RECIPE_TAGS[t]}</span>`).join('')}${r.community ? `<span class="pill planned">${U.icon('smile', 'sm')}${r.mine ? 'Toi' : U.esc(r.author)}</span>` : r.base ? '' : `<span class="pill demo">Perso</span>${r.shared && Cloud.user ? '<span class="pill planned">Partagée</span>' : ''}`}</div>
    <div class="rc-actions"><button class="btn sm" data-act="recipePlan" data-id="${r.id}">${U.icon('calendar', 'sm')}Planifier</button><button class="btn sm primary" data-act="recipeLog" data-id="${r.id}">${U.icon('plus', 'sm')}Journal</button></div>
  </article>`;
}

/* ---------- Actions : navigation & filtres ---------- */
A.nutTab = el => { Pages.nutrition.tab = el.dataset.v; App.renderView(false); };
A.rCat = el => { Pages.nutrition.rcat = el.dataset.v; Pages.nutrition.rshow = 24; App.renderView(false); };
A.rMore = () => { const p = Pages.nutrition; p.rshow = (p.rshow || 24) + 24; const g = document.querySelector('#rgrid'); if (g) { g.innerHTML = p.recipeGrid(); Charts.animateArcs(g); } };
A.rTag = el => { const p = Pages.nutrition; p.rtags = p.rtags.includes(el.dataset.v) ? p.rtags.filter(t => t !== el.dataset.v) : [...p.rtags, el.dataset.v]; App.renderView(false); };
A.rSort = el => { Pages.nutrition.rsort = el.value; App.renderView(false); };
A.goRecipes = el => { UI.closeAll(); const p = Pages.nutrition; p.tab = 'recettes'; p.rtags = el && el.dataset.tag ? [el.dataset.tag] : []; p.rcat = el && el.dataset.cat ? el.dataset.cat : 'all'; App.go('repas'); };
A.goPlanning = () => { UI.closeAll(); Pages.nutrition.tab = 'planning'; App.go('repas'); };
A.recipeFav = async (el, e) => {
  e && e.stopPropagation();
  const favs = D.recipeFavs(); const id = el.dataset.id;
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  await DB.setSetting('recipeFavs', [...favs]);
  UI.toast(favs.has(id) ? 'Ajoutée aux favoris' : 'Retirée des favoris');
  App.changed();
};

/* ---------- Détail d'une recette ---------- */
A.recipeOpen = (el, e) => {
  if (e && e.target.closest('button:not([data-act="recipeOpen"]), a')) return;
  const r = D.recipe(el.dataset.id); if (!r) return;
  const st = { por: 1 };
  const cat = D.RECIPE_CATS.find(c => c.id === r.cat) || {};
  UI.open({
    title: r.name, sub: `${cat.label || ''} · ${r.time || '?'} min${r.community ? ` · partagée par ${r.mine ? 'toi' : r.author}` : r.base ? '' : ' · recette perso'}`, size: 'lg', live: true,
    body: () => {
      const m = D.recipeMacros(r, st.por);
      return `<div class="recipe-detail">
        <div class="stack">
          <div class="row wrap" style="gap:14px">${macroDonut(m, 84)}<div class="grow"><div class="rc-kcal" style="font-size:15px"><b style="font-size:34px">${U.num(m.kcal)}</b> kcal</div><div class="small muted" style="margin:2px 0 4px">≈ <b>${U.eur(D.recipeCost(r, st.por).eur)}</b> chez ${U.esc(D.store(D.mainStore()).name)} (${U.eur(D.recipeCost(r).eur)} la portion)</div><div class="macro-line" style="font-size:14px"><span class="m-p">Protéines <b>${U.num(m.p)} g</b></span><span class="m-c">Glucides <b>${U.num(m.c)} g</b></span><span class="m-f">Lipides <b>${U.num(m.f)} g</b></span></div><div class="xs muted" style="margin-top:4px">Fibres ${m.fib != null ? U.num(m.fib, 1) : '–'} g · Sucres ${m.sug != null ? U.num(m.sug, 1) : '–'} g · Sel ${m.salt != null ? U.num(m.salt, 1) : '–'} g</div></div></div>
          <details class="nutri-wrap"><summary>Valeurs nutritionnelles complètes${st.por !== 1 ? ` (${U.num(st.por, 1)} portions)` : ''}</summary><table class="t nutri"><tbody>${D.NUTRIENTS.map(n => `<tr class="${n.sub ? 'sub' : ''}"><td>${n.l}</td><td class="r"><b>${m[n.k] == null ? '–' : U.num(m[n.k], n.d) + ' ' + n.u}</b></td></tr>`).join('')}</tbody></table><p class="xs faint" style="margin:6px 0 0">Calculé ingrédient par ingrédient (table Ciqual de l'Anses).</p></details>
          <div class="row" style="gap:10px"><span class="label">Portions</span><div class="stepper" style="gap:6px"><button type="button" data-rpor="-0.5" style="width:40px;height:40px;font-size:18px" aria-label="Moins">−</button><b class="mid" style="min-width:48px;text-align:center">${U.num(st.por, st.por % 1 ? 1 : 0)}</b><button type="button" data-rpor="0.5" style="width:40px;height:40px;font-size:18px" aria-label="Plus">+</button></div></div>
          <div><div class="eyebrow" style="margin-bottom:6px">Ingrédients</div><div class="list">${r.ing.map(i => { const f = D.food(i.foodId); const raw = f && f.buy && f.buy.factor && /\(([^)]+)\)/.exec(f.buy.name); return `<div class="li" style="padding:8px 0"><span class="grow"><span class="t" style="white-space:normal">${U.esc(f ? f.name : '?')}</span></span><span class="end small" style="text-align:right">${D.qtyLabel(f, Math.round(i.g * st.por))}${raw ? `<br><span class="xs faint">soit ≈ ${U.num(Math.round(i.g * st.por * f.buy.factor / 5) * 5)} g ${U.esc(raw[1])}</span>` : ''}</span></div>`; }).join('')}</div>
            ${r.pantry && r.pantry.length ? `<p class="small muted" style="margin:8px 0 0"><b>Placard :</b> ${U.esc(r.pantry.join(', '))}</p>` : ''}</div>
        </div>
        <div class="stack"><div class="eyebrow">Préparation</div><ol class="steps">${(r.steps || []).map(s => `<li>${U.esc(s)}</li>`).join('')}</ol>
          ${r.tip ? `<div class="note">${U.icon('sparkle', 'sm')}<span>${U.esc(r.tip)}</span></div>` : ''}
          <div class="rc-tags">${D.recipeTags(r).map(t => `<span class="pill ${t === 'proteine' ? 'planned' : 'rest'}">${D.RECIPE_TAGS[t]}</span>`).join('')}</div></div>
      </div>`;
    },
    footer: () => `${r.community ? '' : `<button class="btn ghost" data-act="recipeFav" data-id="${r.id}">${U.icon('star', 'sm')}${D.recipeFavs().has(r.id) ? 'Favori' : 'Favoris'}</button>`}${r.community ? `<button class="btn ghost" data-act="recipeEdit" data-id="${r.id}" data-copy="1">${U.icon('copy', 'sm')}Copier dans mes recettes</button>${r.mine ? `<button class="btn ghost" data-act="commUnshare" data-id="${r.id}">Retirer</button>` : Cloud.isAdmin() ? `<button class="btn ghost danger" data-act="commAdminDel" data-id="${r.id}">${U.icon('trash', 'sm')}</button>` : ''}` : r.base ? `<button class="btn ghost" data-act="recipeEdit" data-id="${r.id}" data-copy="1">${U.icon('copy', 'sm')}Dupliquer</button>` : `<button class="btn ghost" data-act="recipeEdit" data-id="${r.id}">${U.icon('edit', 'sm')}Modifier</button>${Cloud.user ? r.shared ? `<button class="btn ghost" data-act="commUnshare" data-id="${r.id}" title="Retirer de la communauté">${U.icon('smile', 'sm')}Partagée ✓</button>` : `<button class="btn ghost" data-act="commShare" data-id="${r.id}">${U.icon('smile', 'sm')}Partager</button>` : ''}`}<span class="spacer"></span><button class="btn" data-act="recipePlan" data-id="${r.id}" data-por="${st.por}">${U.icon('calendar', 'sm')}Planifier</button><button class="btn primary" data-act="recipeLog" data-id="${r.id}" data-por="${st.por}">${U.icon('plus', 'sm')}Ajouter au journal</button>`,
    onMount: mm => mm.el.querySelectorAll('[data-rpor]').forEach(b => b.addEventListener('click', () => { st.por = U.clamp(st.por + +b.dataset.rpor, 0.5, 8); mm.render(); }))
  });
};

/* Ajouter une recette au journal */
A.recipeLog = el => {
  const r = D.recipe(el.dataset.id);
  const st = { date: Pages.nutrition.date || U.today(), slot: D.recipeSlots(r).includes(F.guessSlot()) ? F.guessSlot() : D.recipeSlots(r)[0], por: +(el.dataset.por || 1) };
  UI.open({
    title: 'Ajouter au journal', sub: r.name, size: 'sm',
    body: () => { const m = D.recipeMacros(r, st.por); return `<div class="field"><span>Jour</span><input type="date" id="rl-date" value="${st.date}" max="${U.today()}"></div>
      <div class="field"><span>Repas</span><div class="seg full">${D.SLOTS.map(s => `<button type="button" data-rlslot="${s.id}" class="${st.slot === s.id ? 'on' : ''}">${s.label}</button>`).join('')}</div></div>
      <div class="field"><span>Portions</span><div class="seg full">${[0.5, 1, 1.5, 2].map(v => `<button type="button" data-rlpor="${v}" class="${st.por === v ? 'on' : ''}">${U.num(v, v % 1 ? 1 : 0)}</button>`).join('')}</div></div>
      <div class="qty-live"><div><b>${U.num(m.kcal)}</b><span>kcal</span></div><div><b class="m-p">${U.num(m.p)}</b><span>protéines</span></div><div><b class="m-c">${U.num(m.c)}</b><span>glucides</span></div><div><b class="m-f">${U.num(m.f)}</b><span>lipides</span></div></div>`; },
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="recipeLogSave" data-id="${r.id}">Ajouter</button>`,
    onMount: m => {
      m.st = st;
      m.el.querySelector('#rl-date').addEventListener('change', e => { st.date = e.target.value; });
      m.el.querySelectorAll('[data-rlslot]').forEach(b => b.addEventListener('click', () => { st.slot = b.dataset.rlslot; m.render(); }));
      m.el.querySelectorAll('[data-rlpor]').forEach(b => b.addEventListener('click', () => { st.por = +b.dataset.rlpor; m.render(); }));
    }
  });
};
async function logRecipe(r, date, slot, por, planId = null) {
  const m = D.recipeMacros(r, por);
  const meal = { id: U.uid(), date, slot, t: Date.now(), foodId: null, recipeId: r.id, portions: por, planId, name: r.name + (por !== 1 ? ` (× ${U.num(por, por % 1 ? 1 : 0)})` : ''), qty: null, unit: null, ...m };
  await DB.put('meals', meal);
  return meal;
}
A.recipeLogSave = async el => {
  const m = UI.top(); const st = m.st; const r = D.recipe(el.dataset.id);
  if (!st.date) { UI.toast('Choisis une date', { type: 'err' }); return; }
  const meal = await logRecipe(r, st.date, st.slot, st.por);
  m.close(); const parent = UI.top(); if (parent && parent.opts.size === 'lg') parent.close();
  UI.toast(`${r.name} ajouté · ${U.num(meal.kcal)} kcal`, { action: { label: 'Annuler', fn: async () => { await DB.del('meals', meal.id); App.changed(); } } });
  App.changed();
};
A.recipeLogQuick = async (el, e) => {
  e && e.stopPropagation();
  const r = D.recipe(el.dataset.id);
  const meal = await logRecipe(r, U.today(), el.dataset.slot, 1);
  UI.toast(`${r.name} ajouté · ${U.num(meal.kcal)} kcal`, { action: { label: 'Annuler', fn: async () => { await DB.del('meals', meal.id); App.changed(); } } });
  App.changed();
};

/* Planifier une recette */
A.recipePlan = el => {
  const r = D.recipe(el.dataset.id);
  const today = U.today();
  const days = U.range(today, U.addDays(today, 13));
  const st = { date: el.dataset.date || today, slot: el.dataset.slot || D.recipeSlots(r)[0], por: +(el.dataset.por || 1) };
  UI.open({
    title: 'Planifier', sub: r.name, size: 'sm',
    body: () => { const ex = D.planEntry(st.date, st.slot); const exr = ex && D.recipe(ex.recipeId); return `<div class="field"><span>Jour</span><div class="day-pick">${days.map(d => `<button type="button" data-pd="${d}" class="${st.date === d ? 'on' : ''}"><small>${U.dayShort(U.dow(d))}</small><b>${U.parse(d).getDate()}</b>${D.planOn(d).length ? '<i></i>' : ''}</button>`).join('')}</div></div>
      <div class="field"><span>Repas</span><div class="seg full">${D.SLOTS.map(s => `<button type="button" data-ps="${s.id}" class="${st.slot === s.id ? 'on' : ''}">${s.label}</button>`).join('')}</div></div>
      <div class="field"><span>Portions</span><div class="seg full">${[1, 1.25, 1.5, 2].map(v => `<button type="button" data-pp="${v}" class="${st.por === v ? 'on' : ''}">${U.num(v, v % 1 ? 2 : 0)}</button>`).join('')}</div><small>${U.num(D.recipeMacros(r, st.por).kcal)} kcal · P ${U.num(D.recipeMacros(r, st.por).p)} g</small></div>
      ${exr && exr.id !== r.id ? `<div class="note warn">${U.icon('info', 'sm')}<span>Remplacera « ${U.esc(exr.name)} » prévu sur ce créneau.</span></div>` : ''}`; },
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="recipePlanSave" data-id="${r.id}">Planifier</button>`,
    onMount: m => {
      m.st = st;
      m.el.querySelectorAll('[data-pd]').forEach(b => b.addEventListener('click', () => { st.date = b.dataset.pd; m.render(); }));
      m.el.querySelectorAll('[data-ps]').forEach(b => b.addEventListener('click', () => { st.slot = b.dataset.ps; m.render(); }));
      m.el.querySelectorAll('[data-pp]').forEach(b => b.addEventListener('click', () => { st.por = +b.dataset.pp; m.render(); }));
    }
  });
};
A.recipePlanSave = async el => {
  const m = UI.top(); const st = m.st; const r = D.recipe(el.dataset.id);
  const old = D.planEntry(st.date, st.slot);
  await DB.put('plan', { id: st.date + '|' + st.slot, date: st.date, slot: st.slot, recipeId: r.id, portions: st.por });
  m.close(); const parent = UI.top(); if (parent && parent.opts.size === 'lg') parent.close();
  UI.toast(`${r.name} prévu ${U.relDay(st.date).toLowerCase()} (${D.slotLabel(st.slot).toLowerCase()})`, { action: { label: 'Annuler', fn: async () => { if (old) await DB.put('plan', old); else await DB.del('plan', st.date + '|' + st.slot); App.changed(); } } });
  App.changed();
};

/* ---------- Actions : planning ---------- */
A.planWeek = el => { const p = Pages.nutrition; p.pweek = U.addDays(p.pweek, +el.dataset.d); App.renderView(false); };
A.planPick = el => {
  const { date, slot } = el.dataset;
  const st = { q: '' };
  const list = () => {
    const qt = U.norm(st.q).split(/\s+/).filter(Boolean);
    const arr = D.recipes().filter(r => { if (!D.recipeSlots(r).includes(slot)) return false; const n = U.norm(r.name); return qt.every(t => n.includes(t)); });
    const favs = D.recipeFavs();
    arr.sort((a, b) => (favs.has(b.id) - favs.has(a.id)) || a.name.localeCompare(b.name, 'fr'));
    return arr.map(r => { const m = D.recipeMacros(r); return `<button class="food-row" data-act="planPickGo" data-id="${r.id}"><span class="ic-badge sm" style="--c:${D.CAT_COLOR[r.cat]}">${U.icon(favs.has(r.id) ? 'star' : ((D.RECIPE_CATS.find(c => c.id === r.cat) || {}).icon || 'food'))}</span><span class="grow"><span class="t">${U.esc(r.name)}</span><br><span class="s">${U.num(m.kcal)} kcal · P ${U.num(m.p)} g · ${r.time} min</span></span>${U.icon('plus', 'sm')}</button>`; }).join('') || UI.empty('food', 'Aucune recette', 'Essaie un autre mot.');
  };
  UI.open({
    title: D.slotLabel(slot), sub: U.fmtLong(date), size: 'md',
    body: `<div class="input-unit"><input class="input" id="ppq" placeholder="Rechercher une recette" autocomplete="off"><em>${U.icon('search', 'sm')}</em></div><div class="food-results" id="ppres">${list()}</div>`,
    footer: `<button class="btn ghost" data-act="goRecipes">Parcourir toutes les recettes</button>`,
    onMount: m => { m.pp = { date, slot }; const q = m.el.querySelector('#ppq'); q.addEventListener('input', () => { st.q = q.value; m.el.querySelector('#ppres').innerHTML = list(); }); }
  });
};
A.planPickGo = async el => {
  const m = UI.top(); const { date, slot } = m.pp;
  await DB.put('plan', { id: date + '|' + slot, date, slot, recipeId: el.dataset.id, portions: 1 });
  m.close(); UI.toast(`${D.recipe(el.dataset.id).name} prévu`); App.changed();
};
A.planCell = el => {
  const e = DB.get('plan', el.dataset.id); const r = D.recipe(e.recipeId);
  const logged = D.planLogged(e);
  UI.open({
    title: r.name, sub: `${D.slotLabel(e.slot)} · ${U.fmtLong(e.date)}`, size: 'sm', live: true,
    body: () => { const cur = DB.get('plan', e.id); if (!cur) return ''; const m = D.recipeMacros(r, cur.portions || 1); return `<div class="qty-live"><div><b>${U.num(m.kcal)}</b><span>kcal</span></div><div><b class="m-p">${U.num(m.p)}</b><span>protéines</span></div><div><b class="m-c">${U.num(m.c)}</b><span>glucides</span></div><div><b class="m-f">${U.num(m.f)}</b><span>lipides</span></div></div>
      <div class="field"><span>Portions</span><div class="seg full">${[0.5, 1, 1.25, 1.5, 2].map(v => `<button type="button" data-act="planPor" data-id="${e.id}" data-v="${v}" class="${(cur.portions || 1) === v ? 'on' : ''}">${U.num(v, v % 1 ? 2 : 0)}</button>`).join('')}</div></div>
      <div class="list">
        <button class="li act" data-act="recipeOpen" data-id="${r.id}" style="width:calc(100% + 16px);text-align:left"><span class="ic-badge sm">${U.icon('food')}</span><span class="grow"><span class="t">Voir la recette</span></span>${U.icon('chevR', 'sm')}</button>
        <button class="li act" data-act="planPick" data-date="${e.date}" data-slot="${e.slot}" style="width:calc(100% + 16px);text-align:left"><span class="ic-badge sm">${U.icon('repeat')}</span><span class="grow"><span class="t">Changer de recette</span></span>${U.icon('chevR', 'sm')}</button>
      </div>
      ${logged ? `<div class="note">${U.icon('check', 'sm')}<span>Déjà noté dans ton journal.</span></div>` : ''}`; },
    footer: `<button class="btn ghost danger" data-act="planDel" data-id="${e.id}">${U.icon('trash', 'sm')}Retirer</button><span class="spacer"></span>${!logged && e.date <= U.today() ? `<button class="btn primary" data-act="planLog" data-id="${e.id}">${U.icon('check', 'sm')}J'ai mangé ça</button>` : ''}`
  });
};
A.planPor = async el => { const e = DB.get('plan', el.dataset.id); await DB.put('plan', { ...e, portions: +el.dataset.v }); App.changed(); };
A.planDel = async el => { const old = DB.get('plan', el.dataset.id); await DB.del('plan', old.id); UI.top().close(); UI.toast('Retiré du planning', { action: { label: 'Annuler', fn: async () => { await DB.put('plan', old); App.changed(); } } }); App.changed(); };
A.planLog = async el => {
  const e = DB.get('plan', el.dataset.id); const r = D.recipe(e.recipeId);
  const meal = await logRecipe(r, e.date, e.slot, e.portions || 1, e.id);
  const t = UI.top(); if (t && t.opts.title === r.name) t.close();
  UI.toast(`${r.name} noté · ${U.num(meal.kcal)} kcal`, { action: { label: 'Annuler', fn: async () => { await DB.del('meals', meal.id); App.changed(); } } });
  App.changed();
};
A.planClear = async () => {
  const p = Pages.nutrition; const ws = p.pweek, we = U.addDays(ws, 6);
  const arr = DB.all('plan').filter(e => e.date >= ws && e.date <= we && e.date >= U.today());
  if (!arr.length) { UI.toast('Rien à retirer à partir d\'aujourd\'hui', { type: 'info' }); return; }
  await DB.delMany('plan', arr.map(e => e.id));
  UI.toast(`${arr.length} repas retirés`, { action: { label: 'Annuler', fn: async () => { await DB.putMany('plan', arr); App.changed(); } } });
  App.changed();
};
A.planAuto = () => {
  const p = Pages.nutrition; const ws = p.pweek || U.weekStart(U.today());
  const st = { slots: ['breakfast', 'lunch', 'dinner'], favFirst: true, batch: true, replace: false };
  UI.open({
    title: 'Proposer ma semaine', sub: `Semaine du ${U.fmtShort(ws)} · à partir d'aujourd'hui`, size: 'sm',
    body: () => `<p class="small muted" style="margin:0">Je combine les recettes pour approcher ta cible de ${U.num(D.targets().kcal)} kcal et ${U.num(D.targets().protein)} g de protéines par jour, en variant les plats.</p>
      <div class="field"><span>Repas à prévoir</span><div class="chips">${D.SLOTS.map(s => `<button type="button" class="chip ${st.slots.includes(s.id) ? 'on' : ''}" data-aslot="${s.id}">${s.label}</button>`).join('')}</div></div>
      ${[['favFirst', 'Privilégier mes recettes favorites'], ['batch', 'Batch cooking : restes du dîner le lendemain midi'], ['replace', 'Remplacer ce qui est déjà prévu']].map(([k, l]) => `<label class="row"><span class="switch"><input type="checkbox" data-aopt="${k}" ${st[k] ? 'checked' : ''}><span></span></span><span class="small">${l}</span></label>`).join('')}`,
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="planAutoGo">${U.icon('sparkle', 'sm')}Proposer</button>`,
    onMount: m => {
      m.st = st;
      m.el.querySelectorAll('[data-aslot]').forEach(b => b.addEventListener('click', () => { const s = b.dataset.aslot; st.slots = st.slots.includes(s) ? st.slots.filter(x => x !== s) : [...st.slots, s]; m.render(); }));
      m.el.querySelectorAll('[data-aopt]').forEach(i => i.addEventListener('change', () => { st[i.dataset.aopt] = i.checked; }));
    }
  });
};
A.planAutoGo = async () => {
  const m = UI.top(); const st = m.st; const ws = Pages.nutrition.pweek || U.weekStart(U.today());
  if (!st.slots.length) { UI.toast('Choisis au moins un repas', { type: 'err' }); return; }
  const before = DB.all('plan').filter(e => e.date >= ws && e.date <= U.addDays(ws, 6));
  const out = D.autoPlan({ from: ws, ...st });
  if (!out.length) { m.close(); UI.toast('Tout est déjà prévu pour cette semaine', { type: 'info' }); return; }
  if (st.replace) await DB.delMany('plan', before.filter(e => e.date >= U.today()).map(e => e.id));
  await DB.putMany('plan', out);
  m.close();
  UI.toast(`${out.length} repas proposés`, { action: { label: 'Annuler', fn: async () => { await DB.delMany('plan', out.map(e => e.id)); await DB.putMany('plan', before); App.changed(); } } });
  App.changed();
};

/* ---------- Actions : courses ---------- */
A.planShop = async () => {
  const p = Pages.nutrition; const ws = p.pweek || U.weekStart(U.today());
  const from = ws < U.today() ? U.today() : ws, to = U.addDays(ws, 6);
  const fresh = D.shoppingFromPlan(from, to);
  if (!fresh.length) { UI.toast('Aucun repas prévu sur cette période : planifie d\'abord ta semaine', { type: 'info' }); p.tab = 'planning'; App.renderView(false); return; }
  const old = DB.all('shopping');
  const checked = new Map(old.filter(i => i.auto).map(i => [i.id, i.checked]));
  await DB.delMany('shopping', old.filter(i => i.auto).map(i => i.id));
  await DB.putMany('shopping', fresh.map(i => ({ ...i, checked: !!checked.get(i.id) })));
  await DB.setSetting('shopRange', { from, to });
  p.tab = 'courses'; UI.closeAll(); App.go('repas'); App.changed();
  UI.toast(`Liste prête : ${fresh.filter(i => !i.pantry).length} articles`);
};
A.shopToggle = async el => { const i = DB.get('shopping', el.dataset.id); await DB.put('shopping', { ...i, checked: !i.checked }); if (!i.checked && navigator.vibrate) navigator.vibrate(8); App.changed(); };
A.shopDel = async el => { const old = DB.get('shopping', el.dataset.id); await DB.del('shopping', old.id); UI.toast(`${old.name} retiré`, { action: { label: 'Annuler', fn: async () => { await DB.put('shopping', old); App.changed(); } } }); App.changed(); };
A.shopAdd = async () => {
  const n = document.getElementById('shop-name'); const name = n.value.trim(); if (!name) return;
  await DB.put('shopping', { id: 'm|' + U.uid(), name, aisle: document.getElementById('shop-aisle').value, g: null, manual: true, checked: false });
  App.changed(); setTimeout(() => { const i = document.getElementById('shop-name'); if (i && !U.isMobile()) i.focus(); }, 30);
};
A.shopClearDone = async () => { const arr = DB.all('shopping').filter(i => i.checked); await DB.delMany('shopping', arr.map(i => i.id)); UI.toast(`${arr.length} articles retirés`, { action: { label: 'Annuler', fn: async () => { await DB.putMany('shopping', arr); App.changed(); } } }); App.changed(); };
function shopText() {
  const items = DB.all('shopping').filter(i => !i.checked);
  return 'Courses Cap 100\n' + D.AISLES.map(a => { const arr = items.filter(i => (i.aisle || 'au') === a.id); if (!arr.length) return ''; return `\n${a.label.toUpperCase()}\n` + arr.map(i => { const q = D.shopQty(i); const c = D.itemCost(i); return `☐ ${i.name}${q && q.main ? ' — ' + q.main : ''}${c.known && c.till ? ' (≈ ' + U.eur(c.till) + ')' : ''}`; }).join('\n'); }).join('\n') + `\n\nBudget estimé (${D.store(D.mainStore()).name}) : ≈ ${U.eur(D.basket(items).till)}`;
}
A.shopCopy = async () => {
  const txt = shopText();
  try { await navigator.clipboard.writeText(txt); UI.toast('Liste copiée : colle-la dans tes notes ou un message'); }
  catch (e) { UI.open({ title: 'Copier la liste', size: 'sm', body: `<textarea class="input" style="height:320px;padding:10px;font-size:13px" readonly id="shop-txt">${U.esc(txt)}</textarea><p class="hint" style="margin:0">Sélectionne le texte puis copie-le.</p>`, onMount: m => { const t = m.el.querySelector('#shop-txt'); t.focus(); t.select(); } }); }
};
A.shopShare = async () => { try { await navigator.share({ title: 'Courses', text: shopText() }); } catch (e) { /* annulé */ } };

/* ---------- Éditeur de recette ---------- */
A.recipeNew = () => F.recipeEdit(null);
A.recipeEdit = el => F.recipeEdit(el.dataset.id, !!el.dataset.copy);
F.recipeEdit = (id, copy = false) => {
  const src = id ? D.recipe(id) : null;
  const r = src ? JSON.parse(JSON.stringify(src)) : { name: '', cat: 'plat', time: 20, tags: [], ing: [], pantry: [], steps: [], tip: '' };
  if (!src || copy) { r.id = 'rc-' + U.uid(); if (copy) r.name = src.name + ' (perso)'; }
  delete r.base;
  ['community', 'author', 'authorUid', 'mine', 'rid', 'docId', 'at'].forEach(k => delete r[k]);
  if (!src || copy) r.shared = !!Cloud.user && !(src && src.community); // une copie d'une recette de la communauté reste privée par défaut
  const t = UI.top(); if (t && t.opts.size === 'lg') t.close();
  UI.open({
    title: src && !copy ? 'Modifier la recette' : 'Nouvelle recette', sub: 'Quantités pour 1 portion', size: 'md',
    body: () => { const m = D.recipeMacros({ ...r, id: 'draft', v: Date.now() }); return `<form id="ref" class="stack">
      <label class="field"><span>Nom</span><input id="re-name" value="${U.esc(r.name)}" placeholder="Ex. Wrap saumon fumé & fromage frais"></label>
      <div class="fields keep"><label class="field"><span>Catégorie</span><select id="re-cat">${D.RECIPE_CATS.map(c => `<option value="${c.id}" ${r.cat === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
        <label class="field"><span>Temps</span><div class="input-unit"><input id="re-time" inputmode="numeric" value="${r.time || ''}"><em>min</em></div></label></div>
      <div class="field"><span>Étiquettes</span><div class="chips">${['lunchbox', 'batch', 'froid', 'vege'].map(k => `<button type="button" class="chip ${r.tags.includes(k) ? 'on' : ''}" data-retag="${k}">${D.RECIPE_TAGS[k]}</button>`).join('')}</div></div>
      <div class="field"><span>Ingrédients</span><div class="list">${r.ing.map((i, k) => { const f = D.food(i.foodId); return `<div class="li" style="gap:8px"><span class="grow"><span class="t">${U.esc(f ? f.name : '?')}</span></span><div class="input-unit" style="width:96px"><input class="input" data-reg="${k}" inputmode="numeric" value="${i.g}" style="height:38px"><em>g</em></div><button type="button" class="icon-btn sm" data-redel="${k}" aria-label="Retirer">${U.icon('x')}</button></div>`; }).join('') || '<p class="faint small" style="margin:0">Aucun ingrédient.</p>'}</div>
        <button type="button" class="btn sm" data-readd>${U.icon('plus', 'sm')}Ajouter un ingrédient</button></div>
      <div class="qty-live"><div><b>${U.num(m.kcal)}</b><span>kcal</span></div><div><b class="m-p">${U.num(m.p)}</b><span>protéines</span></div><div><b class="m-c">${U.num(m.c)}</b><span>glucides</span></div><div><b class="m-f">${U.num(m.f)}</b><span>lipides</span></div></div>
      <label class="field"><span>Étapes <small>(une par ligne)</small></span><textarea id="re-steps" rows="4">${U.esc((r.steps || []).join('\n'))}</textarea></label>
      <label class="field"><span>Placard <small>(épices, condiments, séparés par des virgules)</small></span><input id="re-pantry" value="${U.esc((r.pantry || []).join(', '))}"></label>
      <label class="field"><span>Astuce</span><input id="re-tip" value="${U.esc(r.tip || '')}" placeholder="Optionnel"></label>
      ${Cloud.user ? `<label class="row small share-row"><span class="switch"><input type="checkbox" id="re-share" ${r.shared ? 'checked' : ''}><span></span></span><span><b>Partager dans la communauté</b><br><span class="muted">Visible par tous les inscrits, avec ton prénom (${U.esc(Cloud.user.name || '')}).</span></span></label>` : ''}</form>`; },
    footer: `${src && !src.base && !copy ? `<button class="btn ghost danger" data-act="recipeDel" data-id="${r.id}">${U.icon('trash')}</button><span class="spacer"></span>` : ''}<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="recipeSave">Enregistrer</button>`,
    onMount: m => {
      m.r = r;
      const sync = () => { const g = id => m.el.querySelector(id); r.name = g('#re-name').value; r.cat = g('#re-cat').value; r.time = U.parseNum(g('#re-time').value) || null; r.steps = g('#re-steps').value.split('\n').map(s => s.trim()).filter(Boolean); r.pantry = g('#re-pantry').value.split(',').map(s => s.trim()).filter(Boolean); r.tip = g('#re-tip').value.trim(); if (g('#re-share')) r.shared = g('#re-share').checked; m.el.querySelectorAll('[data-reg]').forEach(i => { r.ing[+i.dataset.reg].g = U.parseNum(i.value) || 0; }); };
      m.sync = sync;
      m.el.querySelectorAll('[data-retag]').forEach(b => b.addEventListener('click', () => { sync(); const k = b.dataset.retag; r.tags = r.tags.includes(k) ? r.tags.filter(x => x !== k) : [...r.tags, k]; m.render(); }));
      m.el.querySelectorAll('[data-redel]').forEach(b => b.addEventListener('click', () => { sync(); r.ing.splice(+b.dataset.redel, 1); m.render(); }));
      m.el.querySelectorAll('[data-reg]').forEach(i => i.addEventListener('change', () => { sync(); m.render(); }));
      m.el.querySelector('[data-readd]').addEventListener('click', () => { sync(); F.ingPicker(foodId => { const f = D.food(foodId); r.ing.push({ foodId, g: f.portion || 100 }); m.render(); }); });
    }
  });
};
F.ingPicker = onPick => {
  const st = { q: '' };
  const list = () => { const q = U.norm(st.q); return (q ? D.searchFoods(st.q, 60) : D.foods().filter(f => !f.cq || D.CQ_MAP[f.name]).sort((a, b) => a.name.localeCompare(b.name, 'fr'))).map(f => `<button class="food-row" data-act="ingPick" data-id="${f.id}"><span class="grow"><span class="t">${U.esc(f.name)}</span><br><span class="s">100 g : ${U.num(f.kcal)} kcal · P ${U.num(f.p, 1)} g</span></span>${U.icon('plus', 'sm')}</button>`).join('') || UI.empty('search', 'Aucun aliment', 'Crée-le depuis « Mes aliments ».'); };
  UI.open({ title: 'Ingrédient', size: 'md', body: `<div class="input-unit"><input class="input" id="igq" placeholder="Rechercher un aliment" autocomplete="off"><em>${U.icon('search', 'sm')}</em></div><div class="food-results" id="igres">${list()}</div>`, onMount: m => { m.onPick = onPick; const q = m.el.querySelector('#igq'); q.addEventListener('input', () => { st.q = q.value; m.el.querySelector('#igres').innerHTML = list(); }); } });
};
A.ingPick = el => { const m = UI.top(); const cb = m.onPick; m.close(); cb(el.dataset.id); };
A.recipeSave = async () => {
  const m = UI.top(); m.sync(); const r = m.r;
  if (!r.name.trim()) { UI.toast('Donne un nom à la recette', { type: 'err' }); return; }
  if (!r.ing.length) { UI.toast('Ajoute au moins un ingrédient', { type: 'err' }); return; }
  r.v = Date.now(); r.slots = D.CAT_SLOTS[r.cat];
  await Acc.adoptFoods(r);
  const was = DB.get('recipes', r.id);
  await DB.put('recipes', r); m.close();
  if (Cloud.user && r.shared) Cloud.publish(r);
  else if (Cloud.user && was && was.shared) Cloud.unpublish(r.id);
  UI.toast(Cloud.user && r.shared ? 'Recette enregistrée et partagée dans la communauté' : 'Recette enregistrée'); App.changed();
};
A.recipeDel = async el => {
  const ok = await UI.confirm({ title: 'Supprimer la recette ?', text: 'Elle sera aussi retirée du planning à venir.', ok: 'Supprimer', danger: true });
  if (!ok) return;
  const was = DB.get('recipes', el.dataset.id);
  if (was && was.shared && Cloud.user) Cloud.unpublish(was.id);
  await DB.del('recipes', el.dataset.id);
  await DB.delMany('plan', DB.all('plan').filter(e => e.recipeId === el.dataset.id && e.date >= U.today()).map(e => e.id));
  UI.closeAll(); UI.toast('Recette supprimée'); App.changed();
};
