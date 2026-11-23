/*
 * PokéSurvivor Offline — capa local.
 * Se carga antes que el juego (index.html) y NO modifica el código original: solo
 *  · deja todo en el teléfono: nada sale a internet (cuentas, servidor, avisos, videos, Firebase, service worker);
 *  · crea sola la partida local la primera vez (solo pide el nombre de entrenador) y entra sola después;
 *  · esconde lo que necesita servidor o lleva fuera: Google, invitado, cerrar sesión, YouTube, Discord, apoyo,
 *    foro, amigos/salas, clasificación online, vincular Gmail;
 *  · deja los eventos de temporada (Halloween) siempre activos;
 *  · añade «Actualizaciones» en Ajustes (busca la versión nueva y baja solo lo que cambió).
 */
(function () {
  'use strict';
  window.PS_OFFLINE = true;
  var NATIVE = window.PSNative || null;
  var PASS_KEY = 'ps.offline.pass';

  // ─── 1. Nada sale a internet ───
  function isLocal(url) {
    try { return new URL(url, location.href).origin === location.origin; } catch (e) { return false; }
  }
  var nativeFetch = window.fetch && window.fetch.bind(window);
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (!isLocal(url)) return Promise.reject(new TypeError('Sin conexión: edición local'));
      return nativeFetch(input, init);
    };
  }
  var xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url) {
    if (!isLocal(url)) { arguments[1] = 'about:blank#bloqueado'; }
    return xhrOpen.apply(this, arguments);
  };
  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.register = function () { return Promise.reject(new Error('sin service worker')); };
    }
  } catch (e) { /* nada */ }
  ['open'].forEach(function (k) {
    var orig = window[k];
    window[k] = function (url) { if (url && !isLocal(url)) return null; return orig.apply(window, arguments); };
  });
  try {   // WebSocket / WebRTC (salas online): no hay servidor
    window.WebSocket = function () { throw new Error('Sin conexión: edición local'); };
  } catch (e) { /* nada */ }

  // ─── 2. Acceso a los módulos del juego (sin tocar su código) ───
  // El juego guarda sus módulos en un objeto creado con Object.create(null); lo reconocemos por su forma.
  var create = Object.create, candidates = [];
  Object.create = function (proto) {
    var o = create.apply(this, arguments);
    if (proto === null && candidates.length < 64) candidates.push(o);
    return o;
  };
  function game() {
    for (var i = 0; i < candidates.length; i++) {
      var o = candidates[i];
      if (o && o.Marcos && o.Eggs && o.Halloween) return o;
    }
    return null;
  }
  function saves(G) {   // el módulo de partidas: el que tiene register/login/commit
    for (var k in G) {
      var v = G[k];
      if (v && typeof v === 'object' && typeof v.register === 'function' && typeof v.login === 'function' && typeof v.commit === 'function') return v;
    }
    return null;
  }

  // ─── 3. Eventos de temporada siempre activos ───
  var eventsPatched = false;
  function patchEvents(G) {
    if (eventsPatched || !G.Halloween) return;
    var H = G.Halloween;
    try {
      var runStart = H.runStart;
      Object.defineProperty(H, 'on', { configurable: true, get: function () { return true; } });
      Object.defineProperty(H, 'inRun', { configurable: true, get: function () { return true; } });
      H.isOn = function () { return true; };
      H.countdown = function () { return null; };   // sin cuenta atrás: no termina nunca
      H.runStart = function (n) { return runStart.call(H, n == null ? true : n); };
      eventsPatched = true;
    } catch (e) { /* si cambia el módulo, el juego sigue con sus fechas */ }
  }

  // ─── 4. Partida local sin cuentas ───
  function randomPass() {
    var a = new Uint8Array(18);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function pass() {
    var p = localStorage.getItem(PASS_KEY);
    if (!p) { p = randomPass(); localStorage.setItem(PASS_KEY, p); }
    return p;
  }
  function accountNames() {
    try { return Object.keys(JSON.parse(localStorage.getItem('ps.accounts') || '{}')); } catch (e) { return []; }
  }
  function visible(id) {
    var el = document.getElementById(id);
    return !!el && !el.classList.contains('hidden') && !el.hidden && getComputedStyle(el).display !== 'none';
  }
  var autoTried = false;
  function loginScreen() {
    var scr = document.getElementById('scr-login');
    if (!scr || !visible('scr-login')) return;
    var tabs = scr.querySelectorAll('.tabs .tab'), user = document.getElementById('f-user'),
      pw = document.getElementById('f-pass'), go = document.getElementById('btn-auth');
    if (!tabs.length || !user || !pw || !go) return;
    var names = accountNames();
    if (names.length && !autoTried && localStorage.getItem(PASS_KEY)) {
      // Ya hay partida en el teléfono: entrar solo
      autoTried = true;
      tabs[0].click();
      var acc = {};
      try { acc = JSON.parse(localStorage.getItem('ps.accounts') || '{}'); } catch (e) { /* nada */ }
      var key = names[0], a = acc[key] || {};
      user.value = a.name || a.n || key;
      pw.value = pass();
      go.click();
      return;
    }
    // Primera vez: solo el nombre de entrenador
    if (!scr.classList.contains('ps-local')) {
      scr.classList.add('ps-local');
      tabs[1] && tabs[1].click();
      var label = scr.querySelector('label[for="f-user"]') || (user.previousElementSibling && user.previousElementSibling.tagName === 'LABEL' ? user.previousElementSibling : null);
      if (label) { label.textContent = 'Nombre de entrenador'; label.setAttribute('translate', 'no'); }
      user.placeholder = 'Tu nombre';
      user.setAttribute('translate', 'no');
      user.maxLength = 16;
      var note = document.createElement('p');
      note.className = 'ps-local-note';
      note.setAttribute('translate', 'no');
      note.textContent = 'Partida local: se guarda en este teléfono, sin cuentas y sin internet.';
      user.parentNode.insertBefore(note, user);
    }
    if (go.textContent !== '¡Empezar!') { go.textContent = '¡Empezar!'; go.setAttribute('translate', 'no'); }
    pw.value = pass();
  }
  // El botón de empezar siempre lleva la contraseña local (nunca se le pide al jugador)
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('#btn-auth');
    if (t) { var pw = document.getElementById('f-pass'); if (pw) pw.value = pass(); }
  }, true);

  // ─── 5. Esconder lo que necesita servidor o lleva fuera de la app ───
  var CSS = [
    '#btn-google,#btn-guest,#btn-logout,#set-logout,#btn-yt,#btn-discord,#btn-support,#menu-forum,#menu-banner,',
    '#rec-link,#video-yt,#chal-rank,#legal-delete,#f-forgot,[data-go="friends"],[data-go="rank"],#scr-mod{display:none!important}',
    // los huecos de Amigos y Clasificación los ocupan Gacha y Misiones
    '.menu-list [data-go="gacha"]{grid-row:1 / span 2!important}.menu-list [data-go="goals"]{grid-column:7 / span 4!important}',
    '#scr-login .tabs,#scr-login #f-pass,#scr-login label[for="f-pass"]{display:none!important}',
    '#scr-login.ps-local .ps-local-note{margin:4px 0 10px;color:#ffd23f;font-size:.85em;line-height:1.35}',
    '.ps-upd{margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.15)}',
    '.ps-upd h4{margin:0 0 6px;color:#ffd23f}.ps-upd p{margin:4px 0 10px;opacity:.85;font-size:.9em}',
    '.ps-upd button{margin:0 8px 8px 0}'
  ].join('');
  function hideMisc() {
    // Etiqueta de la contraseña (si no tiene for=) y aviso de «si te piden pagar» de la portada
    var pw = document.getElementById('f-pass');
    if (pw && pw.previousElementSibling && pw.previousElementSibling.tagName === 'LABEL') pw.previousElementSibling.style.display = 'none';
    // Los enlaces externos que queden (créditos, etc.) no se pueden abrir: se muestran como texto
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href');
      if (h && /^(https?:)?\/\//.test(h) && !isLocal(h)) { links[i].removeAttribute('href'); links[i].removeAttribute('target'); links[i].style.pointerEvents = 'none'; }
    }
  }

  // ─── 6. Actualizaciones (en Ajustes → Acerca de) ───
  var updBox = null;
  function updatesPanel() {
    var set = document.getElementById('scr-settings'), body = document.getElementById('set-body');
    if (!set || !body || !NATIVE) return;
    var on = set.querySelector('.gen-tab.on');
    var about = on && on.dataset.t === 'about' && visible('scr-settings');
    if (!about) { if (updBox && updBox.parentNode) updBox.parentNode.removeChild(updBox); return; }
    if (updBox && updBox.parentNode === body) return;
    var info = {};
    try { info = JSON.parse(NATIVE.updInfo()); } catch (e) { /* nada */ }
    updBox = document.createElement('div');
    updBox.className = 'ps-upd';
    updBox.setAttribute('translate', 'no');
    updBox.innerHTML = '<h4>Actualizaciones</h4><p>PokéSurvivor Offline ' + (info.name || '')
      + (info.active ? ' · contenido al día: build ' + info.active : '')
      + '. Al actualizar solo se descarga lo que cambió.</p>'
      + '<button class="btn small gold" data-u="check">Buscar actualización</button>'
      + (info.active ? '<button class="btn small ghost" data-u="reset">Volver a la versión de la app</button>' : '');
    updBox.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.u === 'check') NATIVE.updCheck();
      if (b.dataset.u === 'reset') NATIVE.updReset();
    });
    body.insertBefore(updBox, body.firstChild);
  }

  // ─── 7. Atrás de Android (lo llama la app) ───
  window.psBack = function () {
    var open = Array.prototype.filter.call(document.querySelectorAll('section.scr'), function (s) {
      return !s.classList.contains('hidden') && !s.hidden && getComputedStyle(s).display !== 'none';
    });
    if (!open.length) {   // en plena partida: pausa
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      return 'paused';
    }
    var top = open[open.length - 1];
    if (top.id === 'scr-menu' || top.id === 'scr-login' || top.id === 'scr-test') return 'exit';
    if (top.id === 'scr-pause') { var r = document.getElementById('btn-resume'); if (r) { r.click(); return 'resumed'; } }
    var close = top.querySelector('[id$="-close"],[id$="-back"],.btn.ghost');
    if (close) { close.click(); return 'closed'; }
    return 'exit';
  };

  // ─── Arranque ───
  var booted = false;
  function tick() {
    var G = game();
    if (G) patchEvents(G);
    loginScreen();
    hideMisc();
    updatesPanel();
    if (!booted && visible('scr-menu')) {
      booted = true;
      try { NATIVE && NATIVE.updBooted(); } catch (e) { /* nada */ }
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    tick();
    setInterval(tick, 400);
  });
  document.addEventListener('visibilitychange', function () {   // guardar al salir de la app
    if (!document.hidden) return;
    try { var G = game(), S = G && saves(G); if (S && S.loggedIn) S.commit(); } catch (e) { /* nada */ }
  });
})();
