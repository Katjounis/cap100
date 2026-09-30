'use strict';
/* Cap 100 — habitudes : régularité plutôt que séries */

Pages.habits = {
  title: 'Habitudes',
  nav: 'habitudes',
  week: null,
  render() {
    const today = U.today();
    const ws = this.week || (this.week = U.weekStart(today));
    const days = U.range(ws, U.addDays(ws, 6));
    const hs = D.habits();
    const w = D.weekSummary(ws);
    const isCur = ws === U.weekStart(today);
    const targetSum = U.sum(hs.map(h => h.perWeek));
    const doneSum = U.sum(hs.map(h => Math.min(h.perWeek, D.habitCount(h, ws, days[6]))));
    const weeks = Array.from({ length: 12 }, (_, i) => U.addDays(U.weekStart(today), -7 * (11 - i)));
    return `<div class="page-head"><div><h1>Habitudes</h1><div class="sub">La régularité compte plus que la perfection. Aucune série à « casser » ici.</div></div>
      <div class="actions"><button class="btn primary" data-act="habitEdit">${U.icon('plus', 'sm')}Nouvelle habitude</button></div></div>
    <div class="grid g-dash">
      <section class="card span-8">
        <div class="card-h"><button class="icon-btn" data-act="habWeek" data-d="-7" aria-label="Semaine précédente">${U.icon('chevL')}</button><div class="grow center"><div class="eyebrow">${isCur ? 'Cette semaine' : 'Semaine'}</div><h2>${U.fmtShort(ws)} – ${U.fmtShort(days[6])}</h2></div><button class="icon-btn" data-act="habWeek" data-d="7" ${isCur ? 'disabled style="opacity:.3"' : ''} aria-label="Semaine suivante">${U.icon('chevR')}</button></div>
        ${hs.length ? `<div class="habit" style="padding-top:0;border:0"><span></span><div class="h-days">${days.map((d, i) => `<span class="center xs faint" style="font-weight:700">${U.dayLetter(i)} ${U.parse(d).getDate()}</span>`).join('')}</div><span class="h-reg xs faint">semaine</span></div>
          ${hs.map(h => { const c = D.HABIT_COLORS[h.color % D.HABIT_COLORS.length]; const n = D.habitCount(h, ws, days[6]); return `<div class="habit"><div class="hn"><span class="ic-badge sm" style="--c:${c}">${U.icon(h.icon)}</span><div style="min-width:0"><b>${U.esc(h.name)}</b><button class="h-edit" data-act="habitEdit" data-id="${h.id}">${h.auto ? 'Auto · ' + D.HABIT_AUTO[h.auto].label.toLowerCase() : 'À cocher'} · ${U.icon('edit', 'sm')}</button></div></div>
            <div class="h-days" style="--c:${c}">${days.map(d => { const on = D.habitDone(h, d); const fut = d > today; return h.auto ? `<span class="h-day auto ${on ? 'on' : ''} ${d === today ? 'today' : ''} ${fut ? 'future' : ''}" title="${U.fmtLong(d)}">${on ? U.icon('check', 'sm') : ''}</span>` : `<button class="h-day ${on ? 'on' : ''} ${d === today ? 'today' : ''} ${fut ? 'future' : ''}" data-act="habitToggle" data-id="${h.id}" data-date="${d}" aria-label="${U.esc(h.name)}, ${U.fmtLong(d)}">${on ? U.icon('check', 'sm') : ''}</button>`; }).join('')}</div>
            <div class="h-reg"><b class="${n >= h.perWeek ? 'good-c' : ''}">${n}</b><span class="faint small"> / ${h.perWeek}</span></div></div>`; }).join('')}`
          : UI.empty('repeat', 'Aucune habitude', 'Crée quelques habitudes simples. Certaines se cochent toutes seules à partir de tes données (pas, séances, protéines).', '<button class="btn primary sm" data-act="habitDefaults">Ajouter les habitudes suggérées</button>')}
      </section>
      <section class="card span-4"><div class="card-h"><div><div class="eyebrow">Régularité</div><h2>${isCur ? 'Cette semaine' : 'Semaine choisie'}</h2></div></div>
        <div class="row" style="gap:18px;align-items:center">${Charts.ring(targetSum ? doneSum / targetSum : 0, { size: 96, stroke: 8, color: 'var(--good)', icon: `<b style="font:700 22px var(--display);color:var(--ink)">${targetSum ? Math.round(doneSum / targetSum * 100) : 0}%</b>` })}
          <div class="stack" style="gap:6px"><div><b class="mid">${w.activeDays}</b><span class="muted"> / ${w.pastDays} jours actifs</span></div><div class="small muted">${doneSum} objectifs d'habitudes atteints sur ${targetSum}</div></div></div>
        <p class="hint">Un jour « actif » : une activité réalisée ou ton objectif de pas atteint. Les semaines imparfaites font partie du chemin.</p>
      </section>
      ${hs.length ? `<section class="card span-12"><div class="card-h"><div><div class="eyebrow">12 dernières semaines</div><h2>Vue d'ensemble</h2></div><span class="spacer"></span><span class="legend"><span><i class="dotl" style="--c:var(--surface-3);width:10px;height:10px;border-radius:3px"></i>0 %</span><span><i class="dotl" style="--c:color-mix(in srgb, var(--good) 45%, var(--surface-3));width:10px;height:10px;border-radius:3px"></i>partiel</span><span><i class="dotl" style="--c:var(--good);width:10px;height:10px;border-radius:3px"></i>objectif atteint</span></span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th></th>${weeks.map(x => `<th class="center" style="font-size:10px;padding:6px 2px">${U.fmtShort(x)}</th>`).join('')}</tr></thead><tbody>
        ${hs.map(h => `<tr><td style="font-weight:600">${U.esc(h.name)}</td>${weeks.map(x => { const n = D.habitCount(h, x, U.addDays(x, 6)); const r = U.clamp(n / h.perWeek, 0, 1); return `<td style="padding:4px 2px" title="${n} / ${h.perWeek}"><div style="height:22px;border-radius:6px;background:${r === 0 ? 'var(--surface-3)' : `color-mix(in srgb, var(--good) ${Math.round(25 + r * 75)}%, var(--surface-3))`}"></div></td>`; }).join('')}</tr>`).join('')}</tbody></table></div></section>` : ''}
    </div>`;
  }
};
A.habWeek = el => { const p = Pages.habits; p.week = U.addDays(p.week, +el.dataset.d); if (p.week > U.weekStart(U.today())) p.week = U.weekStart(U.today()); App.renderView(false); };
A.habitToggle = async el => {
  const id = el.dataset.id + '|' + el.dataset.date;
  if (DB.get('habitLogs', id)) await DB.del('habitLogs', id);
  else { await DB.put('habitLogs', { id, habitId: el.dataset.id, date: el.dataset.date }); if (navigator.vibrate) navigator.vibrate(10); }
  App.changed();
};
A.habitDefaults = async () => { await DB.putMany('habits', D.defaultHabits()); UI.toast('Habitudes ajoutées'); App.changed(); };
A.habitEdit = el => {
  const id = el.dataset.id;
  const h = id ? { ...DB.get('habits', id) } : { id: 'h-' + U.uid(), name: '', icon: 'star', color: DB.all('habits').length % D.HABIT_COLORS.length, auto: null, perWeek: 5, order: DB.all('habits').length };
  UI.open({
    title: id ? 'Modifier l\'habitude' : 'Nouvelle habitude', size: 'sm',
    body: () => `<form id="hf" class="stack"><label class="field"><span>Nom</span><input id="h-name" value="${U.esc(h.name)}" placeholder="Ex. Étirements 10 min"></label>
      <div class="field"><span>Icône</span><div class="chips">${D.HABIT_ICONS.map(ic => `<button type="button" class="chip ${h.icon === ic ? 'on' : ''}" data-hicon="${ic}" aria-label="${ic}" style="width:40px;padding:0;justify-content:center">${U.icon(ic, 'sm')}</button>`).join('')}</div></div>
      <div class="field"><span>Couleur</span><div class="chips">${D.HABIT_COLORS.map((c, i) => `<button type="button" data-hcolor="${i}" aria-label="Couleur ${i + 1}" style="width:32px;height:32px;border-radius:50%;background:${c};box-shadow:${h.color === i ? '0 0 0 3px var(--surface), 0 0 0 5px ' + c : 'none'}"></button>`).join('')}</div></div>
      <label class="field"><span>Validation</span><select id="h-auto"><option value="">Je coche moi-même</option>${Object.entries(D.HABIT_AUTO).map(([k, v]) => `<option value="${k}" ${h.auto === k ? 'selected' : ''}>Automatique : ${v.label.toLowerCase()}</option>`).join('')}</select><small>Les habitudes automatiques se cochent à partir de tes données.</small></label>
      <label class="field"><span>Objectif par semaine</span>${UI.pick('perWeek', [1, 2, 3, 4, 5, 6, 7].map(v => ({ v, l: String(v) })), h.perWeek, 'seg full')}</label></form>`,
    footer: `${id ? `<button class="btn ghost danger" data-act="habitDel" data-id="${id}">${U.icon('trash')}</button><span class="spacer"></span>` : ''}<button class="btn ghost" data-close-top>Annuler</button><button class="btn primary" data-act="habitSave">Enregistrer</button>`,
    onMount: m => {
      m.h = h;
      const sync = () => { h.name = m.el.querySelector('#h-name').value; h.auto = m.el.querySelector('#h-auto').value || null; h.perWeek = +m.el.querySelector('input[name="perWeek"]').value; };
      m.el.querySelectorAll('[data-hicon]').forEach(b => b.addEventListener('click', () => { sync(); h.icon = b.dataset.hicon; m.render(); }));
      m.el.querySelectorAll('[data-hcolor]').forEach(b => b.addEventListener('click', () => { sync(); h.color = +b.dataset.hcolor; m.render(); }));
      m.sync = sync;
    }
  });
};
A.habitSave = async () => {
  const m = UI.top(); m.sync(); const h = m.h;
  if (!h.name.trim()) { UI.toast('Donne un nom à l\'habitude', { type: 'err' }); return; }
  await DB.put('habits', h); m.close(); UI.toast('Habitude enregistrée'); App.changed();
};
A.habitDel = async el => {
  const ok = await UI.confirm({ title: 'Supprimer l\'habitude ?', text: 'Son historique sera aussi effacé.', ok: 'Supprimer', danger: true });
  if (!ok) return;
  const id = el.dataset.id;
  await DB.del('habits', id);
  await DB.delMany('habitLogs', DB.all('habitLogs').filter(l => l.habitId === id).map(l => l.id));
  UI.top().close(); UI.toast('Habitude supprimée'); App.changed();
};
