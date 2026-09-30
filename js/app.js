'use strict';
/* Cap 100 — application : navigation, thème, raccourcis, démarrage */

const NAV = [
  { group: 'Suivi', items: [
    { id: 'accueil', label: 'Accueil', icon: 'home', page: 'dashboard' },
    { id: 'calendrier', label: 'Calendrier', icon: 'calendar', page: 'calendar' },
    { id: 'repas', label: 'Alimentation', icon: 'food', page: 'nutrition' },
    { id: 'sport', label: 'Sport', icon: 'dumbbell', page: 'training' },
    { id: 'corps', label: 'Corps', icon: 'scale', page: 'body' }
  ] },
  { group: 'Progrès', items: [
    { id: 'coach', label: 'Coach', icon: 'sparkle', page: 'coach' },
    { id: 'objectif', label: 'Objectif', icon: 'flag', page: 'goal' },
    { id: 'stats', label: 'Statistiques', icon: 'chart', page: 'stats' },
    { id: 'habitudes', label: 'Habitudes', icon: 'repeat', page: 'habits' }
  ] },
  { group: 'Application', items: [
    { id: 'reglages', label: 'Réglages', icon: 'sliders', page: 'settings' }
  ] }
];
const ROUTES = Object.fromEntries(NAV.flatMap(g => g.items).map(i => [i.id, i]));

