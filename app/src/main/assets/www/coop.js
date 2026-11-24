/*
 * PokéSurvivor Offline — Cooperativo con salas con código (hasta 4 jugadores).
 *
 * El juego original ya trae el cooperativo completo: los jugadores se conectan entre ellos (WebRTC) y el servidor de
 * pokesurvivor.com solo hacía de «sala» (quién está dentro, quién es el anfitrión) y de cartero para presentarlos.
 * Aquí esa parte la hace el teléfono de quien crea la sala, por PeerJS (lo mismo que DB Survivors):
 *   · window.WebSocket('…/rooms') → un socket falso que habla el mismo idioma que el servidor de salas del juego;
 *     en el anfitrión lo atiende el «servidor» de aquí mismo y en los invitados viaja por PeerJS hasta el anfitrión.
 *   · La lista de amigos del juego recibe un amigo ficticio, «Sala», para usar sus propios botones de invitar/aceptar.
 *   · Solo mientras hay una sala: el juego cree tener sesión (uid propio), la API de amigos responde aquí y las
 *     conexiones usan los servidores públicos de PeerJS (STUN/TURN). Fuera de la sala todo sigue 100 % local.
 * No toca el código del juego: lo encuentra por la forma de sus módulos (como local.js y plus.js).
 */
(function () {
  'use strict';
  var PREFIX = 'pksurvivor-sala-v1-', LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', AMIGO = 'sala';
  var WS = window.WebSocket;   // el de verdad (local.js lo reemplaza después)
  var C = { activa: false, host: false, codigo: '', uid: '', peer: null, enlace: null, sala: null, invitacion: null };
  window.PSCoop = C;

  // ─── Módulos del juego (por su forma) ───
  var M = {};
  function mod(test) {
    var G = window.PSLocal && window.PSLocal.game();
    if (!G) return null;
    for (var k in G) { var v = G[k]; try { if (v && typeof v === 'object' && test(v)) return v; } catch (e) { /* nada */ } }
    return null;
  }
  function modulos() {
    if (M.listos) return true;
    M.salas = mod(function (v) { return typeof v.sig === 'function' && typeof v.takeover === 'function' && v._env; });
    M.social = mod(function (v) { return typeof v.acceptInvite === 'function' && typeof v.claimNick === 'function'; });
    M.cuenta = mod(function (v) { return 'fb' in v && 'online' in v && typeof v.onLeave === 'function'; });
    M.api = mod(function (v) { return typeof v.call === 'function' && v._env && Object.keys(v).length === 2; });
    M.ice = mod(function (v) { return typeof v.relayOnly === 'function' && typeof v.now === 'function'; });
    M.sala = mod(function (v) { return typeof v.modeButton === 'function' && typeof v.conn === 'function'; });
    M.ui = mod(function (v) { return typeof v.isOpen === 'function' && typeof v.toast === 'function'; });
    if (!(M.salas && M.social && M.cuenta && M.api && M.ice && M.sala)) return false;
    parchear();
    M.listos = true;
    return true;
  }

  // ─── Parches (solo actúan con una sala activa) ───
  function parchear() {
    var cuenta = M.cuenta, d = Object.getOwnPropertyDescriptor(cuenta, 'fb'), dOn = Object.getOwnPropertyDescriptor(cuenta, 'online');
    var forzarOnline = false;
    Object.defineProperty(cuenta, 'fb', { configurable: true, get: function () { return C.activa ? { uid: C.uid, auth: null, emulator: false } : d.get.call(cuenta); } });
    Object.defineProperty(cuenta, 'online', { configurable: true, get: function () { return forzarOnline || dOn.get.call(cuenta); } });
    C._online = function (f) { forzarOnline = true; try { return f(); } finally { forzarOnline = false; } };
    M.salas._env.token = function () { return Promise.resolve(C.uid); };
    M.salas._env.WebSocket = Socket;
    var llamar = M.api.call;
    M.api.call = function (metodo, ruta, cuerpo) { return C.activa ? Promise.resolve(api(metodo, ruta, cuerpo)) : llamar.apply(this, arguments); };
    var ahora = M.ice.now, pedir = M.ice.get, soloRelay = M.ice.relayOnly;
    M.ice.now = function () { return C.activa ? turn() : ahora.apply(this, arguments); };
    M.ice.get = function () { return C.activa ? Promise.resolve(turn()) : pedir.apply(this, arguments); };
    M.ice.relayOnly = function () { return C.activa ? false : soloRelay.apply(this, arguments); };
    M.social.on(function (ev) {
      if (!C.activa) return;
      var s = M.social.room;
      if (s) C.sala = s.id;
      if (ev === 'room-closed' || (!s && C.sala && ev === 'room')) salir();
      pintarCodigo();
    });
  }
  function turn() {
    return [{ urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }];
  }

  // API de amigos del juego: solo existe el amigo «Sala» (y su invitación cuando te unes con un código)
  function api(metodo, ruta) {
    if (C.depurar) console.log('[coop] api', metodo, ruta);
    var ok = { status: 200, data: { ok: true } };
    if (metodo === 'GET' && /^\/(social|friends)\b/.test(ruta)) {
      var inv = C.invitacion ? [{ from: AMIGO, name: C.invitacion.nombre, room: C.invitacion.sala, at: M.social.now() }] : [];
      return { status: 200, data: { v: String(Date.now()), friends: [{ uid: AMIGO, name: 'Sala ' + C.codigo, status: 'ok' }], invites: inv } };
    }
    if (metodo === 'GET' && /^\/me/.test(ruta)) return { status: 200, data: { nick: nombre() } };
    if (metodo === 'GET' && /^\/profile/.test(ruta)) return { status: 404, data: null };
    return ok;
  }

  // ─── Socket falso de salas (el juego le habla como al servidor) ───
  function Socket(url) {
    var s = this;
    s.readyState = 0;
    s.url = url;
    s.send = function (txt) {
      if (s.readyState !== 1) return;
      var m; try { m = JSON.parse(txt); } catch (e) { return; }
      if (C.host) servidor.recibir(C.uid, m);
      else if (C.enlace && C.enlace.open) C.enlace.send(m);
    };
    s.close = function () {
      if (s.readyState === 3) return;
      s.readyState = 3;
      if (C.socket === s) C.socket = null;
      if (C.host) servidor.salir(C.uid);
      setTimeout(function () { if (s.onclose) s.onclose({ code: 1000 }); }, 0);
    };
    s.entregar = function (m) { if (s.readyState === 1 && s.onmessage) s.onmessage({ data: JSON.stringify(m) }); };
    C.socket = s;
    var abrir = function () { if (s.readyState !== 0) return; s.readyState = 1; if (s.onopen) s.onopen(); };
    if (C.host) { servidor.conectar(C.uid, s.entregar); setTimeout(abrir, 0); }
    else if (C.enlace && C.enlace.open) setTimeout(abrir, 0);
    else setTimeout(function () { s.readyState = 3; if (s.onclose) s.onclose({ code: 1006 }); }, 0);
  }
  Socket.CONNECTING = 0; Socket.OPEN = 1; Socket.CLOSING = 2; Socket.CLOSED = 3;
  // El resto de WebSocket sigue bloqueado como en local.js, salvo el de salas y el de PeerJS
  C.WebSocket = function (url, p) {
    if (/\/rooms$/.test(String(url))) return new Socket(url);
    if (/\.peerjs\.com[:/]/.test(String(url)) && C.activa) return p ? new WS(url, p) : new WS(url);
    throw new Error('Sin conexión: edición local');
  };

  // ─── Servidor de salas (en el teléfono del anfitrión) ───
  var servidor = (function () {
    var sala = null, conex = {};   // uid → función para enviarle
    function mandar(uid, m) { var f = conex[uid]; if (f) try { f(m); } catch (e) { /* nada */ } }
    function estado() {
      return { t: 'room', id: sala.id, host: sala.host, open: sala.open,
        members: Object.keys(sala.miembros).map(function (u) { return sala.miembros[u]; }) };
    }
    function avisar() { if (!sala) return; var e = estado(); Object.keys(sala.miembros).forEach(function (u) { mandar(u, e); }); }
    function quitar(uid, porque) {
      if (!sala || !sala.miembros[uid]) return;
      delete sala.miembros[uid];
      if (uid === sala.host) {   // se fue el anfitrión: la sala se cierra para todos
        Object.keys(sala.miembros).forEach(function (u) { mandar(u, { t: 'closed', id: sala.id, why: 'host' }); });
        sala = null;
        return;
      }
      if (porque) mandar(uid, { t: 'closed', id: sala.id, why: porque });
      avisar();
    }
    return {
      conectar: function (uid, f) { conex[uid] = f; },
      salir: function (uid) { quitar(uid); delete conex[uid]; },
      cerrar: function () { if (sala) quitar(sala.host); sala = null; conex = {}; },
      sala: function () { return sala; },
      recibir: function (uid, m) {
        if (!m || typeof m.t !== 'string') return;
        var res = function (o) { o.t = 'res'; o.q = m.id; mandar(uid, o); };
        if (m.t === 'auth') return mandar(uid, { t: 'hello' });
        if (m.t === 'create') {
          if (uid !== C.uid) return res({ ok: false, error: 'gone' });
          sala = { id: m.id, host: uid, open: true, miembros: {} };
          sala.miembros[uid] = miembro(uid, m.me);
          res({ ok: true }); avisar(); return;
        }
        if (m.t === 'join') {
          if (!sala || m.id !== sala.id) return res({ ok: false, error: 'gone' });
          if (!sala.miembros[uid]) {
            if (Object.keys(sala.miembros).length >= 4) return res({ ok: false, error: 'full' });
            if (!sala.open) return res({ ok: false, error: 'closed' });
          }
          sala.miembros[uid] = miembro(uid, m.me);
          res({ ok: true, host: sala.host }); avisar(); return;
        }
        if (!sala || !sala.miembros[uid]) return;
        if (m.t === 'leave') return quitar(uid);
        if (m.t === 'open' && uid === sala.host) { sala.open = !!m.v; return avisar(); }
        if (m.t === 'me') { sala.miembros[uid].dex = m.dex; sala.miembros[uid].shiny = !!m.shiny; return avisar(); }
        if (m.t === 'drop' && uid === sala.host && m.uid !== uid) return quitar(m.uid, 'kick');
        if (m.t === 'sig' && sala.miembros[m.to]) return mandar(m.to, { t: 'sig', f: uid, d: m.d });
      }
    };
    function miembro(uid, me) {
      me = me || {};
      return { uid: uid, name: String(me.name || 'Entrenador').slice(0, 16), dex: me.dex, shiny: !!me.shiny, at: me.at || Date.now() };
    }
  })();

  // ─── PeerJS ───
  function opciones() {
    var o = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }].concat(turn()) } };
    try { var x = JSON.parse(localStorage.getItem('ps.coop.peer') || 'null'); if (x) for (var k in x) o[k] = x[k]; } catch (e) { /* pruebas */ }
    return o;
  }
  function codigoNuevo() { var s = ''; for (var i = 0; i < 5; i++) s += LETRAS[Math.floor(Math.random() * LETRAS.length)]; return s; }
  function uidNuevo() { return 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function nombre() {
    var cu = M.cuenta;
    return String((cu && (cu.user || (cu.save && cu.save.name))) || 'Entrenador').replace(/[^A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]/g, '').slice(0, 16) || 'Entrenador';
  }
  function activar(host, codigo) {
    // El mismo uid toda la sesión: el juego lo guarda al arrancar lo social y no lo vuelve a leer
    C.activa = true; C.host = host; C.codigo = codigo; C.uid = C.uid || uidNuevo(); C.sala = null; C.invitacion = null;
    try { localStorage.setItem('ps.nick.' + C.uid, nombre().length >= 3 ? nombre() : nombre() + '___'.slice(nombre().length)); } catch (e) { /* nada */ }
  }
  function salir() {
    if (!C.activa) return;
    C.activa = false;
    servidor.cerrar();
    try { if (C.enlace) C.enlace.close(); } catch (e) { /* nada */ }
    try { if (C.peer) C.peer.destroy(); } catch (e) { /* nada */ }
    C.enlace = null; C.peer = null; C.sala = null; C.invitacion = null;
    var e = document.getElementById('ps-coop-codigo'); if (e) e.remove();
  }
  C.salir = salir;
  function iniciarSocial() {
    // El juego solo arranca lo social con sesión en línea: se le hace creer que la hay justo al arrancarlo
    return C._online(function () { return M.social.start(); }).then(function (r) {
      return M.social.ensureFriends().then(function () { return r; });
    });
  }
  function aviso(t) { if (M.ui) M.ui.toast(t, 3500); else alert(t); }   // eslint-disable-line no-alert

  C.crear = function () {
    if (!modulos()) return Promise.resolve(aviso('El cooperativo no está disponible en esta versión del juego.'));
    salir();
    var codigo = codigoNuevo();
    activar(true, codigo);
    return new Promise(function (ok, mal) {
      var p = C.peer = new window.Peer(PREFIX + codigo, opciones());
      p.on('open', function () { ok(); });
      p.on('error', function (e) {
        if (!C.sala) { mal(e); return; }
        if (e && e.type === 'peer-unavailable') return;
      });
      p.on('disconnected', function () { try { if (C.activa && !p.destroyed) p.reconnect(); } catch (e) { /* nada */ } });
      p.on('connection', function (cx) {
        var uid = null;
        cx.on('open', function () {
          var s = servidor.sala();
          cx.send({ t: 'info', sala: s && s.id, nombre: nombre(), lleno: !s || Object.keys(s.miembros).length >= 4 });
        });
        cx.on('data', function (m) {
          if (!m || typeof m !== 'object') return;
          if (m.t === 'auth') { uid = String(m.token || '').slice(0, 24); servidor.conectar(uid, function (x) { if (cx.open) cx.send(x); }); }
          if (uid) servidor.recibir(uid, m);
        });
        cx.on('close', function () { if (uid) servidor.salir(uid); });
      });
    }).then(function () {
      return iniciarSocial();
    }).then(function () {
      return M.social.invite(AMIGO);   // crea la sala (el juego la crea al invitar al primer amigo)
    }).then(function (r) {
      if (!M.social.room) throw new Error(r && r.error || 'sin sala');
      cerrarPanel(); M.sala.open(); pintarCodigo();
    }).catch(function (e) {
      salir();
      aviso('No se pudo crear la sala (' + (e && (e.type || e.message) || 'error') + '). ¿Tienes internet?');
    });
  };

  C.unirse = function (codigo) {
    codigo = String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (codigo.length !== 5) return Promise.resolve(aviso('El código tiene 5 letras.'));
    if (!modulos()) return Promise.resolve(aviso('El cooperativo no está disponible en esta versión del juego.'));
    salir();
    activar(false, codigo);
    return new Promise(function (ok, mal) {
      var p = C.peer = new window.Peer(PREFIX + 'j-' + C.uid, opciones());   // con id propio: sin él PeerJS lo pide por fetch (bloqueado)
      var t = setTimeout(function () { mal(new Error('No se encontró la sala ' + codigo)); }, 15000);
      p.on('error', function (e) { if (e && e.type === 'peer-unavailable') { clearTimeout(t); mal(new Error('No existe la sala ' + codigo)); } });
      p.on('disconnected', function () { try { if (C.activa && !p.destroyed) p.reconnect(); } catch (e) { /* nada */ } });
      p.on('open', function () {
        var cx = C.enlace = p.connect(PREFIX + codigo, { reliable: true });
        cx.on('data', function (m) {
          if (!m || typeof m !== 'object') return;
          if (m.t === 'info') {
            clearTimeout(t);
            if (!m.sala) return mal(new Error('Esa sala ya no existe'));
            if (m.lleno) return mal(new Error('La sala está llena (máximo 4)'));
            C.invitacion = { sala: m.sala, nombre: m.nombre };
            return ok();
          }
          if (C.socket) C.socket.entregar(m);
        });
        cx.on('close', function () {
          if (C.socket) C.socket.entregar({ t: 'closed', id: C.sala, why: 'host' });
        });
      });
    }).then(function () {
      return iniciarSocial();
    }).then(function () {
      return M.social.acceptInvite(AMIGO);
    }).then(function (r) {
      if (!r || !r.ok || !M.social.room) throw new Error(r && r.error || 'no se pudo entrar');
      cerrarPanel(); M.sala.open(); pintarCodigo();
    }).catch(function (e) {
      salir();
      aviso((e && e.message) || 'No se pudo entrar en la sala.');
    });
  };

  // ─── Interfaz ───
  var CSS = '#ps-coop{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;background:rgba(5,8,24,.72)}' +
    '#ps-coop .caja{background:#1b2245;border:2px solid #ffd23f;border-radius:14px;padding:18px 20px;width:min(92vw,380px);color:#fff;font:15px/1.4 system-ui,sans-serif;text-align:center}' +
    '#ps-coop h3{margin:0 0 6px;color:#ffd23f}#ps-coop p{margin:6px 0 14px;opacity:.85;font-size:.9em}' +
    '#ps-coop button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:10px 14px;margin:4px;cursor:pointer;background:#ffd23f;color:#1b2245}' +
    '#ps-coop button.sec{background:#3a4478;color:#fff}#ps-coop input{font:700 22px monospace;letter-spacing:6px;text-transform:uppercase;width:150px;text-align:center;padding:8px;border-radius:10px;border:2px solid #3a4478;background:#0f1430;color:#fff}' +
    '#ps-coop .fila{display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:wrap;margin:8px 0}' +
    '#ps-coop-btn{position:fixed;right:12px;bottom:12px;z-index:9000;font:700 15px system-ui,sans-serif;border:2px solid #1b2245;border-radius:12px;padding:10px 14px;background:#ffd23f;color:#1b2245;cursor:pointer;box-shadow:0 3px 0 #1b2245}' +
    '#ps-coop-codigo{margin:10px 0;padding:10px;border-radius:10px;background:rgba(255,210,63,.12);border:1px dashed #ffd23f;text-align:center}' +
    '#ps-coop-codigo b{font:700 28px monospace;letter-spacing:6px;color:#ffd23f;display:block}' +
    'body.ps-coop-on #lobby-invite,body.ps-coop-on #lobby-inv-title{display:none!important}';
  function panel() {
    if (document.getElementById('ps-coop')) return;
    var d = document.createElement('div');
    d.id = 'ps-coop';
    d.innerHTML = '<div class="caja"><h3>Cooperativo</h3><p>Juega con hasta 3 amigos por internet. Uno crea la sala y le pasa el código a los demás.</p>' +
      '<div class="fila"><button id="ps-coop-crear">Crear sala</button></div>' +
      '<div class="fila"><input id="ps-coop-cod" maxlength="5" placeholder="CÓDIGO" autocomplete="off"><button id="ps-coop-unir">Unirse</button></div>' +
      '<div class="fila"><button class="sec" id="ps-coop-cerrar">Cerrar</button></div><p id="ps-coop-estado" style="min-height:1.4em;margin:6px 0 0"></p></div>';
    document.body.appendChild(d);
    var est = d.querySelector('#ps-coop-estado'), ocupado = false;
    var correr = function (txt, f) {
      if (ocupado) return; ocupado = true; est.textContent = txt;
      f().then(function () { ocupado = false; est.textContent = ''; });
    };
    d.querySelector('#ps-coop-crear').onclick = function () { correr('Creando la sala…', C.crear); };
    d.querySelector('#ps-coop-unir').onclick = function () { var v = d.querySelector('#ps-coop-cod').value; correr('Buscando la sala…', function () { return C.unirse(v); }); };
    d.querySelector('#ps-coop-cod').onkeydown = function (e) { if (e.key === 'Enter') d.querySelector('#ps-coop-unir').click(); };
    d.querySelector('#ps-coop-cerrar').onclick = cerrarPanel;
    d.onclick = function (e) { if (e.target === d) cerrarPanel(); };
  }
  function cerrarPanel() { var d = document.getElementById('ps-coop'); if (d) d.remove(); }
  C.panel = panel;
  function pintarCodigo() {
    document.body.classList.toggle('ps-coop-on', C.activa);
    var lob = document.getElementById('lobby-members');
    if (!C.activa || !lob) return;
    var e = document.getElementById('ps-coop-codigo');
    if (!e) { e = document.createElement('div'); e.id = 'ps-coop-codigo'; lob.parentNode.insertBefore(e, lob.nextSibling); }
    var host = M.social && M.social.room && M.social.room.isHost;
    e.innerHTML = 'Código de la sala<b translate="no">' + C.codigo + '</b>' + (host ? 'Pásaselo a tus amigos: entran con «Cooperativo → Unirse».' : '');
  }
  // Botón del menú principal (solo en el menú)
  function boton() {
    var menu = document.getElementById('scr-menu');
    var b = document.getElementById('ps-coop-btn');
    var ver = menu && !menu.classList.contains('hidden') && !(M.social && M.social.room);
    if (ver && !b) {
      b = document.createElement('button'); b.id = 'ps-coop-btn'; b.textContent = '👥 Cooperativo';
      b.onclick = function () { if (window.PSLocal && window.PSLocal.game()) panel(); };
      document.body.appendChild(b);
    }
    if (b) b.style.display = ver ? '' : 'none';
  }
  function listo() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    setInterval(boton, 500);
    window.addEventListener('pagehide', function () { if (C.activa) salir(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', listo); else listo();
})();
