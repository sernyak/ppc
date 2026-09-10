/*
 * Перший екран /ai — «Сховище».
 * Кристал — кубооктаедр: рама з матового алюмінію, всередині менша копія й
 * дванадцять спиць зі світловими смужками, тонке скло між брусами, маленьке ядро.
 * Він висить у темній залі з дзеркальною підлогою; стіни вкриті дрібними
 * формулами його систем.
 *
 * При завантаженні — лише поява: кристал зʼявляється й повільно обертається,
 * ядро тліє. Головне дає скрол (на компʼютері hero «липкий» на час прокрутки):
 * ядро спалахує, смужки загоряються, проєкція повзе по стінах до далекого краю
 * зали, летять зерна світла й промені, кристал робить повний оберт і
 * піднімається, камера підʼїжджає й облітає його. Миша — паралакс зали, рядки
 * біля курсора яскравішають. На телефоні — легше скло, 30 к/с, протягування
 * пальцем повертає погляд. Поза екраном цикл спить, при «зменшити рух» — один
 * нерухомий кадр.
 *
 * Для знімків: ?p=0.5 фіксує прогрес скролу, ?intro=1 — прогрес появи,
 * ?still=1 — один кадр без циклу.
 */
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { getFrame, clamp01, CFG } from './hero-vault-frame.js';

const sceneEl = document.getElementById('vault-scene');
const canvas = document.getElementById('vault-canvas');
if (sceneEl && canvas) init();

