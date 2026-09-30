'use strict';
/* Cap 100 — alimentation : journal par repas, favoris, copie de journée */

Pages.nutrition = {
  title: 'Alimentation',
  nav: 'repas',
  date: null,
  render() {
    const date = this.date || (this.date = U.today());
    const tg = { ...D.targets(), kcal: D.kcalTarget(date) }, tot = D.dayTotals(date);
    const meals = D.mealsOn(date);
    const pct = tot.kcal / tg.kcal;
    const left = tg.kcal - tot.kcal;
    const favs = DB.all('favorites');
    const y = U.addDays(date, -1);
    const macro = (l, v, t, c, cls) => `<div class="macro"><div class="row between"><span>${l}</span><b>${U.num(v)} <span class="faint">/ ${U.num(t)} g</span></b></div>${UI.bar(v / t, c, 'thick')}</div>`;
    return `<div class="page-head"><div><h1>Alimentation</h1><div class="sub">Estimations indicatives : l'important est la régularité, pas la précision au gramme.</div></div>
      <div class="actions"><button class="btn" data-act="nutCopyDay">${U.icon('copy', 'sm')}Copier une journée</button><button class="btn" data-act="nutLibrary">${U.icon('list', 'sm')}Mes aliments</button></div></div>
    <div class="row wrap" style="margin-bottom:16px"><div class="datebar"><button class="icon-btn" data-act="nutDay" data-d="-1" aria-label="Jour précédent">${U.icon('chevL')}</button><span class="lbl">${U.relDay(date)}</span><button class="icon-btn" data-act="nutDay" data-d="1" aria-label="Jour suivant">${U.icon('chevR')}</button></div>
      ${date !== U.today() ? `<button class="btn sm ghost" data-act="nutDay" data-d="0">Revenir à aujourd'hui</button>` : ''}<span class="grow"></span></div>
    <div class="grid g-dash">
      <section class="card span-8"><div class="nut-summary">
        <div class="kcal-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="43" fill="none" stroke="var(--surface-3)" stroke-width="9"/><circle cx="50" cy="50" r="43" fill="none" stroke="${pct > 1.05 ? 'var(--goal)' : 'var(--c-food)'}" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="100 100" style="--off:100;stroke-dashoffset:var(--off);transition:stroke-dashoffset 1s var(--ease)" data-off="${(100 - U.clamp(pct, 0, 1) * 100).toFixed(1)}"/></svg>
          <div class="in"><span class="v" data-count="${tot.kcal}">${U.num(tot.kcal)}</span><span class="l">sur ${U.num(tg.kcal)} kcal</span><span class="r ${left >= 0 ? 'good-c' : 'goal-c'}">${tot.count ? (left >= 0 ? `${U.num(left)} restantes` : `${U.num(-left)} au-dessus`) : 'Rien de noté'}</span></div></div>
        <div class="macros stack" style="gap:14px">
          ${macro('Protéines', tot.p, tg.protein, 'var(--c-strength)')}
          ${macro('Glucides', tot.c, tg.carbs, 'var(--c-food)')}
          ${macro('Lipides', tot.f, tg.fat, 'var(--c-swim)')}
          <div class="nut-extra">${[['Fibres', tot.fib, 30, 'min', 'objectif ≥ 30 g'], ['Sucres', tot.sug, null, '', ''], ['AG saturés', tot.sat, 22, 'max', 'repère ≤ 22 g'], ['Sel', tot.salt, 5, 'max', 'OMS ≤ 5 g']].map(([l, v, ref, kind, hint]) => { const st = v == null || !ref ? '' : kind === 'min' ? (v >= ref ? 'good-c' : '') : (v > ref ? 'goal-c' : ''); return `<div title="${hint}"><span>${l}</span><b class="${st}">${v == null ? '–' : U.num(v, l === 'Sel' ? 1 : 0) + ' g'}</b>${ref ? `<small>${hint}</small>` : ''}</div>`; }).join('')}</div>
          <p class="hint" style="margin:0">${DB.setting('prefs', {}).dynamicTarget ? `Objectif du jour adapté à tes activités (base ${U.num(D.targets().kcal)} kcal). ` : ''}Cibles estimées, modifiables dans <a href="#reglages">Réglages</a>. Un jour au-dessus n'efface rien : c'est la moyenne de la semaine qui compte.</p>
        </div></div></section>
      <section class="card span-4"><div class="card-h"><div><div class="eyebrow">7 derniers jours</div><h2>Calories</h2></div></div><div id="nut-week" data-h="170"></div>
        <div class="row between small" style="margin-top:8px"><span class="muted">Moyenne (jours notés)</span><b id="nut-avg"></b></div></section>
      ${D.SLOTS.map(s => {
        const arr = meals.filter(m => m.slot === s.id);
        const sk = U.sum(arr.map(m => m.kcal)), sp = U.sum(arr.map(m => m.p));
        const sf = favs.filter(f => f.slot === s.id);
        const hasY = D.mealsOn(y).some(m => m.slot === s.id);
        const pe = D.planEntry(date, s.id); const pr = pe && !D.planLogged(pe) && D.recipe(pe.recipeId);
        return `<section class="card slot span-6"><div class="slot-h"><span class="ic-badge sm" style="--c:var(--c-food)">${U.icon(s.icon)}</span><h3>${s.label}</h3><span class="tot">${arr.length ? `${U.num(sk)} kcal · P ${U.num(sp)} g` : ''}</span><span class="grow"></span>
          ${arr.length ? `<button class="icon-btn sm" data-act="favSave" data-slot="${s.id}" title="Enregistrer comme favori">${U.icon('star')}</button><button class="icon-btn sm" data-act="slotClear" data-slot="${s.id}" title="Vider ce repas">${U.icon('trash')}</button>` : ''}</div>
          <div class="slot-b">${arr.length ? `<div class="list">${arr.map(m => `<div class="li act" data-act="mealEdit" data-id="${m.id}"><span class="grow"><span class="t">${U.esc(m.name)}</span><span class="s">${m.group ? U.esc(m.group) + ' · ' : ''}${m.qty ? U.num(m.qty) + ' g · ' : ''}P ${U.num(m.p)} · G ${U.num(m.c)} · L ${U.num(m.f)}</span></span><span class="end"><b>${U.num(m.kcal)}</b> <span class="xs faint">kcal</span></span></div>`).join('')}</div>` : `<p class="faint small" style="margin:10px 0">Rien de noté.</p>`}</div>
          ${pr ? `<button class="plan-chip" data-act="planLog" data-id="${pe.id}"><span class="ic-badge sm" style="--c:${D.CAT_COLOR[pr.cat]}">${U.icon('calendar')}</span><span class="grow" style="min-width:0;text-align:left"><span class="xs faint">Prévu au planning</span><b>${U.esc(pr.name)}</b><span class="xs faint">${U.num(D.recipeMacros(pr, pe.portions || 1).kcal)} kcal · P ${U.num(D.recipeMacros(pr, pe.portions || 1).p)} g</span></span><span class="btn sm good">${U.icon('check', 'sm')}Valider</span></button>` : ''}
          <div class="slot-f"><button class="btn sm primary" data-act="nutAdd" data-slot="${s.id}">${U.icon('plus', 'sm')}Ajouter</button><button class="btn sm" data-act="goRecipes" data-cat="${s.id === 'breakfast' ? 'petitdej' : s.id === 'snack' ? 'collation' : ''}">${U.icon('food', 'sm')}Recette</button>
            ${sf.map(f => `<button class="fav-chip" data-act="favAdd" data-id="${f.id}" data-slot="${s.id}" title="${U.esc(f.items.map(i => i.name).join(', '))}">${U.icon('star')}${U.esc(f.name)}</button>`).join('')}
            ${hasY && !arr.length ? `<button class="chip" data-act="slotCopy" data-from="${y}" data-slot="${s.id}">${U.icon('copy', 'sm')}Comme ${date === U.today() ? 'hier' : 'la veille'}</button>` : ''}
          </div></section>`;
      }).join('')}
    </div>`;
  },
  mount(root) {
    const date = this.date, tg = D.targets();
    const days = U.range(U.addDays(date, -6), date);
    const data = days.map(d => { const t = D.dayTotals(d); return { d, label: U.dayLetter(U.dow(d)), total: t.kcal, color: d === date ? 'var(--c-food)' : 'color-mix(in srgb, var(--c-food) 55%, var(--surface-3))', tip: `${U.fmtLong(d)}<br><b>${U.num(t.kcal)} kcal</b><div class="xs" style="opacity:.8">P ${U.num(t.p)} g · ${t.count} aliment${t.count > 1 ? 's' : ''}</div>` }; });
    Charts.bars(root.querySelector('#nut-week'), { height: 170, data, target: { v: tg.kcal, label: '' }, onClick: d => { this.date = d.d; App.renderView(false); } });
    const logged = days.filter(d => D.dayTotals(d).count);
    root.querySelector('#nut-avg').textContent = logged.length ? `${U.num(U.avg(logged.map(d => D.dayTotals(d).kcal)))} kcal · ${logged.length} j` : '–';
    UI.countUp(root);
  }
};
A.nutDay = el => { const n = Pages.nutrition; n.date = +el.dataset.d === 0 ? U.today() : U.addDays(n.date, +el.dataset.d); App.renderView(false); };
A.nutAdd = el => F.food({ date: Pages.nutrition.date, slot: el.dataset.slot });

/* Modifier une entrée */
A.mealEdit = el => {
  const m = DB.get('meals', el.dataset.id); if (!m) return;
  const food = m.foodId ? D.food(m.foodId) : null;
  const rec = !food && m.recipeId ? D.recipe(m.recipeId) : null;
  UI.open({
    title: m.name, sub: `${D.slotLabel(m.slot)} · ${U.relDay(m.date)}`, size: 'sm',
    body: `<form id="mef" class="stack">
      ${rec ? `<div class="field"><span>Portions</span>${UI.pick('portions', [0.5, 0.75, 1, 1.25, 1.5, 2].map(v => ({ v, l: U.num(v, v % 1 ? 2 : 0) })), m.portions || 1, 'seg full')}</div><button type="button" class="btn sm ghost" data-act="recipeOpen" data-id="${rec.id}">${U.icon('food', 'sm')}Voir la recette</button>` : food ? `<label class="field"><span>Quantité</span><div class="input-unit"><input class="input" id="me-qty" inputmode="decimal" value="${U.num(m.qty)}" style="height:56px;font:700 30px var(--display)"><em>g</em></div></label><div class="qty-live" id="me-live"></div>`
        : `<div class="fields keep"><label class="field"><span>Calories</span><input id="me-kcal" inputmode="numeric" value="${m.kcal}"></label><label class="field"><span>Protéines (g)</span><input id="me-p" inputmode="decimal" value="${U.num(m.p, 1)}"></label><label class="field"><span>Glucides (g)</span><input id="me-c" inputmode="decimal" value="${U.num(m.c, 1)}"></label><label class="field"><span>Lipides (g)</span><input id="me-f" inputmode="decimal" value="${U.num(m.f, 1)}"></label></div>`}
      <div class="field"><span>Repas</span>${UI.pick('slot', D.SLOTS.map(s => ({ v: s.id, l: s.label })), m.slot, 'seg full')}</div></form>`,
    footer: `<button class="btn ghost danger" data-act="mealDel" data-id="${m.id}">${U.icon('trash')}Retirer</button><span class="spacer"></span><button class="btn primary" data-act="mealSave" data-id="${m.id}">Enregistrer</button>`,
    onMount: mm => {
      const q = mm.el.querySelector('#me-qty');
      if (q) { const upd = () => { const mac = D.macrosFor(food, U.parseNum(q.value) || 0); mm.el.querySelector('#me-live').innerHTML = `<div><b>${U.num(mac.kcal)}</b><span>kcal</span></div><div><b class="m-p">${U.num(mac.p)}</b><span>protéines</span></div><div><b class="m-c">${U.num(mac.c)}</b><span>glucides</span></div><div><b class="m-f">${U.num(mac.f)}</b><span>lipides</span></div>`; }; q.addEventListener('input', upd); upd(); }
    }
  });
};
A.mealSave = async el => {
  const m = DB.get('meals', el.dataset.id);
  const o = UI.form(document.getElementById('mef'));
  const food = m.foodId ? D.food(m.foodId) : null;
  const rec = !food && m.recipeId ? D.recipe(m.recipeId) : null;
  let upd;
  if (rec) { const por = +o.portions || 1; upd = { ...m, slot: o.slot, portions: por, name: rec.name + (por !== 1 ? ` (× ${U.num(por, por % 1 ? 2 : 0)})` : ''), ...D.recipeMacros(rec, por) }; }
  else if (food) { const qty = U.parseNum(document.getElementById('me-qty').value); if (!qty) { UI.toast('Quantité invalide', { type: 'err' }); return; } upd = { ...m, qty, slot: o.slot, ...D.macrosFor(food, qty) }; }
  else upd = { ...m, slot: o.slot, kcal: U.parseNum(document.getElementById('me-kcal').value) || 0, p: U.parseNum(document.getElementById('me-p').value) || 0, c: U.parseNum(document.getElementById('me-c').value) || 0, f: U.parseNum(document.getElementById('me-f').value) || 0 };
  await DB.put('meals', upd); UI.top().close(); UI.toast('Modifié'); App.changed();
};
A.mealDel = async el => {
  const old = DB.get('meals', el.dataset.id);
  await DB.del('meals', old.id); UI.top().close();
  UI.toast(`${old.name} retiré`, { action: { label: 'Annuler', fn: async () => { await DB.put('meals', old); App.changed(); } } });
  App.changed();
};
A.slotClear = async el => {
  const date = Pages.nutrition.date, arr = D.mealsOn(date).filter(m => m.slot === el.dataset.slot);
  await DB.delMany('meals', arr.map(m => m.id));
  UI.toast(`${D.slotLabel(el.dataset.slot)} vidé`, { action: { label: 'Annuler', fn: async () => { await DB.putMany('meals', arr); App.changed(); } } });
  App.changed();
};
function copyMeals(src, date, slot = null) {
  const t = Date.now();
  return src.map((m, i) => ({ ...m, id: U.uid(), date, slot: slot || m.slot, t: t + i }));
}
A.slotCopy = async el => {
  const date = Pages.nutrition.date;
  const src = D.mealsOn(el.dataset.from).filter(m => m.slot === el.dataset.slot);
  const add = copyMeals(src, date);
  await DB.putMany('meals', add);
  UI.toast(`${D.slotLabel(el.dataset.slot)} copié · ${U.num(U.sum(add.map(m => m.kcal)))} kcal`, { action: { label: 'Annuler', fn: async () => { await DB.delMany('meals', add.map(m => m.id)); App.changed(); } } });
  App.changed();
};

/* Copier une journée entière */
A.nutCopyDay = () => {
  const date = Pages.nutrition.date;
  const days = U.range(U.addDays(date, -21), U.addDays(date, -1)).reverse().filter(d => D.dayTotals(d).count);
  UI.open({
    title: 'Copier une journée', sub: `Vers ${U.relDay(date).toLowerCase()}`, size: 'md',
    body: days.length ? `<div class="list">${days.map(d => { const t = D.dayTotals(d); const slots = D.SLOTS.filter(s => D.mealsOn(d).some(m => m.slot === s.id)); return `<div class="li"><span class="grow"><span class="t">${U.relDay(d)}</span><span class="s">${U.num(t.kcal)} kcal · P ${U.num(t.p)} g · ${t.count} aliments</span>
      <span class="chips" style="margin-top:6px">${slots.map(s => `<button class="chip" data-act="copyPart" data-from="${d}" data-slot="${s.id}">${s.label}</button>`).join('')}</span></span><button class="btn sm primary" data-act="copyPart" data-from="${d}">Tout copier</button></div>`; }).join('')}</div>`
      : UI.empty('copy', 'Aucune journée à copier', 'Les journées déjà notées des 3 dernières semaines apparaîtront ici.')
  });
};
A.copyPart = async el => {
  const date = Pages.nutrition.date;
  let src = D.mealsOn(el.dataset.from);
  if (el.dataset.slot) src = src.filter(m => m.slot === el.dataset.slot);
  const add = copyMeals(src, date);
  await DB.putMany('meals', add);
  UI.top().close();
  UI.toast(`${add.length} aliment${add.length > 1 ? 's' : ''} copié${add.length > 1 ? 's' : ''} depuis ${U.relDay(el.dataset.from).toLowerCase()}`, { action: { label: 'Annuler', fn: async () => { await DB.delMany('meals', add.map(m => m.id)); App.changed(); } } });
  App.changed();
};

/* Favoris */
A.favSave = el => {
  const slot = el.dataset.slot, date = Pages.nutrition.date;
  const items = D.mealsOn(date).filter(m => m.slot === slot);
  const def = { breakfast: 'Petit-déjeuner habituel', lunch: 'Déjeuner habituel', dinner: 'Dîner habituel', snack: 'Collation habituelle' }[slot];
  UI.open({
    title: 'Nouveau favori', sub: `${items.length} aliments · ${U.num(U.sum(items.map(m => m.kcal)))} kcal`, size: 'sm',
    body: `<form id="favf" class="stack"><label class="field"><span>Nom du favori</span><input id="fav-name" value="${def}"></label><p class="hint" style="margin:0">${U.esc(items.map(i => i.name).join(', '))}</p></form>`,
    footer: `<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="favSaveGo" data-slot="${slot}">Enregistrer</button>`,
    onMount: m => { m.items = items; m.el.querySelector('#favf').addEventListener('submit', e => { e.preventDefault(); A.favSaveGo(m.el.querySelector('[data-act="favSaveGo"]')); }); }
  });
};
A.favSaveGo = async el => {
  const m = UI.top(); const name = document.getElementById('fav-name').value.trim() || 'Favori';
  await DB.put('favorites', { id: U.uid(), name, slot: el.dataset.slot, items: m.items.map(({ foodId, name, qty, unit, kcal, p, c, f }) => ({ foodId, name, qty, unit, kcal, p, c, f })) });
  m.close(); UI.toast(`« ${name} » ajouté aux favoris`); App.changed();
};
A.favAdd = async el => {
  const f = DB.get('favorites', el.dataset.id); if (!f) return;
  const date = Pages.nutrition.date;
  const t = Date.now();
  const add = f.items.map((it, i) => ({ ...it, id: U.uid(), date, slot: el.dataset.slot || f.slot, t: t + i }));
  await DB.putMany('meals', add);
  UI.toast(`${f.name} ajouté · ${U.num(U.sum(add.map(m => m.kcal)))} kcal`, { action: { label: 'Annuler', fn: async () => { await DB.delMany('meals', add.map(m => m.id)); App.changed(); } } });
  App.changed();
};

/* Bibliothèque : aliments perso, favoris, base */
A.nutLibrary = () => {
  const st = { tab: 'custom', q: '' };
  UI.open({
    title: 'Mes aliments', size: 'md', live: true,
    body: () => {
      const custom = DB.all('foods').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      const favs = DB.all('favorites');
      const tabs = `<div class="seg full">${[['custom', `Personnels (${custom.length})`], ['favs', `Favoris (${favs.length})`], ['base', 'Base']].map(([v, l]) => `<button data-libtab="${v}" class="${st.tab === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      let list;
      if (st.tab === 'custom') list = custom.length ? `<div class="list">${custom.map(f => `<div class="li act" data-act="foodEditOpen" data-id="${f.id}"><span class="grow"><span class="t">${U.esc(f.name)}</span><span class="s">100 g : ${U.num(f.kcal)} kcal · P ${U.num(f.p, 1)} · G ${U.num(f.c, 1)} · L ${U.num(f.f, 1)}</span></span>${U.icon('edit', 'sm')}</div>`).join('')}</div>` : UI.empty('food', 'Aucun aliment personnel', 'Crée tes produits habituels avec les valeurs de l\'étiquette pour les ajouter en deux gestes.');
      else if (st.tab === 'favs') list = favs.length ? `<div class="list">${favs.map(f => `<div class="li"><span class="ic-badge sm" style="--c:var(--goal)">${U.icon('star')}</span><span class="grow"><span class="t">${U.esc(f.name)}</span><span class="s">${D.slotLabel(f.slot)} · ${U.num(U.sum(f.items.map(i => i.kcal)))} kcal · ${U.esc(f.items.map(i => i.name).join(', '))}</span></span><button class="icon-btn sm" data-act="favDel" data-id="${f.id}" title="Supprimer">${U.icon('trash')}</button></div>`).join('')}</div>` : UI.empty('star', 'Aucun favori', 'Dans un repas, touche l\'étoile pour l\'enregistrer et le rajouter ensuite en un geste.');
      else list = `<p class="hint" style="margin:0">Valeurs moyennes indicatives pour 100 g. Touche un aliment pour l'ajuster à tes produits.</p><div class="list">${D.foods().filter(f => f.base).map(f => `<div class="li act" data-act="foodEditOpen" data-id="${f.id}"><span class="grow"><span class="t">${U.esc(f.name)}</span><span class="s">${U.num(f.kcal)} kcal · P ${U.num(f.p, 1)} · G ${U.num(f.c, 1)} · L ${U.num(f.f, 1)}</span></span>${U.icon('edit', 'sm')}</div>`).join('')}</div>`;
      return tabs + list;
    },
    footer: `<button class="btn primary" data-act="foodCreate">${U.icon('plus', 'sm')}Créer un aliment</button>`,
    onMount: m => m.el.querySelectorAll('[data-libtab]').forEach(b => b.addEventListener('click', () => { st.tab = b.dataset.libtab; m.render(); }))
  });
};
A.foodEditOpen = el => F.foodEdit(el.dataset.id);
A.favDel = async el => { const old = DB.get('favorites', el.dataset.id); await DB.del('favorites', old.id); UI.toast('Favori supprimé', { action: { label: 'Annuler', fn: async () => { await DB.put('favorites', old); App.changed(); } } }); App.changed(); };
