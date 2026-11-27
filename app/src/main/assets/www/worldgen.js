var WorldGen = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    adapters: () => adapters,
    biomas: () => biomas,
    core: () => core,
    version: () => version
  });

  // src/rng.js
  function hashSeed(seed) {
    if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
    const s = String(seed);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function createRng(seed) {
    let a = hashSeed(seed) || 1;
    const next = () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const rng = {
      next,
      /** Decimal en [a, b). */
      range: (lo, hi) => lo + next() * (hi - lo),
      /** Entero en [a, b]. */
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      chance: (p) => next() < p,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      /** Elige por peso: [{peso, ...}] o pares [valor, peso]. */
      weighted(items, key = "peso") {
        const w = items.map((it) => {
          var _a;
          return Array.isArray(it) ? it[1] : (_a = it[key]) != null ? _a : 1;
        });
        let r = next() * w.reduce((s, x) => s + x, 0);
        for (let i = 0; i < items.length; i++) if ((r -= w[i]) < 0) return Array.isArray(items[i]) ? items[i][0] : items[i];
        return Array.isArray(items.at(-1)) ? items.at(-1)[0] : items.at(-1);
      },
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      },
      /** Sub-generador independiente (para que añadir una capa no cambie las demás). */
      fork: (tag) => createRng(hashSeed(`${seed}|${tag}`))
    };
    return rng;
  }

  // src/noise.js
  var GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  var F2 = 0.5 * (Math.sqrt(3) - 1);
  var G2 = (3 - Math.sqrt(3)) / 6;
  function createNoise(seed) {
    const rng = createRng(seed);
    const p = rng.shuffle(Array.from({ length: 256 }, (_, i) => i));
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    function simplex(x, y) {
      const s = (x + y) * F2;
      const i = Math.floor(x + s), j = Math.floor(y + s);
      const t = (i + j) * G2;
      const x0 = x - (i - t), y0 = y - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0;
      const corner = (gx, gy, dx, dy) => {
        const tt = 0.5 - dx * dx - dy * dy;
        if (tt < 0) return 0;
        const g = GRAD[perm[gx + perm[gy]] & 7];
        return tt ** 4 * (g[0] * dx + g[1] * dy);
      };
      n += corner(ii, jj, x0, y0);
      n += corner(ii + i1, jj + j1, x1, y1);
      n += corner(ii + 1, jj + 1, x2, y2);
      return 70 * n;
    }
    function fbm(x, y, { octaves = 4, lacunarity = 2, gain = 0.5 } = {}) {
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += amp * simplex(x * freq, y * freq);
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
      }
      return sum / norm;
    }
    return { simplex, fbm };
  }

  // src/geom.js
  var geom_exports = {};
  __export(geom_exports, {
    capsuleHit: () => capsuleHit,
    chaikin: () => chaikin,
    distToPolyEdge: () => distToPolyEdge,
    distToSegment: () => distToSegment,
    pointInPoly: () => pointInPoly,
    polyArea: () => polyArea,
    polyBounds: () => polyBounds,
    roundPoly: () => roundPoly
  });
  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function distToPolyEdge(x, y, poly) {
    let d = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      d = Math.min(d, distToSegment(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
    }
    return d;
  }
  var capsuleHit = (c, x, y, extra = 0) => distToSegment(x, y, c.ax, c.ay, c.bx, c.by) < c.r + extra;
  function chaikin(poly, iterations = 1) {
    let p = poly;
    for (let k = 0; k < iterations; k++) {
      const out = [];
      for (let i = 0; i < p.length; i++) {
        const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length];
        out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
      }
      p = out;
    }
    return p;
  }
  function polyArea(poly) {
    let a = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    return Math.abs(a / 2);
  }
  function polyBounds(poly) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of poly) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }
  var roundPoly = (poly) => poly.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);

  // src/shapes.js
  var shapes_exports = {};
  __export(shapes_exports, {
    island: () => island,
    roomGrid: () => roomGrid,
    tileGrid: () => tileGrid
  });
  function island(seed, { cx = 0, cy = 0, rx, ry, rugosidad = 0.35, detalle = 1.6, puntos = 72, suavizado = 1, minRadio = 0.45 }) {
    const { fbm } = createNoise(seed);
    const poly = [];
    for (let i = 0; i < puntos; i++) {
      const a = i / puntos * Math.PI * 2;
      const n = fbm(Math.cos(a) * detalle + 7.3, Math.sin(a) * detalle - 3.1, { octaves: 4 });
      const k = Math.max(minRadio, Math.min(1, 1 - rugosidad * 0.5 + n * rugosidad));
      poly.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return chaikin(poly, suavizado);
  }
  function tileGrid(seed, { w, h, escala = 0.08, pared = 0.45, liquido = -0.5, borde = true }) {
    const { fbm } = createNoise(seed);
    const tiles = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = fbm(x * escala, y * escala, { octaves: 4 });
        let t = v > pared ? 1 : v < liquido ? 2 : 0;
        if (borde && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) t = 1;
        tiles[y * w + x] = t;
      }
    }
    return { w, h, tiles, at: (x, y) => x < 0 || y < 0 || x >= w || y >= h ? 1 : tiles[y * w + x] };
  }
  function roomGrid(rng, { salas = 10, ancho = 9, alto = 8, especiales = ["tesoro", "tienda"] } = {}) {
    const key = (x, y) => `${x},${y}`;
    const DIRS = [["n", 0, -1, "s"], ["s", 0, 1, "n"], ["e", 1, 0, "o"], ["o", -1, 0, "e"]];
    const sx = Math.floor(ancho / 2), sy = Math.floor(alto / 2);
    const map = /* @__PURE__ */ new Map([[key(sx, sy), { x: sx, y: sy, tipo: "inicio", dist: 0 }]]);
    const vecinos = (x, y) => DIRS.filter(([, dx, dy]) => map.has(key(x + dx, y + dy))).length;
    let intentos = 0;
    while (map.size < salas && intentos++ < 5e3) {
      const base = rng.pick([...map.values()]);
      const [, dx, dy] = rng.pick(DIRS);
      const nx = base.x + dx, ny = base.y + dy;
      if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto || map.has(key(nx, ny))) continue;
      if (vecinos(nx, ny) > 1) continue;
      map.set(key(nx, ny), { x: nx, y: ny, tipo: "normal", dist: base.dist + 1 });
    }
    const lista = [...map.values()];
    for (const s of lista) {
      s.puertas = {};
      for (const [d, dx, dy] of DIRS) s.puertas[d] = map.has(key(s.x + dx, s.y + dy));
    }
    const callejones = lista.filter((s) => s.tipo !== "inicio" && Object.values(s.puertas).filter(Boolean).length === 1).sort((a, b) => b.dist - a.dist);
    const jefe = callejones[0] || lista.reduce((a, b) => b.dist > a.dist ? b : a);
    jefe.tipo = "jefe";
    for (const tipo of especiales) {
      const libre2 = callejones.find((s) => s.tipo === "normal");
      if (libre2) libre2.tipo = tipo;
    }
    return { salas: lista, inicio: map.get(key(sx, sy)), jefe };
  }

  // src/place.js
  function poissonDisk(rng, bounds, minDist, accept = () => true, { max = Infinity, k = 20 } = {}) {
    const cell = minDist / Math.SQRT2;
    const gw = Math.ceil((bounds.x1 - bounds.x0) / cell), gh = Math.ceil((bounds.y1 - bounds.y0) / cell);
    const grid = new Int32Array(gw * gh).fill(-1);
    const pts = [], active = [];
    const gi = (x, y) => Math.floor((y - bounds.y0) / cell) * gw + Math.floor((x - bounds.x0) / cell);
    const fits = (x, y) => {
      if (x < bounds.x0 || y < bounds.y0 || x >= bounds.x1 || y >= bounds.y1 || !accept(x, y)) return false;
      const cx = Math.floor((x - bounds.x0) / cell), cy = Math.floor((y - bounds.y0) / cell);
      for (let yy = Math.max(0, cy - 2); yy <= Math.min(gh - 1, cy + 2); yy++) {
        for (let xx = Math.max(0, cx - 2); xx <= Math.min(gw - 1, cx + 2); xx++) {
          const j = grid[yy * gw + xx];
          if (j >= 0 && Math.hypot(pts[j][0] - x, pts[j][1] - y) < minDist) return false;
        }
      }
      return true;
    };
    const add = (x, y) => {
      grid[gi(x, y)] = pts.length;
      active.push(pts.length);
      pts.push([x, y]);
    };
    for (let t = 0; t < 200 && !pts.length; t++) {
      const x = rng.range(bounds.x0, bounds.x1), y = rng.range(bounds.y0, bounds.y1);
      if (fits(x, y)) add(x, y);
    }
    while (active.length && pts.length < max) {
      const ai = Math.floor(rng.next() * active.length);
      const [px, py] = pts[active[ai]];
      let found = false;
      for (let t = 0; t < k; t++) {
        const a = rng.range(0, Math.PI * 2), r = rng.range(minDist, 2 * minDist);
        const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
        if (fits(x, y)) {
          add(x, y);
          found = true;
          break;
        }
      }
      if (!found) active.splice(ai, 1);
    }
    return pts;
  }

  // src/validate.js
  var validate_exports = {};
  __export(validate_exports, {
    checkReachable: () => checkReachable,
    checkTiles: () => checkTiles,
    firstValid: () => firstValid
  });
  function checkReachable({ bounds, celda = 16, walkable, spawn, minRatio = 0.97, minArea = 0 }) {
    const gw = Math.ceil((bounds.x1 - bounds.x0) / celda), gh = Math.ceil((bounds.y1 - bounds.y0) / celda);
    const walk = new Uint8Array(gw * gh);
    let caminable = 0;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (walkable(bounds.x0 + (x + 0.5) * celda, bounds.y0 + (y + 0.5) * celda)) {
          walk[y * gw + x] = 1;
          caminable++;
        }
      }
    }
    const sx = Math.floor((spawn[0] - bounds.x0) / celda), sy = Math.floor((spawn[1] - bounds.y0) / celda);
    if (sx < 0 || sy < 0 || sx >= gw || sy >= gh || !walk[sy * gw + sx]) {
      return { ok: false, motivo: "spawn bloqueado", alcanzable: 0, caminable, ratio: 0, area: 0 };
    }
    const alcanzable = flood(walk, gw, gh, sx, sy);
    const ratio = alcanzable / caminable;
    const area = alcanzable * celda * celda;
    const ok = ratio >= minRatio && area >= minArea;
    const motivo = ok ? "" : ratio < minRatio ? `zonas cerradas (${(100 * (1 - ratio)).toFixed(1)} % sin acceso)` : "\xE1rea demasiado chica";
    return { ok, motivo, alcanzable, caminable, ratio, area };
  }
  function checkTiles(grid, spawn, { minRatio = 0.97, pasa = (t) => t === 0 } = {}) {
    const walk = new Uint8Array(grid.w * grid.h);
    let caminable = 0;
    for (let i = 0; i < walk.length; i++) if (pasa(grid.tiles[i])) {
      walk[i] = 1;
      caminable++;
    }
    if (!walk[spawn[1] * grid.w + spawn[0]]) return { ok: false, motivo: "spawn bloqueado", ratio: 0 };
    const ratio = flood(walk, grid.w, grid.h, spawn[0], spawn[1]) / caminable;
    return { ok: ratio >= minRatio, motivo: ratio >= minRatio ? "" : "zonas cerradas", ratio };
  }
  function flood(walk, gw, gh, sx, sy) {
    const seen = new Uint8Array(gw * gh);
    const stack = [sy * gw + sx];
    seen[stack[0]] = 1;
    let n = 0;
    while (stack.length) {
      const i = stack.pop();
      n++;
      const x = i % gw, y = i / gw | 0;
      if (x > 0 && walk[i - 1] && !seen[i - 1]) {
        seen[i - 1] = 1;
        stack.push(i - 1);
      }
      if (x < gw - 1 && walk[i + 1] && !seen[i + 1]) {
        seen[i + 1] = 1;
        stack.push(i + 1);
      }
      if (y > 0 && walk[i - gw] && !seen[i - gw]) {
        seen[i - gw] = 1;
        stack.push(i - gw);
      }
      if (y < gh - 1 && walk[i + gw] && !seen[i + gw]) {
        seen[i + gw] = 1;
        stack.push(i + gw);
      }
    }
    return n;
  }
  function firstValid(seed, gen, maxIntentos = 30) {
    let ultimo;
    for (let k = 0; k < maxIntentos; k++) {
      const s = k === 0 ? seed : `${seed}#${k}`;
      ultimo = gen(s);
      if (ultimo.check.ok) return { ...ultimo, semillaReal: s, intentos: k + 1 };
    }
    return { ...ultimo, semillaReal: null, intentos: maxIntentos };
  }

  // src/analisis.js
  var analisis_exports = {};
  __export(analisis_exports, {
    buscarBolsillos: () => buscarBolsillos,
    distancias: () => distancias
  });
  function distancias(w, h, pasa, inicios) {
    const d = new Int32Array(w * h).fill(-1);
    const cola = new Int32Array(w * h);
    let a = 0, b = 0;
    for (const i of inicios) if (i >= 0 && i < w * h && pasa(i) && d[i] < 0) {
      d[i] = 0;
      cola[b++] = i;
    }
    while (a < b) {
      const i = cola[a++], x = i % w;
      const v = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of v) {
        if (j < 0 || j >= w * h || d[j] >= 0 || !pasa(j)) continue;
        d[j] = d[i] + 1;
        cola[b++] = j;
      }
    }
    return d;
  }
  function buscarBolsillos({ w, h, pasa, tapable = pasa, inicios, importantes = [], min = 12, max = 90, anchoMax = 3 }) {
    const base = distancias(w, h, pasa, inicios);
    const imp = new Set(importantes);
    const vistos = /* @__PURE__ */ new Set();
    const res = [];
    const probar = (puerta) => {
      const clave = puerta.join(",");
      if (vistos.has(clave)) return;
      vistos.add(clave);
      for (const p of puerta) for (const m of imp) if (Math.abs(p % w - m % w) + Math.abs((p / w | 0) - (m / w | 0)) <= 1) return;
      const tapon = new Set(puerta);
      const d = distancias(w, h, (i) => !tapon.has(i) && pasa(i), inicios);
      const celdas = [];
      for (let i = 0; i < w * h; i++) {
        if (base[i] >= 0 && d[i] < 0 && !tapon.has(i)) {
          celdas.push(i);
          if (celdas.length > max) return;
        }
      }
      if (celdas.length < min || celdas.some((i) => imp.has(i))) return;
      const toca = celdas.some((i) => puerta.some((p) => Math.abs(p % w - i % w) + Math.abs((p / w | 0) - (i / w | 0)) === 1));
      if (!toca) return;
      let suma = 0;
      for (const i of celdas) suma += base[i];
      const cx = celdas.reduce((s, i) => s + i % w, 0) / celdas.length, cy = celdas.reduce((s, i) => s + (i / w | 0), 0) / celdas.length;
      const centro = celdas.reduce((m, i) => Math.hypot(i % w - cx, (i / w | 0) - cy) < Math.hypot(m % w - cx, (m / w | 0) - cy) ? i : m, celdas[0]);
      res.push({ puerta, celdas, tam: celdas.length, dist: Math.round(suma / celdas.length), centro });
    };
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (base[i] < 0 || !tapable(i)) continue;
        if (!pasa(i - 1)) {
          const p = [];
          for (let k = 0; k < anchoMax && x + k < w - 1 && tapable(i + k); k++) {
            p.push(i + k);
            if (!pasa(i + k + 1)) {
              probar([...p]);
              break;
            }
          }
        }
        if (!pasa(i - w)) {
          const p = [];
          for (let k = 0; k < anchoMax && y + k < h - 1 && tapable(i + k * w); k++) {
            p.push(i + k * w);
            if (!pasa(i + (k + 1) * w)) {
              probar([...p]);
              break;
            }
          }
        }
      }
    }
    const porZona = /* @__PURE__ */ new Map();
    for (const r of res) {
      const k = r.celdas[0] + ":" + r.tam;
      const o = porZona.get(k);
      if (!o || r.puerta.length < o.puerta.length) porZona.set(k, r);
    }
    return [...porZona.values()].sort((a, b) => b.dist - a.dist);
  }

  // adapters/onepiece.js
  var onepiece_exports = {};
  __export(onepiece_exports, {
    MUNDO: () => MUNDO,
    generarIsla: () => generarIsla
  });
  var MUNDO = { x0: -1408, x1: 1408, y0: -892, y1: 644 };
  var SPAWN = [0, 0];
  var RADIO_JUGADOR = 14;
  var ZONA_SPAWN = 260;
  var MARGEN_COSTA = 70;
  function generarIsla(semilla, bioma, opciones = {}) {
    var _a;
    const res = firstValid(semilla, (s) => intento(s, bioma, opciones), (_a = opciones.maxIntentos) != null ? _a : 30);
    const { mapa, check } = res;
    return {
      ...mapa,
      id: `gen_${bioma.id}_${String(semilla).replace(/[^\w-]/g, "")}`,
      semilla,
      semillaReal: res.semillaReal,
      intentos: res.intentos,
      stats: { valido: check.ok, motivo: check.motivo, accesible: +(check.ratio * 100).toFixed(1), area: Math.round(check.area) }
    };
  }
  function intento(semilla, bioma, { escala = 1 } = {}) {
    var _a, _b, _c, _d, _e;
    const rng = createRng(semilla);
    const cy = (MUNDO.y0 + MUNDO.y1) / 2;
    const rx = (MUNDO.x1 - MUNDO.x0) / 2 - 60, ry = (MUNDO.y1 - MUNDO.y0) / 2 - 50;
    const forma = island(`${semilla}|isla`, {
      cx: 0,
      cy,
      rx: rx * escala,
      ry: ry * escala,
      rugosidad: (_b = (_a = bioma.isla) == null ? void 0 : _a.rugosidad) != null ? _b : 0.35,
      detalle: (_d = (_c = bioma.isla) == null ? void 0 : _c.detalle) != null ? _d : 1.6,
      puntos: 96,
      suavizado: 3
    });
    const walkPoly = roundPoly(forma);
    const b = polyBounds(walkPoly);
    const rObs = rng.fork("obstaculos");
    const lejosDeTodo = (x, y) => pointInPoly(x, y, walkPoly) && distToPolyEdge(x, y, walkPoly) > MARGEN_COSTA && Math.hypot(x - SPAWN[0], y - SPAWN[1]) > ZONA_SPAWN;
    const puntos = poissonDisk(rObs, b, (_e = bioma.separacion) != null ? _e : 220, lejosDeTodo);
    const obstaculos = [];
    for (const [x, y] of puntos) {
      const t = rObs.weighted(bioma.obstaculos);
      const r = Math.round(rObs.range(t.r[0], t.r[1]));
      const largo = rObs.range(t.largo[0], t.largo[1]);
      const ang = rObs.range(0, Math.PI);
      const dx = Math.cos(ang) * largo / 2, dy = Math.sin(ang) * largo / 2;
      const c = { ax: +(x - dx).toFixed(1), ay: +(y - dy).toFixed(1), bx: +(x + dx).toFixed(1), by: +(y + dy).toFixed(1), r, tipo: t.tipo, color: t.color };
      const extremosOk = [[c.ax, c.ay], [c.bx, c.by]].every(([px, py]) => pointInPoly(px, py, walkPoly) && distToPolyEdge(px, py, walkPoly) > r);
      if (extremosOk && !capsuleHit(c, SPAWN[0], SPAWN[1], ZONA_SPAWN * 0.6)) obstaculos.push(c);
    }
    const rDec = rng.fork("decoracion");
    const decoracion = [];
    for (const d of bioma.decoracion || []) {
      const pts = poissonDisk(rDec.fork(d.tipo), b, d.separacion, (x, y) => pointInPoly(x, y, walkPoly) && !obstaculos.some((o) => capsuleHit(o, x, y, 8)));
      for (const [x, y] of pts) decoracion.push({ tipo: d.tipo, color: d.color, x: Math.round(x), y: Math.round(y) });
    }
    const check = checkReachable({
      bounds: b,
      celda: 16,
      spawn: SPAWN,
      walkable: (x, y) => pointInPoly(x, y, walkPoly) && !obstaculos.some((o) => capsuleHit(o, x, y, RADIO_JUGADOR)),
      minRatio: 0.97,
      minArea: polyArea(walkPoly) * 0.5
    });
    return {
      mapa: { bioma: bioma.id, nombre: bioma.nombre, enemigosDe: bioma.enemigosDe, colores: bioma.colores, walkPoly, obstaculos, decoracion },
      check
    };
  }

  // adapters/pokedive.js
  var pokedive_exports = {};
  __export(pokedive_exports, {
    T: () => T,
    analizarPiso: () => analizarPiso,
    planearSala: () => planearSala,
    solida: () => solida
  });
  var T = {
    Floor: 0,
    Wall: 1,
    Water: 2,
    Grass: 3,
    Rock: 4,
    Lava: 5,
    Deep: 6,
    Boulder: 7,
    Thicket: 8,
    Quicksand: 9,
    CurrentE: 10,
    CurrentW: 11,
    CurrentS: 12,
    CurrentN: 13,
    Fire: 14,
    Ice: 15
  };
  var solida = (t) => t === T.Wall || t === T.Rock || t === T.Lava || t === T.Deep || t === T.Boulder || t === T.Thicket;
  var TS = 16;
  var casilla = (L, p) => Math.floor(p.y / TS) * L.width + Math.floor(p.x / TS);
  var centroPx = (L, i) => ({ x: i % L.width * TS + TS / 2, y: Math.floor(i / L.width) * TS + TS / 2 });
  function analizarPiso(L) {
    const w = L.width, h = L.height, tile = (i) => L.tiles[i / w | 0][i % w];
    const pasa = (i) => !solida(tile(i));
    const d = distancias(w, h, pasa, L.spawns.map((s) => casilla(L, s)));
    let caminables = 0, alcanzables = 0;
    for (let i = 0; i < w * h; i++) if (pasa(i)) {
      caminables++;
      if (d[i] >= 0) alcanzables++;
    }
    return {
      forma: L.shape,
      ancho: w,
      alto: h,
      caminables,
      alcanzables,
      hastaEscalera: d[casilla(L, L.stairs)],
      hastaRescate: d[casilla(L, L.rescue)],
      cofres: (L.chests || []).length,
      jefe: !!L.boss
    };
  }
  function planearSala(L, semilla, { abre = {}, ocupado = [], distMin = 12 } = {}) {
    var _a, _b;
    if (L.boss || L.arena) return null;
    const rng = createRng(`${semilla}|sala`);
    const w = L.width, h = L.height, tile = (i) => L.tiles[i / w | 0][i % w];
    const pasa = (i) => !solida(tile(i));
    const tapable = (i) => tile(i) === T.Floor || tile(i) === T.Grass;
    const inicios = L.spawns.map((s) => casilla(L, s));
    const importantes = [L.stairs, L.rescue, ...L.spawns, ...ocupado, (_a = L.camp) == null ? void 0 : _a.bag, (_b = L.camp) == null ? void 0 : _b.rope, L.landmark].filter(Boolean).map((p) => casilla(L, p));
    const bolsillos = buscarBolsillos({ w, h, pasa, tapable, inicios, importantes, min: 10, max: 70, anchoMax: 3 });
    const buenos = bolsillos.filter((b2) => b2.dist >= distMin);
    if (!buenos.length) return null;
    const b = buenos[Math.min(buenos.length - 1, rng.int(0, Math.min(2, buenos.length - 1)))];
    const material = abre.fuego && abre.golpeRoca ? rng.pick([T.Thicket, T.Boulder]) : abre.fuego ? T.Thicket : abre.golpeRoca ? T.Boulder : null;
    const mods = material === null ? [] : b.puerta.map((i) => [i, material]);
    const dPuerta = distancias(w, h, (i) => pasa(i) && (b.celdas.includes(i) || b.puerta.includes(i)), b.puerta);
    const libres = b.celdas.filter((i) => tile(i) === T.Floor || tile(i) === T.Grass).sort((x, y) => dPuerta[y] - dPuerta[x]);
    const n = b.tam >= 30 ? 3 : 2;
    const cofres = [];
    for (const i of libres) {
      if (cofres.length >= n) break;
      if (cofres.every((c) => Math.abs(c % w - i % w) + Math.abs((c / w | 0) - (i / w | 0)) >= 3)) cofres.push(i);
    }
    if (!cofres.length) return null;
    for (const c of cofres) {
      for (const j of [c - 1, c + 1, c - w, c + w]) {
        if (b.celdas.includes(j) && tile(j) === T.Floor && !cofres.includes(j) && rng.chance(0.6)) mods.push([j, T.Grass]);
      }
    }
    const tipo = material === null ? "guardian" : "secreta";
    const guardia = tipo === "guardian" ? centroPx(L, b.centro) : null;
    const aviso = tipo === "secreta" ? material === T.Thicket ? { es: "Hay algo tras unos matorrales\u2026", en: "Something hides behind the thickets\u2026", sub: { es: "Un ataque de Fuego los quema", en: "A Fire attack burns them" } } : { es: "Hay algo tras unas rocas\u2026", en: "Something hides behind the boulders\u2026", sub: { es: "Golpe Roca las rompe", en: "Rock Smash breaks them" } } : { es: "Un alfa guarda un tesoro en este piso", en: "An alpha guards a treasure on this floor", sub: { es: "V\xE9ncelo para llevarte sus cofres", en: "Beat it to claim its chests" } };
    return { tipo, mods, cofres: cofres.map((i) => centroPx(L, i)), guardia, puerta: b.puerta, celdas: b.celdas, aviso };
  }

  // adapters/pokeisaac.js
  var pokeisaac_exports = {};
  __export(pokeisaac_exports, {
    COLS: () => COLS,
    MAX_ROCAS: () => MAX_ROCAS,
    ROWS: () => ROWS,
    conectada: () => conectada,
    plantillas: () => plantillas
  });
  var COLS = 13;
  var ROWS = 7;
  var MAX_ROCAS = 12;
  var libre = (x, y) => x === 6 || y === 3 || Math.abs(x - 6) <= 1 && Math.abs(y - 3) <= 1;
  var ESTRATEGIAS = {
    // Cuadrante dibujado al azar y copiado en espejo a los 4 lados
    espejo4(rng) {
      const g = vacia();
      const n = rng.int(2, 3);
      for (let k = 0; k < n; k++) {
        const x = rng.int(0, 5), y = rng.int(0, 2);
        const largo = rng.int(1, 3), dx = rng.chance(0.5) ? 1 : 0;
        for (let i = 0; i < largo; i++) espejo(g, x + (dx ? i : 0), y + (dx ? 0 : i), 1, 4);
      }
      return g;
    },
    // Manchas de ruido, en espejo izquierda-derecha
    manchas(rng, noise) {
      const g = vacia(), ox = rng.range(0, 50), oy = rng.range(0, 50), umbral = rng.range(0.25, 0.42);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x <= 6; x++) {
        if (noise.fbm(ox + x * 0.45, oy + y * 0.45, { octaves: 2 }) > umbral) espejo(g, x, y, 1, 2);
      }
      return g;
    },
    // Muros cortos que forman pasillos (diagonales o en L), en espejo diagonal (giro de 180°)
    pasillos(rng) {
      const g = vacia();
      const n = rng.int(2, 3);
      for (let k = 0; k < n; k++) {
        let x = rng.int(0, 5), y = rng.int(0, 6);
        const [dx, dy] = rng.pick([[1, 0], [0, 1], [1, 1], [1, -1]]);
        for (let i = rng.int(2, 3); i > 0; i--) {
          poner(g, x, y, 1);
          poner(g, COLS - 1 - x, ROWS - 1 - y, 1);
          x += dx;
          y += dy;
        }
      }
      return g;
    },
    // Columnas sueltas con algunas "?" (cambian cada vez que sale la sala)
    columnas(rng) {
      const g = vacia();
      const paso = rng.pick([2, 3]);
      for (let x = rng.int(0, 1); x <= 5; x += paso) for (let y = rng.int(0, 1); y <= 2; y += 2) espejo(g, x, y, rng.chance(0.3) ? 2 : 1, 4);
      return g;
    },
    // Anillos o marcos alrededor de un punto del cuadrante
    anillo(rng) {
      const g = vacia();
      const cx = rng.int(1, 4), cy = rng.int(1, 1);
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
        if (rng.chance(0.75)) espejo(g, cx + dx, cy + dy, 1, 2);
      }
      return g;
    }
  };
  function vacia() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }
  function poner(g, x, y, v) {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS && !libre(x, y)) g[y][x] = Math.max(g[y][x], v);
  }
  function espejo(g, x, y, v, modo) {
    poner(g, x, y, v);
    poner(g, COLS - 1 - x, y, v);
    if (modo === 4) {
      poner(g, x, ROWS - 1 - y, v);
      poner(g, COLS - 1 - x, ROWS - 1 - y, v);
    }
  }
  function conectada(g) {
    const vis = vacia(), pila = [[6, 3]];
    vis[3][6] = 1;
    while (pila.length) {
      const [x, y] = pila.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = x + dx, b = y + dy;
        if (a < 0 || b < 0 || a >= COLS || b >= ROWS || vis[b][a] || g[b][a]) continue;
        vis[b][a] = 1;
        pila.push([a, b]);
      }
    }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!g[y][x] && !vis[y][x]) return false;
    return true;
  }
  var aTexto = (g) => g.map((f) => f.map((v) => v === 1 ? "#" : v === 2 ? "?" : ".").join(""));
  function plantillas(semilla = "pokeisaac", n = 16, existentes = {}) {
    const rng = createRng(`${semilla}|plantillas`);
    const noise = createNoise(`${semilla}|ruido`);
    const vistas = new Set(Object.values(existentes).map((t) => t.join("|")));
    const out = {};
    const nombres = Object.keys(ESTRATEGIAS);
    let k = 0;
    for (let intento2 = 0; intento2 < 4e3 && k < n; intento2++) {
      const estr = nombres[intento2 % nombres.length];
      const g = ESTRATEGIAS[estr](rng, noise);
      const rocas = g.flat().filter((v) => v === 1).length, dudosas = g.flat().filter((v) => v === 2).length;
      if (rocas + dudosas < 6 || rocas + dudosas > MAX_ROCAS || !conectada(g)) continue;
      const t = aTexto(g);
      const vars = [t, [...t].reverse(), t.map((f) => [...f].reverse().join("")), [...t].reverse().map((f) => [...f].reverse().join(""))];
      if (vars.some((v) => vistas.has(v.join("|")))) continue;
      vars.forEach((v) => vistas.add(v.join("|")));
      out[`wg_${estr}_${++k}`] = t;
    }
    return out;
  }

  // adapters/pokebonk.js
  var pokebonk_exports = {};
  __export(pokebonk_exports, {
    pueblo: () => pueblo,
    ruta: () => ruta
  });
  var TECHOS = ["techoR", "techoA", "techoV", "techoL"];
  function lienzo(R) {
    const V = /* @__PURE__ */ new Map(), suelo = /* @__PURE__ */ new Map(), cruces = [], vallas = [], col = [], puertas = [];
    const W = R.x1 - R.x0 + 1, D = R.z1 - R.z0 + 1;
    const ocupado = new Uint8Array(W * D);
    const oc = (x, z) => x < R.x0 || x > R.x1 || z < R.z0 || z > R.z1 ? 1 : ocupado[(z - R.z0) * W + (x - R.x0)];
    const marca = (x, z, v = 1) => {
      if (x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1) ocupado[(z - R.z0) * W + (x - R.x0)] = v;
    };
    const libreRect = (x0, x1, z0, z1) => {
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (oc(x, z)) return false;
      return true;
    };
    const pon = (x, y, z, b) => V.set(`${x},${y},${z}`, b);
    const c = {
      R,
      V,
      suelo,
      cruces,
      vallas,
      col,
      puertas,
      W,
      D,
      oc,
      marca,
      libreRect,
      pon,
      camino(x0, x1, z0, z1, t = "gravel_dirt") {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
          suelo.set(`${x},${z}`, t);
          if (oc(x, z) === 0) marca(x, z, 2);
        }
      },
      arbol(x, z, alto = 4) {
        for (let i = 0; i < alto; i++) pon(x, i, z, "tronco");
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = alto - 1; dy <= alto; dy++) if (dx || dz || dy === alto) pon(x + dx, dy, z + dz, "hojas");
        pon(x, alto + 1, z, "hojas");
        col.push({ x: x + 0.5, z: z + 0.5, r: 0.7, h: alto + 2 });
        marca(x, z);
      },
      poste(x, z, arriba, alto = 1, base = "madera", r = 0.45) {
        for (let y = 0; y < alto; y++) pon(x, y, z, base);
        pon(x, alto, z, arriba);
        col.push({ x: x + 0.5, z: z + 0.5, r, h: alto + 1.2 });
        marca(x, z);
      },
      valla(x0, z0, x1, z1) {
        const dx = Math.sign(x1 - x0), dz = Math.sign(z1 - z0), L = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
        for (let i = 0; i <= L; i++) {
          const x = x0 + dx * i, z = z0 + dz * i;
          if (oc(x, z) === 2) continue;
          vallas.push([x, z, dx !== 0]);
          col.push({ x: x + 0.5, z: z + 0.5, r: 0.45, h: 1.3 });
          marca(x, z);
        }
      },
      // Casa de dos aguas como casa() de paleta.js, con la puerta al sur o al norte
      casa({ x0, z0, w = 7, d = 6, alt = 4, techo = "techoR", pared = "pared", puertaSur = true, chimenea = false, que = "casa" }) {
        const x1 = x0 + w - 1, z1 = z0 + d - 1, zp = puertaSur ? z1 : z0, xp = x0 + Math.floor(w / 2);
        for (let y = 0; y < alt; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
          if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
          let b = y === 0 ? "borde" : pared;
          if (y === 2 && ((z === z0 || z === z1) && (x === x0 + 1 || x === x1 - 1) || (x === x0 || x === x1) && (z - z0) % 3 === 1)) b = "ventana";
          if (z === zp && x === xp && y < 2) b = "puerta";
          pon(x, y, z, b);
        }
        const nt = Math.ceil(d / 2) + 1;
        for (let i = 0; i < nt; i++) for (let x = x0 - 1; x <= x1 + 1; x++) {
          pon(x, alt + i, z0 - 1 + i, techo);
          pon(x, alt + i, z1 + 1 - i, techo);
        }
        for (let i = 0; i < nt - 1; i++) for (let z = z0 + i; z <= z1 - i; z++) {
          pon(x0, alt + i, z, pared);
          pon(x1, alt + i, z, pared);
        }
        if (chimenea) for (let y = alt; y < alt + nt + 1; y++) pon(x1 - 1, y, z0 + 1, "ladrillo");
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) col.push({ x: x + 0.5, z: z + 0.5, r: 0.75, h: alt + nt + 1 });
        for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) marca(x, z);
        const p = { xp, zp: puertaSur ? z1 + 1 : z0 - 1, sur: puertaSur, que };
        puertas.push(p);
        return p;
      },
      flores(rng, x0, x1, z0, z1, d = 2) {
        const k = rng.int(0, d - 1);
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (!c.oc(x, z) && ((x * 3 + z * 5 + k) % d + d) % d === 0) cruces.push([x, 0, z, rng.chance(0.3) ? "mushroom_red" : "grass2"]);
      },
      hierba(rng, x0, x1, z0, z1, p = 0.85) {
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (!c.oc(x, z) && rng.chance(p)) cruces.push([x, 0, z, rng.chance(0.5) ? "grass3" : "grass4"]);
      }
    };
    return c;
  }
  function validar(c, ini) {
    const { R, W, D } = c;
    const bloq = new Uint8Array(W * D);
    for (const k of c.col) {
      const x = Math.floor(k.x), z = Math.floor(k.z);
      if (x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1) bloq[(z - R.z0) * W + (x - R.x0)] = 1;
    }
    for (const [k, t] of c.suelo) if (t === "water") {
      const [x, z] = k.split(",").map(Number);
      bloq[(z - R.z0) * W + (x - R.x0)] = 1;
    }
    const idx = (x, z) => (z - R.z0) * W + (x - R.x0);
    const d = distancias(W, D, (i) => !bloq[i], [idx(ini.x, ini.z)]);
    const sinAcceso = c.puertas.filter((p) => d[idx(p.xp, p.zp)] < 0).length;
    let libres = 0, alcanzadas = 0;
    for (let i = 0; i < W * D; i++) if (!bloq[i]) {
      libres++;
      if (d[i] >= 0) alcanzadas++;
    }
    return { ok: sinAcceso === 0 && alcanzadas / libres > 0.9, sinAcceso, accesible: +(100 * alcanzadas / libres).toFixed(1) };
  }
  function salida(c, ini, tipo, extra = {}) {
    const v = validar(c, ini);
    return {
      tipo,
      R: c.R,
      ini,
      V: [...c.V].map(([k, b]) => [...k.split(",").map(Number), b]),
      suelo: [...c.suelo].map(([k, t]) => [...k.split(",").map(Number), t]),
      cruces: c.cruces,
      vallas: c.vallas,
      col: c.col,
      puertas: c.puertas,
      puntos: [],
      cubos: [],
      stats: { valido: v.ok, accesible: v.accesible, puertasSinAcceso: v.sinAcceso, bloques: c.V.size, casas: c.puertas.length },
      ...extra
    };
  }
  function pueblo(semilla, { ancho = 56, largo = 64, casas = 6, estanque = true } = {}) {
    const rng = createRng(`${semilla}|pueblo`);
    const R = { x0: -ancho / 2, x1: ancho / 2, z0: -largo / 2, z1: largo / 2 };
    const c = lienzo(R);
    c.camino(-1, 1, R.z0, R.z1 - 10);
    const cruces = rng.shuffle([-14, -2, 10]).slice(0, rng.int(1, 2));
    for (const z of cruces) c.camino(R.x0 + 6, R.x1 - 6, z - 1, z + 1);
    if (estanque) {
      for (let x = R.x0 + 4; x <= R.x1 - 4; x++) for (let z = R.z1 - 8; z <= R.z1 - 1; z++) {
        c.suelo.set(`${x},${z}`, z === R.z1 - 8 ? "sand" : "water");
        c.marca(x, z);
      }
      for (let z = R.z1 - 10; z <= R.z1 - 4; z++) for (let x = -1; x <= 1; x++) {
        c.suelo.set(`${x},${z}`, "wood");
        c.marca(x, z, 2);
      }
    }
    for (let x = R.x0 + 1; x <= R.x1 - 1; x += 3) if (Math.abs(x) > 4) c.arbol(x, R.z0 + 2, rng.int(3, 5));
    for (let z = R.z0 + 5; z <= R.z1 - (estanque ? 11 : 3); z += 3) {
      c.arbol(R.x0 + 1, z, rng.int(3, 5));
      c.arbol(R.x1 - 1, z, rng.int(3, 5));
    }
    const ztodas = [...cruces];
    let puestas = 0;
    for (let intento2 = 0; intento2 < 400 && puestas < casas; intento2++) {
      const w = rng.pick([7, 7, 9, 11]), d = rng.pick([6, 6, 8]);
      const zc = rng.pick(ztodas), sur = rng.chance(0.5);
      const x0 = rng.int(R.x0 + 4, R.x1 - 4 - w);
      const z0 = sur ? zc - 2 - d - rng.int(1, 3) : zc + 2 + rng.int(1, 3);
      if (Math.abs(x0 + w / 2) < w / 2 + 3) continue;
      if (!c.libreRect(x0 - 2, x0 + w + 1, z0 - 2, z0 + d + 1)) continue;
      const p = c.casa({ x0, z0, w, d, alt: w >= 11 ? 5 : 4, techo: rng.pick(TECHOS), pared: rng.chance(0.25) ? "blanco" : "pared", puertaSur: sur, chimenea: rng.chance(0.5), que: `casa-${puestas + 1}` });
      c.camino(p.xp, p.xp, Math.min(p.zp, zc), Math.max(p.zp, zc));
      const dz = sur ? 1 : -1;
      if (!c.oc(p.xp - 2, p.zp)) c.poste(p.xp - 2, p.zp, "buzon", 1, "madera", 0.4);
      if (!c.oc(p.xp + 2, p.zp)) c.poste(p.xp + 2, p.zp, "cartel");
      c.flores(rng, x0, x0 + w - 1, p.zp + dz, p.zp + dz, 3);
      puestas++;
    }
    for (let z = R.z0 + 8; z <= R.z1 - 12; z += 9) for (const x of [-3, 3]) if (!c.oc(x, z)) c.poste(x, z, "luz", 3, "piedra", 0.4);
    for (let k = 0; k < 2; k++) {
      const x0 = rng.int(R.x0 + 4, R.x1 - 14), z0 = rng.int(R.z0 + 6, R.z1 - 20);
      if (Math.abs(x0 + 5) < 9 || !c.libreRect(x0, x0 + 9, z0, z0 + 7)) continue;
      c.valla(x0, z0, x0 + 9, z0);
      c.valla(x0, z0 + 7, x0 + 9, z0 + 7);
      c.valla(x0, z0 + 1, x0, z0 + 6);
      c.valla(x0 + 9, z0 + 1, x0 + 9, z0 + 2);
      c.valla(x0 + 9, z0 + 5, x0 + 9, z0 + 6);
      c.flores(rng, x0 + 1, x0 + 8, z0 + 1, z0 + 6, 2);
    }
    return salida(c, { x: 0, z: R.z1 - (estanque ? 13 : 4) }, "pueblo");
  }
  function ruta(semilla, { ancho = 36, largo = 90 } = {}) {
    const rng = createRng(`${semilla}|ruta`);
    const noise = createNoise(`${semilla}|ruta`);
    const R = { x0: -ancho / 2, x1: ancho / 2, z0: -largo / 2, z1: largo / 2 };
    const c = lienzo(R);
    const centro = (z) => Math.round(noise.fbm(0.3, z * 0.035, { octaves: 2 }) * (ancho / 2 - 8));
    for (let z = R.z0; z <= R.z1; z++) {
      const x = centro(z);
      c.camino(x - 1, x + 1, z, z);
    }
    for (let z = R.z0 + 14; z <= R.z1 - 14; z += rng.int(16, 24)) {
      const xc = centro(z);
      for (let x = R.x0 + 2; x <= R.x1 - 2; x++) {
        if (Math.abs(x - xc) <= 3 || c.oc(x, z)) continue;
        c.pon(x, 0, z, "bordillo");
        c.col.push({ x: x + 0.5, z: z + 0.5, r: 0.5, h: 1 });
        c.marca(x, z);
      }
    }
    for (let x = R.x0 + 2; x <= R.x1 - 2; x++) for (let z = R.z0 + 2; z <= R.z1 - 2; z++) {
      if (Math.abs(x - centro(z)) > 3 && noise.fbm(x * 0.12 + 40, z * 0.12, { octaves: 2 }) > 0.25 && !c.oc(x, z)) c.cruces.push([x, 0, z, rng.chance(0.5) ? "grass3" : "grass4"]);
    }
    for (let z = R.z0; z <= R.z1; z += 3) {
      c.arbol(R.x0 + 1, z, rng.int(3, 5));
      c.arbol(R.x1 - 1, z, rng.int(3, 5));
    }
    for (let k = 0; k < Math.round(largo / 10); k++) {
      const x = rng.int(R.x0 + 4, R.x1 - 4), z = rng.int(R.z0 + 6, R.z1 - 6);
      if (Math.abs(x - centro(z)) > 4 && c.libreRect(x - 1, x + 1, z - 1, z + 1)) c.arbol(x, z, rng.int(3, 5));
    }
    c.poste(centro(R.z0 + 4) + 3, R.z0 + 4, "cartel");
    c.poste(centro(R.z1 - 4) - 3, R.z1 - 4, "cartel");
    return salida(c, { x: centro(R.z0 + 2), z: R.z0 + 2 }, "ruta");
  }

  // adapters/pokesurvivor.js
  var pokesurvivor_exports = {};
  __export(pokesurvivor_exports, {
    FLOOR: () => FLOOR,
    LIQUID: () => LIQUID,
    WALL: () => WALL,
    estructuras: () => estructuras,
    mundo: () => mundo,
    terreno: () => terreno
  });
  var FLOOR = 0;
  var WALL = 1;
  var LIQUID = 2;
  function terreno(semilla, { liq_base = 0.05, liq_grow = 0.17, wall_grow = 0.27 } = {}) {
    const n = createNoise(`${semilla}|terreno`);
    return (tx, ty) => {
      const d = Math.hypot(tx + 0.5, ty + 0.5);
      if (d < 9) return FLOOR;
      const ramp = Math.min(1, (d - 9) / 8);
      const lago = (n.fbm(tx / 14 + 50, ty / 14, { octaves: 3 }) + 1) / 2;
      if (lago < liq_base + liq_grow * ramp * 0.6) return LIQUID;
      if ((n.fbm(tx / 8, ty / 8, { octaves: 3 }) + 1) / 2 > 1 - wall_grow * ramp * 0.9) return WALL;
      return FLOOR;
    };
  }
  var ESTR = {
    ruinas(rng, t) {
      const w = rng.int(11, 15), h = rng.int(9, 13);
      const g = rejilla(w, h, " ");
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const borde = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        g[y][x] = borde ? rng.chance(0.78) ? "#" : "." : ".";
      }
      for (let k = 0; k < rng.int(2, 4); k++) g[rng.int(2, h - 3)][rng.int(2, w - 3)] = "#";
      for (const [x, y] of [[w >> 1, 0], [w >> 1, h - 1], [0, h >> 1], [w - 1, h >> 1]]) g[y][x] = ".";
      return g;
    },
    lago(rng) {
      const r = rng.int(5, 8), w = r * 2 + 3, h = r * 2 + 3;
      const g = rejilla(w, h, " ");
      const n = createNoise(rng.int(0, 1e9));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - w / 2 + 0.5, y - h / 2 + 0.5) / r + n.fbm(x * 0.3, y * 0.3) * 0.25;
        g[y][x] = d < 0.8 ? "~" : d < 1.05 ? "." : " ";
      }
      const c = w >> 1;
      for (let y = c - 1; y <= c + 1; y++) for (let x = c - 1; x <= c + 1; x++) g[y][x] = ".";
      for (let x = c + 2; x < w; x++) if (g[c][x] === "~") g[c][x] = ".";
      return g;
    },
    arena(rng) {
      const r = rng.int(7, 9), w = r * 2 + 1;
      const g = rejilla(w, w, " ");
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - r, y - r);
        g[y][x] = d <= r - 1 ? "." : d <= r ? "#" : " ";
      }
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2;
        g[Math.round(r + Math.sin(a) * (r - 3))][Math.round(r + Math.cos(a) * (r - 3))] = "#";
      }
      for (const [x, y] of [[r, 0], [r, w - 1], [0, r], [w - 1, r]]) g[y][x] = ".";
      for (const [x, y] of [[r, 1], [r, w - 2], [1, r], [w - 2, r]]) g[y][x] = ".";
      return g;
    },
    laberinto(rng) {
      const cw = rng.int(3, 4), ch = rng.int(3, 4), w = cw * 2 + 1, h = ch * 2 + 1;
      const g = rejilla(w, h, "#");
      const vis = /* @__PURE__ */ new Set(), pila = [[0, 0]];
      vis.add("0,0");
      g[1][1] = ".";
      while (pila.length) {
        const [x, y] = pila[pila.length - 1];
        const op = rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).filter(([dx2, dy2]) => x + dx2 >= 0 && y + dy2 >= 0 && x + dx2 < cw && y + dy2 < ch && !vis.has(`${x + dx2},${y + dy2}`));
        if (!op.length) {
          pila.pop();
          continue;
        }
        const [dx, dy] = op[0];
        g[y * 2 + 1 + dy][x * 2 + 1 + dx] = ".";
        g[(y + dy) * 2 + 1][(x + dx) * 2 + 1] = ".";
        vis.add(`${x + dx},${y + dy}`);
        pila.push([x + dx, y + dy]);
      }
      g[1][0] = ".";
      g[h - 2][w - 1] = ".";
      for (let k = 0; k < 3; k++) {
        const x = rng.int(1, w - 2), y = rng.int(1, h - 2);
        if ((x + y) % 2) g[y][x] = ".";
      }
      return g;
    }
  };
  function rejilla(w, h, v) {
    return Array.from({ length: h }, () => new Array(w).fill(v));
  }
  function abierta(g) {
    const h = g.length, w = g[0].length;
    const pasa = (i) => g[i / w | 0][i % w] !== "#" && g[i / w | 0][i % w] !== "~";
    const bordes = [];
    for (let x = 0; x < w; x++) bordes.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) bordes.push(y * w, y * w + w - 1);
    const d = distancias(w, h, pasa, bordes);
    for (let i = 0; i < w * h; i++) if (g[i / w | 0][i % w] === "." && d[i] < 0) return false;
    return true;
  }
  function estructuras(semilla, { cantidad = 10, radioMin = 18, radioMax = 90, tipos = Object.keys(ESTR) } = {}) {
    const rng = createRng(`${semilla}|estructuras`);
    const out = [];
    for (let intento2 = 0; intento2 < cantidad * 30 && out.length < cantidad; intento2++) {
      const tipo = tipos[out.length % tipos.length];
      const g = ESTR[tipo](rng);
      if (!abierta(g)) continue;
      const h = g.length, w = g[0].length;
      const a = rng.range(0, Math.PI * 2), r = rng.range(radioMin, radioMax);
      const tx = Math.round(Math.cos(a) * r - w / 2), ty = Math.round(Math.sin(a) * r - h / 2);
      const choca = out.some((o) => tx < o.tx + o.w + 6 && tx + w + 6 > o.tx && ty < o.ty + o.h + 6 && ty + h + 6 > o.ty);
      if (choca) continue;
      out.push({ tipo, tx, ty, w, h, filas: g.map((f) => f.join("")) });
    }
    return out;
  }
  function mundo(semilla, bioma = {}, opciones = {}) {
    const base = terreno(semilla, bioma.terreno);
    const est = estructuras(semilla, opciones);
    const mapa = /* @__PURE__ */ new Map();
    for (const e of est) e.filas.forEach((f, y) => [...f].forEach((c, x) => {
      if (c !== " ") mapa.set(`${e.tx + x},${e.ty + y}`, c === "#" ? WALL : c === "~" ? LIQUID : FLOOR);
    }));
    return { estructuras: est, terrain: (tx, ty) => {
      var _a;
      return (_a = mapa.get(`${tx},${ty}`)) != null ? _a : base(tx, ty);
    } };
  }

  // adapters/dbz.js
  var dbz_exports = {};
  __export(dbz_exports, {
    tema: () => tema,
    validar: () => validar2
  });
  var hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  var INICIO_LIBRE = 320;
  function tema(semilla, e) {
    var _a, _b, _c, _d;
    const n = createNoise(`${semilla}|dbz`);
    const sn = hashSeed(`${semilla}|dbz`);
    const lagos = (_a = e.lagos) != null ? _a : 0.3, mesetas = (_b = e.mesetas) != null ? _b : 0.3, crateres = (_c = e.crateres) != null ? _c : 0.3, pasto = (_d = e.pasto) != null ? _d : 0.4;
    const CR = 520;
    const crater = (wx, wy) => {
      const gx = Math.floor(wx / CR), gy = Math.floor(wy / CR);
      let best = 1e9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const h = hash(gx + i, gy + j, sn);
        if (h > crateres) continue;
        const cx = (gx + i + 0.2 + hash(gx + i, gy + j, sn + 1) * 0.6) * CR, cy = (gy + j + 0.2 + hash(gx + i, gy + j, sn + 2) * 0.6) * CR;
        const r = 60 + hash(gx + i, gy + j, sn + 3) * 90;
        best = Math.min(best, Math.hypot(wx - cx, wy - cy) / r);
      }
      return best;
    };
    const lejos = (wx, wy) => Math.min(1, Math.max(0, (Math.hypot(wx, wy) - INICIO_LIBRE) / 400));
    const agua = (wx, wy) => {
      if (e.ring) {
        const d = Math.hypot(wx, wy) / 1500 + n.fbm(wx / 500, wy / 500) * 0.25;
        if (d > 1) return true;
      }
      return lejos(wx, wy) > 0 && n.fbm(wx / 700 + 31, wy / 700 - 17, { octaves: 3 }) < -0.6 + lagos * 0.5 * lejos(wx, wy);
    };
    const meseta = (wx, wy) => {
      if (e.ring && Math.max(Math.abs(wx), Math.abs(wy)) < 140 && Math.max(Math.abs(wx), Math.abs(wy)) > 110) return false;
      if (e.cuadricula) {
        const bx = (wx % 420 + 420) % 420, by = (wy % 420 + 420) % 420;
        if (bx < 90 || by < 90) return false;
        return lejos(wx, wy) > 0.3 && hash(Math.floor(wx / 420), Math.floor(wy / 420), sn + 9) < mesetas;
      }
      return lejos(wx, wy) > 0.2 && n.fbm(wx / 260 - 50, wy / 260 + 80, { octaves: 3 }) > 0.6 - mesetas * 0.45 * lejos(wx, wy);
    };
    const blocked = (wx, wy) => agua(wx, wy) || meseta(wx, wy);
    const ground = (wx, wy) => {
      if (e.ring && Math.max(Math.abs(wx), Math.abs(wy)) <= 140) return 1;
      const c = crater(wx, wy);
      if (c < 0.75) return 0;
      if (c < 1) return 1;
      if (e.cuadricula) {
        const bx = (wx % 420 + 420) % 420, by = (wy % 420 + 420) % 420;
        if (bx < 90 || by < 90) return 1;
      }
      if (n.fbm(wx / 160 + 77, wy / 160 - 31) > 0.6 - pasto * 0.6) return 2;
      if (n.fbm(wx / 95, wy / 95) > 0.5) return 1;
      return 0;
    };
    const L = e.liquido.map(hex), M = e.meseta.map(hex), luz = hex(e.mesetaLuz), orilla = hex(e.orilla);
    const pixelExtra = (wx, wy) => {
      if (agua(wx, wy)) {
        const near = !agua(wx + 10, wy) || !agua(wx - 10, wy) || !agua(wx, wy + 10) || !agua(wx, wy - 10);
        if (near) return orilla;
        return L[n.simplex(wx / 40, wy / 40) > 0.3 ? 0 : n.simplex(wx / 90, wy / 90) > 0 ? 1 : 2];
      }
      if (meseta(wx, wy)) {
        if (!meseta(wx, wy - 8)) return luz;
        if (!meseta(wx, wy + 14)) return M[2];
        return M[n.simplex(wx / 30, wy / 30) > 0.2 ? 0 : 1];
      }
      return null;
    };
    const keepProp = (p) => !blocked(p.x, p.y) && !(p.solid && Math.hypot(p.x, p.y) < INICIO_LIBRE);
    return { id: e.id, nombre: e.nombre, base: e.base, ground, blocked, agua, meseta, pixelExtra, keepProp };
  }
  function validar2(t, radio = 2400, celda = 32) {
    const w = Math.ceil(radio * 2 / celda), x0 = -radio;
    const pasa = (i) => !t.blocked(x0 + i % w * celda + celda / 2, x0 + Math.floor(i / w) * celda + celda / 2);
    const ini = Math.floor(w / 2) * w + Math.floor(w / 2);
    const d = distancias(w, w, pasa, [ini]);
    let libres = 0, alc = 0;
    for (let i = 0; i < w * w; i++) if (pasa(i)) {
      libres++;
      if (d[i] >= 0) alc++;
    }
    return { accesible: +(100 * alc / libres).toFixed(1), libre: +(100 * libres / (w * w)).toFixed(1) };
  }
  function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647) | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  }

  // adapters/overlord.js
  var overlord_exports = {};
  __export(overlord_exports, {
    LEYENDA: () => LEYENDA,
    expedicion: () => expedicion
  });
  var LEYENDA = { ".": "pasto", "=": "camino", h: "hierba alta", f: "flores", T: "\xE1rbol", "~": "agua", R: "roca" };
  var BLOQUEA = /* @__PURE__ */ new Set(["T", "~", "R"]);
  var TIPOS = {
    bosque: { arbol: 0.42, agua: -0.75, roca: 0, hierba: 0.3, obst: "T" },
    costa: { arbol: 0.62, agua: -0.42, roca: 0.02, hierba: 0.25, obst: "T" },
    cueva: { arbol: 0.3, agua: -0.7, roca: 1, hierba: 0, obst: "R" }
  };
  function expedicion(semilla, { ancho = 24, alto = 40, tipo = "bosque", entrenadores = 4, objetos = 3 } = {}) {
    const P = TIPOS[tipo] || TIPOS.bosque;
    const rng = createRng(`${semilla}|ov`);
    const n = createNoise(`${semilla}|ov`);
    const g = Array.from({ length: alto }, () => new Array(ancho).fill("."));
    const en = (x2, y) => x2 >= 0 && y >= 0 && x2 < ancho && y < alto;
    for (let y = 0; y < alto; y++) for (let x2 = 0; x2 < ancho; x2++) {
      const v = n.fbm(x2 * 0.16, y * 0.16, { octaves: 3 });
      const borde = x2 === 0 || x2 === ancho - 1 || y === 0 || y === alto - 1;
      if (borde || v > P.arbol) g[y][x2] = P.obst;
      else if (v < P.agua) g[y][x2] = "~";
      if (tipo === "costa" && x2 > ancho * 0.72 + n.fbm(0, y * 0.1) * 3) g[y][x2] = "~";
    }
    const entrada = { x: Math.floor(ancho / 2), y: alto - 1 }, salida2 = { x: rng.int(3, ancho - 4), y: 0 };
    let x = entrada.x;
    for (let y = alto - 1; y >= 0; y--) {
      const objetivo = Math.round(entrada.x + (salida2.x - entrada.x) * (1 - y / (alto - 1)) + n.fbm(7, y * 0.12) * 5);
      const paso = Math.sign(Math.max(2, Math.min(ancho - 3, objetivo)) - x);
      for (const xx of [x, x + paso]) for (const dx of [0, 1]) if (en(xx + dx, y)) g[y][Math.max(1, Math.min(ancho - 2, xx + dx))] = "=";
      x = Math.max(2, Math.min(ancho - 3, x + paso));
    }
    g[entrada.y][entrada.x] = "=";
    g[salida2.y][salida2.x] = "=";
    g[salida2.y][salida2.x + 1] = "=";
    for (let y = 1; y < alto - 1; y++) for (let xx = 1; xx < ancho - 1; xx++) {
      if (g[y][xx] === "." && n.fbm(xx * 0.22 + 40, y * 0.22, { octaves: 2 }) > 0.45 - P.hierba) g[y][xx] = "h";
      else if (g[y][xx] === "." && rng.chance(0.03)) g[y][xx] = "f";
    }
    const W = ancho, pasa = (i) => !BLOQUEA.has(g[i / W | 0][i % W]);
    const d = distancias(ancho, alto, pasa, [entrada.y * W + entrada.x]);
    for (let i = 0; i < ancho * alto; i++) if (pasa(i) && d[i] < 0) g[i / W | 0][i % W] = P.obst;
    const lista = [];
    const cands = [];
    for (let y = 3; y < alto - 4; y++) for (let xx = 1; xx < ancho - 1; xx++) {
      if (g[y][xx] !== "." && g[y][xx] !== "h") continue;
      for (const [dx, mira] of [[1, "derecha"], [-1, "izquierda"]]) if (g[y][xx + dx] === "=") cands.push({ x: xx, y, mira });
    }
    rng.shuffle(cands);
    for (const c of cands) {
      if (lista.length >= entrenadores) break;
      if (lista.every((o) => Math.abs(o.y - c.y) >= 5)) {
        lista.push(c);
        g[c.y][c.x] = ".";
      }
    }
    const dCam = distancias(ancho, alto, pasa, [...Array(ancho * alto).keys()].filter((i) => g[i / W | 0][i % W] === "="));
    const lejos = [...Array(ancho * alto).keys()].filter((i) => pasa(i) && g[i / W | 0][i % W] !== "=" && !lista.some((o) => o.y * W + o.x === i)).sort((a, b) => dCam[b] - dCam[a]);
    const objs = [];
    for (const i of lejos) {
      if (objs.length >= objetos) break;
      const o = { x: i % W, y: i / W | 0 };
      if (objs.every((p) => Math.abs(p.x - o.x) + Math.abs(p.y - o.y) > 6)) objs.push(o);
    }
    const dFin = distancias(ancho, alto, pasa, [entrada.y * W + entrada.x]);
    return {
      ancho,
      alto,
      tipo,
      filas: g.map((f) => f.join("")),
      entrada,
      salida: salida2,
      entrenadores: lista,
      objetos: objs,
      leyenda: LEYENDA,
      stats: { valido: dFin[salida2.y * W + salida2.x] >= 0, pasos: dFin[salida2.y * W + salida2.x], hierba: g.flat().filter((c) => c === "h").length }
    };
  }

  // biomas/onepiece/desierto.json
  var desierto_default = {
    id: "desierto",
    nombre: "Isla del desierto",
    enemigosDe: "alabasta",
    colores: { mar: "#2a7fb8", orilla: "#e9d39b", suelo: "#d9b46a", borde: "#a8834a" },
    isla: { rugosidad: 0.42, detalle: 1.4 },
    separacion: 230,
    obstaculos: [
      { tipo: "roca", peso: 5, color: "#8c6a3f", r: [22, 38], largo: [0, 40] },
      { tipo: "palmera", peso: 2, color: "#4f8a3a", r: [16, 20], largo: [0, 0] },
      { tipo: "ruina", peso: 1, color: "#b89562", r: [12, 16], largo: [140, 260] }
    ],
    decoracion: [
      { tipo: "duna", color: "#e2c27f", separacion: 120 },
      { tipo: "huesos", color: "#efe6d0", separacion: 340 }
    ]
  };

  // biomas/onepiece/nieve.json
  var nieve_default = {
    id: "nieve",
    nombre: "Isla invernal",
    enemigosDe: "drum",
    colores: { mar: "#3a6f9a", orilla: "#dfe8ef", suelo: "#f4f8fb", borde: "#9fb3c4" },
    isla: { rugosidad: 0.3, detalle: 1.8 },
    separacion: 210,
    obstaculos: [
      { tipo: "pino", peso: 5, color: "#2f5a44", r: [18, 24], largo: [0, 0] },
      { tipo: "roca", peso: 2, color: "#7d8c99", r: [24, 36], largo: [0, 30] },
      { tipo: "hielo", peso: 1, color: "#a9d6ef", r: [14, 18], largo: [90, 180] }
    ],
    decoracion: [
      { tipo: "monticulo", color: "#ffffff", separacion: 110 },
      { tipo: "huellas", color: "#cfdbe5", separacion: 260 }
    ]
  };

  // biomas/onepiece/bosque.json
  var bosque_default = {
    id: "bosque",
    nombre: "Isla selv\xE1tica",
    enemigosDe: "syrup",
    colores: { mar: "#24889f", orilla: "#e6d8a3", suelo: "#6fae4f", borde: "#3f7a35" },
    isla: { rugosidad: 0.5, detalle: 2.1 },
    separacion: 190,
    obstaculos: [
      { tipo: "arbol", peso: 6, color: "#2e6b2c", r: [20, 30], largo: [0, 0] },
      { tipo: "tronco", peso: 2, color: "#7a5230", r: [12, 16], largo: [70, 150] },
      { tipo: "roca", peso: 1, color: "#7c7c70", r: [20, 30], largo: [0, 20] }
    ],
    decoracion: [
      { tipo: "flores", color: "#f2d14b", separacion: 130 },
      { tipo: "arbusto", color: "#4d9440", separacion: 100 }
    ]
  };

  // biomas/onepiece/ciudad.json
  var ciudad_default = {
    id: "ciudad",
    nombre: "Puerto de la Marina",
    enemigosDe: "shelltown",
    colores: { mar: "#2c78a8", orilla: "#c9b98f", suelo: "#b7aa92", borde: "#6f6454" },
    isla: { rugosidad: 0.22, detalle: 1.2 },
    separacion: 250,
    obstaculos: [
      { tipo: "casa", peso: 4, color: "#8a5a44", r: [34, 48], largo: [40, 110] },
      { tipo: "barril", peso: 3, color: "#6b4a2b", r: [14, 18], largo: [0, 0] },
      { tipo: "muro", peso: 1, color: "#9c9384", r: [10, 13], largo: [160, 300] }
    ],
    decoracion: [
      { tipo: "adoquin", color: "#a59a84", separacion: 90 },
      { tipo: "farol", color: "#f5d77a", separacion: 300 }
    ]
  };

  // biomas/pokesurvivor/playa.json
  var playa_default = {
    name: "Playa Coral",
    liquid: "water",
    prop: "tree",
    floor: ["#e3cf8f", "#ead79a", "#d9c483"],
    dirt: ["#cdb57a", "#c2aa70", "#d6bf86"],
    speck: "#c9b273",
    light: "#f5e6b4",
    flowers: ["#ff8fa3", "#ffd166", "#ffffff"],
    wallTop: ["#8d8a7f", "#97948a", "#828075"],
    wallLight: "#c4c0b2",
    wallEdge: "#3a3833",
    wallFace: ["#5f5c54", "#56534c"],
    wallFaceDark: "#35332e",
    liq: "#2fb3c9",
    liqDeep: "#1f8ea8",
    foam: "#d9fbff",
    shore: "#b89c5e",
    leaf: ["#2e7d3a", "#3f9a45", "#5bb85a", "#86d26e"],
    trunk: ["#8a6239", "#a87a4a"],
    rock: ["#8d8a7f", "#a9a596", "#c7c3b4"],
    grass: ["#6aa84f", "#8cc66a", "#b5e08f"],
    terreno: { liq_base: 0.12, liq_grow: 0.2, wall_grow: 0.15 }
  };

  // biomas/pokesurvivor/pantano.json
  var pantano_default = {
    name: "Pantano Niebla",
    liquid: "water",
    prop: "dead",
    floor: ["#4f5a3a", "#56623f", "#485235"],
    dirt: ["#3f4630", "#454c34", "#393f2b"],
    speck: "#3c4530",
    light: "#6e7a52",
    flowers: ["#c7a6ff", "#9fe870", "#e8e3a0"],
    wallTop: ["#4a4f3e", "#525846", "#434838"],
    wallLight: "#737a60",
    wallEdge: "#1c1f16",
    wallFace: ["#33372a", "#2d3125"],
    wallFaceDark: "#1b1d15",
    liq: "#4f6b4a",
    liqDeep: "#3c5539",
    foam: "#a9c79a",
    shore: "#3a4430",
    leaf: ["#3d4a2e", "#4f5e3a", "#617147", "#738553"],
    trunk: ["#3b3326", "#4f4433"],
    rock: ["#55594a", "#6e7360", "#888d78"],
    grass: ["#46552f", "#5f7240", "#7d9252"],
    terreno: { liq_base: 0.16, liq_grow: 0.22, wall_grow: 0.2 }
  };

  // biomas/pokesurvivor/desierto.json
  var desierto_default2 = {
    name: "Ruinas del Desierto",
    liquid: "water",
    prop: "dead",
    floor: ["#c99a5b", "#d1a363", "#bf9153"],
    dirt: ["#b0824a", "#a77a44", "#ba8b51"],
    speck: "#b38549",
    light: "#e6bd80",
    flowers: ["#ff7b54", "#ffd36e", "#b6e36b"],
    wallTop: ["#a8865a", "#b29062", "#9c7c52"],
    wallLight: "#d4b07c",
    wallEdge: "#3d2e1c",
    wallFace: ["#7a5f3d", "#6f5637"],
    wallFaceDark: "#45351f",
    liq: "#3aa1b8",
    liqDeep: "#2a7f99",
    foam: "#c4f3f7",
    shore: "#9c7a47",
    leaf: ["#6f8a3a", "#86a345", "#9fbd55", "#b8d36a"],
    trunk: ["#6d4b2b", "#87603a"],
    rock: ["#9c7c52", "#b8966a", "#d3b285"],
    grass: ["#a6a04f", "#c2b85e", "#d9cf74"],
    terreno: { liq_base: 0.02, liq_grow: 0.06, wall_grow: 0.32 }
  };

  // biomas/pokesurvivor/tundra.json
  var tundra_default = {
    name: "Tundra Helada",
    liquid: "water",
    prop: "crystal",
    floor: ["#dfe9f1", "#e7f0f6", "#d4e0ea"],
    dirt: ["#bccbd8", "#b2c2d0", "#c5d3df"],
    speck: "#c3d1dd",
    light: "#ffffff",
    flowers: ["#9fd8ff", "#c9b8ff", "#ffffff"],
    wallTop: ["#9fb3c6", "#a9bdd0", "#95a9bc"],
    wallLight: "#d7e6f2",
    wallEdge: "#2b3846",
    wallFace: ["#6b7f93", "#627589"],
    wallFaceDark: "#3c4a59",
    liq: "#7cc4e8",
    liqDeep: "#5aa6cf",
    foam: "#f0fbff",
    shore: "#a7bccd",
    leaf: ["#a9e4f5", "#c8f0fb", "#e6faff", "#ffffff"],
    trunk: ["#6f8aa6", "#89a4bf"],
    rock: ["#8ea3b6", "#aabfd1", "#c7d9e8"],
    grass: ["#a9c6d6", "#c3dbe8", "#dceef7"],
    terreno: { liq_base: 0.08, liq_grow: 0.14, wall_grow: 0.24 }
  };

  // biomas/dbz/namek.json
  var namek_default = {
    id: "namek_lagos",
    nombre: "Namek: los lagos",
    base: "namek",
    liquido: ["#3fb1b6", "#4fc7c9", "#2f8f95"],
    orilla: "#cdf2b0",
    meseta: ["#9cc8c0", "#78a8a4", "#5a8686"],
    mesetaLuz: "#e8f6f0",
    lagos: 0.55,
    mesetas: 0.25,
    crateres: 0.2,
    pasto: 0.55
  };

  // biomas/dbz/baldia.json
  var baldia_default = {
    id: "tierra_baldia",
    nombre: "Tierra bald\xEDa",
    base: "saiyan",
    liquido: ["#6f9fc0", "#5a8bb0", "#4a7898"],
    orilla: "#e9cd98",
    meseta: ["#d2a466", "#b88750", "#946538"],
    mesetaLuz: "#f5e2b8",
    lagos: 0.12,
    mesetas: 0.7,
    crateres: 0.6,
    pasto: 0.25
  };

  // biomas/dbz/ciudad.json
  var ciudad_default2 = {
    id: "ciudad_destruida",
    nombre: "Ciudad destruida",
    base: "rocky",
    liquido: ["#5d6f80", "#4e5f70", "#404f5e"],
    orilla: "#d6d0c2",
    meseta: ["#8f8a82", "#76716a", "#5e5a54"],
    mesetaLuz: "#c9c4bb",
    lagos: 0.05,
    mesetas: 0.55,
    crateres: 0.9,
    pasto: 0.1,
    cuadricula: true
  };

  // biomas/dbz/torneo.json
  var torneo_default = {
    id: "isla_torneo",
    nombre: "Isla del Torneo",
    base: "buu",
    liquido: ["#4aa3d6", "#3a8fc4", "#2d7aae"],
    orilla: "#f8dcc8",
    meseta: ["#d8d2c4", "#bfb8a8", "#a39c8c"],
    mesetaLuz: "#f4f0e6",
    lagos: 0.85,
    mesetas: 0.1,
    crateres: 0.3,
    pasto: 0.4,
    ring: true
  };

  // src/index.js
  var version = "0.5";
  var core = { createRng, hashSeed, createNoise, geom: geom_exports, shapes: shapes_exports, poissonDisk, validate: validate_exports, analisis: analisis_exports };
  var biomas = {
    onepiece: { desierto: desierto_default, nieve: nieve_default, bosque: bosque_default, ciudad: ciudad_default },
    pokesurvivor: { playa: playa_default, pantano: pantano_default, desierto: desierto_default2, tundra: tundra_default },
    dbz: { namek: namek_default, baldia: baldia_default, ciudad: ciudad_default2, torneo: torneo_default }
  };
  var adapters = {
    onepiece: {
      ...onepiece_exports,
      /** Atajo: generarIsla(semilla, "nieve") */
      isla: (semilla, bioma = "desierto", opciones) => generarIsla(semilla, typeof bioma === "string" ? biomas.onepiece[bioma] : bioma, opciones)
    },
    pokedive: pokedive_exports,
    pokeisaac: pokeisaac_exports,
    pokebonk: pokebonk_exports,
    pokesurvivor: pokesurvivor_exports,
    dbz: dbz_exports,
    overlord: overlord_exports
  };
  return __toCommonJS(index_exports);
})();
