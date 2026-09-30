'use strict';
/* Cap 100 — composants d'interface : fenêtres, feuilles mobiles, toasts, confirmations, célébrations */

const A = {}; // registre des actions (data-act)
const Pages = {}; // modules de pages

const UI = (() => {
  const stack = [];
  const layerRoot = () => document.getElementById('layers');

  function open(opts) {
    const layer = document.createElement('div');
    layer.className = 'layer' + (opts.drawer ? ' drawer' : '');
    layer.innerHTML = `<div class="scrim"></div><div class="modal ${opts.size || ''}" role="dialog" aria-modal="true" aria-label="${U.esc(opts.title || '')}">
      <div class="handle-bar"></div>
      <div class="modal-h"><div class="grow"><h2></h2><div class="sub"></div></div><button class="icon-btn" data-close aria-label="Fermer">${U.icon('x')}</button></div>
      <div class="modal-b"></div><div class="modal-f" hidden></div></div>`;
    layerRoot().appendChild(layer);
    const modal = layer.querySelector('.modal');
    const m = {
      el: modal, layer, opts, closed: false,
      body: modal.querySelector('.modal-b'),
      render() {
        const o = m.opts;
        modal.querySelector('h2').textContent = typeof o.title === 'function' ? o.title() : (o.title || '');
        const sub = typeof o.sub === 'function' ? o.sub() : o.sub;
        const subEl = modal.querySelector('.modal-h .sub');
        subEl.textContent = sub || ''; subEl.hidden = !sub;
        const scroll = m.body.scrollTop;
        m.body.innerHTML = typeof o.body === 'function' ? o.body(m) : (o.body || '');
        const f = modal.querySelector('.modal-f');
        const foot = typeof o.footer === 'function' ? o.footer(m) : o.footer;
        f.innerHTML = foot || ''; f.hidden = !foot;
        if (o.onMount) o.onMount(m);
        Charts.animateArcs(modal);
        m.body.scrollTop = scroll;
      },
      close(result) {
        if (m.closed) return;
        m.closed = true;
        const i = stack.indexOf(m); if (i >= 0) stack.splice(i, 1);
        layer.classList.add('closing');
        setTimeout(() => layer.remove(), U.reduced() ? 0 : 220);
        if (m.opts.onClose) m.opts.onClose(result);
        if (!stack.length) document.body.style.overflow = '';
      }
    };
    layer.querySelector('.scrim').addEventListener('click', () => m.close());
    modal.querySelector('[data-close]').addEventListener('click', () => m.close());
    // Glisser vers le bas pour fermer (mobile)
    const hb = modal.querySelector('.handle-bar');
    let y0 = null, dy = 0;
    hb.addEventListener('pointerdown', e => { y0 = e.clientY; dy = 0; hb.setPointerCapture(e.pointerId); modal.style.transition = 'none'; });
    hb.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); modal.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 == null) return; y0 = null; modal.style.transition = 'transform .2s'; if (dy > 90) m.close(); else modal.style.transform = ''; };
    hb.addEventListener('pointerup', end); hb.addEventListener('pointercancel', end);
    stack.push(m);
    document.body.style.overflow = 'hidden';
    m.render();
    setTimeout(() => {
      if (m.opts.focus === false || U.isMobile()) return;
      const f = modal.querySelector('[autofocus], .modal-b input:not([type=hidden]):not([type=checkbox]), .modal-b textarea');
      if (f) f.focus({ preventScroll: true });
    }, 60);
    return m;
  }
  const top = () => stack[stack.length - 1];
  const refreshAll = () => stack.forEach(m => { if (m.opts.live) m.render(); });
  const closeAll = () => stack.slice().forEach(m => m.close());

  /* Toasts */
  function toast(msg, { type = 'ok', action = null, ms = 3200 } = {}) {
    const box = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.setAttribute('role', 'status');
    const ic = type === 'err' ? 'x' : type === 'info' ? 'info' : 'check';
    t.innerHTML = `<span class="ti">${U.icon(ic)}</span><span>${U.esc(msg)}</span>${action ? `<button>${U.esc(action.label)}</button>` : ''}`;
    box.appendChild(t);
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 200); };
    if (action) t.querySelector('button').addEventListener('click', () => { action.fn(); kill(); });
    setTimeout(kill, action ? Math.max(ms, 5000) : ms);
    while (box.children.length > 3) box.firstChild.remove();
  }

  /* Confirmation intégrée (les boîtes natives sont évitées) */
  function confirm({ title = 'Confirmer', text = '', ok = 'Confirmer', danger = false } = {}) {
    return new Promise(res => {
      let answered = false;
      const m = open({
        title, size: 'sm', focus: false,
        body: `<p class="muted" style="margin:0">${text}</p>`,
        footer: `<button class="btn ghost" data-no>Annuler</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-yes>${U.esc(ok)}</button>`,
        onMount: mm => {
          mm.el.querySelector('[data-no]').onclick = () => { answered = true; res(false); mm.close(); };
          mm.el.querySelector('[data-yes]').onclick = () => { answered = true; res(true); mm.close(); };
        },
        onClose: () => { if (!answered) res(false); }
      });
      return m;
    });
  }

  /* Petite gerbe de particules, sobre et courte */
  function burst({ x = innerWidth / 2, y = innerHeight / 2.4, n = 70 } = {}) {
    if (U.reduced()) return;
    const c = document.getElementById('fx');
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const cols = ['--accent', '--goal', '--good', '--c-strength', '--c-swim'].map(v => css.getPropertyValue(v).trim() || '#4466ff');
    const ps = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 7;
      return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: 3 + Math.random() * 4, c: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 1 };
    });
    const t0 = performance.now();
    (function frame(t) {
      const k = (t - t0) / 1300;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += 0.25; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      }
      if (k < 1) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }
  function celebrate({ icon = 'trophy', title, text, extra = '' }) {
    burst();
    return open({
      title: '', size: 'sm', focus: false,
      body: `<div class="celebrate"><div class="md">${U.icon(icon)}</div><h3>${U.esc(title)}</h3><p>${text}</p>${extra}</div>`,
      footer: '<button class="btn primary block" data-close-top>Continuer</button>'
    });
  }

  /* Compteurs animés */
  function countUp(root = document) {
    root.querySelectorAll('[data-count]').forEach(el => {
      const to = +el.dataset.count, dec = +(el.dataset.dec || 0), from = el.dataset.from != null ? +el.dataset.from : 0;
      if (U.reduced() || !isFinite(to)) { el.textContent = U.num(to, dec); return; }
      const t0 = performance.now(), dur = 900;
      (function f(t) {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = U.num(from + (to - from) * e, dec);
        if (k < 1) requestAnimationFrame(f);
      })(t0);
    });
  }

  /* Lecture d'un formulaire : nombres convertis via data-num */
  function form(f) {
    const o = {};
    for (const el of f.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.dataset.num != null || el.inputMode === 'decimal' || el.inputMode === 'numeric' ? U.parseNum(el.value) : el.value.trim();
    }
    return o;
  }

  /* Fragments réutilisables */
  const empty = (icon, title, text, action = '') => `<div class="empty"><div class="art">${U.icon(icon)}</div><h3>${U.esc(title)}</h3><p>${text}</p>${action}</div>`;
  const pick = (name, options, value, cls = 'seg') => `<div class="${cls}" data-pick="${name}">${options.map(o => `<button type="button" data-act="pick" data-v="${U.esc(o.v)}" class="${String(o.v) === String(value) ? 'on' : ''}" ${o.style ? `style="${o.style}"` : ''}>${o.html || U.esc(o.l)}</button>`).join('')}</div><input type="hidden" name="${name}" value="${U.esc(value ?? '')}">`;
  const bar = (pct, color, cls = '') => `<div class="bar ${cls} ${pct > 1.001 ? 'over' : ''}"><i style="--c:${color}" data-w="${(U.clamp(pct, 0, 1) * 100).toFixed(1)}%"></i></div>`;

  return { open, top, refreshAll, closeAll, toast, confirm, burst, celebrate, countUp, form, empty, pick, bar, get stack() { return stack; } };
})();

/* Délégation globale des actions */
document.addEventListener('click', e => {
  const close = e.target.closest('[data-close-top]');
  if (close) { const t = UI.top(); if (t) t.close(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && A[el.dataset.change]) A[el.dataset.change](el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && A[el.dataset.input]) A[el.dataset.input](el, e);
});

/* Sélecteurs segmentés / échelles */
A.pick = el => {
  const g = el.closest('[data-pick]');
  g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
  const inp = g.parentElement.querySelector(`input[name="${g.dataset.pick}"]`);
  if (inp) { inp.value = el.dataset.v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
};
/* Aucun formulaire ne recharge la page */
document.addEventListener('submit', e => e.preventDefault());
