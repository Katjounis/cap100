'use strict';
/* Cap 100 — scan de codes-barres.
   Caméra : BarcodeDetector (Chrome Android) ou ZXing (iPhone, autres navigateurs), chargé seulement au premier scan.
   Valeurs nutritionnelles : Open Food Facts (base collaborative, licence ODbL). Seul le code-barres est envoyé. */

const Scan = (() => {
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
  let stream = null, timer = null, reader = null, done = false;

  /* Chiffre de contrôle EAN/UPC : évite les lectures erronées */
  function valid(code) {
    if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
    const d = code.split('').map(Number), check = d.pop();
    const sum = d.reverse().reduce((s, v, i) => s + v * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === check;
  }
  const loadScript = src => new Promise((res, rej) => { if (window.ZXing) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

  function stop() {
    clearInterval(timer); timer = null;
    if (reader) { try { reader.reset(); } catch (e) { /* rien */ } reader = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  async function start(m, onCode) {
    const video = m.el.querySelector('video'), msg = t => { const e = m.el.querySelector('.scan-msg'); if (e) e.textContent = t; };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.isSecureContext) { msg('Caméra indisponible ici : tape les chiffres du code-barres.'); m.el.querySelector('.scan-box').classList.add('off'); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
    catch (e) { msg(e && e.name === 'NotAllowedError' ? 'Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, ou tape le code.' : 'Caméra introuvable : tape les chiffres du code-barres.'); m.el.querySelector('.scan-box').classList.add('off'); return; }
    if (m.closed) { stop(); return; }
    video.srcObject = stream; video.setAttribute('playsinline', ''); video.muted = true;
    try { await video.play(); } catch (e) { /* lecture automatique bloquée : l'image reste figée */ }
    const hit = code => { code = String(code || '').replace(/\D/g, ''); if (done || !valid(code)) return; done = true; if (navigator.vibrate) navigator.vibrate(60); stop(); onCode(code); };
    let native = false;
    if ('BarcodeDetector' in window) {
      try {
        const sup = await window.BarcodeDetector.getSupportedFormats();
        const f = FORMATS.filter(x => sup.includes(x));
        if (f.length) {
          const det = new window.BarcodeDetector({ formats: f }); native = true;
          timer = setInterval(async () => { if (video.readyState < 2) return; try { const r = await det.detect(video); if (r && r[0]) hit(r[0].rawValue); } catch (e) { /* image suivante */ } }, 220);
        }
      } catch (e) { native = false; }
    }
    if (!native) {
      msg('Chargement du lecteur…');
      try { await loadScript('js/vendor/zxing.min.js'); } catch (e) { msg('Lecteur indisponible hors connexion : tape le code.'); return; }
      if (m.closed || !stream) return;
      const Z = window.ZXing, hints = new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
      reader = new Z.BrowserMultiFormatReader(hints, 250);
      const cb = r => { if (r) hit(r.getText()); };
      if (reader.decodeFromStream) reader.decodeFromStream(stream, video, cb); else reader.decodeFromVideoElementContinuously(video, cb);
    }
    msg('Place le code-barres dans le cadre');
  }

  /* Recherche : d'abord tes aliments (déjà scannés), puis Open Food Facts */
  async function lookup(code) {
    const mine = DB.all('foods').find(f => f.barcode === code);
    if (mine) return { food: mine, known: true };
    let j;
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_fr,generic_name_fr,brands,quantity,serving_size,serving_quantity,nutriments`);
      if (r.status === 404) return { missing: true };
      j = await r.json();
    } catch (e) { return { offline: true }; }
    const p = j && j.status === 1 && j.product;
    if (!p) return { missing: true };
    const n = p.nutriments || {}, num = k => { const v = n[k]; return v == null || v === '' ? null : +(+v).toFixed(k === 'salt_100g' ? 2 : 1); };
    let kcal = num('energy-kcal_100g');
    if (kcal == null && n.energy_100g != null) kcal = Math.round(n.energy_100g / 4.184);
    const brand = String(p.brands || '').split(',')[0].trim();
    const name = String(p.product_name_fr || p.product_name || p.generic_name_fr || '').trim() || 'Produit ' + code;
    const food = {
      id: 'cf-' + U.uid(), name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name,
      kcal: kcal != null ? Math.round(kcal) : null, p: num('proteins_100g') ?? 0, c: num('carbohydrates_100g') ?? 0, f: num('fat_100g') ?? 0,
      sug: num('sugars_100g'), sat: num('saturated-fat_100g'), fib: num('fiber_100g'), salt: num('salt_100g'),
      portion: +p.serving_quantity > 0 ? Math.round(+p.serving_quantity) : 100, portionLabel: p.serving_size ? `1 portion (${String(p.serving_size).slice(0, 30)})` : '',
      barcode: code, src: 'off'
    };
    Object.keys(food).forEach(k => food[k] == null && k !== 'kcal' && delete food[k]);
    if (food.kcal == null) return { incomplete: food };
    return { food };
  }

  function open(onFood) {
    done = false;
    const st = { busy: false };
    UI.open({
      title: 'Scanner un produit', sub: 'Code-barres du paquet', size: 'sm', focus: false,
      body: () => `<div class="stack">
        <div class="scan-box"><video muted playsinline></video><div class="scan-frame"><i></i></div><div class="scan-msg">Ouverture de la caméra…</div></div>
        <form id="scan-f" class="row" style="gap:8px"><input class="input grow" id="scan-code" inputmode="numeric" autocomplete="off" placeholder="ou tape les chiffres (13 en général)" maxlength="14"><button class="btn" type="submit">OK</button></form>
        <p class="xs faint" style="margin:0">Les valeurs viennent d'<b>Open Food Facts</b>, base collaborative et gratuite. Seul le code-barres lui est envoyé. Vérifie-les avec l'étiquette si besoin : tu pourras les corriger.</p></div>`,
      onMount: m => {
        const go = async code => {
          const msg = m.el.querySelector('.scan-msg'); if (msg) msg.textContent = 'Recherche du produit…';
          m.el.querySelector('.scan-box').classList.add('found');
          const r = await lookup(code);
          if (m.closed) return;
          m.close();
          if (r.food) { if (!r.known) await DB.put('foods', r.food); UI.toast(`Trouvé : ${r.food.name}`); onFood(r.food); return; }
          const pre = r.incomplete || { name: '', barcode: code };
          UI.toast(r.offline ? 'Pas de connexion : saisis les valeurs de l\'étiquette' : r.incomplete ? 'Valeurs incomplètes sur Open Food Facts : complète-les avec l\'étiquette' : 'Produit inconnu : saisis les valeurs de l\'étiquette, il sera reconnu la prochaine fois', { type: 'info', ms: 6000 });
          F.foodEdit(null, pre.name || '', { ...pre, barcode: code });
        };
        m.el.querySelector('#scan-f').addEventListener('submit', e => {
          e.preventDefault();
          const code = m.el.querySelector('#scan-code').value.replace(/\D/g, '');
          if (!valid(code)) { UI.toast('Code invalide : vérifie les chiffres sous le code-barres', { type: 'err' }); return; }
          done = true; stop(); go(code);
        });
        start(m, go);
      },
      onClose: () => stop()
    });
  }
  return { open, lookup, valid, stop };
})();

A.scanOpen = () => {
  const parent = UI.top();
  Scan.open(food => {
    if (parent && !parent.closed && parent.st && parent.st.basket) { parent.st.sel = food; parent.st.editIdx = null; parent.st.qty = food.portion || 100; parent.render(); }
    else F.food({ date: U.today(), sel: food });
    App.changed();
  });
};
