/*
 * Перший екран /ai — радіант: металевий каркас кубооктаедра, всередині
 * вкладена ґратка зі спицями, сині світлові лінії лише на внутрішній ґратці.
 *
 * При відкритті (~1,5 с) збирається лише порожній зовнішній каркас і далі
 * повільно обертається. Головне веде скрол: каркас розсувається, всередині
 * малюється ґратка, спиці зʼєднують її з вузлами, ґратка провертається на
 * чверть оберту, каркас замикається, всередині займається світло і пульсує
 * повільною хвилею; камера обходить фігуру. На компʼютері перший екран на
 * час історії закріплений (sticky), на телефоні історію веде положення
 * сторінки. Миша дає паралакс. Поза екраном цикл не працює, при «зменшити
 * рух» — один нерухомий кадр без закріплення.
 *
 * Для знімків: ?p=0.5 фіксує прогрес скролу, ?intro=1 — вступ, ?still=1 — один кадр.
 */
import * as THREE from './vendor/three.module.min.js';
import { getFrame, clamp01 } from './hero-crystal-frame.js?v=8';

const sceneEl = document.getElementById('cr-scene');
const canvas = document.getElementById('cr-canvas');
if (sceneEl && canvas) init();

function init() {
  const q = new URLSearchParams(location.search);
  const dbgP = q.has('p') ? clamp01(parseFloat(q.get('p'))) : null;
  const dbgIntro = q.has('intro') ? clamp01(parseFloat(q.get('intro'))) : null;
  const still = q.has('still');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lgMQ = matchMedia('(min-width: 1024px)');
  const lo = matchMedia('(max-width: 767px)').matches || !fine;   // телефон/планшет: без сяйва навколо ліній, 30 к/с
  if (reduced) document.documentElement.classList.add('cr-reduced');

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

  /* усе спільне — до першого використання */
  const R = 1.55, CY = R + 0.5;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
  const tmpS = new THREE.Vector3(), tmpT = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0), mtx = new THREE.Matrix4();
  const LIGHT = new THREE.Color(0x47a0ff);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const target = new THREE.Vector3(0, CY - 0.05, 0);

  const key = new THREE.DirectionalLight(0xe8eeff, 1.5);
  key.position.set(-2.2, 9, 4.5); key.castShadow = true;
  key.shadow.mapSize.set(lo ? 1024 : 2048, lo ? 1024 : 2048);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 6; key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30; key.shadow.bias = -0.0006; key.shadow.radius = 9;
  scene.add(key);
  const fillA = new THREE.PointLight(0xb9b0f0, 2.4, 16, 2); fillA.position.set(5, 3.5, -3); scene.add(fillA);
  const fillB = new THREE.PointLight(0x60a5fa, 3, 16, 2); fillB.position.set(-5, 2.5, 4); scene.add(fillB);
  scene.add(new THREE.HemisphereLight(0x3a4a70, 0x05070d, 0.65));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const outer = new THREE.Group(); outer.rotation.set(0.22, 0, 0.12); outer.position.set(0, CY, 0);
  const spin = new THREE.Group(); outer.add(spin); scene.add(outer);
  const innerGrp = new THREE.Group(); spin.add(innerGrp);              // внутрішня ґратка (провертається окремо)

  /* матеріали: матовий шліфований алюміній */
  const brushed = brushedTexture();
  const metalOuter = new THREE.MeshStandardMaterial({ color: 0x9fa6ae, metalness: 0.86, roughness: 0.5, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.006, envMapIntensity: 0.95 });
  const metalInner = new THREE.MeshStandardMaterial({ color: 0x848b94, metalness: 0.86, roughness: 0.54, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.004, envMapIntensity: 0.85 });

  /* кубооктаедр: 12 вершин, 24 ребра */
  const C = cubocta();
  const VO = C.V.map((v) => v.clone().multiplyScalar(R));
  const VI = C.V.map((v) => v.clone().multiplyScalar(R * 0.52));
  const thO = R * 0.062, thI = R * 0.036, thS = R * 0.03;

  const jointsOuter = VO.map((v) => ({ m: joint(v, thO * 0.74, metalOuter, spin), v })).sort((a, b) => a.v.y - b.v.y);
  const jointsInner = VI.map((v) => ({ m: joint(v, thI * 0.8, metalInner, innerGrp), v })).sort((a, b) => a.v.y - b.v.y);
  const outerBeams = C.E.map((e) => ({ m: beam(VO[e[0]], VO[e[1]], thO, metalOuter, 0, spin), i: e[0], j: e[1], y: Math.min(VO[e[0]].y, VO[e[1]].y) })).sort((a, b) => a.y - b.y);

  /* світлова лінія = тонкий брус + світлова смужка на його грані (+ сяйво на компʼютері) */
  function lightLine(a, b, th, off, parent, extra) {
    const bar = beam(a, b, th, metalInner, 0, parent);
    const lightMat = new THREE.MeshBasicMaterial({ color: LIGHT });
    const strip = beam(a, b, th * 0.34, lightMat, off, parent); strip.castShadow = false;
    let glow = null;
    if (!lo) {
      glow = beam(a, b, th * 1.9, new THREE.MeshBasicMaterial({ color: LIGHT, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }), off, parent);
      glow.castShadow = false;
    }
    const mid = tmpA.addVectors(a, b).multiplyScalar(0.5);
    return Object.assign({ bar, strip, glow, lightMat, k: mid.y * 2.0 + mid.x * 0.7 + mid.z * 0.4, y: Math.min(a.y, b.y), a, b }, extra);
  }
  const innerEdges = C.E.map((e) => lightLine(VI[e[0]], VI[e[1]], thI, thI * 0.52, innerGrp, {})).sort((p1, p2) => p1.y - p2.y);
  const spokes = VO.map((v, i) => lightLine(VO[i], VI[i], thS, thS * 0.52, spin, { idx: i })).sort((p1, p2) => p1.y - p2.y);
  const COUNTS = { jointsOuter: jointsOuter.length, outer: outerBeams.length, jointsInner: jointsInner.length, inner: innerEdges.length, spokes: spokes.length };

  const legend = Array.from(sceneEl.querySelectorAll('.cr-phases li'));
  let legendPhase = -1;

  /* ---------- стан і цикл ---------- */
  let w = 1, h = 1, dist = 7;
  let introMs = -300, last = 0, t = 0, angle = 0.4, frameNo = 0;
  let pTarget = 0, pSmooth = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  let visible = false, running = false;
  const heroEl = sceneEl.closest('section');

  function fit() {
    w = Math.max(1, sceneEl.clientWidth); h = Math.max(1, sceneEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    dist = 8.3 * Math.max(1, 1.02 / camera.aspect);                    // фігура ≈ на пʼяту частину менша, ніж була (6.9)
  }
  function progress() {
    if (dbgP != null) return dbgP;
    if (lgMQ.matches && heroEl) {                                          // компʼютер: секція закріплена, історія = її прокрутка
      const r = heroEl.getBoundingClientRect(), span = r.height - window.innerHeight;
      return span > 1 ? clamp01(-r.top / span) : clamp01(window.scrollY / Math.max(1, window.innerHeight * 0.75));
    }
    return clamp01(window.scrollY / Math.max(1, window.innerHeight * 0.75));   // телефон: без закріплення
  }
  /* поставити брус між a і b, намальований на частку d від a; орієнтація як у beam() */
  function placeBeam(m, a, b, d) {
    m.visible = d > 0.001;
    if (!m.visible) return;
    const dir = tmpB.subVectors(b, a); const len = dir.length(); dir.normalize();
    const mid = tmpC.addVectors(a, b).multiplyScalar(0.5);
    const z = tmpA.copy(mid).addScaledVector(dir, -mid.dot(dir));
    if (z.lengthSq() < 1e-6) z.crossVectors(dir, Math.abs(dir.y) < 0.9 ? UP : RIGHT);
    z.normalize();
    const x = tmpD.crossVectors(dir, z).normalize();
    m.quaternion.setFromRotationMatrix(mtx.makeBasis(x, dir, z));
    m.scale.y = Math.max(0.001, d * len / m.userData.len0);
    m.position.copy(a).addScaledVector(dir, len * d / 2).addScaledVector(z, m.userData.off);
  }
  function lightOf(L, f, tt) {
    const wv = 0.5 + 0.5 * Math.sin(L.k - tt * (0.5 + 1.1 * f.pulseSpeed));
    const br = f.light * (0.45 + 0.55 * (1 - f.wave + f.wave * wv));
    L.lightMat.color.copy(LIGHT).multiplyScalar(0.2 + 1.35 * br);      // не вище ~1.5×, щоб лінії лишались синіми, а не білими
    if (L.glow) L.glow.material.opacity = 0.03 + 0.16 * br;
  }
  function apply(f, tt) {
    const open = f.open;
    jointsOuter.forEach((j, i) => { j.m.scale.setScalar(Math.max(0.001, f.jointsOuter[i])); j.m.position.copy(j.v).multiplyScalar(open); });
    outerBeams.forEach((b, i) => placeBeam(b.m, tmpS.copy(VO[b.i]).multiplyScalar(open), tmpT.copy(VO[b.j]).multiplyScalar(open), f.outer[i]));
    jointsInner.forEach((j, i) => j.m.scale.setScalar(Math.max(0.001, f.jointsInner[i])));
    innerGrp.rotation.y = f.swivel;
    innerEdges.forEach((L, i) => { const d = f.inner[i]; placeBeam(L.bar, L.a, L.b, d); placeBeam(L.strip, L.a, L.b, d); if (L.glow) placeBeam(L.glow, L.a, L.b, d); lightOf(L, f, tt); });
    spokes.forEach((L, i) => {
      const d = f.spokes[i];
      const a = tmpS.copy(VO[L.idx]).multiplyScalar(open), b = tmpT.copy(VI[L.idx]).applyAxisAngle(UP, f.swivel);
      placeBeam(L.bar, a, b, d); placeBeam(L.strip, a, b, d); if (L.glow) placeBeam(L.glow, a, b, d); lightOf(L, f, tt);
    });
    /* повільне обертання + поворот від скролу, ледь помітне плавання, паралакс від миші */
    spin.rotation.y = angle + f.spin + mx * 0.06;
    outer.rotation.x = 0.22 + my * 0.03;
    outer.position.y = CY + Math.sin(tt * 0.6) * 0.03;
    /* обліт камери */
    const az = -0.4 + f.orbit + mx * 0.14, el = 0.25 + f.elev + my * 0.07;
    camera.position.set(target.x + dist * Math.cos(el) * Math.sin(az), target.y + dist * Math.sin(el), target.z + dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(target);
    if (f.phase !== legendPhase) { legendPhase = f.phase; legend.forEach((li, i) => li.classList.toggle('is-on', i === f.phase)); }
  }
  function render(f) { apply(f, t); renderer.render(scene, camera); }

  fit();
  if (reduced) {
    render(getFrame(dbgP != null ? dbgP : 0.95, 1, COUNTS));
    new ResizeObserver(() => { fit(); render(getFrame(dbgP != null ? dbgP : 0.95, 1, COUNTS)); }).observe(sceneEl);
    return;
  }

  function tick(now) {
    running = false;
    const dt = Math.min(last ? now - last : 16, 50); last = now;      // покадрово, крок ≤ 50 мс (iOS присипляє цикл)
    t += dt / 1000; frameNo++;
    if (dbgIntro == null) introMs += dt;
    const introT = dbgIntro != null ? dbgIntro : clamp01(introMs / 1500);
    pTarget = progress();
    pSmooth += (pTarget - pSmooth) * 0.16;
    mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08;
    angle += dt / 1000 * 0.1;                                            // повільне обертання у спокої
    if (still) { pSmooth = pTarget; render(getFrame(pSmooth, introT, COUNTS)); return; }
    if (!(lo && frameNo % 2)) render(getFrame(pSmooth, introT, COUNTS));
    if (visible && !document.hidden) schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(tick); } }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { last = 0; schedule(); } }, { threshold: 0.02 }).observe(sceneEl);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { last = 0; schedule(); } });
  new ResizeObserver(() => { fit(); schedule(); }).observe(sceneEl);
  window.addEventListener('scroll', schedule, { passive: true });
  if (fine) {
    const hero = heroEl || sceneEl;
    hero.addEventListener('pointermove', (ev) => {
      const r = hero.getBoundingClientRect();
      tmx = clamp01((ev.clientX - r.left) / r.width) * 2 - 1;
      tmy = clamp01((ev.clientY - Math.max(r.top, 0)) / Math.min(r.height, window.innerHeight)) * 2 - 1;
      schedule();
    });
    hero.addEventListener('pointerleave', () => { tmx = 0; tmy = 0; schedule(); });
  }
  schedule();

  /* ---------- геометрія ---------- */
  function cubocta() {
    const P = [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]];
    const V = P.map((p) => new THREE.Vector3(p[0], p[1], p[2]).multiplyScalar(Math.SQRT1_2));
    const E = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.abs(V[i].distanceToSquared(V[j]) - 1) < 1e-6) E.push([i, j]);
    return { V, E };
  }
  /* брус квадратного перерізу вздовж a→b; одна грань бруса дивиться назовні від центра фігури; off — зсув уздовж цієї нормалі */
  function beam(a, b, th, mat, off, parent) {
    const dir = tmpB.subVectors(b, a); const len = dir.length(); dir.normalize();
    const mid = tmpC.addVectors(a, b).multiplyScalar(0.5);
    const z = mid.clone().addScaledVector(dir, -mid.dot(dir));
    if (z.lengthSq() < 1e-6) z.crossVectors(dir, Math.abs(dir.y) < 0.9 ? UP : RIGHT);
    z.normalize();
    const x = new THREE.Vector3().crossVectors(dir, z).normalize();
    const m = new THREE.Mesh(new THREE.BoxGeometry(th, len, th), mat);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, dir.clone(), z));
    m.userData = { a: a.clone(), b: b.clone(), off, len0: len };
    m.position.copy(mid).addScaledVector(z, off);
    m.castShadow = true; m.visible = false;
    parent.add(m);
    return m;
  }
  function joint(v, r, mat, parent) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat);
    m.position.copy(v); m.castShadow = true; m.scale.setScalar(0.001); parent.add(m); return m;
  }
  function brushedTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, 256, 256);
    let s = 3;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < 900; i++) {
      const y = rnd() * 256, l = 20 + rnd() * 200, x = rnd() * 256, v = Math.round(110 + rnd() * 70);
      g.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.35)'; g.lineWidth = 0.6 + rnd() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke();
    }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2); return tex;
  }
  function studioEnv(r) {
    const pm = new THREE.PMREMGenerator(r), s = new THREE.Scene(); s.background = new THREE.Color(0x000000);
    const panel = (pw, ph, col, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(...pos); m.rotation.set(...rot); s.add(m); };
    panel(12, 6, new THREE.Color(3.0, 3.2, 3.6), [0, 7, -1], [Math.PI / 2, 0, 0]);
    panel(8, 10, new THREE.Color(1.0, 1.4, 2.8), [-9, 3, 0], [0, Math.PI / 2, 0]);
    panel(8, 10, new THREE.Color(1.3, 1.25, 1.8), [9, 3, -1], [0, -Math.PI / 2, 0]);
    panel(14, 8, new THREE.Color(0.9, 1.0, 1.2), [0, 3, 12], [0, Math.PI, 0]);
    panel(14, 14, new THREE.Color(0.1, 0.12, 0.18), [0, -3, 0], [-Math.PI / 2, 0, 0]);
    const tex = pm.fromScene(s, 0.04).texture; pm.dispose(); return tex;
  }
}
