/*
 * Перший екран /ai — «Сховище», КОМПʼЮТЕР. Телефон має власний модуль і
 * розвивається окремо: тут немає жодної гілки для вузького екрана.
 *
 * ФІГУРА — як на /preview/3d-v6/: металевий кубооктаедр із брусів
 * шліфованого алюмінію, всередині менша копія зі спицями й синіми
 * світловими лініями. При відкритті з простору виринають усі вузли, між
 * ними малюється ґратка, зовнішні бруси замикають каркас і займається
 * світло. Зі скролом ґратка провертається на чверть оберту, фігура
 * докручується, світло розгоряється, камера облітає. Каркас не
 * розсувається — фігура не росте.
 *
 * ОПИС — ПРОЄКЦІЯ. Абзац «Мене звати…» складається з окремих літер точно на
 * місці абзацу в розмітці (сам <p> лишається прозорим носієм змісту). Рама
 * тексту прибита до кадру, тож камера може облітати фігуру. Увесь опис —
 * ТАБЛО: кожна літера кілька разів перекидає пластинку й зупиняється на своєму
 * знаку. Перше речення проявляється саме, щойно фігура зʼявилась і заголовок
 * звільнив місце; решту відкриває скрол — хвилею в порядку читання. Швидкий
 * скрол сторінка притримує, доки табло не складеться (до ~1,5 с).
 *
 * ПОЛЕ ФОРМУЛ за фігурою: після вступу ледь тліє, а щойно починається скрол і
 * з ядра вирушають вогники — стає яскравим.
 *
 * Для знімків: ?p=0.5 — прогрес скролу, ?intro=1 — вступ завершено,
 * ?still=1 — один кадр, ?age=3 — стільки секунд «уже минуло» після вступу.
 */
