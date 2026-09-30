'use strict';
/* Cap 100 — enseignes et estimation du prix des courses.
   Prix de référence : ordres de grandeur en marque distributeur, niveau E.Leclerc (indice 100), 2026.
   Indices d'enseigne : classement UFC-Que Choisir 2026 (drive, E.Leclerc = 100) et étude discount (Lidl, Aldi).
   Monoprix, Casino/Franprix et Netto : estimations (non couverts par ces études). Tout reste modifiable. */

D.STORES = [
  { id: 'lidl', name: 'Lidl', idx: 97.5, src: 'étude discount 2025' },
  { id: 'leclerc', name: 'E.Leclerc', idx: 100, src: 'référence' },
  { id: 'aldi', name: 'Aldi', idx: 102, src: 'étude discount 2025' },
  { id: 'netto', name: 'Netto', idx: 102, src: 'estimation' },
  { id: 'intermarche', name: 'Intermarché', idx: 104, src: 'UFC 2026' },
  { id: 'superu', name: 'Super U / Hyper U', idx: 104.5, src: 'UFC 2026' },
  { id: 'carrefour', name: 'Carrefour', idx: 106.3, src: 'UFC 2026' },
  { id: 'carrefour-market', name: 'Carrefour Market', idx: 107.4, src: 'UFC 2026' },
  { id: 'auchan', name: 'Auchan', idx: 111, src: 'UFC 2026' },
  { id: 'casino', name: 'Casino / Franprix', idx: 118, src: 'estimation' },
  { id: 'monoprix', name: 'Monoprix', idx: 125, src: 'estimation' }
];
D.store = id => D.STORES.find(s => s.id === id) || D.STORES[1];
D.mainStore = () => DB.setting('mainStore', 'leclerc');

/* Prix de référence (€ par kg ou par litre) et conditionnement habituel (g) ; stock = longue conservation, compté au prorata */
D.PRICE_REF = {
  'Flocons d\'avoine': [2.4, 500], 'Pain de mie complet': [3.6, 500], 'Baguette': [4, 250], 'Œuf entier': [5.8, 360],
  'Blanc de poulet cuit': [13, 500], 'Cuisse de poulet rôtie': [8, 0], 'Steak haché 5 % (cuit)': [13, 500], 'Saumon cuit': [25, 250],
  'Cabillaud cuit': [20, 250], 'Thon au naturel': [14.3, 112], 'Crevettes cuites': [20, 200], 'Jambon blanc': [14, 180], 'Tofu nature': [10, 200],
  'Riz basmati cuit': [3.2, 1000], 'Pâtes cuites': [1.8, 500], 'Quinoa cuit': [7, 500], 'Pomme de terre cuite': [1.5, 2500], 'Patate douce cuite': [3.5, 0],
  'Lentilles cuites': [3, 500], 'Petits pois': [3, 1000], 'Haricots verts': [2.8, 1000], 'Brocoli cuit': [3.5, 0], 'Courgette cuite': [2.5, 0],
  'Carottes': [1.6, 1000], 'Tomate': [3.2, 0], 'Salade verte': [10, 150], 'Soupe de légumes': [2.5, 1000], 'Banane': [2, 0], 'Pomme': [2.8, 0],
  'Avocat': [7.3, 150], 'Skyr nature': [4.2, 600], 'Fromage blanc 0 %': [2.8, 1000], 'Yaourt grec': [5, 600], 'Lait demi-écrémé': [1.1, 1000],
  'Emmental': [10, 200], 'Mozzarella': [7, 125], 'Huile d\'olive': [10, 0, true], 'Beurre de cacahuète': [9, 350], 'Amandes': [14, 200],
  'Whey protéine': [30, 0, true], 'Chocolat noir 70 %': [10, 100], 'Miel': [10, 0, true], 'Muesli': [4.5, 750], 'Galettes de riz': [10, 130],
  'Jus d\'orange': [2, 1000], 'Soda sucré': [1.5, 1500], 'Sandwich jambon-beurre': [12, 250], 'Pizza margherita': [9, 350],
  'Tortilla de blé (wrap)': [5, 480], 'Tortilla complète (wrap)': [6, 480], 'Pois chiches cuits': [3.8, 265], 'Haricots rouges cuits': [4.4, 250],
  'Maïs doux (boîte)': [6.4, 140], 'Tomates concassées (boîte)': [2.5, 400], 'Feta': [12, 200], 'Fromage de chèvre frais': [14, 150],
  'Parmesan': [25, 100, true], 'Yaourt nature 0 %': [2, 500], 'Crème légère 15 %': [5, 200], 'Cottage cheese': [7, 200],
  'Blanc de dinde (tranches)': [16, 160], 'Concombre': [3, 300], 'Poivron': [4, 0], 'Oignon rouge': [3, 0], 'Épinards frais': [8, 250],
  'Champignons de Paris': [5, 250], 'Citron (jus)': [10, 40], 'Chou rouge': [2, 0], 'Fruits rouges surgelés': [7, 500], 'Edamame surgelés': [8, 400],
  'Semoule cuite': [2, 1000], 'Aubergine': [3.5, 0], 'Poireau': [3, 0], 'Chou-fleur': [3, 0], 'Courge butternut': [2.5, 0], 'Betterave cuite': [4, 250],
  'Escalope de dinde cuite': [12, 500], 'Filet mignon de porc cuit': [14, 500], 'Saumon fumé': [30, 120], 'Surimi': [8, 250], 'Fromage frais allégé': [10, 150],
  'Ricotta': [10, 250], 'Bûche de chèvre': [13, 180], 'Pain pita': [6, 420], 'Boulgour cuit': [3, 500], 'Nouilles de riz cuites': [6, 400],
  'Olives noires': [12, 150], 'Lait de coco léger': [7, 200], 'Cerneaux de noix': [20, 125], 'Houmous': [10, 200], 'Pesto': [12, 190], 'Sauce soja': [6, 0, true], 'Moutarde': [5, 0, true]
};
Object.assign(D.PRICE_REF, D.MORE_PRICES || {});
(() => { for (const f of D.BASE_FOODS) { const r = D.PRICE_REF[f.name]; if (r) { f.price = r[0]; f.pack = r[1] || 0; f.stock = !!r[2]; } } })();

