/*
 * Перший екран /ai — «Сховище», ТЕЛЕФОН. Компʼютер має власний модуль і
 * розвивається окремо: тут немає жодної гілки для широкого екрана.
 *
 * Сцена навмисно проста (прохання власника: «не перевантажувати»):
 *  — при відкритті фігура збирає себе, як на /preview/3d-v6/: виринають усі
 *    вузли, між ними малюється ґратка, зовнішні бруси замикають каркас,
 *    займається світло;
 *  — від скролу ґратка провертається, фігура докручується, меншає й
 *    опускається до опису, а від неї до тексту вмикаються мʼякі промені;
 *  — опис — ЗВИЧАЙНИЙ текст сторінки: він просто плавно проявляється
 *    (перехід CSS), без анімації по літерах;
 *  — по металу раз на кілька секунд пробігає блік.
 * Унизу першого екрана — німий натяк, що сторінку треба гортати.
 * Історія програється один раз: назад нічого не відмотується.
 *
 * Для знімків: ?p=0.5 — прогрес скролу, ?intro=1 — вступ завершено,
 * ?still=1 — один кадр.
 */
import * as THREE from 'three';
import { figureFrame, getFrame as sceneFrame, clamp01, CFG } from './hero-vault-mobile-frame.js';

const sceneEl = document.getElementById('vault-scene');
const canvas = document.getElementById('vault-canvas');
if (sceneEl && canvas) init();

