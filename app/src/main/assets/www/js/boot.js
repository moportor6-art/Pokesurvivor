window.PS_PAGES = !!document.querySelector('meta[name="ps-pages"]');
(function () {
  // El idioma lo elige locales.js (en el <head>).
  var copy = {
    es: ['Juego de supervivencia con Pokémon, gratis en el navegador y en el móvil.', 'Cargando…'],
    en: ['A Pokémon survival game, free in your browser and on mobile.', 'Loading…'],
    fr: ['Un jeu de survie Pokémon gratuit sur navigateur et mobile.', 'Chargement…'],
    it: ['Un gioco di sopravvivenza Pokémon gratuito su browser e cellulare.', 'Caricamento…'],
    'pt-BR': ['Um jogo de sobrevivência Pokémon grátis no navegador e no celular.', 'Carregando…'],
    'zh-Hans': ['免费的宝可梦生存游戏，可在浏览器和手机上游玩。', '加载中…'],
    'zh-Hant': ['免費的寶可夢生存遊戲，可在瀏覽器與手機上遊玩。', '載入中…']
  }[window.PS_LOCALES && window.PS_LOCALES.lang];
  if (!copy) return;
  var p = document.querySelectorAll('#boot p');
  p[0].textContent = copy[0]; p[1].textContent = copy[1];
})();
/*
 * (21-11-2026) La dirección del servidor: PS_HOST.http() / PS_HOST.ws(). Normalmente ice.pokesurvivor.com (detrás de
 * Cloudflare). En España algunas compañías bloquean IPs de Cloudflare durante el fútbol y no llega nada («sin conexión
 * con la base de datos»). Tras varios fallos de red seguidos se prueba la otra dirección (directo.pokesurvivor.com:8443,
 * sin Cloudflare) y, si responde, se usa 3 h (se recuerda en el navegador); pasado ese tiempo se vuelve a probar ice.
 * Sólo cuentan los fallos de red (sin respuesta): un error del servidor no cambia de dirección.
 *   PS_HOST.ok() tras una respuesta; PS_HOST.fail() tras un fallo de red → promesa: true si ha cambiado de dirección.
 */
window.PS_HOST = (function () {
  var CF = 'ice.pokesurvivor.com', DIR = 'directo.pokesurvivor.com:8443', KEY = 'ps_directo', TTL = 3 * 3600e3, LIMIT = 3;
  var until = 0, fails = 0, probing = null;
  try { until = +localStorage.getItem(KEY) || 0; } catch (e) { /* sin almacenamiento */ }
  function direct() { return until > Date.now(); }
  function host() { return direct() ? DIR : CF; }
  function set(d) {
    until = d ? Date.now() + TTL : 0; fails = 0;
    try { if (d) localStorage.setItem(KEY, String(until)); else localStorage.removeItem(KEY); } catch (e) { /* nada */ }
  }
  // ¿Responde la otra dirección? (El interruptor de mantenimiento: pequeño y sin sesión.) Si sí, se pasa a ella.
  function probe() {
    if (probing) return probing;
    var d = !direct(), ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var stop = setTimeout(function () { if (ctl) ctl.abort(); }, 5000);
    probing = fetch('https://' + (d ? DIR : CF) + '/mantenimiento.json', { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok; }, function () { return false; })
      .then(function (ok) { clearTimeout(stop); probing = null; if (ok) set(d); else fails = 0; return ok; });
    return probing;
  }
  return {
    http: function () { return 'https://' + host(); },
    ws: function () { return 'wss://' + host(); },
    direct: direct,
    ok: function () { fails = 0; },
    fail: function (now) {
      if (typeof fetch !== 'function' || typeof Promise !== 'function') return { then: function (f) { f(false); } };
      return (now || ++fails >= LIMIT) ? probe() : Promise.resolve(false);
    }
  };
})();
/*
 * (18-11-2026) El interruptor de mantenimiento (main.js readSwitch) se pide ya aquí, mientras se baja el juego: antes se
 * pedía al terminar de cargarlo todo y el arranque esperaba esa ida y vuelta al servidor (hasta 4 s si iba lento).
 * main.js usa esta promesa si está (y si no, la pide él, como antes). → promesa del modo (texto) o null.
 * (21-11-2026) Si no llega (fallo de red), se prueba al momento la otra dirección (PS_HOST) y se lee de allí.
 */
(function () {
  if (window.PS_FRAMED || typeof fetch !== 'function' || typeof Promise !== 'function') return;
  function read() {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var stop = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    return fetch(window.PS_HOST.http() + '/mantenimiento.json', { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(stop); window.PS_HOST.ok(); return r.ok ? r.json().then(null, function () { return null; }) : null; },
        function (e) { clearTimeout(stop); throw e; })
      .then(function (j) { return j && typeof j.modo === 'string' ? j.modo : null; });
  }
  try {
    window.PS_SWITCH = read().then(null, function () {
      return window.PS_HOST.fail(true).then(function (moved) { return moved ? read().then(null, function () { return null; }) : null; });
    });
  } catch (e) { window.PS_SWITCH = null; }
})();

