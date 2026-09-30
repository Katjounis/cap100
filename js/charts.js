'use strict';
/* Cap 100 — graphiques SVG interactifs faits main (aucune dépendance) */

const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(entries => {
    for (const e of entries) {
      const el = e.target;
      const w = Math.round(e.contentRect.width);
      if (el._cfg && w && w !== el._w) { el._w = w; el._animate = false; draw(el); }
    }
  }) : null;

  function niceStep(range, count = 4) {
    const raw = range / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / mag;
    const step = n < 1.5 ? 1 : n < 2.5 ? 2 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10;
    return step * mag;
  }
  function mount(el, cfg) {
    el.classList.add('chart');
    el._cfg = cfg;
    el._animate = !U.reduced();
    el._w = el.clientWidth;
    draw(el);
    if (ro) ro.observe(el);
  }
  function draw(el) {
    const cfg = el._cfg;
    if (cfg.kind === 'bars') drawBars(el, cfg); else drawLine(el, cfg);
  }
  function tipEl(el) {
    let t = el.querySelector('.tip');
    if (!t) { t = document.createElement('div'); t.className = 'tip'; el.appendChild(t); }
    return t;
  }
  function placeTip(el, tip, x, y, W) {
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.add('show');
    const tw = tip.offsetWidth;
    const min = tw / 2 + 4, max = W - tw / 2 - 4;
    tip.style.left = U.clamp(x, min, Math.max(min, max)) + 'px';
  }

  /* ---------- Ligne ---------- */
  function drawLine(el, cfg) {
    const W = el.clientWidth || 600;
    const H = cfg.height || 240;
    const padL = 40, padR = cfg.padR ?? 14, padT = 16, padB = 26;
    const series = cfg.series.filter(s => !s.hidden && s.points.length);
    el.innerHTML = '';
    if (!series.length) { el.innerHTML = cfg.empty || ''; return; }
    const all = series.flatMap(s => s.points);
    const xs = all.map(p => p.x).sort();
    const x0 = cfg.xFrom || xs[0], x1 = cfg.xTo || xs[xs.length - 1];
    const span = Math.max(1, U.diffDays(x0, x1));
    let ys = all.map(p => p.y);
    (cfg.refs || []).filter(r => r.include).forEach(r => ys.push(r.y));
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (cfg.zero) y0 = Math.min(0, y0);
    if (y1 - y0 < (cfg.minRange || 2)) { const m = (y0 + y1) / 2; y0 = m - (cfg.minRange || 2) / 2; y1 = m + (cfg.minRange || 2) / 2; if (cfg.zero) { y0 = Math.max(0, y0); } }
    const step = niceStep(y1 - y0, 4);
    y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
    if (y1 === y0) y1 = y0 + step;
    const X = d => padL + (U.diffDays(x0, d) / span) * (W - padL - padR);
    const Y = v => padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB);
    const fmtY = cfg.yFmt || (v => U.num(v, step < 1 ? 1 : 0));
    let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${U.esc(cfg.label || 'Graphique')}">`;
    s += `<defs><linearGradient id="${el.id || 'g'}-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${(series.find(x => x.style === 'area') || series[0]).color}" stop-opacity=".22"/><stop offset="1" stop-color="${(series.find(x => x.style === 'area') || series[0]).color}" stop-opacity="0"/></linearGradient></defs>`;
    for (let v = y0; v <= y1 + 1e-9; v += step) {
      s += `<line class="grid-l" x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}"/>`;
      s += `<text class="ax" x="${padL - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtY(v)}</text>`;
    }
    // Axe X
    const ticks = xTicks(x0, x1, W - padL - padR);
    for (const t of ticks) s += `<text class="ax" x="${X(t.d)}" y="${H - 6}" text-anchor="middle">${t.l}</text>`;
    // Lignes de référence
    for (const r of cfg.refs || []) {
      if (r.y < y0 || r.y > y1) continue;
      s += `<line class="ref" x1="${padL}" x2="${W - padR}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="${r.color}"/>`;
      if (r.label) s += `<text class="ref-t" x="${W - padR}" y="${Y(r.y) - 6}" text-anchor="end" fill="${r.color}">${U.esc(r.label)}</text>`;
    }
    // Séries
    series.forEach((se, i) => {
      const pts = se.points.slice().sort((a, b) => a.x < b.x ? -1 : 1);
      const d = pts.map((p, j) => `${j ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
      if (se.style === 'area' && pts.length > 1) {
        s += `<path d="${d}L${X(pts[pts.length - 1].x)},${H - padB}L${X(pts[0].x)},${H - padB}Z" fill="url(#${el.id || 'g'}-area)" stroke="none"/>`;
      }
      if (se.style !== 'dots') {
        const dash = se.dash ? `stroke-dasharray="${se.dash}"` : '';
        const anim = el._animate && !se.dash ? ' class="draw" pathLength="1"' : '';
        s += `<path${anim} d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.width || 2.4}" stroke-linecap="round" stroke-linejoin="round" ${dash} opacity="${se.opacity || 1}"/>`;
      }
      if (se.style === 'dots' || se.dots) {
        const r = pts.length > 90 ? 2 : 3;
        for (const p of pts) s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${r}" fill="${se.color}" opacity="${se.style === 'dots' ? 0.55 : 1}"/>`;
      }
      if (se.endDot && pts.length) {
        const p = pts[pts.length - 1];
        s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="7" fill="${se.color}" opacity=".2"/><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/>`;
      }
    });
    s += `<g class="hov" style="display:none"><line class="xhair" y1="${padT}" y2="${H - padB}"/></g>`;
    s += `<rect x="${padL}" y="0" width="${W - padL - padR}" height="${H}" fill="transparent" class="hit"/>`;
    s += '</svg>';
    el.innerHTML = s;
    // Interaction
    const primary = series[cfg.primary || 0] || series[0];
    const ppts = primary.points.slice().sort((a, b) => a.x < b.x ? -1 : 1);
    const svg = el.querySelector('svg'), hov = svg.querySelector('.hov'), hit = svg.querySelector('.hit');
    const tip = tipEl(el);
    const show = ev => {
      const rect = svg.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (W / rect.width);
      let best = null, bd = Infinity;
      for (const p of ppts) { const dd = Math.abs(X(p.x) - mx); if (dd < bd) { bd = dd; best = p; } }
      if (!best) return;
      const cx = X(best.x);
      hov.style.display = '';
      hov.querySelectorAll('circle').forEach(c => c.remove());
      hov.querySelector('line').setAttribute('x1', cx); hov.querySelector('line').setAttribute('x2', cx);
      const vals = [];
      for (const se of series) {
        const p = se.points.find(q => q.x === best.x);
        if (!p) continue;
        vals.push({ se, p });
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', Y(p.y)); c.setAttribute('r', 5);
        c.setAttribute('fill', se.color); c.setAttribute('stroke', 'var(--surface)'); c.setAttribute('stroke-width', 2);
        hov.appendChild(c);
      }
      tip.innerHTML = cfg.tip ? cfg.tip(best.x, vals) : `${U.fmtShort(best.x)}<br><b>${fmtY(best.y)}</b>`;
      const topY = Math.min(...vals.map(v => Y(v.p.y)));
      placeTip(el, tip, cx * rect.width / W, topY * rect.height / H, rect.width);
      el.classList.add('hovering');
    };
    const hide = () => { hov.style.display = 'none'; tip.classList.remove('show'); el.classList.remove('hovering'); };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    el._hide = hide;
  }

  function xTicks(x0, x1, width) {
    const span = U.diffDays(x0, x1);
    const max = Math.max(2, Math.floor(width / 70));
    const out = [];
    if (span <= 16) {
      const every = Math.ceil((span + 1) / max);
      for (let i = 0; i <= span; i += every) { const d = U.addDays(x0, i); out.push({ d, l: span <= 8 ? U.dayShort(U.dow(d)) + ' ' + U.parse(d).getDate() : U.fmtShort(d) }); }
    } else if (span <= 120) {
      const every = Math.max(7, Math.ceil(span / max / 7) * 7);
      let d = U.weekStart(U.addDays(x0, 6));
      for (; d <= x1; d = U.addDays(d, every)) out.push({ d, l: U.fmtShort(d) });
    } else {
      const months = Math.ceil(span / 30);
      const every = Math.max(1, Math.ceil(months / max));
      let d = U.addMonths(U.monthStart(x0), 1);
      for (; d <= x1; d = U.addMonths(d, every)) out.push({ d, l: U.cap(U.fmtMonthShort(d)) + (U.parse(d).getMonth() === 0 ? ' ' + String(U.parse(d).getFullYear()).slice(2) : '') });
    }
    return out;
  }

  /* ---------- Barres ---------- */
  function drawBars(el, cfg) {
    const W = el.clientWidth || 600;
    const H = cfg.height || 200;
    const padL = 40, padR = 8, padT = 16, padB = 26;
    const data = cfg.data;
    el.innerHTML = '';
    if (!data.length || data.every(d => !d.total)) { if (cfg.empty) { el.innerHTML = cfg.empty; return; } }
    let max = Math.max(...data.map(d => d.total || 0), cfg.target ? cfg.target.v * 1.08 : 0, cfg.minMax || 1);
    const su = cfg.stepUnit || 1;
    const step = niceStep(max / su, 4) * su;
    max = Math.ceil(max / step) * step;
    const iw = W - padL - padR;
    const bw = iw / data.length;
    const gap = Math.min(Math.max(bw * 0.28, 2), 14);
    const Y = v => padT + (1 - v / max) * (H - padT - padB);
    const fmtY = cfg.yFmt || (v => U.num(v));
    let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${U.esc(cfg.label || 'Graphique')}">`;
    for (let v = 0; v <= max + 1e-9; v += step) {
      s += `<line class="grid-l" x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${padL - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtY(v)}</text>`;
    }
    const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 44)));
    data.forEach((d, i) => {
      const x = padL + i * bw + gap / 2, w = Math.max(1, bw - gap);
      let yAcc = 0;
      const segs = d.segs || [{ v: d.total || 0, c: d.color || cfg.color || 'var(--accent)' }];
      s += `<g class="bar-g" data-i="${i}">`;
      segs.forEach((sg, k) => {
        if (!sg.v) return;
        const y = Y(yAcc + sg.v), h = Y(yAcc) - y;
        const top = k === segs.length - 1 || segs.slice(k + 1).every(z => !z.v);
        const r = top ? Math.min(5, w / 2, h) : 0;
        s += `<path class="bar-r" style="animation-delay:${el._animate ? i * 18 : 0}ms${el._animate ? '' : ';animation:none'}" d="${roundTop(x, y, w, h, r)}" fill="${sg.c}" opacity="${d.muted ? 0.4 : 1}"/>`;
        yAcc += sg.v;
      });
      s += '</g>';
      if (i % every === 0) s += `<text class="ax" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${U.esc(d.label)}</text>`;
    });
    if (cfg.target && cfg.target.v <= max) {
      s += `<line class="ref" x1="${padL}" x2="${W - padR}" y1="${Y(cfg.target.v)}" y2="${Y(cfg.target.v)}" stroke="${cfg.target.color || 'var(--goal)'}"/>`;
      if (cfg.target.label) s += `<text class="ref-t" x="${W - padR}" y="${Y(cfg.target.v) - 6}" text-anchor="end" fill="${cfg.target.color || 'var(--goal)'}">${U.esc(cfg.target.label)}</text>`;
    }
    s += `<rect x="${padL}" y="0" width="${iw}" height="${H}" fill="transparent" class="hit"/></svg>`;
    el.innerHTML = s;
    const svg = el.querySelector('svg'), hit = svg.querySelector('.hit'), tip = tipEl(el);
    const show = ev => {
      const rect = svg.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (W / rect.width);
      const i = U.clamp(Math.floor((mx - padL) / bw), 0, data.length - 1);
      const d = data[i];
      svg.querySelectorAll('.bar-r').forEach(b => b.classList.remove('hl'));
      svg.querySelectorAll(`.bar-g[data-i="${i}"] .bar-r`).forEach(b => b.classList.add('hl'));
      tip.innerHTML = d.tip || `${U.esc(d.label)}<br><b>${fmtY(d.total || 0)}</b>`;
      const cx = padL + i * bw + bw / 2;
      placeTip(el, tip, cx * rect.width / W, Y(d.total || 0) * rect.height / H, rect.width);
      el.classList.add('hovering');
      if (cfg.onHover) cfg.onHover(d);
    };
    const hide = () => { tip.classList.remove('show'); el.classList.remove('hovering'); svg.querySelectorAll('.bar-r').forEach(b => b.classList.remove('hl')); };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    if (cfg.onClick) hit.addEventListener('click', ev => {
      const rect = svg.getBoundingClientRect();
      const i = U.clamp(Math.floor(((ev.clientX - rect.left) * (W / rect.width) - padL) / bw), 0, data.length - 1);
      cfg.onClick(data[i]);
    });
    el._hide = hide;
  }
  function roundTop(x, y, w, h, r) {
    if (h <= 0) return '';
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  /* ---------- Jauge de transformation (arc de 270°) ---------- */
  function gauge({ pct, nodes = [] }) {
    const cx = 150, cy = 150, R = 118, a0 = 135, sweep = 270;
    const pt = (deg, r = R) => { const a = (deg * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const [sx, sy] = pt(a0), [ex, ey] = pt(a0 + sweep);
    const arc = `M${sx.toFixed(2)},${sy.toFixed(2)} A${R},${R} 0 1 1 ${ex.toFixed(2)},${ey.toFixed(2)}`;
    let s = `<svg viewBox="-6 -6 312 290" role="img" aria-label="Progression ${Math.round(pct * 100)} %">`;
    s += `<defs><linearGradient id="gg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient></defs>`;
    s += `<path d="${arc}" class="g-track" fill="none" stroke-width="18" stroke-linecap="round"/>`;
    s += `<path d="${arc}" class="g-fill" fill="none" stroke="url(#gg)" stroke-width="18" stroke-linecap="round" pathLength="100" style="--off:100" data-off="${(100 - pct * 100).toFixed(2)}"/>`;
    for (const n of nodes) {
      const [x, y] = pt(a0 + sweep * n.pct);
      const [lx, ly] = pt(a0 + sweep * n.pct, R + 24);
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${n.goal ? 8 : 6}" class="g-node ${n.on ? 'on' : ''} ${n.goal ? 'goal' : ''}"/>`;
      if (n.label) s += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" class="g-label ${n.on ? 'on' : ''}">${n.label}</text>`;
    }
    return s + '</svg>';
  }
  function ring(pct, { size = 64, stroke = 7, color = 'var(--accent)', icon = '' } = {}) {
    const r = 50 - stroke;
    const off = 100 - U.clamp(pct, 0, 1) * 100;
    return `<div class="ring" style="--c:${color};width:${size}px;height:${size}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" class="r-track" stroke-width="${stroke * 1.35}"/><circle cx="50" cy="50" r="${r}" class="r-fill" stroke-width="${stroke * 1.35}" pathLength="100" style="--off:100" data-off="${off.toFixed(2)}"/></svg><div class="r-in">${icon}</div></div>`;
  }
  /* Déclenche les animations d'arcs après insertion */
  function animateArcs(root = document) {
    const els = root.querySelectorAll('[data-off]');
    requestAnimationFrame(() => requestAnimationFrame(() => els.forEach(e => e.style.setProperty('--off', e.dataset.off))));
    root.querySelectorAll('[data-w]').forEach(e => requestAnimationFrame(() => requestAnimationFrame(() => e.style.setProperty('--w', e.dataset.w))));
  }
  function spark(values, { w = 120, h = 34, color = 'var(--accent)' } = {}) {
    const v = values.filter(x => x != null);
    if (v.length < 2) return '';
    const min = Math.min(...v), max = Math.max(...v), r = max - min || 1;
    const pts = v.map((y, i) => `${(i / (v.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (y - min) / r * (h - 6)).toFixed(1)}`);
    const last = pts[pts.length - 1].split(',');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${color}"/></svg>`;
  }

  const reset = () => { if (ro) ro.disconnect(); };
  return { reset, line: (el, cfg) => mount(el, { ...cfg, kind: 'line' }), bars: (el, cfg) => mount(el, { ...cfg, kind: 'bars' }), gauge, ring, spark, animateArcs };
})();
