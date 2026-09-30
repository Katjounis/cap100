'use strict';
/* Cap 100 — utilitaires : dates, formats, DOM, icônes */

const U = {};
U.$ = (s, r = document) => r.querySelector(s);
U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
U.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
U.pad = n => String(n).padStart(2, '0');

/* Dates locales au format AAAA-MM-JJ (jamais d'UTC pour éviter les décalages) */
U.dstr = d => `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
U.today = () => U.dstr(new Date());
U.parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
U.addDays = (s, n) => { const d = U.parse(s); d.setDate(d.getDate() + n); return U.dstr(d); };
U.addMonths = (s, n) => { const d = U.parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return U.dstr(d); };
U.diffDays = (a, b) => Math.round((U.parse(b) - U.parse(a)) / 864e5);
U.weekStart = s => { const d = U.parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return U.dstr(d); };
U.monthStart = s => s.slice(0, 8) + '01';
U.monthEnd = s => { const d = U.parse(U.monthStart(s)); d.setMonth(d.getMonth() + 1); d.setDate(0); return U.dstr(d); };
U.range = (a, b) => { const out = []; for (let s = a; s <= b; s = U.addDays(s, 1)) out.push(s); return out; };
U.nowTime = () => { const d = new Date(); return `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`; };
U.dow = s => (U.parse(s).getDay() + 6) % 7; // 0 = lundi

const LOC = 'fr-FR';
U.fmtDate = (s, o = { day: 'numeric', month: 'long' }) => U.parse(s).toLocaleDateString(LOC, o);
U.fmtShort = s => U.parse(s).toLocaleDateString(LOC, { day: 'numeric', month: 'short' }).replace('.', '');
U.fmtLong = s => U.cap(U.parse(s).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' }));
U.fmtFull = s => U.parse(s).toLocaleDateString(LOC, { day: 'numeric', month: 'long', year: 'numeric' });
U.fmtMonth = s => U.cap(U.parse(s).toLocaleDateString(LOC, { month: 'long', year: 'numeric' }));
U.fmtMonthShort = s => U.parse(s).toLocaleDateString(LOC, { month: 'short' }).replace('.', '');
U.dayLetter = i => ['L', 'M', 'M', 'J', 'V', 'S', 'D'][i];
U.dayShort = i => ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i];
U.cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
U.relDay = s => {
  const d = U.diffDays(U.today(), s);
  if (d === 0) return "Aujourd'hui";
  if (d === -1) return 'Hier';
  if (d === 1) return 'Demain';
  return U.fmtLong(s);
};

U.num = (n, dec = 0) => (n == null || !isFinite(n)) ? '–' : Number(n).toLocaleString(LOC, { minimumFractionDigits: dec, maximumFractionDigits: dec });
U.num1 = n => U.num(n, Math.abs(n) < 100 && n % 1 !== 0 ? 1 : (n % 1 !== 0 ? 1 : 0));
U.kg = n => U.num(n, 1);
U.sign = (n, dec = 1) => n == null || !isFinite(n) ? '–' : (n > 0.0001 ? '+' : n < -0.0001 ? '−' : '±') + U.num(Math.abs(n), dec);
U.dur = min => {
  min = Math.round(min || 0);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${U.pad(min % 60)}`;
};
U.pace = (min, km) => { if (!km || !min) return null; const p = min / km; const m = Math.floor(p); const s = Math.round((p - m) * 60); return `${m}'${U.pad(s === 60 ? 0 : s)}"/km`; };
U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
U.sum = a => a.reduce((s, v) => s + (+v || 0), 0);
U.avg = a => a.length ? U.sum(a) / a.length : null;
U.round = (v, step = 1) => Math.round(v / step) * step;
U.parseNum = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : null; };
U.debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
U.norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
U.plural = (n, one, many) => `${U.num(n)} ${n > 1 ? many : one}`;
U.reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
U.isMobile = () => window.matchMedia('(max-width: 900px)').matches;
U.inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

