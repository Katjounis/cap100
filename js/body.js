'use strict';
/* Cap 100 — corps : poids, mensurations, photos */

const PhotoURL = (() => { const c = new Map(); return p => { if (!p || !p.blob) return ''; if (!c.has(p.id)) c.set(p.id, URL.createObjectURL(p.blob)); return c.get(p.id); }; })();

Pages.body = {
  title: 'Corps',
  nav: 'corps',
  tab: 'weight',
  period: '90',
  layers: { raw: true, avg: true, trend: true, plan: true },
  measure: 'waist',
  histLimit: 14,
  render() {
    const tabs = [['weight', 'Poids', 'scale'], ['measures', 'Mensurations', 'ruler'], ['photos', 'Photos', 'camera']];
    return `<div class="page-head"><div><h1>Corps</h1><div class="sub">Le poids, les mensurations et les photos racontent ensemble ta transformation.</div></div>
      <div class="actions">${this.tab === 'weight' ? `<button class="btn primary" data-act="quickWeight">${U.icon('plus', 'sm')}Pesée</button>` : this.tab === 'measures' ? `<button class="btn primary" data-act="measNew">${U.icon('plus', 'sm')}Mensurations</button>` : `<button class="btn" data-act="photoCompare" ${DB.all('photos').length < 2 ? 'disabled' : ''}>${U.icon('compare', 'sm')}Comparer</button><button class="btn primary" data-act="photoNew">${U.icon('plus', 'sm')}Photo</button>`}</div></div>
      <div class="tabs">${tabs.map(([v, l, ic]) => `<button data-act="bodyTab" data-v="${v}" class="${this.tab === v ? 'on' : ''}">${U.icon(ic, 'sm')}${l}</button>`).join('')}</div>
      ${this['tab_' + this.tab]()}`;
  },
  tab_weight() {
    const s = D.weightSeries();
    const cur = s[s.length - 1];
    const prog = D.progress(), rate = D.rate();
    const min = s.length ? s.reduce((b, p) => p.kg < b.kg ? p : b) : null;
    const rows = s.slice().reverse().slice(0, this.histLimit);
    return `<div class="grid g-dash">
      <section class="card span-4"><div class="card-h"><div><div class="eyebrow">Saisie rapide</div><h2>${U.relDay(U.today())}</h2></div></div>
        <form id="wi" class="stack"><div class="stepper"><button type="button" data-act="wiStep" data-d="-0.1" aria-label="Moins 0,1">−</button><div class="input-unit grow"><input class="input" id="wi-kg" inputmode="decimal" value="${cur ? U.kg(DB.get('weights', U.today()) ? DB.get('weights', U.today()).kg : cur.kg) : U.kg(D.goal().start)}" aria-label="Poids"><em>kg</em></div><button type="button" data-act="wiStep" data-d="0.1" aria-label="Plus 0,1">+</button></div>
          <button class="btn primary lg block" data-act="wiSave">${DB.get('weights', U.today()) ? 'Mettre à jour la pesée du jour' : 'Enregistrer la pesée du jour'}</button></form>
        <div class="grid g-2" style="gap:14px 12px;margin-top:18px">
          <div class="kpi"><span class="l">Moyenne 7 jours</span><span class="v">${cur ? U.kg(cur.avg7) : '–'}<small>kg</small></span></div>
          <div class="kpi"><span class="l">Tendance lissée</span><span class="v">${cur ? U.kg(cur.trend) : '–'}<small>kg</small></span></div>
          <div class="kpi"><span class="l">Depuis le départ</span><span class="v ${prog.lost > 0 ? 'good-c' : ''}">${U.sign(-prog.lost)}<small>kg</small></span></div>
          <div class="kpi"><span class="l">Rythme (4 sem.)</span><span class="v">${rate != null ? U.sign(rate, 2) : '–'}<small>kg/sem</small></span></div>
          <div class="kpi"><span class="l">Plus bas</span><span class="v">${min ? U.kg(min.kg) : '–'}<small>kg</small></span><span class="d faint">${min ? U.fmtShort(min.date) : ''}</span></div>
          <div class="kpi"><span class="l">Pesées</span><span class="v">${s.length}</span></div>
        </div></section>
      <section class="card span-8"><div class="card-h"><div><div class="eyebrow">Courbe</div><h2>Poids, moyenne et tendance</h2></div><span class="spacer"></span>
        <div class="seg">${PERIODS.map(([v, l]) => `<button data-act="bodyPeriod" data-v="${v}" class="${this.period === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div id="body-wchart" data-h="280"></div>
        <div class="legend" style="margin-top:10px">${[['raw', 'Pesées', 'dotl', 'var(--c-weight)'], ['avg', 'Moyenne 7 jours', '', 'var(--c-weight)'], ['trend', 'Tendance lissée', '', 'var(--c-strength)'], ['plan', 'Repère linéaire', 'dash', 'var(--goal)']].map(([k, l, cls, c]) => `<button data-act="bodyLayer" data-k="${k}" class="${this.layers[k] ? '' : 'off'}"><i class="${cls}" style="--c:${c}"></i>${l}</button>`).join('')}</div>
        <div class="note" style="margin-top:14px">${U.icon('info', 'sm')}<span>D'un jour à l'autre, le poids peut varier d'un kilo ou plus (eau, sel, digestion, entraînement). Ces écarts ne sont pas de la masse grasse. La <b>moyenne 7 jours</b> et la <b>tendance lissée</b> filtrent ce bruit : ce sont elles qui mesurent ta progression réelle.</span></div>
      </section>
      <section class="card span-12"><div class="card-h"><h3>Historique</h3><span class="spacer"></span><span class="xs faint">${s.length} pesées</span></div>
        ${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th class="r">Poids</th><th class="r">Écart</th><th class="r">Moyenne 7 j</th><th>Note</th><th></th></tr></thead><tbody>
          ${rows.map((p, i) => { const prev = s[s.length - 1 - i - 1]; const d = prev ? p.kg - prev.kg : null; const w = DB.get('weights', p.date); return `<tr><td>${U.fmtLong(p.date)}</td><td class="r"><b>${U.kg(p.kg)}</b> kg</td><td class="r ${d == null ? 'faint' : d < 0 ? 'good-c' : d > 0 ? 'faint' : 'faint'}">${d == null ? '–' : U.sign(d)}</td><td class="r">${U.kg(p.avg7)}</td><td class="faint">${U.esc(w && w.note || '')}</td><td class="r"><button class="icon-btn sm" data-act="editWeight" data-date="${p.date}" aria-label="Modifier">${U.icon('edit')}</button></td></tr>`; }).join('')}</tbody></table></div>
          ${s.length > this.histLimit ? `<button class="btn sm block" style="margin-top:10px" data-act="bodyMore">Afficher plus</button>` : ''}`
          : UI.empty('scale', 'Aucune pesée', 'Commence par ta pesée du jour : c\'est ton point de départ.')}
      </section></div>`;
  },
  tab_measures() {
    const all = DB.all('measurements').sort((a, b) => a.date < b.date ? -1 : 1);
    if (!all.length) return `<div class="card">${UI.empty('ruler', 'Aucune mensuration', 'Mesure ton tour de taille, de poitrine, tes épaules, tes bras et tes cuisses une fois toutes les 2 à 4 semaines. Elles montrent la recomposition même quand la balance stagne.', '<button class="btn primary" data-act="measNew">Premières mensurations</button>')}</div>`;
    const first = all[0], last = all[all.length - 1], prev = all[all.length - 2];
    const val = (id, arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i][id] != null) return arr[i][id]; return null; };
    const firstVal = id => { const r = all.find(x => x[id] != null); return r ? r[id] : null; };
    const ratioSeries = all.filter(r => r.shoulders && r.waist).map(r => ({ x: r.date, y: +(r.shoulders / r.waist).toFixed(3) }));
    return `<div class="grid g-dash">
      <section class="card span-8"><div class="card-h"><div><div class="eyebrow">Dernières mesures · ${U.fmtFull(last.date)}</div><h2>Mensurations</h2></div></div>
        <div class="grid g-3" style="gap:16px 12px">${D.MEASURES.map(me => { const v = val(me.id, all); if (v == null) return ''; const f0 = firstVal(me.id); const d = f0 != null ? v - f0 : null; const good = me.id === 'shoulders' || me.id === 'arm' || me.id === 'chest' ? null : (d < 0); return `<button class="kpi" data-act="measPick" data-v="${me.id}" style="text-align:left;padding:10px;border-radius:12px;${this.measure === me.id ? 'background:var(--accent-soft)' : ''}"><span class="l">${me.label}</span><span class="v">${U.num(v, 1)}<small>cm</small></span><span class="d ${good === true ? 'good-c' : 'faint'}">${d != null && all.length > 1 ? U.sign(d) + ' cm depuis le début' : 'Première mesure'}</span></button>`; }).join('')}</div></section>
      <section class="card span-4"><div class="card-h"><div><div class="eyebrow">Silhouette athlétique</div><h2>Ratio épaules / taille</h2></div></div>
        ${ratioSeries.length ? `<div class="big">${U.num(ratioSeries[ratioSeries.length - 1].y, 2)}</div><p class="small muted">Plus ce ratio augmente, plus la silhouette s'affine en « V » : la taille diminue pendant que la carrure est conservée. ${ratioSeries.length > 1 ? `Départ : ${U.num(ratioSeries[0].y, 2)}.` : ''}</p><div id="ratio-chart" data-h="120"></div>`
          : `<p class="small muted">Renseigne tes <b>épaules</b> et ton <b>tour de taille</b> pour suivre ce ratio : il traduit directement l'objectif d'une carrure conservée et d'une taille affinée.</p>`}
      </section>
      <section class="card span-12"><div class="card-h"><div><div class="eyebrow">Évolution</div><h2>${D.MEASURES.find(m => m.id === this.measure).label}</h2></div><span class="spacer"></span>
        <div class="seg">${D.MEASURES.filter(me => all.some(r => r[me.id] != null)).map(me => `<button data-act="measPick" data-v="${me.id}" class="${this.measure === me.id ? 'on' : ''}">${me.label.replace('Tour de ', '')}</button>`).join('')}</div></div>
        <div id="meas-chart" data-h="220"></div></section>
      <section class="card span-12"><div class="card-h"><h3>Historique</h3></div><div class="table-wrap"><table class="t"><thead><tr><th>Date</th>${D.MEASURES.map(m => `<th class="r">${m.label.replace('Tour de ', '')}</th>`).join('')}<th></th></tr></thead><tbody>
        ${all.slice().reverse().map(r => `<tr><td>${U.fmtFull(r.date)}</td>${D.MEASURES.map(m => `<td class="r">${r[m.id] != null ? U.num(r[m.id], 1) : '<span class="faint">–</span>'}</td>`).join('')}<td class="r"><button class="icon-btn sm" data-act="measEdit" data-date="${r.date}" aria-label="Modifier">${U.icon('edit')}</button></td></tr>`).join('')}</tbody></table></div></section>
    </div>`;
  },
  tab_photos() {
    const ps = DB.all('photos').sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created || 0) - (b.created || 0));
    if (!ps.length) return `<div class="card">${UI.empty('camera', 'Aucune photo', 'Une photo de face et une de profil tous les mois, même lumière, même tenue. C\'est souvent là que la transformation se voit le mieux.', '<button class="btn primary" data-act="photoNew">Ajouter ma photo de départ</button>')}<div class="note" style="max-width:520px;margin:0 auto">${U.icon('shield', 'sm')}<span>Les photos restent sur cet appareil, dans le navigateur. Elles ne sont jamais envoyées sur un serveur. Pense à les inclure dans tes sauvegardes (Réglages → Exporter).</span></div></div>`;
    const d0 = ps[0].date;
    const label = d => { const days = U.diffDays(d0, d); if (days < 7) return 'Départ'; if (days < 28) return `+${Math.round(days / 7)} sem.`; return `+${Math.round(days / 30.4)} mois`; };
    const groups = new Map();
    ps.forEach(p => { const k = label(p.date); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
    return `<div class="stack" style="gap:20px">${[...groups.entries()].reverse().map(([k, arr]) => `<section><div class="row" style="margin-bottom:10px"><h3 style="margin:0;font:700 22px var(--display);text-transform:uppercase">${k}</h3><span class="small faint">${U.fmtFull(arr[0].date)}</span></div>
      <div class="photo-grid">${arr.map(p => `<button class="photo" data-act="photoView" data-id="${p.id}"><img src="${PhotoURL(p)}" alt="Photo du ${U.fmtFull(p.date)}, ${p.pose}" loading="lazy"><span class="cap">${U.cap(p.pose)} · ${U.fmtShort(p.date)}</span></button>`).join('')}</div></section>`).join('')}
      <div class="note">${U.icon('shield', 'sm')}<span>Stockées uniquement dans ce navigateur. Elles sont incluses dans l'export JSON si tu coches l'option photos.</span></div></div>`;
  },
  mount(root) {
    if (this.tab === 'weight') weightChart(root.querySelector('#body-wchart'), { period: this.period, layers: this.layers });
    if (this.tab === 'measures') {
      const all = DB.all('measurements').sort((a, b) => a.date < b.date ? -1 : 1);
      const el = root.querySelector('#meas-chart');
      const pts = all.filter(r => r[this.measure] != null).map(r => ({ x: r.date, y: r[this.measure] }));
      if (el) { if (pts.length) Charts.line(el, { height: 220, label: 'Mensuration', series: [{ name: 'cm', color: 'var(--c-bike)', style: 'area', dots: true, endDot: true, points: pts }], minRange: 4, yFmt: v => U.num(v), tip: (d, v) => `${U.fmtFull(d)}<br><b>${U.num(v[0].p.y, 1)} cm</b>` }); else el.innerHTML = '<p class="faint small">Pas de valeur pour cette mesure.</p>'; }
      const rc = root.querySelector('#ratio-chart');
      const rs = all.filter(r => r.shoulders && r.waist).map(r => ({ x: r.date, y: +(r.shoulders / r.waist).toFixed(3) }));
      if (rc && rs.length > 1) Charts.line(rc, { height: 120, label: 'Ratio', series: [{ name: 'Ratio', color: 'var(--accent)', dots: true, endDot: true, points: rs }], minRange: 0.04, yFmt: v => U.num(v, 2), tip: (d, v) => `${U.fmtShort(d)}<br><b>${U.num(v[0].p.y, 2)}</b>` });
    }
  }
};
A.bodyTab = el => { Pages.body.tab = el.dataset.v; App.renderView(false); };
A.bodyPeriod = el => { Pages.body.period = el.dataset.v; App.renderView(false); };
A.bodyLayer = el => { const L = Pages.body.layers; L[el.dataset.k] = !L[el.dataset.k]; if (!L.raw && !L.avg && !L.trend) L.avg = true; App.renderView(false); };
A.bodyMore = () => { Pages.body.histLimit += 60; App.renderView(false); };
A.wiStep = el => { const i = document.getElementById('wi-kg'); i.value = U.num(Math.max(0, (U.parseNum(i.value) || 0) + +el.dataset.d), 1); };
A.wiSave = async () => {
  const kg = U.parseNum(document.getElementById('wi-kg').value);
  if (!kg || kg < 30 || kg > 400) { UI.toast('Indique un poids entre 30 et 400 kg', { type: 'err' }); return; }
  const old = DB.get('weights', U.today());
  await DB.put('weights', { date: U.today(), kg: Math.round(kg * 10) / 10, note: old ? old.note : '' });
  UI.toast(`${U.kg(kg)} kg enregistré · moyenne 7 j ${U.kg(D.current().avg7)} kg`); App.changed();
};
A.measNew = () => F.measure(U.today());
A.measEdit = el => F.measure(el.dataset.date);
A.measPick = el => { Pages.body.measure = el.dataset.v; App.renderView(false); };
A.photoNew = () => F.photo(U.today());
A.photoView = el => {
  const p = DB.get('photos', el.dataset.id);
  UI.open({
    title: U.cap(p.pose), sub: U.fmtLong(p.date), size: 'md',
    body: `<img src="${PhotoURL(p)}" alt="" style="width:100%;max-height:68vh;object-fit:contain;border-radius:12px;background:var(--surface-2)">${p.note ? `<p class="muted" style="margin:0">${U.esc(p.note)}</p>` : ''}`,
    footer: `<button class="btn ghost danger" data-act="photoDel" data-id="${p.id}">${U.icon('trash')}Supprimer</button><span class="spacer"></span><button class="btn" data-act="photoCompare" data-id="${p.id}">${U.icon('compare', 'sm')}Comparer</button>`
  });
};
A.photoDel = async el => {
  const ok = await UI.confirm({ title: 'Supprimer la photo ?', text: 'Elle sera effacée de cet appareil.', ok: 'Supprimer', danger: true });
  if (!ok) return;
  await DB.del('photos', el.dataset.id); UI.top().close(); UI.toast('Photo supprimée'); App.changed();
};
A.photoCompare = el => {
  const ps = DB.all('photos').sort((a, b) => a.date < b.date ? -1 : 1);
  if (ps.length < 2) { UI.toast('Ajoute au moins deux photos pour comparer', { type: 'info' }); return; }
  const t = UI.top(); if (t && el.dataset.id) t.close();
  let after = el.dataset.id ? DB.get('photos', el.dataset.id) : ps[ps.length - 1];
  let before = ps.find(p => p.pose === after.pose && p.id !== after.id) || ps.find(p => p.id !== after.id);
  if (before.date > after.date) [before, after] = [after, before];
  const st = { a: before.id, b: after.id, mode: 'slider', x: 50 };
  const opt = sel => ps.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${U.fmtFull(p.date)} · ${p.pose}</option>`).join('');
  UI.open({
    title: 'Avant / maintenant', size: 'lg',
    body: () => {
      const A1 = DB.get('photos', st.a), B1 = DB.get('photos', st.b);
      const days = Math.abs(U.diffDays(A1.date, B1.date));
      const wa = D.weightSeries().filter(p => p.date <= A1.date).pop(), wb = D.weightSeries().filter(p => p.date <= B1.date).pop();
      return `<div class="fields"><label class="field"><span>Avant</span><select id="cmp-a">${opt(st.a)}</select></label><label class="field"><span>Maintenant</span><select id="cmp-b">${opt(st.b)}</select></label></div>
      <div class="row between wrap"><div class="seg">${[['slider', 'Curseur'], ['side', 'Côte à côte']].map(([v, l]) => `<button data-cmpmode="${v}" class="${st.mode === v ? 'on' : ''}">${l}</button>`).join('')}</div><span class="small muted">${days} jours d'écart${wa && wb ? ` · ${U.sign(wb.avg7 - wa.avg7)} kg (moyenne 7 j)` : ''}</span></div>
      ${st.mode === 'slider' ? `<div class="compare" id="cmp" style="--x:${st.x}%"><img src="${PhotoURL(A1)}" alt="Avant"><img class="after" src="${PhotoURL(B1)}" alt="Maintenant"><span class="lb" style="left:10px">${U.fmtShort(A1.date)}</span><span class="lb" style="right:10px">${U.fmtShort(B1.date)}</span><div class="handle"></div></div>`
        : `<div class="side"><figure><img src="${PhotoURL(A1)}" alt="Avant"><figcaption>Avant · ${U.fmtFull(A1.date)}</figcaption></figure><figure><img src="${PhotoURL(B1)}" alt="Maintenant"><figcaption>Maintenant · ${U.fmtFull(B1.date)}</figcaption></figure></div>`}`;
    },
    onMount: m => {
      m.el.querySelector('#cmp-a').addEventListener('change', e => { st.a = e.target.value; m.render(); });
      m.el.querySelector('#cmp-b').addEventListener('change', e => { st.b = e.target.value; m.render(); });
      m.el.querySelectorAll('[data-cmpmode]').forEach(b => b.addEventListener('click', () => { st.mode = b.dataset.cmpmode; m.render(); }));
      const c = m.el.querySelector('#cmp');
      if (c) {
        let drag = false;
        const set = e => { const r = c.getBoundingClientRect(); st.x = U.clamp((e.clientX - r.left) / r.width * 100, 0, 100); c.style.setProperty('--x', st.x + '%'); };
        c.addEventListener('pointerdown', e => { drag = true; c.setPointerCapture(e.pointerId); set(e); });
        c.addEventListener('pointermove', e => { if (drag) set(e); });
        c.addEventListener('pointerup', () => { drag = false; });
      }
    }
  });
};
