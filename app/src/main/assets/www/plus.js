/*
 * PokéSurvivor Offline — Plus (local).
 * Ideas de PokeSurvivor Plus (extensión MIT de PokeSurvivorPlus) rehechas para esta versión del juego y para el teléfono.
 * No toca el código del juego: se engancha a sus módulos por su forma (no por su nombre, que cambia entre versiones)
 * y cada mejora se apaga sola si el juego cambia y deja de encajar (el juego sigue como siempre).
 *
 *  · ∞ Sin fin: sin Juicio a los 30:00; las hordas siguen, cada vez más fuertes, con jefes cada 4 min.
 *    «Invocar a Arceus» en la pausa termina la partida con el Juicio.
 *  · Medidor de daño por movimiento (total, % y DPS) durante la partida.
 *  · Minimapa: enemigos, jefes y shinies alrededor.
 *  · Brillo rojo en los bordes con poca vida.
 *  · Campo de visión más amplio (ver más mapa).
 *  · Historial de partidas, récords por Pokémon y detalle de cada partida con gráfica de daño.
 *  Todo se configura en el panel «Plus» (toca las estadísticas del menú o el botón Plus en la pausa).
 */
(function () {
  'use strict';
  var LS = 'psplus.';
  function load(k, d) { try { var v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { /* lleno */ } }
  var cfg = Object.assign({ power: true, evo: true, berries: true, autoOrbs: true, sprint: true, meter: true, minimap: true, glow: false, fov: 1.15, endlessDefault: false }, load('cfg', {}));
  function saveCfg() { save('cfg', cfg); }
  var failed = {};
  function safe(name, fn) {
    return function () {
      if (failed[name]) return;
      try { return fn.apply(this, arguments); } catch (e) { failed[name] = String(e); console.warn('[plus] apagado: ' + name, e); }
    };
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; e.setAttribute('translate', 'no'); return e; }
  function fmtT(s) { s = Math.max(0, Math.floor(s || 0)); var m = Math.floor(s / 60); return m + ':' + ('0' + (s % 60)).slice(-2); }
  function fmtN(n) { n = Math.round(n || 0); return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : String(n); }
  function visible(id) { var e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; }

  // ─── Módulos del juego, reconocidos por su forma ───
  var M = {};
  function find(keys) {
    var B = window.PSLocal && window.PSLocal.game();
    if (!B) return null;
    for (var k in B) {
      var o = B[k];
      if (!o || typeof o !== 'object') continue;
      var ok = true;
      for (var i = 0; i < keys.length; i++) if (!(keys[i] in o)) { ok = false; break; }
      if (ok) return o;
    }
    return null;
  }
  function modules() {
    if (M.ready) return true;
    var B = window.PSLocal && window.PSLocal.game();
    if (!B) return false;
    M.G = find(['startRun', 'togglePause', 'player', 'clock', 'state']);
    M.J = B.Judgment;
    M.E = find(['queryCircle', 'bossAlive', 'shinies', 'all']);
    M.S = find(['banner', 'burst', 'debugBoss', 'CAP', 'update']);
    M.C = find(['VIEW_W', 'zoomTo', 'baseScale']);
    M.R = find(['inArena', 'rift', 'timeLeft']);
    M.X = find(['abort', 'takeOver', 'blocksRifts', 'fighting']);   // el evento de antes del Juicio (Eternatus)
    M.ready = !!(M.G && M.J && M.E);
    return M.ready;
  }

  // ─── ∞ Sin fin ───
  var endless = { armed: false, on: false, nextBoss: 0, hooked: false };
  var hookEndless = safe('Sin fin', function () {
    if (endless.hooked || !M.J || !M.S || !M.E) return;
    endless.hooked = true;
    var J = M.J, S = M.S, E = M.E, G = M.G;
    var jUp = J.update;
    J.update = function (dt, players, t) {   // sin Juicio mientras dure la partida sin fin
      if (endless.on && !J.active && !J.fighting && !J.cinematic) {
        // como el original a los 30:00: si la pelea previa sigue, se corta (si no, frenaría las hordas para siempre)
        var X = M.X;
        if (t >= J.AT && X && X.active && (X.fighting || X.cinematic) && !endless.cut) { endless.cut = true; X.abort(); }
        t = Math.min(t, J.AT - 1);
      }
      return jUp.call(this, dt, players, t);
    };
    var sUp = S.update;
    S.update = function (dt, players, t) {   // después de 29:00 las hordas repiten el tramo 25:00–29:00
      if (endless.on && t >= J.AT - 60) t = (J.AT - 300) + ((t - (J.AT - 300)) % 240);
      return sUp.call(this, dt, players, t);
    };
    var add = E.add;
    E.add = function (e) {   // y cada minuto pasado 30:00 son un 10 % más duras
      if (endless.on && e && G.time > J.AT && typeof e.hp === 'number') {
        var k = 1 + (G.time - J.AT) / 600;
        e.hp *= k; e.maxHp *= k;
        if (typeof e.dmg === 'number') e.dmg *= 1 + (k - 1) / 2;
      }
      return add.apply(this, arguments);
    };
  });
  var tickEndless = safe('Sin fin (jefes)', function () {
    if (!endless.on || !M.S || M.G.state !== 'playing') return;
    var t = M.G.time;
    if (t > M.J.AT && t >= endless.nextBoss) {
      endless.nextBoss = t + 240;
      if (!M.E.bossAlive()) M.S.debugBoss();
    }
  });
  function summonArceus() {
    endless.on = false;
    var r = $('#btn-resume'); if (r) r.click();
    toast('¡Arceus fue invocado!', '#ffd23f');
  }

  // ─── Medidor de daño ───
  var meterBox = null, dmgHist = [];
  var drawMeter = safe('Medidor de daño', function (pl, inRun) {
    if (!cfg.meter || !inRun) { if (meterBox) meterBox.style.display = 'none'; return; }
    if (!meterBox) {
      meterBox = el('div', 'psp-meter');
      meterBox.addEventListener('click', function () { meterBox.classList.toggle('min'); });
      document.body.appendChild(meterBox);
    }
    meterBox.style.display = '';
    var total = pl.dmgDealt || 0, now = M.G.time;
    dmgHist.push([now, total]);
    while (dmgHist.length > 2 && now - dmgHist[0][0] > 10) dmgHist.shift();
    var dps = dmgHist.length > 1 ? (total - dmgHist[0][1]) / Math.max(1, now - dmgHist[0][0]) : 0;
    var moves = (pl.moves || []).slice().sort(function (a, b) { return (b.dealt || 0) - (a.dealt || 0); });
    var html = '<div class="h">Daño ' + fmtN(total) + ' · ' + fmtN(dps) + '/s' + (endless.on ? ' · ∞' : '') + '</div>';
    if (!meterBox.classList.contains('min')) {
      for (var i = 0; i < moves.length; i++) {
        var m = moves[i], p = total > 0 ? (m.dealt || 0) / total : 0;
        html += '<div class="r"><span class="t t-' + m.type + '"></span><span class="n">' + (m.name || m.id) + '</span><span class="v">'
          + fmtN(m.dealt) + ' · ' + Math.round(p * 100) + '%</span><i style="width:' + Math.round(p * 100) + '%"></i></div>';
      }
    }
    if (meterBox.innerHTML !== html) meterBox.innerHTML = html;
  });

  // ─── Minimapa ───
  var mm = null;
  var drawMinimap = safe('Minimapa', function (pl, inRun) {
    if (!cfg.minimap || !inRun) { if (mm) mm.style.display = 'none'; return; }
    if (!mm) {
      mm = document.createElement('canvas');
      mm.className = 'psp-mm';
      mm.width = mm.height = 220;
      document.body.appendChild(mm);
    }
    mm.style.display = '';
    var c = mm.getContext('2d'), W = 220, R = 1400, k = (W / 2 - 6) / R;
    c.clearRect(0, 0, W, W);
    c.fillStyle = 'rgba(10,16,40,.55)';
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.stroke();
    var en = M.E.all() || [];
    for (var i = 0; i < en.length; i++) {
      var e = en[i];
      if (e.dead) continue;
      var dx = (e.x - pl.x) * k, dy = (e.y - pl.y) * k, d = Math.hypot(dx, dy), lim = W / 2 - 8;
      if (d > lim) { if (!e.boss && !e.shiny) continue; dx *= lim / d; dy *= lim / d; }
      c.fillStyle = e.boss ? '#ff4d5e' : e.shiny ? '#ffe14d' : 'rgba(230,236,255,.75)';
      var r = e.boss ? 7 : e.shiny ? 5 : 3;
      c.beginPath(); c.arc(W / 2 + dx, W / 2 + dy, r, 0, 6.2832); c.fill();
    }
    var rift = M.R && M.R.rift;
    if (rift && typeof rift.x === 'number') {
      var rx = (rift.x - pl.x) * k, ry = (rift.y - pl.y) * k, rd = Math.hypot(rx, ry), rl = W / 2 - 10;
      if (rd > rl) { rx *= rl / rd; ry *= rl / rd; }
      c.strokeStyle = '#b77dff'; c.lineWidth = 4; c.beginPath(); c.arc(W / 2 + rx, W / 2 + ry, 8, 0, 6.2832); c.stroke();
    }
    c.fillStyle = '#4dd2ff'; c.beginPath(); c.arc(W / 2, W / 2, 6, 0, 6.2832); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
  });

  // ─── Poca vida ───
  var glow = null;
  var drawGlow = safe('Brillo de poca vida', function (pl, inRun) {
    if (!glow) { glow = el('div', 'psp-glow'); document.body.appendChild(glow); }
    var low = cfg.glow && inRun && pl.maxHp > 0 && pl.hp / pl.maxHp < 0.2 && !pl.dead;
    glow.style.opacity = low ? String(0.55 + 0.35 * Math.sin(Date.now() / 180)) : '0';
  });

  // ─── Campo de visión ───
  var fovHooked = false, fovNow = 1;
  var applyFov = safe('Campo de visión', function () {
    if (!M.C || typeof M.C.baseScale !== 'function') return;
    if (!fovHooked) {   // la cámara calcula su escala con baseScale(): dividirla por el campo de visión aleja la vista
      fovHooked = true;
      var bs = M.C.baseScale;
      M.C.baseScale = function () { return bs.apply(this, arguments) / (cfg.fov || 1); };
    }
    if (fovNow !== cfg.fov) { fovNow = cfg.fov; window.dispatchEvent(new Event('resize')); }
  });

  // ─── Historial y récords ───
  var run = null;
  function startRun() {
    var pl = M.G.player;
    endless.on = endless.armed;
    endless.armed = false;
    endless.nextBoss = 0;
    endless.cut = false;
    spare = {}; if (window.PSPlus) window.PSPlus.spare = spare;
    try { var sv0 = saveObj(); achAtStart = sv0 && sv0.ach ? Object.keys(sv0.ach) : []; } catch (e) { achAtStart = null; }
    dmgHist = [];
    run = { at: Date.now(), dex: pl.dex, shiny: !!pl.shiny, name: (pl.mon && (pl.mon.name || pl.mon.n)) || '', endless: endless.on, series: [], lastS: 0 };
  }
  var sampleRun = safe('Historial', function (pl) {
    if (!run) return;
    var t = M.G.time;
    if (t - run.lastS >= 10) { run.lastS = t; run.series.push(Math.round(pl.dmgDealt || 0)); }
    run.last = { time: t, level: pl.level, kills: pl.kills, bosses: pl.bosses, dmg: pl.dmgDealt, dex: pl.dex, shiny: pl.shiny,
      moves: (pl.moves || []).map(function (m) { return { n: m.name || m.id, t: m.type, d: Math.round(m.dealt || 0) }; }),
      won: !!(M.J.active || M.J.fighting) };
  });
  var endRun = safe('Historial (fin)', function () {
    if (!run || !run.last) { run = null; return; }
    var L = run.last, rec = {
      at: run.at, dex: L.dex, shiny: !!L.shiny, name: run.name, endless: run.endless, time: Math.round(L.time), level: L.level,
      kills: L.kills, bosses: L.bosses, dmg: Math.round(L.dmg || 0), dps: Math.round((L.dmg || 0) / Math.max(1, L.time)), moves: L.moves, series: run.series
    };
    var runs = load('runs', []);
    runs.unshift(rec);
    save('runs', runs.slice(0, 60));
    var recs = load('records', {}), r = recs[rec.dex] || { runs: 0 }, news = [];
    r.runs++;
    [['time', 'tiempo'], ['level', 'nivel'], ['kills', 'derrotados'], ['dmg', 'daño'], ['dps', 'daño por segundo']].forEach(function (f) {
      if (r.runs > 1 && (rec[f[0]] || 0) > (r[f[0]] || 0)) news.push(f[1]);
      r[f[0]] = Math.max(r[f[0]] || 0, rec[f[0]] || 0);
    });
    r.name = rec.name || r.name;
    recs[rec.dex] = r;
    save('records', recs);
    if (news.length) toast('¡Nuevo récord con ' + (rec.name || 'tu Pokémon') + ': ' + news.join(', ') + '!', '#5fe08a');
    run = null;
    endless.on = false;
  });

  // ─── Avisos ───
  function toast(text, color) {
    var t = el('div', 'psp-toast', text);
    t.style.borderColor = color || '#ffd23f';
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2600);
    setTimeout(function () { t.remove(); }, 3200);
  }

  // ─── Panel Plus: partidas, récords y opciones ───
  var panel = null, tab = 'runs';
  function openPanel(which) {
    tab = which || tab;
    if (!panel) {
      panel = el('div', 'psp-panel');
      panel.addEventListener('click', function (e) {
        var b = e.target.closest('[data-a]');
        if (!b) { if (e.target === panel) closePanel(); return; }
        var a = b.dataset.a;
        if (a === 'close') closePanel();
        else if (a === 'tab') { tab = b.dataset.t; render(); }
        else if (a === 'run') { tab = 'run:' + b.dataset.i; render(); }
        else if (a === 'opt') { cfg[b.dataset.k] = !cfg[b.dataset.k]; saveCfg(); render(); }
        else if (a === 'fov') { cfg.fov = +b.dataset.v; saveCfg(); applyFov(); render(); }
        else if (a === 'clear') { if (b.dataset.sure) { save('runs', []); save('records', {}); render(); } else { b.dataset.sure = 1; b.textContent = '¿Seguro? Toca otra vez'; } }
      });
      document.body.appendChild(panel);
    }
    panel.style.display = '';
    render();
  }
  function closePanel() { if (panel) panel.style.display = 'none'; }
  window.psPlusClose = function () { if (panel && panel.style.display !== 'none') { closePanel(); return true; } return false; };

  function render() {
    var runs = load('runs', []), recs = load('records', {});
    var tabs = [['runs', 'Partidas'], ['recs', 'Récords'], ['opts', 'Opciones']];
    var h = '<div class="box psp-box"><div class="psp-top"><b>Plus</b><div class="psp-tabs">'
      + tabs.map(function (t) { return '<button class="btn small ' + (tab === t[0] || (t[0] === 'runs' && tab.indexOf('run:') === 0) ? 'gold' : 'ghost') + '" data-a="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('')
      + '</div><button class="btn small ghost" data-a="close">Volver</button></div><div class="psp-body">';
    if (tab === 'runs') {
      var tot = runs.reduce(function (a, r) { a.t += r.time; a.k += r.kills || 0; a.d += r.dmg || 0; return a; }, { t: 0, k: 0, d: 0 });
      h += '<div class="psp-sum">' + runs.length + ' partidas · ' + fmtT(tot.t) + ' jugado · ' + fmtN(tot.k) + ' derrotados · ' + fmtN(tot.d) + ' de daño</div>';
      if (!runs.length) h += '<p class="psp-empty">Todavía no hay partidas. ¡Juega una!</p>';
      runs.forEach(function (r, i) {
        h += '<button class="psp-run" data-a="run" data-i="' + i + '"><span class="n">' + (r.endless ? '∞ ' : '') + (r.name || ('#' + r.dex)) + (r.shiny ? ' ✦' : '')
          + '</span><span>' + fmtT(r.time) + '</span><span>Nv. ' + r.level + '</span><span>' + fmtN(r.kills) + ' derr.</span><span>' + fmtN(r.dps) + '/s</span><span class="d">'
          + new Date(r.at).toLocaleDateString() + '</span></button>';
      });
    } else if (tab.indexOf('run:') === 0) {
      var r = runs[+tab.slice(4)];
      if (r) {
        h += '<div class="psp-sum">' + (r.endless ? '∞ Sin fin · ' : '') + (r.name || '#' + r.dex) + (r.shiny ? ' ✦' : '') + ' · ' + fmtT(r.time) + ' · Nv. ' + r.level
          + ' · ' + fmtN(r.kills) + ' derrotados · ' + (r.bosses || 0) + ' jefes · ' + fmtN(r.dmg) + ' de daño · ' + fmtN(r.dps) + '/s</div>';
        h += '<canvas class="psp-graph" width="1000" height="260"></canvas><div class="psp-moves">';
        var tot2 = r.dmg || 1;
        (r.moves || []).slice().sort(function (a, b) { return b.d - a.d; }).forEach(function (m) {
          var p = Math.round(m.d / tot2 * 100);
          h += '<div class="r"><span class="t t-' + m.t + '"></span><span class="n">' + m.n + '</span><span class="v">' + fmtN(m.d) + ' · ' + p + '%</span><i style="width:' + p + '%"></i></div>';
        });
        h += '</div><button class="btn small ghost" data-a="tab" data-t="runs">← Partidas</button>';
      }
    } else if (tab === 'recs') {
      var ids = Object.keys(recs).sort(function (a, b) { return (recs[b].time || 0) - (recs[a].time || 0); });
      if (!ids.length) h += '<p class="psp-empty">Los récords de cada Pokémon aparecen aquí al terminar partidas.</p>';
      else h += '<div class="psp-rec h"><span class="n">Pokémon</span><span>Partidas</span><span>Tiempo</span><span>Nivel</span><span>Derrot.</span><span>Daño</span><span>DPS</span></div>';
      ids.forEach(function (id) {
        var x = recs[id];
        h += '<div class="psp-rec"><span class="n">' + (x.name || '#' + id) + '</span><span>' + x.runs + '</span><span>' + fmtT(x.time) + '</span><span>' + (x.level || 0)
          + '</span><span>' + fmtN(x.kills) + '</span><span>' + fmtN(x.dmg) + '</span><span>' + fmtN(x.dps) + '</span></div>';
      });
    } else if (tab === 'opts') {
      var opt = function (k, t, d) { return '<button class="psp-opt" data-a="opt" data-k="' + k + '"><span class="sw' + (cfg[k] ? ' on' : '') + '"></span><span><b>' + t + '</b><small>' + d + '</small></span></button>'; };
      h += opt('evo', 'Próxima evolución', 'Junto a tu vida: a qué evoluciona y en qué nivel (▲ si no evoluciona: nivel en que se hace más fuerte).');
      h += opt('power', 'Potencia en las cartas', 'Al aprender o mejorar un ataque: daño, golpes, recarga y daño por segundo (antes → después).');
      h += opt('sprint', 'Botón de correr', 'Acelerón de +60 % de velocidad 3 s cada 20 s (también con Mayús).');
      h += opt('autoOrbs', 'Esferas automáticas', 'Las esferas se usan solas: rodeado o con poca vida (Sopor, Ráfaga, Ralento), jefe cerca (Foco) o pantalla llena (Lumino).');
      h += opt('berries', 'Bayas de repuesto', 'Las bayas de vida que coges con la vida llena se guardan (hasta 5) y curan solas bajo el 35 %; una baya igual a la que llevas se guarda de repuesto (hasta 3).');
      h += opt('meter', 'Medidor de daño', 'Daño de cada movimiento y daño por segundo. Tócalo en partida para encogerlo.');
      h += opt('minimap', 'Minimapa', 'Enemigos (blanco), jefes (rojo), shinies (amarillo) y grietas (morado).');
      h += opt('glow', 'Brillo de poca vida', 'Bordes rojos y latido con menos del 20 % de vida (además del oscurecido del juego).');
      h += opt('endlessDefault', '∞ Sin fin por defecto', 'Jugar siempre sin fin (sin Juicio a los 30:00). También se puede elegir en cada partida.');
      h += '<div class="psp-fov"><b>Campo de visión</b><small>Ver más mapa alrededor (1× es como el original).</small><div>'
        + [1, 1.15, 1.25, 1.4].map(function (v) { return '<button class="btn small ' + (Math.abs(cfg.fov - v) < 0.01 ? 'gold' : 'ghost') + '" data-a="fov" data-v="' + v + '">' + v + '×</button>'; }).join('') + '</div></div>';
      var off = Object.keys(failed);
      h += '<p class="psp-empty">' + (off.length ? 'Apagado porque el juego cambió: ' + off.join(', ') : 'Todo funcionando con esta versión del juego.') + '</p>';
      h += '<button class="btn small ghost" data-a="clear">Borrar historial y récords</button>';
    }
    h += '</div></div>';
    panel.innerHTML = h;
    var g = panel.querySelector('.psp-graph');
    if (g) graph(g, runs[+tab.slice(4)]);
  }
  function graph(cv, r) {
    var c = cv.getContext('2d'), W = cv.width, H = cv.height, s = (r && r.series) || [];
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, 0, W, H);
    if (s.length < 2) { c.fillStyle = '#cfd8ff'; c.font = '28px sans-serif'; c.fillText('Partida muy corta para la gráfica', 30, H / 2); return; }
    var dps = [];
    for (var i = 1; i < s.length; i++) dps.push(Math.max(0, (s[i] - s[i - 1]) / 10));
    var max = Math.max.apply(null, dps) || 1;
    c.strokeStyle = 'rgba(255,255,255,.15)'; c.lineWidth = 1;
    for (var y = 1; y < 4; y++) { c.beginPath(); c.moveTo(0, H * y / 4); c.lineTo(W, H * y / 4); c.stroke(); }
    c.beginPath();
    dps.forEach(function (v, i) { var x = i / (dps.length - 1) * (W - 20) + 10, yy = H - 20 - v / max * (H - 50); i ? c.lineTo(x, yy) : c.moveTo(x, yy); });
    c.strokeStyle = '#ffd23f'; c.lineWidth = 5; c.stroke();
    c.fillStyle = '#cfd8ff'; c.font = '26px sans-serif';
    c.fillText('Daño por segundo · máx. ' + fmtN(max) + '/s', 14, 32);
  }

  // ─── Botones en el juego ───
  var hookUi = safe('Botones', function () {
    // «∞ Sin fin» dentro de Jugar
    var play = $('.menu-list [data-go="play"]');
    if (play && !play.querySelector('.psp-endless')) {
      var b = el('span', 'psp-endless', '∞ Sin fin');
      b.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); endless.armed = true; play.click(); }, true);
      play.appendChild(b);
      play.addEventListener('click', function () { if (cfg.endlessDefault) endless.armed = true; });
    }
    // Las estadísticas del menú abren el panel
    var stats = $('.menu-list > :not([data-go]):last-child');
    if (stats && !stats.dataset.psp) {
      stats.dataset.psp = 1;
      stats.classList.add('psp-statsbtn');
      stats.addEventListener('click', function () { openPanel('runs'); });
      stats.appendChild(el('span', 'psp-plus-tag', 'Plus ›'));
    }
    // Pausa: Invocar a Arceus (sin fin) y Plus
    var pause = $('#scr-pause .pause-box') || $('#scr-pause .box');
    if (pause && !pause.querySelector('.psp-pause')) {
      var row = el('div', 'psp-pause');
      var arc = el('button', 'btn gold psp-arceus', 'Invocar a Arceus');
      arc.addEventListener('click', summonArceus);
      var pl = el('button', 'btn ghost', 'Plus: opciones');
      pl.addEventListener('click', function () { openPanel('opts'); });
      row.appendChild(arc); row.appendChild(pl);
      var resume = $('#btn-resume');
      (resume && resume.parentNode === pause ? pause : (resume ? resume.parentNode : pause)).appendChild(row);
    }
    var arcBtn = $('.psp-arceus');
    if (arcBtn) arcBtn.style.display = endless.on ? '' : 'none';
    var badge = $('.psp-inf');
    if (endless.on && !badge) { badge = el('div', 'psp-inf', '∞ Sin fin'); document.body.appendChild(badge); }
    if (badge) badge.style.display = endless.on && M.G.state === 'playing' ? '' : 'none';
  });

  var CSS = [
    '.psp-meter{position:fixed;left:max(8px,env(safe-area-inset-left));top:22%;z-index:40;min-width:170px;max-width:240px;padding:6px 8px;border-radius:10px;background:rgba(10,16,40,.62);color:#eef2ff;font-size:11px;line-height:1.25;pointer-events:auto}',
    '.psp-meter .h{font-weight:bold;color:#ffd23f;margin-bottom:3px;white-space:nowrap}.psp-meter.min .r{display:none}',
    '.psp-meter .r,.psp-moves .r{position:relative;display:flex;gap:6px;align-items:center;padding:2px 0;white-space:nowrap}.psp-meter .r i,.psp-moves .r i{position:absolute;left:0;bottom:0;height:2px;background:#ffd23f;opacity:.7}',
    '.psp-meter .n,.psp-moves .n{flex:1;overflow:hidden;text-overflow:ellipsis}.psp-meter .v,.psp-moves .v{opacity:.85}',
    '.t{width:8px;height:8px;border-radius:50%;background:#aaa;flex:none}.t-fire{background:#ff7b3a}.t-water{background:#4d9dff}.t-grass{background:#5fd35f}.t-electric{background:#ffd23f}.t-ice{background:#8ff0ff}.t-fighting{background:#d04a3a}.t-poison{background:#b55fd3}.t-ground{background:#d9b25f}.t-flying{background:#9fb8ff}.t-psychic{background:#ff6fae}.t-bug{background:#a8c23a}.t-rock{background:#b8a45f}.t-ghost{background:#7a63b5}.t-dragon{background:#6f5fff}.t-dark{background:#6b5a4d}.t-steel{background:#a9b8c8}.t-fairy{background:#ffa8e0}.t-normal{background:#c8c2a8}',
    '.psp-mm{position:fixed;right:max(10px,env(safe-area-inset-right));top:64px;width:104px;height:104px;z-index:40;pointer-events:none;opacity:.9}',
    '.psp-glow{position:fixed;inset:0;z-index:39;pointer-events:none;opacity:0;box-shadow:inset 0 0 90px 30px rgba(255,30,50,.75);transition:opacity .15s}',
    '.psp-inf{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:40;color:#c9a8ff;font-size:12px;font-weight:bold;text-shadow:0 1px 2px #000;pointer-events:none}',
    '.psp-toast{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:60;padding:8px 14px;border-radius:10px;border:2px solid;background:rgba(14,22,56,.92);color:#fff;font-size:14px;transition:opacity .5s;pointer-events:none;text-align:center;max-width:80vw}.psp-toast.out{opacity:0}',
    '.menu-list [data-go="play"]{position:relative}.psp-endless{position:absolute;right:8px;bottom:8px;padding:4px 10px;border-radius:999px;background:#7b4ae0;color:#fff;font-size:12px;font-weight:bold;box-shadow:0 2px 0 #4a2a9a;cursor:pointer}',
    '.psp-statsbtn{position:relative;cursor:pointer}.psp-plus-tag{position:absolute;right:6px;top:3px;padding:1px 6px;border-radius:6px;background:#7b4ae0;color:#fff;font-size:9px;font-weight:bold}',
    '.psp-pause{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px}',
    '.psp-panel{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}',
    '.psp-box{width:min(94vw,860px);height:min(92vh,560px);display:flex;flex-direction:column;padding:10px 12px!important;color:#eef2ff}',
    '.psp-top{display:flex;gap:10px;align-items:center}.psp-top>b{font-size:20px;color:#ffd23f}.psp-tabs{flex:1;display:flex;gap:6px}',
    '.psp-body{flex:1;overflow:auto;margin-top:8px;-webkit-overflow-scrolling:touch}.psp-sum{margin:2px 0 8px;opacity:.9;font-size:13px}.psp-empty{opacity:.75;font-size:13px}',
    '.psp-run,.psp-rec{display:grid;grid-template-columns:2fr repeat(4,1fr) 1.2fr;gap:6px;width:100%;padding:7px 8px;margin:0 0 4px;border-radius:8px;border:0;background:rgba(255,255,255,.07);color:inherit;font:inherit;font-size:12px;text-align:left}',
    '.psp-rec{grid-template-columns:2fr repeat(6,1fr)}.psp-rec.h{background:none;opacity:.7}.psp-run .n,.psp-rec .n{font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.psp-run .d{opacity:.6}',
    '.psp-graph{width:100%;height:auto;border-radius:8px;margin-bottom:8px}.psp-moves{font-size:13px;margin-bottom:8px}',
    '.psp-opt{display:flex;gap:10px;align-items:center;width:100%;padding:8px;margin:0 0 6px;border-radius:8px;border:0;background:rgba(255,255,255,.07);color:inherit;font:inherit;text-align:left}',
    '.psp-opt small,.psp-fov small{display:block;opacity:.75;font-size:11px;margin-top:2px}',
    '.psp-opt .sw{flex:none;width:38px;height:22px;border-radius:11px;background:#3a4470;position:relative}.psp-opt .sw:after{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#cfd8ff;transition:left .15s}',
    '.psp-opt .sw.on{background:#5fd35f}.psp-opt .sw.on:after{left:19px;background:#fff}.psp-fov{padding:8px;margin-bottom:8px}.psp-fov div{display:flex;gap:6px;margin-top:6px}',
    '.psp-evo{position:fixed;left:calc(max(8px,env(safe-area-inset-left)) + 238px);top:14px;z-index:40;display:flex;align-items:center;gap:4px;padding:2px 8px 6px 6px;border-radius:10px;background:rgba(10,16,40,.55);color:#ffd23f;font-size:12px;pointer-events:none;position:fixed}',
    '.psp-evo .ar{color:#cfd8ff;font-size:12px}.psp-evo img{width:30px;height:30px;image-rendering:pixelated;border-radius:6px;background:rgba(255,255,255,.08)}',
    '.psp-evo .q{width:30px;height:30px;display:grid;place-items:center;border-radius:6px;background:rgba(255,255,255,.1);color:#fff;font-weight:bold;font-size:16px}.psp-evo .q.up{color:#5fe08a;font-size:13px}',
    '.psp-evo i{position:absolute;left:8px;right:8px;bottom:2px;height:3px;border-radius:2px;background:rgba(255,255,255,.15)}.psp-evo i u{display:block;height:100%;width:0;border-radius:2px;background:#ffd23f;text-decoration:none}.psp-evo.grow i u{background:#5fe08a}',
    '.psp-spare{position:fixed;left:calc(max(8px,env(safe-area-inset-left)) + 6px);top:58px;z-index:40;display:flex;gap:8px;padding:2px 8px;border-radius:8px;background:rgba(10,16,40,.55);font-size:11px;font-weight:bold;pointer-events:none}',
    '.psp-sprint{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:84px;z-index:41;width:64px;height:64px;border-radius:50%;border:3px solid #ffb24d;color:#fff;font:inherit;font-size:11px;padding:0;touch-action:none;',
    'background:conic-gradient(rgba(255,178,77,.55) calc(var(--f,100)*1%),rgba(10,16,40,.7) 0);opacity:.7}',
    '.psp-sprint.ready{opacity:1;box-shadow:0 0 12px rgba(255,178,77,.7)}.psp-sprint.active{background:#ffb24d;color:#1a1030}.psp-sprint b{pointer-events:none}',
    '.psp-badge{position:absolute;right:6px;top:6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ff3b4e;color:#fff;font-size:11px;line-height:18px;font-weight:bold;text-align:center;box-shadow:0 0 0 2px #1c2a66}',
    '.psp-badge.in{position:relative;right:auto;top:-1px;margin-left:6px;display:inline-block}.menu-list [data-go="goals"],#goals-tabs .tab{position:relative}',
    '.psp-claim{display:block;margin:-4px 0 4px auto}.psp-over{margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(95,224,138,.12);border:1px solid rgba(95,224,138,.45);text-align:center}',
    '.psp-over .l{font-size:13px;margin-bottom:6px}',
    '.psp-pw{margin-top:3px;font-size:11px;line-height:1.3;color:#ffd9a0}.psp-pw b{color:#ffe14d}.psp-pw i{opacity:.75;font-style:normal}',
    // Pokédex para teléfono
    '#scr-dex .box.wide{overflow:hidden!important;display:flex!important;flex-direction:column;padding-top:8px!important;padding-bottom:8px!important;gap:5px}',
    '#scr-dex .box.wide>.row{flex:none;margin:0!important}#scr-dex .box.wide>.row h2{font-size:17px;margin:0;white-space:nowrap}#scr-dex .box.wide>.row .btn{padding-top:3px;padding-bottom:3px}',
    '#scr-dex #dex-gens{flex:none;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;gap:5px;margin:0!important;padding:1px 0 3px;scrollbar-width:none}',
    '#scr-dex #dex-gens .gen-tab{flex:none;flex-direction:row!important;align-items:baseline;gap:5px;padding:4px 9px!important;min-height:0!important}#scr-dex #dex-gens .gen-tab b{font-size:13px}#scr-dex #dex-gens .gen-tab small{font-size:10px;opacity:.8}',
    '#scr-dex .split{flex:1;min-height:0;margin:0!important;grid-template-columns:minmax(0,1fr) 236px!important;gap:8px}',
    '#scr-dex .split>div:first-child{position:relative;min-height:0;display:flex!important;flex-direction:column;gap:5px}',
    '#scr-dex .dex-tools{flex:none;flex-wrap:nowrap!important;gap:5px;align-items:center}#scr-dex #dex-q{flex:1 1 120px;min-width:90px;height:30px}#scr-dex #dex-type{flex:0 1 120px;min-width:84px;height:30px}',
    '#scr-dex #dex-count{white-space:nowrap;font-size:11px}#scr-dex .psp-fbtn{flex:0 1 auto;max-width:150px;min-width:0;overflow:hidden}#scr-dex .psp-fbtn span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#scr-dex #dex-rand,#scr-dex #dex-clear{flex:none;padding-left:8px;padding-right:8px}#scr-dex #dex-rand{font-size:0!important;width:36px}#scr-dex #dex-rand img{width:16px;height:16px;margin:0}#scr-dex #dex-count{display:none}#scr-dex .psp-cnt{font-size:11px;opacity:.8;margin-left:6px}',
    '#scr-dex #dex-grid{flex:1;min-height:0;max-height:none!important;height:auto!important;overflow-y:auto!important;grid-template-columns:repeat(auto-fill,minmax(68px,1fr))!important;gap:5px!important;align-content:start;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
    '#scr-dex #dex-grid{grid-auto-rows:92px}#scr-dex #dex-grid .cell{height:92px!important;min-height:0!important;padding:3px 2px 2px!important;overflow:hidden}#scr-dex #dex-grid .cell canvas{width:54px!important;height:47px!important;margin:0 auto}',
    '#scr-dex #dex-grid .cell b{font-size:10px}#scr-dex #dex-grid .cell .no{font-size:9px}',
    '#scr-dex .psp-sheet{display:none;position:absolute;left:0;right:0;top:36px;z-index:5;padding:8px;border-radius:10px;background:#1c2a66;box-shadow:0 6px 18px rgba(0,0,0,.5);max-height:calc(100% - 36px);overflow-y:auto}',
    '#scr-dex .psp-sheet.open{display:block}.psp-sheet-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}',
    '#scr-dex .psp-sheet .filters{flex-wrap:wrap!important;overflow:visible!important;gap:5px;margin:0 0 6px!important}#scr-dex .psp-sheet .chip{font-size:12px}',
    '#scr-dex #dex-detail{min-height:0;overflow-y:auto!important;padding:6px!important}#scr-dex #dex-detail .dex-stage{transform:scale(.85);transform-origin:top center;margin-bottom:-14px}'
  ].join('');


  // ─── Pokédex para teléfono ───
  // La pantalla original apila 3 filas de filtros encima de la lista y deja muy poco para ver Pokémon.
  // Aquí: regiones en una tira deslizable, buscador + tipo + «Filtros» en una sola fila, y los filtros/orden
  // en una hoja que se abre encima de la lista (la lista usa toda la altura). El botón dice qué filtros están puestos.
  var dexHooked = false;
  var hookDex = safe('Pokédex móvil', function () {
    var scr = document.getElementById('scr-dex');
    if (!scr) return;
    var tools = scr.querySelector('.dex-tools'), filters = document.getElementById('dex-filters'), sort = document.getElementById('dex-sort');
    if (!tools || !filters || !sort) return;
    var btn = scr.querySelector('.psp-fbtn');
    if (!btn) {
      btn = el('button', 'btn small psp-fbtn', 'Filtros');
      var sheet = el('div', 'psp-sheet');
      var head = el('div', 'psp-sheet-h', '<b>Filtros y orden</b>');
      var ok = el('button', 'btn small gold', 'Listo');
      head.appendChild(ok);
      sheet.appendChild(head);
      sheet.appendChild(filters);
      sheet.appendChild(sort);
      tools.parentNode.appendChild(sheet);
      var rand = document.getElementById('dex-rand');
      tools.insertBefore(btn, rand || null);
      btn.addEventListener('click', function () { sheet.classList.toggle('open'); });
      ok.addEventListener('click', function () { sheet.classList.remove('open'); });
    }
    // Resumen de lo que está activo (sin contar «Todos» y el orden por número)
    var on = [].slice.call(filters.querySelectorAll('.chip.on')).concat([].slice.call(sort.querySelectorAll('.chip.on')))
      .filter(function (c, i, all) { return !(c.parentNode === filters && c === filters.querySelector('.chip')) && !(c.parentNode === sort && c === sort.querySelector('.chip')); })
      .map(function (c) { return c.textContent.trim(); });
    var ty = document.getElementById('dex-type');   // «Todos los tipos» no cabe: «Tipo: todos»
    if (ty && ty.options[0] && ty.options[0].value === '' && ty.options[0].text !== 'Tipo') ty.options[0].text = 'Tipo';
    var cnt = document.getElementById('dex-count'), h2 = scr.querySelector('.box.wide > .row h2');
    if (cnt && h2) {
      var c = h2.querySelector('.psp-cnt');
      if (!c) { c = el('span', 'psp-cnt'); h2.appendChild(c); }
      if (c.textContent !== '· ' + cnt.textContent) c.textContent = '· ' + cnt.textContent;
    }
    var label = on.length ? 'Filtros · ' + on.join(' · ') : 'Filtros';
    if (btn.dataset.l !== label) { btn.dataset.l = label; btn.innerHTML = '<span>' + label + '</span>'; btn.classList.toggle('gold', on.length > 0); }
  });


  // ─── Próxima evolución junto al HUD (como en PokéBonk) ───
  // Al lado de la vida: flecha, retrato de la evolución (o «?» si hay varias, como Eevee) y el nivel en que llega.
  // Si no evoluciona, dice en qué nivel se hace más fuerte; al final, nada.
  var evoBox = null, evoKey = '';
  var drawEvo = safe('Próxima evolución', function (pl, inRun) {
    var B = window.PSLocal && window.PSLocal.game(), V = B && find(['LEVELS', 'stageAt', 'line', 'preview']);
    if (!evoBox) { evoBox = el('div', 'psp-evo'); document.body.appendChild(evoBox); }
    var ev = pl.evo;
    if (!cfg.evo || !inRun || !V || !ev || ev.stage >= V.LEVELS.length || M.J.active) { evoBox.style.display = 'none'; return; }
    var lvl = V.LEVELS[ev.stage], opts = V.next(pl.dex) || [], data = B._07d519e || find(['setSprite', 'looks', 'data']);
    var dexOf = function (id) { var f = B._e26a824 && B._e26a824[id]; return f && f.dex ? f.dex : id; };
    var key = pl.dex + ':' + ev.stage + ':' + lvl + ':' + opts.join(',') + ':' + (pl.shiny ? 1 : 0);
    if (key !== evoKey) {
      evoKey = key;
      var html = '<span class="ar">➜</span>';
      if (opts.length === 1) {
        var d = dexOf(opts[0]);
        html += '<img src="assets/tienda/fotos-perfil/' + d + '/' + (pl.shiny ? 's/' : '') + 'normal.png" onerror="this.onerror=null;this.src=\'assets/tienda/fotos-perfil/' + d + '/normal.png\'">';
        try { evoBox.title = 'Evoluciona a ' + (B.T ? B.T(data.data(opts[0]).name) : data.data(opts[0]).name) + ' en el Nv. ' + lvl; } catch (e) { /* sin nombre */ }
      } else if (opts.length > 1) html += '<span class="q">?</span>';
      else html += '<span class="q up">▲</span>';
      html += '<b>Nv. ' + lvl + '</b><i><u></u></i>';
      evoBox.innerHTML = html;
      evoBox.classList.toggle('grow', !opts.length);
    }
    var prev = ev.stage > 0 ? V.LEVELS[ev.stage - 1] : 1, k = Math.max(0, Math.min(1, (pl.level - prev + (pl.xpNext ? pl.xp / pl.xpNext : 0)) / Math.max(1, lvl - prev)));
    var bar = evoBox.querySelector('u'); if (bar) bar.style.width = Math.round(k * 100) + '%';
    evoBox.style.display = '';
  });


  // ─── Bayas de repuesto ───
  // El juego guarda una baya de cada clase; si coges otra igual, gasta la que tenías en ese momento (aunque tengas
  // la vida llena y no te cure nada). Aquí la de más se guarda de repuesto (hasta 3 de cada) y entra sola en cuanto
  // se gasta la que llevas, así que la próxima vez que bajes del 25 % te vuelve a curar.
  var spare = {}, berryHooked = false, healing = false;
  function useSpareHeal(pl) {
    if (!cfg.berries || !spare.heal || !pl || pl.dead || !pl.maxHp || pl.hp / pl.maxHp >= 0.35 || M.G.state !== 'playing') return;
    spare.heal--;
    healing = true;
    try { pl.heal(0.3 * pl.maxHp); window.PSLocal.game().FX.dmgText(pl.x, pl.y - pl.bodyH - 10, '¡Cura guardada!', '#5fe08a', true); } finally { healing = false; }
  }
  var BERRY = { heal: ['Curas', '#5fe08a'], sitrus: ['Zidra', '#ffd23f'], atania: ['Atania', '#ff6f7d'], meloc: ['Meloc', '#7fd0ff'] };
  var hookBerries = safe('Bayas de repuesto', function (pl) {
    if (berryHooked || !pl) return;
    var proto = Object.getPrototypeOf(pl), B = window.PSLocal.game(), T = B.Items && B.Items.TREAT;
    if (!proto || typeof proto.takeTreat !== 'function' || typeof proto.useBerry !== 'function' || !T) return;
    berryHooked = true;
    var take = proto.takeTreat, use = proto.useBerry;
    proto.takeTreat = function (j) {
      if (cfg.berries && this === M.G.player && T[j] && T[j].berry && this.berries && this.berries[j] && (spare[j] || 0) < 3) {
        spare[j] = (spare[j] || 0) + 1;
        try { B.FX.dmgText(this.x, this.y - this.bodyH - 10, 'Baya ' + (BERRY[j] ? BERRY[j][0] : '') + ' de repuesto ×' + spare[j], '#9ff0c0', true); } catch (e) { /* nada */ }
        return;
      }
      return take.apply(this, arguments);
    };
    // Las bayas de vida del suelo (curan 30 %) con la vida casi llena se perdían: se guardan (hasta 5) y curan
    // solas cuando bajas del 35 %.
    var heal = proto.heal;
    proto.heal = function (amt) {
      if (cfg.berries && this === M.G.player && !this.dead && this.maxHp > 0 && Math.abs(amt - 0.3 * this.maxHp) < 1e-6
          && this.hp / this.maxHp >= 0.85 && !healing && (spare.heal || 0) < 5) {
        spare.heal = (spare.heal || 0) + 1;
        try { B.FX.dmgText(this.x, this.y - this.bodyH - 10, 'Cura guardada ×' + spare.heal, '#5fe08a', true); } catch (e) { /* nada */ }
        return;
      }
      return heal.apply(this, arguments);
    };
    proto.useBerry = function (j) {
      var had = this.berries && this.berries[j];
      var r = use.apply(this, arguments);
      if (had && this === M.G.player && this.berries && !this.berries[j] && spare[j] > 0) { spare[j]--; this.berries[j] = true; }
      return r;
    };
  });

  // ─── Esferas automáticas ───
  // Las esferas (Soporesfera, Ralentosfera, Rafagaesfera, Focosfera, Luminosfera, Rapidosfera) se usan solas
  // cuando hacen falta: rodeado o con poca vida, con un jefe cerca, o con la pantalla llena de enemigos.
  var orbT = 0;
  var autoOrbs = safe('Esferas automáticas', function (pl) {
    var S = find(['SLOTS', 'STACK', 'useSelected', 'canTake']);
    if (!cfg.autoOrbs || !S || !pl || pl.dead || M.G.state !== 'playing' || !pl.orbs) return;
    var now = M.G.time;
    if (now - orbT < 1.2) return;
    var slots = pl.orbs, has = function (id) { for (var i = 0; i < slots.length; i++) if (slots[i] && slots[i].id === id) return i; return -1; };
    var en = M.E.all() || [], near = 0, close = 0, onScreen = 0, boss = false;
    for (var i = 0; i < en.length; i++) {
      var e = en[i];
      if (e.dead) continue;
      var d2 = (e.x - pl.x) * (e.x - pl.x) + (e.y - pl.y) * (e.y - pl.y);
      if (d2 < 90 * 90) close++;
      if (d2 < 170 * 170) near++;
      if (d2 < 520 * 520) onScreen++;
      if ((e.boss || e.legend) && d2 < 380 * 380) boss = true;
    }
    var hp = pl.maxHp ? pl.hp / pl.maxHp : 1, pick = [], why = '';
    if (hp < 0.3 && (near >= 2 || boss)) { pick = ['slumber', 'blowback', 'slow', 'quick']; why = 'poca vida'; }
    else if (close >= 6 || near >= 14) { pick = ['blowback', 'slow', 'slumber']; why = 'rodeado'; }
    else if (boss && hp < 0.6) { pick = ['slow', 'focus']; why = 'jefe cerca'; }
    else if (boss) { pick = ['focus']; why = 'jefe cerca'; }
    else if (onScreen >= 30) { pick = ['luminous']; why = 'muchos enemigos'; }
    for (var k = 0; k < pick.length; k++) {
      var idx = has(pick[k]);
      if (idx < 0) continue;
      if (pick[k] === 'focus' || pick[k] === 'luminous' || pick[k] === 'quick') { if (pl.orbBuff && pl.orbBuff[pick[k]] > 0) continue; }
      orbT = now;
      var name = slots[idx].id;
      try { S.use(pl, idx); } catch (e) { return; }
      var L = S.BY && S.BY[name];
      toast('Auto: ' + (L ? L.name : name) + ' (' + why + ')', L ? L.col : '#ffd23f');
      return;
    }
  });

  // ─── Botón de correr ───
  // Un acelerón de vez en cuando: +60 % de velocidad 3 s, se recarga en 20 s (botón en pantalla o tecla Mayús).
  var sprint = { btn: null, until: 0, ready: 0, on: false };
  var DUR = 3, CD = 20, K = 1.6;
  function sprintGo() {
    if (!M.G || M.G.state !== 'playing') return;
    var t = M.G.time;
    if (t < sprint.ready) return;
    sprint.until = t + DUR; sprint.ready = t + CD;
    try { var pl = M.G.player; window.PSLocal.game().FX.ring(pl.x, pl.y, 6, 50, '#ffb24d', 0.4, 3); } catch (e) { /* nada */ }
  }
  document.addEventListener('keydown', function (e) { if (cfg.sprint && (e.key === 'Shift')) sprintGo(); });
  var tickSprint = safe('Correr', function (pl, inRun) {
    if (!sprint.btn) {
      sprint.btn = el('button', 'psp-sprint', '<b>Correr</b><i></i>');
      sprint.btn.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); sprintGo(); }, { passive: false });
      sprint.btn.addEventListener('click', function (e) { e.stopPropagation(); sprintGo(); });
      document.body.appendChild(sprint.btn);
    }
    sprint.btn.style.display = cfg.sprint && inRun && M.G.state === 'playing' ? '' : 'none';
    if (!inRun) { sprint.until = sprint.ready = 0; }
    var t = M.G.time, active = inRun && t < sprint.until;
    if (active) {
      if (pl.__pspSpr !== pl.spdMul) { pl.spdMul *= K; pl.__pspSpr = pl.spdMul; }
    } else if (pl.__pspSpr != null) {
      if (pl.spdMul === pl.__pspSpr) pl.spdMul /= K;
      pl.__pspSpr = null;
    }
    var left = Math.max(0, sprint.ready - t), f = left > 0 ? 1 - left / CD : 1;
    sprint.btn.classList.toggle('ready', f >= 1);
    sprint.btn.classList.toggle('active', active);
    sprint.btn.style.setProperty('--f', String(Math.round(f * 100)));
  });

  // Repuestos visibles junto a la próxima evolución
  var spareBox = null;
  var drawSpare = safe('Bayas de repuesto (vista)', function (inRun) {
    if (!spareBox) { spareBox = el('div', 'psp-spare'); document.body.appendChild(spareBox); }
    var html = '';
    if (cfg.berries && inRun) for (var j in spare) if (spare[j] > 0) html += '<span style="color:' + (BERRY[j] ? BERRY[j][1] : '#fff') + '">● ' + (BERRY[j] ? BERRY[j][0] : j) + ' +' + spare[j] + '</span>';
    if (spareBox.innerHTML !== html) spareBox.innerHTML = html;
    spareBox.style.display = html ? '' : 'none';
  });


  // ─── Cobrar todo (como en DB Survivors) ───
  // Al acabar la partida y en Misiones: un botón cobra de golpe todas las misiones completadas; los logros nuevos
  // de la partida se listan (el juego ya los paga al momento). En el menú, Misiones lleva un aviso rojo con cuántas hay.
  var achAtStart = null;
  function questMod() { return find(['pending', 'claim', 'checkAch', 'grant']); }
  function saveObj() { var B = window.PSLocal.game(), S = B && B._8a4e40d; if (S && S.save) return S.save; var m = find(['register', 'login', 'commit']); return m && m.save; }
  function readyMissions() {
    var sv = saveObj(), Q = questMod();
    if (!sv || !sv.missions || !Q) return [];
    var out = [];
    (sv.missions.daily || []).forEach(function (m) { if (Q.done(m) && !m.claimed) out.push([m, false]); });
    (sv.missions.weekly || []).forEach(function (m) { if (Q.done(m) && !m.claimed) out.push([m, true]); });
    return out;
  }
  function claimAll() {
    var Q = questMod(), sv = saveObj(), list = readyMissions();
    if (!Q || !list.length) return null;
    var t = sv.tickets || {}, before = { c: sv.coins || 0, t1: t.t1 || 0, t10: t.t10 || 0 }, n = 0;
    list.forEach(function (x) { try { if (Q.claim(x[0], x[1])) n++; } catch (e) { /* sigue con las demás */ } });
    var t2 = sv.tickets || {}, got = { n: n, c: (sv.coins || 0) - before.c, t1: (t2.t1 || 0) - before.t1, t10: (t2.t10 || 0) - before.t10 };
    var B = window.PSLocal.game();
    try { B.UI.refreshCoins(); } catch (e) { /* nada */ }
    toast('¡Cobrado! ' + n + (n === 1 ? ' misión' : ' misiones') + ': ' + [got.c ? got.c + ' monedas' : '', got.t1 ? got.t1 + ' tickets' : '', got.t10 ? got.t10 + ' tickets ×10' : ''].filter(Boolean).join(', '), '#5fe08a');
    return got;
  }
  function achNames(ids) {
    var B = window.PSLocal.game(), list = (B._4600659 && B._4600659.LIST) || [];
    var by = {}; list.forEach(function (a) { by[a.id] = a; });
    return ids.map(function (id) { var a = by[id]; return a ? (B.T ? B.T(a.name) : a.name) : id; });
  }
  var hookRewards = safe('Cobrar todo', function () {
    var n = readyMissions().length;
    // Aviso en el menú
    var tile = $('.menu-list [data-go="goals"]');
    if (tile) {
      var b = tile.querySelector('.psp-badge');
      if (!b) { b = el('span', 'psp-badge'); tile.appendChild(b); }
      b.textContent = n ? String(n) : '';
      b.style.display = n ? '' : 'none';
    }
    var tab = $('#goals-tabs [data-tab="missions"]');
    if (tab) {
      var tb = tab.querySelector('.psp-badge');
      if (!tb) { tb = el('span', 'psp-badge in'); tab.appendChild(tb); }
      tb.textContent = n ? String(n) : '';
      tb.style.display = n ? '' : 'none';
    }
    // Botón en Misiones
    var body = document.getElementById('goals-body');
    if (body && visible('scr-goals')) {
      var bt = body.querySelector('.psp-claim');
      if (n && !bt) {
        bt = el('button', 'btn gold psp-claim', 'Cobrar todo (' + n + ')');
        bt.addEventListener('click', function () { claimAll(); var t = $('#goals-tabs .tab.on'); if (t) t.click(); });
        body.insertBefore(bt, body.firstChild);
      } else if (bt && !n) bt.remove();
      else if (bt && bt.textContent !== 'Cobrar todo (' + n + ')') bt.textContent = 'Cobrar todo (' + n + ')';
    }
    // Fin de partida
    var overScr = document.getElementById('scr-over');
    if (overScr && visible('scr-over')) {
      var box = overScr.querySelector('.psp-over');
      if (!box) {   // en la columna de botones, justo debajo de «Volver a jugar»
        box = el('div', 'psp-over');
        var again = document.getElementById('over-again'), back = document.getElementById('over-back');
        if (again && again.parentNode) again.parentNode.insertBefore(box, again.nextSibling);
        else if (back && back.parentNode) back.parentNode.insertBefore(box, back);
        else (overScr.querySelector('.box') || overScr).appendChild(box);
      }
      var sv = saveObj(), nowAch = sv && sv.ach ? Object.keys(sv.ach) : [];
      var fresh = achAtStart ? nowAch.filter(function (id) { return achAtStart.indexOf(id) < 0; }) : [];
      var key = n + '|' + fresh.join(',');
      if (box.dataset.k !== key) {
        box.dataset.k = key;
        var h = '';
        if (fresh.length) h += '<div class="l">🏅 Logros nuevos (ya cobrados): ' + achNames(fresh).join(', ') + '</div>';
        if (n) h += '<div class="l">✔ ' + n + (n === 1 ? ' misión lista para cobrar' : ' misiones listas para cobrar') + '</div><button class="btn gold psp-claim2">Cobrar todo</button>';
        box.innerHTML = h;
        box.style.display = h ? '' : 'none';
        var c2 = box.querySelector('.psp-claim2');
        if (c2) c2.addEventListener('click', function () { claimAll(); box.dataset.k = ''; });
      }
    }
  });


  // ─── Potencia en las cartas de movimientos ───
  // Al aprender (subir de nivel, Quitamovimientos) sale la potencia del ataque: daño por golpe, golpes, recarga y
  // daño por segundo. Al mejorar uno que ya tienes: antes → después. Es la potencia base del ataque; el daño real
  // también sube con tu Ataque/At. Esp., tus mejoras y la eficacia de tipo.
  var nameMap = null;
  function moveMod() { return find(['BY_ID', 'instance', 'levelUp', 'nextUpText']); }
  function movesByName() {
    var Mv = moveMod(), B = window.PSLocal.game();
    if (!Mv) return null;
    if (!nameMap) {
      nameMap = {};
      for (var id in Mv.BY_ID) { var d = Mv.BY_ID[id]; if (d && d.name) { nameMap[d.name] = id; try { nameMap[B.T(d.name)] = id; } catch (e) { /* nada */ } } }
    }
    return nameMap;
  }
  function pw(m) { return { d: m.dmg || 0, n: m.count || 1, cd: m.cd || 1, p: m.pierce || 0, dps: (m.dmg || 0) * (m.count || 1) / (m.cd || 1) }; }
  function n1(x) { return (Math.round(x * 100) / 100).toString().replace('.', ','); }
  var cardPower = safe('Potencia en las cartas', function (pl) {
    if (!cfg.power) return;
    var Mv = moveMod(), map = movesByName();
    if (!Mv || !map) return;
    var cards = document.querySelectorAll('section.scr:not(.hidden) .card');
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], nm = c.querySelector('.nm');
      if (!nm || c.dataset.pspPw === nm.textContent) continue;
      c.dataset.pspPw = nm.textContent;
      var old = c.querySelector('.psp-pw'); if (old) old.remove();
      var title = (nm.firstChild && nm.firstChild.nodeType === 3 ? nm.firstChild.textContent : nm.textContent).trim().replace(/\s*\+$/, '');
      var id = map[title];
      if (!id || !Mv.BY_ID[id]) continue;
      var def = Mv.BY_ID[id], own = null;
      (pl && pl.moves || []).forEach(function (m) { if (m && m.id === id) own = m; });
      var html = '';
      if (!def.dmg) continue;   // de apoyo (Danza Espada…): ya dice que no hace daño
      if (own && own.lvl < def.maxLvl && !/Nuevo|New/i.test(nm.textContent)) {
        var a = pw(Mv.instance(id, own.lvl)), b = pw(Mv.instance(id, own.lvl + 1)), parts = [];
        if (Math.abs(b.d - a.d) > 0.05) parts.push('Daño ' + Math.round(a.d) + ' → <b>' + Math.round(b.d) + '</b>');
        if (b.n !== a.n) parts.push('Golpes ' + a.n + ' → <b>' + b.n + '</b>');
        if (Math.abs(b.cd - a.cd) > 0.005) parts.push('Recarga ' + n1(a.cd) + ' s → <b>' + n1(b.cd) + ' s</b>');
        if (b.p !== a.p) parts.push('Perfora ' + a.p + ' → <b>' + b.p + '</b>');
        parts.push('Daño/s ' + Math.round(a.dps) + ' → <b>' + Math.round(b.dps) + '</b> (' + (b.dps >= a.dps ? '+' : '') + Math.round((b.dps / Math.max(0.01, a.dps) - 1) * 100) + ' %)');
        html = 'Nv. ' + own.lvl + ' → ' + (own.lvl + 1) + ': ' + parts.join(' · ');
      } else {
        var x = pw(Mv.instance(id, 1));
        html = 'Potencia ' + Math.round(x.d) + (x.n > 1 ? ' ×' + x.n : '') + ' · cada ' + n1(x.cd) + ' s' + (x.p ? ' · perfora ' + x.p : '') + ' · <b>' + Math.round(x.dps) + ' daño/s</b>';
        if (own) html += ' <i>(Nv. ' + own.lvl + ' ahora: ' + Math.round(pw(own).dps) + ' daño/s)</i>';
      }
      var box = el('div', 'psp-pw', html);
      (c.querySelector('.txt') || c).appendChild(box);
    }
  });

  window.PSPlus = { claimAll: claimAll, readyMissions: readyMissions, modules: M, spare: spare, sprint: sprint, failed: failed, endless: endless, cfg: cfg };   // para revisar desde las pruebas

  // ─── Bucle ───
  var lastState = '';
  var tick = safe('Bucle', function () {
    if (!modules()) return;
    hookEndless();
    hookUi();
    hookRewards();
    hookDex();
    var st = M.G.state, pl = M.G.player;
    if (st === 'playing' && lastState !== 'playing' && lastState !== 'paused') { startRun(); applyFov(); }
    if (st === 'over' && (lastState === 'playing' || lastState === 'paused')) endRun();
    lastState = st;
    var inRun = (st === 'playing' || st === 'paused') && !!pl;
    if (inRun && st === 'playing') { sampleRun(pl); tickEndless(); applyFov(); }
    cardPower(pl);
    if (pl) { hookBerries(pl); useSpareHeal(pl); autoOrbs(pl); tickSprint(pl, inRun); drawSpare(inRun); drawEvo(pl, st === 'playing'); drawMeter(pl, st === 'playing'); drawMinimap(pl, st === 'playing'); drawGlow(pl, st === 'playing'); }
  });
  document.addEventListener('DOMContentLoaded', function () {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    setInterval(tick, 150);
  });
})();
