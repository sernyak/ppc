/*
 * 3D-логотип із кубиків. Сірі обʼємні кубики зʼявляються, хаотично літають і
 * крутяться кожен навколо своїх осей, потім синхронізуються (хмара обертається
 * як одне ціле, кубики перекидаються в унісон) і хвилею зліва направо сідають
 * у свої місця. Далі логотип стоїть, камера ледь погойдується.
 *
 * Логотип: будь-який рядок або картинка розкладається на сітку кубиків у 2 шари
 * (voxelize). Заглушка — слово LOGO. Без правки коду: ?text=ACME або
 * ?img=logo.png (PNG з прозорістю, або темний знак на світлому тлі).
 *
 * Для запису: ?capture=1 — без циклу, кадр малює window.renderAt(t);
 * ?t=1.5 — один нерухомий кадр на цей час. «Зменшити рух» — одразу зібраний логотип.
 */
import * as THREE from '../../js/vendor/three.module.min.js';

// ---------- таймлайн, с ----------
const POP_LEN = 0.32;                       // поява кубика (затримки 0…0,28) → всі видно до 0,6
const SYNC_A = 1.25, SYNC_B = 2.2;          // хаос → унісон
const GATHER = 2.2, SWEEP = 0.95, JITTER = 0.22, LAND = 1.1;   // останній сідає ≈ 4,5
const OMEGA_C = 3.4;                        // спільне перекидання навколо X, рад/с
const SWIRL = 0.5;                          // поворот усієї хмари навколо логотипа, рад
const HOLD_T = 6.5;                         // кадр для «зменшити рух»

// ---------- сцена ----------
const FOV = 30, FOV_PORTRAIT = 42;          // на вузькому екрані ширший кут — камера ближче
const CUBE = 0.92, BEVEL = 0.075;           // крок сітки = 1
const FLOAT = 2.4;                          // висота низу логотипа над підлогою

const q = new URLSearchParams(location.search);
const CAPTURE = q.has('capture');
const FIXED_T = q.has('t') ? Math.max(0, parseFloat(q.get('t')) || 0) : null;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOutBack = (u) => { const c1 = 1.5, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; };

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- логотип → кубики ----------
/**
 * source: рядок (малюється жирним гротеском) або Image/Canvas/ImageBitmap.
 * Повертає { cubes: [{x,y,z}], width, height, depth } у кроках сітки, центр у 0.
 */
export function voxelize(source, { rows = 18, depth = 2, threshold = 0.5, maxCubes = 2600 } = {}) {
  let grid;
  for (let r = rows; r >= 8; r -= 2) {
    grid = sampleGrid(source, r, threshold);
    if (grid.cells.length * depth <= maxCubes) break;
  }
  const { cells, cols, rowsN } = grid;
  const cubes = [];
  for (const [cx, cy] of cells) {
    for (let k = 0; k < depth; k++) {
      cubes.push({ x: cx - (cols - 1) / 2, y: (rowsN - 1) / 2 - cy, z: k - (depth - 1) / 2 });
    }
  }
  return { cubes, width: cols, height: rowsN, depth };
}

