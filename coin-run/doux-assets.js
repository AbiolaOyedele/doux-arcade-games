/* Doux game asset library.
   Every model the shooter uses, built in one place so the asset page (and later the game) share them.
   Needs THREE (r128) loaded first. Exposes window.DouxAssets. */
(function () {
'use strict';

const LOGO_D = "M1169.98 6623.36C1983.5 5577.41 4390.15 2458.92 5491.79 1030.42C6545.01 -531.235 7126.09 25.894 7489.27 485.66C8627.22 1926.27 11077.5 5054.44 12210.6 6623.36C13627 8584.53 12065.3 9746.7 10794.2 11925.8C9777.28 13669 8941.97 13015.3 8651.43 12470.5C8179.3 11816.8 7053.45 10276.9 6327.1 9347.2C5419.16 8185.03 6472.37 7930.81 7852.44 7277.08C9232.52 6623.36 8433.53 5424.88 7961.4 4117.44C7489.27 2809.99 7053.45 2882.63 6762.91 2918.95C6472.37 2955.27 6109.19 3500.03 5891.29 4117.44C5673.38 4734.84 3966.45 8620.84 3203.78 10218.8C2441.11 11816.8 1642.11 10473.1 552.583 9347.2C-536.948 8221.35 153.088 7930.81 1169.98 6623.36Z";
const BRAND = { teal: 0x064343, cream: 0xF8F3E9 };
const CUR = {
  doux: { g: '',  name: 'Doux coin', col: '#F8F3E9', note: 'Raises firepower. A hit costs one level.' },
  ngn:  { g: '₦', name: 'Naira',     col: '#9be3b4', note: 'Charges the Nova.' },
  usd:  { g: '$', name: 'Dollar',    col: '#f6dc8c', note: 'Rapid fire for 5 seconds.' },
  gbp:  { g: '£', name: 'Pound',     col: '#e8b4e6', note: 'Double score for 6 seconds.' },
  eur:  { g: '€', name: 'Euro',      col: '#a8cbf5', note: 'Shield for 4 seconds.' },
  usdt: { g: '₮', name: 'Tether',    col: '#8fd3bd', note: 'Repairs one hull point.' },
  sol:  { g: '◎', name: 'Solana',    col: '#b3a5f2', note: 'Slows time for 3 seconds.' },
  btc:  { g: '₿', name: 'Bitcoin',   col: '#f7c59a', note: 'Jackpot. Gold runners and bosses only.' },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Shared textures and helpers ---------- */
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.35, 'rgba(255,255,255,.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const GLOW = glowTex();
const glowMat = (col, opacity = 1) => new THREE.SpriteMaterial({ map: GLOW, color: col, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
function part(g, geo, mat, x = 0, y = 0, z = 0, rz = 0, rx = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m;
}
function makeEnv(renderer) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#d8ecff'); grd.addColorStop(0.42, '#33467a'); grd.addColorStop(0.55, '#0b0f22'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  [[110, 60, '#ffffff', 46], [380, 70, '#7fd4ff', 60], [250, 36, '#ffe1a6', 32], [470, 150, '#b88cff', 40]].forEach(([x, y, col, r]) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  });
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(t).texture; t.dispose(); pm.dispose();
  return env;
}

// A bright photo-studio surround for the coins to reflect. Under the game's dark space sky a silver coin
// has nothing light to reflect and goes navy. Drawn tiny on purpose: stretched, it becomes soft studio gradients.
let STUDIO = null;
function init() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 32);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.45, '#e6e9ee'); grd.addColorStop(0.56, '#a9afb8'); grd.addColorStop(1, '#d6dae0');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 32);
  g.fillStyle = '#ffffff';
  [[5, 4, 14, 9], [26, 3, 11, 8], [44, 5, 15, 8], [18, 21, 10, 5]].forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
  g.fillStyle = '#6b727c'; g.fillRect(0, 15, 64, 1);
  STUDIO = new THREE.CanvasTexture(c); STUDIO.mapping = THREE.EquirectangularReflectionMapping;
}

