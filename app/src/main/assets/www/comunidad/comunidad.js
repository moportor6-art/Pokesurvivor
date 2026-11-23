(() => {
  'use strict';
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const QS = new URLSearchParams(location.search);
  // En este ordenador (127.0.0.1 / localhost; nunca en la web): el servicio de prueba (servidor/comunidad/dev.mjs, o ?api=) y una
  // cuenta de prueba en vez de Firebase, que se cambia con el selector de abajo a la izquierda (selectorPrueba) o con ?token=.
  const PRUEBA = LOCAL;
  const API = (!LOCAL ? 'https://ice.pokesurvivor.com' : /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(QS.get('api') || '') ? QS.get('api') : 'http://127.0.0.1:8091') + '/v1/c';
  const CUENTAS_PRUEBA = [['test:AdminUid0001', 'JPTER78 · admin'], ['test:GaryUid00001', 'Gary_Oak · Maestro y mecenas'], ['test:BrockUid0001', 'Brock_P · Ultra'],
    ['test:MistyUid0001', 'Misty_W · Oro'], ['test:AshUid000001', 'AshK · Bronce'], ['test:NovatoUid001', 'Pepe99 · Novato'], ['anon:InvitadoUid01', 'Invitado del juego'], ['', 'Sin cuenta']];
  const TEST_TOKEN = (() => {
    if (!PRUEBA) return '';
    const q = QS.get('token');
    if (q !== null && /^((test|anon):[A-Za-z0-9]{10,64})?$/.test(q)) return q;
    let s = null;
    try { s = localStorage.getItem('psc.prueba'); } catch (e) { /* nada */ }
    return s !== null && CUENTAS_PRUEBA.some(c => c[0] === s) ? s : CUENTAS_PRUEBA[0][0];
  })();
  const SITE = LOCAL ? '1x00000000000000000000AA' : '0x4AAAAAAF1IB2Y0300nQDFr';
  const FB = { apiKey: 'AIzaSyB1LpJcsnT7gj7c8cpRMGjhswLPr8-dnBw', authDomain: 'pokesurvivor-free.firebaseapp.com', projectId: 'pokesurvivor-free',
    storageBucket: 'pokesurvivor-free.firebasestorage.app', messagingSenderId: '798271504277', appId: '1:798271504277:web:dcac4409f969239e87009c' };
  const SDK = 'https://www.gstatic.com/firebasejs/13.0.0/';
  const NAME_DOMAIN = 'jugadores.pokesurvivor.net';
  const LANG = (() => { let s = ''; try { s = localStorage.getItem('ps.lang') || ''; } catch (e) { /* nada */ } return /^es/i.test(s || navigator.language || 'es') ? 'es' : 'en'; })();
  document.documentElement.lang = LANG;
  const EN = window.PSC_EN || {};
  /** Texto en el idioma del jugador ({x}, {y}… se cambian por los argumentos). */
  const T = (s, ...a) => {
    let t = LANG === 'es' ? s : (EN[s] || s);
    a.forEach((v, i) => { t = t.split('{' + 'xyzw'[i] + '}').join(v); });
    return t;
  };
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  const $ = s => document.querySelector(s);
  const fmt = n => Number(n || 0).toLocaleString(LANG === 'es' ? 'es-ES' : 'en-GB');
  const nm = a => (Array.isArray(a) ? (LANG === 'es' ? a[0] : a[1] || a[0]) : a);

  // ---------------- iconos pixel art (los del juego: 12×12, contorno #1b1528) ----------------
  const K = '#1b1528';
  const PIX = {
    chat: [{ w: '#f4f8ff', b: '#9fb9f0' }, ['............', '.kkkkkkkkkk.', 'kwwwwwwwwwwk', 'kwbbwbbwbbwk', 'kwwwwwwwwwwk', 'kwbbbbbwwwwk', 'kwwwwwwwwwwk',
      '.kkkkwwkkkk.', '....kwk.....', '....kk......', '............', '............']],
    bell: [{ y: '#ffd23f', o: '#c08a10', w: '#fff4b0' }, ['.....kk.....', '....kyyk....', '...kyyyyk...', '..kywyyyok..', '..kywyyyok..', '..kyyyyyok..',
      '..kyyyyyok..', '.kyyyyyyyok.', 'kyyyyyyyyyok', 'kkkkkkkkkkkk', '.....kk.....', '............']],
    bolt: [{ y: '#ffd23f', w: '#fff4b0' }, ['......kkkk..', '.....kwyyk..', '....kwyyk...', '...kwyyk....', '..kyyyykkk..', '.kyyyyyyyk..', '.kkkkyyyk...',
      '....kyyk....', '...kyyk.....', '..kyyk......', '..kyk.......', '..kk........']],
    bulb: [{ y: '#ffe37a', w: '#ffffff', g: '#9fb1c9' }, ['....kkkk....', '...kyyyyk...', '..kywwyyyk..', '..kywyyyyk..', '..kyyyyyyk..', '..kyyyyyyk..',
      '...kyyyyk...', '....kyyk....', '....kggk....', '....kggk....', '.....kk.....', '............']],
    laugh: [{ y: '#ffd23f', r: '#ff5f6d' }, ['...kkkkkk...', '..kyyyyyyk..', '.kyyyyyyyyk.', 'kyykyyyykyyk', 'kyyyyyyyyyyk', 'kyyyyyyyyyyk', 'kykkkkkkkkyk',
      'kyykrrrrkyyk', '.kyykrrkyyk.', '..kyykkyyk..', '...kkkkkk...', '............']],
    pin: [{ r: '#ff5f6d', w: '#ffd0d4', g: '#b9cbf0' }, ['....kkkk....', '...krrrrk...', '...krwrrk...', '...krrrrk...', '..kkrrrrkk..', '.krrrrrrrrk.',
      '.kkkkkkkkkk.', '.....kgk....', '.....kgk....', '.....kgk....', '......k.....', '............']],
    lock: [{ y: '#ffd23f', o: '#c08a10', g: '#b9cbf0' }, ['....kkkk....', '...kggggk...', '..kgk..kgk..', '..kgk..kgk..', '.kkkkkkkkkk.', '.kyyyyyyyyk.',
      '.kyyykkyyyk.', '.kyyykkyyyk.', '.kyyyyyyyyk.', '.kooooooook.', '.kkkkkkkkkk.', '............']],
    check: [{ g: '#5fe08a', d: '#2f9a55' }, ['............', '..........kk', '.........kgk', '........kggk', '.kk....kggk.', 'kggk..kggk..', 'kgggkkggk...',
      '.kgggggdk...', '..kgggdk....', '...kgdk.....', '....kk......', '............']],
    pencil: [{ y: '#ffd23f', r: '#ff8a9a', w: '#f4f8ff', d: '#c08a10' }, ['.........kk.', '........krrk', '.......kwrrk', '......kyykk.', '.....kyydk..',
      '....kyydk...', '...kyydk....', '..kyydk.....', '.kwyyk......', '.kwwk.......', 'kkkk........', '............']],
    trash: [{ g: '#b9cbf0', d: '#7f93c0' }, ['....kkkk....', '.kkkkkkkkkk.', '.kggggggggk.', '.kkkkkkkkkk.', '..kgdgdgdk..', '..kgdgdgdk..', '..kgdgdgdk..',
      '..kgdgdgdk..', '..kgdgdgdk..', '..kgggggdk..', '..kkkkkkkk..', '............']],
    search: [{ b: '#9fe0ff', w: '#ffffff', g: '#b9cbf0' }, ['..kkkk......', '.kbbbbk.....', 'kbwwbbbk....', 'kbwbbbbk....', 'kbbbbbbk....', 'kbbbbbbk....',
      '.kbbbbkk....', '..kkkkgk....', '......kgk...', '.......kgk..', '........kgk.', '.........kk.']],
    home: [{ w: '#f4f8ff', r: '#ff8a5a', d: '#9fb1c9' }, ['.....kk.....', '....krrk....', '...krrrrk...', '..krrrrrrk..', '.krrrrrrrrk.', 'kkkwwwwwwkkk',
      '..kwwwwwwk..', '..kwkkwwwk..', '..kwkdkwwk..', '..kwkdkwwk..', '..kkkkkkkk..', '............']],
    news: [{ w: '#f4f8ff', b: '#9fb9f0', r: '#ff5f6d' }, ['............', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kwrrrwbbwk.', '.kwrrrwwwwk.', '.kwrrrwbbwk.',
      '.kwwwwwwwwk.', '.kwbbbbbbwk.', '.kwwwwwwwwk.', '.kwbbbbbbwk.', '.kkkkkkkkkk.', '............']],
    quote: [{ b: '#9fb9f0' }, ['............', '............', '.kkk...kkk..', 'kbbk..kbbk..', 'kbbk..kbbk..', '.kbk...kbk..', '.kk....kk...',
      '............', '............', '............', '............', '............']],
    eye: [{ w: '#f4f8ff', b: '#4fb4ff' }, ['............', '............', '....kkkk....', '..kkwwwwkk..', '.kwwwkkwwwk.', 'kwwwkbbkwwwk', '.kwwwkkwwwk.',
      '..kkwwwwkk..', '....kkkk....', '............', '............', '............']],
    reply: [{ g: '#b9cbf0' }, ['............', '....k.......', '...kgk......', '..kggkkkkk..', '.kggggggggk.', '..kggkkkggk.', '...kgk..kgk.',
      '....k...kgk.', '........kgk.', '.........k..', '............', '............']],
    user: [{ u: '#b9cbf0', d: '#7f93c0' }, ['............', '....kkkk....', '...kuuuuk...', '...kuuuuk...', '...kuuuuk...', '....kuuk....',
      '..kkkuukkk..', '.kuuuuuuuuk.', '.kuuuuuuuuk.', '.kdduuuuddk.', '.kkkkkkkkkk.', '............']],
    gear: [{ g: '#c9d6ff', d: '#7f93c9' }, ['....kkkk....', '.kk.kggk.kk.', '.kgkkggkkgk.', '..kggggggk..', 'kkggkkkkggkk', 'kgggk..kgddk',
      'kgggk..kgddk', 'kkggkkkkddkk', '..kggddddk..', '.kgkkddkkdk.', '.kk.kddk.kk.', '....kkkk....']],
    ticket: [{ y: '#ffd23f', d: '#c08a10', w: '#fff3b0', r: '#ff5f6d' }, ['............', '............', 'kkkkkkkkkkkk', 'kwyyydyyyyyk', 'kyyyyyyrryyk',
      '.kyyydyrryk.', '.kyyyyyrryk.', 'kyyyydyyyyyk', 'kddddddddddk', 'kkkkkkkkkkkk', '............', '............']],
    ticket10: [{ p: '#c47bff', q: '#8a3fd0', w: '#f0d8ff', y: '#ffd23f' }, ['............', '............', 'kkkkkkkkkkkk', 'kwpppqppyypk', 'kppppqpyyypk',
      '.kpppqpyyyk.', '.kpppqppyyk.', 'kppppqpppppk', 'kqqqqqqqqqqk', 'kkkkkkkkkkkk', '............', '............']],
    star: [{ y: '#ffd23f', o: '#c08a10', w: '#fff4b0' }, ['.....kk.....', '.....kk.....', '....kwyk....', '....kyyk....', 'kkkkwyyykkkk', 'kwyyyyyyyyok',
      '.kyyyyyyyok.', '..kyyyyyyk..', '..kyyyoyyk..', '.kyok..koyk.', '.kok....kok.', '.kk......kk.']],
    menu: [{ w: '#f4f8ff' }, ['............', '............', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.',
      '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............', '............', '............']],
    up: [{ g: '#5fe08a', d: '#2f9a55' }, ['.....kk.....', '....kggk....', '...kggggk...', '..kggggggk..', '.kggggggggk.', 'kkkkggggkkkk',
      '...kggggk...', '...kggggk...', '...kggdgk...', '...kgddgk...', '...kkkkkk...', '............']],
    down: [{ r: '#ff5f6d', d: '#b3121a' }, ['...kkkkkk...', '...krrrrk...', '...krrrrk...', '...krrdrk...', '...krddrk...', 'kkkkrrrrkkkk',
      '.krrrrrrrrk.', '..krrrrrrk..', '...krrrrk...', '....krrk....', '.....kk.....', '............']],
    cursor: [{ y: '#ffd23f' }, ['k.......', 'kk......', 'kyk.....', 'kyyk....', 'kyyyk...', 'kyyyyk..', 'kyyyk...', 'kyyk....', 'kyk.....', 'kk......',
      'k.......', '........']]
  };
  const svgCache = {};
  function svgOf(name) {
    if (svgCache[name]) return svgCache[name];
    const [pal, rows] = PIX[name], w = rows[0].length, h = rows.length;
    let r = '';
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${ch === 'k' ? K : pal[ch]}"/>`; }));
    return (svgCache[name] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`);
  }
  // Los demás, los SVG de las páginas de la web (assets/pages/icons).
  const FILES = new Set(["amuletcoin","assaultvest","bag","ball","ball4","bomb","bond","book","boot","candy","cards","choiceband","choicescarf","clock","closet","coin","covertcloak","crown","dice","egg","expcharm","fist","flag","focussash","friends","heart","heavydutyboots","iris","leftovers","lifeorb","loadeddice","luckincense","luckyegg","magnet","medal2","medal3","metronome","mint","mirrorherb","pdyna","pmega","ptera","punchingglove","pzring","quickclaw","radargoggles","rareincense","rockyhelmet","safetygoggles","save","shellbell","shield","shiny","shop","sprout","superpads","throatspray","tm","trophy"]);
  function ico(name, size = 20, cls = '') {
    if (PIX[name]) return `<i class="ico ${cls}" style="--s:${size}px" aria-hidden="true">${svgOf(name)}</i>`;
    if (FILES.has(name)) return `<img class="ico ${cls}" src="../assets/pages/icons/${name}.svg" width="${size}" height="${size}" alt="" loading="lazy">`;
    return '';
  }
  // Imágenes que no existen (una cara sin retrato, un marco de antes): sin los onerror del HTML (los prohíbe la CSP).
  document.addEventListener('error', e => {
    const t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    if (t.classList.contains('cara')) t.classList.add('rota');
    else if (t.classList.contains('pfp-face')) { const i = document.createElement('i'); i.className = 'pfp-none'; i.innerHTML = svgOf('user'); t.replaceWith(i); }
    else if (t.classList.contains('pfp-frame') || t.classList.contains('pfp-medal')) t.remove();
  }, true);
  document.documentElement.style.setProperty('--ico-cursor', `url("data:image/svg+xml,${encodeURIComponent(svgOf('cursor'))}")`);

  // ---------------- estado ----------------
  let listo = null;   // (los datos del juego y las reglas: arrancar)
  const S = { yo: null, reglas: null, datos: null, avisos: 0, reportes: 0, sesion: 'cargando', fb: null, user: null };
  const D = { dex: new Map(), moves: new Map(), items: new Map(), ups: new Map(), types: new Map(), marcos: {}, changelog: [] };

  // ---------------- red ----------------
  async function token(refresh) {
    if (PRUEBA) return TEST_TOKEN;
    if (!S.user) return '';
    try { return await S.user.getIdToken(refresh); } catch (e) { return ''; }
  }
  class ApiError extends Error { constructor(code, body) { super((body && body.error) || 'error'); this.code = code; this.body = body || {}; } }
  async function api(method, path, body, query, refresh = false) {
    const url = new URL(API + path), espera = listo;   // (lo que había que esperar cuando salió: las reglas de arrancar, nada)
    if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    const headers = {};
    const tk = await token(refresh);
    if (tk) headers.authorization = 'Bearer ' + tk;
    let payload;
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
      if (new Blob([payload]).size > 62 * 1024) throw new ApiError(413, { error: 'size' });
    }
    let r;
    try { r = await fetch(url, { method, headers, body: payload }); } catch (e) { throw new ApiError(0, { error: 'red' }); }
    let data = null;
    try { data = await r.json(); } catch (e) { /* nada */ }
    if (espera) await espera;
    if (r.status === 401 && tk && !refresh && !PRUEBA) return api(method, path, body, query, true);
    if (r.status === 428 && body !== undefined && !(data && data.mal && body.ts)) {
      const ts = await captcha();
      if (!ts) throw new ApiError(428, { error: 'captcha' });
      return api(method, path, { ...body, ts }, query, refresh);
    }
    if (!r.ok) throw new ApiError(r.status, data);
    return data;
  }
  const get = (p, q) => api('GET', p, undefined, q);
  const post = (p, b = {}) => api('POST', p, b);

  // Captcha (Cloudflare Turnstile, como el juego: js/net/api.js).
  let tsCarga = null;
  const cargarTs = () => tsCarga || (tsCarga = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = res; s.onerror = () => { tsCarga = null; rej(); };
    document.head.appendChild(s);
  }));
  function captcha() {
    if (PRUEBA) return Promise.resolve('ok');   // (el servidor de prueba acepta 'ok')
    return new Promise(res => {
      const box = document.createElement('div');
      box.className = 'veil';
      box.innerHTML = `<div class="box captcha"><p>${esc(T('Comprobando que no eres un robot…'))}</p><div class="slot"></div>
        <button class="btn small ghost" data-x>${esc(T('Cancelar'))}</button></div>`;
      document.body.appendChild(box);
      let id = null, done = false;
      const end = v => {
        if (done) return;
        done = true; clearTimeout(t);
        try { if (id !== null) window.turnstile.remove(id); } catch (e) { /* nada */ }
        box.remove(); res(v);
      };
      const t = setTimeout(() => end(''), 120000);
      box.querySelector('[data-x]').onclick = () => end('');
      cargarTs().then(() => {
        id = window.turnstile.render(box.querySelector('.slot'), { sitekey: SITE, callback: end, 'error-callback': () => end(''), 'expired-callback': () => end(''), theme: 'dark' });
      }).catch(() => end(''));
    });
  }

  /** El mensaje para el jugador de un error del servidor. */
  function errTexto(e) {
    const b = (e && e.body) || {}, c = b.error;
    const M = {
      red: T('Sin conexión con el servidor. Prueba otra vez en un momento.'),
      auth: T('Entra con tu cuenta del juego para hacer esto.'),
      anon: T('Los invitados sólo pueden leer: entra con una cuenta del juego para escribir.'),
      apodo: T('Elige tu apodo en el juego (Perfil) y vuelve: es tu nombre en el foro.'),
      ban: T('Tu cuenta está baneada: no puedes escribir en el foro.'),
      captcha: T('No hemos podido comprobar que no eres un robot. Prueba otra vez.'),
      size: T('Es demasiado largo.'),
      titulo: T('Pon un título (al menos 3 letras).'),
      texto: T('Escribe un poco más.'),
      cerrado: T('El hilo está cerrado.'),
      permiso: T('No puedes hacer esto.'),
      autor: T('Sólo quien abrió el hilo puede elegir la solución.'),
      staff: T('Sólo el equipo puede publicar aquí.'),
      propio: T('No puedes reaccionar a lo tuyo.'),
      primero: T('Es el primer mensaje: para quitarlo hay que borrar el hilo entero.'),
      existe: T('Ya hay una página con ese nombre (o un Pokémon, ataque u objeto que se llama así).'),
      build_poke: T('Elige un Pokémon de la lista.'),
      build_movs: T('Pon al menos un ataque.'),
      build_texto: T('Explica un poco la build (al menos 30 letras): cómo se juega, en qué orden subir los ataques…'),
      clave: T('Eso no está en el juego.'),
      motivo: T('Cuenta qué pasa (al menos 3 letras).'),
      none: T('No existe (o lo han borrado).'),
      server: T('Algo ha fallado en el servidor. Prueba otra vez en un momento.')
    };
    if (c === 'ritmo') return T('Vas muy rápido: espera {x} s.', b.wait || 10);
    if (c === 'suspendido') return T('Estás suspendido en el foro hasta el {x}.', fecha(b.hasta)) + (b.motivo ? ' ' + T('Motivo: {x}', b.motivo) : '');
    if (c === 'rango') return T('Se desbloquea en el rango {x}.', rangoNombre(b.necesita));
    // (23-11-2026) Cuántas se pueden publicar al día (reglas.mjs TOPE_DIA).
    if (c === 'tope') return b.que === 'sugerencia' ? T('Ya has publicado {x} sugerencias hoy, el máximo. Mañana podrás publicar más.', b.max || 3)
      : T('Ya has abierto {x} hilos hoy, el máximo. Mañana podrás abrir más.', b.max || 2);
    return M[c] || M.server;
  }

  // ---------------- fechas ----------------
  const RTF = new Intl.RelativeTimeFormat(LANG === 'es' ? 'es' : 'en', { numeric: 'auto' });
  function hace(iso) {
    const t = new Date(iso).getTime();
    if (!t) return '';
    const s = Math.round((t - Date.now()) / 1000), a = Math.abs(s);
    if (a < 45) return T('ahora mismo');
    if (a < 3600) return RTF.format(Math.round(s / 60), 'minute');
    if (a < 86400) return RTF.format(Math.round(s / 3600), 'hour');
    if (a < 86400 * 30) return RTF.format(Math.round(s / 86400), 'day');
    return fecha(iso);
  }
  const fecha = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(LANG === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' }); };
  const cuando = iso => `<time datetime="${esc(iso)}" title="${esc(new Date(iso).toLocaleString(LANG === 'es' ? 'es-ES' : 'en-GB', { timeZone: 'Europe/Madrid' }))}">${esc(hace(iso))}</time>`;

  // ---------------- datos del juego ----------------
  async function cargarDatos() {
    if (S.datos) return S.datos;
    const pre = document.querySelector('link[rel="preload"][href^="datos.json"]');
    const r = await fetch(pre ? pre.getAttribute('href') : 'datos.json', pre ? {} : { cache: 'no-cache' });
    const d = await r.json();
    for (const p of d.dex) D.dex.set(p[0], { id: p[0], num: p[1], n: [p[2], p[3]], types: p[4], r: p[5], gen: p[6], reg: p[7], leg: !!p[8], w: p[9], h: p[10], st: !!p[11] });
    for (const m of d.moves) D.moves.set(m[0], { id: m[0], n: [m[1], m[2]], type: m[3], kind: m[4], cat: m[5], desc: [m[6], m[7]], evo: m[8] ? { n: [m[8], m[9]], t: [m[10], m[11]], needs: [m[12], m[13]] } : null });
    for (const i of d.items) D.items.set(i[0], { id: i[0], n: [i[1], i[2]], desc: [i[3], i[4]] });
    for (const u of d.upgrades) D.ups.set(u[0], { id: u[0], icon: u[1], n: [u[2], u[3]], unit: [u[4], u[5]], max: u[6], leg: !!u[7] });
    for (const t of d.types) D.types.set(t[0], { id: t[0], color: t[1], n: [t[2], t[3]] });
    D.marcos = d.marcos || {};
    D.changelog = d.changelog || [];
    return (S.datos = d);
  }
  const pokeNombre = id => { const p = D.dex.get(+id); return p ? nm(p.n) : '#' + id; };
  const movNombre = id => { const m = D.moves.get(id); return m ? nm(m.n) : id; };
  const objNombre = id => { const o = D.items.get(id); return o ? nm(o.n) : id; };
  const tipo = t => { const x = D.types.get(t); return x ? `<i class="ty" style="--c:${x.color}">${esc(nm(x.n))}</i>` : ''; };
  /** La cara del Pokémon (retrato de la tienda de fotos; las formas, la de su número). */
  function cara(id, size = 40) {
    const p = D.dex.get(+id);
    const num = p ? p.num : +id;
    return `<img class="cara" src="../assets/tienda/fotos-perfil/${num}/normal.png" width="${size}" height="${size}" alt="" loading="lazy">`;
  }
  /** El primer fotograma de su animación de espera (como en el juego). */
  function sprite(id, escala = 3) {
    const p = D.dex.get(+id);
    if (!p || !p.w) return cara(id, 64);
    return `<span class="spr" style="width:${p.w * escala}px;height:${p.h * escala}px"><img src="../assets/pokemon/${p.id}/Idle.png" alt="" style="transform:scale(${escala})" loading="lazy"></span>`;
  }

  // ---------------- personas ----------------
  const RANGO_N = { novato: 'Novato', bronce: 'Bronce', plata: 'Plata', oro: 'Oro', ultra: 'Ultra', maestro: 'Maestro' };
  const rangoNombre = id => T(RANGO_N[id] || id || '');
  const rangoI = id => ['novato', 'bronce', 'plata', 'oro', 'ultra', 'maestro'].indexOf(id);
  /** Foto de perfil con su marco, como en el juego (G.UI.pfp). Los de Ultra o más, con el marco animado. */
  function pfp(u, size = 48) {
    u = u || {};
    const m = typeof u.f === 'string' && /^(\d{1,4})\.([a-z0-9]{2,12})(\.s)?$/.exec(u.f);
    const face = m ? `../assets/tienda/fotos-perfil/${m[1]}/${m[3] ? 's/' : ''}${m[2]}.png` : '';
    const moving = rangoI(u.rg) >= 4 && size >= 56;
    let fr = '', medal = '';
    const mm = typeof u.fr === 'string' && /^maestria-(\d{1,7})$/.exec(u.fr);
    if (mm) {
      const p = D.dex.get(+mm[1]);
      const t = p && p.types[0] && D.types.has(p.types[0]) ? p.types[0] : 'normal';
      fr = `../assets/tienda/marcos/maestria_${t}${moving ? '-anim' : ''}.png`;
      medal = p ? `../assets/tienda/fotos-perfil/${p.num}/normal.png` : '';
    } else if (u.fr && D.marcos[u.fr] !== undefined) fr = `../assets/tienda/marcos/${u.fr}${moving && D.marcos[u.fr] ? '-anim' : ''}.png`;
    const sm = size < 80;
    return `<span class="pfp${fr ? '' : ' nofr'}${sm ? ' sm' : ''}" style="--s:${size}px">` +
      (face ? `<img class="pfp-face" src="${face}" alt="" loading="lazy">` : `<i class="pfp-none">${svgOf('user')}</i>`) +
      (fr ? `<img class="pfp-frame" src="${fr}" alt="" loading="lazy">` : '') + (medal ? `<img class="pfp-medal" src="${medal}" alt="">` : '') + '</span>';
  }
  /** El nombre con el color de su rango (los Maestros, dorado brillante) y sus insignias. */
  function quien(us, uid, { badges = true } = {}) {
    const u = us && us[uid];
    if (!u) return `<span class="un borrada">${esc(T('cuenta borrada'))}</span>`;
    let b = '';
    if (badges) {
      if (u.rol === 'admin') b += `<i class="badge admin">${esc(T('Equipo'))}</i>`;
      else if (u.rol === 'mod') b += `<i class="badge mod">${esc(T('Moderación'))}</i>`;
      if (u.m) b += `<i class="badge mec" title="${esc(T('Apoya el proyecto'))}">${ico('heart', 12)}</i>`;
    }
    return `<a class="un rg-${esc(u.rg)}" href="#/u/${esc(u.n)}" translate="no">${esc(u.n)}</a>${b}`;
  }
  const rangoPill = rg => `<i class="rk rg-${esc(rg)}">${esc(rangoNombre(rg))}</i>`;
  /** La ficha del autor (al lado de cada mensaje). */
  function autorFicha(us, uid) {
    const u = us[uid];
    if (!u) return `<div class="autor">${pfp(null, 64)}<span class="un borrada">${esc(T('cuenta borrada'))}</span></div>`;
    const meds = (u.med || []).map(k => `<span class="mini-med" title="${esc(medallaNombre(k))}">${ico(medallaIcono(k), 16)}</span>`).join('');
    return `<div class="autor">${pfp(u, 72)}<div class="autor-n">${quien(us, uid)}</div>${rangoPill(u.rg)}` +
      (u.t ? `<div class="titulo-med">${esc(medallaTitulo(u.t))}</div>` : '') +
      `<div class="autor-st">${u.np != null ? esc(T('{x} mensajes', fmt(u.np))) + ' · ' : ''}${esc(fmt(u.pe))} PE</div>${meds ? `<div class="mini-meds">${meds}</div>` : ''}</div>`;
  }

  // ---------------- medallas ----------------
  const MED = {
    fundador: ['Fundador', 'Entraste al foro en su primer mes.', 'Fundador'],
    primer_hilo: ['Primeras palabras', 'Abre tu primer hilo.', 'Charlatán novel'],
    posts100: ['Charlatán', 'Escribe 100 respuestas que den PE (en hilos de otros).', 'Charlatán'],
    primera_build: ['Teórico', 'Publica tu primera build.', 'Teórico de builds'],
    builds10: ['Arquitecto', 'Publica 10 builds que den PE (cuenta una al día).', 'Arquitecto de builds'],
    super50: ['Supereficaz', 'Recibe 50 «¡Es supereficaz!» o votos a favor en tus builds.', 'Supereficaz'],
    solucion1: ['Buen samaritano', 'Que marquen una respuesta tuya como solución.', 'Buen samaritano'],
    soluciones10: ['Profesor Oak', '10 respuestas tuyas marcadas como solución.', 'Profesor'],
    racha7: ['Constante', 'Entra 7 días seguidos.', 'Constante'],
    racha30: ['Imparable', 'Entra 30 días seguidos.', 'Imparable'],
    escriba: ['Escriba', '5 aportes a la wiki que den PE (consejos, páginas o ediciones grandes).', 'Escriba de la wiki'],
    visionario: ['Visionario', 'Una sugerencia tuya ha sido aceptada.', 'Visionario'],
    mecenas: ['Mecenas', 'Apoyas el proyecto con una donación.', 'Mecenas']
  };
  const medallaNombre = k => T((MED[k] || [k])[0]);
  const medallaReq = k => T((MED[k] || ['', ''])[1]);
  const medallaTitulo = k => T((MED[k] || ['', '', k])[2]);
  const medallaIcono = k => (S.reglas && S.reglas.medallas[k] ? S.reglas.medallas[k].icono : 'star');

  // ---------------- piezas ----------------
  const CAT_N = {
    anuncios: ['Anuncios y novedades', 'Lo nuevo del juego, contado por su creador.'],
    general: ['General', 'Habla de PokéSurvivor: partidas, récords, shinies y lo que se te ocurra.'],
    ayuda: ['Ayuda y preguntas', '¿Atascado? Pregunta y la comunidad te echa una mano.'],
    grupo: ['Buscar grupo', 'Encuentra compañeros para el cooperativo (hasta 4).'],
    desafio: ['Desafío semanal', 'La partida de la semana: estrategias y tiempos.'],
    fanart: ['Fan art y creaciones', 'Dibujos, skins, vídeos y todo lo que hagáis.'],
    offtopic: ['Fuera de tema', 'Todo lo que no es PokéSurvivor.'],
    bugs: ['Fallos', '¿Algo no va bien? Cuéntalo con todos los detalles.']
  };
  const GRUPO_N = { oficial: 'Oficial', comunidad: 'Comunidad', soporte: 'Soporte' };
  const catNombre = s => T((CAT_N[s] || [s])[0]);
  const cat = s => (S.reglas ? S.reglas.categorias.find(c => c.slug === s) : null);
  const prefijo = p => (p ? `<i class="pref pref-${esc(slug(p))}">${esc(T(p))}</i>` : '');
  const slug = t => String(t).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const ESTADO_N = { pendiente: 'Pendiente', revision: 'En revisión', aceptada: 'Aceptada', hecha: 'Hecha', rechazada: 'Rechazada' };
  const CATSUG_N = { juego: 'Juego', pokemon: 'Pokémon y ataques', interfaz: 'Interfaz', coop: 'Cooperativo', web: 'Web y foro', otra: 'Otra' };
  const PODER_N = { mega: 'Megaevolución', dyna: 'Dinamax', z: 'Movimiento Z', tera: 'Teracristal' };
  const PODER_I = { mega: 'pmega', dyna: 'pdyna', z: 'pzring', tera: 'ptera' };
  const MODO_N = { solo: 'En solitario', coop: 'Cooperativo', desafio: 'Desafío semanal' };
  const REAC = { super: ['bolt', '¡Es supereficaz!'], util: ['bulb', 'Útil'], risa: ['laugh', 'Me ha hecho gracia'] };

  function reacciones(obj, id, r, url = '') {
    r = r || { super: 0, util: 0, risa: 0, mias: [] };
    return `<div class="reacs" data-obj="${obj}" data-id="${id}" data-url="${esc(url)}">` + Object.entries(REAC).map(([k, [ic, t]]) =>
      `<button class="reac${r.mias && r.mias.includes(k) ? ' on' : ''}" data-act="reac" data-tipo="${k}" title="${esc(T(t))}">${ico(ic, 16)}<b>${r[k] || ''}</b></button>`).join('') + '</div>';
  }
  function paginador(pag, paginas, ir) {
    if (!paginas || paginas <= 1) return '';
    const b = [], add = (n, t = n) => b.push(n === pag ? `<b class="pg on">${t}</b>` : `<a class="pg" href="${ir(n)}">${t}</a>`);
    if (pag > 1) add(pag - 1, '‹');
    for (let n = 1; n <= paginas; n++) {
      if (n === 1 || n === paginas || Math.abs(n - pag) <= 2) add(n);
      else if (b[b.length - 1] !== '<i class="pg-gap">…</i>') b.push('<i class="pg-gap">…</i>');
    }
    if (pag < paginas) add(pag + 1, '›');
    return `<nav class="pags">${b.join('')}</nav>`;
  }
  const vacio = (t, extra = '') => `<div class="vacio">${ico('sprout', 28)}<p>${esc(t)}</p>${extra}</div>`;
  const caja = (titulo, cuerpo, { icono = '', cls = '', extra = '' } = {}) =>
    `<section class="box ${cls}">${titulo ? `<div class="box-h"><h2>${icono ? ico(icono, 22) : ''}${esc(titulo)}</h2>${extra}</div>` : ''}${cuerpo}</section>`;
  const migas = (...m) => `<nav class="migas">${m.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<b>${esc(t)}</b>`)).join('<i>›</i>')}</nav>`;
  /** Botón que pide entrar (si no hay sesión) o hace algo. */
  const conCuenta = html => (S.yo ? html : `<a class="btn small gold" href="#/entrar">${esc(T('Entra para participar'))}</a>`);

  /** El editor: barra de formato, texto y vista previa (la hace el servidor). */
  function editor(name, valor = '', { max = 10000, alto = 8, ph = '' } = {}) {
    const B = [['b', '**', 'Negrita', 'B'], ['i', '*', 'Cursiva', 'I'], ['s', '~~', 'Tachado', 'S'], ['sp', '||', 'Spoiler', '▒'], ['code', '`', 'Código', '<>'],
      ['link', 'link', 'Enlace', '🔗'], ['img', 'img', 'Imagen (desde Bronce)', '▣'], ['quote', '> ', 'Cita', '❝'], ['list', '- ', 'Lista', '•'], ['wiki', 'wiki', 'Enlace a la wiki: [[Pikachu]]', '[[ ]]']];
    return `<div class="ed" data-max="${max}">
      <div class="ed-bar">${B.map(([k, , t, l]) => `<button type="button" class="ed-b" data-ed="${k}" title="${esc(T(t))}">${esc(l)}</button>`).join('')}
        <span class="grow"></span><button type="button" class="tab-mini on" data-edtab="w">${esc(T('Escribir'))}</button><button type="button" class="tab-mini" data-edtab="p">${esc(T('Vista previa'))}</button></div>
      <textarea class="field ed-t" name="${name}" rows="${alto}" maxlength="${max}" placeholder="${esc(ph)}">${esc(valor)}</textarea>
      <div class="ed-p md hidden"></div>
      <div class="ed-pie"><span class="ed-ayuda">${esc(T('**negrita** · *cursiva* · ||spoiler|| · > cita · [[Pikachu]] · @apodo'))}</span><span class="ed-n">0 / ${fmt(max)}</span></div>
    </div>`;
  }

  // ---------------- marco de la página ----------------
  const NAV = [
    ['', 'home', 'Inicio', 'Lo último de la comunidad'],
    ['foro', 'chat', 'Foro', 'Charla, ayuda y grupos'],
    ['builds', 'tm', 'Builds', 'Pokémon, ataques y objetos'],
    ['sugerencias', 'bulb', 'Sugerencias', 'Vota lo que quieres en el juego'],
    ['wiki', 'book', 'Wiki', 'Pokédex, ataques y consejos'],
    ['miembros', 'friends', 'Miembros', 'Quién es quién'],
    ['rangos', 'trophy', 'Rangos y premios', 'Tickets por participar'],
    ['apoyar', 'heart', 'Apoyar', 'Ayuda con los servidores']
  ];
  function pintarMarco() {
    const yo = S.yo;
    $('#nav').innerHTML = `<div class="menu-list">` + NAV.map(([r, ic, t, sub]) =>
      `<a class="menu-item" data-nav="${r}" href="#/${r}"><span class="mi-ico">${ico(ic, 26)}</span>${esc(T(t))}<small>${esc(T(sub))}</small></a>`).join('') +
      (yo && (yo.u.rol === 'admin' || yo.u.rol === 'mod') ? `<a class="menu-item" data-nav="panel" href="#/panel"><span class="mi-ico">${ico('shield', 26)}</span>${esc(T('Panel'))}<small>${esc(T('{x} reportes abiertos', S.reportes))}</small></a>` : '') +
      `</div>`;
    let u;
    if (S.sesion === 'cargando') u = `<span class="pill">…</span>`;
    else if (yo) {
      u = `<a class="btn small ghost bell${S.avisos ? ' hay' : ''}" href="#/avisos" title="${esc(T('Avisos'))}">${ico('bell', 18)}${S.avisos ? `<b>${S.avisos > 99 ? '99+' : S.avisos}</b>` : ''}</a>` +
        `<a class="pill yo" href="#/u/${esc(yo.u.n)}">${pfp(yo.u, 42)}<span translate="no">${esc(yo.u.n)}</span>${rangoPill(yo.u.rg)}</a>` +
        `<a class="btn small ghost" href="#/ajustes" title="${esc(T('Ajustes'))}">${ico('gear', 18)}</a>`;
    } else if (S.sesion === 'sinApodo') u = `<a class="btn small gold" href="../">${esc(T('Elige tu apodo en el juego'))}</a>`;
    else u = `<a class="btn small gold" href="#/entrar">${esc(T('Entrar'))}</a>`;
    $('#yo').innerHTML = u;
  }
  function marcarNav(r) {
    document.querySelectorAll('[data-nav]').forEach(a => {
      const n = a.dataset.nav;
      a.classList.toggle('on', n === '' ? r === '' : r === n || r.startsWith(n + '/') ||
        (n === 'foro' && /^hilo\//.test(r)) || (n === 'builds' && /^build\//.test(r)) || (n === 'sugerencias' && /^sugerencia\//.test(r)) || (n === 'miembros' && /^u\//.test(r)));
    });
  }

  // ---------------- vistas ----------------
  const V = {};
  const pintar = html => { $('#main').innerHTML = html; };

  V.inicio = async () => {
    const d = await get('/portada');
    const us = d.us, yo = S.yo;
    const tiles = [['foro', 'chat', 'Foro', T('{x} hilos · {y} mensajes', fmt(d.stats.hilos), fmt(d.stats.mensajes)), 'big'],
      ['builds', 'tm', 'Builds', T('{x} builds', fmt(d.stats.builds))], ['sugerencias', 'bulb', 'Sugerencias', T('{x} sugerencias', fmt(d.stats.sugerencias))],
      ['wiki', 'book', 'Wiki', T('Pokédex, ataques y objetos')], ['rangos', 'trophy', 'Rangos', T('Tickets por participar')]];
    let mio = '';
    if (yo) {
      const sig = yo.sig ? S.reglas.rangos.find(r => r.id === yo.sig) : null;
      mio = `<div class="mi-rango">${pfp(yo.u, 80)}<div class="grow"><div class="mr-n">${quien({ x: yo.u }, 'x')} ${rangoPill(yo.u.rg)}</div>
        <div class="barra"><i style="width:${yo.pct}%"></i></div>
        <small>${sig ? esc(T('{x} PE · faltan {y} para {z}', fmt(yo.u.pe), fmt(sig.pe - yo.u.pe), rangoNombre(sig.id))) + ` <span class="premio-mini">${premioTxt(sig.premio)}</span>` : esc(T('{x} PE · ¡rango máximo!', fmt(yo.u.pe)))}</small>
        <small>${ico('clock', 14)} ${esc(T('Racha: {x} días', yo.u.racha || 0))}</small></div></div>`;
    } else {
      mio = `<div class="mi-rango"><div class="grow"><p>${esc(T('Entra con tu cuenta del juego para escribir, votar y ganar tickets del gacha por participar.'))}</p>
        <a class="btn gold" href="#/entrar">${esc(T('Entrar'))}</a></div></div>`;
    }
    const hilo = h => `<li class="fila"><span class="fila-i">${pfp(us[h.ultimo_uid || h.uid], 40)}</span><div class="grow"><a class="fila-t" href="#/hilo/${h.id}">${prefijo(h.prefijo)}${esc(h.titulo)}</a>
      <small>${esc(catNombre(h.cat))} · ${quien(us, h.ultimo_uid || h.uid, { badges: false })} · ${cuando(h.actividad)}</small></div><span class="num">${ico('chat', 14)} ${fmt(h.respuestas)}</span></li>`;
    const nov = D.changelog[0];
    const b = d.build;
    pintar(`<div class="inicio">
      <section class="box hero"><div class="hero-t"><h1>${esc(T('Comunidad de PokéSurvivor'))}</h1><p class="sub">${esc(T('Foro, builds, sugerencias y wiki de los jugadores. Participa, sube de rango y gana tickets del gacha.'))}</p></div>${mio}</section>
      <div class="tiles">${tiles.map(([r, ic, t, s, c]) => `<a class="tile ${c || ''}" href="#/${r}"><span class="mi-ico">${ico(ic, c ? 56 : 34)}</span><b>${esc(T(t))}</b><small>${esc(s)}</small></a>`).join('')}</div>
      <div class="cols">
        <div class="col">
          ${d.anuncios.length ? caja(T('Anuncios'), `<ul class="filas">${d.anuncios.map(h => `<li class="fila"><span class="fila-i">${ico('news', 28)}</span><div class="grow"><a class="fila-t" href="#/hilo/${h.id}">${prefijo(h.prefijo)}${esc(h.titulo)}</a><small>${cuando(h.creado)}</small></div></li>`).join('')}</ul>`, { icono: 'news', cls: 'anuncios' }) : ''}
          ${caja(T('Últimos hilos'), d.ultimos.length ? `<ul class="filas">${d.ultimos.map(hilo).join('')}</ul>` : vacio(T('Aún no hay hilos. ¡Abre el primero!')), { icono: 'chat', extra: `<a class="btn small ghost" href="#/foro">${esc(T('Ver el foro'))}</a>` })}
          ${caja(T('Sugerencias más votadas'), d.sugerencias.length ? `<ul class="filas">${d.sugerencias.map(s => `<li class="fila"><span class="voto-n">${fmtVoto(s.votos)}</span><div class="grow"><a class="fila-t" href="#/sugerencia/${s.id}">${esc(s.titulo)}</a><small>${estadoPill(s.estado)} · ${quien(us, s.uid, { badges: false })}</small></div></li>`).join('')}</ul>` : vacio(T('Aún no hay sugerencias.')), { icono: 'bulb', extra: `<a class="btn small ghost" href="#/sugerencias">${esc(T('Ver todas'))}</a>` })}
        </div>
        <div class="col">
          ${caja(T('Build de la semana'), b ? buildCard(b, us) : vacio(T('Aún no hay builds.'), `<a class="btn small gold" href="#/builds/nueva">${esc(T('Publica la primera'))}</a>`), { icono: 'tm' })}
          ${caja(T('Top del mes'), d.top.length ? `<ol class="toplist">${d.top.map((x, i) => `<li><b class="pos p${i + 1}">${i + 1}</b>${pfp(us[x.uid], 36)}${quien(us, x.uid)}<span class="grow"></span><b>${fmt(x.pm)} PE</b></li>`).join('')}</ol>` : vacio(T('Nadie ha ganado PE este mes todavía.')), { icono: 'trophy' })}
          ${nov ? caja(T('Lo último del juego'), `<div class="novedad"><b>${esc(nm(nov.t))}</b><small>${esc(fecha(nov.d + 'T12:00:00Z'))}</small><ul>${nov.x.slice(0, 4).map(x => `<li>${esc(nm(x))}</li>`).join('')}</ul><a class="btn small ghost" href="../novedades/">${esc(T('Todas las novedades'))}</a></div>`, { icono: 'star' }) : ''}
          ${caja(T('En línea ahora'), d.online.length ? `<div class="online">${d.online.map(u => `<a href="#/u/${esc(us[u] ? us[u].n : '')}" title="${esc(us[u] ? us[u].n : '')}">${pfp(us[u], 36)}</a>`).join('')}</div>` : `<p class="sub">${esc(T('Nadie en los últimos 10 minutos.'))}</p>`, { icono: 'friends' })}
          ${caja(T('Apoya el proyecto'), donar(), { icono: 'heart' })}
          <section class="box stats">${[['friends', d.stats.miembros, 'miembros'], ['chat', d.stats.mensajes, 'mensajes'], ['tm', d.stats.builds, 'builds'], ['bulb', d.stats.sugerencias, 'sugerencias']].map(([ic, n, t]) => `<div>${ico(ic, 20)}<b>${fmt(n)}</b><small>${esc(T(t))}</small></div>`).join('')}
            ${d.stats.nuevo && us[d.stats.nuevo] ? `<p class="sub">${esc(T('Damos la bienvenida a'))} ${quien(us, d.stats.nuevo)}</p>` : ''}</section>
        </div>
      </div></div>`);
  };
  const fmtVoto = v => { const n = Math.round((+v || 0) * 10) / 10; return `<b class="${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${n > 0 ? '+' : ''}${fmt(n)}</b>`; };
  const estadoPill = e => `<i class="est est-${esc(e)}">${esc(T(ESTADO_N[e] || e))}</i>`;
  function premioTxt(p) {
    if (!p) return '';
    const o = [];
    if (p.t1) o.push(`${ico('ticket', 14)}×${p.t1}`);
    if (p.t10) o.push(`${ico('ticket10', 14)}×${p.t10}`);
    if (p.cosas) o.push(`${ico('star', 14)} ${esc(T('cosmético'))}`);
    return o.join(' ');
  }
  // (20-11-2026, el dueño: «quita cuánto dinero llevamos… pon algo como dona para que PokéSurvivor no muera, sin meta ni cuánto llevamos».)
  function donar(boton = true) {
    return `<div class="donar"><p class="donar-t">${ico('heart', 18)} ${esc(T('Dona para que PokéSurvivor no muera.'))}</p>
      <p class="sub">${esc(T('El juego es gratis y sin anuncios: las donaciones pagan los servidores. Donar no da ventajas en el juego.'))}</p>
      ${boton ? `<a class="btn small gold" href="#/apoyar">${ico('heart', 16)} ${esc(T('Apoyar'))}</a>` : ''}</div>`;
  }

  // ----- foro -----
  V.foro = async () => {
    const d = await get('/foro');
    const grupos = {};
    for (const c of S.reglas.categorias) (grupos[c.grupo] = grupos[c.grupo] || []).push(c);
    pintar(migas([T('Foro')]) + Object.entries(grupos).map(([g, cs]) => caja(T(GRUPO_N[g] || g), `<ul class="cats">${cs.map(c => {
      const x = d.cats[c.slug] || {}, u = x.ultimo;
      return `<li class="cat" style="--c:${c.color}"><a class="cat-i" href="#/foro/${c.slug}">${ico(c.icono, 34)}</a><div class="grow"><a class="cat-t" href="#/foro/${c.slug}">${esc(catNombre(c.slug))}</a>
        <small>${esc(T((CAT_N[c.slug] || ['', ''])[1]))}</small></div><div class="cat-n"><b>${fmt(x.hilos || 0)}</b><small>${esc(T('hilos'))}</small></div>
        <div class="cat-u">${u ? `${pfp(d.us[u.uid], 32)}<div><a href="#/hilo/${u.id}">${esc(u.titulo)}</a><small>${cuando(u.actividad)}</small></div>` : `<small>${esc(T('Sin hilos aún'))}</small>`}</div></li>`;
    }).join('')}</ul>`, { icono: g === 'oficial' ? 'news' : g === 'soporte' ? 'shield' : 'chat' })).join(''));
  };
  V.categoria = async (slugCat, q) => {
    const c = cat(slugCat);
    if (!c) return V.noExiste();
    const d = await get('/foro/' + slugCat, { pag: q.pag, pref: q.pref, orden: q.orden });
    const us = d.us, base = n => `#/foro/${slugCat}?${new URLSearchParams({ ...q, pag: n })}`;
    const puede = S.yo && (!c.staff || ['admin', 'mod'].includes(S.yo.u.rol));
    const filtros = `<div class="filtros"><a class="chip${!q.pref ? ' on' : ''}" href="#/foro/${slugCat}">${esc(T('Todos'))}</a>${c.prefijos.map(p => `<a class="chip${q.pref === p ? ' on' : ''}" href="#/foro/${slugCat}?pref=${encodeURIComponent(p)}">${esc(T(p))}</a>`).join('')}
      <span class="grow"></span><select class="field mini" data-orden>${[['actividad', 'Actividad'], ['nuevos', 'Nuevos'], ['respuestas', 'Más respuestas'], ['vistas', 'Más vistos']].map(([v, t]) => `<option value="${v}"${(q.orden || 'actividad') === v ? ' selected' : ''}>${esc(T(t))}</option>`).join('')}</select></div>`;
    pintar(migas([T('Foro'), '#/foro'], [catNombre(slugCat)]) + `<section class="box cat-cab" style="--c:${c.color}">${ico(c.icono, 44)}<div class="grow"><h1>${esc(catNombre(slugCat))}</h1><p class="sub">${esc(T((CAT_N[slugCat] || ['', ''])[1]))}</p></div>
      ${puede ? `<a class="btn gold" href="#/foro/${slugCat}/nuevo">${ico('pencil', 18)} ${esc(T('Nuevo hilo'))}</a>` : c.staff ? '' : conCuenta('')}</section>` +
      caja('', filtros + (d.hilos.length ? `<ul class="hilos">${d.hilos.map(h => `<li class="hilo${h.fijado ? ' fijado' : ''}">${pfp(us[h.uid], 44)}<div class="grow">
        <a class="hilo-t" href="#/hilo/${h.id}">${h.fijado ? ico('pin', 16) : ''}${h.cerrado ? ico('lock', 16) : ''}${h.resuelto ? ico('check', 16) : ''}${prefijo(h.prefijo)}${esc(h.titulo)}</a>
        <small>${quien(us, h.uid, { badges: false })} · ${cuando(h.creado)}</small></div>
        <div class="hilo-n"><span>${ico('chat', 14)} ${fmt(h.respuestas)}</span><span>${ico('eye', 14)} ${fmt(h.vistas)}</span></div>
        <div class="hilo-u">${h.ultimo_uid ? `${quien(us, h.ultimo_uid, { badges: false })}<small>${cuando(h.actividad)}</small>` : ''}</div></li>`).join('')}</ul>` : vacio(T('Aún no hay hilos aquí.'))) + paginador(d.pag, d.paginas, base)));
  };
  V.nuevoHilo = async slugCat => {
    const c = cat(slugCat);
    if (!c) return V.noExiste();
    if (!S.yo) return V.entrar();
    const staff = ['admin', 'mod'].includes(S.yo.u.rol);
    pintar(migas([T('Foro'), '#/foro'], [catNombre(slugCat), '#/foro/' + slugCat], [T('Nuevo hilo')]) + caja(T('Nuevo hilo en {x}', catNombre(slugCat)),
      `<form class="form" data-form="hilo" data-cat="${c.slug}">
        <label>${esc(T('Título'))}</label><input class="field" name="titulo" maxlength="120" required>
        ${c.prefijos.length ? `<label>${esc(T('Etiqueta'))}</label><div class="seg-r">${['', ...c.prefijos].map((p, i) => `<label class="chip-r"><input type="radio" name="prefijo" value="${esc(p)}"${i === 0 ? ' checked' : ''}><span>${esc(p ? T(p) : T('Ninguna'))}</span></label>`).join('')}</div>` : ''}
        <label>${esc(T('Mensaje'))}</label>${editor('texto', '', { max: S.reglas.lim.post, alto: 12 })}
        <p class="note">${ico('up', 14)} ${staff ? '' : esc(T('Puedes abrir {x} hilos al día.', (S.reglas.topeDia || {}).hilo || 2)) + ' '}${esc(T('Tu hilo suma +{x} PE cuando otra persona le responde.', S.reglas.puntos.hilo))} <a href="#/rangos">${esc(T('Cómo se ganan PE'))}</a></p>
        <div class="row end"><a class="btn ghost" href="#/foro/${c.slug}">${esc(T('Cancelar'))}</a><button class="btn gold">${esc(T('Publicar'))}</button></div></form>`, { icono: 'pencil' }));
  };
  V.hilo = async (id, q) => {
    const d = await get('/hilo/' + id, { pag: q.pag, post: q.post });
    const h = d.h, us = d.us, yo = S.yo, staff = yo && ['admin', 'mod'].includes(yo.u.rol), autor = yo && yo.u.uid === h.uid;
    const c = cat(h.cat) || { prefijos: [] };
    const base = n => `#/hilo/${id}?pag=${n}`;
    const post = (p, esSol) => {
      const mio = yo && yo.u.uid === p.uid;
      const acc = [];
      if (yo && !h.cerrado) acc.push(`<button class="btn tiny ghost" data-act="citar" data-n="${esc(us[p.uid] ? us[p.uid].n : '')}" data-id="${p.id}">${ico('quote', 14)} ${esc(T('Citar'))}</button>`);
      if ((autor || staff) && p.id !== d.primero && !esSol) acc.push(`<button class="btn tiny ghost${h.solucion === p.id ? ' on' : ''}" data-act="solucion" data-id="${p.id}">${ico('check', 14)} ${esc(h.solucion === p.id ? T('Quitar solución') : T('Es la solución'))}</button>`);
      if ((mio || staff) && p.texto != null && !p.borrado && !esSol) acc.push(`<button class="btn tiny ghost" data-act="editar-post" data-id="${p.id}">${ico('pencil', 14)} ${esc(T('Editar'))}</button>`);
      if ((mio || staff) && p.id !== d.primero && !p.borrado && !esSol) acc.push(`<button class="btn tiny ghost" data-act="borrar-post" data-id="${p.id}">${ico('trash', 14)}</button>`);
      if (yo && !mio) acc.push(`<button class="btn tiny ghost" data-act="reportar" data-obj="post" data-id="${p.id}" title="${esc(T('Reportar'))}">${ico('flag', 14)}</button>`);
      const firma = us[p.uid] && us[p.uid].firma;
      return `<article class="post${esSol ? ' sol' : ''}${p.borrado ? ' borrado' : ''}" id="p${esSol ? 'sol' : p.id}">${autorFicha(us, p.uid)}<div class="post-c">
        <div class="post-h">${esSol ? `<b class="sol-t">${ico('check', 16)} ${esc(T('Solución'))}</b>` : ''}${cuando(p.creado)}${p.editado ? ` <i class="editado">${esc(T('editado'))}</i>` : ''}${p.borrado ? ` <i class="est est-rechazada">${esc(T('borrado'))}</i>` : ''}<span class="grow"></span><a class="pid" href="#/hilo/${id}?post=${p.id}">#${p.id}</a></div>
        <div class="md" data-post="${p.id}">${p.html}</div>${p.texto != null ? `<template data-src="${p.id}">${esc(p.texto)}</template>` : ''}
        ${firma ? `<div class="firma md">${firma}</div>` : ''}
        <div class="post-f">${reacciones('post', p.id, d.reac[p.id], `#/hilo/${id}?post=${p.id}`)}<span class="grow"></span>${acc.join('')}</div></div></article>`;
    };
    const mod = staff ? `<div class="mod-bar">${ico('shield', 16)} <button class="btn tiny ghost" data-act="mod-hilo" data-a="fijar">${esc(h.fijado ? T('Desfijar') : T('Fijar'))}</button>
      <button class="btn tiny ghost" data-act="mod-hilo" data-a="cerrar">${esc(h.cerrado ? T('Abrir') : T('Cerrar'))}</button>
      <select class="field mini" data-act-change="mover">${S.reglas.categorias.map(x => `<option value="${x.slug}"${x.slug === h.cat ? ' selected' : ''}>${esc(catNombre(x.slug))}</option>`).join('')}</select>
      ${h.borrado ? `<button class="btn tiny gold" data-act="mod-hilo" data-a="restaurar">${esc(T('Restaurar'))}</button>` : `<button class="btn tiny ghost" data-act="mod-hilo" data-a="borrar">${ico('trash', 14)} ${esc(T('Borrar hilo'))}</button>`}</div>` : '';
    const pref = (autor || staff) && c.prefijos.length ? `<select class="field mini" data-act-change="prefijo"><option value="">${esc(T('Sin etiqueta'))}</option>${c.prefijos.map(p => `<option${p === h.prefijo ? ' selected' : ''} value="${esc(p)}">${esc(T(p))}</option>`).join('')}</select>` : prefijo(h.prefijo);
    pintar(migas([T('Foro'), '#/foro'], [catNombre(h.cat), '#/foro/' + h.cat], [h.titulo]) +
      `<section class="box hilo-cab" data-hilo="${id}"><h1>${h.fijado ? ico('pin', 22) : ''}${h.cerrado ? ico('lock', 22) : ''}${esc(h.titulo)}</h1>
        <div class="row">${pref}<small>${esc(T('{x} respuestas · {y} vistas', fmt(h.respuestas), fmt(h.vistas)))}</small><span class="grow"></span>
        ${yo ? `<button class="btn small ghost${d.sigo ? ' on' : ''}" data-act="seguir">${ico('bell', 16)} ${esc(d.sigo ? T('Siguiendo') : T('Seguir'))}</button>` : ''}
        ${yo && !autor ? `<button class="btn small ghost" data-act="reportar" data-obj="hilo" data-id="${id}">${ico('flag', 16)}</button>` : ''}
        ${autor && h.respuestas === 0 && !staff ? `<button class="btn small ghost" data-act="mod-hilo" data-a="borrar">${ico('trash', 16)}</button>` : ''}</div>${mod}</section>` +
      (d.sol && d.pag === 1 ? post(d.sol, true) : '') +
      `<div class="posts" data-hilo="${id}">${d.posts.map(p => post(p, false)).join('')}</div>` + paginador(d.pag, d.paginas, base) +
      (h.cerrado && !staff ? caja('', `<p class="sub">${ico('lock', 16)} ${esc(T('Este hilo está cerrado: ya no se puede responder.'))}</p>`) :
        yo ? caja(T('Responder'), `<form class="form" data-form="responder" data-hilo="${id}">${editor('texto', '', { max: S.reglas.lim.post, alto: 6 })}<div class="row end"><button class="btn gold">${ico('reply', 16)} ${esc(T('Responder'))}</button></div></form>`, { icono: 'reply', cls: 'responder' }) :
          caja('', `<div class="row">${conCuenta('')}<span class="sub">${esc(T('para responder'))}</span></div>`)));
    if (q.post) { const el = document.getElementById('p' + q.post); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('brilla'); } }
  };

  // ----- builds -----
  /** (20-11-2026) La puntuación de una build (a favor − en contra), con su flecha. */
  const puntosBuild = b => { const n = (b.arriba || 0) - (b.abajo || 0); return `<span class="bpts${n < 0 ? ' neg' : ''}">${ico(n < 0 ? 'down' : 'up', 14)} ${fmt(n)}</span>`; };
  /** Votar una build: flecha arriba o abajo (el dueño: «no caras»); pulsar otra vez la misma, la quita. */
  function votosBuild(b, mio) {
    const n = (b.arriba || 0) - (b.abajo || 0);
    return `<div class="votos fila" data-build="${b.id}"><button class="vb up${mio > 0 ? ' on' : ''}" data-act="votarb" data-v="1" title="${esc(T('A favor'))}">${ico('up', 18)}</button>
      <b class="${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${n > 0 ? '+' : ''}${fmt(n)}</b><button class="vb down${mio < 0 ? ' on' : ''}" data-act="votarb" data-v="-1" title="${esc(T('En contra'))}">${ico('down', 18)}</button>
      <small class="sub">${esc(T('{x} a favor · {y} en contra', fmt(b.arriba || 0), fmt(b.abajo || 0)))}</small></div>`;
  }
  function buildCard(b, us, { autor = true } = {}) {
    const p = D.dex.get(b.dex);
    return `<div class="bcard">${sprite(b.dex, 2)}<div class="grow"><a class="bcard-t" href="#/build/${b.id}">${esc(b.titulo)}</a>
      <div class="bcard-p">${esc(pokeNombre(b.dex))} ${p ? p.types.map(tipo).join('') : ''}</div>
      <div class="movs">${(b.movs || []).map(m => { const x = D.moves.get(m); return `<span class="mov" style="--c:${x && D.types.get(x.type) ? D.types.get(x.type).color : '#9fb1c9'}">${esc(movNombre(m))}</span>`; }).join('')}</div>
      <small>${autor ? quien(us, b.uid, { badges: false }) + ' · ' : ''}${puntosBuild(b)}${b.ncom != null ? ` · ${ico('chat', 14)} ${fmt(b.ncom)}` : ''}${b.poder ? ` · ${ico(PODER_I[b.poder], 14)}` : ''}</small></div></div>`;
  }
  V.builds = async q => {
    const d = await get('/builds', q);
    const base = n => `#/builds?${new URLSearchParams({ ...q, pag: n })}`;
    const sel = (k, opts) => `<select class="field mini" data-filtro="${k}">${opts.map(([v, t]) => `<option value="${v}"${(q[k] || '') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    pintar(migas([T('Builds')]) + `<section class="box cab"><div class="grow"><h1>${ico('tm', 30)} ${esc(T('Builds'))}</h1><p class="sub">${esc(T('Pokémon, ataques, objetos y mejoras que funcionan, explicados por quien los juega. Vota las mejores con la flecha.'))}</p></div>
      ${S.yo ? `<a class="btn gold" href="#/builds/nueva">${ico('pencil', 18)} ${esc(T('Nueva build'))}</a>` : conCuenta('')}</section>` +
      caja('', `<div class="filtros">${q.dex ? `<a class="chip on" href="#/builds">${cara(q.dex, 20)} ${esc(pokeNombre(q.dex))} ✕</a>` : ''}
        <input class="field mini" data-poke-buscar placeholder="${esc(T('Buscar Pokémon…'))}" list="dl-poke">
        ${sel('modo', [['', T('Cualquier modo')], ...S.reglas.modos.filter(Boolean).map(m => [m, T(MODO_N[m])])])}
        ${sel('poder', [['', T('Cualquier poder')], ...S.reglas.poderes.filter(Boolean).map(m => [m, T(PODER_N[m])])])}
        <span class="grow"></span>${sel('orden', [['top', T('Más votadas')], ['nuevas', T('Nuevas')], ['comentadas', T('Más comentadas')]])}</div>
        ${d.populares.length && !q.dex ? `<div class="pop">${d.populares.map(x => `<a class="chip" href="#/builds?dex=${x.dex}">${cara(x.dex, 22)} ${esc(pokeNombre(x.dex))} <b>${x.n}</b></a>`).join('')}</div>` : ''}
        ${d.builds.length ? `<div class="bgrid">${d.builds.map(b => buildCard(b, d.us)).join('')}</div>` : vacio(T('No hay builds con estos filtros.'))}${paginador(d.pag, d.paginas, base)}`) + datalistPoke());
  };
  /** «Puede haber cambiado»: novedades del juego posteriores a la build que nombran su Pokémon, sus ataques u objetos. */
  function desfase(b) {
    const desde = String(b.revisada || b.creado).slice(0, 10);
    const nombres = [pokeNombre(b.dex), ...b.movs.map(movNombre), ...b.objs.map(objNombre)].filter(n => n && n.length > 2);
    const out = [];
    for (const c of D.changelog) {
      if (c.d <= desde) continue;
      const txt = c.x.map(nm).join(' ');
      for (const n of nombres) if (new RegExp('(^|[^\\p{L}])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}])', 'iu').test(txt)) { out.push([n, c]); break; }
    }
    return out;
  }
  V.build = async id => {
    const d = await get('/build/' + id);
    const b = d.b, us = d.us, yo = S.yo, mio = yo && yo.u.uid === b.uid, staff = yo && ['admin', 'mod'].includes(yo.u.rol);
    const p = D.dex.get(b.dex);
    const df = desfase(b);
    const lista = (arr, f) => arr.length ? `<ol class="blist">${arr.map(f).join('')}</ol>` : `<p class="sub">—</p>`;
    pintar(migas([T('Builds'), '#/builds'], [b.titulo]) + `<section class="box build-cab">
      <div class="build-spr">${sprite(b.dex, 4)}</div><div class="grow"><h1>${esc(b.titulo)}</h1>
      <div class="row">${cara(b.dex, 28)}<a href="#/wiki/poke/${b.dex}"><b>${esc(pokeNombre(b.dex))}</b></a>${p ? p.types.map(tipo).join('') : ''}${b.modo ? `<i class="chip">${esc(T(MODO_N[b.modo]))}</i>` : ''}</div>
      <div class="row">${pfp(us[b.uid], 36)}${quien(us, b.uid)}<small>${cuando(b.creado)}${b.editado ? ' · ' + esc(T('editada')) : ''}</small></div>
      ${df.length ? `<div class="aviso">${esc(T('Ojo: el juego ha cambiado desde esta build ({x}). Puede que ya no funcione igual.', df.map(([n, c]) => n + ', ' + fecha(c.d + 'T12:00:00Z')).join(' · ')))}</div>` : ''}
      <div class="row">${votosBuild(b, d.mio)}<span class="grow"></span>
        ${mio || staff ? `<a class="btn small ghost" href="#/build/${b.id}/editar">${ico('pencil', 16)} ${esc(T('Editar'))}</a><button class="btn small ghost" data-act="borrar-build" data-id="${b.id}">${ico('trash', 16)}</button>` : ''}
        ${yo && !mio ? `<button class="btn small ghost" data-act="reportar" data-obj="build" data-id="${b.id}">${ico('flag', 16)}</button>` : ''}</div></div></section>
      <div class="cols build-cols"><div class="col">
        ${caja(T('Ataques'), lista(b.movs, m => { const x = D.moves.get(m) || { n: [m, m], desc: ['', ''] }; return `<li><a href="#/wiki/mov/${esc(m)}" class="mov" style="--c:${D.types.get(x.type) ? D.types.get(x.type).color : '#9fb1c9'}">${esc(nm(x.n))}</a>${x.type ? tipo(x.type) : ''}<small>${esc(nm(x.desc))}</small>${x.evo ? `<small class="evo">${ico('up', 12)} ${esc(nm(x.evo.n))}: ${esc(nm(x.evo.t))}</small>` : ''}</li>`; }), { icono: 'tm' })}
        ${caja(T('Para llevar'), lista(b.objs, o => `<li><a href="#/wiki/obj/${esc(o)}"><b>${ico(o, 18)} ${esc(objNombre(o))}</b></a><small>${esc(nm((D.items.get(o) || { desc: ['', ''] }).desc))}</small></li>`), { icono: 'bag' })}
        ${caja(T('Mejoras, en este orden'), lista(b.mejoras, u => { const x = D.ups.get(u); return `<li><b>${x ? ico(x.icon, 18) : ''} ${esc(x ? nm(x.n) : u)}</b><small>${esc(x ? nm(x.unit) : '')}</small></li>`; }), { icono: 'up' })}
        ${b.poder ? caja(T('Poder'), `<p class="row">${ico(PODER_I[b.poder], 28)} <b>${esc(T(PODER_N[b.poder]))}</b></p>`, { icono: 'star' }) : ''}
      </div><div class="col">
        ${caja(T('Cómo se juega'), `<div class="md">${b.html}</div>`, { icono: 'book' })}
        ${comentarios('build', b.id, d.coms, us, d.reacC)}
        ${d.otras.length ? caja(T('Otras builds de {x}', pokeNombre(b.dex)), `<div class="bgrid one">${d.otras.map(x => buildCard(x, us)).join('')}</div>`, { icono: 'tm' }) : ''}
      </div></div>`);
  };
  function comentarios(obj, id, coms, us, reac, extra = {}) {
    const yo = S.yo, staff = yo && ['admin', 'mod'].includes(yo.u.rol);
    return caja(T('Comentarios ({x})', coms.length), (coms.length ? `<ul class="coms">${coms.map(k => `<li class="com" id="c${k.id}">${pfp(us[k.uid], 40)}<div class="grow">
        <div class="com-h">${quien(us, k.uid)} ${rangoPill(us[k.uid] ? us[k.uid].rg : 'novato')} <small>${cuando(k.creado)}</small><span class="grow"></span>
        ${yo && (yo.u.uid === k.uid || staff || extra.muro === yo.u.uid) ? `<button class="btn tiny ghost" data-act="borrar-com" data-id="${k.id}">${ico('trash', 14)}</button>` : ''}
        ${yo && yo.u.uid !== k.uid ? `<button class="btn tiny ghost" data-act="reportar" data-obj="comentario" data-id="${k.id}">${ico('flag', 14)}</button>` : ''}</div>
        <div class="md">${k.html}</div>${obj === 'build' ? '' : reacciones('comentario', k.id, reac && reac[k.id])}</div></li>`).join('')}</ul>` : `<p class="sub">${esc(T('Aún no hay comentarios.'))}</p>`) +
      (yo ? `<form class="form" data-form="comentar" data-obj="${obj}" data-id="${esc(id)}">${editor('texto', '', { max: S.reglas.lim.comentario, alto: 3 })}<div class="row end"><button class="btn small gold">${esc(T('Comentar'))}</button></div></form>` : `<div class="row">${conCuenta('')}</div>`),
    { icono: 'chat' });
  }
  function datalistPoke() {
    return `<datalist id="dl-poke">${[...D.dex.values()].map(p => `<option value="${esc(nm(p.n))}">`).join('')}</datalist>`;
  }
  const buscaPoke = t => {
    t = String(t || '').trim().toLowerCase().replace(/^#/, '');
    if (!t) return null;
    if (/^\d+$/.test(t)) return D.dex.get(+t) || [...D.dex.values()].find(p => p.num === +t) || null;
    return [...D.dex.values()].find(p => p.n[0].toLowerCase() === t || p.n[1].toLowerCase() === t) || null;
  };
  V.buildForm = async (id, q = {}) => {
    if (!S.yo) return V.entrar();
    let b = { titulo: '', dex: D.dex.has(+q.dex) ? +q.dex : 0, movs: [], objs: [], mejoras: [], poder: '', modo: '', texto: '' };
    if (id) { const d = await get('/build/' + id); b = d.b; if (b.texto == null) return V.noExiste(); }
    const movs = [...D.moves.values()].filter(m => m.kind !== 'buff' || true).sort((a, c) => (a.type || '').localeCompare(c.type || '') || nm(a.n).localeCompare(nm(c.n)));
    const porTipo = {};
    for (const m of movs) (porTipo[m.type || 'normal'] = porTipo[m.type || 'normal'] || []).push(m);
    pintar(migas([T('Builds'), '#/builds'], [id ? T('Editar build') : T('Nueva build')]) + caja(id ? T('Editar build') : T('Nueva build'), `<form class="form build-form" data-form="build" data-id="${id || ''}">
      <div class="paso"><b>1</b> ${esc(T('Pokémon'))}</div>
      <div class="row"><div class="poke-sel" data-poke-sel>${b.dex ? sprite(b.dex, 2) : ''}</div><input class="field" name="poke" list="dl-poke" placeholder="${esc(T('Escribe un nombre o un número…'))}" value="${b.dex ? esc(pokeNombre(b.dex)) : ''}" required autocomplete="off"></div>
      <label>${esc(T('Título (si lo dejas vacío, el Pokémon y su primer ataque)'))}</label><input class="field" name="titulo" maxlength="100" value="${esc(b.titulo)}">
      <div class="paso"><b>2</b> ${esc(T('Ataques (hasta 4, en el orden en que los subes)'))}</div>
      <div class="pick" data-pick="movs" data-max="4">${Object.entries(porTipo).map(([t, ms]) => `<div class="pick-g"><div class="pick-gt">${tipo(t)}</div>${ms.map(m => `<button type="button" class="pk${b.movs.includes(m.id) ? ' on' : ''}" data-v="${m.id}" title="${esc(nm(m.desc))}">${esc(nm(m.n))}</button>`).join('')}</div>`).join('')}</div>
      <div class="pick-sel" data-sel="movs"></div>
      <div class="paso"><b>3</b> ${esc(T('Objetos para llevar (hasta 3)'))}</div>
      <div class="pick" data-pick="objs" data-max="3">${[...D.items.values()].map(o => `<button type="button" class="pk${b.objs.includes(o.id) ? ' on' : ''}" data-v="${o.id}" title="${esc(nm(o.desc))}">${ico(o.id, 16)} ${esc(nm(o.n))}</button>`).join('')}</div>
      <div class="paso"><b>4</b> ${esc(T('Mejoras, en el orden en que las subes (hasta 5)'))}</div>
      <div class="pick" data-pick="mejoras" data-max="5">${[...D.ups.values()].map(u => `<button type="button" class="pk${b.mejoras.includes(u.id) ? ' on' : ''}" data-v="${u.id}">${ico(u.icon, 16)} ${esc(nm(u.n))}</button>`).join('')}</div>
      <div class="pick-sel" data-sel="mejoras"></div>
      <div class="paso"><b>5</b> ${esc(T('Poder y modo'))}</div>
      <div class="row"><select class="field" name="poder">${S.reglas.poderes.map(p => `<option value="${p}"${b.poder === p ? ' selected' : ''}>${esc(p ? T(PODER_N[p]) : T('Sin poder'))}</option>`).join('')}</select>
        <select class="field" name="modo">${S.reglas.modos.map(p => `<option value="${p}"${b.modo === p ? ' selected' : ''}>${esc(p ? T(MODO_N[p]) : T('Cualquier modo'))}</option>`).join('')}</select></div>
      <div class="paso"><b>6</b> ${esc(T('Cómo se juega'))}</div>
      ${editor('texto', b.texto || '', { max: S.reglas.lim.build, alto: 10, ph: T('Cómo se juega, en qué orden subir los ataques, contra qué va bien…') })}
      <div class="row end">${id ? `<a class="btn ghost" href="#/build/${id}">${esc(T('Cancelar'))}</a>` : ''}<button class="btn gold">${esc(id ? T('Guardar') : T('Publicar build'))}</button></div>
      <input type="hidden" name="movs" value="${esc(b.movs.join(','))}"><input type="hidden" name="objs" value="${esc(b.objs.join(','))}"><input type="hidden" name="mejoras" value="${esc(b.mejoras.join(','))}">
    </form>`, { icono: 'tm' }) + datalistPoke());
    pintarSel();
  };
  /** Los elegidos de un selector (ataques y mejoras: en orden). */
  function pintarSel() {
    for (const k of ['movs', 'mejoras']) {
      const inp = document.querySelector(`[data-form=build] input[name=${k}]`), out = document.querySelector(`[data-sel=${k}]`);
      if (!inp || !out) continue;
      const v = inp.value ? inp.value.split(',') : [];
      out.innerHTML = v.length ? v.map((id, i) => `<span class="chip on"><b>${i + 1}</b> ${esc(k === 'movs' ? movNombre(id) : (D.ups.get(id) ? nm(D.ups.get(id).n) : id))}</span>`).join('') : '';
    }
  }

  // ----- sugerencias -----
  V.sugerencias = async q => {
    const d = await get('/sugerencias', q);
    const base = n => `#/sugerencias?${new URLSearchParams({ ...q, pag: n })}`;
    const tabs = [['', T('Abiertas')], ...S.reglas.estadosSug.map(e => [e, T(ESTADO_N[e])])];
    pintar(migas([T('Sugerencias')]) + `<section class="box cab"><div class="grow"><h1>${ico('bulb', 30)} ${esc(T('Sugerencias'))}</h1>
      <p class="sub">${esc(T('Propón ideas para el juego y vota las de los demás. Los votos de los rangos altos valen más, y las de Oro o más, mecenas y equipo salen destacadas.'))}</p></div>
      ${S.yo ? `<a class="btn gold" href="#/sugerencias/nueva">${ico('pencil', 18)} ${esc(T('Nueva sugerencia'))}</a>` : conCuenta('')}</section>` +
      caja('', `<div class="tabs">${tabs.map(([e, t]) => `<a class="tab${(q.estado || '') === e ? ' on' : ''}" href="#/sugerencias?estado=${e}">${esc(t)}${e && d.cuenta[e] ? ` <small>${d.cuenta[e]}</small>` : ''}</a>`).join('')}</div>
        <div class="filtros"><select class="field mini" data-filtro="cat"><option value="">${esc(T('Todas las categorías'))}</option>${S.reglas.catsSug.map(c => `<option value="${c}"${q.cat === c ? ' selected' : ''}>${esc(T(CATSUG_N[c]))}</option>`).join('')}</select>
        <span class="grow"></span><select class="field mini" data-filtro="orden">${[['prioridad', 'Prioridad'], ['votadas', 'Más votos a favor'], ['nuevas', 'Nuevas']].map(([v, t]) => `<option value="${v}"${(q.orden || 'prioridad') === v ? ' selected' : ''}>${esc(T(t))}</option>`).join('')}</select>
        ${S.yo ? `<small class="sub">${esc(T('Tu voto vale {x}', fmt(d.peso)))}</small>` : ''}</div>
        ${d.sugerencias.length ? `<ul class="sugs">${d.sugerencias.map(s => sugFila(s, d.us, d.mis[s.id] || 0)).join('')}</ul>` : vacio(T('No hay sugerencias aquí.'))}${paginador(d.pag, d.paginas, base)}`));
  };
  function votos(s, mio) {
    return `<div class="votos" data-sug="${s.id}"><button class="vb up${mio > 0 ? ' on' : ''}" data-act="votar" data-v="1" title="${esc(T('A favor'))}">${ico('up', 18)}</button>
      <b>${fmtVoto(s.votos)}</b><button class="vb down${mio < 0 ? ' on' : ''}" data-act="votar" data-v="-1" title="${esc(T('En contra'))}">${ico('down', 18)}</button></div>`;
  }
  const sugFila = (s, us, mio) => `<li class="sug${s.destacada ? ' dest' : ''}">${votos(s, mio)}<div class="grow"><a class="sug-t" href="#/sugerencia/${s.id}">${s.destacada ? `<i class="badge dest">${ico('star', 12)} ${esc(T('Prioritaria'))}</i>` : ''}${esc(s.titulo)}</a>
    <small>${estadoPill(s.estado)} · ${esc(T(CATSUG_N[s.cat] || s.cat))} · ${quien(us, s.uid, { badges: false })} · ${cuando(s.creado)} · ${ico('chat', 12)} ${fmt(s.ncom)}</small></div>
    <div class="sug-n"><small class="pos">▲ ${fmt(s.afavor)}</small><small class="neg">▼ ${fmt(s.encontra)}</small></div></li>`;
  V.sugerencia = async id => {
    const d = await get('/sugerencia/' + id);
    const s = d.s, us = d.us, yo = S.yo, staff = yo && ['admin', 'mod'].includes(yo.u.rol), mio = yo && yo.u.uid === s.uid;
    pintar(migas([T('Sugerencias'), '#/sugerencias'], [s.titulo]) + `<section class="box sug-cab">${votos(s, d.mio)}<div class="grow">
      <h1>${s.destacada ? `<i class="badge dest">${ico('star', 14)} ${esc(T('Prioritaria'))}</i>` : ''}${esc(s.titulo)}</h1>
      <div class="row">${estadoPill(s.estado)}<i class="chip">${esc(T(CATSUG_N[s.cat] || s.cat))}</i>${pfp(us[s.uid], 32)}${quien(us, s.uid)}<small>${cuando(s.creado)}</small></div>
      <div class="md">${s.html}</div>
      ${s.resp_html ? `<div class="respuesta"><b>${ico('shield', 16)} ${esc(T('Respuesta del equipo'))}</b>${s.resp_uid ? ` · ${quien(us, s.resp_uid)}` : ''}<div class="md">${s.resp_html}</div></div>` : ''}
      <div class="row"><small class="pos">▲ ${fmt(s.afavor)}</small><small class="neg">▼ ${fmt(s.encontra)}</small>${yo ? `<small class="sub">${esc(T('Tu voto vale {x}', fmt(d.peso)))}</small>` : ''}<span class="grow"></span>
      ${(mio && s.estado === 'pendiente') || staff ? `<button class="btn small ghost" data-act="borrar-sug" data-id="${s.id}">${ico('trash', 16)}</button>` : ''}
      ${yo && !mio ? `<button class="btn small ghost" data-act="reportar" data-obj="sugerencia" data-id="${s.id}">${ico('flag', 16)}</button>` : ''}</div></div></section>` +
      (staff ? caja(T('Responder como equipo'), `<form class="form" data-form="sug-estado" data-id="${s.id}"><select class="field" name="estado">${S.reglas.estadosSug.map(e => `<option value="${e}"${s.estado === e ? ' selected' : ''}>${esc(T(ESTADO_N[e]))}</option>`).join('')}</select>
        ${editor('respuesta', s.respuesta || '', { max: 3000, alto: 3 })}<div class="row end"><button class="btn small gold">${esc(T('Guardar'))}</button></div></form>`, { icono: 'shield' }) : '') +
      comentarios('sugerencia', s.id, d.coms, us, d.reacC));
  };
  V.nuevaSug = async () => {
    if (!S.yo) return V.entrar();
    const staff = ['admin', 'mod'].includes(S.yo.u.rol);
    pintar(migas([T('Sugerencias'), '#/sugerencias'], [T('Nueva sugerencia')]) + caja(T('Nueva sugerencia'), `<form class="form" data-form="sugerencia">
      <label>${esc(T('Título'))}</label><input class="field" name="titulo" maxlength="120" required placeholder="${esc(T('Una frase que la resuma'))}">
      <label>${esc(T('Categoría'))}</label><select class="field" name="cat">${S.reglas.catsSug.map(c => `<option value="${c}">${esc(T(CATSUG_N[c]))}</option>`).join('')}</select>
      <label>${esc(T('Explícala'))}</label>${editor('texto', '', { max: S.reglas.lim.sug, alto: 8 })}
      <p class="note">${esc(T('Antes de publicar, busca si ya la ha propuesto alguien: mejor votar esa.'))}${staff ? '' : ' ' + esc(T('Puedes publicar {x} sugerencias al día.', (S.reglas.topeDia || {}).sugerencia || 3))}</p>
      <div class="row end"><a class="btn ghost" href="#/sugerencias">${esc(T('Cancelar'))}</a><button class="btn gold">${esc(T('Publicar'))}</button></div></form>`, { icono: 'bulb' }));
  };

  // ----- wiki -----
  let resumenWiki = null;
  async function wikiResumen() { if (!resumenWiki) resumenWiki = get('/wiki/resumen').catch(() => ({ poke: {}, mov: {}, obj: {}, builds: {} })); return resumenWiki; }
  const WTABS = [['poke', 'ball', 'Pokédex'], ['mov', 'tm', 'Ataques'], ['obj', 'bag', 'Objetos'], ['paginas', 'book', 'Páginas de la comunidad']];
  const wikiTabs = act => `<div class="tabs">${WTABS.map(([k, ic, t]) => `<a class="tab${act === k ? ' on' : ''}" href="#/wiki/${k}">${ico(ic, 18)} ${esc(T(t))}</a>`).join('')}</div>`;
  V.wiki = async (sub = 'poke', q = {}) => {
    const rs = await wikiResumen();
    let cuerpo = '';
    if (sub === 'poke') {
      const t = (q.q || '').toLowerCase(), ty = q.tipo || '';
      let lista = [...D.dex.values()].filter(p => (!t || nm(p.n).toLowerCase().includes(t) || String(p.num) === t) && (!ty || p.types.includes(ty)) && (!q.gen || p.gen === +q.gen));
      if (q.con === '1') lista = lista.filter(p => rs.poke[p.id] || rs.builds[p.id]);
      cuerpo = `<form class="filtros" data-form="filtro-wiki" data-sub="poke"><input class="field mini" name="q" value="${esc(q.q || '')}" placeholder="${esc(T('Nombre o número…'))}">
        <select class="field mini" name="tipo"><option value="">${esc(T('Todos los tipos'))}</option>${[...D.types.values()].map(x => `<option value="${x.id}"${ty === x.id ? ' selected' : ''}>${esc(nm(x.n))}</option>`).join('')}</select>
        <select class="field mini" name="gen"><option value="">${esc(T('Todas las regiones'))}</option>${['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'].map((r, i) => `<option value="${i + 1}"${+q.gen === i + 1 ? ' selected' : ''}>${esc(T(r))}</option>`).join('')}</select>
        <label class="chip-r"><input type="checkbox" name="con" value="1"${q.con === '1' ? ' checked' : ''}><span>${esc(T('Con consejos o builds'))}</span></label><button class="btn small">${ico('search', 16)}</button></form>
        <p class="sub">${esc(T('{x} Pokémon', fmt(lista.length)))}</p>
        <div class="dexgrid">${lista.slice(0, 400).map(p => `<a class="dexc" href="#/wiki/poke/${p.id}">${cara(p.id, 48)}<small>#${p.num}</small><b>${esc(nm(p.n))}</b>
          ${rs.poke[p.id] || rs.builds[p.id] ? `<i class="dexc-n">${rs.poke[p.id] ? ico('bulb', 12) + rs.poke[p.id] : ''}${rs.builds[p.id] ? ico('tm', 12) + rs.builds[p.id] : ''}</i>` : ''}</a>`).join('')}</div>
        ${lista.length > 400 ? `<p class="sub">${esc(T('Hay más: busca por nombre o filtra por tipo o región.'))}</p>` : ''}`;
    } else if (sub === 'mov') {
      const t = (q.q || '').toLowerCase();
      const lista = [...D.moves.values()].filter(m => !t || nm(m.n).toLowerCase().includes(t)).sort((a, b) => (a.type || '').localeCompare(b.type || '') || nm(a.n).localeCompare(nm(b.n)));
      cuerpo = `<form class="filtros" data-form="filtro-wiki" data-sub="mov"><input class="field mini" name="q" value="${esc(q.q || '')}" placeholder="${esc(T('Buscar ataque…'))}"><button class="btn small">${ico('search', 16)}</button></form>
        <ul class="wlist">${lista.map(m => `<li><a href="#/wiki/mov/${esc(m.id)}" class="mov" style="--c:${D.types.get(m.type) ? D.types.get(m.type).color : '#9fb1c9'}">${esc(nm(m.n))}</a>${tipo(m.type)}<small>${esc(nm(m.desc))}</small>${rs.mov[m.id] ? `<i class="dexc-n">${ico('bulb', 12)}${rs.mov[m.id]}</i>` : ''}</li>`).join('')}</ul>`;
    } else if (sub === 'obj') {
      cuerpo = `<ul class="wlist">${[...D.items.values()].map(o => `<li><a href="#/wiki/obj/${esc(o.id)}"><b>${ico(o.id, 20)} ${esc(nm(o.n))}</b></a><small>${esc(nm(o.desc))}</small>${rs.obj[o.id] ? `<i class="dexc-n">${ico('bulb', 12)}${rs.obj[o.id]}</i>` : ''}</li>`).join('')}</ul>`;
    } else {
      const d = await get('/wiki/paginas');
      cuerpo = `<div class="row"><p class="sub grow">${esc(T('Guías y artículos escritos por la comunidad. Crear páginas se desbloquea en Plata; cada página la edita sólo quien la creó.'))}</p>
        ${S.yo && S.yo.puede.crear_pagina ? `<a class="btn small gold" href="#/wiki/nueva">${ico('pencil', 16)} ${esc(T('Nueva página'))}</a>` : ''}</div>
        ${d.paginas.length ? `<ul class="filas">${d.paginas.map(p => `<li class="fila"><span class="fila-i">${ico('book', 26)}</span><div class="grow"><a class="fila-t" href="#/wiki/p/${esc(p.slug)}">${esc(p.titulo)}</a>
          <small>${quien(d.us, p.ultimo || p.uid, { badges: false })} · ${cuando(p.actual)} · ${esc(T('{x} versiones', p.versiones))}</small></div></li>`).join('')}</ul>` : vacio(T('Aún no hay páginas.'))}
        <p class="sub">${esc(T('Las guías oficiales están en la web:'))} <a href="../guias/">${esc(T('Guías de PokéSurvivor'))}</a></p>`;
    }
    pintar(migas([T('Wiki')]) + `<section class="box cab"><div class="grow"><h1>${ico('book', 30)} ${esc(T('Wiki'))}</h1><p class="sub">${esc(T('Los datos del juego, con los consejos y las builds de la comunidad.'))}</p></div></section>` + caja('', wikiTabs(sub) + cuerpo));
  };
  async function consejosCaja(ent, clave) {
    const d = await get(`/consejos/${ent}/${encodeURIComponent(clave)}`);
    const yo = S.yo, staff = yo && ['admin', 'mod'].includes(yo.u.rol);
    return caja(T('Consejos de la comunidad'), (d.consejos.length ? `<ul class="coms">${d.consejos.map(k => `<li class="com">${pfp(d.us[k.uid], 40)}<div class="grow"><div class="com-h">${quien(d.us, k.uid)}<small>${cuando(k.creado)}</small><span class="grow"></span>
      ${yo && (yo.u.uid === k.uid || staff) ? `<button class="btn tiny ghost" data-act="borrar-consejo" data-id="${k.id}">${ico('trash', 14)}</button>` : ''}
      ${yo && yo.u.uid !== k.uid ? `<button class="btn tiny ghost" data-act="reportar" data-obj="consejo" data-id="${k.id}">${ico('flag', 14)}</button>` : ''}</div>
      <div class="md">${k.html}</div>${reacciones('consejo', k.id, d.reac[k.id])}</div></li>`).join('')}</ul>` : `<p class="sub">${esc(T('Aún no hay consejos. ¿Sabes algo útil? Cuéntalo.'))}</p>`) +
      (yo ? `<form class="form" data-form="consejo" data-ent="${ent}" data-clave="${esc(clave)}">${editor('texto', '', { max: S.reglas.lim.consejo, alto: 3, ph: T('Un consejo corto y útil…') })}<div class="row end"><button class="btn small gold">${esc(T('Añadir consejo'))}</button></div></form>` : `<div class="row">${conCuenta('')}</div>`), { icono: 'bulb' }) +
      (d.builds.length ? caja(T('Builds'), `<div class="bgrid one">${d.builds.map(b => buildCard(b, d.us)).join('')}</div>`, { icono: 'tm', extra: ent === 'poke' ? `<a class="btn small ghost" href="#/builds?dex=${clave}">${esc(T('Ver todas'))}</a>` : `<a class="btn small ghost" href="#/builds?${ent}=${encodeURIComponent(clave)}">${esc(T('Ver todas'))}</a>` }) : '');
  }
  V.poke = async id => {
    const p = D.dex.get(+id);
    if (!p) return V.noExiste();
    const formas = [...D.dex.values()].filter(x => x.num === p.num && x.id !== p.id);
    pintar(migas([T('Wiki'), '#/wiki'], [T('Pokédex'), '#/wiki/poke'], [nm(p.n)]) + `<section class="box poke-cab"><div class="poke-spr">${sprite(p.id, 4)}</div><div class="grow">
      <h1>${esc(nm(p.n))} <small>#${p.num}</small></h1><div class="row">${p.types.map(tipo).join('')}${p.leg ? `<i class="chip">${ico('crown', 14)} ${esc(T('Legendario o singular'))}</i>` : ''}${p.st ? `<i class="chip">${ico('sprout', 14)} ${esc(T('Inicial'))}</i>` : ''}</div>
      ${formas.length ? `<div class="row">${formas.map(f => `<a class="chip" href="#/wiki/poke/${f.id}">${cara(f.id, 20)} ${esc(nm(f.n))}</a>`).join('')}</div>` : ''}
      <div class="row">${S.yo ? `<a class="btn small gold" href="#/builds/nueva?dex=${p.id}">${ico('pencil', 16)} ${esc(T('Publicar una build'))}</a>` : ''}<a class="btn small ghost" href="../pokedex/">${esc(T('Su ficha en la web'))}</a></div></div></section>` +
      await consejosCaja('poke', String(p.id)));
  };
  V.mov = async id => {
    const m = D.moves.get(id);
    if (!m) return V.noExiste();
    pintar(migas([T('Wiki'), '#/wiki'], [T('Ataques'), '#/wiki/mov'], [nm(m.n)]) + `<section class="box"><h1><span class="mov big" style="--c:${D.types.get(m.type) ? D.types.get(m.type).color : '#9fb1c9'}">${esc(nm(m.n))}</span> ${tipo(m.type)}</h1>
      <p>${esc(nm(m.desc))}</p>${m.evo ? `<p class="evo">${ico('up', 16)} <b>${esc(nm(m.evo.n))}</b> (${esc(T('con {x}', nm(m.evo.needs)))}): ${esc(nm(m.evo.t))}</p>` : ''}</section>` + await consejosCaja('mov', m.id));
  };
  V.obj = async id => {
    const o = D.items.get(id);
    if (!o) return V.noExiste();
    pintar(migas([T('Wiki'), '#/wiki'], [T('Objetos'), '#/wiki/obj'], [nm(o.n)]) + `<section class="box"><h1>${ico(o.id, 32)} ${esc(nm(o.n))}</h1><p>${esc(nm(o.desc))}</p></section>` + await consejosCaja('obj', o.id));
  };
  V.pagina = async (s, q) => {
    const d = await get('/wiki/p/' + encodeURIComponent(s), { rev: q.rev });
    const p = d.p, r = d.r, vieja = r.id !== d.ultima;
    pintar(migas([T('Wiki'), '#/wiki'], [T('Páginas de la comunidad'), '#/wiki/paginas'], [p.titulo]) + `<section class="box pagina"><div class="row"><h1 class="grow">${esc(p.titulo)}</h1>
      ${d.puedeEditar ? `<a class="btn small ghost" href="#/wiki/p/${esc(p.slug)}/editar">${ico('pencil', 16)} ${esc(T('Editar'))}</a>` : ''}
      <a class="btn small ghost" href="#/wiki/p/${esc(p.slug)}/historial">${ico('clock', 16)} ${esc(T('Historial'))}</a>
      ${S.yo ? `<button class="btn small ghost" data-act="reportar" data-obj="pagina" data-id="${esc(p.slug)}">${ico('flag', 16)}</button>` : ''}
      ${S.yo && ['admin', 'mod'].includes(S.yo.u.rol) ? `<button class="btn small ghost" data-act="borrar-pagina" data-id="${esc(p.slug)}">${ico('trash', 16)}</button>` : ''}</div>
      ${vieja ? `<div class="aviso">${esc(T('Estás viendo una versión antigua ({x}).', fecha(r.creado)))} <a href="#/wiki/p/${esc(p.slug)}">${esc(T('Ver la actual'))}</a>
        ${d.puedeEditar ? `<button class="btn tiny gold" data-act="revertir" data-slug="${esc(p.slug)}" data-rev="${r.id}">${esc(T('Volver a esta versión'))}</button>` : ''}</div>` : ''}
      <small class="sub">${esc(T('Última edición'))}: ${quien(d.us, r.uid)} · ${cuando(r.creado)}${r.resumen ? ' · «' + esc(r.resumen) + '»' : ''}</small>
      <div class="md">${r.html}</div></section>`);
  };
  V.paginaForm = async s => {
    if (!S.yo) return V.entrar();
    let titulo = '', texto = '';
    if (s) {
      const d = await get('/wiki/p/' + encodeURIComponent(s));
      if (!d.puedeEditar) { pintar(caja('', `<p>${esc(T('Sólo quien creó la página puede editarla.'))}</p>`)); return; }
      titulo = d.p.titulo; texto = d.r.texto || '';
    } else if (!S.yo.puede.crear_pagina) { pintar(caja('', `<p>${esc(T('Crear páginas se desbloquea en el rango Plata.'))}</p><a class="btn" href="#/rangos">${esc(T('Ver los rangos'))}</a>`)); return; }
    pintar(migas([T('Wiki'), '#/wiki'], [T('Páginas de la comunidad'), '#/wiki/paginas'], [s ? titulo : T('Nueva página')]) + caja(s ? T('Editar «{x}»', titulo) : T('Nueva página'), `<form class="form" data-form="pagina" data-slug="${esc(s || '')}">
      ${s ? '' : `<label>${esc(T('Título'))}</label><input class="field" name="titulo" maxlength="80" required>`}
      ${editor('texto', texto, { max: S.reglas.lim.pagina, alto: 20 })}
      ${s ? `<label>${esc(T('Qué has cambiado (opcional)'))}</label><input class="field" name="resumen" maxlength="200">` : ''}
      <div class="row end"><a class="btn ghost" href="${s ? '#/wiki/p/' + esc(s) : '#/wiki/paginas'}">${esc(T('Cancelar'))}</a><button class="btn gold">${esc(T('Guardar'))}</button></div></form>`, { icono: 'book' }));
  };
  V.historial = async s => {
    const d = await get('/wiki/p/' + encodeURIComponent(s) + '/historial');
    pintar(migas([T('Wiki'), '#/wiki'], [d.p.titulo, '#/wiki/p/' + d.p.slug], [T('Historial')]) + caja(T('Historial de «{x}»', d.p.titulo), `<ul class="filas">${d.revs.map((r, i) => `<li class="fila">
      <div class="grow"><a class="fila-t" href="#/wiki/p/${esc(d.p.slug)}?rev=${r.id}">${esc(fecha(r.creado))} · ${esc(new Date(r.creado).toLocaleTimeString(LANG === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }))}</a>
      <small>${quien(d.us, r.uid)} · ${esc(T('{x} letras', fmt(r.largo)))}${r.resumen ? ' · «' + esc(r.resumen) + '»' : ''}${i === 0 ? ' · <b>' + esc(T('actual')) + '</b>' : ''}</small></div></li>`).join('')}</ul>`, { icono: 'clock' }));
  };

  // ----- personas -----
  V.perfil = async (nombre, q) => {
    const d = await get('/u/' + encodeURIComponent(nombre), { tab: q.tab });
    const p = d.perfil, us = d.us, yo = S.yo;
    const sig = p.sig ? S.reglas.rangos.find(r => r.id === p.sig) : null;
    const tabs = [['muro', 'Muro'], ['mensajes', 'Mensajes'], ['builds', 'Builds'], ['puntos', 'Puntos']];
    let cuerpo = '';
    if (d.tab === 'muro') cuerpo = comentarios('perfil', p.n, d.d.coms, us, d.d.reacC, { muro: p.yo ? yo.u.uid : null });
    else if (d.tab === 'mensajes') cuerpo = caja('', d.d.posts.length ? `<ul class="filas">${d.d.posts.map(x => `<li class="fila"><div class="grow"><a class="fila-t" href="#/hilo/${x.hilo}?post=${x.id}">${esc(x.titulo)}</a><small>${esc(catNombre(x.cat))} · ${cuando(x.creado)}</small><p class="cita-corta">${esc(x.texto)}</p></div></li>`).join('')}</ul>` : vacio(T('Aún no ha escrito nada.')));
    else if (d.tab === 'builds') cuerpo = caja('', d.d.builds.length ? `<div class="bgrid">${d.d.builds.map(b => buildCard(b, {}, { autor: false })).join('')}</div>` : vacio(T('Aún no ha publicado builds.')));
    else cuerpo = caja('', `<table class="tabla"><tbody>${d.d.log.map(x => `<tr><td>${cuando(x.creado)}</td><td>${esc(T(MOTIVO_N[x.motivo] || x.motivo))}</td><td class="num ${x.puntos > 0 ? 'pos' : 'neg'}">${x.puntos > 0 ? '+' : ''}${x.puntos}</td></tr>`).join('')}</tbody></table>`);
    pintar(migas([T('Miembros'), '#/miembros'], [p.n]) + `<section class="box perfil-cab">${pfp(p, 128)}<div class="grow">
      <h1 class="${rangoI(p.rg) >= 5 ? 'dorado' : ''}">${quien({ x: p }, 'x')}</h1>
      <div class="row">${rangoPill(p.rg)}${p.t ? `<i class="titulo-med">${esc(medallaTitulo(p.t))}</i>` : ''}${p.ban ? `<i class="est est-rechazada">${esc(T('Baneado en el juego'))}</i>` : ''}${p.suspendido ? `<i class="est est-rechazada">${esc(T('Suspendido hasta el {x}', fecha(p.suspendido.hasta)))}</i>` : ''}</div>
      <div class="barra"><i style="width:${p.pct}%"></i></div><small>${sig ? esc(T('{x} PE · faltan {y} para {z}', fmt(p.pe), fmt(sig.pe - p.pe), rangoNombre(sig.id))) : esc(T('{x} PE · ¡rango máximo!', fmt(p.pe)))}</small>
      ${p.bio_html ? `<div class="md bio">${p.bio_html}</div>` : ''}
      <div class="row">${p.yo ? `<a class="btn small ghost" href="#/ajustes">${ico('gear', 16)} ${esc(T('Editar mi perfil'))}</a>` : yo ? `<button class="btn small ghost" data-act="reportar" data-obj="perfil" data-id="${esc(p.n)}">${ico('flag', 16)}</button>` : ''}
      ${yo && ['admin', 'mod'].includes(yo.u.rol) && !p.yo ? `<a class="btn small ghost" href="#/panel?u=${esc(p.n)}">${ico('shield', 16)} ${esc(T('Moderar'))}</a>` : ''}</div></div>
      <div class="pstats">${[['chat', d.st.mensajes, 'mensajes'], ['news', d.st.hilos, 'hilos'], ['tm', d.st.builds, 'builds'], ['check', d.st.soluciones, 'soluciones'], ['bolt', d.st.supers, 'supereficaces'], ['clock', p.racha, 'días de racha']].map(([ic, n, t]) => `<div>${ico(ic, 18)}<b>${fmt(n)}</b><small>${esc(T(t))}</small></div>`).join('')}
        <small class="sub">${esc(T('En el foro desde el {x}', fecha(p.creado)))}${p.ultima_vez ? ' · ' + esc(T('visto {x}', hace(p.ultima_vez))) : ''}</small></div></section>` +
      caja(T('Medallas ({x})', d.medallas.length), d.medallas.length ? `<div class="medallas">${d.medallas.map(m => `<div class="medalla" title="${esc(medallaReq(m.clave))}">${ico(medallaIcono(m.clave), 32)}<b>${esc(medallaNombre(m.clave))}</b><small>${esc(fecha(m.creado))}</small></div>`).join('')}</div>` : `<p class="sub">${esc(T('Aún ninguna.'))}</p>`, { icono: 'medal3' }) +
      `<div class="tabs">${tabs.map(([k, t]) => `<a class="tab${d.tab === k ? ' on' : ''}" href="#/u/${esc(p.n)}?tab=${k}">${esc(T(t))}</a>`).join('')}</div>` + cuerpo);
  };
  /** (20-11-2026) Lo que limita cada forma de ganar PE (reglas.mjs MAX_DIA y las condiciones de foro.mjs). */
  function limitePe(R, k) {
    const n = (R.maxDia || {})[k], dia = n ? (n === 1 ? T('una al día') : T('{x} al día', n)) : '';
    const cond = { hilo: T('cuando otra persona responde'), respuesta: T('en hilos de otros, una por hilo'), comentario: T('en lo de otros'),
      edicion_wiki: T('si cambias {x} letras o más, una por página', R.wikiMinCambio || 100), solucion: T('la elige quien abrió el hilo'), sug_aceptada: T('la acepta el equipo') }[k] || '';
    const t = [cond, dia].filter(Boolean).join(' · ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }
  const MOTIVO_N = { hilo: 'Hilo nuevo', respuesta: 'Respuesta', build: 'Build', consejo: 'Consejo en la wiki', edicion_wiki: 'Edición en la wiki', pagina_wiki: 'Página nueva en la wiki',
    sugerencia: 'Sugerencia', comentario: 'Comentario', visita: 'Visita del día', solucion: 'Solución elegida', sug_aceptada: 'Sugerencia aceptada', reaccion: 'Reacción', ajuste: 'Ajuste del equipo' };
  V.miembros = async q => {
    const d = await get('/miembros', q);
    pintar(migas([T('Miembros')]) + `<div class="cols"><div class="col">` + caja(T('Miembros'), `<form class="filtros" data-form="filtro" data-ruta="miembros"><input class="field mini" name="q" value="${esc(q.q || '')}" placeholder="${esc(T('Buscar apodo…'))}">
      <select class="field mini" name="orden">${[['pe', 'Más PE'], ['mensajes', 'Más mensajes'], ['racha', 'Mejor racha'], ['nuevos', 'Nuevos']].map(([v, t]) => `<option value="${v}"${(q.orden || 'pe') === v ? ' selected' : ''}>${esc(T(t))}</option>`).join('')}</select><button class="btn small">${ico('search', 16)}</button></form>
      <ol class="miembros">${d.lista.map((x, i) => `<li>${q.orden && q.orden !== 'pe' ? '' : `<b class="pos p${i + 1}">${i + 1}</b>`}${pfp(d.us[x.uid], 40)}<div class="grow">${quien(d.us, x.uid)}<small>${rangoPill(d.us[x.uid].rg)} · ${esc(T('{x} mensajes', fmt(x.np)))} · ${esc(T('{x} medallas', x.nm))}${x.racha > 1 ? ' · ' + esc(T('racha {x}', x.racha)) : ''}</small></div><b>${fmt(d.us[x.uid].pe)} PE</b></li>`).join('')}</ol>`, { icono: 'friends' }) +
      `</div><div class="col">` + caja(T('Top del mes'), d.top.length ? `<ol class="toplist">${d.top.map((x, i) => `<li><b class="pos p${i + 1}">${i + 1}</b>${pfp(d.us[x.uid], 32)}${quien(d.us, x.uid)}<span class="grow"></span><b>${fmt(x.pm)}</b></li>`).join('')}</ol>` : vacio(T('Nadie todavía.')), { icono: 'trophy' }) +
      caja(T('Equipo'), `<ul class="equipo">${d.equipo.map(u => `<li>${pfp(d.us[u], 36)}${quien(d.us, u)}</li>`).join('')}</ul>`, { icono: 'shield' }) + `</div></div>`);
  };
  /** (20-11-2026) El premio exclusivo del Maestro: la skin (su primer fotograma, como en el juego) y su nombre. */
  function skinMaestro(R) {
    const i = R.premioMaestroInfo;
    if (!R.premioMaestro || !i) return ` <span>${ico('star', 14)} ${esc(T('y un cosmético exclusivo (pronto)'))}</span>`;
    return `<div class="skin-prem"><span class="spr" style="width:${i.w * 2}px;height:${i.h * 2}px"><img src="../assets/pokemon/${+i.dex}/k-${esc(i.skin)}/Idle.png" alt="" style="transform:scale(2)" loading="lazy"></span>
      <span>${ico('star', 14)} ${esc(T('y la skin exclusiva {x}, que no se vende en la tienda', T(i.nombre)))}</span></div>`;
  }
  V.rangos = async () => {
    const d = await get('/rangos');
    const R = S.reglas, yo = S.yo;
    const DESBLOQ = { novato: 'Publicar, reaccionar y votar (tu voto cuenta la mitad).', bronce: 'Firma en tus mensajes e imágenes en lo que escribes.',
      plata: 'Crear páginas en la wiki.', oro: 'Tus sugerencias son prioritarias y tu voto vale doble.',
      ultra: 'Tu marco del juego, animado en el foro.', maestro: 'Nombre dorado brillante y tu voto en sugerencias vale triple.' };
    const tengo = new Set(d.tengo), dado = new Set(d.premios.filter(p => p.dado).map(p => p.ref));
    pintar(migas([T('Rangos y premios')]) + caja(T('Rangos y premios'), `<p class="sub">${esc(T('Participar da Puntos de Exploración (PE). Con los PE subes de rango, y cada rango y cada medalla te dan tickets del gacha en el juego (una sola vez). Los tickets llegan solos a tu partida en unos minutos.'))}</p>
      <div class="rangos">${R.rangos.map((r, i) => `<div class="rango-c${yo && rangoI(yo.u.rg) >= i ? ' tengo' : ''}" style="--c:${r.color}"><div class="rango-h">${rangoPill(r.id)}<b>${fmt(r.pe)} PE</b></div>
        <p>${esc(T(DESBLOQ[r.id]))}</p><div class="premio">${r.premio ? premioTxt(r.premio) + (r.id === 'maestro' ? skinMaestro(R) : '') : `<small>${esc(T('Sin premio'))}</small>`}${yo && dado.has('rango:' + r.id) ? ` ${ico('check', 14)}` : ''}</div>
        <small>${esc(T('{x} miembros', fmt(d.reparto[r.id] || 0)))}</small></div>`).join('')}</div>`, { icono: 'trophy' }) +
      caja(T('Cómo se ganan PE'), `<p>${esc(T('Un hilo suma sus PE cuando otra persona le responde: abrir hilos que nadie contesta no da nada (y si se borran todas las respuestas de los demás, se van). Como mucho {x} hilos al día suman PE.', (R.maxDia || {}).hilo || 3))}</p>
        <table class="tabla"><tbody>${Object.entries(R.puntos).map(([k, v]) => `<tr><td>${esc(T(MOTIVO_N[k] || k))}${limitePe(R, k) ? `<br><small class="sub">${esc(limitePe(R, k))}</small>` : ''}</td><td class="num pos">+${v}</td></tr>`).join('')}
        <tr><td>${ico('bolt', 14)} ${esc(T('Te dan «¡Es supereficaz!» o votan a favor de tu build'))}</td><td class="num pos">+${R.reacciones.super}</td></tr><tr><td>${ico('bulb', 14)} ${ico('laugh', 14)} ${esc(T('Te dan «Útil» o «Me ha hecho gracia»'))}</td><td class="num pos">+${R.reacciones.util}</td></tr></tbody></table>
        <p class="note">${esc(T('Los días cuentan con la hora de España. Lo que te dan los demás, como mucho {x} PE al día (y {y} de una misma persona). Si se borra algo por saltarse las normas, se van sus PE.', R.topeRecibido, R.topePareja))}</p>`, { icono: 'up' }) +
      caja(T('Medallas'), `<div class="medallas">${Object.keys(R.medallas).map(k => `<div class="medalla${tengo.has(k) ? '' : ' no'}">${ico(medallaIcono(k), 32)}<b>${esc(medallaNombre(k))}</b><small>${esc(medallaReq(k))}</small>
        <small class="titulo-med">${esc(T('Título: «{x}»', medallaTitulo(k)))}</small>${R.medallas[k].premio ? `<span class="premio-mini">${premioTxt(R.premioMedalla)}${tengo.has(k) ? ' ' + ico('check', 12) : ''}</span>` : ''}</div>`).join('')}</div>`, { icono: 'medal3' }));
  };
  V.ajustes = async () => {
    if (!S.yo) return V.entrar();
    const yo = S.yo;
    pintar(migas([T('Ajustes')]) + caja(T('Tu perfil en el foro'), `<form class="form" data-form="ajustes">
      <div class="row">${pfp(yo.u, 96)}<p class="sub grow">${esc(T('Tu foto, tu marco y tu apodo son los del juego: cámbialos en el juego (Perfil) y saldrán aquí.'))}</p></div>
      <label>${esc(T('Título (de tus medallas)'))}</label><select class="field" name="titulo"><option value="">${esc(T('Sin título'))}</option>${yo.medallas.map(k => `<option value="${k}"${yo.u.t === k ? ' selected' : ''}>${esc(medallaTitulo(k))}</option>`).join('')}</select>
      <label>${esc(T('Sobre ti'))}</label>${editor('bio', yo.u.bio || '', { max: S.reglas.lim.bio, alto: 4 })}
      <label>${esc(T('Firma (sale debajo de tus mensajes; desde Bronce)'))}</label>${yo.puede.firma ? editor('firma', yo.u.firma || '', { max: S.reglas.lim.firma, alto: 2 }) : `<p class="sub">${esc(T('Se desbloquea en el rango Bronce.'))}</p>`}
      ${yo.u.mecenas ? `<label class="chip-r mec-vis"><input type="checkbox" name="mecenas_visible" value="1"${yo.u.mecenasVisible ? ' checked' : ''}><span>${ico('heart', 14)} ${esc(T('Que se vea que apoyo el proyecto (insignia, medalla y lista de mecenas)'))}</span></label>` : ''}
      <div class="row end"><button class="btn gold">${esc(T('Guardar'))}</button></div></form>`, { icono: 'gear' }) +
      caja(T('Sesión'), `<p class="sub">${esc(T('Entraste con tu cuenta del juego. Salir aquí también te saca del juego en este navegador.'))}</p><button class="btn small ghost" data-act="salir">${esc(T('Salir'))}</button>`));
  };
  const AVISO_T = {
    respuesta: d => T('{x} ha respondido en «{y}»', d.n, d.t), mencion: d => T('{x} te ha mencionado en «{y}»', d.n, d.que),
    super: d => T('A {x} le ha parecido supereficaz lo que escribiste (+{y} PE)', d.n, d.pe), solucion: d => T('¡Tu respuesta es la solución de «{x}»!', d.t),
    rango: d => T('¡Has subido a rango {x}!', rangoNombre(d.r)), medalla: d => T('Nueva medalla: {x}. Ya puedes ponerte su título.', medallaNombre(d.m)),
    premio: d => T('Premio para el juego: {x}. Llegará a tu partida en unos minutos.', [d.t1 ? T('{x} tickets', d.t1) : '', d.t10 ? T('{x} tickets ×10', d.t10) : '', d.cosas ? T('un cosmético') : ''].filter(Boolean).join(' + ')),
    comentario: d => (d.obj === 'perfil' ? T('{x} ha escrito en tu muro', d.n) : d.obj === 'build' ? T('{x} ha comentado tu build «{y}»', d.n, d.t) : T('{x} ha comentado tu sugerencia «{y}»', d.n, d.t)),
    sug_estado: d => T('Tu sugerencia «{x}» ahora está: {y}', d.t, T(ESTADO_N[d.e] || d.e)), reporte: d => T('Nuevo reporte de {x}', d.n),
    suspendido: d => T('Te han suspendido en el foro {x} días.', d.dias) + (d.motivo ? ' ' + T('Motivo: {x}', d.motivo) : ''), levantado: () => T('Ya no estás suspendido en el foro.'),
    voto_build: d => T('A {x} le ha gustado tu build «{y}» (+{z} PE)', d.n, d.t, d.pe),
    mecenas: d => T('¡Gracias por apoyar el proyecto! Ya eres mecenas.') + (d.visible ? '' : ' ' + T('Tu insignia está oculta: puedes enseñarla en Ajustes.'))
  };
  const AVISO_I = { respuesta: 'reply', mencion: 'chat', super: 'bolt', solucion: 'check', rango: 'trophy', medalla: 'medal3', premio: 'ticket', comentario: 'chat', sug_estado: 'bulb', reporte: 'flag', suspendido: 'lock', levantado: 'lock', mecenas: 'heart', voto_build: 'up' };
  V.avisos = async () => {
    if (!S.yo) return V.entrar();
    const d = await get('/avisos');
    pintar(migas([T('Avisos')]) + caja(T('Avisos'), d.avisos.length ? `<ul class="avisos">${d.avisos.map(a => `<li class="${a.leido ? '' : 'nuevo'}">${ico(AVISO_I[a.tipo] || 'bell', 22)}
      <div class="grow">${a.url ? `<a href="${esc(/^#\//.test(a.url) ? a.url : '#/')}">` : '<span>'}${esc((AVISO_T[a.tipo] || (() => a.tipo))(a.datos || {}))}${a.url ? '</a>' : '</span>'}<small>${cuando(a.creado)}</small></div></li>`).join('')}</ul>` : vacio(T('No tienes avisos.')), { icono: 'bell' }));
    if (d.avisos.some(a => !a.leido)) { post('/avisos/leidos').catch(() => {}); S.avisos = 0; pintarMarco(); }
  };
  V.buscar = async q => {
    const t = (q.q || '').trim();
    const d = t.length >= 2 ? await get('/buscar', { q: t }) : { q: t };
    const tl = t.toLowerCase();
    const pk = t.length >= 2 ? [...D.dex.values()].filter(p => nm(p.n).toLowerCase().includes(tl)).slice(0, 12) : [];
    const mv = t.length >= 2 ? [...D.moves.values()].filter(m => nm(m.n).toLowerCase().includes(tl)).slice(0, 12) : [];
    const ob = t.length >= 2 ? [...D.items.values()].filter(o => nm(o.n).toLowerCase().includes(tl)).slice(0, 12) : [];
    const sec = (titulo, html, n) => (n ? caja(titulo, html) : '');
    pintar(migas([T('Buscar')]) + caja(T('Buscar'), `<form class="filtros" data-form="filtro" data-ruta="buscar"><input class="field" name="q" value="${esc(t)}" placeholder="${esc(T('Hilos, builds, sugerencias, miembros, Pokémon…'))}" autofocus><button class="btn">${ico('search', 18)}</button></form>
      ${t.length >= 2 && !(d.hilos || []).length && !(d.builds || []).length && !(d.sugerencias || []).length && !(d.usuarios || []).length && !(d.paginas || []).length && !pk.length && !mv.length && !ob.length ? vacio(T('Nada con «{x}».', t)) : ''}`, { icono: 'search' }) +
      sec(T('Hilos'), `<ul class="filas">${(d.hilos || []).map(h => `<li class="fila"><div class="grow"><a class="fila-t" href="#/hilo/${h.id}">${esc(h.titulo)}</a><small>${esc(catNombre(h.cat))} · ${quien(d.us, h.uid, { badges: false })} · ${cuando(h.actividad)}</small></div></li>`).join('')}</ul>`, (d.hilos || []).length) +
      sec(T('Builds'), `<div class="bgrid">${(d.builds || []).map(b => buildCard(b, d.us)).join('')}</div>`, (d.builds || []).length) +
      sec(T('Sugerencias'), `<ul class="filas">${(d.sugerencias || []).map(s => `<li class="fila"><span class="voto-n">${fmtVoto(s.votos)}</span><div class="grow"><a class="fila-t" href="#/sugerencia/${s.id}">${esc(s.titulo)}</a><small>${estadoPill(s.estado)}</small></div></li>`).join('')}</ul>`, (d.sugerencias || []).length) +
      sec(T('Páginas de la wiki'), `<ul class="filas">${(d.paginas || []).map(p => `<li class="fila"><a class="fila-t" href="#/wiki/p/${esc(p.slug)}">${esc(p.titulo)}</a></li>`).join('')}</ul>`, (d.paginas || []).length) +
      sec(T('Miembros'), `<ul class="equipo">${(d.usuarios || []).map(u => `<li>${pfp(d.us[u], 36)}${quien(d.us, u)}</li>`).join('')}</ul>`, (d.usuarios || []).length) +
      sec(T('Pokémon'), `<div class="dexgrid">${pk.map(p => `<a class="dexc" href="#/wiki/poke/${p.id}">${cara(p.id, 40)}<b>${esc(nm(p.n))}</b></a>`).join('')}</div>`, pk.length) +
      sec(T('Ataques'), `<div class="filtros">${mv.map(m => `<a class="mov" href="#/wiki/mov/${esc(m.id)}" style="--c:${D.types.get(m.type) ? D.types.get(m.type).color : '#9fb1c9'}">${esc(nm(m.n))}</a>`).join('')}</div>`, mv.length) +
      sec(T('Objetos'), `<div class="filtros">${ob.map(o => `<a class="chip" href="#/wiki/obj/${esc(o.id)}">${ico(o.id, 16)} ${esc(nm(o.n))}</a>`).join('')}</div>`, ob.length));
  };
  V.apoyar = async () => {
    const d = await get('/apoyar');
    const yo = d.yo;
    // Su código para Ko-fi (el webhook de Ko-fi lo reconoce y le pone la insignia de Mecenas sola).
    const codigo = yo && yo.codigo ? `<div class="kofi-cod">
        <h3>${esc(T('Cómo donar para que salga tu insignia'))}</h3>
        <ol class="pasos-don">
          <li><b>${esc(T('Copia tu código:'))}</b> <code class="cod" translate="no">${esc(yo.codigo)}</code> <button class="btn small ghost" data-act="copiar" data-txt="${esc(yo.codigo)}">${esc(T('Copiar'))}</button></li>
          <li><b>${esc(T('Dona en Ko-fi y pega el código en el mensaje de la donación.'))}</b>
            <a class="btn small gold" href="https://ko-fi.com/jpter78" rel="noopener" target="_blank">${ico('heart', 16)} ${esc(T('Donar en Ko-fi'))}</a></li>
          <li><b>${esc(T('¡Listo!'))}</b> ${esc(T('En un momento te llega un aviso y la insignia de Mecenas sale en tu nombre.'))}</li>
        </ol>
        <p class="note">${esc(T('Si entras al juego con Google y donas con ese mismo correo, no hace falta: se reconoce cuando vuelvas al foro.'))}</p></div>` : '';
    // (20-11-2026, el dueño) Quien donó antes de esto (o no le sale): un ticket en Discord y se le pone a mano (Panel).
    const ticket = `<div class="aviso">${ico('heart', 16)} ${esc(T('¿Ya donaste antes y no te sale la insignia de Mecenas? Abre un ticket en nuestro Discord y te la ponemos a mano.'))}
      <a class="btn tiny gold" href="https://discord.gg/HBw7XTSmfK" rel="noopener" target="_blank">Discord</a></div>`;
    const gracias = yo && yo.mecenas ? `<div class="aviso ok">${ico('heart', 18)} ${esc(T('¡Gracias por apoyar el proyecto! Eres mecenas.'))} ${yo.visible ? '' : esc(T('Tu insignia está oculta: puedes enseñarla en Ajustes.'))}</div>` : '';
    pintar(migas([T('Apoyar')]) + caja(T('Apoya PokéSurvivor'), gracias + donar(false) + `<p>${esc(T('Todo el dinero va a los servidores y al dominio. Más formas de ayudar, gratis: compartir el juego, avisar de fallos y escribir guías y consejos aquí.'))}</p>
      <div class="row"><a class="btn gold" href="https://ko-fi.com/jpter78" rel="noopener" target="_blank">${ico('heart', 18)} Ko-fi</a><a class="btn ghost" href="https://github.com/sponsors/JPTER78" rel="noopener" target="_blank">GitHub Sponsors</a><a class="btn ghost" href="../apoyar/">${esc(T('Más información'))}</a></div>
      ${codigo || (S.yo ? '' : `<p class="note">${esc(T('Entra con tu cuenta del juego antes de donar para que salga sola tu insignia de Mecenas.'))}</p>`)}
      ${yo && yo.mecenas ? '' : ticket}
      <h3>${esc(T('Qué tienen los mecenas'))}</h3><ul class="lista">${['La insignia de corazón al lado del nombre, en todo el foro.', 'La medalla «Mecenas», con su título.',
        'Su nombre en la lista de mecenas de aquí abajo.', 'En las sugerencias, su voto vale 1 más y las suyas salen destacadas.', 'En el juego, nada: todos juegan igual.']
        .map(t => `<li>${esc(T(t))}</li>`).join('')}</ul>`, { icono: 'heart' }) +
      caja(T('Mecenas'), d.mecenas.length ? `<ul class="equipo">${d.mecenas.map(u => `<li>${pfp(d.us[u], 36)}${quien(d.us, u)}</li>`).join('')}</ul>` : `<p class="sub">${esc(T('Aún nadie. ¡Puedes ser el primero!'))}</p>`, { icono: 'star' }));
  };
  V.panel = async q => {
    const yo = S.yo;
    if (!yo || !['admin', 'mod'].includes(yo.u.rol)) return V.noExiste();
    const admin = yo.u.rol === 'admin';
    const [d, us, dons] = await Promise.all([get('/panel'), get('/panel/usuarios', { q: q.u || '' }), admin ? get('/panel/donaciones') : null]);
    const OBJ_URL = { hilo: id => '#/hilo/' + id, post: () => '', build: id => '#/build/' + id, sugerencia: id => '#/sugerencia/' + id, perfil: id => '#/u/' + id, pagina: id => '#/wiki/p/' + id };
    pintar(migas([T('Panel')]) + caja(T('Reportes abiertos ({x})', d.reportes.length), d.reportes.length ? `<ul class="filas">${d.reportes.map(r => `<li class="fila"><div class="grow">
      <b>${esc(r.obj)} #${esc(r.oid)}</b> ${r.url || (OBJ_URL[r.obj] && OBJ_URL[r.obj](r.oid)) ? `<a href="${esc(r.url || OBJ_URL[r.obj](r.oid))}">${esc(T('ver'))}</a>` : ''} · ${esc(T('autor'))}: ${r.autor ? quien(d.us, r.autor) : '—'}
      <p class="cita-corta">«${esc(r.motivo)}»</p><small>${esc(T('Reporta'))} ${quien(d.us, r.uid)} · ${cuando(r.creado)}</small></div>
      <div class="row">${['borrado', 'aviso', 'suspendido', 'nada'].map(x => `<button class="btn tiny ghost" data-act="resolver" data-id="${r.id}" data-d="${x}">${esc(T({ borrado: 'Borrado', aviso: 'Avisado', suspendido: 'Suspendido', nada: 'Está bien' }[x]))}</button>`).join('')}</div></li>`).join('')}</ul>` : vacio(T('Nada pendiente.')), { icono: 'flag' }) +
      caja(T('Usuarios'), `<form class="filtros" data-form="filtro" data-ruta="panel"><input class="field mini" name="u" value="${esc(q.u || '')}" placeholder="${esc(T('Apodo…'))}"><button class="btn small">${ico('search', 16)}</button></form>
        <table class="tabla"><tbody>${us.usuarios.map(u => `<tr><td><a href="#/u/${esc(u.nombre)}">${esc(u.nombre)}</a>${u.ban ? ` <i class="est est-rechazada">${esc(T('ban'))}</i>` : ''}${u.suspendido_hasta && new Date(u.suspendido_hasta) > new Date() ? ` <i class="est est-rechazada">${esc(T('suspendido'))}</i>` : ''}</td>
          <td>${esc(u.rol)}${u.mecenas ? ' · ' + esc(T('mecenas')) : ''}</td><td class="num">${fmt(u.pe)} PE</td><td class="row">
          <button class="btn tiny ghost" data-act="suspender" data-n="${esc(u.nombre)}">${esc(T('Suspender'))}</button>
          ${admin ? `<button class="btn tiny ghost" data-act="admin-u" data-n="${esc(u.nombre)}" data-a="mecenas">${esc(T('Mecenas'))}</button>
          <select class="field mini" data-act-change="rol" data-n="${esc(u.nombre)}">${['usuario', 'mod', 'admin'].map(r => `<option${u.rol === r ? ' selected' : ''}>${r}</option>`).join('')}</select>
          <button class="btn tiny ghost" data-act="pe" data-n="${esc(u.nombre)}">PE ±</button>` : ''}</td></tr>`).join('')}</tbody></table>`, { icono: 'friends' }) +
      caja(T('Premios del juego'), `<p class="sub">${esc(T('Dados: {x} (tickets: {y}, tickets ×10: {z}) · pendientes: {w}', fmt(d.premios.dados), fmt(d.premios.t1), fmt(d.premios.t10), fmt(d.premios.pendientes)))}</p>
        ${d.premiosMal.length ? `<table class="tabla"><tbody>${d.premiosMal.map(p => `<tr><td>${quien(d.us, p.uid)}</td><td>${esc(p.ref)}</td><td>${esc(p.error)} (${p.intentos})</td><td>${admin ? `<button class="btn tiny ghost" data-act="reintentar" data-id="${p.id}">${esc(T('Reintentar'))}</button>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}`, { icono: 'ticket' }) +
      (admin ? caja(T('Donaciones'), `<p class="sub">${esc(T('Las de Ko-fi, para vincular a su apodo las que no se vinculan solas (sale como Mecenas).'))}</p>
        ${dons ? (dons.donaciones.length ? `<table class="tabla"><tbody>${dons.donaciones.map(x => `<tr><td>${cuando(x.creado)}</td><td>${esc(x.tipo)}${x.publica ? '' : ` · <i>${esc(T('privada'))}</i>`}</td>
          <td>${esc(x.de_nombre)}${x.codigo ? ` · <code>${esc(x.codigo)}</code>` : ''}</td><td>${x.uid ? quien(dons.us, x.uid) + ` <small>(${esc(T(x.por === 'codigo' ? 'por código' : x.por === 'correo' ? 'por correo' : 'a mano'))})</small>`
          : `<button class="btn tiny gold" data-act="vincular" data-id="${x.id}">${esc(T('Vincular a un apodo'))}</button>`}</td></tr>`).join('')}</tbody></table>`
          : `<p class="sub">${esc(T('Aún no ha llegado ninguna donación de Ko-fi.'))}</p>`) : ''}`, { icono: 'heart' }) : '') +
      caja(T('Últimas acciones del equipo'), `<table class="tabla"><tbody>${d.log.map(l => `<tr><td>${cuando(l.creado)}</td><td>${quien(d.us, l.uid, { badges: false })}</td><td>${esc(l.accion)}</td><td>${esc(l.obj)}</td><td><small>${esc(JSON.stringify(l.info).slice(0, 120))}</small></td></tr>`).join('')}</tbody></table>`, { icono: 'clock' }));
  };
  V.entrar = async () => {
    if (S.yo) { location.hash = '#/'; return; }
    pintar(caja(T('Entra con tu cuenta del juego'), `<p class="sub">${esc(T('El foro usa tu cuenta de PokéSurvivor: el mismo apodo, tu foto y tu marco. Si ya has entrado en el juego en este navegador, aquí ya estás dentro.'))}</p>
      ${S.sesion === 'anon' ? `<div class="aviso">${esc(T('Estás jugando como invitado: los invitados sólo pueden leer. Crea una cuenta en el juego para escribir.'))}</div>` : ''}
      <form class="form" data-form="entrar"><label>${esc(T('Apodo'))}</label><input class="field" name="nombre" autocomplete="username" required>
        <label>${esc(T('Contraseña'))}</label><input class="field" name="clave" type="password" autocomplete="current-password" required>
        <div class="row"><button class="btn gold grow">${esc(T('Entrar'))}</button></div><p class="err" data-err></p></form>
      <div class="row"><button class="btn google grow" data-act="google">${esc(T('Entrar con Google'))}</button></div>
      <p class="note">${esc(T('¿No tienes cuenta? Créala en el juego (es gratis) y vuelve:'))} <a href="../">${esc(T('Ir al juego'))}</a></p>`, { icono: 'user', cls: 'entrar' }));
  };
  V.noExiste = async () => pintar(caja('', vacio(T('Esto no existe (o lo han borrado).'), `<a class="btn" href="#/">${esc(T('Volver al inicio'))}</a>`)));

  // ---------------- rutas ----------------
  const RUTAS = [
    [/^$/, () => V.inicio()],
    [/^foro$/, () => V.foro()],
    [/^foro\/([a-z]+)\/nuevo$/, m => V.nuevoHilo(m[1])],
    [/^foro\/([a-z]+)$/, (m, q) => V.categoria(m[1], q)],
    [/^hilo\/(\d+)$/, (m, q) => V.hilo(m[1], q)],
    [/^builds$/, (m, q) => V.builds(q)],
    [/^builds\/nueva$/, (m, q) => V.buildForm(null, q)],
    [/^build\/(\d+)$/, m => V.build(m[1])],
    [/^build\/(\d+)\/editar$/, m => V.buildForm(m[1])],
    [/^sugerencias$/, (m, q) => V.sugerencias(q)],
    [/^sugerencias\/nueva$/, () => V.nuevaSug()],
    [/^sugerencia\/(\d+)$/, m => V.sugerencia(m[1])],
    [/^wiki$/, (m, q) => V.wiki('poke', q)],
    [/^wiki\/(poke|mov|obj|paginas)$/, (m, q) => V.wiki(m[1], q)],
    [/^wiki\/poke\/(\d+)$/, m => V.poke(m[1])],
    [/^wiki\/mov\/([\w-]+)$/, m => V.mov(m[1])],
    [/^wiki\/obj\/([\w-]+)$/, m => V.obj(m[1])],
    [/^wiki\/nueva$/, () => V.paginaForm()],
    [/^wiki\/p\/([\w-]+)$/, (m, q) => V.pagina(m[1], q)],
    [/^wiki\/p\/([\w-]+)\/editar$/, m => V.paginaForm(m[1])],
    [/^wiki\/p\/([\w-]+)\/historial$/, m => V.historial(m[1])],
    [/^u\/([A-Za-z0-9_]{3,16})$/, (m, q) => V.perfil(m[1], q)],
    [/^miembros$/, (m, q) => V.miembros(q)],
    [/^rangos$/, () => V.rangos()],
    [/^ajustes$/, () => V.ajustes()],
    [/^avisos$/, () => V.avisos()],
    [/^buscar$/, (m, q) => V.buscar(q)],
    [/^apoyar$/, () => V.apoyar()],
    [/^panel$/, (m, q) => V.panel(q)],
    [/^entrar$/, () => V.entrar()]
  ];
  let ultimaRuta = null, navN = 0;
  async function ir() {
    const h = location.hash.replace(/^#\/?/, '');
    const [ruta, qs] = h.split('?');
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    const n = ++navN;
    marcarNav(ruta);
    document.body.classList.remove('nav-abierto');
    const cambio = ruta !== ultimaRuta;
    ultimaRuta = ruta;
    if (cambio) $('#main').classList.add('cargando');
    try {
      if (PRIVADA.test(ruta)) await sesionLista;
      if (listo && !PIDE_ANTES.test(ruta)) await listo;
      if (n !== navN) return;
      for (const [re, fn] of RUTAS) {
        const m = re.exec(ruta);
        if (m) { await fn(m, q); break; }
        if (re === RUTAS[RUTAS.length - 1][0]) await V.noExiste();
      }
      if (n !== navN) return;
      if (cambio && !q.post) window.scrollTo(0, 0);
      const h1 = $('#main h1');
      document.title = (h1 && ruta ? h1.textContent.trim() + ' · ' : '') + T('Comunidad de PokéSurvivor');
    } catch (e) {
      if (n !== navN) return;
      console.error(e);
      pintar(caja('', `<div class="vacio">${ico('shield', 28)}<p>${esc(e instanceof ApiError ? errTexto(e) : T('Algo ha fallado al cargar esta página.'))}</p><a class="btn" href="#/">${esc(T('Volver al inicio'))}</a></div>`));
    } finally { if (n === navN) $('#main').classList.remove('cargando'); }
  }
  const recargar = () => ir();

  // ---------------- avisos y mensajes ----------------
  function toast(t, tipo = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + tipo;
    el.textContent = t;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('fuera'), 3800);
    setTimeout(() => el.remove(), 4300);
  }
  /** Una ventana propia (nada de alert/confirm/prompt). → la respuesta o null. */
  function ventana(titulo, cuerpo, { ok = T('Aceptar'), campo = null } = {}) {
    return new Promise(res => {
      const v = document.createElement('div');
      v.className = 'veil';
      v.innerHTML = `<div class="box modal"><h2>${esc(titulo)}</h2>${cuerpo ? `<p>${esc(cuerpo)}</p>` : ''}${campo ? `<textarea class="field" rows="3" maxlength="${campo.max || 500}" placeholder="${esc(campo.ph || '')}"></textarea>` : ''}
        <div class="row end"><button class="btn ghost" data-r="0">${esc(T('Cancelar'))}</button><button class="btn gold" data-r="1">${esc(ok)}</button></div></div>`;
      document.body.appendChild(v);
      const ta = v.querySelector('textarea');
      if (ta) ta.focus();
      v.addEventListener('click', e => {
        const b = e.target.closest('[data-r]');
        if (!b && e.target !== v) return;
        const si = b && b.dataset.r === '1';
        v.remove();
        res(si ? (ta ? ta.value.trim() : true) : null);
      });
    });
  }
  const confirmar = (t, c) => ventana(t, c, { ok: T('Sí') });

  // ---------------- acciones ----------------
  const ACT = {};
  ACT.reac = async b => {
    const box = b.closest('.reacs');
    if (!S.yo) { location.hash = '#/entrar'; return; }
    const r = await post('/reaccion', { obj: box.dataset.obj, id: +box.dataset.id, tipo: b.dataset.tipo, url: box.dataset.url || undefined });
    box.outerHTML = reacciones(box.dataset.obj, box.dataset.id, r, box.dataset.url);
  };
  ACT.citar = b => {
    const ta = document.querySelector('[data-form=responder] textarea');
    if (!ta) return;
    const src = document.querySelector(`[data-post="${b.dataset.id}"]`);
    const texto = (src ? src.innerText : '').trim().split('\n').slice(0, 6).join('\n');
    ta.value += (ta.value ? '\n\n' : '') + `> [${b.dataset.n}] ` + texto.split('\n').join('\n> ') + '\n\n';
    ta.focus(); ta.dispatchEvent(new Event('input'));
    ta.scrollIntoView({ block: 'center' });
  };
  ACT.solucion = async b => { await post(`/hilo/${hiloActual()}/solucion`, { post: +b.dataset.id }); recargar(); };
  ACT['editar-post'] = b => {
    const id = b.dataset.id, cont = document.querySelector(`[data-post="${id}"]`), tpl = document.querySelector(`template[data-src="${id}"]`);
    if (!cont || !tpl) return;
    const primero = cont.closest('.posts') && cont.closest('.posts').querySelector('.post') === cont.closest('.post') && !/pag=[2-9]/.test(location.hash);
    cont.innerHTML = `<form class="form" data-form="editar-post" data-id="${id}">${primero ? `<input class="field" name="titulo" value="${esc($('.hilo-cab h1').textContent.trim())}" maxlength="120">` : ''}${editor('texto', tpl.content.textContent, { max: S.reglas.lim.post, alto: 8 })}
      <div class="row end"><button type="button" class="btn small ghost" data-act="recargar">${esc(T('Cancelar'))}</button><button class="btn small gold">${esc(T('Guardar'))}</button></div></form>`;
    contar(cont.querySelector('textarea'));
  };
  ACT.recargar = () => recargar();
  ACT['borrar-post'] = async b => { if (await confirmar(T('¿Borrar este mensaje?'))) { await post(`/post/${b.dataset.id}/borrar`); toast(T('Borrado')); recargar(); } };
  ACT['borrar-build'] = async b => { if (await confirmar(T('¿Borrar esta build?'))) { await post(`/build/${b.dataset.id}/borrar`); location.hash = '#/builds'; } };
  ACT['borrar-com'] = async b => { if (await confirmar(T('¿Borrar este comentario?'))) { await post(`/comentario/${b.dataset.id}/borrar`); recargar(); } };
  ACT['borrar-consejo'] = async b => { if (await confirmar(T('¿Borrar este consejo?'))) { await post(`/consejo/${b.dataset.id}/borrar`); resumenWiki = null; recargar(); } };
  ACT['borrar-sug'] = async b => { if (await confirmar(T('¿Borrar esta sugerencia?'))) { await post(`/sugerencia/${b.dataset.id}/borrar`); location.hash = '#/sugerencias'; } };
  ACT['borrar-pagina'] = async b => { if (await confirmar(T('¿Borrar esta página de la wiki?'))) { await post(`/wiki/p/${b.dataset.id}/borrar`); location.hash = '#/wiki/paginas'; } };
  ACT.revertir = async b => { if (await confirmar(T('¿Volver a esta versión?'))) { await post(`/wiki/p/${b.dataset.slug}/revertir`, { rev: +b.dataset.rev }); location.hash = '#/wiki/p/' + b.dataset.slug; } };
  ACT.seguir = async () => { const r = await post(`/hilo/${hiloActual()}/seguir`); toast(r.sigo ? T('Te avisaremos de las respuestas.') : T('Ya no sigues este hilo.')); recargar(); };
  ACT['mod-hilo'] = async b => {
    const a = b.dataset.a;
    if (a === 'borrar' && !(await confirmar(T('¿Borrar el hilo entero?'), T('Se quitan los PE de quien lo abrió.')))) return;
    await post(`/hilo/${hiloActual()}/mod`, { accion: a });
    if (a === 'borrar' && !(S.yo && ['admin', 'mod'].includes(S.yo.u.rol))) location.hash = '#/foro'; else recargar();
  };
  ACT.votarb = async b => {
    if (!S.yo) { location.hash = '#/entrar'; return; }
    const box = b.closest('.votos'), id = box.dataset.build;
    const r = await post(`/build/${id}/voto`, { valor: b.classList.contains('on') ? 0 : +b.dataset.v });
    box.outerHTML = votosBuild({ id, arriba: r.arriba, abajo: r.abajo }, r.mio);
  };
  ACT.votar = async b => {
    if (!S.yo) { location.hash = '#/entrar'; return; }
    const box = b.closest('.votos'), id = box.dataset.sug, v = +b.dataset.v;
    const r = await post(`/sugerencia/${id}/voto`, { valor: b.classList.contains('on') ? 0 : v });
    box.outerHTML = votos({ id, votos: r.votos }, r.mio);
  };
  ACT.reportar = async b => {
    const m = await ventana(T('Reportar'), T('Cuéntale al equipo qué pasa (spam, insultos, trampas…).'), { ok: T('Enviar'), campo: { max: 500, ph: T('Motivo') } });
    if (!m) return;
    await post('/reportar', { obj: b.dataset.obj, id: b.dataset.id, motivo: m, url: location.hash.slice(0, 200) });
    toast(T('Gracias: el equipo lo revisará.'), 'ok');
  };
  ACT.resolver = async b => { await post(`/panel/reporte/${b.dataset.id}`, { decision: b.dataset.d }); recargar(); };
  ACT.suspender = async b => {
    const dias = await ventana(T('Suspender a {x}', b.dataset.n), T('Días (0 = quitar la suspensión). Después, el motivo en otra línea.'), { ok: T('Suspender'), campo: { max: 300, ph: '3\n' + T('Motivo') } });
    if (dias == null) return;
    const [n, ...mot] = dias.split('\n');
    await post('/panel/usuario', { nombre: b.dataset.n, accion: 'suspender', valor: Math.max(0, parseInt(n, 10) || 0), motivo: mot.join(' ').trim() });
    toast(T('Hecho'), 'ok'); recargar();
  };
  ACT['admin-u'] = async b => { await post('/panel/usuario', { nombre: b.dataset.n, accion: b.dataset.a }); toast(T('Hecho'), 'ok'); recargar(); };
  ACT.pe = async b => {
    const v = await ventana(T('Ajustar PE de {x}', b.dataset.n), T('Puntos (negativo para quitar). Después, el motivo en otra línea.'), { ok: T('Aplicar'), campo: { max: 300, ph: '-20\n' + T('Motivo') } });
    if (v == null) return;
    const [n, ...mot] = v.split('\n');
    await post('/panel/usuario', { nombre: b.dataset.n, accion: 'pe', valor: parseInt(n, 10) || 0, motivo: mot.join(' ').trim() });
    toast(T('Hecho'), 'ok'); recargar();
  };
  ACT.reintentar = async b => { await post(`/panel/premio/${b.dataset.id}`); recargar(); };
  ACT.vincular = async b => {
    const n = await ventana(T('Vincular la donación'), T('El apodo del juego de quien ha donado: le llega la insignia de Mecenas.'), { ok: T('Vincular'), campo: { max: 16, ph: T('Apodo') } });
    if (!n) return;
    await post(`/panel/donacion/${b.dataset.id}`, { nombre: n.trim() });
    toast(T('Hecho'), 'ok'); recargar();
  };
  ACT.copiar = async b => {
    try { await navigator.clipboard.writeText(b.dataset.txt); toast(T('Copiado'), 'ok'); } catch (e) { toast(b.dataset.txt); }
  };
  ACT.salir = async () => { if (PRUEBA) { try { localStorage.setItem('psc.prueba', ''); } catch (e) { /* nada */ } location.href = location.pathname; return; } if (S.fb) await S.fb.auth().signOut(); guardar('psc.yo', null); S.yo = null; S.user = null; S.sesion = 'fuera'; pintarMarco(); location.hash = '#/'; };
  ACT.google = async () => {
    try { await fbInit(); await S.fb.auth().signInWithPopup(new S.fb.auth.GoogleAuthProvider()); } catch (e) { toast(T('No se ha podido entrar con Google.'), 'mal'); }
  };
  ACT.menu = () => document.body.classList.toggle('nav-abierto');
  const hiloActual = () => (/^#\/hilo\/(\d+)/.exec(location.hash) || [])[1];

  const CAMBIO = {
    mover: async el => { await post(`/hilo/${hiloActual()}/mod`, { accion: 'mover', valor: el.value }); toast(T('Movido'), 'ok'); recargar(); },
    prefijo: async el => { await post(`/hilo/${hiloActual()}/mod`, { accion: 'prefijo', valor: el.value }); recargar(); },
    rol: async el => { await post('/panel/usuario', { nombre: el.dataset.n, accion: 'rol', valor: el.value }); toast(T('Hecho'), 'ok'); }
  };

  // ---------------- formularios ----------------
  const val = (f, n) => { const el = f.elements[n]; return el ? (el.type === 'checkbox' ? (el.checked ? el.value : '') : el.value.trim()) : ''; };
  const FORM = {
    hilo: async f => { const r = await post('/hilo', { cat: f.dataset.cat, titulo: val(f, 'titulo'), texto: val(f, 'texto'), prefijo: (f.querySelector('[name=prefijo]:checked') || {}).value || '' }); location.hash = '#/hilo/' + r.id; },
    responder: async f => { const r = await post(`/hilo/${f.dataset.hilo}/responder`, { texto: val(f, 'texto') }); location.hash = `#/hilo/${f.dataset.hilo}?post=${r.id}`; if (/post=/.test(location.hash)) recargar(); },
    'editar-post': async f => { await post(`/post/${f.dataset.id}/editar`, { texto: val(f, 'texto'), titulo: val(f, 'titulo') || undefined }); recargar(); },
    comentar: async f => { const b = { obj: f.dataset.obj, texto: val(f, 'texto') }; if (f.dataset.obj === 'perfil') b.nombre = f.dataset.id; else b.id = +f.dataset.id; await post('/comentar', b); recargar(); },
    consejo: async f => { await post('/consejo', { ent: f.dataset.ent, clave: f.dataset.clave, texto: val(f, 'texto') }); resumenWiki = null; toast(T('¡Gracias por el consejo!'), 'ok'); recargar(); },
    build: async f => {
      const p = buscaPoke(val(f, 'poke'));
      if (!p) throw new ApiError(400, { error: 'build_poke' });
      const lista = n => (val(f, n) ? val(f, n).split(',') : []);
      const b = { dex: p.id, titulo: val(f, 'titulo'), movs: lista('movs'), objs: lista('objs'), mejoras: lista('mejoras'), poder: val(f, 'poder'), modo: val(f, 'modo'), texto: val(f, 'texto') };
      const r = f.dataset.id ? await post(`/build/${f.dataset.id}/editar`, b) : await post('/build', b);
      resumenWiki = null;
      location.hash = '#/build/' + r.id;
    },
    sugerencia: async f => { const r = await post('/sugerencia', { titulo: val(f, 'titulo'), texto: val(f, 'texto'), cat: val(f, 'cat') }); location.hash = '#/sugerencia/' + r.id; },
    'sug-estado': async f => { await post(`/sugerencia/${f.dataset.id}/estado`, { estado: val(f, 'estado'), respuesta: val(f, 'respuesta') }); toast(T('Guardado'), 'ok'); recargar(); },
    pagina: async f => {
      const r = f.dataset.slug ? await post(`/wiki/p/${f.dataset.slug}/editar`, { texto: val(f, 'texto'), resumen: val(f, 'resumen') }) : await post('/wiki/p', { titulo: val(f, 'titulo'), texto: val(f, 'texto') });
      location.hash = '#/wiki/p/' + r.slug;
    },
    ajustes: async f => {
      const b = { bio: val(f, 'bio'), firma: val(f, 'firma'), titulo: val(f, 'titulo') };
      if (f.elements.mecenas_visible) b.mecenas_visible = f.elements.mecenas_visible.checked;
      await post('/ajustes', b); await cargarYo(); toast(T('Guardado'), 'ok'); recargar();
    },
    entrar: async f => {
      const n = val(f, 'nombre'), c = f.elements.clave.value;
      try {
        await fbInit();
        const email = [...new TextEncoder().encode(n.toLowerCase())].map(b => b.toString(16).padStart(2, '0')).join('') + '@' + NAME_DOMAIN;
        await S.fb.auth().signInWithEmailAndPassword(email, c);
      } catch (e) { f.querySelector('[data-err]').textContent = T('Apodo o contraseña incorrectos.'); }
    },
    'filtro-wiki': f => { const q = new URLSearchParams(); for (const k of ['q', 'tipo', 'gen', 'con']) if (val(f, k)) q.set(k, val(f, k)); location.hash = `#/wiki/${f.dataset.sub}?${q}`; },
    filtro: f => { const q = new URLSearchParams(); for (const el of f.elements) if (el.name && el.value.trim()) q.set(el.name, el.value.trim()); location.hash = `#/${f.dataset.ruta}?${q}`; }
  };

  // ---------------- editor ----------------
  function contar(ta) {
    const ed = ta && ta.closest('.ed');
    if (!ed) return;
    ed.querySelector('.ed-n').textContent = `${fmt(ta.value.length)} / ${fmt(+ed.dataset.max)}`;
  }
  function envolver(ta, a, b = a, ph = '') {
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || ph;
    ta.setRangeText(a + sel + b, s, e, 'select');
    ta.focus(); contar(ta);
  }
  async function botonEditor(btn) {
    const ed = btn.closest('.ed'), ta = ed.querySelector('textarea'), k = btn.dataset.ed;
    if (k === 'b') envolver(ta, '**', '**', T('negrita'));
    else if (k === 'i') envolver(ta, '*', '*', T('cursiva'));
    else if (k === 's') envolver(ta, '~~', '~~', T('tachado'));
    else if (k === 'sp') envolver(ta, '||', '||', T('spoiler'));
    else if (k === 'code') envolver(ta, '`', '`', T('código'));
    else if (k === 'wiki') envolver(ta, '[[', ']]', 'Pikachu');
    else if (k === 'quote' || k === 'list') {
      const s = ta.selectionStart, e = ta.selectionEnd, pre = k === 'quote' ? '> ' : '- ';
      const t = (ta.value.slice(s, e) || T('texto')).split('\n').map(l => pre + l).join('\n');
      ta.setRangeText((s && ta.value[s - 1] !== '\n' ? '\n' : '') + t + '\n', s, e, 'end'); ta.focus(); contar(ta);
    } else if (k === 'link' || k === 'img') {
      const url = await ventana(k === 'img' ? T('Imagen') : T('Enlace'), k === 'img' ? T('Dirección de la imagen (imgur, Discord…). Se ven desde el rango Bronce.') : T('Dirección (https://…)'), { campo: { max: 500, ph: 'https://' } });
      if (!url || !/^https?:\/\/\S+$/.test(url)) return;
      envolver(ta, k === 'img' ? '![' : '[', `](${url})`, k === 'img' ? '' : T('texto'));
    }
  }
  async function pestanaEditor(btn) {
    const ed = btn.closest('.ed'), ta = ed.querySelector('textarea'), pv = ed.querySelector('.ed-p');
    ed.querySelectorAll('[data-edtab]').forEach(b => b.classList.toggle('on', b === btn));
    if (btn.dataset.edtab === 'w') { pv.classList.add('hidden'); ta.classList.remove('hidden'); return; }
    if (!S.yo) { pv.innerHTML = `<p class="sub">${esc(T('Entra para ver la vista previa.'))}</p>`; }
    else {
      pv.innerHTML = `<p class="sub">…</p>`;
      try { pv.innerHTML = (await post('/previa', { texto: ta.value })).html || `<p class="sub">${esc(T('(vacío)'))}</p>`; } catch (e) { pv.innerHTML = `<p class="err">${esc(errTexto(e))}</p>`; }
    }
    pv.style.minHeight = ta.offsetHeight + 'px';
    ta.classList.add('hidden'); pv.classList.remove('hidden');
  }

  // ---------------- eventos ----------------
  document.addEventListener('click', async e => {
    const sp = e.target.closest('.spoiler');
    if (sp) { sp.classList.add('visto'); return; }
    const edb = e.target.closest('[data-ed]');
    if (edb) { e.preventDefault(); botonEditor(edb); return; }
    const tab = e.target.closest('[data-edtab]');
    if (tab) { e.preventDefault(); pestanaEditor(tab); return; }
    const pk = e.target.closest('.pick .pk');
    if (pk) {
      const box = pk.closest('.pick'), k = box.dataset.pick, max = +box.dataset.max, inp = document.querySelector(`[data-form=build] input[name=${k}]`);
      let v = inp.value ? inp.value.split(',') : [];
      if (v.includes(pk.dataset.v)) v = v.filter(x => x !== pk.dataset.v);
      else if (v.length < max) v.push(pk.dataset.v);
      else { toast(T('Como mucho {x}.', max)); return; }
      inp.value = v.join(',');
      box.querySelectorAll('.pk').forEach(b => b.classList.toggle('on', v.includes(b.dataset.v)));
      pintarSel();
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b || !ACT[b.dataset.act]) return;
    e.preventDefault();
    if (b.disabled) return;
    b.disabled = true;
    try { await ACT[b.dataset.act](b); } catch (err) { console.error(err); toast(errTexto(err), 'mal'); } finally { b.disabled = false; }
  });
  document.addEventListener('change', async e => {
    const el = e.target;
    if (el.matches('[data-act-change]') && CAMBIO[el.dataset.actChange]) { try { await CAMBIO[el.dataset.actChange](el); } catch (err) { toast(errTexto(err), 'mal'); } return; }
    if (el.matches('[data-orden]')) { const q = new URLSearchParams(location.hash.split('?')[1] || ''); q.set('orden', el.value); q.delete('pag'); location.hash = location.hash.split('?')[0] + '?' + q; return; }
    if (el.matches('[data-filtro]')) { const q = new URLSearchParams(location.hash.split('?')[1] || ''); if (el.value) q.set(el.dataset.filtro, el.value); else q.delete(el.dataset.filtro); q.delete('pag'); location.hash = location.hash.split('?')[0] + '?' + q; return; }
    if (el.matches('[data-poke-buscar]')) { const p = buscaPoke(el.value); if (p) { const q = new URLSearchParams(location.hash.split('?')[1] || ''); q.set('dex', p.id); q.delete('pag'); location.hash = '#/builds?' + q; } return; }
    if (el.matches('[data-form=build] [name=poke]')) { const p = buscaPoke(el.value); const s = document.querySelector('[data-poke-sel]'); if (s) s.innerHTML = p ? sprite(p.id, 2) : ''; }
  });
  document.addEventListener('input', e => { if (e.target.matches('.ed textarea')) contar(e.target); });
  document.addEventListener('submit', async e => {
    const f = e.target.closest('form[data-form]');
    if (!f || !FORM[f.dataset.form]) return;
    e.preventDefault();
    const btn = f.querySelector('button:not([type=button])');
    if (btn) btn.disabled = true;
    try { await FORM[f.dataset.form](f); } catch (err) { console.error(err); toast(errTexto(err), 'mal'); } finally { if (btn) btn.disabled = false; }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches('.ed textarea')) { const f = e.target.closest('form'); if (f) f.requestSubmit(); }
  });
  window.addEventListener('hashchange', ir);

  // ---------------- en este ordenador: cuentas de prueba ----------------
  function selectorPrueba() {
    const box = document.createElement('div');
    box.className = 'prueba';
    box.innerHTML = `<label>Cuenta de prueba <small>(sólo en este ordenador)</small></label><select class="field mini">${CUENTAS_PRUEBA.map(([t, n]) =>
      `<option value="${esc(t)}"${t === TEST_TOKEN ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    box.querySelector('select').addEventListener('change', e => {
      try { localStorage.setItem('psc.prueba', e.target.value); } catch (err) { /* nada */ }
      location.href = location.pathname + location.hash;
    });
    document.body.appendChild(box);
  }

  // ---------------- sesión ----------------
  // (async = false: se bajan a la vez y se ejecutan en el orden en que se piden.)
  const cargarScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  let fbCarga = null;
  function fbInit() {
    if (fbCarga) return fbCarga;
    return (fbCarga = (async () => {
      await Promise.all([cargarScript(SDK + 'firebase-app-compat.js'), cargarScript(SDK + 'firebase-auth-compat.js')]);
      window.firebase.initializeApp(FB);
      S.fb = window.firebase;
      await S.fb.auth().setPersistence(S.fb.auth.Auth.Persistence.LOCAL);
      return S.fb;
    })().catch(e => { fbCarga = null; throw e; }));
  }
  function ponerYo(r) {
    S.yo = r.u ? r : null;
    S.avisos = r.avisos || 0;
    S.reportes = r.reportes || 0;
    S.sesion = r.u ? 'dentro' : r.sinApodo ? 'sinApodo' : r.anon ? 'anon' : 'fuera';
  }
  async function cargarYo() {
    try {
      const r = await get('/yo');
      ponerYo(r);
      guardar('psc.yo', r.u ? r : null);
    } catch (e) { S.yo = null; S.sesion = 'fuera'; }
    pintarMarco();
  }
  /*
   * (20-11-2026, el dueño: «tarda BASTANTE en cargar el foro») Antes iba todo en fila: reglas y datos → Firebase (sus dos archivos,
   * uno tras otro) → la sesión → /yo → la página. Ahora Firebase se pide al empezar, a la vez que lo demás; las reglas y la cuenta
   * de la última vez (si es la misma) salen de este navegador y se ponen al día por detrás. Lo que manda sigue siendo el servidor.
   */
  const leer = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* nada */ } };
  /*
   * (20-11-2026, el dueño: «haz algo porque tarda bastante en cargar, y eso para posicionarla en Google, malamente») Se pinta YA,
   * sin esperar a Firebase: lo público lo da el servidor a cualquiera. Si la última vez entraste, la barra de arriba sale ya con tu
   * cuenta; cuando Firebase dice quién eres, se vuelve a pintar con lo tuyo (tus votos, tus avisos). Google no tiene sesión: ve la
   * página al momento. Sólo las páginas privadas (escribir, ajustes, avisos, panel, entrar) esperan a saber quién eres.
   * Las peticiones de la página salen a la vez que los datos del juego y las reglas, y esperan a ellos al volver (api: listo).
   */
  const PRIVADA = /^(foro\/[a-z]+\/nuevo|builds\/nueva|build\/\d+\/editar|sugerencias\/nueva|wiki\/nueva|wiki\/p\/[\w-]+\/editar|ajustes|avisos|panel|entrar)$/;
  // Las que lo primero que hacen es pedir al servidor: ésas no esperan a los datos antes de pedir (las demás sí).
  const PIDE_ANTES = /^(|foro|hilo\/\d+|builds|build\/\d+|sugerencias|sugerencia\/\d+|wiki\/p\/[\w-]+|wiki\/p\/[\w-]+\/historial|u\/[^/]+|miembros|rangos|apoyar|avisos)$/;
  let sesionLista = Promise.resolve();
  async function arrancar() {
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = T(el.dataset.t); });
    document.querySelectorAll('[data-tp]').forEach(el => { el.placeholder = T(el.dataset.tp); });
    document.querySelectorAll('[data-ta]').forEach(el => { el.setAttribute('aria-label', T(el.dataset.ta)); });
    document.querySelectorAll('[data-ico]').forEach(el => { el.innerHTML = svgOf(el.dataset.ico); });
    const viejas = leer('psc.reglas');
    if (viejas && viejas.rangos && viejas.categorias) S.reglas = viejas;
    const reglas = get('/reglas').then(r => {
      const nuevas = JSON.stringify(r), cambian = !!S.reglas && JSON.stringify(S.reglas) !== nuevas;
      S.reglas = r; guardar('psc.reglas', r);
      return cambian;
    }).catch(() => false);
    const datos = cargarDatos().catch(e => console.error('datos', e));
    listo = Promise.all([viejas ? null : reglas, datos]);
    if (PRUEBA) {
      pintarMarco();
      selectorPrueba();
      await listo;
      await cargarYo();
      if (!S.reglas) { pintar(caja('', vacio(T('No llega el servidor de la comunidad. Prueba otra vez en un rato.')))); return; }
      await ir();
    } else {
      const antes = leer('psc.yo');
      if (antes && antes.u) ponerYo(antes);
      pintarMarco();
      let fb = null, avisar;
      const fbYa = () => fb || (fb = fbInit().catch(e => { console.error('firebase', e); return null; }));
      sesionLista = new Promise(res => { avisar = res; });
      const sesion = async () => {
        if (!(await fbYa())) { S.yo = null; S.sesion = 'fuera'; pintarMarco(); avisar(); return; }
        let primera = true;
        S.fb.auth().onAuthStateChanged(async user => {
          const habia = !!S.yo, era = primera;
          primera = false;
          S.user = user || null;
          if (user) await cargarYo();
          else { S.yo = null; S.sesion = 'fuera'; guardar('psc.yo', null); pintarMarco(); }
          avisar();
          // Otra vez, con lo tuyo (o sin la cuenta que se pintó y ya no está). Sin cuenta antes ni ahora, no hace falta.
          if (!era || user || habia) recargar();
        });
      };
      // Con cuenta la última vez, Firebase ya; sin ella, después de pintar (que no le quite red a la página).
      if (antes) sesion();
      const ruta = location.hash.replace(/^#\/?/, '').split('?')[0];
      if (!PRIVADA.test(ruta)) await ir();
      if (!antes) sesion();
      if (PRIVADA.test(ruta)) await ir();
      await listo;
      if (!S.reglas) { pintar(caja('', vacio(T('No llega el servidor de la comunidad. Prueba otra vez en un rato.')))); return; }
    }
    reglas.then(cambian => { if (cambian) recargar(); });
    setInterval(() => { if (S.yo && !document.hidden) cargarYo(); }, 60000);
  }
  arrancar();
})();