function sampleGrid(source, rows, threshold) {
  const PX = 10;                                  // пікселів на клітинку під час вибірки
  const c = document.createElement('canvas');
  let ctx;
  let mask;                                       // Float32Array 0…1, заповненість пікселя

  if (typeof source === 'string') {
    const size = Math.round(rows * PX * 1.42);    // висота великих літер ≈ rows клітинок
    const font = `900 ${size}px "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const gap = size * 0.06;
    ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.font = font;
    const chars = [...source];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    c.width = Math.ceil(widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1) + size);
    c.height = Math.ceil(size * 1.7);
    ctx.font = font;
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'alphabetic';
    let x = size / 2;
    chars.forEach((ch, i) => { ctx.fillText(ch, x, size * 1.2); x += widths[i] + gap; });
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    mask = new Float32Array(c.width * c.height);
    for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] / 255;
  } else {
    const iw = source.naturalWidth || source.width, ih = source.naturalHeight || source.height;
    const scale = (rows * PX * 1.6) / ih;
    c.width = Math.max(1, Math.round(iw * scale)) + 4;
    c.height = Math.max(1, Math.round(ih * scale)) + 4;
    ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 2, 2, c.width - 4, c.height - 4);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let hasAlpha = false;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { hasAlpha = true; break; }
    mask = new Float32Array(c.width * c.height);
    for (let i = 0; i < mask.length; i++) {
      const a = d[i * 4 + 3] / 255;
      const lum = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
      mask[i] = hasAlpha ? a * (lum < 0.92 ? 1 : 0) : 1 - lum;   // прозорий PNG або темне на світлому
    }
  }

  // обрізати до заповненої області
  const W = c.width, H = c.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (mask[y * W + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { cells: [], cols: 1, rowsN: 1 };
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const cellH = bh / rows;
  const cols = Math.max(1, Math.round(bw / cellH));
  const cellW = bw / cols;
  const cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const ax = Math.floor(x0 + i * cellW), bx = Math.max(ax + 1, Math.floor(x0 + (i + 1) * cellW));
    const ay = Math.floor(y0 + j * cellH), by = Math.max(ay + 1, Math.floor(y0 + (j + 1) * cellH));
    let sum = 0, n = 0;
    for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) { sum += mask[y * W + x]; n++; }
    if (sum / n >= threshold) cells.push([i, j]);
  }
  return { cells, cols, rowsN: rows };
}

async function logoSource() {
  const img = q.get('img');
  if (img) {
    try {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.src = img;
      await im.decode();
      return im;
    } catch (e) { /* лишаємо заглушку */ }
  }
  return (q.get('text') || 'LOGO').slice(0, 24);
}

// ---------- геометрія: кубик зі скругленими ребрами ----------
function roundedBox(size, radius, k = 2) {
  const M = 2 * k + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, M, M, M);
  const h = size / 2, inner = h - radius;
  const remap = (u) => {
    const j = Math.round((u + 0.5) * M);
    return j <= k ? -h + radius * (j / k) : inner + radius * ((j - k - 1) / k);
  };
  const pos = g.attributes.position, nor = g.attributes.normal;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(remap(pos.getX(i)), remap(pos.getY(i)), remap(pos.getZ(i)));
    c.set(
      Math.max(-inner, Math.min(inner, v.x)),
      Math.max(-inner, Math.min(inner, v.y)),
      Math.max(-inner, Math.min(inner, v.z)),
    );
    n.subVectors(v, c).normalize();
    v.copy(c).addScaledVector(n, radius);
    pos.setXYZ(i, v.x, v.y, v.z);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  g.deleteAttribute('uv');
  return g;
}

// ---------- студійне оточення для відблисків (без зовнішніх файлів) ----------
function studioEnvironment(renderer) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x77736d, side: THREE.BackSide }));
  room.scale.set(24, 14, 24);
  room.position.y = 4;
  s.add(room);
  const panel = (w, h, x, y, z, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(10, 4, -2, 10.5, 3, 5.5);    // верхній софтбокс
  panel(4, 7, -11, 4, 5, 3.2);       // ліворуч-спереду
  panel(3, 7, 11, 3, -4, 1.6);       // контровий праворуч-ззаду
  panel(14, 5, 0, 2, 11.5, 1.1);     // заповнення спереду
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.04).texture;
  pm.dispose();
  return tex;
}

function contactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.translate(128, 32);
  ctx.scale(1, 0.25);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.45, 'rgba(0,0,0,.55)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(-128, -128, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- головне ----------
main();

async function main() {
  const root = document.documentElement;
  if (CAPTURE) root.classList.add('capture');
  const canvas = document.getElementById('scene');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
  } catch (e) { root.classList.add('nogl'); return; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const logo = voxelize(await logoSource(), { rows: 18, depth: 2 });
  const N = logo.cubes.length;
  const LW = logo.width, LH = logo.height;
  const CY = FLOAT + LH / 2;                       // центр логотипа над підлогою y=0

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 2000);
  const target = new THREE.Vector3(0, CY, 0);

  // світло
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b1a6, 0.45));
  const key = new THREE.DirectionalLight(0xfff6ec, 2.3);
  const KEY_DIR = new THREE.Vector3(-0.55, 0.78, 0.42).normalize();
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xe9eef7, 0.7);
  rim.position.set(40, 25, -45);
  scene.add(rim);

  // підлога: видно лише тіні
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.ShadowMaterial({ color: 0x2c2620, opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(LW * 1.15, LW * 0.29),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0, color: 0x231e18 }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.01;
  contact.renderOrder = 1;
  scene.add(contact);

  // кубики
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.46, metalness: 0.06, envMapIntensity: 0.85 });
  const mesh = new THREE.InstancedMesh(roundedBox(CUBE, BEVEL, 2), mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);

  // дані кожного кубика
  const rnd = mulberry32(20261026);
  const r = (a, b) => a + (b - a) * rnd();
  const TX = new Float32Array(N), TY = new Float32Array(N), TZ = new Float32Array(N);
  const VX = new Float32Array(N), VY = new Float32Array(N), VZ = new Float32Array(N);
  const AX = new Float32Array(N), AY = new Float32Array(N), AZ = new Float32Array(N);
  const F1 = new Float32Array(N), F2 = new Float32Array(N), F3 = new Float32Array(N);
  const P1 = new Float32Array(N), P2 = new Float32Array(N), P3 = new Float32Array(N);
  const SAX = new Float32Array(N), SAY = new Float32Array(N), SAZ = new Float32Array(N);
  const W0 = new Float32Array(N), PH = new Float32Array(N);
  const POP = new Float32Array(N), ARR = new Float32Array(N), Q = new Float32Array(N), ARC = new Float32Array(N);
  const color = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const cb = logo.cubes[i];
    TX[i] = cb.x; TY[i] = CY + cb.y; TZ[i] = cb.z;
    VX[i] = r(-1.6, 1.6); VY[i] = r(-0.35, 0.5); VZ[i] = r(-1.4, 1.4);
    AX[i] = r(0.8, 2.4); AY[i] = r(0.5, 1.2); AZ[i] = r(0.8, 2.2);
    F1[i] = r(0.7, 1.6); F2[i] = r(0.6, 1.4); F3[i] = r(0.5, 1.3);
    P1[i] = r(0, 6.283); P2[i] = r(0, 6.283); P3[i] = r(0, 6.283);
    // власна вісь обертання; x ≥ 0.25, щоб плавно звести всіх до спільної осі X
    let ax = r(-1, 1), ay = r(-1, 1), az = r(-1, 1);
    let w = r(1.8, 4.6) * (rnd() < 0.5 ? -1 : 1);
    if (ax < 0) { ax = -ax; ay = -ay; az = -az; w = -w; }
    ax = Math.max(ax, 0.25);
    const l = Math.hypot(ax, ay, az);
    SAX[i] = ax / l; SAY[i] = ay / l; SAZ[i] = az / l;
    W0[i] = w; PH[i] = r(0, 6.283);
    POP[i] = r(0, 0.28);
    const sweep = (cb.x + LW / 2) / LW;            // хвиля зліва направо
    ARR[i] = GATHER + SWEEP * clamp01(sweep * 0.88 + 0.12 * (1 - (cb.y + LH / 2) / LH)) + JITTER * rnd() - (cb.z < 0 ? 0.04 : 0);
    ARR[i] = Math.max(GATHER, ARR[i]);
    // кут, на якому кубик стане в сітку: найближча чверть оберту після гальмування
    const thAt = OMEGA_C * ARR[i] + OMEGA_C * LAND * 0.5;
    Q[i] = Math.ceil(thAt / (Math.PI / 2)) * (Math.PI / 2);
    ARC[i] = r(0.6, 1);
    const g = r(0.6, 0.8);
    color.setRGB(g, g * 0.995, g * 0.985, THREE.SRGBColorSpace);
    mesh.setColorAt(i, color);
  }
  mesh.instanceColor.needsUpdate = true;

  // розміри кадру → стартові точки кубиків, тіні, камера
  let baseDist = 100, EX = 30, EY = 20, EL0 = 0.08, NEAR = 0.42;
  const SX = new Float32Array(N), SY = new Float32Array(N), SZ = new Float32Array(N);
  const cam0 = new THREE.PerspectiveCamera(FOV, 1, 1, 2000);
  const ray = new THREE.Vector3(), fwd = new THREE.Vector3(), pt = new THREE.Vector3();
  function layout() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(CAPTURE ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const portrait = w / h < 0.9;
    camera.aspect = w / h;
    camera.fov = portrait ? FOV_PORTRAIT : FOV;
    camera.updateProjectionMatrix();
    EL0 = portrait ? 0.17 : 0.08;
    NEAR = portrait ? 0.3 : 0.42;
    const tn = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needW = LW * 1.42 + 3, needH = LH * 2.2 + 6;
    baseDist = Math.max(needH / 2 / tn, needW / 2 / (tn * camera.aspect));
    const hh = baseDist * tn, hw = hh * camera.aspect;
    EX = hw; EY = hh;

    // старт: випадкові точки по всьому кадру першої секунди, на різній глибині, над підлогою
    cam0.aspect = camera.aspect;
    cam0.fov = camera.fov;
    cam0.updateProjectionMatrix();
    placeCamera(cam0, 0);
    cam0.updateMatrixWorld();
    cam0.getWorldDirection(fwd);
    const d0 = cam0.position.distanceTo(target);
    for (let i = 0; i < N; i++) {
      const pr = mulberry32(7919 * (i + 1));
      let ok = false;
      for (let k = 0; k < 16 && !ok; k++) {
        ray.set((pr() * 2 - 1) * 0.97, (pr() * 2 - 1) * 0.95, 0.5).unproject(cam0).sub(cam0.position).normalize();
        const cosA = ray.dot(fwd);
        let depth = d0 * (NEAR + (1.22 - NEAR) * Math.pow(pr(), 0.8));
        pt.copy(cam0.position).addScaledVector(ray, depth / cosA);
        if (pt.y < 2.2 && ray.y < 0) {
          // під підлогою — підтягнути ближче до камери по тому ж променю
          const s = (2.2 + 4 * pr() - cam0.position.y) / ray.y;
          depth = s * cosA;
          pt.copy(cam0.position).addScaledVector(ray, s);
        }
        ok = pt.y >= 2.2 && depth >= d0 * NEAR * 0.9;
      }
      if (!ok) pt.y = 2.2 + 3 * pr();
      SX[i] = pt.x; SY[i] = pt.y; SZ[i] = pt.z;
    }

    const R = Math.max(hw, hh) * 1.25 + 10;
    const D = 220;
    key.position.copy(target).addScaledVector(KEY_DIR, D);
    key.target.position.copy(target);
    const sc = key.shadow.camera;
    sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 10; sc.far = D + R * 2;
    sc.updateProjectionMatrix();
    key.shadow.needsUpdate = true;
  }

  // «внутрішній час» хаосу: після SYNC_A рух стишується (інтеграл 1 − 0,6·smooth)
  function tauAt(t) {
    const k = 0.6, d = SYNC_B - SYNC_A;
    if (t <= SYNC_A) return t;
    if (t <= SYNC_B) { const X = (t - SYNC_A) / d; return t - k * d * (X * X * X - (X * X * X * X) / 2); }
    return t - k * (d * 0.5 + (t - SYNC_B));
  }

  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), axis = new THREE.Vector3();
  function update(t) {
    const sSync = smooth(SYNC_A, SYNC_B, t);
    const tau = tauAt(t);
    const sw = SWIRL * smooth(SYNC_A - 0.2, 4.6, t);
    const cs = Math.cos(sw), sn = Math.sin(sw);
    const thC = OMEGA_C * t;
    for (let i = 0; i < N; i++) {
      const sc = easeOutBack(clamp01((t - POP[i]) / POP_LEN));
      const u = clamp01((t - ARR[i]) / LAND);
      if (u >= 1) {
        pv.set(TX[i], TY[i], TZ[i]);
        qt.identity();
        sv.setScalar(1);
      } else {
        // хаос: дрейф + шум, потім уся хмара закручується навколо логотипа як одне ціле
        let x = SX[i] + VX[i] * tau + AX[i] * Math.sin(F1[i] * tau + P1[i]);
        let y = SY[i] + VY[i] * tau + AY[i] * Math.sin(F2[i] * tau + P2[i]);
        let z = SZ[i] + VZ[i] * tau + AZ[i] * Math.sin(F3[i] * tau + P3[i]);
        const nx = x / EX, ny = (y - CY) / EY;     // еліптичний вир у площині кадру
        x = EX * (nx * cs - ny * sn);
        y = CY + EY * (nx * sn + ny * cs);
        if (y < 1.2) y = 1.2 - (1.2 - y) * 0.15;  // не пірнати під підлогу
        // обертання: власна вісь і швидкість → спільне перекидання навколо X
        axis.set(SAX[i] + (1 - SAX[i]) * sSync, SAY[i] * (1 - sSync), SAZ[i] * (1 - sSync)).normalize();
        let th = (PH[i] + W0[i] * t) * (1 - sSync) + thC * sSync;
        if (u > 0) {
          const e = easeInOutCubic(u);
          const lift = Math.sin(Math.PI * u) * ARC[i];
          x += (TX[i] - x) * e;
          y += (TY[i] - y) * e + lift * 1.4;
          z += (TZ[i] - z) * e + lift * 3.2;
          th += (Q[i] - th) * easeInOutCubic(clamp01(u * 1.05));
        }
        pv.set(x, y, z);
        qt.setFromAxisAngle(axis, th);
        sv.setScalar(sc);
      }
      m4.compose(pv, qt, sv);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // контактна тінь під логотипом проявляється, коли він зібраний
    contact.material.opacity = 0.32 * smooth(3.0, 4.9, t);

    placeCamera(camera, t);
  }

  // камера: легкий наїзд і облет, щоб було видно обʼєм; після збирання — ледь погойдується
  function placeCamera(cam, t) {
    const yaw = 0.14 - 0.26 * smooth(0.3, 6.0, t) + 0.045 * Math.sin(0.42 * (t - 6.0)) * smooth(5.0, 7.5, t);
    const el = EL0 + 0.06 * smooth(0.3, 6.0, t);
    const dist = baseDist * (1.14 - 0.14 * smooth(0, 5.6, t));
    cam.position.set(
      target.x + Math.sin(yaw) * Math.cos(el) * dist,
      target.y + Math.sin(el) * dist,
      target.z + Math.cos(yaw) * Math.cos(el) * dist,
    );
    cam.lookAt(target);
  }

  function renderAt(t) {
    update(t);
    renderer.render(scene, camera);
  }

  layout();
  let resizeQueued = false;
  const onResize = () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; layout(); if (staticT !== null) renderAt(staticT); });
  };
  window.addEventListener('resize', onResize);

  const staticT = CAPTURE ? null : FIXED_T !== null ? FIXED_T : REDUCED ? HOLD_T : null;

  if (CAPTURE) {
    window.renderAt = (t) => { renderAt(t); return new Promise((res) => requestAnimationFrame(() => res(true))); };
    window.captureReady = true;
    return;
  }

  const replayBtn = document.getElementById('replay');
  if (staticT !== null) {
    if (FIXED_T === null) replayBtn.hidden = true;   // «зменшити рух»: повторювати нічого
    renderAt(staticT);
    requestAnimationFrame(() => { window.frameReady = true; });
    return;
  }

  let t0 = performance.now();
  const replay = () => { t0 = performance.now(); };
  replayBtn.addEventListener('click', (e) => { e.stopPropagation(); replay(); });
  canvas.addEventListener('click', replay);
  function loop(now) {
    renderAt((now - t0) / 1000);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