/* ---------- Player ship: the Doux logo, extruded ---------- */
function logoShape() {
  const toks = LOGO_D.match(/[MCZ]|-?\d*\.?\d+/gi);
  const s = new THREE.Shape(); let i = 0, cmd = '';
  const n = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    const t = toks[i];
    if (/^[MCZ]$/i.test(t)) { cmd = t.toUpperCase(); i++; if (cmd === 'Z') continue; }
    if (cmd === 'M') { const x = n(), y = n(); s.moveTo(x, -y); }
    else if (cmd === 'C') { const a = [n(), n(), n(), n(), n(), n()]; s.bezierCurveTo(a[0], -a[1], a[2], -a[3], a[4], -a[5]); }
    else i++;
  }
  return s;
}
const SHIP_H = 1.8;
function makeShip() {
  const geo = new THREE.ExtrudeGeometry(logoShape(), { depth: 1100, bevelEnabled: true, bevelThickness: 380, bevelSize: 280, bevelSegments: 5, curveSegments: 30 });
  geo.computeBoundingBox();
  const bb = geo.boundingBox, ctr = new THREE.Vector3(); bb.getCenter(ctr);
  const k = SHIP_H / (bb.max.y - bb.min.y);
  geo.translate(-ctr.x, -ctr.y, -ctr.z); geo.scale(k, k, k);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const hh = SHIP_H / 2, W = new THREE.Color(BRAND.cream), G = new THREE.Color(0x8fb5ab), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = clamp((hh - pos.getY(i)) / SHIP_H, 0, 1);
    if (t < 0.616) c.copy(W).lerp(G, t / 0.616); else c.copy(G).lerp(W, (t - 0.616) / 0.384);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.26, envMapIntensity: 1.3 })));
  const toLocal = (x, y) => new THREE.Vector3((x - ctr.x) * k, (-y - ctr.y) * k, -0.1);
  const flames = [toLocal(2350, 11050), toLocal(9700, 12500)].map(p => {
    const sp = new THREE.Sprite(glowMat(0x6fe8ff)); sp.position.copy(p); sp.scale.set(0.7, 0.9, 1); g.add(sp); return sp;
  });
  g.userData.tick = () => flames.forEach(f => { const s = 0.55 + Math.random() * 0.25; f.scale.set(s, s * 1.5, 1); });
  return g;
}

/* ---------- Shots ---------- */
function makeShots() {
  const g = new THREE.Group(), geo = new THREE.CylinderGeometry(0.055, 0.055, 0.6, 6);
  part(g, geo, new THREE.MeshBasicMaterial({ color: BRAND.cream }), -0.5, 0, 0);
  part(g, geo, new THREE.MeshBasicMaterial({ color: 0xffe08a }), 0, 0, 0);
  part(g, new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4466 }), 0.5, 0, 0);
  return g;
}

/* ---------- Coins ----------
   Three styles share one builder:
   silver  - polished metal coin with a reeded edge and a raised rim; the symbol is a glossy inlay in the currency colour
   flat    - matte disc, plain face, symbol in a contrasting brand colour, barely raised
   moulded - glossy single-colour coin with a raised rim and a deeply embossed symbol */