import * as THREE from 'three';
import { figureFrame, figureProgress, getFrame as sceneFrame, introRelease, flapStart, restOrder, queueLaunch, danceFrame, DANCE, FIG_DANCE, kickFrame, FIG, clamp01, CFG } from './hero-vault-desk-frame.js';

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
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  /* Варіант «фото» (/preview/vault-photo/): фон — знімок нічного робочого місця, а фігура — та сама жива 3D,
     що стоїть над стільницею на фото. PHOTO — розмір кадру, позиція background-position і точки в частках кадру:
     центр фігури, її радіус (частка висоти кадру) і місце відблиску на столі. */
  const photo = sceneEl.dataset.variant === 'photo';
  const photoEl = photo ? sceneEl.querySelector('.vault-photo') : null;
  const glowEl = photo ? sceneEl.querySelector('.vault-deskglow') : null;
  const PHOTO = { w: 1408, h: 768, pos: [0.62, 0.5], fig: [0.71, 0.47], figR: 0.235, desk: 0.79 };
  const INTRO_MS = photo ? DANCE.introMs : CFG.introMs;        // у фото крапки збираються хороводом — появі потрібно трохи більше часу

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { sceneEl.classList.add('vault-nogl'); document.documentElement.classList.remove('vault-holo'); return; }
  const html = document.documentElement;
  html.classList.add('vault-live');                           // сцена запустилась — запасний таймер у <head> більше не потрібен
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0b0f19, 0);

  /* усе спільне — до першого використання */
  const R = 0.97;
  const cPos = new THREE.Vector3(5.0, R + 0.7, 0.6);
  const cam0 = new THREE.Vector3(0.3, cPos.y + 0.2, 8.8);
  const target = new THREE.Vector3(3.1, cPos.y + 0.6, 0);     // базова точка погляду; composeCamera() зсуває її під розкладку тексту
  const targetBase = target.clone();
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
  const tmpS = new THREE.Vector3(), tmpT = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0), mtx = new THREE.Matrix4();
  const LIGHT = new THREE.Color(0x47a0ff);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  const d0 = cam0.distanceTo(target);
  const az0 = Math.atan2(cam0.x - target.x, cam0.z - target.z), el0 = Math.asin((cam0.y - target.y) / d0);

  /* світло і тінь — як на /preview/3d-v6/ */
  const key = new THREE.DirectionalLight(0xe8eeff, 1.5);
  key.position.set(cPos.x - 2.2, 9, cPos.z + 4.5); key.target.position.set(cPos.x, 0, cPos.z); scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 6; key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30; key.shadow.bias = -0.0006; key.shadow.radius = 9;
  scene.add(key);
  const fillA = new THREE.PointLight(0xb9b0f0, 2.4, 16, 2); fillA.position.set(cPos.x + 5, 3.5, cPos.z - 3); scene.add(fillA);
  /* на фото бузкове світло йде від моніторів ліворуч-позаду фігури — ставимо контрове світло туди ж */
  if (photo) { fillA.color.set(0xa48cff); fillA.intensity = 3.2; fillA.position.set(cPos.x - 4, 3, cPos.z - 4); }
  const fillB = new THREE.PointLight(0x60a5fa, 3, 16, 2); fillB.position.set(cPos.x - 5, 2.5, cPos.z + 4); scene.add(fillB);
  scene.add(new THREE.HemisphereLight(0x3a4a70, 0x05070d, 0.65));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cPos.x, 0, cPos.z); floor.receiveShadow = true; scene.add(floor);
  floor.visible = !photo;                                     // на фото тінь лягала б не на стіл — її замінює відблиск

  /* ---------- фігура: побудова як на /preview/3d-v6/ ---------- */
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

  /* усі 24 вузли — зовнішні й внутрішні разом — виринають знизу вгору */
  const joints = [];
  VO.forEach((v) => joints.push({ m: joint(v, thO * 0.74, metalOuter, spin), v }));
  VI.forEach((v) => joints.push({ m: joint(v, thI * 0.8, metalInner, innerGrp), v }));
  joints.sort((a, b) => a.v.y - b.v.y);
  const outerBeams = C.E.map((e) => ({ m: beam(VO[e[0]], VO[e[1]], thO, metalOuter, 0, spin), i: e[0], j: e[1], y: Math.min(VO[e[0]].y, VO[e[1]].y) }));
  outerBeams.sort((a, b) => a.y - b.y);
  /* внутрішня ґратка: ребра меншої копії + 12 спиць; кожна лінія — брус + світлова смужка + сяйво */
  const innerSegs = C.E.map((e) => ({ a: VI[e[0]], b: VI[e[1]], parent: innerGrp, th: thI, off: thI * 0.52, spoke: -1 }));
  for (let i = 0; i < 12; i++) innerSegs.push({ a: VO[i], b: VI[i], parent: spin, th: thS, off: thS * 0.52, spoke: i });
  const innerLines = innerSegs.map((s) => {
    const bar = beam(s.a, s.b, s.th, metalInner, 0, s.parent);
    const lightMat = new THREE.MeshBasicMaterial({ color: LIGHT });
    const strip = beam(s.a, s.b, s.th * 0.34, lightMat, s.off, s.parent); strip.castShadow = false;
    const glow = beam(s.a, s.b, s.th * 1.9, new THREE.MeshBasicMaterial({ color: LIGHT, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }), s.off, s.parent);
    glow.castShadow = false;
    const mid = tmpA.addVectors(s.a, s.b).multiplyScalar(0.5);
    return { bar, strip, glow, lightMat, k: mid.y * 2.0 + mid.x * 0.7 + mid.z * 0.4, y: Math.min(s.a.y, s.b.y), spoke: s.spoke, a: s.a, b: s.b };
  });
  innerLines.sort((a, b) => a.y - b.y);
  const COUNTS = { joints: joints.length, inner: innerLines.length, outer: outerBeams.length };

  /* ---------- фото-варіант: поява «хороводом» ---------- */
  /* Крапки по одній залітають з-за правого краю й стають у коло, що кружляє довкола фігури; коли в колі всі,
     вони по спіралі сідають на свої місця. Щоб посадка була злагодженою, крапки в колі йдуть у тому ж порядку,
     що й їхні місця за кутом навколо осі фігури: кожній лишається пройти приблизно однаковий шлях. */
  const TRAIL = 3;                                            // скільки світлих точок у хвості
  const RING = R * 1.25, FAR = R * 3.4;                       // радіус кола й звідки крапки на нього залітають
  /* У колі кружляють світлі крапки; вузли-кульки зʼявляються лише під час посадки. Тож перед посадкою кожній
     крапці можна віддати найзручніше місце — найближче попереду за ходом кола, — і всі сядуть однаковим рухом. */
  const dotJoint = joints.map((_, i) => i);                    // яка крапка стане яким вузлом (призначається перед посадкою)
  const seatTarget = new Float32Array(joints.length);
  let assigned = false;
  const jitRng = seeded(211);
  const jit = joints.map(() => jitRng());                     // легкий розкид черги посадки
  let sparks = null;
  if (photo) {
    const n = joints.length * (1 + TRAIL);
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    sGeo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    const sz = new Float32Array(n);
    for (let i = 0; i < joints.length; i++) for (let k = 0; k <= TRAIL; k++) sz[i * (1 + TRAIL) + k] = 1 - k * 0.2;
    sGeo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    const sparkMat = new THREE.ShaderMaterial({
      uniforms: { uPR: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color(0x8fc2ff) } },
      vertexShader: `attribute float aAlpha; attribute float aSize; uniform float uPR; varying float vA;
        void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPR * 170.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a;
          gl_FragColor = vec4(uColor * a * vA * 1.8, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    });
    sparks = new THREE.Points(sGeo, sparkMat); sparks.visible = false; sparks.frustumCulled = false; spin.add(sparks);
  }
  const invSpin = new THREE.Matrix4(), aRight = new THREE.Vector3(), aDir = new THREE.Vector3(), aP = new THREE.Vector3();
  const TAU = Math.PI * 2, wrap0 = (a) => ((a % TAU) + TAU) % TAU;
  /* де крапка в системі фігури: на колі (кут від точки входу справа + пройдене), підлітання ззовні, посадка */
  function ringPos(d, phi0, out) {
    const th = phi0 + d.ride, r = FAR + (RING - FAR) * d.reach;
    return out.set(r * Math.cos(th), R * 0.1 * Math.sin(th * 2), r * Math.sin(th));
  }
  function dancePos(d, dot, phi0, out) {
    ringPos(d, phi0, out);
    if (d.seat <= 0 || !assigned) return out;
    const v = joints[dotJoint[dot]].v, th = phi0 + d.ride, e = d.seat;
    const ringR = Math.hypot(out.x, out.z), rt = Math.hypot(v.x, v.z);
    const a = th + (seatTarget[dot] - th) * e, r = ringR + (rt - ringR) * e, y = out.y + (v.y - out.y) * e;
    return out.set(r * Math.cos(a), y, r * Math.sin(a));
  }
  /* Перед посадкою: крапки й місця впорядковуємо за кутом і шукаємо такий циклічний зсув, за якого кожній лишається
     пройти вперед якнайменше, але не менше, ніж вона ще проїде по колу до своєї черги сідати. */
  function assignSeats(D, phi0) {
    const n = joints.length, sec = DANCE.introMs / 1000;
    const th = D.map((d) => phi0 + d.ride);
    const dots = th.map((a, k) => [k, wrap0(a)]).sort((x, y) => x[1] - y[1]);
    const seats = joints.map((j, i) => [i, wrap0(Math.atan2(j.v.z, j.v.x))]).sort((x, y) => x[1] - y[1]);
    const w = (2 * Math.PI * DANCE.fill) / ((DANCE.enter[1] - DANCE.enter[0]) * sec);
    const need = D.map((d, k) => {
      const b0 = DANCE.seat[0] + clamp01(jit[k]) * (DANCE.seat[1] - DANCE.seat[0] - DANCE.seatLen);
      return Math.max(0, (b0 - introNow) * sec * w) + 0.15;             // скільки ще проїде по колу до своєї посадки + запас
    });
    let best = null;
    for (let c = 0; c < n; c++) {
      let worst = 0;
      const off = dots.map(([k, a], m) => { const o = need[k] + wrap0(seats[(m + c) % n][1] - a - need[k]); worst = Math.max(worst, o); return o; });
      if (!best || worst < best.worst) best = { c, off, worst };
    }
    dots.forEach(([k], m) => { dotJoint[k] = seats[(m + best.c) % n][0]; seatTarget[k] = th[k] + best.off[m]; });
    assigned = true;
  }
  function applyDance() {
    const n = joints.length, D = danceFrame(introNow, n, jit);
    const sp = sparks.geometry.attributes.position, sa = sparks.geometry.attributes.aAlpha;
    outer.updateMatrixWorld(true);
    invSpin.copy(spin.matrixWorld).invert();
    aRight.setFromMatrixColumn(camera.matrixWorld, 0);
    aDir.copy(aRight).transformDirection(invSpin);
    const phi0 = Math.atan2(aDir.z, aDir.x);                                   // точка входу: праворуч на екрані
    if (!assigned && introNow >= DANCE.seat[0] - 0.004) assignSeats(D, phi0);
    if (introNow < DANCE.seat[0] - 0.02) assigned = false;
    const tails = [1, 2, 3].map((k) => danceFrame(introNow - k * 0.012, n, jit));
    let any = false;
    for (let dot = 0; dot < n; dot++) {
      const d = D[dot], j = joints[dotJoint[dot]], base = dot * (1 + TRAIL);
      if (d.landed || d.scale <= 0) {
        j.m.position.copy(j.v); j.m.scale.setScalar(Math.max(0.001, d.landed ? d.scale : 0));
        sp.setXYZ(base, j.v.x, j.v.y, j.v.z); sa.setX(base, d.landed ? d.glow : 0);
        for (let k = 1; k <= TRAIL; k++) sa.setX(base + k, 0);
        if (d.landed && d.glow > 0.001) any = true;
        continue;
      }
      dancePos(d, dot, phi0, aP);
      /* кулька-вузол проявляється лише під час посадки; до того в колі кружляє світла крапка */
      j.m.position.copy(aP); j.m.scale.setScalar(Math.max(0.001, assigned ? d.scale * smoothstep01(d.seat / 0.35) : 0));
      sp.setXYZ(base, aP.x, aP.y, aP.z); sa.setX(base, d.glow);
      for (let k = 1; k <= TRAIL; k++) {                                       // хвіст — де крапка була мить тому
        const dk = tails[k - 1][dot];
        dancePos(dk, dot, phi0, aP);
        sp.setXYZ(base + k, aP.x, aP.y, aP.z);
        sa.setX(base + k, dk.scale > 0 && dk.seat < 1 ? d.glow * [0, 0.5, 0.3, 0.15][k] : 0);
      }
      any = true;
    }
    sp.needsUpdate = true; sa.needsUpdate = true;
    sparks.visible = any;
  }
  const smoothstep01 = (x) => { const k = clamp01(x); return k * k * (3 - 2 * k); };

  /* ---------- поле формул: невидима похила площина збоку за фігурою ---------- */
  const H = 7.5, WW = 19;
  const wallC = new THREE.Vector3(9.3, H / 2, -1.8);
  if (photo) wallC.addScaledVector(tmpA.subVectors(wallC, cam0).normalize(), 5.5);   // у фото голограма — дальший план, за вікном
  const wallRot = -Math.PI / 2 + 0.62;
  const wallN = new THREE.Vector3(-Math.cos(wallRot + Math.PI / 2), 0, Math.sin(wallRot + Math.PI / 2));
  const wallU = new THREE.Vector3(Math.cos(wallRot), 0, -Math.sin(wallRot));
  const wallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(wallN, wallC);
  const wallPoint = (a, b) => wallC.clone().addScaledVector(wallU, a).add(new THREE.Vector3(0, b, 0));
  const wallCorners = [];
  for (const a of [-WW / 2, WW / 2]) for (const b of [-H / 2, H / 2]) wallCorners.push(wallPoint(a, b));
  /* хвиля росте з точки площини, що лежить рівно за фігурою з погляду камери */
  const wallOrigin = wallC.clone(), figRay = new THREE.Ray();
  /* у спокої поле тьмяне й сіре; від скролу розгоряється до яскравого — як у ранніх версіях */
  const TINT_REST = new THREE.Color(0x62728d), TINT_LIT = new THREE.Color(0xbcd3ff);
  const wallMat = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: blankTexture() }, uGrid: { value: blankData() }, uCell: { value: new THREE.Vector2(1, 1) }, uAt: { value: new THREE.Vector2(1, 1) },
      uTint: { value: TINT_REST.clone() }, uOpacity: { value: 0 },
      uOrigin: { value: wallOrigin }, uRadius: { value: 0 }, uSoft: { value: 2.0 },
      uSpot: { value: new THREE.Vector3(0, -50, 0) }, uSpotR: { value: 3.0 }, uSpotK: { value: fine ? 0.7 : 0 }, uTime: { value: 0 },
      uEdge: { value: 0.2 },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uAtlas; uniform sampler2D uGrid; uniform vec2 uCell; uniform vec2 uAt; uniform vec3 uTint; uniform float uOpacity; uniform vec3 uOrigin; uniform float uRadius; uniform float uSoft;
      uniform vec3 uSpot; uniform float uSpotR; uniform float uSpotK; uniform float uTime; uniform float uEdge;
      varying vec2 vUv; varying vec3 vW;
      void main(){
        /* сітка знаків: у uGrid для кожної комірки — номер гліфа (R), яскравість (G), середина слота в частках знака (B), скільки слотів він займає (A) */
        vec2 cp = vec2(vUv.x, 1.0 - vUv.y) * uCell;
        vec2 ci = floor(cp), f = fract(cp);
        vec4 cellData = texture2D(uGrid, (ci + 0.5) / uCell);
        float gi = floor(cellData.r * 255.0 + 0.5);
        vec2 gp = vec2(mod(gi, uAt.x), floor(gi / uAt.x));
        float lx = cellData.b + (f.x - 0.5) / max(1.0, cellData.a * 255.0);
        vec4 t = texture2D(uAtlas, (gp + vec2(lx, f.y)) / uAt); t.a *= cellData.g * 1.35;
        float d = distance(vW, uOrigin);
        float m = 1.0 - smoothstep(uRadius - uSoft, uRadius + uSoft * 0.25, d);
        float fall = 1.0 / (1.0 + d * d * 0.014);
        float edge = smoothstep(0.0, uEdge, vUv.x) * smoothstep(1.0, 1.0 - uEdge, vUv.x) * smoothstep(0.0, uEdge, vUv.y) * smoothstep(1.0, 1.0 - uEdge, vUv.y);
        float spot = 1.0 + uSpotK * (1.0 - smoothstep(0.0, uSpotR, distance(vW, uSpot)));
        float breathe = 0.92 + 0.08 * sin(uTime * 0.45 + vW.z * 0.7 + vW.y * 0.9);
        float lit = uOpacity * m * edge * (0.35 + 0.65 * fall) * spot * breathe;
        gl_FragColor = vec4(uTint * t.rgb * t.a * lit, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        /* полотно прозоре з premultiplied alpha: альфа = яскравість пікселя, інакше браузер гасить світло */
        gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WW, H), wallMat); wall.position.copy(wallC); wall.rotation.y = wallRot;
  wall.visible = false; scene.add(wall);
  /* Не про мої проєкти, а про економіку того, хто читає. Три голоси: модель · результат · процес. */
  const CORPUS = [
    'LTV / CAC = 3,8', 'ROAS = дохід / витрати', 'маржа = чек × частота − CAC',
    '∂ прибуток / ∂ бюджет', 'точка окупності: 2,5 міс', 'сегмент × канал × маржа',
    'прогноз попиту на 14 днів', 'p(оплата | джерело)', 'план / факт = 96 %',
    'CAC ↓ 34 % за 6 тижнів', 'конверсія 2,1 % → 3,4 %', 'обробка заявки: 4 год → 3 хв',
    'відмови на оплаті −41 %', 'повторні покупки 19 % → 31 %', 'вартість ліда $12,40',
    'середній чек ↑ 22 %', '12 год рутини на тиждень → 0', 'ручна робота 68 % → 8 %',
    '0 втрачених заявок', 'A/B: +18 % до кошика', 'заявка → CRM → дзвінок за 60 с',
    'звіт щопонеділка о 08:00', 'оплата → документ → пошта', 'відповідь клієнту 24/7 · 30 с',
    'щоденна звірка: 0 розбіжностей', 'клік → лід → оплата', 'черга: 0 · очікування → 0',
  ];
  /* жива стіна: сітка знаків, як у заставці «Матриці», покладеній набік */
  const COLS = 700, ROWS = 30;
  const gridData = new Uint8Array(COLS * ROWS * 4);
  const gridTex = new THREE.DataTexture(gridData, COLS, ROWS, THREE.RGBAFormat);
  gridTex.needsUpdate = true;
  const rowChars = Array.from({ length: ROWS }, () => []);
  const headX = new Float32Array(ROWS), headSpeed = new Float32Array(ROWS), headWait = new Float32Array(ROWS);
  const rowRnd = seeded(97);
  for (let y = 0; y < ROWS; y++) { headX[y] = -4; headSpeed[y] = COLS / (2.6 + rowRnd() * 2.2); headWait[y] = rowRnd() * 9; }
  const fontsReady = Promise.race([Promise.all([document.fonts.load('400 40px Inter'), document.fonts.load('700 40px Inter')]).catch(() => null), new Promise((r) => setTimeout(r, 1200))]);
  let glyphs = null;
  fontsReady.then(() => {
    glyphs = glyphAtlas(64);
    wallMat.uniforms.uAtlas.value = glyphs.tex;
    wallMat.uniforms.uAt.value.set(glyphs.cols, glyphs.rows);
    wallMat.uniforms.uGrid.value = gridTex;
    wallMat.uniforms.uCell.value.set(COLS, ROWS);
    for (let y = 0; y < ROWS; y++) writeRow(y, 11 + y * 3);
    paintGrid();
    /* літери опису могли намалюватись ще запасним шрифтом — тепер Inter готовий, перемальовуємо й перекладаємо */
    if (flaps) {
      const old = letterAtl.tex;
      letterAtl = letterAtlas();
      flapMat.uniforms.uAtlas.value = letterAtl.tex; flapMat.uniforms.uCount.value = letterAtl.count;
      old.dispose();
    }
    fit();                                                         // зі шрифтом Inter змінились і розміри тексту
    schedule();
  });
  function writeRow(y, seed) {
    const r = seeded(seed), out = [], space = Math.max(1, Math.round(glyphs.slotsOf(' ') * 1.1));
    let x = -Math.floor(r() * COLS * 0.25);
    while (x < COLS) {
      if (r() < 0.15) {
        const c = glyphs.charts[Math.floor(r() * glyphs.charts.length)];
        if (x >= 0 && x + c.k <= COLS) out.push({ tg: c.gi, gi: c.gi, k: c.k, x0: x, roll: 0, glow: 0 });
        x += c.k;
      } else {
        const line = CORPUS[Math.floor(r() * CORPUS.length)];
        for (const ch of line) {
          const k = glyphs.slotsOf(ch), gi = glyphs.index[ch] || 0;
          if (x >= 0 && x + k <= COLS && gi) out.push({ tg: gi, gi, k, x0: x, roll: 0, glow: 0 });
          x += k;
        }
      }
      x += space * (2 + Math.floor(r() * 4));
    }
    rowChars[y] = out;
  }
  function paintGrid() {
    gridData.fill(0);
    for (let y = 0; y < ROWS; y++) {
      const base = y * COLS * 4;
      for (const ch of rowChars[y]) {
        const bright = Math.min(255, 105 + ch.glow * 150);
        for (let j = 0; j < ch.k; j++) {
          const i = base + (ch.x0 + j) * 4;
          if (ch.x0 + j < 0 || ch.x0 + j >= COLS) continue;
          gridData[i] = ch.gi; gridData[i + 1] = bright;
          gridData[i + 2] = Math.round((j + 0.5) / ch.k * 255); gridData[i + 3] = ch.k;
        }
      }
    }
    gridTex.needsUpdate = true;
  }
  let gridSeed = 400, rollTick = 0;
  function stepGrid(dt) {
    if (!glyphs || !wall.visible) return;
    rollTick += dt;
    const roll = rollTick > 0.055;
    if (roll) rollTick = 0;
    for (let y = 0; y < ROWS; y++) {
      const from = headX[y];
      if (headWait[y] > 0) { headWait[y] -= dt; if (headWait[y] <= 0) { writeRow(y, (gridSeed += 13)); headX[y] = -3; } }
      else {
        headX[y] += headSpeed[y] * dt;
        if (from > COLS + 2) { headWait[y] = 5 + rowRnd() * 11; headX[y] = COLS + 3; }
        else for (const ch of rowChars[y]) if (ch.x0 >= from && ch.x0 < headX[y]) { ch.roll = 0.18 + rowRnd() * 0.22; ch.glow = 1; }
      }
      for (const ch of rowChars[y]) {
        if (ch.roll > 0) {
          ch.roll -= dt;
          if (ch.roll <= 0) ch.gi = ch.tg;
          else if (roll) ch.gi = 1 + Math.floor(rowRnd() * (glyphs.letters - 1));
        }
        if (ch.glow > 0) ch.glow = Math.max(0, ch.glow - dt * 0.9);
      }
    }
    paintGrid();
  }

  /* зерна світла, що летять із ядра на поле формул */
  const rnd = seeded(31);
  const N = 2600;
  const gTo = [], gPhase = [], gSpeed = [], gPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const p = wallPoint((rnd() - 0.5) * (WW - 3), (rnd() - 0.5) * (H - 2));
    gTo.push(p.x, p.y, p.z); gPhase.push(rnd()); gSpeed.push(0.035 + rnd() * 0.055);
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('aTo', new THREE.Float32BufferAttribute(gTo, 3));
  gGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(gPhase, 1));
  gGeo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(gSpeed, 1));
  gGeo.boundingSphere = new THREE.Sphere(cPos.clone(), 30);
  const grainMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOrigin: { value: cPos.clone() }, uStart: { value: R * 0.12 }, uSpread: { value: 0 }, uSize: { value: 8 }, uPR: { value: renderer.getPixelRatio() }, uColorA: { value: new THREE.Color(0x60a5fa) }, uColorB: { value: new THREE.Color(0xa78bfa) },
      uWave: wallMat.uniforms.uOrigin, uReach: { value: 0 }, uSoft: wallMat.uniforms.uSoft },
    vertexShader: `attribute vec3 aTo; attribute float aPhase; attribute float aSpeed;
      uniform float uTime; uniform vec3 uOrigin; uniform vec3 uWave; uniform float uReach; uniform float uSoft;
      uniform float uStart; uniform float uSpread; uniform float uSize; uniform float uPR; varying float vA; varying float vK;
      void main(){ float u = fract(aPhase + uTime * aSpeed);
        vec3 d = aTo - uOrigin; float maxD = length(d); vec3 p = uOrigin + d / max(maxD, 0.001) * mix(uStart, maxD, u);
        /* власний, швидший фронт: вогники випереджають яскравість поля */
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

  /* далекий пил: ледь помітні цятки в глибині навколо фігури */
  const DUST = 700;
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

  /* туманності: великі мʼякі плями світла далеко за фігурою — саме вони дають глибину */
  const NEB = 11;
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
  nebula.visible = !photo;                                    // глибину дає саме фото

  /* ---------- стан ---------- */
  let w = 1, h = 1;
  let introMs = -300, last = 0, t = 0, angle = 0.4;
  let restSec = AGE;                      // секунд від кінця вступу
  let pTarget = 0, pSmooth = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  let visible = false, running = false;
  const spot = new THREE.Vector3(0, -50, 0), tspot = new THREE.Vector3(0, -50, 0);
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const track = document.getElementById('vault-track');
  const section = sceneEl.closest('section');
  const titleEl = document.querySelector('#vault-hero h1.vault-rise');
  /* положення елемента всередині hero без урахування transform — колонка тексту при завантаженні ще
     доїжджає анімацією fade-in-up, а заголовок опущений; прямокутники з getBoundingClientRect тоді брешуть */
  function offsetIn(el) {
    let x = 0, y = 0, n = el;
    while (n && n !== section) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return n === section ? { x, y } : null;
  }
  const lede = document.getElementById('vault-lede');

  /* ---------- опис: літери ---------- */
  /* «зменшити рух» — один нерухомий кадр, літерам немає коли зʼявитись: опис лишається текстом розмітки */
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
  /* перше речення — «Мене звати Олександр Серняк, я технічний PPC-маркетолог із 2016 року.» — зʼявляється табло */
  let autoLetters = 0;
  if (ledeTokens) {
    let c = 0;
    for (const tk of ledeTokens) { c += tk.w.length; if (/[.!?]$/.test(tk.w)) { autoLetters = c; break; } }
  }
  const LCELL = 64, LFS = 42;
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
  /* розкладка абзацу по літерах у пікселях CSS — тими самими метриками, що й браузер */
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

  /* Рама опису: прямокутник абзацу, винесений у світ перед камерою й повернутий до неї. Літери лежать у її
     власних координатах, тож раму переставляємо щокадру — текст стоїть на місці абзацу, поки камера облітає. */
  const ledeFrame = new THREE.Object3D(); scene.add(ledeFrame);
  const ndcToWorld = new THREE.Vector3();
  let ledeBox = null;
  function placeLedeFrame() {
    if (!ledeBox) return;
    ndcToWorld.set(ledeBox.cx, ledeBox.cy, 0.5).unproject(camera).sub(camera.position).normalize();
    ledeFrame.position.copy(camera.position).addScaledVector(ndcToWorld, ledeBox.D);
    ledeFrame.quaternion.copy(camera.quaternion); ledeFrame.rotateX(-ledeBox.tilt);
    ledeFrame.updateMatrixWorld();
    if (flapMat) flapMat.uniforms.uFrame.value.copy(ledeFrame.matrixWorld);
  }
  function fitLede() {
    if (!ledeTokens) return;
    const bw = sceneEl.clientWidth, bh = sceneEl.clientHeight, o = offsetIn(lede);
    let r;
    if (o) r = { left: o.x, top: o.y, width: lede.offsetWidth, height: lede.offsetHeight };
    else { const a = lede.getBoundingClientRect(), b = sceneEl.getBoundingClientRect(); r = { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height }; }
    if (!r.width || !bw) return;
    const D = 6.2, TILT = photo ? 0 : 0.13;             // у фото опис — рівний, як звичайний текст (без нахилу площини)
    const vh = 2 * D * Math.tan(camera.fov * Math.PI / 360);
    const ww = vh * camera.aspect * (r.width / bw);
    if (ww < 0.05) return;
    ledeBox = { cx: ((r.left + r.width / 2) / bw) * 2 - 1, cy: -(((r.top + r.height / 2) / bh) * 2 - 1), D, tilt: TILT };
    placeLedeFrame();
    const cs = getComputedStyle(lede);
    placeLetters(ww, parseFloat(cs.fontSize) || 18, r.width, r.height, parseFloat(cs.lineHeight) || 0);
  }

  /* «ще не відкрита» — окрема мітка: час старту буває відʼємним (після перезавантаження табло ставимо вже складеним) */
  const UNSET = -1e6;
  let letterAtl = null, flaps = null, flapMat = null;
  let order = null, launch = null, autoStart = null, nAuto = 0, lastStart = -1e9;
  const rnd2 = seeded(77);
  /* ТАБЛО для всього опису. Кожна літера — три шматки: верхня половина нового знака (відкривається позаду),
     нижня половина старого (закривається згори) і сама пластинка на петлі посередині, що падає вниз: поки не
     пройшла ребром — на ній верх старого знака, після — низ нового. Змішування адитивне, тож перекриття робимо
     не глибиною, а відсіканням: що вже закрила пластинка, того не малюємо. Перше речення запускається саме за
     розкладом від кінця вступу, решту відкриває скрол. */
  function buildFlaps() {
    if (!ledeTokens || flaps) return;
    letterAtl = letterAtlas();
    const fg = new THREE.InstancedBufferGeometry();
    const pos = [], part = [], idx = [];
    const piece = (y0, y1, id) => {
      const b = pos.length / 3;
      pos.push(-0.5, y0, 0, 0.5, y0, 0, 0.5, y1, 0, -0.5, y1, 0);
      part.push(id, id, id, id);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    piece(0, 0.5, 0); piece(-0.5, 0, 1); piece(0, 0.5, 2);
    fg.setIndex(idx);
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    const F = CFG.flap;
    flapMat = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: letterAtl.tex }, uGrid: { value: new THREE.Vector2(letterAtl.cols, letterAtl.rows) }, uCount: { value: letterAtl.count },
        uFrame: { value: new THREE.Matrix4() }, uTime: { value: 0 },
        uTint: { value: new THREE.Color(0xcfe0ff) }, uOpacity: { value: 0.86 },
      },
      vertexShader: `attribute float aPart; attribute vec3 aTo; attribute float aIdx; attribute float aSize; attribute float aSeed; attribute float aLaunch; attribute float aHalf; attribute float aRow;
        uniform mat4 uFrame; uniform vec2 uGrid; uniform float uCount; uniform float uTime;
        varying vec2 vLocal; varying float vPart; varying float vCos; varying vec2 vCur; varying vec2 vNext; varying float vCurOn;
        varying float vCard; varying float vHalf; varying float vRow; varying float vShade;
        const float FLIPS = ${F.flips.toFixed(1)}; const float DUR = ${F.dur.toFixed(3)};
        float hash(float n){ return fract(sin(n) * 43758.5453); }
        vec2 cellOf(float gi){ return vec2(mod(gi, uGrid.x), floor(gi / uGrid.x)); }
        /* знак на j-му перекиданні: спершу випадкові, на останньому — свій */
        float glyphAt(float j){ return j >= FLIPS - 1.0 ? aIdx : floor(hash(aSeed * 91.7 + j * 17.3) * uCount); }
        void main(){
          if (aLaunch < -1e5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // ще не відкрита
          float s = (uTime - aLaunch) / DUR;                     // скільки перекидань минуло
          if (s <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }        // чекає своєї черги
          float k = min(floor(s), FLIPS - 1.0);
          float f = s >= FLIPS ? 1.0 : fract(s);
          float th = 3.14159265 * f * f;                         // пластинка падає з прискоренням, як справжня
          float c = cos(th);
          vCos = c; vPart = aPart; vHalf = aHalf; vRow = aRow;
          vCur = cellOf(k < 0.5 ? 0.0 : glyphAt(k - 1.0)); vCurOn = k < 0.5 ? 0.0 : 1.0;   // до першого перекидання пластинка порожня
          vNext = cellOf(glyphAt(k));
          vCard = 0.085 * (1.0 - smoothstep(FLIPS, FLIPS + 2.0, s));   // сама пластинка ледь світиться, поки табло працює
          vec3 p = position;
          vLocal = p.xy;
          vShade = 1.0;
          if (aPart > 1.5) { p = vec3(p.x, p.y * c, p.y * sin(th)); vShade = 0.45 + 0.55 * abs(c); }   // пластинка на петлі посередині
          gl_Position = projectionMatrix * viewMatrix * (uFrame * vec4(aTo + p * aSize, 1.0));
        }`,
      fragmentShader: `uniform sampler2D uAtlas; uniform vec2 uGrid; uniform vec3 uTint; uniform float uOpacity; uniform float uTime;
        varying vec2 vLocal; varying float vPart; varying float vCos; varying vec2 vCur; varying vec2 vNext; varying float vCurOn;
        varying float vCard; varying float vHalf; varying float vRow; varying float vShade;
        void main(){
          float y = vLocal.y, up;
          vec2 cell; float on = 1.0;
          if (vPart < 0.5) {                                       // верх нового знака, відкривається за пластинкою
            if (vCos > 0.0 && y < 0.5 * vCos) discard;
            cell = vNext; up = 0.5 + y;
          } else if (vPart < 1.5) {                                // низ старого знака, пластинка закриває його згори
            if (vCos < 0.0 && y > 0.5 * vCos) discard;
            cell = vCur; on = vCurOn; up = 0.5 + y;
          } else if (vCos >= 0.0) { cell = vCur; on = vCurOn; up = 0.5 + y; }   // пластинка лицем: верх старого
          else { cell = vNext; up = 0.5 - y; }                                  // зворотом: низ нового
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
    flaps.frustumCulled = false; flaps.renderOrder = -1; flaps.visible = false;
    scene.add(flaps);
  }
  /* розкласти табло по рамі опису: перше речення — за розкладом після вступу, решта — від скролу */
  function placeLetters(ww, fsCss, rw, rh, lhCss) {
    buildFlaps();
    if (!flaps) return;
    const lay = ledeLayout(letterAtl, fsCss, rw, lhCss);
    const n = lay.letters.length, scale = ww / rw, na = Math.min(autoLetters, n), m = n - na;
    const cellW = (LCELL / LFS) * fsCss * scale;
    const to = new Float32Array(n * 3), idxA = new Float32Array(n), sz = new Float32Array(n), sd = new Float32Array(n), half = new Float32Array(n), rowv = new Float32Array(n);
    /* перерахунок розкладки (довантажився шрифт, змінився розмір вікна) не скидає вже відкрите табло */
    const prev = launch;
    order = new Float32Array(n); autoStart = new Float32Array(n); nAuto = na;
    launch = new Float32Array(n).fill(UNSET);
    if (prev && prev.length === n) launch.set(prev);
    lay.letters.forEach((L, i) => {
      to[i * 3] = (L.cx - rw / 2) * scale; to[i * 3 + 1] = (rh / 2 - L.cy) * scale; to[i * 3 + 2] = 0.004;
      idxA[i] = letterAtl.index[L.k]; sz[i] = cellW; sd[i] = rnd2();
      half[i] = L.adv * LFS / LCELL * 0.5 - 0.025;             // пластинка завширшки як сам знак, з тонкою щілиною до сусідньої
      rowv[i] = L.cy / rh;
      if (i < na) { order[i] = 2; autoStart[i] = flapStart(i, na, rnd2()); }
      else order[i] = restOrder(i - na, m, rnd2());
    });
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

  function fit() {
    w = Math.max(1, sceneEl.clientWidth); h = Math.max(1, sceneEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    grainMat.uniforms.uPR.value = renderer.getPixelRatio();
    composeCamera();
    /* раму опису й заголовок рахуємо з базового положення камери */
    placeTitle();
    fitLede();
  }
  function setBaseCamera() {
    camera.position.set(target.x + d0 * Math.cos(el0) * Math.sin(az0), target.y + d0 * Math.sin(el0), target.z + d0 * Math.cos(el0) * Math.cos(az0));
    camera.lookAt(target); camera.updateMatrixWorld();
  }
  /* Фігура привʼязана до розкладки тексту, а не до вікна: її центр — на рівні середини текстового блоку
     (від бейджа до кнопок), а по горизонталі — посередині вільного місця праворуч від колонки тексту в тому
     самому контейнері сторінки. Інакше на широкому екрані текст і фігура розʼїжджались. Камеру просто
     зсуваємо паралельно площині кадру: перспектива, світло й тіні не змінюються. */
  const camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
  let figScale = 1, figRadiusPx = 0, kickAt = -99;
  /* прямокутник, який фото займає на екрані (у пікселях сцени, без паралаксу) */
  function photoRect() {
    const cw = photoEl.offsetWidth, ch = photoEl.offsetHeight;
    const k = Math.max(cw / PHOTO.w, ch / PHOTO.h), dw = PHOTO.w * k, dh = PHOTO.h * k;
    return { x: photoEl.offsetLeft + (cw - dw) * PHOTO.pos[0], y: photoEl.offsetTop + (ch - dh) * PHOTO.pos[1], w: dw, h: dh };
  }
  function composeCamera() {
    target.copy(targetBase);
    setBaseCamera();
    const column = lede && lede.offsetParent, container = column && column.parentElement;
    const badge = section && section.querySelector('.vault-rise'), buttons = lede && lede.nextElementSibling;
    const oc = column && offsetIn(column), ok = container && offsetIn(container), ob = badge && offsetIn(badge), obt = buttons && offsetIn(buttons);
    if (!oc || !ok || !ob || !obt) return;
    const W = sceneEl.clientWidth, Hh = sceneEl.clientHeight;
    const freeL = oc.x + column.offsetWidth, freeR = ok.x + container.offsetWidth;
    const c = tmpA.copy(cPos).project(camera), xc = c.x, yc = c.y;
    camRight.setFromMatrixColumn(camera.matrixWorld, 0); camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const rPx = (tmpB.copy(cPos).addScaledVector(camRight, R * 1.12).project(camera).x - xc) / 2 * W;   // півширина фігури на екрані
    let xPx = (freeL + freeR) / 2, yPx = (ob.y + obt.y + buttons.offsetHeight) / 2, rNow = rPx;
    if (photo && photoEl) {
      /* фігура стоїть над стільницею на фото: точка й розмір — у частках показаного кадру (background: cover) */
      const P = photoRect();
      xPx = P.x + PHOTO.fig[0] * P.w; yPx = P.y + PHOTO.fig[1] * P.h;
      figScale = (PHOTO.figR * P.h) / Math.max(1, rPx);
      rNow = rPx * figScale;
      figRadiusPx = PHOTO.figR * P.h;
    }
    xPx = Math.min(Math.max(xPx, freeL + rNow + 70), W - rNow - 24);   // не ближче 70 px до тексту і не за край екрана
    const xd = (xPx / W) * 2 - 1, yd = -((yPx / Hh) * 2 - 1);
    const z = -tmpC.copy(cPos).applyMatrix4(camera.matrixWorldInverse).z;   // глибина фігури від камери
    const tanH = Math.tan(camera.fov * Math.PI / 360);
    target.addScaledVector(camRight, (xc - xd) * z * tanH * camera.aspect).addScaledVector(camUp, (yc - yd) * z * tanH);
    setBaseCamera();
    outer.scale.setScalar(figScale);
    if (glowEl) {
      /* відблиск на стільниці: під фігурою, на висоті столу на фото; розмір — від висоти кадру */
      const P = photoRect();
      glowBase.w = P.h * 0.62; glowBase.h = P.h * 0.13; glowBase.y = P.y + PHOTO.desk * P.h;
      glowEl.style.width = glowBase.w + 'px'; glowEl.style.height = glowBase.h + 'px';
    }
  }
  const glowBase = { w: 0, h: 0, y: 0 };
  const smoothRamp = (x) => { const k = clamp01((x - 0.15) / 0.85); return k * k * (3 - 2 * k); };
  /* Поки опису ще немає, заголовок стоїть на рівні центра фігури — без порожнечі під ним. Щойно фігура
     повністю зʼявилась, він плавно відʼїжджає вгору на своє місце (перехід — у CSS, клас vault-risen),
     і лише тоді табло виводить перше речення. */
  let risen = false;
  function placeTitle() {
    if (!html.classList.contains('vault-holo')) return;
    /* до цієї миті заголовок невидимий (CSS): зʼявляється одразу на своєму місці, без руху вниз;
       клас ставимо в будь-якому разі — навіть якщо виміряти не вдалося, заголовок не має лишитись схованим */
    html.classList.add('vault-placed');
    const o = titleEl && offsetIn(titleEl);
    if (!o) return;
    tmpA.copy(cPos).project(camera);
    const figY = (1 - tmpA.y) / 2 * sceneEl.clientHeight;
    html.style.setProperty('--vault-drop', Math.max(0, Math.round(figY - (o.y + titleEl.offsetHeight / 2))) + 'px');
    html.style.setProperty('--vault-rise-dur', CFG.titleRise + 's');
  }
  function rise(now) {
    if (risen) return;
    risen = true;
    if (now) { html.classList.add('vault-instant'); setTimeout(() => html.classList.remove('vault-instant'), 80); }
    html.classList.add('vault-risen');
  }
  /* Після перезавантаження браузер повертає сторінку туди, де її лишили. Тоді нічого не програється саме:
     фігура вже зібрана, заголовок на місці, літери, які відкрив би цей скрол, уже стоять, табло складене. */
  let userInput = false, instantLand = false;
  for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(ev, () => { userInput = true; }, { passive: true });
  function enterInstant() {
    introMs = INTRO_MS; restSec = 99;
    pTarget = pSmooth = progress(); pText = latch;
    instantLand = true;
    rise(true);
  }
  /* hero липкий на час прокрутки доріжки */
  /* Історія програється ОДИН РАЗ: досягнутий стан замикається, назад нічого не відмотується — інакше
     при русі вгору сцена переграє все у зворотному напрямку й скрол відчувається вʼязким. */
  /* У фото-варіанті фігура й голограма йдуть за скролом в ОБИДВА боки: скрол назад відкручує їх до початкового
     стану (прохання власника). Опис при цьому лишається — для нього прогрес так само замикається (pText). */
  let latch = 0, collapsed = false, pText = 0;
  function progress() {
    if (dbgP != null) return dbgP;
    if (collapsed) return 1;
    const span = track ? Math.max(1, track.offsetHeight - window.innerHeight) : window.innerHeight;
    const live = clamp01(window.scrollY / span);
    latch = Math.max(latch, live);
    return photo ? live : latch;
  }
  /* Коли опис складений і людина вже нижче липкої ділянки, сама ділянка більше не потрібна: прибираємо її
     й на стільки ж підтягуємо прокрутку — кадр не рухається, зате назад сторінка йде вільно. */
  function collapseTrack() {
    if (photo || collapsed || !track || !hero || dbgP != null || !lettersDone()) return;   // у фото липка ділянка лишається: назад по ній сцена відкручується
    const extra = track.offsetHeight - hero.offsetHeight;
    if (extra <= 0 || window.scrollY < extra + 4) return;
    collapsed = true; latch = 1;
    track.style.height = hero.offsetHeight + 'px';
    lastY = window.scrollY - extra;
    jumpTo(window.scrollY - extra);
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
  const camPos = new THREE.Vector3(), lookPt = new THREE.Vector3();
  const rotAround = (v, c, a) => { const x = v.x - c.x, z = v.z - c.z, cs = Math.cos(a), sn = Math.sin(a); v.x = c.x + x * cs + z * sn; v.z = c.z - x * sn + z * cs; return v; };
  function apply(fF, fS, tt) {
    /* фігура — як на /preview/3d-v6/, тільки каркас не розсувається */
    if (!photo) joints.forEach((j, i) => j.m.scale.setScalar(Math.max(0.001, fF.joints[i])));
    outerBeams.forEach((b, i) => placeBeam(b.m, VO[b.i], VO[b.j], fF.outer[i]));
    const kick = photo ? kickFrame(tt - kickAt) : { turn: 0, boost: 0 };   // клік по фігурі — ядро робить повний оберт
    const swivel = fF.swivel + kick.turn;
    innerGrp.rotation.y = swivel;
    innerLines.forEach((L, i) => {
      const d = fF.inner[i];
      let a = L.a, b = L.b;
      if (L.spoke >= 0) { a = VO[L.spoke]; b = tmpT.copy(VI[L.spoke]).applyAxisAngle(UP, swivel); }   // спиця тягнеться за ґраткою
      placeBeam(L.bar, a, b, d); placeBeam(L.strip, a, b, d); placeBeam(L.glow, a, b, d);
      const wv = 0.5 + 0.5 * Math.sin(L.k - tt * (0.5 + 1.1 * fF.pulseSpeed));
      const br = Math.min(1.25, fF.light * (0.45 + 0.55 * (1 - fF.wave + fF.wave * wv)) * (1 + 0.9 * kick.boost));
      L.lightMat.color.copy(LIGHT).multiplyScalar(0.2 + 1.35 * br);
      L.glow.material.opacity = 0.03 + 0.16 * br;
    });
    spin.rotation.y = angle + fF.spin + mx * 0.06;
    outer.rotation.x = 0.22 + my * 0.03;
    outer.position.y = cPos.y + Math.sin(tt * 0.6) * 0.03;
    grainMat.uniforms.uOrigin.value.copy(outer.position);
    /* камера: обліт від скролу + паралакс від миші */
    const az = az0 + (photo ? 0 : fS.orbit) + mx * (photo ? 0.06 : 0.14), el = el0 + (photo ? 0 : fS.elev) + my * (photo ? 0.03 : 0.07);
    camPos.set(target.x + d0 * Math.cos(el) * Math.sin(az), target.y + d0 * Math.sin(el), target.z + d0 * Math.cos(el) * Math.cos(az));
    if (photo) {
      /* На фото фігура мусить стояти над своїм місцем на столі, тож обліт робимо навколо НЕЇ: уся «установка»
         камери обертається довкола вертикалі через центр фігури. Фігура лишається в тій самій точці кадру, ми
         бачимо її з інших боків, а голограма й пил за нею пливуть — глибина проти нерухомого фото. */
      const ang = fS.orbit;
      rotAround(camPos, cPos, ang); rotAround(lookPt.copy(target), cPos, ang);
      camera.position.copy(camPos); camera.lookAt(lookPt);
    } else { camera.position.copy(camPos); camera.lookAt(target); }
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    if (photo) applyDance();
    placeLedeFrame();
    /* поле формул: у спокої тліє тьмяним сірим, від скролу розгоряється до яскравого */
    const rest = introRelease(restSec);
    figRay.origin.copy(camera.position); figRay.direction.copy(outer.position).sub(camera.position).normalize();
    if (!figRay.intersectPlane(wallPlane, wallOrigin)) wallOrigin.copy(wallC);
    let far = 0;
    for (const c of wallCorners) far = Math.max(far, c.distanceTo(wallOrigin));
    wallMat.uniforms.uRadius.value = Math.max(fS.coverage, rest.cover) * far;
    wallMat.uniforms.uOpacity.value = Math.max(fS.fade, rest.wall) * (photo ? 0.66 : 1);   // на фото голограма — дальший план, трохи тихіша
    wallMat.uniforms.uTint.value.copy(TINT_REST).lerp(TINT_LIT, fS.fade);
    wallMat.uniforms.uTime.value = tt; wallMat.uniforms.uSpot.value.copy(spot);
    wall.visible = wallMat.uniforms.uOpacity.value > 0.002;
    if (flaps) {
      let touched = false, any = false;
      const m = launch.length - nAuto;
      for (let i = 0; i < launch.length; i++) {
        if (i < nAuto) {
          /* перше речення: табло за розкладом від кінця вступу (restSec уже враховує ?age і перезавантаження) */
          if (launch[i] === UNSET && fS.after) { launch[i] = tt - restSec + autoStart[i]; touched = true; }
        } else if (launch[i] === UNSET && textFade >= order[i]) {
          /* решта: скрол відпускає літеру; відпущені разом стають у чергу — табло однаково біжить хвилею */
          lastStart = instantLand ? tt - 10 : queueLaunch(tt - AGE, lastStart, m);
          launch[i] = lastStart; touched = true;
        } else if (launch[i] !== UNSET && textFade < order[i] - 0.03) { launch[i] = UNSET; touched = true; }   // скрол назад — табло гасне (у фото — ні: опис лишається)
        if (launch[i] !== UNSET) any = true;
      }
      if (touched) flaps.geometry.attributes.aLaunch.needsUpdate = true;
      flaps.visible = any;
      flapMat.uniforms.uTime.value = tt;
      instantLand = false;
    }
    dustMat.uniforms.uTime.value = tt; nebMat.uniforms.uTime.value = tt;
    grainMat.uniforms.uTime.value = tt; grainMat.uniforms.uSpread.value = fS.grains;
    grainMat.uniforms.uReach.value = fS.grains * far; grains.visible = fS.grains > 0.001;
    if (glowEl) {
      /* відблиск іде за фігурою (паралакс миші теж) і дихає разом із її світлом */
      tmpA.copy(outer.position).project(camera);
      const gx = (tmpA.x + 1) / 2 * sceneEl.clientWidth, px = -mx * 10, py = -my * 6;
      glowEl.style.transform = `translate3d(${(gx - glowBase.w / 2 + px * 0.4).toFixed(1)}px, ${(glowBase.y - glowBase.h / 2 + py).toFixed(1)}px, 0)`;
      /* наростає впродовж усієї появи фігури разом зі світлом ліній і ще мʼяко згладжується в часі — без стрибків */
      const want = smoothRamp(introNow) * (0.35 + 0.65 * fF.light) * (0.92 + 0.08 * Math.sin(tt * 1.4));
      glowCur += (want - glowCur) * 0.06;
      glowEl.style.opacity = glowCur.toFixed(3);
      photoEl.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
    }
  }
  const frames = (p, introT) => {
    introNow = introT;
    const fS = sceneFrame(p, introT);
    textFade = photo ? sceneFrame(dbgP != null ? p : pText, introT).fade : fS.fade;
    return [figureFrame(figureProgress(p), introT, COUNTS, photo ? FIG_DANCE : FIG), fS];
  };
  let textFade = 0;
  let introNow = 0, glowCur = 0;
  function render(fF, fS) { apply(fF, fS, t); renderer.render(scene, camera); }

  fit();
  if (reduced) {
    html.classList.remove('vault-holo');
    const pp = dbgP != null ? dbgP : 0.95;
    const one = () => render(...frames(pp, 1));
    one();
    fontsReady.then(one);
    new ResizeObserver(() => { fit(); one(); }).observe(sceneEl);
    return;
  }
  if (dbgP == null && window.scrollY > 40) enterInstant();

  function tick(now) {
    running = false;
    const dt = Math.min(last ? now - last : 16, 50); last = now;
    t += dt / 1000;
    if (dbgIntro == null) introMs += dt;
    const introT = dbgIntro != null ? dbgIntro : clamp01(introMs / INTRO_MS);
    restSec = introT >= 1 ? restSec + dt / 1000 : AGE;
    /* браузер міг повернути прокрутку трохи пізніше за старт сцени — ловимо це в перші миті, якщо людина ще нічого не торкалась */
    if (!instantLand && !userInput && dbgP == null && t < 0.8 && introT < 1 && window.scrollY > 40) enterInstant();
    if (!risen && introT >= 1) rise(dbgIntro != null);   // фігура повністю зʼявилась — заголовок звільняє місце опису
    pTarget = progress();
    pSmooth += (pTarget - pSmooth) * 0.16;
    pText += (latch - pText) * 0.16;
    mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08;
    spot.lerp(tspot, 0.12);
    stepGrid(Math.min(dt / 1000, 0.05));
    angle += dt / 1000 * (0.1 + 0.08 * pSmooth);                         // обертання: повільне у спокої, трохи швидше зі скролом
    if (still) { pSmooth = pTarget; pText = latch; render(...frames(pSmooth, introT)); return; }
    render(...frames(pSmooth, introT));
    if (visible && !document.hidden) schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(tick); } }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { last = 0; schedule(); } }, { threshold: 0.02 }).observe(sceneEl);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { last = 0; schedule(); } });
  new ResizeObserver(() => { fit(); schedule(); }).observe(sceneEl);
  /* Швидкий скрол не проскакує опис: сторінка не йде нижче точки, де скрол відпустив останню літеру, доки всі
     літери не долетять і не сядуть. Hero весь цей час прилиплий, тож кадр не стрибає. Лише на спуску. */
  let lastY = window.scrollY;
  function lettersDone() {
    if (!launch) return true;
    let end = -Infinity;
    for (let i = nAuto; i < launch.length; i++) {
      if (launch[i] === UNSET) return false;
      end = Math.max(end, launch[i]);
    }
    return t >= end + CFG.flap.flips * CFG.flap.dur;
  }
  function holdForLetters() {
    const y = window.scrollY, down = y > lastY;
    lastY = y;
    if (!flaps || dbgP != null || !down || lettersDone()) return;
    const gateY = Math.round(CFG.fade[1] * Math.max(1, (track ? track.offsetHeight : 0) - window.innerHeight));
    if (y > gateY + 2) { jumpTo(gateY); lastY = gateY; }
  }
  /* на <html> стоїть scroll-smooth: звичайний scrollTo поїхав би плавно, а треба зупинити скрол на місці */
  function jumpTo(y) {
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    html.style.scrollBehavior = prev;
  }
  window.addEventListener('scroll', () => { holdForLetters(); collapseTrack(); schedule(); }, { passive: true });
  const hero = sceneEl.closest('section') || sceneEl;
  if (fine) {
    hero.addEventListener('pointermove', (ev) => {
      const r = hero.getBoundingClientRect();
      tmx = clamp01((ev.clientX - r.left) / r.width) * 2 - 1;
      tmy = clamp01((ev.clientY - Math.max(r.top, 0)) / Math.min(r.height, window.innerHeight)) * 2 - 1;
      /* точка на полі формул під курсором — рядки поруч яскравішають */
      const cr = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - cr.left) / cr.width) * 2 - 1, -((ev.clientY - cr.top) / cr.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(wallPlane, tspot)) tspot.set(0, -50, 0);
      if (photo) sceneEl.style.cursor = overFigure(ev) ? 'pointer' : '';      // над фігурою — «рука»: її можна клацнути
      schedule();
    });
    hero.addEventListener('pointerleave', () => { tmx = 0; tmy = 0; tspot.set(0, -50, 0); schedule(); });
    /* клік по фігурі — ядро робить повний оберт (якщо попередній ще не скінчився, чекаємо на нього) */
    if (photo) canvas.addEventListener('click', (ev) => {
      if (!overFigure(ev) || introMs < INTRO_MS || t - kickAt < 1.6) return;
      kickAt = t; schedule();
    });
  }
  /* чи вказівник над фігурою: відстань до її центру на екрані менша за її екранний радіус */
  function overFigure(ev) {
    const cr = canvas.getBoundingClientRect();
    tmpD.copy(outer.position).project(camera);
    const x = cr.left + (tmpD.x + 1) / 2 * cr.width, y = cr.top + (1 - tmpD.y) / 2 * cr.height;
    return Math.hypot(ev.clientX - x, ev.clientY - y) < figRadiusPx * 1.05;
  }
  schedule();

  /* ---------- геометрія (як на /preview/3d-v6/) ---------- */
  function cubocta() {
    const P = [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]];
    const V = P.map((p) => new THREE.Vector3(p[0], p[1], p[2]).multiplyScalar(Math.SQRT1_2));
    const E = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.abs(V[i].distanceToSquared(V[j]) - 1) < 1e-6) E.push([i, j]);
    return { V, E };
  }
  /* брус квадратного перерізу вздовж a→b; одна грань дивиться назовні від центра; off — зсув уздовж цієї нормалі */
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
  function blankTexture() { const c = document.createElement('canvas'); c.width = c.height = 4; return new THREE.CanvasTexture(c); }
  function blankData() { const d = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); d.needsUpdate = true; return d; }
  /* атлас знаків поля формул + маленькі графіки */
  function glyphAtlas(cell) {
    const set = [' '];
    for (const line of CORPUS) for (const ch of line) if (!set.includes(ch)) set.push(ch);
    const kinds = ['bars', 'rise', 'drop', 'funnel', 'donut'];
    const cols = 16, total = set.length + kinds.length, rows = Math.ceil(total / cols);
    const c = document.createElement('canvas'); c.width = cols * cell; c.height = rows * cell;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineJoin = 'round'; g.lineCap = 'round';
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const fsm = Math.round(cell * 0.74);
    g.font = `500 ${fsm}px Inter, sans-serif`;
    const slotW = WW / COLS, fsWorld = (H / ROWS) * 0.74;
    const ratio = {}, slots = {};
    for (const ch of set) { const wd = g.measureText(ch).width / fsm; ratio[ch] = wd; slots[ch] = Math.max(1, Math.round(wd * fsWorld / slotW)); }
    const at = (i) => [(i % cols) * cell, Math.floor(i / cols) * cell];
    set.forEach((ch, i) => {
      if (ch === ' ') return;
      const [x, y] = at(i), wd = ratio[ch] * fsm;
      g.save(); g.translate(x + cell * 0.04, y + cell * 0.76); g.scale((cell * 0.92) / wd, 1);
      g.fillText(ch, 0, 0); g.restore();
    });
    const r = seeded(5), charts = [];
    kinds.forEach((kind, k) => {
      const gi = set.length + k, [x, y] = at(gi);
      drawGlyphChart(g, kind, x, y, cell, cell, r);
      charts.push({ gi, k: Math.max(2, Math.round((H / ROWS) * 2 / slotW)) });
    });
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const index = {}; set.forEach((ch, i) => { index[ch] = i; });
    return { tex, cols, rows, index, letters: set.length, charts, slotsOf: (ch) => slots[ch] || slots[' '] };
  }
  function drawGlyphChart(g, kind, x, y, cw0, h, r) {
    const pad = h * 0.22, top = y + pad, ch = h - pad * 2, cw = cw0 - pad * 2, ox = x + pad;
    g.lineWidth = Math.max(1.5, h * 0.075);
    if (kind === 'bars') {
      const n = 5, bw = cw / (n * 1.6);
      for (let i = 0; i < n; i++) { const bh = ch * (0.24 + 0.76 * (i / (n - 1))); g.fillRect(ox + i * bw * 1.6, top + ch - bh, bw, bh); }
    } else if (kind === 'rise' || kind === 'drop') {
      const n = 6; g.beginPath();
      for (let i = 0; i < n; i++) {
        const tt = i / (n - 1), v = (kind === 'rise' ? tt : 1 - tt) * 0.8 + 0.1 * r();
        const py = top + ch - Math.min(ch, ch * (0.1 + 0.85 * v));
        i ? g.lineTo(ox + tt * cw, py) : g.moveTo(ox, py);
      }
      g.stroke();
    } else if (kind === 'funnel') {
      for (let i = 0; i < 3; i++) { const fw = cw * (1 - i * 0.3), fh = ch * 0.22; g.fillRect(ox + (cw - fw) / 2, top + i * ch * 0.39, fw, fh); }
    } else {
      const rad = ch * 0.46, cx = ox + cw / 2, cy = top + ch / 2;
      g.globalAlpha = 0.4; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1; g.beginPath(); g.arc(cx, cy, rad, -Math.PI / 2, Math.PI * 0.75); g.stroke();
    }
  }
  function seeded(seed) { let s = seed * 7919 + 13; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
}
