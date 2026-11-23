// Abre pokesurvivor.com en Chrome sin interfaz y le pide al propio juego sus catálogos
// (skins, fotos de perfil, marcos, huevos, arenas y la versión de las hojas de cada Pokémon),
// para saber qué archivos existen y cuáles cambiaron. No baja ninguna imagen: esas peticiones se cortan.
// uso: node catalogo.cjs <ids.json> <salida.json>     (ids.json: lista de ids de sprites, de jslit.py)
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const ids = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.route('**/*', r => {
    const u = r.request().url();
    if (/\/assets\/(pokemon|cries|eggs|tienda|arenas)\//.test(u)) return r.abort();
    return r.continue();
  });
  await page.addInitScript(() => {
    const create = Object.create;
    window.__nulls = [];
    Object.create = function (proto) {
      const o = create.apply(this, arguments);
      if (proto === null && window.__nulls.length < 200) window.__nulls.push(o);
      return o;
    };
    Object.defineProperty(window, '__PS', { get() { return window.__nulls.find(o => o && o.Marcos && o.Eggs); } });
  });
  await page.goto('https://pokesurvivor.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__PS && window.__PS.Eggs && window.__PS.Fotos && window.__PS.Sprites, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  const out = await page.evaluate((ids) => {
    const B = window.__PS;
    const r = {};
    const S = B.Skins;
    r.skins = S.SKINS || {};
    try { r.hat = S.get('hat', 352) ? 352 : null; } catch (e) { r.hat = null; }
    const F = B.Fotos, fotos = {};
    for (let d = 1; d <= (F.MAX || 1100); d++) {
      const n = F.list(d, false), s = F.list(d, true);
      if (n.length || s.length) fotos[d] = [n, s];
    }
    r.fotos = fotos;
    r.marcos = B.Marcos.LIST.map(m => ({ id: m.id, anim: !!m.anim }));
    const E = B.Eggs, eggs = {};
    for (let d = 1; d <= 2000; d++) { const b = E.base(d); if (b != null) eggs[d] = b; }
    r.eggs = eggs;
    // Versión (?g=) de las hojas de cada Pokémon: si cambia, se vuelven a bajar sus hojas
    const g = {};
    for (const id of ids) {
      try {
        const sh = B.Sprites.sheet(+id, 'Idle') || B.Sprites.sheet(+id, 'Walk');
        const m = sh && /[?&]g=([^&]+)/.exec(sh.src);
        if (m) g[id] = m[1];
      } catch (e) { /* nada */ }
    }
    r.g = g;
    // Arenas y otros archivos con nombre dentro de los módulos
    const paths = new Set(), seen = new WeakSet();
    (function walk(o, depth) {
      if (!o || typeof o !== 'object' || seen.has(o) || depth > 6) return;
      seen.add(o);
      for (const k of Object.keys(o)) {
        let v; try { v = o[k]; } catch (e) { continue; }
        if (typeof v === 'string' && /^[\w.-]+\.(png|jpg|jpeg|webp)$/i.test(v)) paths.add(v);
        else if (v && typeof v === 'object') walk(v, depth + 1);
      }
    })(B, 0);
    r.arenas = [...paths].sort();
    return r;
  }, ids);
  fs.writeFileSync(process.argv[3], JSON.stringify(out));
  console.log('catálogo: skins', Object.keys(out.skins).length, '· fotos', Object.keys(out.fotos).length,
    '· marcos', out.marcos.length, '· huevos', Object.keys(out.eggs).length, '· versiones', Object.keys(out.g).length,
    '· arenas', out.arenas.length);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
