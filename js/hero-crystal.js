/*
 * Перший екран /ai — «Кристал збирає себе».
 * Скляний ікосаедр, усередині каркас 3×3×3 і ядро. При відкритті кристал
 * збирає себе (точки → лінії → грані → ядро), далі все веде скрол: каркас
 * загоряється знизу вгору повільною хвилею, грані «дихають», камера обходить
 * кристал. Миша на компʼютері дає паралакс. Поза екраном цикл не працює,
 * при «зменшити рух» — один нерухомий кадр.
 *
 * Для знімків: ?p=0.5 фіксує прогрес скролу, ?intro=1 — прогрес вступу.
 */
import * as THREE from './vendor/three.module.min.js';
import { getFrame, clamp01 } from './hero-crystal-frame.js';

const sceneEl = document.getElementById('cr-scene');
const canvas = document.getElementById('cr-canvas');
if (sceneEl && canvas) init();

function init() {
  const q = new URLSearchParams(location.search);
  const dbgP = q.has('p') ? clamp01(parseFloat(q.get('p'))) : null;
  const dbgIntro = q.has('intro') ? clamp01(parseFloat(q.get('intro'))) : null;
  const still = q.has('still');                                    // ?still=1 — один кадр без циклу (для знімків)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lo = matchMedia('(max-width: 767px)').matches || !fine;   // телефон/планшет: легше скло, 30 к/с

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { sceneEl.classList.add('cr-nogl'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lo ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0b0f19, 0);

  /* ---------- сцена ---------- */
  const R = 1.6, CY = R + 0.45, DIM = 0x22355f;
  let glowTex = null;   // текстура сяйва (створюється один раз, у glow())
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const target = new THREE.Vector3(0, CY - 0.12, 0);

  const key = new THREE.DirectionalLight(0xe6eeff, 1.9);
  key.position.set(-4.5, 8, 5); key.castShadow = true;
  key.shadow.mapSize.set(lo ? 1024 : 2048, lo ? 1024 : 2048);
  key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 6; key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30; key.shadow.bias = -0.0006; key.shadow.radius = 5;
  scene.add(key);
  const fillA = new THREE.PointLight(0xa78bfa, 9, 16, 2); fillA.position.set(5, 3.5, -3); scene.add(fillA);
  const fillB = new THREE.PointLight(0x3b82f6, 6, 16, 2); fillB.position.set(-5, 2.5, 4); scene.add(fillB);
  scene.add(new THREE.HemisphereLight(0x26345a, 0x05070d, 0.7));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.42 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const floorGlow = glowPlane(0x3b82f6, R * 3.4, 0.28); floorGlow.position.y = 0.01; scene.add(floorGlow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0x2f5bc4 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; scene.add(ring);

  const outer = new THREE.Group(); outer.rotation.set(0.25, 0, 0.15); outer.position.set(0, CY, 0);
  const spin = new THREE.Group(); outer.add(spin); scene.add(outer);

  /* оболонка: кожна грань — своя група в центрі грані, щоб розходитись уздовж нормалі й нахилятись на місці */
  const glass = lo
    ? new THREE.MeshPhysicalMaterial({ color: 0x8fb0ff, roughness: 0.16, metalness: 0, transparent: true, opacity: 0.26, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.9, depthWrite: false, side: THREE.DoubleSide })
    : new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0, transmission: 1, thickness: R * 1.1, ior: 1.45, clearcoat: 0.7, clearcoatRoughness: 0.22, specularIntensity: 0.6, envMapIntensity: 0.85, attenuationColor: new THREE.Color(0xbfd0ff), attenuationDistance: R * 3.2, depthWrite: false, side: THREE.DoubleSide });
  const rnd = seeded(11);
  const faces = facesOf(new THREE.IcosahedronGeometry(R, 0)).map((f) => {
    const g = new THREE.Group(); g.position.copy(f.center); spin.add(g);
    const m = new THREE.Mesh(f.geo, glass); m.castShadow = true; g.add(m);
    const edges = edgesOf(f.geo).map((e) => { const mat = new THREE.MeshBasicMaterial({ color: DIM }); g.add(tube(e[0], e[1], R * 0.007, mat)); return { a: e[0], b: e[1], mat, y: (e[0].y + e[1].y) / 2 + f.center.y }; });
    return { g, n: f.normal, c: f.center.clone(), jit: 1 + (rnd() - 0.5) * 0.9, rx: (rnd() - 0.5) * 0.9, ry: (rnd() - 0.5) * 0.9, edges };
  });
  const edgeAll = faces.flatMap((f) => f.edges);

  /* каркас 3×3×3 усередині */
  const D = R * 0.36, nodes = [], pairs = [];
  for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) nodes.push(new THREE.Vector3(x * D, y * D, z * D));
  nodes.forEach((a, i) => nodes.forEach((b, j) => { if (j > i && Math.abs(a.distanceTo(b) - D) < 1e-6) pairs.push([a, b]); }));
  pairs.sort((p1, p2) => keyOf(p1) - keyOf(p2));
  function keyOf(pr) { return Math.min(pr[0].y, pr[1].y) * 10 + Math.min(pr[0].z, pr[1].z) * 3 + Math.min(pr[0].x, pr[1].x); }
  const drawn = new THREE.Color(0x3d5aa8), litCol = new THREE.Color(0x9db8ff).multiplyScalar(1.6);
  const struts = pairs.map((pr) => {
    const mat = new THREE.MeshBasicMaterial({ color: drawn });
    const mesh = tube(pr[0], pr[1], R * 0.011, mat); mesh.visible = false; spin.add(mesh);
    return { a: pr[0], b: pr[1], mat, mesh, y: (pr[0].y + pr[1].y) / 2 / D, z: (pr[0].z + pr[1].z) / 2 / D, dir: new THREE.Vector3().subVectors(pr[1], pr[0]).normalize() };
  });
  const N = struts.length;
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x7c9cfa });
  const dots = nodes.map((p) => { const m = new THREE.Mesh(new THREE.SphereGeometry(R * 0.026, 10, 8), dotMat); m.position.copy(p); m.scale.setScalar(0.001); spin.add(m); return m; });

  /* вогники: кілька мʼяких крапель, що повільно йдуть по лініях */
  const pulseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.9, 3.0) });
  const pulses = [];
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.02, R * 0.02, R * 0.11, 6), pulseMat); m.visible = false; spin.add(m);
    const gl = sprite(0x8fb0ff, R * 0.28, 0.35); gl.visible = false; spin.add(gl);
    pulses.push({ m, gl, strut: Math.floor((k + 0.5) * N / 6), phase: k / 6 });
  }
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x1a1533 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(R * 0.1, 0), coreMat); spin.add(core);
  const coreGlow = sprite(0xa78bfa, R * 1.1, 0.0); spin.add(coreGlow);
  const halo = sprite(0x3b82f6, R * 4.0, 0.14); halo.position.set(0, 0, -R * 1.3); outer.add(halo);

  const legend = Array.from(sceneEl.querySelectorAll('.cr-phases li'));
  let legendPhase = -1;

  /* ---------- стан і цикл ---------- */
  let w = 1, h = 1, dist = 8.4;
  let introMs = -350, last = 0, t = 0, frameNo = 0;
  let pTarget = 0, pSmooth = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  let visible = false, running = false;

  function fit() {
    w = Math.max(1, sceneEl.clientWidth); h = Math.max(1, sceneEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    dist = 8.3 * Math.max(1, 1.02 / camera.aspect);
  }
  function progress() {
    if (dbgP != null) return dbgP;
    const hero = sceneEl.closest('section');
    const span = (hero ? hero.offsetHeight : window.innerHeight) * (lo ? 0.6 : 0.8);
    return clamp01(window.scrollY / Math.max(1, span));
  }
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function apply(f, tt) {
    /* грані */
    for (const fc of faces) {
      const e = f.open * R * fc.jit;
      fc.g.position.copy(fc.c).addScaledVector(fc.n, e);
      fc.g.rotation.set(fc.rx * f.open, fc.ry * f.open, 0);
    }
    for (const ed of edgeAll) {
      const wv = 0.5 + 0.5 * Math.sin(ed.y * 1.8 - tt * 0.9);
      ed.mat.color.copy(new THREE.Color(DIM)).lerp(new THREE.Color(0x7c9cfa), f.edges * (0.45 + 0.55 * wv));
    }
    /* точки й лінії каркаса */
    dots.forEach((m, i) => { const s = clamp01(f.dots * dots.length - i); m.scale.setScalar(Math.max(0.001, s)); });
    struts.forEach((s, i) => {
      const fr = f.struts[i];
      s.mesh.visible = fr.draw > 0.001;
      if (!s.mesh.visible) return;
      s.mesh.scale.y = Math.max(fr.draw, 0.001);
      s.mesh.position.lerpVectors(s.a, s.b, fr.draw / 2);
      const wv = 0.5 + 0.5 * Math.sin(s.y * 2.4 + s.z * 0.8 - tt * (0.6 + 0.9 * f.pulseSpeed));
      s.mat.color.copy(drawn).lerp(litCol, fr.lit * f.wave * (0.55 + 0.45 * wv));
      s.lit = fr.lit;
    });
    pulses.forEach((pu) => {
      const s = struts[pu.strut], on = (s.lit || 0) > 0.6;
      pu.m.visible = on; pu.gl.visible = on;
      if (!on) return;
      const u = (tt * 0.09 * (0.5 + f.pulseSpeed) + pu.phase) % 1;
      pu.m.position.lerpVectors(s.a, s.b, u);
      pu.m.quaternion.setFromUnitVectors(tmpA.set(0, 1, 0), s.dir);
      pu.gl.position.copy(pu.m.position);
    });
    /* ядро */
    const c = f.core;
    coreMat.color.setRGB(0.1 + 1.6 * c, 0.08 + 1.2 * c, 0.2 + 3.2 * c);
    core.scale.setScalar(1 + 0.05 * Math.sin(tt * 1.4));
    coreGlow.material.opacity = 0.04 + 0.42 * c;
    halo.material.opacity = 0.12 + 0.16 * f.p;
    floorGlow.material.opacity = 0.22 + 0.2 * f.p;
    ring.material.color.setHex(f.p > 0.4 ? 0x4f7fe0 : 0x2f5bc4);
    /* повільне обертання, легке плавання, паралакс від миші */
    spin.rotation.y = 0.35 + tt * 0.06 + mx * 0.06;
    outer.position.y = CY + Math.sin(tt * 0.7) * 0.035;
    outer.rotation.z = 0.15 + mx * 0.03;
    /* обліт камери */
    const az = -0.35 + f.orbit + mx * 0.14, el = 0.27 + f.elev + my * 0.07;
    camera.position.set(target.x + dist * Math.cos(el) * Math.sin(az), target.y + dist * Math.sin(el), target.z + dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(target);
    if (f.phase !== legendPhase) { legendPhase = f.phase; legend.forEach((li, i) => li.classList.toggle('is-on', i === f.phase)); }
  }
  function render(f) { apply(f, t); renderer.render(scene, camera); }

  fit();
  if (reduced) {
    render(getFrame(dbgP != null ? dbgP : 0.35, 1, N));
    new ResizeObserver(() => { fit(); render(getFrame(dbgP != null ? dbgP : 0.35, 1, N)); }).observe(sceneEl);
    return;
  }

  function tick(now) {
    running = false;
    const dt = Math.min(last ? now - last : 16, 50); last = now;      // покадрово, крок ≤ 50 мс (iOS присипляє цикл)
    t += dt / 1000; frameNo++;
    if (dbgIntro == null) introMs += dt;
    const introT = dbgIntro != null ? dbgIntro : clamp01(introMs / 2400);
    pTarget = progress();
    pSmooth += (pTarget - pSmooth) * 0.14;
    mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08;
    if (still) { pSmooth = pTarget; render(getFrame(pSmooth, introT, N)); return; }
    if (!(lo && frameNo % 2)) render(getFrame(pSmooth, introT, N));   // на телефоні кожен другий кадр
    if (visible && !document.hidden) schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(tick); } }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { last = 0; schedule(); } }, { threshold: 0.02 }).observe(sceneEl);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { last = 0; schedule(); } });
  new ResizeObserver(() => { fit(); schedule(); }).observe(sceneEl);
  window.addEventListener('scroll', schedule, { passive: true });
  if (fine) {
    const hero = sceneEl.closest('section') || sceneEl;
    hero.addEventListener('pointermove', (ev) => {
      const r = hero.getBoundingClientRect();
      tmx = clamp01((ev.clientX - r.left) / r.width) * 2 - 1;
      tmy = clamp01((ev.clientY - r.top) / r.height) * 2 - 1;
      schedule();
    });
    hero.addEventListener('pointerleave', () => { tmx = 0; tmy = 0; schedule(); });
  }
  schedule();

  /* ---------- помічники ---------- */
  function studioEnv(r) {
    const pm = new THREE.PMREMGenerator(r), s = new THREE.Scene(); s.background = new THREE.Color(0x000000);
    const panel = (pw, ph, col, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(...pos); m.rotation.set(...rot); s.add(m); };
    panel(12, 5, new THREE.Color(2.2, 2.4, 2.9), [0, 7, -1], [Math.PI / 2, 0, 0]);       // мʼякий верхній софтбокс
    panel(8, 10, new THREE.Color(0.8, 1.2, 2.6), [-9, 3, 0], [0, Math.PI / 2, 0]);        // синій зліва
    panel(8, 10, new THREE.Color(1.6, 1.0, 2.6), [9, 3, -1], [0, -Math.PI / 2, 0]);       // фіолетовий справа
    panel(14, 8, new THREE.Color(0.5, 0.55, 0.7), [0, 3, 12], [0, Math.PI, 0]);           // ледь помітний фронтальний
    panel(14, 14, new THREE.Color(0.06, 0.08, 0.14), [0, -3, 0], [-Math.PI / 2, 0, 0]);
    const tex = pm.fromScene(s, 0.04).texture; pm.dispose(); return tex;
  }
  function facesOf(geo) {
    const p = geo.attributes.position, groups = new Map();
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      const k = [n.x, n.y, n.z].map((v) => Math.round(v * 100)).join(',');
      if (!groups.has(k)) groups.set(k, { n, pts: [] });
      groups.get(k).pts.push(a, b, c);
    }
    return Array.from(groups.values()).map((g) => {
      const center = new THREE.Vector3(); g.pts.forEach((v) => center.add(v)); center.multiplyScalar(1 / g.pts.length);
      const arr = []; g.pts.forEach((v) => arr.push(v.x - center.x, v.y - center.y, v.z - center.z));
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); bg.computeVertexNormals();
      return { geo: bg, normal: g.n, center };
    });
  }
  function edgesOf(geo) {
    const e = new THREE.EdgesGeometry(geo, 1), p = e.attributes.position, out = [];
    for (let i = 0; i < p.count; i += 2) out.push([new THREE.Vector3().fromBufferAttribute(p, i), new THREE.Vector3().fromBufferAttribute(p, i + 1)]);
    return out;
  }
  function tube(a, b, rad, mat) {
    const d = tmpB.subVectors(b, a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 6, 1, true), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(tmpA.set(0, 1, 0), d.normalize());
    return m;
  }
  function glow() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c); return glowTex;
  }
  function sprite(color, size, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1); return s;
  }
  function glowPlane(color, size, opacity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: glow(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; return m;
  }
  function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
}