/* Prix au kg pour une enseigne : prix saisi par toi, sinon référence × indice */
D.priceKey = f => f.overrides || f.id;
D.userPrice = (storeId, f) => { const p = DB.setting('prices', {}); return p[storeId] && p[storeId][D.priceKey(f)] != null ? p[storeId][D.priceKey(f)] : null; };
D.priceKg = (f, storeId = D.mainStore()) => {
  if (!f) return null;
  const u = D.userPrice(storeId, f); if (u != null) return u;
  const base = f.price != null ? f.price : (f.overrides ? (D.food(f.overrides) || {}).price : null);
  if (base == null) return null;
  return base * D.store(storeId).idx / 100;
};
/* Quantité achetée (poids cru, riz sec…) pour une quantité consommée */
D.buyG = (f, g) => g * (f && f.buy ? f.buy.factor : 1);
D.recipeCost = (r, portions = 1, storeId = D.mainStore()) => {
  let t = 0, missing = 0;
  for (const i of r.ing) { const f = D.food(i.foodId); const p = D.priceKg(f, storeId); if (p == null) { missing++; continue; } t += D.buyG(f, i.g) * portions / 1000 * p; }
  return { eur: t, missing };
};
U.eur = v => v == null ? '–' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
U.eur0 = v => v == null ? '–' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: v < 10 ? 2 : 0, minimumFractionDigits: v < 10 ? 2 : 0 });