function init() {
  const q = new URLSearchParams(location.search);
  const dbgP = q.has('p') ? clamp01(parseFloat(q.get('p'))) : null;
  const dbgIntro = q.has('intro') ? clamp01(parseFloat(q.get('intro'))) : null;
  const still = q.has('still');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { sceneEl.classList.add('vault-nogl'); document.documentElement.classList.remove('vault-holo'); return; }
  const html = document.documentElement;
  html.classList.add('vault-live');                           // сцена запустилась — запасний таймер у <head> більше не потрібен
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x0b0f19, 0);

  /* усе спільне — до першого використання */
  const R = 0.61;
  const cPos = new THREE.Vector3(0, R + 0.3, 0);
  const cam0 = new THREE.Vector3(0, cPos.y, 7.0);
  const target = new THREE.Vector3(0, cPos.y - 0.72, 0);     // дивимось нижче фігури — вона стає під заголовком, знизу місце під текст
  const SHRINK = 0.34;                                        // зі скролом фігура меншає, звільняючи місце опису
  let figDrop = 0;                                            // і опускається до тексту; скільки це у світових одиницях — рахує fitScene()
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0), mtx = new THREE.Matrix4();
  const LIGHT = new THREE.Color(0x47a0ff);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 80);
  camera.position.copy(cam0); camera.lookAt(target);          // камера нерухома

  const key = new THREE.DirectionalLight(0xe8eeff, 1.5);
  key.position.set(cPos.x - 2.2, 9, cPos.z + 4.5); key.target.position.set(cPos.x, 0, cPos.z); scene.add(key.target);
  scene.add(key);
  const fillA = new THREE.PointLight(0xb9b0f0, 2.4, 16, 2); fillA.position.set(cPos.x + 5, 3.5, cPos.z - 3); scene.add(fillA);
  const fillB = new THREE.PointLight(0x60a5fa, 3, 16, 2); fillB.position.set(cPos.x - 5, 2.5, cPos.z + 4); scene.add(fillB);
  scene.add(new THREE.HemisphereLight(0x3a4a70, 0x05070d, 0.65));

  /* ---------- фігура: побудова як на /preview/3d-v6/ (на телефоні без сяйва довкола ліній і без тіні) ---------- */
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
    const strip = beam(s.a, s.b, s.th * 0.34, lightMat, s.off, s.parent);
    const mid = tmpA.addVectors(s.a, s.b).multiplyScalar(0.5);
    return { bar, strip, lightMat, k: mid.y * 2.0 + mid.x * 0.7 + mid.z * 0.4, y: Math.min(s.a.y, s.b.y), spoke: s.spoke, a: s.a, b: s.b };
  });
  innerLines.sort((a, b) => a.y - b.y);
  const COUNTS = { joints: joints.length, inner: innerLines.length, outer: outerBeams.length };

  /* ---------- блік, що пробігає по металу ---------- */
  /* Раз на кілька секунд по фігурі наскрізь проходить мʼяка світла смуга — вздовж однієї діагоналі у світі,
     тож на фігурі, що обертається, вона читається як світло, яке ковзає по брусах. Одна повільна хвиля. */
  const glint = { uGlintT: { value: 0 }, uGlintC: { value: cPos.clone() }, uGlintR: { value: R } };
  function addGlint(mat, k) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, glint, { uGlintK: { value: k } });
      sh.vertexShader = 'varying vec3 vGlintW;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n\tvGlintW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uGlintT; uniform vec3 uGlintC; uniform float uGlintR; uniform float uGlintK; varying vec3 vGlintW;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
        `float gd = dot(vGlintW - uGlintC, normalize(vec3(0.55, 1.0, 0.25))) / uGlintR;
        float gph = fract(uGlintT / 5.0);                              // цикл 5 с
        float gpos = mix(-1.6, 1.6, clamp(gph / 0.55, 0.0, 1.0));      // смуга проходить фігуру за ~2,7 с, далі пауза
        float gband = exp(-pow((gd - gpos) * 4.5, 2.0)) * (1.0 - step(0.55, gph));
        outgoingLight += vec3(0.6, 0.76, 1.0) * gband * uGlintK;
        #include <opaque_fragment>`);
    };
  }
  addGlint(metalOuter, 0.85); addGlint(metalInner, 0.55);

  /* ---------- промені: мʼяке світло від фігури до опису ---------- */
  /* Віяло від ядра фігури до верхнього краю опису: кілька світлих смуг, що повільно зсуваються, і хвиля
     світла, яка стікає по них до тексту. Над самим текстом гасне — читати не заважає. Вершини рядками,
     щоб смуги не кривились на трапеції. */
  const BEAM_ROWS = 28;
  const beamGeo = new THREE.BufferGeometry();
  {
    const uv = [], idx = [];
    for (let j = 0; j <= BEAM_ROWS; j++) { uv.push(0, j / BEAM_ROWS, 1, j / BEAM_ROWS); }
    for (let j = 0; j < BEAM_ROWS; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((BEAM_ROWS + 1) * 6), 3));
    beamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    beamGeo.setIndex(idx);
  }
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uStartV: { value: 0.2 }, uA: { value: new THREE.Color(0x4f8ff0) }, uB: { value: new THREE.Color(0xa8c8ff) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform float uOp; uniform float uStartV; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
      void main(){
        float u = vUv.x, v = vUv.y;
        float across = smoothstep(0.0, 0.3, u) * smoothstep(1.0, 0.7, u);
        /* зʼявляються одразу з-під фігури й тягнуться до тексту, гаснучи ще до першого рядка */
        float along = smoothstep(uStartV, uStartV + 0.1, v) * (1.0 - smoothstep(0.62, 0.97, v));
        /* кілька ширших променів, що розходяться від ядра (віяло) й повільно перебігають */
        float s = 0.5 + 0.5 * sin(u * 11.0 + uTime * 0.35) * sin(u * 4.6 - uTime * 0.23 + 1.3);
        float shafts = 0.18 + 0.82 * pow(s, 2.0);
        float flow = 0.65 + 0.7 * exp(-pow((fract(uTime * 0.2) * 1.4 - 0.1 - v) * 4.0, 2.0));   // хвиля світла стікає до тексту
        vec3 c = mix(uA, uB, v) * across * along * shafts * flow * uOp * 0.42;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
      }`,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const beams = new THREE.Mesh(beamGeo, beamMat);
  beams.frustumCulled = false; beams.renderOrder = -1; beams.visible = false; scene.add(beams);

  /* далекий пил і туманності — глибина кадру */
  const rnd = seeded(31);
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

  /* ---------- стан ---------- */
  let introMs = -300, last = 0, t = 0, angle = 0.4, frameNo = 0;
  let pT = 0, pS = 0, latch = 0;
  let visible = false, running = false;
  const hero = sceneEl.closest('section');
  const lede = document.getElementById('vault-lede');
  /* опис — звичайний текст сторінки: до скролу він прихований (клас у <head>), далі просто проявляється
     переходом CSS. Жодної анімації по літерах — власник просив не перевантажувати. */
  let ledeShown = false;
  function showLede(instant) {
    if (ledeShown || !lede) return;
    ledeShown = true;
    if (instant) lede.classList.add('vault-lede-now');
    lede.classList.add('vault-lede-in');
  }
  /* висота «малого» вікна (з усіма панелями браузера): не змінюється, коли Safari ховає адресний рядок */
  const svhProbe = document.createElement('div');
  svhProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(svhProbe);

  /* ---------- натяк, що треба гортати ---------- */
  /* Німий індикатор унизу екрана: крапка повільно стікає в капсулі. Зʼявляється, коли фігура вже зібралась,
     і зникає від першого ж руху скролу — більше не показується. */
  const cue = document.createElement('div');
  cue.className = 'vault-cue'; cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = '<span></span>';
  document.body.appendChild(cue);
  let cueDone = false;
  function hideCueForever() {
    if (cueDone) return;
    cueDone = true; cue.classList.remove('is-on');
    setTimeout(() => cue.remove(), 700);
  }

  /* ---------- розкладка: фігура й промені відносно місця опису ---------- */
  function projectY(v) { return (1 - tmpD.copy(v).project(camera).y) / 2 * sceneEl.clientHeight; }
  function fitScene() {
    const w = Math.max(1, sceneEl.clientWidth), h = Math.max(1, sceneEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.copy(cam0); camera.lookAt(target); camera.updateMatrixWorld();
    dustMat.uniforms.uPR.value = nebMat.uniforms.uPR.value = renderer.getPixelRatio();
    if (!lede || !hero) return;
    const lr = lede.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    const ledeTop = lr.top - hr.top, ledeL = lr.left - hr.left, ledeW = lr.width;
    /* фігура в пікселях сцени: центр і радіус. Зі скролом вона меншає й опускається так, щоб стати
       просто над описом — промені між ними виходять короткі, і разом вони читаються як одне ціле. */
    const cY = projectY(cPos), r0 = Math.abs(projectY(tmpC.copy(cPos).setY(cPos.y + R * 1.15)) - cY);
    const pxPerWorld = Math.abs(projectY(tmpC.copy(cPos).setY(cPos.y + 1)) - cY);
    const r = r0 * (1 - SHRINK), gap = 44;
    figDrop = Math.max(0, (ledeTop - gap - r - cY) / pxPerWorld);
    /* віяло: від ядра фігури (у кінцевому положенні) до верхнього краю опису, на ширину тексту */
    const D = 6.2, edgeY = ledeTop - 2;
    const apex = tmpA.copy(cPos); apex.y -= figDrop;
    const cornerAt = (px, out) => {
      out.set((px / w) * 2 - 1, -((edgeY / h) * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize();
      return out.multiplyScalar(D).add(camera.position);
    };
    const baseL = cornerAt(ledeL, new THREE.Vector3()), baseR = cornerAt(ledeL + ledeW, new THREE.Vector3());
    const right = tmpB.copy(baseR).sub(baseL).normalize();
    const apexL = apex.clone().addScaledVector(right, -R * 0.1), apexR = apex.clone().addScaledVector(right, R * 0.1);
    const pos = beamGeo.attributes.position;
    for (let j = 0; j <= BEAM_ROWS; j++) {
      const k = j / BEAM_ROWS;
      tmpB.copy(apexL).lerp(baseL, k); pos.setXYZ(j * 2, tmpB.x, tmpB.y, tmpB.z);
      tmpC.copy(apexR).lerp(baseR, k); pos.setXYZ(j * 2 + 1, tmpC.x, tmpC.y, tmpC.z);
    }
    pos.needsUpdate = true;
    beamMat.uniforms.uStartV.value = Math.min(0.5, (R * (1 - SHRINK) * 0.9) / Math.max(0.01, apex.distanceTo(tmpB.copy(baseL).lerp(baseR, 0.5))));
  }
  /* історія проходить за частку екрана скролу й НЕ відмотується назад: досягнутий стан лишається */
  function progress() {
    if (dbgP != null) return dbgP;
    const svh = svhProbe.offsetHeight || window.innerHeight;
    latch = Math.max(latch, clamp01(window.scrollY / Math.max(1, CFG.span * svh)));
    return latch;
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
    outer.position.y = cPos.y + Math.sin(tt * 0.6) * 0.03 - figDrop * fS.pull;
    outer.scale.setScalar(1 - SHRINK * fS.pull);
    glint.uGlintC.value.copy(outer.position); glint.uGlintR.value = R * outer.scale.x; glint.uGlintT.value = tt;
    if (fS.lede) showLede(false);
    dustMat.uniforms.uTime.value = tt; nebMat.uniforms.uTime.value = tt;
    beamMat.uniforms.uTime.value = tt; beamMat.uniforms.uOp.value = fS.beams; beams.visible = fS.beams > 0.002;
  }
  const frames = (p, introT) => { const fS = sceneFrame(p, introT); return [figureFrame(fS.story, introT, COUNTS), fS]; };
  function render(fF, fS) { apply(fF, fS, t); renderer.render(scene, camera); }

  fitScene();
  if (reduced) {
    html.classList.remove('vault-holo');                       // опис лишається звичайним видимим текстом
    const one = () => render(...frames(0.95, 1));
    one();
    new ResizeObserver(() => { fitScene(); one(); }).observe(sceneEl);
    return;
  }
  /* сторінку відкрито не згори (перезавантаження, перехід назад) — нічого не програється: одразу кінцевий стан */
  if (dbgP == null && window.scrollY > 40) { introMs = CFG.introMs; latch = 1; showLede(true); hideCueForever(); }

  function tick(now) {
    running = false;
    const dt = Math.min(last ? now - last : 16, 50); last = now;      // покадрово, крок ≤ 50 мс (iOS присипляє цикл)
    t += dt / 1000; frameNo++;
    if (dbgIntro == null) introMs += dt;
    const introT = dbgIntro != null ? dbgIntro : clamp01(introMs / CFG.introMs);
    pT = progress();
    pS += (pT - pS) * 0.16;
    angle += dt / 1000 * (0.2 + 0.12 * pS);                           // фігура помітно крутиться, зі скролом — трохи швидше
    if (introT >= 1 && !cueDone && window.scrollY < 8) cue.classList.add('is-on');   // фігура зібралась — показуємо, що треба гортати
    if (still) { pS = pT; render(...frames(pS, introT)); return; }
    if (frameNo % 2) render(...frames(pS, introT));                   // 30 к/с
    if (visible && !document.hidden) schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(tick); } }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { last = 0; schedule(); } }, { threshold: 0.02 }).observe(sceneEl);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { last = 0; schedule(); } });
  new ResizeObserver(() => { fitScene(); schedule(); }).observe(sceneEl);
  window.addEventListener('scroll', () => { if (window.scrollY > 8) hideCueForever(); schedule(); }, { passive: true });
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
    m.visible = false;
    parent.add(m);
    return m;
  }
  function joint(v, r, mat, parent) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat);
    m.position.copy(v); m.scale.setScalar(0.001); parent.add(m); return m;
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
