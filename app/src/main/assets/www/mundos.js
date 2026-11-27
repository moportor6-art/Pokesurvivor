/*
 * PokéSurvivor Offline — Mundo generado (worldgen, repo moportor6-art/worldgen; worldgen.js = dist/worldgen.js).
 * Como plus.js, no toca el código del juego: reconoce sus módulos por su forma.
 *  · Cuatro biomas nuevos (Playa Coral, Pantano Niebla, Ruinas del Desierto, Tundra Helada) que van rotando cada 4 min
 *    en vez de Bosque Umbrío / Cueva Cristal / Volcán Ceniza: se añaden a BIOMES y se cambia runBiome.
 *  · Estructuras repartidas por el mapa (ruinas, arenas de jefe y laberintos de piedra) con openHoles, la misma función
 *    con la que el juego levanta paredes por casilla.
 * Se activa con el botón «🌱 Mundo generado» del menú (se guarda). Si el juego cambia y algo deja de encajar, se apaga solo.
 */
(function () {
  'use strict';
  var KEY = 'psworldgen.on';
  var on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) { /* nada */ }
  var WG = window.WorldGen;
  if (!WG || !WG.adapters || !WG.adapters.pokesurvivor) return;
  var P = WG.adapters.pokesurvivor;
  var LISTA = ['playa', 'pantano', 'desierto', 'tundra'];

  function game() { return window.PSLocal && window.PSLocal.game(); }
  function find(keys) {
    var B = game(); if (!B) return null;
    for (var k in B) {
      var o = B[k];
      if (!o || typeof o !== 'object') continue;
      var ok = true;
      for (var i = 0; i < keys.length; i++) if (!(keys[i] in o)) { ok = false; break; }
      if (ok) return o;
    }
    return null;
  }

  var listo = false, base = -1, fallo = null;
  function enganchar() {
    if (listo || fallo) return listo;
    try {
      var BI = find(['runBiome', 'paintChunk', 'BIOMES']);
      var W = find(['openHoles', 'setBiome', 'reset', 'MENU_SEED']);
      if (!BI || !W) return false;
      // Biomas: se añaden al final de BIOMES (mismo esquema que los del juego)
      base = BI.BIOMES.length;
      LISTA.forEach(function (k) { BI.BIOMES.push(WG.biomas.pokesurvivor[k]); });
      var rb = BI.runBiome;
      BI.runBiome = function (n) {
        if (!on || window.PS_WG_PAUSA) return rb.apply(this, arguments);
        return base + (Math.max(0, n | 0) % LISTA.length);
      };
      // Estructuras: después de cada reset del mundo (inicio de partida), con su semilla
      var rs = W.reset;
      W.reset = function (seed) {
        var r = rs.apply(this, arguments);
        if (on && seed !== W.MENU_SEED) {
          try {
            var est = P.estructuras(seed, { cantidad: 12, radioMin: 16, radioMax: 120, tipos: ['ruinas', 'arena', 'laberinto'] });
            var paredes = [];
            est.forEach(function (e) {
              e.filas.forEach(function (f, y) {
                for (var x = 0; x < f.length; x++) if (f[x] === '#') paredes.push(e.tx + x, e.ty + y);
              });
            });
            W.openHoles(paredes);
            window.PS_WG_ULTIMO = { semilla: seed, estructuras: est.map(function (e) { return { tipo: e.tipo, tx: e.tx, ty: e.ty, w: e.w, h: e.h }; }) };
          } catch (e) { console.warn('[mundos] estructuras', e); }
        }
        return r;
      };
      listo = true;
    } catch (e) { fallo = String(e); console.warn('[mundos] apagado', e); }
    return listo;
  }
  var t = setInterval(function () { if (enganchar() || fallo) clearInterval(t); }, 300);

  // Botón en el menú
  function boton() {
    var menu = document.getElementById('scr-menu');
    if (!menu || document.getElementById('ps-wg-btn')) return;
    var b = document.createElement('button');
    b.id = 'ps-wg-btn'; b.type = 'button'; b.setAttribute('translate', 'no');
    b.style.cssText = 'position:absolute;left:10px;bottom:10px;z-index:5;padding:8px 12px;border-radius:10px;border:2px solid #7ee08a;' +
      'background:rgba(20,40,24,.85);color:#e8ffe8;font:inherit;font-size:13px;cursor:pointer';
    function pinta() { b.textContent = (on ? '🌱 Mundo generado: SÍ' : '🌱 Mundo generado: no'); b.style.opacity = on ? '1' : '.75'; }
    b.onclick = function () { on = !on; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* nada */ } pinta(); };
    pinta();
    menu.appendChild(b);
  }
  var tb = setInterval(function () { boton(); if (document.getElementById('ps-wg-btn')) clearInterval(tb); }, 500);
  window.PSWorldgen = { activo: function () { return on; }, poner: function (v) { on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* nada */ } }, listo: function () { return listo; }, fallo: function () { return fallo; } };
})();