const COIN_R = 0.42;
const COIN_STYLE = {
  silver:  { face: 0.895, rimIn: 0.915, rimOut: 0.968, rim: 0.013, half: 0.027, emboss: 0.022, edge: 0.029, blur: 1, lo: 0.25, hi: 0.75, recess: 0 },
  flat:    { face: 0.86, rimIn: 0.9,  rimOut: 0.955, rim: 0,     half: 0.07, emboss: 0.014, edge: 0.058, blur: 2, lo: 0.2,  hi: 0.8,  recess: 0 },
  moulded: { face: 0.68, rimIn: 0.77, rimOut: 0.9,   rim: 0.034, half: 0.04, emboss: 0.032, edge: 0.016, blur: 2, lo: 0.2,  hi: 0.8,  recess: 0.16 },
};
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
// Draws the symbol centred on an N x N canvas. Shared by the height map and the colour map so the two always line up.
// Solana and Tether have real logos, not a keyboard character, so they are drawn as shapes.
function emblem(t, N) {
  const p = new Path2D(), pt = (x, y, first) => (first ? p.moveTo(x * N, y * N) : p.lineTo(x * N, y * N));
  if (t === 'sol') {
    // three slanted bars, the middle one leaning the other way
    const L = 0.25, R = 0.75, h = 0.105, gap = 0.07, sl = 0.105;
    let y = 0.5 - (3 * h + 2 * gap) / 2;
    [1, -1, 1].forEach(dir => {
      if (dir > 0) { pt(L + sl, y, true); pt(R, y); pt(R - sl, y + h); pt(L, y + h); }
      else { pt(L, y, true); pt(R - sl, y); pt(R, y + h); pt(L + sl, y + h); }
      p.closePath(); y += h + gap;
    });
    return { shape: p };
  }
  if (t === 'usdt') {
    // a capital T with a flat ring around its stem
    [[0.29, 0.27], [0.71, 0.27], [0.71, 0.385], [0.56, 0.385], [0.56, 0.76], [0.44, 0.76], [0.44, 0.385], [0.29, 0.385]].forEach(([x, y], i) => pt(x, y, i === 0));
    p.closePath();
    return { shape: p, ring: { cx: 0.5 * N, cy: 0.5 * N, rx: 0.27 * N, ry: 0.065 * N, w: 0.03 * N } };
  }
  return null;
}
// With `outline` (a width in canvas pixels) it strokes the symbol's edge instead of filling it.
function drawSymbol(g, t, N, outline = 0) {
  g.lineJoin = 'round';
  const em = emblem(t, N);
  if (em) {
    const r = em.ring, oval = d => { g.beginPath(); g.ellipse(r.cx, r.cy, r.rx + d, r.ry + d, 0, 0, Math.PI * 2); g.stroke(); };
    if (outline) {
      g.lineWidth = outline; g.stroke(em.shape);
      if (r) { g.lineWidth = outline * 0.6; oval(-r.w / 2); oval(r.w / 2); }
    } else {
      g.fill(em.shape);
      if (r) { g.strokeStyle = g.fillStyle; g.lineWidth = r.w; oval(0); }
    }
    return;
  }
  if (t === 'doux') {
    const k = 0.54 * N / 13057, path = new Path2D(LOGO_D);
    g.save(); g.translate(N / 2, N / 2); g.scale(k, k); g.translate(-6386, -6528);
    if (outline) { g.lineWidth = outline / k; g.stroke(path); } else g.fill(path);
    g.restore();
  } else {
    g.font = `bold ${Math.round(N * 0.617)}px Arial, "Segoe UI Symbol", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (outline) { g.lineWidth = outline; g.strokeText(CUR[t].g, N / 2, N * 0.535); } else g.fillText(CUR[t].g, N / 2, N * 0.535);
  }
}
// The symbol as a blurred height map, so its edges come out as a bevel rather than a hard step.
function symbolHeight(t, passes) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.fillStyle = '#fff'; drawSymbol(g, t, N);
  const px = g.getImageData(0, 0, N, N).data;
  const f = new Float32Array(N * N), tmp = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) f[i] = px[i * 4] / 255;
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let s = 0; for (let d = -2; d <= 2; d++) s += f[y * N + clamp(x + d, 0, N - 1)];
      tmp[y * N + x] = s / 5;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let s = 0; for (let d = -2; d <= 2; d++) s += tmp[clamp(y + d, 0, N - 1) * N + x];
      f[y * N + x] = s / 5;
    }
  }
  return (x, y) => {
    const u = clamp((x / COIN_R * 0.5 + 0.5) * (N - 1), 0, N - 1.001), v = clamp((0.5 - y / COIN_R * 0.5) * (N - 1), 0, N - 1.001);
    const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0, i = y0 * N + x0;
    return (f[i] * (1 - fx) + f[i + 1] * fx) * (1 - fy) + (f[i + N] * (1 - fx) + f[i + N + 1] * fx) * fy;
  };
}
// One side of the coin as a polar grid: face, optional rim, rounded shoulder, symbol pushed up out of the face.
function coinFaceGeo(t, S) {
  const R = COIN_R, h = symbolHeight(t, S.blur), r1 = S.face * R, r2 = S.rimIn * R, r3 = S.rimOut * R, RINGS = 72, ROUND = 10, SEG = 192;
  const radii = [];
  for (let i = 0; i <= RINGS; i++) radii.push(r3 * i / RINGS);
  for (let k = 1; k <= ROUND; k++) radii.push(r3 + (R - r3) * Math.sin(k / ROUND * Math.PI / 2));
  const pos = [], col = [], uv = [], idx = [];
  radii.forEach(r => {
    for (let j = 0; j < SEG; j++) {
      const a = j / SEG * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r;
      const rise = smooth(r1, r2, r), sym = smooth(S.lo, S.hi, h(x, y)) * (1 - smooth(r1 * 0.88, r1, r));
      let z = S.half + S.rim * rise + S.emboss * sym;
      if (r > r3) { const u = (r - r3) / (R - r3); z = S.edge + (S.half + S.rim - S.edge) * Math.sqrt(Math.max(0, 1 - u * u)); }
      pos.push(x, y, z); uv.push(x / R * 0.5 + 0.5, y / R * 0.5 + 0.5);
      const shade = 1 - S.recess * (1 - rise) * (1 - sym);   // moulded: the recess sits a touch darker so the symbol and rim lift off it
      col.push(shade, shade, shade);
    }
  });
  for (let i = 0; i < radii.length - 1; i++) for (let j = 0; j < SEG; j++) {
    const a = i * SEG + j, b = (i + 1) * SEG + j, c = (i + 1) * SEG + (j + 1) % SEG, d = i * SEG + (j + 1) % SEG;
    idx.push(a, b, c, a, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// A face painted in two flat fills, background and symbol, so the symbol edge stays crisp at any size.
// `bevel` paints a band along the symbol's edge, which is where the raised symbol's sloped sides sit.
function paintFace(t, bg, ink, bevel) {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, N, N); g.fillStyle = typeof ink === 'function' ? ink(g, N) : ink; drawSymbol(g, t, N);
  if (bevel) { g.strokeStyle = bevel; drawSymbol(g, t, N, N * 0.03); }
  const map = new THREE.CanvasTexture(c); map.anisotropy = 8;
  return map;
}
// Silver style geometry. Each zone (face, inner bevel, rim, outer bevel) is its own strip of triangles,
// so the shading breaks sharply at every edge the way a struck coin does instead of rolling over.
function coinFaceCrisp(t, S) {
  const R = COIN_R, h = symbolHeight(t, S.blur), r1 = S.face * R, r2 = S.rimIn * R, r3 = S.rimOut * R, SEG = 192, top = S.half + S.rim;
  const zAt = (r, x, y) => {
    if (r <= r1) return S.half + S.emboss * clamp((h(x, y) - S.lo) / (S.hi - S.lo), 0, 1) * (1 - smooth(r1 * 0.86, r1 * 0.97, r));
    if (r <= r2) return S.half + S.rim * (r - r1) / (r2 - r1);
    if (r <= r3) return top;
    return top + (S.edge - top) * (r - r3) / (R - r3);
  };
  const pos = [], uv = [], idx = [];
  [[0, r1, 76], [r1, r2, 1], [r2, r3, 1], [r3, R, 1]].forEach(([ra, rb, n]) => {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const r = ra + (rb - ra) * i / n;
      for (let j = 0; j < SEG; j++) {
        const a = j / SEG * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r;
        pos.push(x, y, zAt(r, x, y)); uv.push(x / R * 0.5 + 0.5, y / R * 0.5 + 0.5);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < SEG; j++) {
      const p = base + i * SEG + j, q = base + (i + 1) * SEG + j, u = base + (i + 1) * SEG + (j + 1) % SEG, v = base + i * SEG + (j + 1) % SEG;
      idx.push(p, q, u, p, u, v);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// Silver style: bright silver with a thin raised lip and a reeded edge; the raised symbol carries the currency colour.
// The silver is a soft grey base blended half and half with the studio reflection. A physically correct metal
// flares to pure white whenever its flat face lines up with a light; this stays a steady white-silver at every angle.
const SILVER = '#858b95';
function reedTex() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 2;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 8, 2); g.fillStyle = '#fff'; g.fillRect(2, 0, 4, 2);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(150, 1);
  return t;
}
let reed = null;
function silverKit(t, S) {
  const top = (t === 'doux' ? new THREE.Color(0x12938a) : new THREE.Color(CUR[t].col)).multiplyScalar(0.76), side = top.clone().multiplyScalar(0.45);   // darker sides keep a pale symbol readable on silver
  // The silver picks up a trace of its currency colour, as a real coin would from the coloured inlay beside it.
  const metal = '#' + new THREE.Color(SILVER).lerp(top, 0.1).getHexString();
  if (!reed) reed = reedTex();
  // Solana's logo is a purple-to-green gradient rather than one colour.
  const ink = t !== 'sol' ? '#' + top.getHexString() : (g, N) => {
    const grd = g.createLinearGradient(0.25 * N, 0.75 * N, 0.75 * N, 0.25 * N);
    grd.addColorStop(0, '#a98cf0'); grd.addColorStop(1, '#8fe0c0'); return grd;
  };
  const shine = { envMap: STUDIO, combine: THREE.MixOperation, reflectivity: 0.5, specular: 0x101010, shininess: 50 };
  return {
    geo: coinFaceCrisp(t, S),
    // specularMap: full reflection on the metal, very little on the enamel symbol
    face: new THREE.MeshPhongMaterial({ map: paintFace(t, metal, ink, '#' + side.getHexString()), specularMap: paintFace(t, '#ffffff', '#303030', '#303030'), ...shine }),
    edge: new THREE.MeshPhongMaterial({ color: metal, bumpMap: reed, bumpScale: 0.03, ...shine }),
    halo: glowMat(CUR[t].col, 0.08),
  };
}
// Flat style: light coins get the brand teal symbol, dark coins the brand cream one.
function flatKit(t, S) {
  const raw = new THREE.Color(CUR[t].col);
  const body = raw.clone().multiplyScalar((t === 'doux' ? 0.68 : 0.64) / Math.max(raw.r, raw.g, raw.b));   // matte, kept just under the bloom
  const ink = lum(raw) > 0.56 ? new THREE.Color(BRAND.teal) : new THREE.Color(BRAND.cream).multiplyScalar(0.7);
  const map = paintFace(t, '#' + body.getHexString(), '#' + ink.getHexString());
  const mat = { metalness: 0, roughness: 0.88, envMapIntensity: 0.25 };
  return {
    geo: coinFaceGeo(t, S),
    face: new THREE.MeshStandardMaterial({ ...mat, map }),
    edge: new THREE.MeshStandardMaterial({ ...mat, color: body.clone().multiplyScalar(0.8) }),
    halo: glowMat(CUR[t].col, 0.1),
  };
}
function mouldedKit(t, S) {
  // The cream Doux coin starts from a warmer sand tone: plain cream, once held back, just reads as grey.
  const col = new THREE.Color(t === 'doux' ? '#f0dcae' : CUR[t].col).lerp(new THREE.Color(0xffffff), t === 'doux' ? 0 : 0.16);
  col.multiplyScalar(Math.min(0.7, 0.42 / lum(col)));
  const base = { color: col, metalness: 0, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.5, emissive: col, emissiveIntensity: 0.06 };
  return {
    geo: coinFaceGeo(t, S),
    face: new THREE.MeshPhysicalMaterial({ ...base, vertexColors: true }),
    edge: new THREE.MeshPhysicalMaterial(base),
    halo: glowMat(CUR[t].col, 0.1),
  };
}
const coinEdgeGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, 1, 96, 1, true);
const coinKits = {};
function makeCoin(t, style = 'silver') {
  const S = COIN_STYLE[style], id = style + ':' + t;
  if (!coinKits[id]) coinKits[id] = (style === 'silver' ? silverKit : style === 'flat' ? flatKit : mouldedKit)(t, S);
  const k = coinKits[id], grp = new THREE.Group(), spin = new THREE.Group();
  part(spin, k.geo, k.face);
  part(spin, k.geo, k.face).rotation.y = Math.PI;
  part(spin, coinEdgeGeo, k.edge, 0, 0, 0, 0, Math.PI / 2).scale.y = S.edge * 2;
  const halo = new THREE.Sprite(k.halo); halo.scale.set(1.5, 1.5, 1); grp.add(halo);
  grp.add(spin); grp.userData.disc = spin;
  return grp;
}

/* ---------- Hunter drone ---------- */
const DM = {
  hull: new THREE.MeshStandardMaterial({ color: 0x4a5068, metalness: 0.75, roughness: 0.35, flatShading: true }),
  trim: new THREE.MeshStandardMaterial({ color: 0x8a90a6, metalness: 1, roughness: 0.2 }),
  lit: new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff2a4a, emissiveIntensity: 1.8 }),
  bossHull: new THREE.MeshStandardMaterial({ color: 0x3a2030, metalness: 0.85, roughness: 0.3, flatShading: true }),
  bossLit: new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff5a1f, emissiveIntensity: 2 }),
  halo: glowMat(0xff2a4a, 0.6), bossHalo: glowMat(0xff5a1f, 0.7),
};
const DG = {
  core: new THREE.OctahedronGeometry(0.5, 0), eye: new THREE.SphereGeometry(0.16, 20, 14), lid: new THREE.TorusGeometry(0.2, 0.04, 8, 24),
  barrel: new THREE.CylinderGeometry(0.05, 0.07, 0.42, 10), muzzle: new THREE.SphereGeometry(0.06, 10, 8),
  arm: new THREE.BoxGeometry(0.56, 0.12, 0.1), pod: new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8), tip: new THREE.ConeGeometry(0.12, 0.42, 8),
  strip: new THREE.BoxGeometry(0.045, 0.38, 0.045), fin: new THREE.ConeGeometry(0.07, 0.5, 4),
  ring: new THREE.TorusGeometry(0.66, 0.022, 6, 48), node: new THREE.BoxGeometry(0.12, 0.05, 0.07),
};
function ringGroup(lit, n = 3) {
  const r = new THREE.Group(); r.add(new THREE.Mesh(DG.ring, DM.trim));
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; part(r, DG.node, lit, Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0, a + Math.PI / 2); }
  return r;
}
const pulse = (lit, base) => t => { lit.emissiveIntensity = base + Math.sin(t * 5) * 0.5; };
function makeDrone(isBoss = false) {
  const g = new THREE.Group(), hull = isBoss ? DM.bossHull : DM.hull, lit = isBoss ? DM.bossLit : DM.lit;
  part(g, DG.core, hull).scale.set(1, 1.25, 0.72);
  part(g, DG.eye, lit, 0, -0.16, 0.27); part(g, DG.lid, DM.trim, 0, -0.16, 0.27, 0, -0.45);
  const halo = new THREE.Sprite(isBoss ? DM.bossHalo : DM.halo); halo.position.set(0, -0.16, 0.37); halo.scale.set(0.9, 0.9, 1); g.add(halo);
  part(g, DG.barrel, DM.trim, 0, -0.78, 0); part(g, DG.muzzle, lit, 0, -1, 0);
  (isBoss ? [-1.45, -0.8, 0.8, 1.45] : [-0.8, 0.8]).forEach(px => {
    const s = Math.sign(px), py = Math.abs(px) > 1 ? -0.2 : 0;
    part(g, DG.arm, hull, px - s * 0.3, py + 0.1, 0, s * 0.4);
    part(g, DG.pod, hull, px, py, 0); part(g, DG.tip, DM.trim, px, py - 0.5, 0, Math.PI); part(g, DG.strip, lit, px, py, 0.14);
  });
  part(g, DG.fin, DM.trim, 0, 0.78, 0);
  const ring = ringGroup(lit); ring.rotation.x = 1.15; g.add(ring);
  const spin = [{ o: ring, a: 'z', v: 2.2 }];
  if (isBoss) {
    ring.scale.setScalar(1.25);
    const r2 = ringGroup(lit); r2.rotation.x = -0.9; r2.scale.setScalar(2.6); g.add(r2); spin.push({ o: r2, a: 'z', v: -1.8 });
  }
  g.userData.spin = spin; g.userData.pulse = pulse(lit, isBoss ? 1.9 : 1.5);
  return g;
}

/* ---------- Gold runner: nose along +x ---------- */
const RG = { body: new THREE.ConeGeometry(0.3, 1.7, 6), tail: new THREE.CylinderGeometry(0.3, 0.2, 0.3, 6), wing: new THREE.BoxGeometry(0.75, 0.5, 0.05), edge: new THREE.BoxGeometry(0.7, 0.045, 0.07) };
const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0a83a, metalness: 0.9, roughness: 0.3, flatShading: true, emissive: 0x6a3a00, emissiveIntensity: 0.5 });
const goldLit = new THREE.MeshStandardMaterial({ color: 0x1a0d00, emissive: 0xff9a1f, emissiveIntensity: 1.8 });
function makeRunner() {
  const g = new THREE.Group();
  part(g, RG.body, goldMat, 0, 0, 0, -Math.PI / 2).scale.set(1, 1, 0.6);
  part(g, RG.tail, DM.hull, -0.98, 0, 0, -Math.PI / 2).scale.set(1, 1, 0.6);
  [-1, 1].forEach(s => { part(g, RG.wing, goldMat, -0.45, s * 0.42, 0, s * 0.55); part(g, RG.edge, goldLit, -0.52, s * 0.68, 0, s * 0.55); });
  const coin = makeCoin('btc'); coin.scale.setScalar(0.55); coin.position.set(-0.3, 0, 0.36); g.add(coin);
  g.userData.spin = [{ o: coin.userData.disc, a: 'y', v: 3 }]; g.userData.pulse = pulse(goldLit, 1.6);
  return g;
}

/* ---------- Boss drones ---------- */
const BG = {
  eye: new THREE.SphereGeometry(0.3, 24, 16), lid: new THREE.TorusGeometry(0.36, 0.06, 8, 28),
  hex: new THREE.CylinderGeometry(1.1, 1.1, 0.4, 6), cell: new THREE.CylinderGeometry(0.2, 0.2, 0.08, 6),
  spike: new THREE.ConeGeometry(0.1, 0.7, 5), blade: new THREE.BoxGeometry(0.14, 1.9, 0.12),
  dart: new THREE.ConeGeometry(0.42, 2.2, 4), cannon: new THREE.CylinderGeometry(0.1, 0.14, 1.0, 10), wing: new THREE.BoxGeometry(1.3, 0.5, 0.1),
  orb: new THREE.IcosahedronGeometry(0.62, 1), sat: new THREE.SphereGeometry(0.16, 14, 10),
  slab: new THREE.BoxGeometry(3.4, 0.55, 0.3), tower: new THREE.BoxGeometry(0.9, 1.5, 0.5), turret: new THREE.CylinderGeometry(0.28, 0.34, 0.5, 8),
};
function bossEye(g, M, x, y, z, s) {
  part(g, BG.eye, M.lit, x, y, z).scale.setScalar(s); part(g, BG.lid, DM.trim, x, y, z).scale.setScalar(s);
  const h = new THREE.Sprite(M.halo); h.position.set(x, y, z + 0.2); h.scale.set(1.8 * s, 1.8 * s, 1); g.add(h);
}
const BOSSES = [
  {
    name: 'Warden', note: 'Level 1 boss. An oversized hunter with aimed fans, bullet rings and a few escorts.',
    glow: 0xff5a1f, hull: 0x3a2030, fit: 2.0,
    mats: { hull: DM.bossHull, lit: DM.bossLit, halo: DM.bossHalo },
    build(g, M, spin) { const m = makeDrone(true); g.add(m); spin.push(...m.userData.spin); },
  },
  {
    name: 'Hive', note: 'Level 2 boss. A carrier that keeps spilling swarms of little drones.',
    glow: 0xd8ff3a, hull: 0x3a4020, fit: 1.8,
    build(g, M, spin) {
      part(g, BG.hex, M.hull, 0, 0, 0, 0, Math.PI / 2);
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2 + 0.52;
        part(g, BG.cell, M.lit, Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0.22, 0, Math.PI / 2);
        part(g, BG.spike, DM.trim, Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0, a - Math.PI / 2);
      }
      bossEye(g, M, 0, 0, 0.26, 0.8);
      const r = ringGroup(M.lit, 6); r.scale.setScalar(2.3); r.rotation.x = 0.35; g.add(r); spin.push({ o: r, a: 'z', v: 1.2 });
    },
  },
  {
    name: 'Lancer', note: 'Level 3 boss. A sniper that locks on, then fires a fast stream down the line.',
    glow: 0x3ad8ff, hull: 0x1f3a4c, fit: 2.1,
    build(g, M, spin) {
      part(g, BG.dart, M.hull, 0, 0, 0, Math.PI).scale.set(1, 1, 0.6);
      [-1, 1].forEach(s => {
        part(g, BG.blade, DM.trim, s * 0.6, -0.35, 0); part(g, DG.strip, M.lit, s * 0.6, -0.35, 0.09).scale.y = 4;
        part(g, BG.wing, M.hull, s * 0.85, 0.75, 0, s * 0.6); part(g, BG.spike, DM.trim, s * 0.35, 1.35, 0);
      });
      part(g, BG.cannon, DM.trim, 0, -1.35, 0); part(g, DG.muzzle, M.lit, 0, -1.9, 0).scale.setScalar(2);
      bossEye(g, M, 0, 0.25, 0.24, 0.6);
      const r = ringGroup(M.lit, 2); r.scale.setScalar(0.5); r.position.y = -1.3; r.rotation.x = Math.PI / 2; g.add(r); spin.push({ o: r, a: 'z', v: 6 });
    },
  },
  {
    name: 'Orbiter', note: 'Level 4 boss. A gyroscope that fills the screen with spirals and rings.',
    glow: 0xff3ad0, hull: 0x40244a, fit: 1.8,
    build(g, M, spin) {
      part(g, BG.orb, M.hull); bossEye(g, M, 0, -0.1, 0.55, 0.8);
      [[1.2, 0, 1.6, 1.5], [-0.7, 0.8, 1.9, -1.1], [0.3, 1.3, 2.2, 0.8]].forEach(([rx, ry, sc, v]) => {
        const r = ringGroup(M.lit, 2); r.scale.setScalar(sc); r.rotation.x = rx; r.rotation.y = ry; g.add(r); spin.push({ o: r, a: 'z', v });
      });
      const sats = new THREE.Group();
      for (let k = 0; k < 4; k++) part(sats, BG.sat, M.lit, Math.cos(k * Math.PI / 2) * 1.55, Math.sin(k * Math.PI / 2) * 1.55, 0);
      g.add(sats); spin.push({ o: sats, a: 'z', v: -1.6 });
    },
  },
  {
    name: 'Titan', note: 'Level 5 boss. A fortress with a turret on each wing that uses every attack.',
    glow: 0xff2a2a, hull: 0x4a2622, fit: 2.0,
    build(g, M, spin) {
      part(g, BG.slab, M.hull, 0, 0.25, 0); part(g, BG.tower, M.hull, 0, 0, 0.05);
      part(g, BG.blade, M.lit, 0, 0.25, 0.17, Math.PI / 2).scale.set(0.4, 1.7, 0.4);
      bossEye(g, M, 0, -0.25, 0.34, 0.75);
      [-1, 1].forEach(s => {
        part(g, BG.turret, M.hull, s * 1.35, -0.15, 0.05); part(g, BG.cannon, DM.trim, s * 1.35, -0.75, 0.05).scale.set(1, 0.7, 1);
        part(g, DG.muzzle, M.lit, s * 1.35, -1.1, 0.05).scale.setScalar(1.8);
      });
      for (let k = -2; k <= 2; k++) part(g, BG.spike, DM.trim, k * 0.32, 0.95 + (2 - Math.abs(k)) * 0.12, 0);
      const r = ringGroup(M.lit, 4); r.scale.setScalar(2.5); r.rotation.x = 1.3; g.add(r); spin.push({ o: r, a: 'z', v: 1.4 });
    },
  },
];
function makeBoss(i) {
  const def = BOSSES[i];
  if (!def.mats) def.mats = {
    hull: new THREE.MeshStandardMaterial({ color: def.hull, metalness: 0.85, roughness: 0.3, flatShading: true }),
    lit: new THREE.MeshStandardMaterial({ color: 0x110000, emissive: def.glow, emissiveIntensity: 2 }),
    halo: glowMat(def.glow, 0.7),
  };
  const g = new THREE.Group(), spin = [];
  def.build(g, def.mats, spin);
  g.userData.spin = spin; g.userData.pulse = pulse(def.mats.lit, 1.9);
  return g;
}

/* ---------- Obstacles ---------- */
function rockGeo(v) {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, sd = v * 1.7 + 0.3;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = 1 + 0.22 * Math.sin(x * 3.1 + sd) * Math.cos(y * 2.7 - sd) + 0.14 * Math.sin(z * 4.3 + x * 1.3 + sd * 2);
    p.setXYZ(i, x * f, y * f * 0.92, z * f);
  }
  g.computeVertexNormals(); return g;
}
const rockMat = new THREE.MeshStandardMaterial({ color: 0x6d625c, roughness: 0.92, metalness: 0.15, flatShading: true });
const hotRockMat = new THREE.MeshStandardMaterial({ color: 0x5a3a33, roughness: 0.85, metalness: 0.1, flatShading: true, emissive: 0xff4a1a, emissiveIntensity: 0.35 });
const makeRock = (hot, v) => { const g = new THREE.Group(); part(g, rockGeo(v), hot ? hotRockMat : rockMat); return g; };
// Vault crate: a plain rounded safe in brand teal. One door plate, one dial, two hinges and a small Doux mark, front and back.
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
let crateKit = null;
function makeCrate() {
  if (!crateKit) {
    const body = new THREE.ExtrudeGeometry(roundedRect(1.4, 1.4, 0.2), { depth: 1.1, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 5, curveSegments: 10 });
    body.translate(0, 0, -0.55);
    const door = new THREE.ExtrudeGeometry(roundedRect(1.22, 1.22, 0.14), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 10 });
    const mark = new THREE.ShapeGeometry(logoShape(), 12);
    mark.computeBoundingBox();
    const bb = mark.boundingBox, k = 0.24 / (bb.max.y - bb.min.y);
    mark.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0); mark.scale(k, k, k);
    const steel = { color: 0xb9bfc8, metalness: 0.7, roughness: 0.3 };
    crateKit = {
      body, door, mark,
      ring: new THREE.CylinderGeometry(0.25, 0.25, 0.06, 40), knob: new THREE.CylinderGeometry(0.14, 0.16, 0.14, 32),
      grip: new THREE.BoxGeometry(0.36, 0.06, 0.05), hinge: new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16),
      shell: new THREE.MeshStandardMaterial({ color: 0x0a5754, metalness: 0.25, roughness: 0.45 }),
      plate: new THREE.MeshStandardMaterial({ color: 0x0f726d, metalness: 0.25, roughness: 0.4 }),
      steel: new THREE.MeshStandardMaterial(steel),
      cream: new THREE.MeshStandardMaterial({ color: new THREE.Color(BRAND.cream).multiplyScalar(0.72), metalness: 0, roughness: 0.6 }),
    };
  }
  const K = crateKit, g = new THREE.Group();
  part(g, K.body, K.shell);
  [0, Math.PI].forEach(turn => {
    const f = new THREE.Group(); f.rotation.y = turn; g.add(f);
    part(f, K.door, K.plate, 0, 0, 0.65);
    part(f, K.ring, K.steel, 0.12, 0.1, 0.72, 0, Math.PI / 2);
    part(f, K.knob, K.cream, 0.12, 0.1, 0.78, 0, Math.PI / 2);
    part(f, K.grip, K.steel, 0.12, 0.1, 0.86, 0.5);
    part(f, K.hinge, K.steel, 0.63, 0.34, 0.69); part(f, K.hinge, K.steel, 0.63, -0.34, 0.69);
    part(f, K.mark, K.cream, -0.36, -0.36, 0.7);
  });
  return g;
}

/* ---------- Catalogue: what the asset page shows, in order ---------- */
const list = [
  { group: 'Player', name: 'Ship', note: 'The player. The Doux logo, extruded, with two engines.', fit: 1.25, make: makeShip },
  { group: 'Player', name: 'Shots', note: 'Player shot, rapid-fire shot, and the enemy bullet.', fit: 0.9, make: makeShots },
  ...Object.keys(CUR).map(t => ({ group: 'Coins, silver style', name: CUR[t].name, note: CUR[t].note, fit: 0.62, make: () => makeCoin(t, 'silver') })),
  ...Object.keys(CUR).map(t => ({ group: 'Coins, flat style', name: CUR[t].name, note: CUR[t].note, fit: 0.62, make: () => makeCoin(t, 'flat') })),
  ...Object.keys(CUR).map(t => ({ group: 'Coins, moulded style', name: CUR[t].name, note: CUR[t].note, fit: 0.62, make: () => makeCoin(t, 'moulded') })),
  { group: 'Enemies', name: 'Hunter drone', note: 'The regular enemy. Hovers, fires aimed shots, then dives. Bosses spill a smaller copy.', fit: 1.25, make: () => makeDrone() },
  { group: 'Enemies', name: 'Gold runner', note: 'Streaks across the top carrying a Bitcoin.', fit: 1.3, make: makeRunner },
  ...BOSSES.map((b, i) => ({ group: 'Bosses', name: b.name, note: b.note, fit: b.fit, make: () => makeBoss(i) })),
  { group: 'Obstacles', name: 'Rock', note: 'Takes a few hits. Big ones split in two.', fit: 1.25, make: () => makeRock(false, 1) },
  { group: 'Obstacles', name: 'Molten rock', note: 'Faster. Appears from level 3.', fit: 1.25, make: () => makeRock(true, 3) },
  { group: 'Obstacles', name: 'Vault crate', note: 'Shoot it open for a handful of coins.', fit: 1.45, make: makeCrate },
];

window.DouxAssets = { init, LOGO_D, BRAND, CUR, BOSSES, makeEnv, makeShip, makeShots, makeCoin, makeDrone, makeRunner, makeBoss, makeRock, makeCrate, list };
})();