function init() {
  const q = new URLSearchParams(location.search);
  const dbgP = q.has('p') ? clamp01(parseFloat(q.get('p'))) : null;
  const dbgIntro = q.has('intro') ? clamp01(parseFloat(q.get('intro'))) : null;
  const still = q.has('still');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const band = matchMedia('(max-width: 1023px)').matches;      // сцена — смуга між заголовком і абзацом
  const lo = band || !fine;                                     // легша якість: без заломлення, дзеркала й bloom
  let glowTex = null;                                           // текстура сяйва (створюється один раз у glow())
  const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const LIGHT = new THREE.Color(0x47a0ff);                      // синє світло смужок (акцент сайту)

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: lo, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { sceneEl.classList.add('vault-nogl'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x0b0f19, 1);

  /* ---------- розміри зали ---------- */
  const R = band ? 0.78 : 1.05;
  const cPos = band ? new THREE.Vector3(0, 1.75, 0) : new THREE.Vector3(3.8, 1.75, 0.6);    // кристал висить над підлогою
  const cam0 = band ? new THREE.Vector3(0, 2.05, 7.2) : new THREE.Vector3(0.3, 2.05, 8.8);
  const target = band ? new THREE.Vector3(0, 2.05, 0) : new THREE.Vector3(2.5, 1.95, 0);
  const WX = band ? 3.9 : 7.2, H = 7.5, WZ0 = -18, WZ1 = 8, W = WZ1 - WZ0;
  const maxDist = Math.hypot(WX + Math.abs(cPos.x), H, cPos.z - WZ0);   // до найдальшого кута — повне покриття

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer, lo ? 0.55 : 1.0);
  const camera = new THREE.PerspectiveCamera(band ? 44 : 34, 1, 0.1, 120);
  const d0 = cam0.distanceTo(target);
  const az0 = Math.atan2(cam0.x - target.x, cam0.z - target.z), el0 = Math.asin((cam0.y - target.y) / d0);

  const key = new THREE.DirectionalLight(0xe8eeff, 1.4); key.position.set(-2.5, 9, 4.5); scene.add(key);
  const fillV = new THREE.PointLight(0xb9b0f0, 6, 22, 2); fillV.position.set(7, 4, -4); scene.add(fillV);
  const fillB = new THREE.PointLight(0x60a5fa, 5, 22, 2); fillB.position.set(-6, 2.5, 4); scene.add(fillB);
  scene.add(new THREE.HemisphereLight(0x2a3858, 0x04060b, 0.55));

  /* ---------- підлога ---------- */
  let floor = null;
  if (!lo) {
    floor = mirrorFloor(80, [0.34, 0.37, 0.46], 1.0, 14, [cPos.x, cPos.z]);
    floor.onBeforeRender = () => {};   // віддзеркалення оновлюємо вручну до основного кадру (див. render)
    scene.add(floor);
  } else {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.6, metalness: 0.3, envMapIntensity: 0.5 }));
    m.rotation.x = -Math.PI / 2; scene.add(m);
  }
  const disc = sprite(0x3b82f6, R * (band ? 2.8 : 4.6), 0); disc.position.set(cPos.x, 0.02, cPos.z); scene.add(disc);

  /* ---------- стіни з формулами ---------- */
  const wallMats = [];
  function wallMaterial(opacity, tint) {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: blankTexture() }, uTint: { value: new THREE.Color(tint) }, uOpacity: { value: opacity },
        uOrigin: { value: cPos.clone() }, uRadius: { value: 0 }, uSoft: { value: 2.6 },
        uSpot: { value: new THREE.Vector3(0, -50, 0) }, uSpotR: { value: 3.2 }, uSpotK: { value: fine && !lo ? 0.7 : 0 }, uTime: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; varying vec3 vW;
        void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uTint; uniform float uOpacity; uniform vec3 uOrigin; uniform float uRadius; uniform float uSoft;
        uniform vec3 uSpot; uniform float uSpotR; uniform float uSpotK; uniform float uTime; varying vec2 vUv; varying vec3 vW;
        void main(){
          vec4 t = texture2D(uMap, vUv);
          float d = distance(vW, uOrigin);
          float m = 1.0 - smoothstep(uRadius - uSoft, uRadius + uSoft * 0.25, d);
          float fall = 1.0 / (1.0 + d * d * 0.012);
          float spot = 1.0 + uSpotK * (1.0 - smoothstep(0.0, uSpotR, distance(vW, uSpot)));
          float breathe = 0.92 + 0.08 * sin(uTime * 0.45 + vW.z * 0.7 + vW.y * 0.9);
          vec3 c = uTint * t.rgb * t.a * uOpacity * m * (0.35 + 0.65 * fall) * spot * breathe;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    wallMats.push(m); return m;
  }
  const leftMat = wallMaterial(band ? 0.8 : 0.45, 0xa9c4ff), rightMat = wallMaterial(1.0, 0xbcd3ff), backMat = wallMaterial(0.0, 0xa9c4ff);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(W, H), leftMat); left.position.set(-WX, H / 2, (WZ0 + WZ1) / 2); left.rotation.y = Math.PI / 2; scene.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(W, H), rightMat); right.position.set(WX, H / 2, (WZ0 + WZ1) / 2); right.rotation.y = -Math.PI / 2; scene.add(right);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2 * WX, H), backMat); back.position.set(0, H / 2, WZ0); scene.add(back);
  const darkWall = new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.9, metalness: 0 });
  for (const x of [-WX - 0.02, WX + 0.02]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), darkWall); m.position.set(x, H / 2, (WZ0 + WZ1) / 2); m.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(m); }
  const backDark = new THREE.Mesh(new THREE.PlaneGeometry(2 * WX, H), darkWall); backDark.position.set(0, H / 2, WZ0 - 0.02); scene.add(backDark);

  /* текст формул малюємо, щойно є шрифт Inter (не довше ~1,2 с чекання) */
  const texSize = lo ? [2048, 512] : [4096, 1024];
  const fontsReady = Promise.race([Promise.all([document.fonts.load('400 40px Inter'), document.fonts.load('600 40px Inter')]).catch(() => null), new Promise((r) => setTimeout(r, 1200))]);
  fontsReady.then(() => {
    leftMat.uniforms.uMap.value = formulaTexture(texSize[0], texSize[1], 26, 7, 11);
    rightMat.uniforms.uMap.value = formulaTexture(texSize[0], texSize[1], 26, 7, 23);
    backMat.uniforms.uMap.value = formulaTexture(texSize[0] / 2, texSize[1], 26, 3, 5);
    schedule();
  });

  /* промені від кристала до стін */
  const rnd = seeded(9);
  const beamPts = [];
  for (let i = 0; i < (lo ? 16 : 26); i++) {
    const side = i % 2 ? WX : -WX;
    beamPts.push(cPos.x, cPos.y, cPos.z, side, 0.8 + rnd() * (H - 1.4), WZ0 + 4 + rnd() * (W - 6));
  }
  const beamMat = new THREE.LineBasicMaterial({ color: 0x6f9cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beams = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(beamPts, 3)), beamMat); scene.add(beams);

  /* зерна світла, що повільно летять від кристала до стін */
  const N = lo ? 900 : 2000;
  const gDir = [], gMax = [], gPhase = [], gSpeed = [], gPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const dir = new THREE.Vector3(side * (0.35 + rnd() * 0.65), (rnd() - 0.35) * 0.8, (rnd() - 0.6) * 1.6).normalize();
    const dist = (WX - side * cPos.x - 0.3) / Math.abs(dir.x);   // до бічної стіни
    gDir.push(dir.x, dir.y, dir.z); gMax.push(Math.min(dist, 26)); gPhase.push(rnd()); gSpeed.push(0.035 + rnd() * 0.055);
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('aDir', new THREE.Float32BufferAttribute(gDir, 3));
  gGeo.setAttribute('aMax', new THREE.Float32BufferAttribute(gMax, 1));
  gGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(gPhase, 1));
  gGeo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(gSpeed, 1));
  gGeo.boundingSphere = new THREE.Sphere(cPos.clone(), 30);
  const grainMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOrigin: { value: cPos.clone() }, uSpread: { value: 0 }, uSize: { value: lo ? 4.5 : 9 }, uPR: { value: renderer.getPixelRatio() }, uColorA: { value: new THREE.Color(0x60a5fa) }, uColorB: { value: new THREE.Color(0xa78bfa) } },
    vertexShader: `attribute vec3 aDir; attribute float aMax; attribute float aPhase; attribute float aSpeed;
      uniform float uTime; uniform vec3 uOrigin; uniform float uSpread; uniform float uSize; uniform float uPR; varying float vA; varying float vK;
      void main(){ float u = fract(aPhase + uTime * aSpeed); vec3 p = uOrigin + aDir * (u * aMax * uSpread);
        vA = (1.0 - u * u) * smoothstep(0.0, 0.08, u) * smoothstep(0.0, 0.05, uSpread); vK = aPhase;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = min(uSize * uPR * (6.0 / -mv.z), 10.0 * uPR); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColorA; uniform vec3 uColorB; varying float vA; varying float vK;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.08, length(c)); vec3 col = mix(uColorA, uColorB, vK);
        gl_FragColor = vec4(col * a * vA * 0.55, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment> }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const grains = new THREE.Points(gGeo, grainMat); scene.add(grains);

  /* ---------- кристал ---------- */
  const cr = buildCrystal(R, lo);
  const outer = new THREE.Group(); outer.position.copy(cPos); outer.rotation.set(0.2, 0, 0.1);
  const spin = new THREE.Group(); outer.add(spin); spin.add(cr.group); scene.add(outer);

  /* ---------- пост-обробка (лише компʼютер): мʼяке сяйво смужок і ядра ---------- */
  let composer = null, bloom = null;
  if (!lo) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.22, 0.5, 1.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* ---------- стан і цикл ---------- */
  let w = 1, h = 1;
  let introMs = -250, last = 0, t = 0, frameNo = 0, lastInput = 0;
  let pTarget = 0, pSmooth = 0, mx = 0, my = 0, tmx = 0, tmy = 0, yaw = 0, tyaw = 0;
  let visible = false, running = false;
  const spot = new THREE.Vector3(0, -50, 0), tspot = new THREE.Vector3(0, -50, 0);
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const planeL = new THREE.Plane(new THREE.Vector3(1, 0, 0), WX), planeR = new THREE.Plane(new THREE.Vector3(-1, 0, 0), WX);
  const track = document.getElementById('vault-track');

  function fit() {
    w = Math.max(1, sceneEl.clientWidth); h = Math.max(1, sceneEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setSize(w, h); bloom.setSize(w * renderer.getPixelRatio() / 2, h * renderer.getPixelRatio() / 2); }
    grainMat.uniforms.uPR.value = renderer.getPixelRatio();
  }
  function progress() {
    if (dbgP != null) return dbgP;
    /* компʼютер: hero липкий на час прокрутки доріжки; телефон: сцена розкривається за ~0,6 екрана скролу */
    const span = !band && track ? Math.max(1, track.offsetHeight - window.innerHeight) : window.innerHeight * 0.6;
    return clamp01(window.scrollY / span);
  }
  const camPos = new THREE.Vector3();
  function apply(f, tt) {
    /* кристал: поява, активація, оберт, підйом */
    const sc = (0.72 + 0.28 * f.appear) * f.scale;
    outer.scale.setScalar(sc);
    outer.position.set(cPos.x, cPos.y + f.rise + Math.sin(tt * 0.6) * 0.02, cPos.z);
    spin.rotation.y = 0.45 + f.spin + tt * 0.05 + mx * 0.1;
    cr.coreMat.color.setRGB(1.2, 1.7, 2.6).multiplyScalar(0.03 + 0.97 * f.core);
    cr.core.scale.setScalar(1 + 0.06 * Math.sin(tt * 1.3));
    cr.coreLight.intensity = 2.6 * f.core;
    cr.stripMat.color.copy(LIGHT).multiplyScalar(0.12 + 1.25 * f.strips);
    cr.metalOuter.opacity = cr.metalInner.opacity = 0.15 + 0.85 * f.appear;
    if (cr.glass) cr.glass.opacity = f.appear;
    /* зала: проєкція, промені, зерна, світло на підлозі */
    for (const m of wallMats) { m.uniforms.uRadius.value = f.coverage * maxDist; m.uniforms.uTime.value = tt; m.uniforms.uSpot.value.copy(spot); }
    backMat.uniforms.uOpacity.value = 0.55 * f.back;
    beamMat.opacity = 0.18 * f.beams; beams.visible = f.beams > 0.001;
    grainMat.uniforms.uTime.value = tt; grainMat.uniforms.uSpread.value = f.grains; grains.visible = f.grains > 0.001;
    disc.material.opacity = 0.18 * f.glow;
    /* камера: обліт, підʼїзд, паралакс від миші або поворот від пальця */
    const az = az0 + f.orbit + mx * 0.12 + yaw, el = el0 + f.elev + my * 0.05, dist = d0 * (1 - f.dolly);
    camPos.set(target.x + dist * Math.cos(el) * Math.sin(az), target.y + f.rise * 0.6 + dist * Math.sin(el), target.z + dist * Math.cos(el) * Math.cos(az));
    camera.position.copy(camPos); camera.lookAt(target.x, target.y + f.rise * 0.6, target.z);
  }
  function render(f) {
    apply(f, t);
    if (floor) { floor.updateMatrixWorld(); camera.updateMatrixWorld(); Reflector.prototype.onBeforeRender.call(floor, renderer, scene, camera); }
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  fit();
  if (reduced) {
    const f = () => getFrame(dbgP != null ? dbgP : 0.6, 1);
    render(f());
    fontsReady.then(() => render(f()));
    new ResizeObserver(() => { fit(); render(f()); }).observe(sceneEl);
    return;
  }

  function tick(now) {
    running = false;
    const dt = Math.min(last ? now - last : 16, 50); last = now;      // покадрово, крок ≤ 50 мс (iOS присипляє цикл)
    t += dt / 1000; frameNo++;
    if (dbgIntro == null) introMs += dt;
    const introT = dbgIntro != null ? dbgIntro : clamp01(introMs / CFG.introMs);
    pTarget = progress();
    pSmooth += (pTarget - pSmooth) * 0.12;
    mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08; yaw += (tyaw - yaw) * 0.1;
    spot.lerp(tspot, 0.12);
    if (still) { pSmooth = pTarget; render(getFrame(pSmooth, introT)); return; }
    const idle = now - lastInput > 1500 && introT >= 1;
    if (!((lo || idle) && frameNo % 2)) render(getFrame(pSmooth, introT));   // 30 к/с у спокої і на телефоні, 60 під час руху
    if (visible && !document.hidden) schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(tick); } }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { last = 0; schedule(); } }, { threshold: 0.02 }).observe(sceneEl);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { last = 0; schedule(); } });
  new ResizeObserver(() => { fit(); schedule(); }).observe(sceneEl);
  window.addEventListener('scroll', () => { lastInput = performance.now(); schedule(); }, { passive: true });
  const hero = sceneEl.closest('section') || sceneEl;
  if (fine) {
    hero.addEventListener('pointermove', (ev) => {
      const r = hero.getBoundingClientRect();
      tmx = clamp01((ev.clientX - r.left) / r.width) * 2 - 1;
      tmy = clamp01((ev.clientY - r.top) / r.height) * 2 - 1;
      /* точка на стіні під курсором — рядки поруч яскравішають */
      const cr2 = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - cr2.left) / cr2.width) * 2 - 1, -((ev.clientY - cr2.top) / cr2.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(ndc.x < -0.15 ? planeL : planeR, tspot);
      if (!hit) tspot.set(0, -50, 0);
      lastInput = performance.now(); schedule();
    });
    hero.addEventListener('pointerleave', () => { tmx = 0; tmy = 0; tspot.set(0, -50, 0); schedule(); });
  } else {
    let dragX = null;
    canvas.addEventListener('pointerdown', (ev) => { dragX = ev.clientX; });
    canvas.addEventListener('pointermove', (ev) => { if (dragX == null) return; tyaw = Math.max(-0.3, Math.min(0.3, tyaw + (ev.clientX - dragX) / Math.max(1, w) * 0.5)); dragX = ev.clientX; lastInput = performance.now(); schedule(); });
    const end = () => { dragX = null; tyaw = 0; schedule(); };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  }
  schedule();

  /* ---------- помічники ---------- */
  function studioEnv(r, top) {
    const pm = new THREE.PMREMGenerator(r), s = new THREE.Scene(); s.background = new THREE.Color(0x000000);
    const panel = (pw, ph, col, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), side: THREE.DoubleSide })); m.position.set(...pos); m.rotation.set(...rot); s.add(m); };
    panel(14, 6, [2.0 * top, 2.2 * top, 2.7 * top], [0, 8, 0], [Math.PI / 2, 0, 0]);   // верхній софтбокс
    panel(10, 10, [0.45, 0.85, 2.3], [-10, 3, 0], [0, Math.PI / 2, 0]);              // синій зліва
    panel(10, 10, [1.25, 0.75, 2.3], [10, 3, 0], [0, -Math.PI / 2, 0]);              // фіолетовий справа
    panel(6, 4, [1.15, 0.75, 0.3], [-6, 1, -9], [0, Math.PI * 0.2, 0]);              // ледь тепла плашка
    panel(14, 8, [0.3, 0.35, 0.5], [0, 3, 12], [0, Math.PI, 0]);
    panel(24, 24, [0.04, 0.05, 0.09], [0, -3, 0], [-Math.PI / 2, 0, 0]);
    const tex = pm.fromScene(s, 0.04).texture; pm.dispose(); return tex;
  }
  function mirrorFloor(size, tint, near, far, center) {
    const shader = {
      name: 'MirrorFade',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTint: { value: new THREE.Vector3(...tint) }, uNear: { value: near }, uFar: { value: far }, uCenter: { value: new THREE.Vector2(...center) } },
      vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
        void main(){ vUv = textureMatrix * vec4(position,1.0); vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uTint; uniform float uNear; uniform float uFar; uniform vec2 uCenter; varying vec4 vUv; varying vec3 vW;
        void main(){ vec4 base = texture2DProj(tDiffuse, vUv); float d = length(vW.xz - uCenter); float f = 1.0 - smoothstep(uNear, uFar, d);
          gl_FragColor = vec4(base.rgb * uTint * f, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment> }`,
    };
    const m = new Reflector(new THREE.PlaneGeometry(size, size), { clipBias: 0.002, textureWidth: 512, textureHeight: 512, shader });
    m.rotation.x = -Math.PI / 2; return m;
  }
  /* кубооктаедр: зовнішня рама з 24 брусів, менша копія (0,52) і 12 спиць; смужки світла на внутрішніх лініях; тонке скло між брусами */
  function buildCrystal(R, lo) {
    const geo = cuboctahedron(R), group = new THREE.Group();
    const VO = geo.V, VI = geo.V.map((v) => v.clone().multiplyScalar(0.52));
    const thO = R * 0.05, thI = R * 0.03, thS = R * 0.026;
    const metalOuter = new THREE.MeshStandardMaterial({ color: 0x9fa6ae, metalness: 0.86, roughness: 0.48, envMapIntensity: 0.9, transparent: true, opacity: 1 });
    const metalInner = new THREE.MeshStandardMaterial({ color: 0x858c95, metalness: 0.86, roughness: 0.52, envMapIntensity: 0.8, transparent: true, opacity: 1 });
    let glass = null;
    if (!lo) {
      glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transmission: 1, thickness: R * 0.12, ior: 1.45, clearcoat: 0.5, clearcoatRoughness: 0.1, specularIntensity: 0.6, envMapIntensity: 0.5, transparent: true, opacity: 1, side: THREE.FrontSide });
      const shell = new THREE.Mesh(shellGeometry(geo, 0.985), glass); shell.renderOrder = 20; group.add(shell);
    }
    group.add(new THREE.Mesh(tubes(geo.E.map(([a, b]) => [VO[a], VO[b], thO]), lo ? 8 : 12), metalOuter));
    group.add(new THREE.Mesh(mergeGeometries(VO.map((p) => new THREE.SphereGeometry(thO * 0.8, 12, 8).translate(p.x, p.y, p.z)), false), metalOuter));
    const innerSegs = geo.E.map(([a, b]) => [VI[a], VI[b], thI]);
    for (let i = 0; i < 12; i++) innerSegs.push([VO[i], VI[i], thS]);
    group.add(new THREE.Mesh(tubes(innerSegs, lo ? 6 : 10), metalInner));
    /* смужка світла — тонка трубка, зсунута з осі бруса назовні, щоб її було видно */
    const strips = innerSegs.map(([a, b, th]) => {
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      let perp = mid.clone().normalize(); perp.sub(dir.clone().multiplyScalar(perp.dot(dir)));
      if (perp.length() < 0.1) perp = new THREE.Vector3().crossVectors(dir, _up); if (perp.length() < 0.1) perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0));
      perp.normalize().multiplyScalar(th * (lo ? 0.72 : 0.62));
      return [a.clone().add(perp), b.clone().add(perp), th * (lo ? 0.55 : 0.42)];
    });
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    group.add(new THREE.Mesh(tubes(strips, 6), stripMat));
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(R * 0.08, 0), coreMat); group.add(core);
    const coreLight = new THREE.PointLight(0x9db8ff, 0, R * 6, 2); group.add(coreLight);
    return { group, coreMat, core, coreLight, stripMat, metalOuter, metalInner, glass };
  }
  function cuboctahedron(R) {
    const s = R / Math.SQRT2, V = [];
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) for (const a of [-1, 1]) for (const b of [-1, 1]) { const v = [0, 0, 0]; v[i] = a * s; v[j] = b * s; V.push(new THREE.Vector3(...v)); }
    const E = [];
    for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) if (Math.abs(V[a].distanceTo(V[b]) - R) < 1e-6) E.push([a, b]);
    const faces = [];
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) faces.push(orderPolygon(V.map((v, i) => i).filter((i) => Math.abs(V[i].getComponent(axis) - sign * s) < 1e-6), V));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) faces.push(orderPolygon(V.map((v, i) => i).filter((i) => { const v = V[i]; return (v.x === 0 || Math.sign(v.x) === sx) && (v.y === 0 || Math.sign(v.y) === sy) && (v.z === 0 || Math.sign(v.z) === sz); }), V));
    return { V, E, faces };
  }
  function orderPolygon(idx, V) {
    const c = new THREE.Vector3(); idx.forEach((i) => c.add(V[i])); c.multiplyScalar(1 / idx.length);
    const n = c.clone().normalize(), u = new THREE.Vector3().subVectors(V[idx[0]], c).normalize(), wv = new THREE.Vector3().crossVectors(n, u);
    return idx.slice().sort((a, b) => { const pa = new THREE.Vector3().subVectors(V[a], c), pb = new THREE.Vector3().subVectors(V[b], c); return Math.atan2(pa.dot(wv), pa.dot(u)) - Math.atan2(pb.dot(wv), pb.dot(u)); });
  }
  function shellGeometry(geo, k) {
    const arr = [];
    for (const f of geo.faces) for (let i = 1; i < f.length - 1; i++) for (const j of [f[0], f[i], f[i + 1]]) arr.push(geo.V[j].x * k, geo.V[j].y * k, geo.V[j].z * k);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g;
  }
  function tubes(segs, radial) {
    const parts = [];
    for (const [a, b, r] of segs) {
      _d.subVectors(b, a); const len = _d.length(); if (len < 1e-6) continue;
      const g = new THREE.CylinderGeometry(r, r, len, radial, 1, false);
      _q.setFromUnitVectors(_up, _d.normalize());
      _m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(_m); parts.push(g);
    }
    return mergeGeometries(parts, false);
  }
  function blankTexture() { const c = document.createElement('canvas'); c.width = c.height = 4; return new THREE.CanvasTexture(c); }
  function formulaTexture(w, h, rows, cols, seed) {
    const CORPUS = [
      'R(t) = Σ оплата(t) − повернення(t)', 'оплата → розрахунок → звіт → пошта', 'score(лід) ∈ [1, 10]',
      'виписка PDF · XLSX · CSV → транзакції', 'дублікат ⇔ (сума, дата, контрагент)', 'переказ між рахунками: −x + x = 0',
      '100 дзвінків × 5 хв ≈ $3,5 / міс', 'натальна карта → PDF → пошта', 'кожні 12 год: 4 спільноти → чернетки',
      'стиль = 11 вимірів', 'виручка(бюджет, конверсія_k)', '∂ виручка / ∂ конверсія_k', 'webhook: підпис ✓ · повтор ✗',
      'контекст діалогу → ескалація', 'календар → зображення → Instagram → статус', 'похибка округлення = 0',
      '03:00 щодня · Cloud Scheduler', '120 оплат · Monobank Acquiring', 'транскрипція → резюме → CRM', 'p(результат | система) → 1',
      '∫ дохід dt − витрати', 'λ = запити / хв', 'σ(настрій клієнта)', 'Δ(бюджет) → Δ(виручка)', 'PDF ← Puppeteer ← звіт',
    ];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const r = seeded(seed), lh = h / rows, fs = Math.round(lh * 0.55);
    g.textBaseline = 'middle';
    for (let row = 0; row < rows; row++) for (let k = 0; k < cols; k++) {
      const line = CORPUS[Math.floor(r() * CORPUS.length)], strong = r() < 0.18;
      g.font = `${strong ? 600 : 400} ${fs}px Inter, sans-serif`;
      g.globalAlpha = strong ? 1 : 0.5 * (0.5 + r() * 0.5);
      g.fillStyle = '#9dc2ff';
      g.fillText(line, (k / cols) * w + r() * (w / cols) * 0.35, (row + 0.5) * lh);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return tex;
  }
  function glow() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(0.7, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c); return glowTex;
  }
  function sprite(color, size, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1); return s;
  }
  function seeded(seed) { let s = seed * 7919 + 13; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
}