/* ---------- Icônes (traits 24×24) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  food: '<path d="M7 2.5v19M4 2.5v6a3 3 0 0 0 6 0v-6"/><path d="M17.5 21.5v-19c-2.2 1-3.6 3.6-3.6 7.2 0 3.4 1.4 5 3.6 5"/>',
  dumbbell: '<rect x="5" y="6" width="3" height="12" rx="1"/><rect x="16" y="6" width="3" height="12" rx="1"/><path d="M2.5 9.5v5M21.5 9.5v5M8 12h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 10a5.5 5.5 0 0 1 8 0"/><path d="m12 11 1.6-2.2"/>',
  ruler: '<path d="M3 16.5 16.5 3 21 7.5 7.5 21z"/><path d="m7.5 12.5 2 2M10.5 9.5l1.5 1.5M13.5 6.5l2 2"/>',
  camera: '<path d="M4 7.5h3l1.8-2.5h6.4L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.8"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="m7.5 15 3.5-4 3 2.5 5-6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  flag: '<path d="M5 21V4M5 4h11.5l-2 4 2 4H5"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13.5h10L18 7"/>',
  edit: '<path d="M4 20h4L19.5 8.5l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flame: '<path d="M12 21.5c4 0 7-2.8 7-6.8 0-3.5-2.5-5.7-4-8.2-.6 2-1.8 3-3 3.5.2-2.8-1.2-5.6-3.5-7C9 6 5 8.6 5 14.7c0 4 3 6.8 7 6.8z"/>',
  steps: '<path d="M7.5 16c-1.8 0-3-1.9-3-4.6S5.7 5.5 7.5 5.5s3 2.4 3 5.4-1.2 5.1-3 5.1zM5.5 19h4"/><path d="M16.5 12.5c-1.8 0-3-1.9-3-4.6S14.7 2 16.5 2s3 2.4 3 5.4-1.2 5.1-3 5.1zM14.5 15.5h4"/>',
  run: '<circle cx="15" cy="4.5" r="2"/><path d="M8 21l3.2-5.5L14 18v3.5"/><path d="M11.2 15.5 13 9.5l-3.5-.5-3 3"/><path d="M13 9.5l2.5 3.3 3.5.7"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="m9.5 21 2-6.5 3 2.8V21"/><path d="M11.5 14.5 12.5 8.5l-3.4 2.3-1.1 3.2"/><path d="m12.5 8.5 2 3.2 2.8 1"/>',
  bike: '<circle cx="5.8" cy="16" r="3.6"/><circle cx="18.2" cy="16" r="3.6"/><path d="M5.8 16 9.5 9h6l2.7 7M9.5 9l3 7h-6.7M14 5.5h2.5l-1 3.5"/>',
  swim: '<path d="M2.5 17c1.6 1 3.2 1 4.8 0s3.2-1 4.8 0 3.2 1 4.8 0 3.2-1 4.6 0M2.5 20.5c1.6 1 3.2 1 4.8 0s3.2-1 4.8 0 3.2 1 4.8 0 3.2-1 4.6 0"/><circle cx="17" cy="7.5" r="2"/><path d="m5.5 13.5 5-5 3.5 3.3 3.5-.3"/>',
  mountain: '<path d="m2.5 20 7-12 4 6.5 2.5-3.5 5.5 9z"/><path d="m8 10.5 1.5 1.5 1.5-1.2"/>',
  pulse: '<path d="M3 12h4l2.5-6 5 12 2.5-6H21"/>',
  note: '<path d="M5.5 3h9l4 4v14h-13z"/><path d="M14.5 3v4h4M8.5 12h7M8.5 16h5"/>',
  download: '<path d="M12 3.5v11.5m-5-5 5 5 5-5M4 20.5h16"/>',
  upload: '<path d="M12 15.5V4m-5 5 5-5 5 5M4 20.5h16"/>',
  play: '<path d="M7.5 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M9.5 2.5h5M18.5 6.5l1.5-1.5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 5.5H4.5V7a3.2 3.2 0 0 0 3.6 3.2M16 5.5h3.5V7a3.2 3.2 0 0 1-3.6 3.2M12 13v4M8.5 21h7M10 17h4v4h-4z"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.6 10.6 6 3h4l2 4.3L14 3h4l-2.6 7.6"/><path d="m12 12.8.8 1.6 1.7.2-1.3 1.2.4 1.7-1.6-.9-1.6.9.4-1.7-1.3-1.2 1.7-.2z"/>',
  repeat: '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 11.5V10a4 4 0 0 1 4-4h13"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13"/>',
  droplet: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
  barcode: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M16 8v8"/>',
  pasta: '<path d="M3 11h18a9 9 0 0 1-18 0zM6 8c1.2-1.5 2.4 1.5 3.6 0s2.4 1.5 3.6 0 2.4 1.5 3.6 0M15 3l5 8"/>',
  soup: '<path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.2 1-1.6 1-2.8M12 7c0-1.2 1-1.6 1-2.8M16 7c0-1.2 1-1.6 1-2.8"/>',
  pot: '<path d="M4 10h16v4.5a5.5 5.5 0 0 1-5.5 5.5h-5A5.5 5.5 0 0 1 4 14.5zM2 10h2M20 10h2M9 6.5c0-1 1-1.5 1-2.5M14 6.5c0-1 1-1.5 1-2.5"/>',
  bolt: '<path d="M13 2.5 4.5 14H12l-1 7.5L19.5 10H12z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  body: '<circle cx="12" cy="4.8" r="2.3"/><path d="M5.5 9.5h13M12 9.5v5.5M8.8 21.5 12 15l3.2 6.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.01"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  trendDown: '<path d="m3.5 7 6 6 4-4 7 7"/><path d="M15.5 16h5v-5"/>',
  trendUp: '<path d="m3.5 17 6-6 4 4 7-7"/><path d="M15.5 8h5v5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  compare: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 2.5v19"/>',
  bed: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="1.8"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  zzz: '<path d="M4 8h5l-5 6h5M13 4h4l-4 5h4M15 14h5l-5 6h5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 4v4.5H8M12 8v4.5l3 1.8"/>'
};
U.icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;

/* Téléchargement d'un fichier généré localement */
U.download = (filename, blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
U.blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
U.dataURLToBlob = async url => (await fetch(url)).blob();

/* Redimensionne une image importée (photo) avant stockage local */
U.resizeImage = (file, max = 1600, quality = 0.86) => new Promise((res, rej) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * r), h = Math.round(img.naturalHeight * r);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    c.toBlob(b => b ? res(b) : rej(new Error('conversion')), 'image/jpeg', quality);
  };
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image illisible')); };
  img.src = url;
});
