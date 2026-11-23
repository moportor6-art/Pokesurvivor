(() => {
  const base = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  const PX = 2, TILE = 256 * PX, CELL = 150, PAR = 0.6;
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.className = 'fondo';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, pattern = null, mons = [], data = null, last = 0, docH = 0;
  const img = src => { const i = new Image(); i.src = base + src; return i; };
  const grass = img('hierba.png'), props = { tree: img('tree-0.png'), tuft: [img('grass-0.png'), img('grass-1.png'), img('grass-2.png')], rock: [img('rock-0.png'), img('rock-1.png')] };
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.imageSmoothingEnabled = false;
    docH = document.documentElement.scrollHeight;
    if (data) populate();
    draw(performance.now());
  }

  // ---------------- Pokémon ----------------
  // Direcciones de las hojas de SpriteCollab: abajo, abajo-derecha, derecha, arriba-derecha, arriba, arriba-izquierda,
  // izquierda, abajo-izquierda.
  const DIRS = [[0, 1], [0.7, 0.7], [1, 0], [0.7, -0.7], [0, -1], [-0.7, -0.7], [-1, 0], [-0.7, 0.7]];
  function populate() {
    const worldH = docH * PAR + H, n = Math.max(6, Math.min(70, Math.round(W * worldH / 95000)));
    const sheets = {};
    mons = [];
    for (let i = 0; i < n; i++) {
      const m = data[Math.floor(hash(i, 7, 3) * data.length)];
      const sheet = sheets[m.d] || (sheets[m.d] = { img: null, m });
      mons.push({ s: sheet, x: hash(i, 1, 1) * W, y: hash(i, 2, 1) * worldH, dir: 2 + 4 * (hash(i, 3, 1) < 0.5 ? 0 : 1),
                  t: hash(i, 4, 1) * 3, walk: hash(i, 5, 1) < 0.6, ft: 0, fr: 0, spd: 26 + hash(i, 6, 1) * 22 });
    }
  }
  function sheetOf(s) {
    if (!s.img) s.img = img('../pokemon/' + s.m.d + '/Walk.png');
    return s.img.complete && s.img.naturalWidth ? s.img : null;
  }
  function step(dt) {
    for (const p of mons) {
      p.t -= dt;
      if (p.t <= 0) {
        p.walk = !p.walk || Math.random() < 0.3;
        p.t = p.walk ? 1.5 + Math.random() * 3.5 : 0.8 + Math.random() * 2.2;
        // Sobre todo a los lados, a veces en diagonal o arriba/abajo.
        if (p.walk) p.dir = Math.random() < 0.7 ? (Math.random() < 0.5 ? 2 : 6) : Math.floor(Math.random() * 8);
      }
      if (p.walk) {
        const [dx, dy] = DIRS[p.dir];
        p.x += dx * p.spd * dt; p.y += dy * p.spd * dt * 0.8;
        if (p.x < -40) { p.x = -40; p.dir = 2; } else if (p.x > W + 40) { p.x = W + 40; p.dir = 6; }
        const m = p.s.m;
        p.ft += dt * 60;
        while (p.ft >= m.dur[p.fr % m.n]) { p.ft -= m.dur[p.fr % m.n]; p.fr = (p.fr + 1) % m.n; }
      } else p.fr = 0;
    }
  }

  // ---------------- dibujo ----------------
  function draw(now) {
    const sy = scrollY * PAR;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (grass.complete && grass.naturalWidth) {
      if (!pattern) pattern = ctx.createPattern(grass, 'repeat');
      ctx.save();
      ctx.translate(0, -(sy % TILE));
      ctx.scale(PX, PX);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W / PX, (H + TILE) / PX);
      ctx.restore();
    } else { ctx.fillStyle = '#3e7a39'; ctx.fillRect(0, 0, W, H); }
    // Lo que hay en el suelo y los Pokémon, ordenado por su altura (los de abajo, delante).
    const items = [];
    const c0 = Math.floor((sy - 120) / CELL), c1 = Math.ceil((sy + H + 120) / CELL), cols = Math.ceil(W / CELL) + 1;
    for (let cy = c0; cy <= c1; cy++) for (let cx = -1; cx < cols; cx++) {
      const r = hash(cx, cy, 11);
      if (r > 0.34) continue;
      const x = (cx + hash(cx, cy, 12)) * CELL, y = (cy + hash(cx, cy, 13)) * CELL;
      const kind = r < 0.1 ? props.tree : r < 0.27 ? props.tuft[Math.floor(hash(cx, cy, 14) * 3)] : props.rock[Math.floor(hash(cx, cy, 15) * 2)];
      items.push({ y, f: () => { if (kind.complete && kind.naturalWidth) ctx.drawImage(kind, Math.round(x - kind.width * PX / 2), Math.round(y - sy - kind.height * PX), kind.width * PX, kind.height * PX); } });
    }
    for (const p of mons) {
      const yy = p.y - sy;
      if (yy < -80 || yy > H + 80) continue;
      const im = sheetOf(p.s);
      if (!im) continue;
      const m = p.s.m, fw = m.w, fh = m.h;
      items.push({ y: p.y, f: () => {
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.beginPath(); ctx.ellipse(Math.round(p.x), Math.round(yy), 9 * PX * 0.9, 3 * PX, 0, 0, 6.2832); ctx.fill();
        ctx.drawImage(im, p.fr * fw, p.dir * fh, fw, fh, Math.round(p.x - m.ax * PX), Math.round(yy - m.ay * PX), fw * PX, fh * PX);
      } });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.f();
    // Un velo suave: el texto encima se lee bien.
    ctx.fillStyle = 'rgba(6, 12, 32, .28)';
    ctx.fillRect(0, 0, W, H);
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    if (!document.hidden) { step(dt); draw(now); }
    requestAnimationFrame(loop);
  }

  fetch(base + 'fondo.json').then(r => r.json()).then(j => {
    data = j.map(([d, w, h, n, ax, ay, dur]) => ({ d, w, h, n, ax, ay, dur }));
    populate();
    draw(performance.now());
    if (!still) requestAnimationFrame(loop);
  }).catch(() => {});
  addEventListener('resize', resize);
  addEventListener('scroll', () => { if (still || !data) draw(performance.now()); }, { passive: true });
  // La altura de la página cambia al cargar las imágenes: se vuelve a repartir a los Pokémon.
  addEventListener('load', () => { docH = document.documentElement.scrollHeight; if (data) populate(); });
  for (const i of [grass, props.tree]) i.onload = () => { pattern = null; draw(performance.now()); };
  resize();
})();
