// Prueba automática del juego tal como va en la app: sin internet, desde app/src/main/assets/www.
// Primer arranque (nombre de entrenador) → cuestionario → menú → una partida de ~25 s → reabrir y seguir.
// Falla (y GitHub no publica la APK) si el juego tira errores, si le falta algún archivo o si intenta salir a internet
// por algo que no sea lo ya conocido (cuentas, avisos, mantenimiento: la capa local los corta).
// uso: node tests/smoke.cjs [carpeta www] [carpeta de capturas]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WWW = path.resolve(process.argv[2] || 'app/src/main/assets/www');
const SHOTS = process.argv[3] || '';
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png',
  jpg: 'image/jpeg', mp3: 'audio/mpeg', ttf: 'font/ttf', ico: 'image/x-icon', webmanifest: 'application/manifest+json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(WWW, p);
      if (!f.startsWith(WWW) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[f.split('.').pop()] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = [];

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, locale: 'es-MX',
    userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  const external = new Set(), missing = new Set(), errors = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(base) || u.startsWith('blob:') || u.startsWith('data:')) return r.continue();
    external.add(u.split('?')[0]);
    return r.abort();
  });
  page.on('response', r => { if (r.status() >= 400) missing.add(r.url().replace(base, '').split('?')[0]); });
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  const shot = async n => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${n}.png` }); } };
  const visible = id => page.evaluate(i => { const e = document.getElementById(i); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; }, id);

  await page.goto(base, { waitUntil: 'load' });
  await sleep(4000);
  await shot('1-nombre');
  if (!await visible('scr-login')) fail.push('no apareció la pantalla del nombre');
  await page.fill('#f-user', 'Prueba');
  await page.click('#btn-auth');
  await sleep(2500);
  for (let i = 0; i < 8; i++) {
    const ok = await page.evaluate(() => { const b = [...document.querySelectorAll('#scr-test button')].find(x => x.offsetParent); if (b) b.click(); return !!b; });
    if (!ok) { fail.push('cuestionario: no hay respuestas en la pregunta ' + (i + 1)); break; }
    await sleep(900);
  }
  await sleep(2000);
  await shot('2-compañero');
  await page.click('#res-ok').catch(() => fail.push('no apareció el botón para aceptar compañero'));
  await sleep(2500);
  await shot('3-menu');
  if (!await visible('scr-menu')) fail.push('no se llegó al menú');
  const hiddenOk = await page.evaluate(() => ['[data-go="friends"]', '[data-go="rank"]', '#btn-logout', '#btn-yt', '#btn-discord', '#menu-forum']
    .every(s => { const e = document.querySelector(s); return !e || getComputedStyle(e).display === 'none'; }));
  if (!hiddenOk) fail.push('se ve algo que necesita internet (amigos, clasificación, enlaces)');

  // Una partida: mover en círculos ~25 s
  await page.click('#scr-menu [data-go="play"]');
  await sleep(2500);
  const keys = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
  for (let i = 0; i < 12; i++) {
    const k = keys[i % 4];
    await page.keyboard.down(k); await sleep(2000); await page.keyboard.up(k);
    // si sale una pantalla de subir de nivel u otra, elegir la primera opción
    await page.evaluate(() => {
      const scr = [...document.querySelectorAll('section.scr')].filter(s => !s.classList.contains('hidden') && getComputedStyle(s).display !== 'none');
      const top = scr[scr.length - 1];
      if (top && top.id !== 'scr-pause') { const b = [...top.querySelectorAll('button,.card')].find(x => x.offsetParent); if (b) b.click(); }
    });
  }
  await shot('4-partida');
  const back = await page.evaluate(() => window.psBack && psBack());
  await sleep(800);
  if (back !== 'paused' || !await visible('scr-pause')) fail.push('Atrás en partida no pausó (' + back + ')');
  await shot('5-pausa');

  // Reabrir: entra solo con la partida guardada
  await page.reload({ waitUntil: 'load' });
  await sleep(5000);
  await shot('6-reabrir');
  if (!await visible('scr-menu')) fail.push('al reabrir no volvió al menú con la partida guardada');

  // Sin sesión (como tras borrar datos del navegador pero con la cuenta local): entra sola
  await page.evaluate(() => localStorage.removeItem('ps.session'));
  await page.reload({ waitUntil: 'load' });
  await sleep(5500);
  if (!await visible('scr-menu')) fail.push('sin sesión no entró solo a la partida local');

  const KNOWN = /(ice|directo)\.pokesurvivor\.com|raw\.githubusercontent\.com\/JPTER78|gstatic\.com\/firebasejs|i\.ytimg\.com|challenges\.cloudflare\.com/;
  const unknownExt = [...external].filter(u => !KNOWN.test(u));
  // Lo que tampoco existe en la web original (p. ej. gritos de algunas formas) no cuenta como faltante
  let notOnSite = new Set();
  try {
    const st = JSON.parse(fs.readFileSync(path.join(__dirname, '../tools/web/estado.json'), 'utf8'));
    notOnSite = new Set(Object.keys(st.files).filter(k => st.files[k] === 'no'));
  } catch (e) { /* sin estado: todo cuenta */ }
  const realMissing = [...missing].filter(u => !/version\.json$/.test(u) && !notOnSite.has(u));
  console.log('Externos cortados (conocidos):', [...external].filter(u => KNOWN.test(u)).length);
  if (unknownExt.length) fail.push('intentó salir a internet: ' + unknownExt.join(', '));
  if (realMissing.length) fail.push('archivos que faltan: ' + realMissing.slice(0, 30).join(', ') + (realMissing.length > 30 ? ` (+${realMissing.length - 30})` : ''));
  if (errors.length) fail.push('errores del juego: ' + [...new Set(errors)].slice(0, 10).join(' | '));

  await browser.close();
  srv.close();
  if (fail.length) { console.log('FALLÓ:\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('OK: nombre, cuestionario, menú, partida, pausa con Atrás, reabrir y entrar solo; sin internet ni archivos faltantes.');
})().catch(e => { console.error(e); process.exit(1); });
