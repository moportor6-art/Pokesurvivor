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
  var cfg = Object.assign({ meter: true, minimap: true, glow: false, fov: 1.15, endlessDefault: false }, load('cfg', {}));
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
    '.psp-opt .sw.on{background:#5fd35f}.psp-opt .sw.on:after{left:19px;background:#fff}.psp-fov{padding:8px;margin-bottom:8px}.psp-fov div{display:flex;gap:6px;margin-top:6px}'
  ].join('');

  window.PSPlus = { modules: M, failed: failed, endless: endless, cfg: cfg };   // para revisar desde las pruebas

  // ─── Bucle ───
  var lastState = '';
  var tick = safe('Bucle', function () {
    if (!modules()) return;
    hookEndless();
    hookUi();
    var st = M.G.state, pl = M.G.player;
    if (st === 'playing' && lastState !== 'playing' && lastState !== 'paused') { startRun(); applyFov(); }
    if (st === 'over' && (lastState === 'playing' || lastState === 'paused')) endRun();
    lastState = st;
    var inRun = (st === 'playing' || st === 'paused') && !!pl;
    if (inRun && st === 'playing') { sampleRun(pl); tickEndless(); applyFov(); }
    if (pl) { drawMeter(pl, st === 'playing'); drawMinimap(pl, st === 'playing'); drawGlow(pl, st === 'playing'); }
  });
  document.addEventListener('DOMContentLoaded', function () {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    setInterval(tick, 150);
  });
})();