/* Enseigne d'un article : l'article, sinon son rayon, sinon l'enseigne principale */
D.itemStore = it => it.store || DB.setting('aisleStores', {})[it.aisle || 'au'] || D.mainStore();
/* Coût d'un article : « caisse » (conditionnements entiers) et « consommé » (quantité utilisée) */
D.itemCost = (it, storeId = D.itemStore(it)) => {
  if (it.manual) return it.eur != null ? { till: it.eur, used: it.eur, known: true } : { till: 0, used: 0, known: false };
  if (it.pantry || it.g == null) return { till: 0, used: 0, known: true, pantry: true };
  const f = D.food(it.foodId); const p = D.priceKg(f, storeId);
  if (p == null) return { till: 0, used: 0, known: false };
  const used = it.g / 1000 * p;
  let till = used;
  if (f.stock) till = used;
  else if (f.pack) till = Math.ceil(it.g / f.pack - 0.05) * f.pack / 1000 * p;
  return { till, used, known: true, packs: f.pack && !f.stock ? Math.ceil(it.g / f.pack - 0.05) : null, stock: f.stock, pkg: p };
};
D.basket = (items, storeFn = D.itemStore) => {
  const byStore = new Map(); let till = 0, used = 0, unknown = 0;
  for (const it of items) {
    const s = storeFn(it); const c = D.itemCost(it, s);
    if (!c.known) { unknown++; continue; }
    till += c.till; used += c.used;
    byStore.set(s, (byStore.get(s) || 0) + c.till);
  }
  return { till, used, unknown, byStore };
};

