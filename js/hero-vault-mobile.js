/*
 * Перший екран /ai — «Сховище», ТЕЛЕФОН. Компʼютер має власний модуль і
 * розвивається окремо: тут немає жодної гілки для широкого екрана.
 *
 * ФІГУРА — як на /preview/3d-v6/: при відкритті виринають усі вузли, між
 * ними малюється ґратка, каркас замикається, займається світло. Зі скролом
 * ґратка провертається, фігура докручується й трохи меншає. Каркас не
 * розсувається.
 *
 * ОПИС — ТАБЛО. Абзац «Мене звати…» складається з літер точно на місці абзацу
 * в розмітці (сам <p> лишається прозорим носієм змісту). Кожну літеру
 * відпускає скрол, і вона кілька разів перекидає пластинку, поки не
 * зупиниться на своєму знаку; хвиля йде в порядку читання.
 *
 * ЩОБ ШВИДКИЙ СКРОЛ НЕ ПРОСКОЧИВ ОПИС: коли опис цілком на екрані, hero
 * «прилипає» і стоїть, поки скрол проходить ділянку табло. Якщо людина
 * пролетіла її одним змахом, сторінка зупиняється на кінці ділянки й
 * тримає, доки табло не складеться (найдовше ~2 с), — далі гортається як
 * звичайно. Це відбувається лише при першому проходженні.
 *
 * Для знімків: ?p=0.5 — наскрізний прогрес, ?intro=1, ?still=1, ?age=3,
 * ?stage=1 — прокрутити сторінку туди, де hero прилип і опис на екрані.
 */
import * as THREE from 'three';
import { figureFrame, getFrame as sceneFrame, letterOrder, queueLaunch, clamp01, CFG } from './hero-vault-mobile-frame.js';

const sceneEl = document.getElementById('vault-scene');
const canvas = document.getElementById('vault-canvas');
if (sceneEl && canvas) init();