const App = {
  route: null,
  param: null,
  installPrompt: null,
  day: U.today(),
  parse() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    if (h.startsWith('seance-')) return { id: 'seance', page: 'workout', param: h.slice(7), nav: 'sport' };
    const r = ROUTES[h] || ROUTES.accueil;
    return { id: r.id, page: r.page, param: null, nav: r.id };
  },
  go(id) {
    if (location.hash === '#' + id) this.renderView(); else location.hash = id;
  },
  shell() {
    const navHtml = NAV.map(g => `<div class="nav-group">${g.group}</div>${g.items.map((it, i) => `<a class="nav-link" href="#${it.id}" data-nav="${it.id}">${U.icon(it.icon)}${it.label}</a>`).join('')}`).join('');
    document.getElementById('sidebar').innerHTML = `<div class="brand"><span class="brand-mark">100</span><div><div class="brand-name">Cap 100</div><div class="brand-sub">Transformation physique</div></div></div>
      <button class="btn primary block quick" data-act="quickOpen">${U.icon('plus', 'sm')}Ajouter<kbd style="margin-left:auto;background:transparent;color:inherit;border-color:currentColor;opacity:.6">N</kbd></button>
      ${navHtml}<div class="sidebar-foot"><div class="mini-goal" id="mini-goal"></div>
      <button class="btn ghost sm" data-act="cycleTheme" id="theme-btn"></button></div>`;
    document.getElementById('tabbar').innerHTML = [
      ['accueil', 'Accueil', 'home'], ['calendrier', 'Agenda', 'calendar'], null, ['repas', 'Repas', 'food'], ['sport', 'Sport', 'dumbbell']
    ].map(t => t ? `<a class="tab" href="#${t[0]}" data-nav="${t[0]}">${U.icon(t[2])}${t[1]}</a>` : `<button class="tab-fab" data-act="quickOpen" aria-label="Ajouter">${U.icon('plus')}</button>`).join('');
  },
  updateChrome() {
    const r = this.parse();
    U.$$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === r.nav));
    const page = Pages[r.page];
    const title = r.page === 'workout' ? 'Séance' : (ROUTES[r.id] || {}).label || page.title;
    document.getElementById('top-title').textContent = title;
    document.title = r.id === 'accueil' ? 'Cap 100' : `${title} · Cap 100`;
    const prog = D.progress();
    const mg = document.getElementById('mini-goal');
    if (mg) mg.innerHTML = `<div class="row between"><span>Vers ${U.num(prog.g.goal)} kg</span><b>${U.num(prog.pct * 100)} %</b></div>${UI.bar(prog.pct, 'var(--accent)')}<div class="xs faint" style="margin-top:6px">${U.kg(prog.ref)} kg · moyenne 7 jours</div>`;
    const theme = (DB.setting('prefs', {}).theme) || 'system';
    const tb = document.getElementById('theme-btn');
    if (tb) tb.innerHTML = `${U.icon(theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'monitor', 'sm')}Thème : ${theme === 'dark' ? 'sombre' : theme === 'light' ? 'clair' : 'système'}`;
    const demo = document.getElementById('demo-banner');
    demo.hidden = !D.isDemo();
    if (D.isDemo()) demo.innerHTML = `<span class="pill demo">Démo</span><span class="grow">Ces données sont <b>fictives</b> et servent à découvrir l'application.</span><button class="btn sm primary" data-act="clearDemo">Supprimer la démo et commencer</button>`;
    Charts.animateArcs(document.getElementById('sidebar'));
  },
  renderView(animate = true) {
    const r = this.parse();
    const page = Pages[r.page];
    const view = document.getElementById('view');
    if (this.route && (this.route.page !== r.page || this.route.param !== r.param)) {
      const prev = Pages[this.route.page];
      if (prev && prev.leave) prev.leave();
    }
    const changed = !this.route || this.route.id !== r.id || this.route.param !== r.param;
    this.route = r;
    const y = window.scrollY;
    Charts.reset();
    try {
      view.innerHTML = page.render(r.param);
      if (page.mount) page.mount(view, r.param);
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="card">${UI.empty('info', 'Un problème est survenu', U.esc(e.message || 'Erreur inattendue') + '. Tes données ne sont pas touchées.', '<a class="btn primary" href="#accueil">Retour à l\'accueil</a>')}</div>`;
    }
    Charts.animateArcs(view);
    if (changed) {
      if (animate) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
      window.scrollTo(0, 0);
    } else window.scrollTo(0, y);
    this.updateChrome();
  },
  changed() {
    const fresh = D.checkNew();
    this.renderView(false);
    UI.refreshAll();
    if (fresh.length) setTimeout(() => this.celebrateNew(fresh), 350);
  },
  celebrateNew(fresh) {
    if (UI.stack.length) { this._pending = [...(this._pending || []), ...fresh]; clearTimeout(this._pt); this._pt = setTimeout(() => { const f = this._pending; this._pending = null; this.celebrateNew(f); }, 700); return; }
    const ms = fresh.filter(f => f.kind === 'milestone').map(f => f.m).sort((a, b) => a.kg - b.kg);
    const bs = fresh.filter(f => f.kind === 'badge').map(f => f.b);
    if (ms.length) {
      const m = ms[0];
      const g = D.goal();
      UI.celebrate({
        icon: 'flag', title: m.goal ? 'Objectif atteint' : `Palier ${U.num(m.kg)} kg`,
        text: m.goal ? `Ta moyenne sur 7 jours est passée sous ${U.num(m.kg)} kg. Des mois de régularité : bravo.` : `Ta moyenne sur 7 jours est passée sous ${U.num(m.kg)} kg. ${U.num(g.start - m.kg)} kg depuis le départ.`,
        extra: `<div style="width:100%;margin-top:6px">${UI.bar(D.progress().pct, 'var(--accent)', 'thick')}<div class="xs faint" style="margin-top:6px">${U.num(D.progress().pct * 100)} % du chemin vers ${U.num(g.goal)} kg</div></div>` + (bs.length ? `<div class="xs faint">+ ${bs.length} jalon${bs.length > 1 ? 's' : ''} débloqué${bs.length > 1 ? 's' : ''}</div>` : '')
      });
    } else if (bs.length) {
      const b = bs[bs.length - 1];
      UI.celebrate({ icon: b.icon, title: b.label, text: b.desc + (bs.length > 1 ? ` · et ${bs.length - 1} autre${bs.length > 2 ? 's' : ''} jalon${bs.length > 2 ? 's' : ''}` : ''), extra: '<a class="card-link" href="#objectif" data-close-top>Voir tous les jalons</a>' });
    }
  },
  applyTheme() {
    const t = DB.setting('prefs', {}).theme || 'system';
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    U.$$('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#0B0F17' : '#F2F4F8'));
  },
  boot() {
    this.shell();
    this.applyTheme();
    this.route = null;
    this.renderView();
  },
  async init() {
    DB.onError = () => UI.toast('Enregistrement impossible : le stockage du navigateur est plein ou bloqué', { type: 'err', ms: 6000 });
    await DB.init();
    this.applyTheme();
    this.shell();
    if (D.meta().onboarded && DB.setting('exLib', 1) < 2) {
      // Passage à la bibliothèque « sans salle » : remplace les séances types d'origine, garde les séances perso et l'historique
      await DB.delMany('templates', ['tpl-upper', 'tpl-lower', 'tpl-full'].filter(id => DB.get('templates', id)));
      await DB.putMany('templates', D.defaultTemplates().filter(t => !DB.get('templates', t.id)));
      await DB.setSetting('exLib', 2);
    }
    if (!D.meta().onboarded) { document.getElementById('view').innerHTML = ''; OB.start(0); return; }
    this.renderView();
  }
};

/* Actions globales */
A.cycleTheme = async () => {
  const order = ['system', 'light', 'dark'];
  const cur = DB.setting('prefs', {}).theme || 'system';
  const next = order[(order.indexOf(cur) + 1) % 3];
  await DB.setSetting('prefs', { ...DB.setting('prefs', {}), theme: next });
  App.applyTheme(); App.renderView(false);
};
A.menu = () => {
  UI.open({
    title: 'Menu', size: 'sm', focus: false,
    body: `${NAV.map(g => `<div class="eyebrow">${g.group}</div><div class="list">${g.items.map(it => `<a class="li act" href="#${it.id}" data-close-top style="text-decoration:none;color:inherit"><span class="ic-badge sm">${U.icon(it.icon)}</span><span class="grow"><span class="t">${it.label}</span></span>${U.icon('chevR', 'sm')}</a>`).join('')}</div>`).join('')}
      <div class="seg full">${[['system', 'Système', 'monitor'], ['light', 'Clair', 'sun'], ['dark', 'Sombre', 'moon']].map(([v, l, ic]) => `<button data-act="setTheme" data-v="${v}" class="${(DB.setting('prefs', {}).theme || 'system') === v ? 'on' : ''}">${U.icon(ic, 'sm')} ${l}</button>`).join('')}</div>`
  });
};
A.shortcuts = () => UI.open({ title: 'Raccourcis', size: 'sm', body: `<div class="stack small">${SHORTCUTS.map(([k, l]) => `<div class="row"><kbd>${k}</kbd><span class="muted">${l}</span></div>`).join('')}</div>` });

window.addEventListener('hashchange', () => { UI.closeAll(); App.renderView(); });
window.addEventListener('scroll', () => { const t = document.querySelector('.topbar'); if (t) t.classList.toggle('scrolled', scrollY > 4); }, { passive: true });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const t = UI.top(); if (t) { t.close(); e.preventDefault(); } return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
  if (UI.stack.length || !document.getElementById('ob').hidden) return;
  const k = e.key.toLowerCase();
  const map = { n: () => F.quick(), p: () => F.weight(), r: () => F.food({ date: U.today() }), a: () => F.activity({ date: U.today() }), s: () => F.startWorkoutPicker(U.today()), '?': () => A.shortcuts() };
  if (map[k]) { e.preventDefault(); map[k](); return; }
  const all = NAV.flatMap(g => g.items);
  if (/^[1-9]$/.test(k) && all[+k - 1]) { e.preventDefault(); App.go(all[+k - 1].id); }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && App.day !== U.today() && D.meta().onboarded) { App.day = U.today(); App.renderView(false); }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => App.applyTheme());
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); App.installPrompt = e; });

/* Service worker : uniquement hors aperçu intégré et en contexte sécurisé */
if ('serviceWorker' in navigator && !U.inFrame && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

App.init();