/* ---------- Interface ---------- */
A.setMainStore = async el => { await DB.setSetting('mainStore', el.value); UI.toast(`Enseigne principale : ${D.store(el.value).name}`); App.changed(); };
A.shopItem = el => {
  const it = DB.get('shopping', el.dataset.id); if (!it) return;
  const f = it.foodId ? D.food(it.foodId) : null;
  const st = { store: it.store || '', aisleStore: DB.setting('aisleStores', {})[it.aisle || 'au'] || '' };
  const aisle = D.AISLES.find(a => a.id === (it.aisle || 'au')) || D.AISLES[D.AISLES.length - 1];
  UI.open({
    title: it.name, sub: aisle.label, size: 'sm', live: true,
    body: () => {
      const s = st.store || st.aisleStore || D.mainStore();
      const c = D.itemCost({ ...it, store: s }, s);
      const up = f ? D.userPrice(s, f) : null;
      const q = D.shopQty(it);
      return `${q && q.main ? `<div class="row between"><span class="muted">Quantité</span><b>${q.main}${q.sub ? ` <span class="faint small">${q.sub}</span>` : ''}</b></div>` : ''}
      <label class="field"><span>Acheté chez</span><select id="si-store"><option value="">${st.aisleStore ? `Comme le rayon (${D.store(st.aisleStore).name})` : `Enseigne principale (${D.store(D.mainStore()).name})`}</option>${D.STORES.map(x => `<option value="${x.id}" ${st.store === x.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
      <label class="field"><span>Tout le rayon « ${aisle.label} » chez</span><select id="si-aisle"><option value="">Enseigne principale</option>${D.STORES.map(x => `<option value="${x.id}" ${st.aisleStore === x.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select><small>Pratique pour la viande chez le boucher ou les fruits au marché.</small></label>
      ${it.manual ? `<label class="field"><span>Prix</span><div class="input-unit"><input id="si-eur" inputmode="decimal" value="${it.eur != null ? U.num(it.eur, 2) : ''}" placeholder="0,00"><em>€</em></div></label>`
        : f ? `<div class="qty-live" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><b>${c.known ? U.eur(c.till) : '–'}</b><span>à la caisse</span></div><div><b>${c.known ? U.eur(c.used) : '–'}</b><span>utilisé cette semaine</span></div><div><b>${c.pkg != null ? U.num(c.pkg, 2) : '–'}</b><span>€ / ${f.ml ? 'L' : 'kg'}${up != null ? ' (ton prix)' : ' estimé'}</span></div></div>
          <label class="field"><span>Ton prix chez ${D.store(s).name}</span><div class="row" style="gap:8px"><div class="input-unit grow"><input id="si-price" inputmode="decimal" value="${up != null ? U.num(up, 2) : ''}" placeholder="${c.pkg != null ? U.num(c.pkg, 2) : ''}"><em>€/${f.ml ? 'L' : 'kg'}</em></div>${f.pack ? `<span class="small faint">ou</span><div class="input-unit" style="width:130px"><input id="si-pack" inputmode="decimal" placeholder="le paquet"><em>€</em></div>` : ''}</div><small>${f.pack ? `Paquet de ${U.num(f.pack)} ${f.ml ? 'ml' : 'g'}. ` : ''}Recopie le prix de l'étiquette : il remplacera l'estimation pour cette enseigne.${up != null ? ' Laisse vide pour revenir à l\'estimation.' : ''}</small></label>` : ''}
      ${it.pantry ? '<p class="hint" style="margin:0">Produit de placard : non compté dans le budget.</p>' : ''}`;
    },
    footer: `<button class="btn ghost" data-close-top>Fermer</button><button class="btn primary" data-act="shopItemSave" data-id="${U.esc(it.id)}">Enregistrer</button>`,
    onMount: m => {
      m.st = st;
      const ss = m.el.querySelector('#si-store'), sa = m.el.querySelector('#si-aisle');
      ss.addEventListener('change', () => { st.store = ss.value; m.render(); });
      sa.addEventListener('change', () => { st.aisleStore = sa.value; m.render(); });
    }
  });
};
A.shopItemSave = async el => {
  const m = UI.top(); const st = m.st; const it = DB.get('shopping', el.dataset.id);
  const f = it.foodId ? D.food(it.foodId) : null;
  const upd = { ...it, store: st.store || null };
  const eurIn = document.getElementById('si-eur'); if (eurIn) upd.eur = U.parseNum(eurIn.value);
  await DB.put('shopping', upd);
  const as = { ...DB.setting('aisleStores', {}) }; if (st.aisleStore) as[it.aisle || 'au'] = st.aisleStore; else delete as[it.aisle || 'au'];
  await DB.setSetting('aisleStores', as);
  const pIn = document.getElementById('si-price'), pkIn = document.getElementById('si-pack');
  if (f && pIn) {
    const s = st.store || st.aisleStore || D.mainStore();
    const all = JSON.parse(JSON.stringify(DB.setting('prices', {}))); all[s] = all[s] || {};
    let v = U.parseNum(pIn.value);
    const pk = pkIn ? U.parseNum(pkIn.value) : null;
    if (pk != null && f.pack) v = pk / (f.pack / 1000);
    if (v != null && v > 0) all[s][D.priceKey(f)] = +v.toFixed(3); else delete all[s][D.priceKey(f)];
    await DB.setSetting('prices', all);
  }
  m.close(); UI.toast('Article mis à jour'); App.changed();
};
A.shopCompare = () => {
  const items = DB.all('shopping').filter(i => !i.checked);
  const rows = D.STORES.map(s => ({ s, b: D.basket(items, () => s.id) })).sort((a, b) => a.b.till - b.b.till);
  const max = Math.max(...rows.map(r => r.b.till)) || 1, min = Math.min(...rows.map(r => r.b.till)) * 0.85;
  const main = D.mainStore();
  UI.open({
    title: 'Comparer les enseignes', sub: 'Le même panier (articles non cochés), à la caisse', size: 'md',
    body: `<div class="cmp">${rows.map((r, i) => `<div class="cmp-r ${r.s.id === main ? 'on' : ''}"><span class="cmp-n">${U.esc(r.s.name)}${r.s.id === main ? ' <span class="pill planned">la tienne</span>' : ''}</span><div class="cmp-t"><i style="width:${(8 + (r.b.till - min) / Math.max(0.01, max - min) * 92).toFixed(1)}%"></i></div><b class="tabnum">${U.eur(r.b.till)}</b><span class="xs ${i === 0 ? 'good-c' : 'faint'}">${i === 0 ? 'moins cher' : '+' + U.eur(r.b.till - rows[0].b.till)}</span></div>`).join('')}</div>
      <p class="hint" style="margin:0">Indices de prix : classement UFC-Que Choisir 2026 (E.Leclerc = 100) ; Lidl et Aldi d'après l'étude discount 2025 ; Netto, Casino/Franprix et Monoprix estimés. Tes prix saisis remplacent l'estimation de leur enseigne. L'écart réel dépend des promotions et des marques choisies.</p>`,
    footer: `<button class="btn ghost" data-close-top>Fermer</button>`
  });
};