function init() {
  const q = new URLSearchParams(location.search);
  const dbgP = q.has('p') ? clamp01(parseFloat(q.get('p'))) : null;
  const dbgIntro = q.has('intro') ? clamp01(parseFloat(q.get('intro'))) : null;
  const still = q.has('still');
  const AGE = q.has('age') ? parseFloat(q.get('age')) : 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { sceneEl.classList.add('vault-nogl'); document.documentElement.classList.remove('vault-holo'); return; }
  document.documentElement.classList.add('vault-live');       // сцена запустилась — запасний таймер у <head> більше не потрібен
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0b0f19, 0);

  /* усе спільне — до першого використання */
  const R = 0.61;
  const cPos = new THREE.Vector3(0, R + 0.3, 0);
  const cam0 = new THREE.Vector3(0, cPos.y, 7.0);
  const target = new THREE.Vector3(0, cPos.y - 0.72, 0);     // дивимось нижче фігури — вона стає під заголовком, знизу місце під текст
  /* зі скролом фігура трохи меншає, звільняючи місце опису. Не підіймається: коли hero прилипає, заголовок уже
     поза екраном, і піднята фігура ховалась би під шапкою сайту */
  const SHRINK = 0.34;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0), mtx = new THREE.Matrix4();
  const LIGHT = new THREE.Color(0x47a0ff);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 80);
  camera.position.copy(cam0); camera.lookAt(target);          // камера нерухома: текст прибитий до місця абзацу

  const key = new THREE.DirectionalLight(0xe8eeff, 1.5);
  key.position.set(cPos.x - 2.2, 9, cPos.z + 4.5); key.target.position.set(cPos.x, 0, cPos.z); scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 6; key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30; key.shadow.bias = -0.0006; key.shadow.radius = 9;
  scene.add(key);
  const fillA = new THREE.PointLight(0xb9b0f0, 2.4, 16, 2); fillA.position.set(cPos.x + 5, 3.5, cPos.z - 3); scene.add(fillA);
  const fillB = new THREE.PointLight(0x60a5fa, 3, 16, 2); fillB.position.set(cPos.x - 5, 2.5, cPos.z + 4); scene.add(fillB);
  scene.add(new THREE.HemisphereLight(0x3a4a70, 0x05070d, 0.65));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cPos.x, 0, cPos.z); floor.receiveShadow = true; scene.add(floor);

  /* ---------- фігура: побудова як на /preview/3d-v6/ (на телефоні без сяйва довкола ліній) ---------- */
  const outer = new THREE.Group(); outer.rotation.set(0.22, 0, 0.12); outer.position.copy(cPos);
  const spin = new THREE.Group(); outer.add(spin); scene.add(outer);
  const innerGrp = new THREE.Group(); spin.add(innerGrp);
  const brushed = brushedTexture();
  const metalOuter = new THREE.MeshStandardMaterial({ color: 0x9fa6ae, metalness: 0.86, roughness: 0.5, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.006, envMapIntensity: 0.95 });
  const metalInner = new THREE.MeshStandardMaterial({ color: 0x848b94, metalness: 0.86, roughness: 0.54, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.004, envMapIntensity: 0.85 });
  const C = cubocta();
  const VO = C.V.map((v) => v.clone().multiplyScalar(R));
  const VI = C.V.map((v) => v.clone().multiplyScalar(R * 0.52));
  const thO = R * 0.062, thI = R * 0.036, thS = R * 0.03;
  const joints = [];
  VO.forEach((v) => joints.push({ m: joint(v, thO * 0.74, metalOuter, spin), v }));
  VI.forEach((v) => joints.push({ m: joint(v, thI * 0.8, metalInner, innerGrp), v }));
  joints.sort((a, b) => a.v.y - b.v.y);
  const outerBeams = C.E.map((e) => ({ m: beam(VO[e[0]], VO[e[1]], thO, metalOuter, 0, spin), i: e[0], j: e[1], y: Math.min(VO[e[0]].y, VO[e[1]].y) }));
  outerBeams.sort((a, b) => a.y - b.y);
  const innerSegs = C.E.map((e) => ({ a: VI[e[0]], b: VI[e[1]], parent: innerGrp, th: thI, off: thI * 0.52, spoke: -1 }));
  for (let i = 0; i < 12; i++) innerSegs.push({ a: VO[i], b: VI[i], parent: spin, th: thS, off: thS * 0.52, spoke: i });
  const innerLines = innerSegs.map((s) => {
    const bar = beam(s.a, s.b, s.th, metalInner, 0, s.parent);
    const lightMat = new THREE.MeshBasicMaterial({ color: LIGHT });
    const strip = beam(s.a, s.b, s.th * 0.34, lightMat, s.off, s.parent); strip.castShadow = false;
    const mid = tmpA.addVectors(s.a, s.b).multiplyScalar(0.5);
    return { bar, strip, lightMat, k: mid.y * 2.0 + mid.x * 0.7 + mid.z * 0.4, y: Math.min(s.a.y, s.b.y), spoke: s.spoke, a: s.a, b: s.b };
  });
  innerLines.sort((a, b) => a.y - b.y);
  const COUNTS = { joints: joints.length, inner: innerLines.length, outer: outerBeams.length };

  /* ---------- вогники: сиплються з фігури в опис ---------- */
  const rnd = seeded(31), rnd2 = seeded(77);
  const N = 1100;
  const gTo = new Float32Array(N * 3), gPhase = [], gSpeed = [], gPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { gPhase.push(rnd()); gSpeed.push(0.035 + rnd() * 0.055); }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('aTo', new THREE.BufferAttribute(gTo, 3));
  gGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(gPhase, 1));
  gGeo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(gSpeed, 1));
  gGeo.boundingSphere = new THREE.Sphere(cPos.clone(), 30);
  const grainMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOrigin: { value: cPos.clone() }, uStart: { value: R * 0.12 }, uSpread: { value: 0 }, uSize: { value: 5 }, uPR: { value: renderer.getPixelRatio() }, uColorA: { value: new THREE.Color(0x60a5fa) }, uColorB: { value: new THREE.Color(0xa78bfa) },
      uWave: { value: new THREE.Vector3() }, uReach: { value: 0 }, uSoft: { value: 0.5 } },
    vertexShader: `attribute vec3 aTo; attribute float aPhase; attribute float aSpeed;
      uniform float uTime; uniform vec3 uOrigin; uniform vec3 uWave; uniform float uReach; uniform float uSoft;
      uniform float uStart; uniform float uSpread; uniform float uSize; uniform float uPR; varying float vA; varying float vK;
      void main(){ float u = fract(aPhase + uTime * aSpeed);
        vec3 d = aTo - uOrigin; float maxD = length(d); vec3 p = uOrigin + d / max(maxD, 0.001) * mix(uStart, maxD, u);
        float lit = 1.0 - smoothstep(uReach + uSoft * 0.6, uReach + uSoft * 2.4, distance(aTo, uWave));
        vA = smoothstep(0.0, 0.16, u) * (1.0 - smoothstep(0.55, 0.88, u)) * lit * smoothstep(0.0, 0.12, uSpread); vK = aPhase;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = min(uSize * uPR * (6.0 / -mv.z), 9.0 * uPR); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColorA; uniform vec3 uColorB; varying float vA; varying float vK;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.08, length(c)); vec3 col = mix(uColorA, uColorB, vK);
        gl_FragColor = vec4(col * a * vA * 0.85, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const grains = new THREE.Points(gGeo, grainMat); grains.visible = false; scene.add(grains);

  /* далекий пил і туманності — глибина кадру */
  const DUST = 420;
  const dPos = new Float32Array(DUST * 3), dSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const a = rnd() * Math.PI * 2, rr = 2.2 + rnd() * 7.5, yy = (rnd() - 0.5) * 7;
    dPos[i * 3] = cPos.x + Math.cos(a) * rr; dPos[i * 3 + 1] = cPos.y + yy; dPos[i * 3 + 2] = cPos.z + Math.sin(a) * rr * 0.7 - 1.5;
    dSeed[i] = rnd();
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(dSeed, 1));
  dGeo.boundingSphere = new THREE.Sphere(cPos.clone(), 40);
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uTint: { value: new THREE.Color(0x7d9ad6) } },
    vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPR; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime * 0.07 + aSeed * 31.0), cos(uTime * 0.05 + aSeed * 17.0), 0.0) * 0.35;
        vA = 0.18 + 0.42 * fract(aSeed * 13.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = max(1.0, uPR * (1.1 + fract(aSeed * 7.0) * 1.4) * (7.0 / -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uTint; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA;
        gl_FragColor = vec4(uTint * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const dust = new THREE.Points(dGeo, dustMat); dust.renderOrder = -3; scene.add(dust);
  const NEB = 7;
  const nPos = new Float32Array(NEB * 3), nSeed = new Float32Array(NEB), nSize = new Float32Array(NEB);
  for (let i = 0; i < NEB; i++) {
    const a = rnd() * Math.PI * 2, rr = 3 + rnd() * 9;
    nPos[i * 3] = cPos.x + Math.cos(a) * rr; nPos[i * 3 + 1] = cPos.y + (rnd() - 0.5) * 8; nPos[i * 3 + 2] = cPos.z - 4 - rnd() * 9;
    nSeed[i] = rnd(); nSize[i] = 5 + rnd() * 9;
  }
  const nGeo = new THREE.BufferGeometry();
  nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  nGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(nSeed, 1));
  nGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(nSize, 1));
  nGeo.boundingSphere = new THREE.Sphere(cPos.clone(), 60);
  const nebMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uA: { value: new THREE.Color(0x2b3f78) }, uB: { value: new THREE.Color(0x3a2c6b) } },
    vertexShader: `attribute float aSeed; attribute float aSize; uniform float uTime; uniform float uPR; varying float vK;
      void main(){
        vec3 p = position + vec3(sin(uTime * 0.03 + aSeed * 21.0), cos(uTime * 0.024 + aSeed * 13.0), 0.0) * 0.9;
        vK = aSeed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPR * aSize * (60.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uA; uniform vec3 uB; uniform float uTime; varying float vK;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a *= a * (0.05 + 0.035 * sin(uTime * 0.25 + vK * 9.0));
        gl_FragColor = vec4(mix(uA, uB, vK) * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const nebula = new THREE.Points(nGeo, nebMat); nebula.renderOrder = -4; scene.add(nebula);

  /* темна підкладка під описом: адитивним матеріалом не затемнити, тож окрема площина зі звичайним змішуванням */
  const shadeMat = new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uOp; varying vec2 vUv;
      void main(){
        float s = smoothstep(0.0, 0.26, vUv.x) * smoothstep(1.0, 0.74, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        gl_FragColor = vec4(0.0, 0.0, 0.0, s * uOp);
      }`,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadeMat);
  shade.renderOrder = -2; shade.visible = false; scene.add(shade);

  /* ---------- стан ---------- */
  let introMs = -300, last = 0, t = 0, angle = 0.4, frameNo = 0;
  let preT = 0, pinT = 0, preS = 0, pinS = 0;
  let visible = false, running = false;
  const track = document.getElementById('vault-track');
  const hero = sceneEl.closest('section');
  const lede = document.getElementById('vault-lede');

  /* ---------- опис ---------- */
  /* «зменшити рух» — один нерухомий кадр: опис лишається звичайним текстом, без табло і без утримання скролу */
  let ledeTokens = null;
  if (lede && !reduced) {
    ledeTokens = [];
    (function walk(node, bold) {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) for (const wd of n.nodeValue.split(/\s+/)) { if (wd) ledeTokens.push({ w: wd, bold }); }
        else if (n.nodeType === 1) walk(n, bold || n.tagName === 'STRONG');
      }
    })(lede, false);
    lede.classList.add('vault-lede-holo');
  }
  const LCELL = 64, LFS = 42;
  const fontsReady = Promise.race([Promise.all([document.fonts.load('400 40px Inter'), document.fonts.load('700 40px Inter')]).catch(() => null), new Promise((r) => setTimeout(r, 1200))]);
  function letterAtlas() {
    const set = [];
    for (const tk of ledeTokens) for (const ch of tk.w) { const k = ch + (tk.bold ? '1' : '0'); if (!set.includes(k)) set.push(k); }
    const cols = 16, rows = Math.ceil(set.length / cols);
    const c = document.createElement('canvas'); c.width = cols * LCELL; c.height = rows * LCELL;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const adv = {}, index = {};
    set.forEach((k, i) => {
      const ch = k.slice(0, -1), bold = k.endsWith('1');
      g.font = `${bold ? 700 : 400} ${LFS}px Inter, sans-serif`;
      g.fillText(ch, (i % cols + 0.5) * LCELL, (Math.floor(i / cols) + 0.5) * LCELL);
      adv[k] = g.measureText(ch).width / LFS;
      index[k] = i;
    });
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return { tex, cols, rows, count: set.length, adv, index, space: adv[' 0'] || 0.26 };
  }
  function ledeLayout(atlas, fsCss, boxW, lhCss) {
    const out = [], lh = lhCss || fsCss * 1.42;
    let x = 0, y = fsCss * 0.95;
    const widthOf = (word, bold) => { let ww = 0; for (const ch of word) ww += (atlas.adv[ch + (bold ? '1' : '0')] || 0.3) * fsCss; return ww; };
    const sp = atlas.space * fsCss;
    for (const tk of ledeTokens) {
      const tw = widthOf(tk.w, tk.bold);
      if (/^[,.;:!?»)\]]/.test(tk.w)) x -= sp;
      if (x > 0 && x + tw > boxW) { x = 0; y += lh; }
      for (const ch of tk.w) {
        const k = ch + (tk.bold ? '1' : '0'), a = (atlas.adv[k] || 0.3) * fsCss;
        out.push({ k, cx: x + a / 2, cy: y - fsCss * 0.32, adv: a / fsCss });
        x += a;
      }
      x += tw > 0 ? sp : 0;
    }
    return { letters: out };
  }

  /* Рама опису: прямокутник абзацу перед камерою, обличчям до неї (вертикальна площина дала б трапецію).
     Камера нерухома, тож раму ставимо раз — при кожній зміні розміру. */
  const ledeFrame = new THREE.Object3D(); scene.add(ledeFrame);
  const ndcToWorld = new THREE.Vector3(), wave = new THREE.Vector3(), corner = new THREE.Vector3();
  let far = 1;
  /* «ще не відпущена» — окрема мітка: час старту буває відʼємним (після перезавантаження табло ставимо вже складеним) */
  const UNSET = -1e6;
  let flaps = null, flapMat = null, letterAtl = null, order = null, launch = null, lastStart = -1e9, released = 0;
  function fitLede() {
    if (!ledeTokens) return;
    const r = lede.getBoundingClientRect(), b = sceneEl.getBoundingClientRect();
    if (!r.width || !b.width) return;
    const cx = ((r.left + r.width / 2 - b.left) / b.width) * 2 - 1, cy = -(((r.top + r.height / 2 - b.top) / b.height) * 2 - 1);
    ndcToWorld.set(cx, cy, 0.5).unproject(camera).sub(camera.position).normalize();
    const D = 6.2, TILT = 0.13;
    ledeFrame.position.copy(camera.position).addScaledVector(ndcToWorld, D);
    ledeFrame.quaternion.copy(camera.quaternion); ledeFrame.rotateX(-TILT);
    ledeFrame.updateMatrixWorld();
    const vh = 2 * D * Math.tan(camera.fov * Math.PI / 360);
    const ww = vh * camera.aspect * (r.width / b.width), hh = vh * (r.height / b.height) / Math.cos(TILT);
    if (ww < 0.05 || hh < 0.05) return;
    shade.geometry.dispose();
    shade.geometry = new THREE.PlaneGeometry(ww * 1.22, hh * 1.3);
    shade.position.copy(ledeFrame.position).addScaledVector(ndcToWorld, -0.12);
    shade.quaternion.copy(ledeFrame.quaternion);
    /* міжрядковий — той самий, що в браузера: табло займає рівно прямокутник абзацу, без порожнечі під ним */
    const cs = getComputedStyle(lede);
    placeLetters(ww, parseFloat(cs.fontSize) || 18, r.width, r.height, parseFloat(cs.lineHeight) || 0);
    /* вогники летять у прямокутник опису, фронт заходить згори — з боку фігури */
    const onPlane = (u, v, out) => ledeFrame.localToWorld(out.set(u * ww / 2, v * hh / 2, 0));
    onPlane(0, 1.12, wave);
    far = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) far = Math.max(far, onPlane(sx, sy, corner).distanceTo(wave));
    grainMat.uniforms.uWave.value.copy(wave);
    const at = gGeo.attributes.aTo;
    for (let i = 0; i < N; i++) { onPlane((rnd2() - 0.5) * 1.92, (rnd2() - 0.5) * 1.92, corner); at.setXYZ(i, corner.x, corner.y, corner.z); }
    at.needsUpdate = true;
  }
  /* ТАБЛО: кожна літера — три шматки: верх нового знака (відкривається позаду), низ старого (його закриває
     пластинка) і сама пластинка на петлі посередині, що падає вниз: поки не пройшла ребром — на ній верх
     старого знака, після — низ нового. Змішування адитивне, тож закрите пластинкою просто не малюємо. */
  function buildFlaps() {
    if (!ledeTokens || flaps) return;
    letterAtl = letterAtlas();
    const fg = new THREE.InstancedBufferGeometry();
    const pos = [], part = [], idx = [];
    const piece = (y0, y1, id) => {
      const b0 = pos.length / 3;
      pos.push(-0.5, y0, 0, 0.5, y0, 0, 0.5, y1, 0, -0.5, y1, 0);
      part.push(id, id, id, id);
      idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    };
    piece(0, 0.5, 0); piece(-0.5, 0, 1); piece(0, 0.5, 2);
    fg.setIndex(idx);
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    const F = CFG.flap;
    flapMat = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: letterAtl.tex }, uGrid: { value: new THREE.Vector2(letterAtl.cols, letterAtl.rows) }, uCount: { value: letterAtl.count },
        uFrame: { value: new THREE.Matrix4() }, uTime: { value: 0 }, uAge: { value: AGE },
        uTint: { value: new THREE.Color(0xcfe0ff) }, uOpacity: { value: 1 },
      },
      vertexShader: `attribute float aPart; attribute vec3 aTo; attribute float aIdx; attribute float aSize; attribute float aSeed; attribute float aLaunch; attribute float aHalf; attribute float aRow;
        uniform mat4 uFrame; uniform vec2 uGrid; uniform float uCount; uniform float uTime; uniform float uAge;
        varying vec2 vLocal; varying float vPart; varying float vCos; varying vec2 vCur; varying vec2 vNext; varying float vCurOn;
        varying float vCard; varying float vHalf; varying float vRow; varying float vShade;
        const float FLIPS = ${F.flips.toFixed(1)}; const float DUR = ${F.dur.toFixed(3)};
        float hash(float n){ return fract(sin(n) * 43758.5453); }
        vec2 cellOf(float gi){ return vec2(mod(gi, uGrid.x), floor(gi / uGrid.x)); }
        float glyphAt(float j){ return j >= FLIPS - 1.0 ? aIdx : floor(hash(aSeed * 91.7 + j * 17.3) * uCount); }
        void main(){
          if (aLaunch < -1e5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }  // скрол ще не відпустив цю літеру
          float s = (uTime + uAge - aLaunch) / DUR;
          if (s <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }        // стоїть у черзі
          float k = min(floor(s), FLIPS - 1.0);
          float f = s >= FLIPS ? 1.0 : fract(s);
          float th = 3.14159265 * f * f;
          float c = cos(th);
          vCos = c; vPart = aPart; vHalf = aHalf; vRow = aRow;
          vCur = cellOf(k < 0.5 ? 0.0 : glyphAt(k - 1.0)); vCurOn = k < 0.5 ? 0.0 : 1.0;
          vNext = cellOf(glyphAt(k));
          vCard = 0.1 * (1.0 - smoothstep(FLIPS, FLIPS + 2.0, s));
          vec3 p = position;
          vLocal = p.xy; vShade = 1.0;
          if (aPart > 1.5) { p = vec3(p.x, p.y * c, p.y * sin(th)); vShade = 0.45 + 0.55 * abs(c); }
          gl_Position = projectionMatrix * viewMatrix * (uFrame * vec4(aTo + p * aSize, 1.0));
        }`,
      fragmentShader: `uniform sampler2D uAtlas; uniform vec2 uGrid; uniform vec3 uTint; uniform float uOpacity; uniform float uTime;
        varying vec2 vLocal; varying float vPart; varying float vCos; varying vec2 vCur; varying vec2 vNext; varying float vCurOn;
        varying float vCard; varying float vHalf; varying float vRow; varying float vShade;
        void main(){
          float y = vLocal.y, up;
          vec2 cell; float on = 1.0;
          if (vPart < 0.5) {
            if (vCos > 0.0 && y < 0.5 * vCos) discard;
            cell = vNext; up = 0.5 + y;
          } else if (vPart < 1.5) {
            if (vCos < 0.0 && y > 0.5 * vCos) discard;
            cell = vCur; on = vCurOn; up = 0.5 + y;
          } else if (vCos >= 0.0) { cell = vCur; on = vCurOn; up = 0.5 + y; }
          else { cell = vNext; up = 0.5 - y; }
          float a = texture2D(uAtlas, (cell + vec2(vLocal.x + 0.5, 1.0 - up)) / uGrid).a * on;
          float card = vCard * step(abs(vLocal.x), vHalf) * step(abs(y), 0.36) * step(0.014, abs(y));
          float scan = 0.93 + 0.07 * sin(gl_FragCoord.y * 1.35);
          float beam = exp(-pow((fract(uTime * 0.11) - vRow) * 7.0, 2.0)) * 0.75;
          vec3 col = uTint * uOpacity * vShade * (a * scan * (1.0 + beam) + card);
          if (max(col.r, max(col.g, col.b)) < 0.002) discard;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
        }`,
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    });
    flaps = new THREE.Mesh(fg, flapMat);
    flaps.frustumCulled = false; flaps.renderOrder = -1;
    scene.add(flaps);
  }
  function placeLetters(ww, fsCss, rw, rh, lhCss) {
    buildFlaps();
    if (!flaps) return;
    const lay = ledeLayout(letterAtl, fsCss, rw, lhCss);
    const n = lay.letters.length, scale = ww / rw, cellW = (LCELL / LFS) * fsCss * scale;
    const to = new Float32Array(n * 3), idxA = new Float32Array(n), sz = new Float32Array(n), sd = new Float32Array(n), half = new Float32Array(n), rowv = new Float32Array(n);
    const prev = launch;
    order = new Float32Array(n); launch = new Float32Array(n).fill(UNSET);
    lay.letters.forEach((L, i) => {
      to[i * 3] = (L.cx - rw / 2) * scale; to[i * 3 + 1] = (rh / 2 - L.cy) * scale; to[i * 3 + 2] = 0.004;
      idxA[i] = letterAtl.index[L.k]; sz[i] = cellW; sd[i] = rnd2();
      half[i] = L.adv * LFS / LCELL * 0.5 - 0.025;
      rowv[i] = L.cy / rh;
      order[i] = letterOrder(i, n, rnd2());
      if (prev && i < prev.length) launch[i] = prev[i];          // перерахунок розміру не скидає вже складене табло
    });
    released = 0; for (let i = 0; i < n; i++) if (launch[i] !== UNSET) released++;
    const g = flaps.geometry;
    g.setAttribute('aTo', new THREE.InstancedBufferAttribute(to, 3));
    g.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idxA, 1));
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(sz, 1));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1));
    g.setAttribute('aLaunch', new THREE.InstancedBufferAttribute(launch, 1));
    g.setAttribute('aHalf', new THREE.InstancedBufferAttribute(half, 1));
    g.setAttribute('aRow', new THREE.InstancedBufferAttribute(rowv, 1));
    g.instanceCount = n;
    flapMat.uniforms.uFrame.value.copy(ledeFrame.matrixWorld);
  }
  const textDone = () => !flaps || (released >= launch.length && t >= lastStart + CFG.flap.flips * CFG.flap.dur);

  /* ---------- прилипання hero на час табло ---------- */
  /* висота «малого» вікна (з усіма панелями браузера): не змінюється, коли Safari ховає адресний рядок */
  const svhProbe = document.createElement('div');
  svhProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(svhProbe);
  let pinStart = 0, pinLen = 1, pinEnd = 1;
  function measurePin() {
    const svh = svhProbe.offsetHeight || window.innerHeight;
    if (!ledeTokens || !track || !hero) { pinLen = svh; return; }
    const heroH = hero.offsetHeight;
    const lr = lede.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    const ledeBottom = lr.bottom - hr.top;
    /* hero липне тоді, коли низ опису вже на екрані з невеликим запасом */
    const top = Math.min(0, Math.round(svh - 28 - ledeBottom));
    hero.style.position = 'sticky';
    hero.style.top = top + 'px';
    pinLen = Math.round(CFG.pinScreens * svh);
    track.style.height = (heroH + pinLen) + 'px';
    const trackTop = track.getBoundingClientRect().top + window.scrollY;
    pinStart = Math.max(0, trackTop - top);
    pinEnd = pinStart + pinLen;
  }
  function scrollParts() {
    if (dbgP != null) return [clamp01(dbgP / 0.3), clamp01((dbgP - 0.3) / 0.7)];
    const y = window.scrollY, svh = svhProbe.offsetHeight || window.innerHeight;
    return [clamp01(y / Math.max(pinStart, svh * 0.3)), clamp01((y - pinStart) / Math.max(1, pinLen))];
  }
  /* Якщо змах проніс сторінку за ділянку табло, а табло ще не складене, — повертаємо до кінця ділянки і
     тримаємо, доки не складеться. Hero весь цей час прилиплий, тож кадр не стрибає. Лише на спуску. */
  let lastY = window.scrollY;
  function holdAtStage() {
    const y = window.scrollY, down = y > lastY;
    lastY = y;
    if (!ledeTokens || dbgP != null || !down || textDone()) return;
    if (y > pinEnd + 2) { jumpTo(pinEnd); lastY = pinEnd; }
  }
  /* на <html> стоїть scroll-smooth: звичайний scrollTo плавно поїхав би назад, а треба зупинити змах на місці */
  function jumpTo(y) {
    const root = document.documentElement, prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    root.style.scrollBehavior = prev;
  }

  function fit() {
    const w = Math.max(1, sceneEl.clientWidth), h = Math.max(1, sceneEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.copy(cam0); camera.lookAt(target); camera.updateMatrixWorld();
    grainMat.uniforms.uPR.value = renderer.getPixelRatio();
    measurePin();
    fitLede();
  }
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
  function apply(fF, fS, tt) {
    joints.forEach((j, i) => j.m.scale.setScalar(Math.max(0.001, fF.joints[i])));
    outerBeams.forEach((b, i) => placeBeam(b.m, VO[b.i], VO[b.j], fF.outer[i]));
    innerGrp.rotation.y = fF.swivel;
    innerLines.forEach((L, i) => {
      const d = fF.inner[i];
      let a = L.a, b = L.b;
      if (L.spoke >= 0) { a = VO[L.spoke]; b = tmpT.copy(VI[L.spoke]).applyAxisAngle(UP, fF.swivel); }
      placeBeam(L.bar, a, b, d); placeBeam(L.strip, a, b, d);
      const wv = 0.5 + 0.5 * Math.sin(L.k - tt * (0.5 + 1.1 * fF.pulseSpeed));
      const br = fF.light * (0.45 + 0.55 * (1 - fF.wave + fF.wave * wv));
      L.lightMat.color.copy(LIGHT).multiplyScalar(0.2 + 1.35 * br);
    });
    spin.rotation.y = angle + fF.spin;
    outer.rotation.x = 0.22;
    outer.position.y = cPos.y + Math.sin(tt * 0.6) * 0.03;
    outer.scale.setScalar(1 - SHRINK * fS.pull);
    grainMat.uniforms.uOrigin.value.copy(outer.position);
    shade.visible = !!flaps && fS.shade > 0.002; shadeMat.uniforms.uOp.value = fS.shade * 0.62;
    if (flaps) {
      /* скрол відпускає літери в порядку читання; ті, що відпущені разом, стають у чергу — табло біжить хвилею */
      let touched = false;
      for (let i = 0; i < order.length; i++) {
        if (launch[i] === UNSET && fS.release >= order[i]) { lastStart = instantLand ? tt - 10 : queueLaunch(tt, lastStart, order.length); launch[i] = lastStart; released++; touched = true; }
      }
      if (touched) flaps.geometry.attributes.aLaunch.needsUpdate = true;
      flaps.visible = released > 0;
      instantLand = false;
      flapMat.uniforms.uTime.value = tt;
    }
    dustMat.uniforms.uTime.value = tt; nebMat.uniforms.uTime.value = tt;
    grainMat.uniforms.uTime.value = tt; grainMat.uniforms.uSpread.value = fS.grains;
    grainMat.uniforms.uReach.value = fS.grains * far; grains.visible = fS.grains > 0.001;
  }
  const frames = (pre, pin, introT) => { const fS = sceneFrame(pre, pin, introT); return [figureFrame(fS.story, introT, COUNTS), fS]; };
  function render(fF, fS) { apply(fF, fS, t); renderer.render(scene, camera); }

  fit();
  if (reduced) {
    const one = () => render(...frames(1, 0.95, 1));
    one();
    fontsReady.then(one);
    new ResizeObserver(() => { fit(); one(); }).observe(sceneEl);
    return;
  }
  /* атлас міг намалюватись ще запасним шрифтом — щойно Inter готовий, перемальовуємо й перекладаємо літери */
  fontsReady.then(() => {
    if (flaps) {
      const old = letterAtl.tex;
      letterAtl = letterAtlas();
      flapMat.uniforms.uAtlas.value = letterAtl.tex; flapMat.uniforms.uCount.value = letterAtl.count;
      old.dispose();
    }
    fit(); schedule();
    if (q.has('stage')) jumpTo(pinEnd);
  });
  if (q.has('stage')) jumpTo(pinEnd);

  /* Перезавантаження: доріжку прилипання будує цей скрипт, тож браузер сам місце не відновлює (у <head>
     scrollRestoration = manual) — відновлюємо ми, уже з правильною висотою. І нічого не програється саме:
     фігура зібрана, табло, яке відкрив би цей скрол, уже складене, сторінка людину не тримає. */
  let instantLand = false;
  function enterInstant() {
    introMs = CFG.introMs;
    [preT, pinT] = scrollParts(); preS = preT; pinS = pinT;
    instantLand = true;
  }
  let restoreY = 0;
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && (nav.type === 'reload' || nav.type === 'back_forward')) restoreY = parseFloat(sessionStorage.getItem('vault-y')) || 0;
  } catch (e) { /* без сховища просто починаємо згори */ }
  if (dbgP == null && !q.has('stage')) {
    if (restoreY > 40) { lastY = restoreY; jumpTo(restoreY); enterInstant(); }
    else if (window.scrollY > 40) enterInstant();
  }
  window.addEventListener('pagehide', () => { try { sessionStorage.setItem('vault-y', String(Math.round(window.scrollY))); } catch (e) { /* не критично */ } });

  function tick(now) {
    running = false;
    const dt = Math.min(last ? now - last : 16, 50); last = now;      // покадрово, крок ≤ 50 мс (iOS присипляє цикл)
    t += dt / 1000; frameNo++;
    if (dbgIntro == null) introMs += dt;
    const introT = dbgIntro != null ? dbgIntro : clamp01(introMs / CFG.introMs);
    [preT, pinT] = scrollParts();
    preS += (preT - preS) * 0.16; pinS += (pinT - pinS) * 0.16;
    angle += dt / 1000 * (0.1 + 0.08 * pinS);
    if (still) { preS = preT; pinS = pinT; render(...frames(preS, pinS, introT)); return; }
    if (frameNo % 2) render(...frames(preS, pinS, introT));          // 30 к/с
    if (visible && !document.hidden) schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(tick); } }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { last = 0; schedule(); } }, { threshold: 0.02 }).observe(sceneEl);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { last = 0; schedule(); } });
  new ResizeObserver(() => { fit(); schedule(); }).observe(sceneEl);
  window.addEventListener('scroll', () => { holdAtStage(); schedule(); }, { passive: true });
  schedule();

  /* ---------- геометрія (як на /preview/3d-v6/) ---------- */
  function cubocta() {
    const P = [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]];
    const V = P.map((p) => new THREE.Vector3(p[0], p[1], p[2]).multiplyScalar(Math.SQRT1_2));
    const E = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.abs(V[i].distanceToSquared(V[j]) - 1) < 1e-6) E.push([i, j]);
    return { V, E };
  }
  function beam(a, b, th, mat, off, parent) {
    const dir = tmpB.subVectors(b, a); const len = dir.length(); dir.normalize();
    const mid = tmpC.addVectors(a, b).multiplyScalar(0.5);
    const z = mid.clone().addScaledVector(dir, -mid.dot(dir));
    if (z.lengthSq() < 1e-6) z.crossVectors(dir, Math.abs(dir.y) < 0.9 ? UP : RIGHT);
    z.normalize();
    const x = new THREE.Vector3().crossVectors(dir, z).normalize();
    const m = new THREE.Mesh(new THREE.BoxGeometry(th, len, th), mat);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, dir.clone(), z));
    m.userData = { off, len0: len };
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
    const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < 900; i++) {
      const y = r() * 256, l = 20 + r() * 200, x = r() * 256, v = Math.round(110 + r() * 70);
      g.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.35)'; g.lineWidth = 0.6 + r() * 0.8;
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
  function seeded(seed) { let s = seed * 7919 + 13; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
}
