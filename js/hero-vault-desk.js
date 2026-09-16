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
 * тексту прибита до кадру, тож камера може облітати фігуру. Перше речення
 * щойно фігура зібралась проявляється САМЕ — ефектом табло: кожна літера
 * кілька разів перекидає пластинку й зупиняється на своєму знаку. Решту
 * абзацу відпускає скрол: літери вилітають з ядра й сідають на місця, далі
 * летять за власним часом.
 *
 * ПОЛЕ ФОРМУЛ за фігурою: після вступу ледь тліє, а щойно починається скрол і
 * з ядра вирушають вогники — стає яскравим.
 *
 * Для знімків: ?p=0.5 — прогрес скролу, ?intro=1 — вступ завершено,
 * ?still=1 — один кадр, ?age=3 — стільки секунд «уже минуло» після вступу.
 */
import * as THREE from 'three';
import { figureFrame, figureProgress, getFrame as sceneFrame, introRelease, flapStart, clamp01, CFG } from './hero-vault-desk-frame.js';

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

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { sceneEl.classList.add('vault-nogl'); return; }
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
  const target = new THREE.Vector3(3.1, cPos.y + 0.6, 0);     // центр фігури — на рівні середини опису
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
  const fillB = new THREE.PointLight(0x60a5fa, 3, 16, 2); fillB.position.set(cPos.x - 5, 2.5, cPos.z + 4); scene.add(fillB);
  scene.add(new THREE.HemisphereLight(0x3a4a70, 0x05070d, 0.65));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cPos.x, 0, cPos.z); floor.receiveShadow = true; scene.add(floor);

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

  /* ---------- поле формул: невидима похила площина збоку за фігурою ---------- */
  const H = 7.5, WW = 19;
  const wallC = new THREE.Vector3(9.3, H / 2, -1.8);
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
    if (letters) {
      const old = letterAtl.tex;
      letterAtl = letterAtlas();
      letterMat.uniforms.uAtlas.value = letterAtl.tex; flapMat.uniforms.uAtlas.value = letterAtl.tex;
      flapMat.uniforms.uCount.value = letterAtl.count;
      old.dispose();
    }
    fitLede();
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

  /* ---------- стан ---------- */
  let w = 1, h = 1;
  let introMs = -300, last = 0, t = 0, angle = 0.4;
  let restSec = AGE;                      // секунд від кінця вступу
  let pTarget = 0, pSmooth = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  let visible = false, running = false;
  const spot = new THREE.Vector3(0, -50, 0), tspot = new THREE.Vector3(0, -50, 0);
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const track = document.getElementById('vault-track');
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
    if (letterMat) letterMat.uniforms.uFrame.value.copy(ledeFrame.matrixWorld);
    if (flapMat) flapMat.uniforms.uFrame.value.copy(ledeFrame.matrixWorld);
  }
  function fitLede() {
    if (!ledeTokens) return;
    const r = lede.getBoundingClientRect(), b = sceneEl.getBoundingClientRect();
    if (!r.width || !b.width) return;
    const D = 6.2, TILT = 0.13;
    const vh = 2 * D * Math.tan(camera.fov * Math.PI / 360);
    const ww = vh * camera.aspect * (r.width / b.width);
    if (ww < 0.05) return;
    ledeBox = { cx: ((r.left + r.width / 2 - b.left) / b.width) * 2 - 1, cy: -(((r.top + r.height / 2 - b.top) / b.height) * 2 - 1), D, tilt: TILT };
    placeLedeFrame();
    const cs = getComputedStyle(lede);
    placeLetters(ww, parseFloat(cs.fontSize) || 18, r.width, r.height, parseFloat(cs.lineHeight) || 0);
  }

  let letterAtl = null, letters = null, letterMat = null, letterOrder = null, letterLaunch = null;
  let flaps = null, flapMat = null;
  const rnd2 = seeded(77);
  function buildLetters() {
    if (!ledeTokens || letters) return;
    letterAtl = letterAtlas();
    /* літери, що вилітають з ядра (решта абзацу, від скролу) */
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);          // не «q» — так звався б обʼєкт параметрів URL
    geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
    letterMat = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: letterAtl.tex }, uGrid: { value: new THREE.Vector2(letterAtl.cols, letterAtl.rows) },
        uOrigin: { value: new THREE.Vector3() }, uFrame: { value: new THREE.Matrix4() },
        uTint: { value: new THREE.Color(0xcfe0ff) }, uTime: { value: 0 }, uOpacity: { value: 0.86 }, uAge: { value: AGE },
      },
      vertexShader: `attribute vec3 aTo; attribute vec2 aGlyph; attribute float aSize; attribute float aLaunch; attribute float aSeed; attribute float aRow;
        uniform vec3 uOrigin; uniform mat4 uFrame; uniform vec2 uGrid; uniform float uTime; uniform float uAge;
        varying vec2 vUv; varying float vFly; varying float vRow;
        void main(){
          /* скрол лише ВИПУСКАЄ літеру; далі вона летить за власним часом */
          if (aLaunch < 0.0) { vFly = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          vec3 uRight = uFrame[0].xyz, uUp = uFrame[1].xyz;
          vec3 aToW = (uFrame * vec4(aTo, 1.0)).xyz;
          float delay = fract(aSeed * 3.7) * 0.85;
          float dur = 1.05 + fract(aSeed * 11.0) * 0.75;
          float t = clamp((uTime + uAge - aLaunch - delay) / dur, 0.0, 1.0);
          float e = t * t * (3.0 - 2.0 * t);
          vFly = e; vRow = aRow;
          vec3 from = uOrigin + vec3(sin(aSeed * 51.0), cos(aSeed * 37.0), sin(aSeed * 23.0)) * 0.14;
          vec3 ctrl = mix(from, aToW, 0.45) + uRight * (sin(aSeed * 61.0) * 1.15) + uUp * (0.25 + fract(aSeed * 17.0) * 0.7);
          vec3 mid = mix(mix(from, ctrl, e), mix(ctrl, aToW, e), e);
          float st = clamp((t - 0.72) / 0.28, 0.0, 1.0);
          mid += (uRight * sin(aSeed * 91.0) + uUp * cos(aSeed * 73.0)) * sin(st * 12.0) * (1.0 - st) * (1.0 - st) * 0.035;
          float sz = aSize * mix(0.42, 1.0, e);
          float sp = sin(aSeed * 29.0) * (1.0 - e) * 3.4;
          vec2 rp = vec2(position.x * cos(sp) - position.y * sin(sp), position.x * sin(sp) + position.y * cos(sp));
          vec3 w = mid + uRight * (rp.x * sz) + uUp * (rp.y * sz);
          vUv = (aGlyph + vec2(uv.x, 1.0 - uv.y)) / uGrid;   // атлас без flipY, а uv квада рахується знизу
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: `uniform sampler2D uAtlas; uniform vec3 uTint; uniform float uOpacity; uniform float uTime;
        varying vec2 vUv; varying float vFly; varying float vRow;
        void main(){
          float a = texture2D(uAtlas, vUv).a;
          if (a < 0.01 || vFly < 0.001) discard;
          float scan = 0.93 + 0.07 * sin(gl_FragCoord.y * 1.35);
          float glow = 1.0 + 1.5 * (1.0 - vFly);
          float land = exp(-pow((vFly - 0.9) * 11.0, 2.0)) * 1.6;
          float beam = exp(-pow((fract(uTime * 0.11) - vRow) * 7.0, 2.0)) * 0.75;
          gl_FragColor = vec4(uTint * a * uOpacity * scan * (glow + land + beam), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
        }`,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    });
    letters = new THREE.Mesh(geo, letterMat);
    letters.frustumCulled = false; letters.renderOrder = -1;
    scene.add(letters);

    /* ТАБЛО для першого речення. Кожна літера — три шматки: верхня половина нового знака (відкривається
       позаду), нижня половина старого (закривається згори) і сама пластинка на петлі посередині, що падає
       вниз: поки не пройшла ребром — на ній верх старого знака, після — низ нового. Змішування адитивне,
       тож перекриття робимо не глибиною, а відсіканням: що вже закрила пластинка, того не малюємо. */
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
        uFrame: { value: new THREE.Matrix4() }, uRest: { value: 0 }, uTime: { value: 0 },
        uTint: { value: new THREE.Color(0xcfe0ff) }, uOpacity: { value: 0.86 },
      },
      vertexShader: `attribute float aPart; attribute vec3 aTo; attribute float aIdx; attribute float aSize; attribute float aSeed; attribute float aStart; attribute float aHalf; attribute float aRow;
        uniform mat4 uFrame; uniform vec2 uGrid; uniform float uCount; uniform float uRest;
        varying vec2 vLocal; varying float vPart; varying float vCos; varying vec2 vCur; varying vec2 vNext; varying float vCurOn;
        varying float vCard; varying float vHalf; varying float vRow; varying float vShade;
        const float FLIPS = ${F.flips.toFixed(1)}; const float DUR = ${F.dur.toFixed(3)};
        float hash(float n){ return fract(sin(n) * 43758.5453); }
        vec2 cellOf(float gi){ return vec2(mod(gi, uGrid.x), floor(gi / uGrid.x)); }
        /* знак на j-му перекиданні: спершу випадкові, на останньому — свій */
        float glyphAt(float j){ return j >= FLIPS - 1.0 ? aIdx : floor(hash(aSeed * 91.7 + j * 17.3) * uCount); }
        void main(){
          float s = (uRest - aStart) / DUR;                      // скільки перекидань минуло
          if (s <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
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
    flaps.frustumCulled = false; flaps.renderOrder = -1;
    scene.add(flaps);
  }
  /* розкласти літери по рамі опису: перше речення — табло, решта — вилітає з ядра від скролу */
  function placeLetters(ww, fsCss, rw, rh, lhCss) {
    buildLetters();
    if (!letters) return;
    const lay = ledeLayout(letterAtl, fsCss, rw, lhCss);
    const n = lay.letters.length, scale = ww / rw, na = Math.min(autoLetters, n);
    const cellW = (LCELL / LFS) * fsCss * scale;
    const to = new Float32Array(n * 3), gl = new Float32Array(n * 2), sz = new Float32Array(n), or = new Float32Array(n), sd = new Float32Array(n), rowv = new Float32Array(n);
    const fTo = new Float32Array(na * 3), fIdx = new Float32Array(na), fSz = new Float32Array(na), fSeed = new Float32Array(na), fStart = new Float32Array(na), fHalf = new Float32Array(na), fRow = new Float32Array(na);
    letterOrder = or; letterLaunch = new Float32Array(n).fill(-1);
    lay.letters.forEach((L, i) => {
      const x = (L.cx - rw / 2) * scale, y = (rh / 2 - L.cy) * scale, gi = letterAtl.index[L.k];
      to[i * 3] = x; to[i * 3 + 1] = y; to[i * 3 + 2] = 0.004;
      gl[i * 2] = gi % letterAtl.cols; gl[i * 2 + 1] = Math.floor(gi / letterAtl.cols);
      sz[i] = cellW;
      /* решта абзацу: скрол відпускає літери приблизно зліва направо, але врозтіч */
      or[i] = i < na ? 2 : Math.min(0.92, ((i - na) / Math.max(1, n - na)) * 0.5 + rnd2() * 0.42);
      sd[i] = rnd2();
      rowv[i] = L.cy / rh;
      if (i < na) {
        fTo[i * 3] = x; fTo[i * 3 + 1] = y; fTo[i * 3 + 2] = 0.004;
        fIdx[i] = gi; fSz[i] = cellW; fSeed[i] = sd[i]; fRow[i] = rowv[i];
        fStart[i] = flapStart(i, na, rnd2());
        fHalf[i] = L.adv * LFS / LCELL * 0.5 - 0.025;           // пластинка завширшки як сам знак, з тонкою щілиною до сусідньої
      }
    });
    const g = letters.geometry;
    g.setAttribute('aTo', new THREE.InstancedBufferAttribute(to, 3));
    g.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(gl, 2));
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(sz, 1));
    g.setAttribute('aLaunch', new THREE.InstancedBufferAttribute(letterLaunch, 1));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1));
    g.setAttribute('aRow', new THREE.InstancedBufferAttribute(rowv, 1));
    g.instanceCount = n;
    const fg = flaps.geometry;
    fg.setAttribute('aTo', new THREE.InstancedBufferAttribute(fTo, 3));
    fg.setAttribute('aIdx', new THREE.InstancedBufferAttribute(fIdx, 1));
    fg.setAttribute('aSize', new THREE.InstancedBufferAttribute(fSz, 1));
    fg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(fSeed, 1));
    fg.setAttribute('aStart', new THREE.InstancedBufferAttribute(fStart, 1));
    fg.setAttribute('aHalf', new THREE.InstancedBufferAttribute(fHalf, 1));
    fg.setAttribute('aRow', new THREE.InstancedBufferAttribute(fRow, 1));
    fg.instanceCount = na;
    letterMat.uniforms.uFrame.value.copy(ledeFrame.matrixWorld);
    flapMat.uniforms.uFrame.value.copy(ledeFrame.matrixWorld);
  }

  function fit() {
    w = Math.max(1, sceneEl.clientWidth); h = Math.max(1, sceneEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    grainMat.uniforms.uPR.value = renderer.getPixelRatio();
    /* раму опису рахуємо з базового положення камери */
    camera.position.set(target.x + d0 * Math.cos(el0) * Math.sin(az0), target.y + d0 * Math.sin(el0), target.z + d0 * Math.cos(el0) * Math.cos(az0));
    camera.lookAt(target); camera.updateMatrixWorld();
    fitLede();
  }
  /* hero липкий на час прокрутки доріжки */
  function progress() {
    if (dbgP != null) return dbgP;
    const span = track ? Math.max(1, track.offsetHeight - window.innerHeight) : window.innerHeight;
    return clamp01(window.scrollY / span);
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
  const camPos = new THREE.Vector3();
  function apply(fF, fS, tt) {
    /* фігура — як на /preview/3d-v6/, тільки каркас не розсувається */
    joints.forEach((j, i) => j.m.scale.setScalar(Math.max(0.001, fF.joints[i])));
    outerBeams.forEach((b, i) => placeBeam(b.m, VO[b.i], VO[b.j], fF.outer[i]));
    innerGrp.rotation.y = fF.swivel;
    innerLines.forEach((L, i) => {
      const d = fF.inner[i];
      let a = L.a, b = L.b;
      if (L.spoke >= 0) { a = VO[L.spoke]; b = tmpT.copy(VI[L.spoke]).applyAxisAngle(UP, fF.swivel); }   // спиця тягнеться за ґраткою
      placeBeam(L.bar, a, b, d); placeBeam(L.strip, a, b, d); placeBeam(L.glow, a, b, d);
      const wv = 0.5 + 0.5 * Math.sin(L.k - tt * (0.5 + 1.1 * fF.pulseSpeed));
      const br = fF.light * (0.45 + 0.55 * (1 - fF.wave + fF.wave * wv));
      L.lightMat.color.copy(LIGHT).multiplyScalar(0.2 + 1.35 * br);
      L.glow.material.opacity = 0.03 + 0.16 * br;
    });
    spin.rotation.y = angle + fF.spin + mx * 0.06;
    outer.rotation.x = 0.22 + my * 0.03;
    outer.position.y = cPos.y + Math.sin(tt * 0.6) * 0.03;
    grainMat.uniforms.uOrigin.value.copy(outer.position);
    /* камера: обліт від скролу + паралакс від миші */
    const az = az0 + fS.orbit + mx * 0.14, el = el0 + fS.elev + my * 0.07;
    camPos.set(target.x + d0 * Math.cos(el) * Math.sin(az), target.y + d0 * Math.sin(el), target.z + d0 * Math.cos(el) * Math.cos(az));
    camera.position.copy(camPos); camera.lookAt(target);
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    placeLedeFrame();
    /* поле формул: у спокої тліє тьмяним сірим, від скролу розгоряється до яскравого */
    const rest = introRelease(restSec);
    figRay.origin.copy(camera.position); figRay.direction.copy(outer.position).sub(camera.position).normalize();
    if (!figRay.intersectPlane(wallPlane, wallOrigin)) wallOrigin.copy(wallC);
    let far = 0;
    for (const c of wallCorners) far = Math.max(far, c.distanceTo(wallOrigin));
    wallMat.uniforms.uRadius.value = Math.max(fS.coverage, rest.cover) * far;
    wallMat.uniforms.uOpacity.value = Math.max(fS.fade, rest.wall);
    wallMat.uniforms.uTint.value.copy(TINT_REST).lerp(TINT_LIT, fS.fade);
    wallMat.uniforms.uTime.value = tt; wallMat.uniforms.uSpot.value.copy(spot);
    wall.visible = wallMat.uniforms.uOpacity.value > 0.002;
    if (letters) {
      letterMat.uniforms.uTime.value = tt;
      letterMat.uniforms.uOrigin.value.copy(outer.position);
      /* скрол відкриває «ворота»: дійшов до порога літери — вона вилітає і далі живе своїм часом */
      let touched = false, any = false;
      for (let i = 0; i < letterOrder.length; i++) {
        if (letterLaunch[i] < 0 && fS.fade >= letterOrder[i] && letterOrder[i] <= 1) { letterLaunch[i] = tt; touched = true; }
        else if (letterLaunch[i] >= 0 && fS.fade < letterOrder[i] - 0.03) { letterLaunch[i] = -1; touched = true; }
        if (letterLaunch[i] >= 0) any = true;
      }
      if (touched) letters.geometry.attributes.aLaunch.needsUpdate = true;
      letters.visible = any;
      flapMat.uniforms.uRest.value = restSec; flapMat.uniforms.uTime.value = tt;
      flaps.visible = fS.after;
    }
    dustMat.uniforms.uTime.value = tt; nebMat.uniforms.uTime.value = tt;
    grainMat.uniforms.uTime.value = tt; grainMat.uniforms.uSpread.value = fS.grains;
    grainMat.uniforms.uReach.value = fS.grains * far; grains.visible = fS.grains > 0.001;
  }
  const frames = (p, introT) => [figureFrame(figureProgress(p), introT, COUNTS), sceneFrame(p, introT)];
  function render(fF, fS) { apply(fF, fS, t); renderer.render(scene, camera); }

  fit();
  if (reduced) {
    const pp = dbgP != null ? dbgP : 0.95;
    const one = () => render(...frames(pp, 1));
    one();
    fontsReady.then(one);
    new ResizeObserver(() => { fit(); one(); }).observe(sceneEl);
    return;
  }

  function tick(now) {
    running = false;
    const dt = Math.min(last ? now - last : 16, 50); last = now;
    t += dt / 1000;
    if (dbgIntro == null) introMs += dt;
    const introT = dbgIntro != null ? dbgIntro : clamp01(introMs / CFG.introMs);
    restSec = introT >= 1 ? restSec + dt / 1000 : AGE;
    pTarget = progress();
    pSmooth += (pTarget - pSmooth) * 0.16;
    mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08;
    spot.lerp(tspot, 0.12);
    stepGrid(Math.min(dt / 1000, 0.05));
    angle += dt / 1000 * (0.1 + 0.08 * pSmooth);                         // обертання: повільне у спокої, трохи швидше зі скролом
    if (still) { pSmooth = pTarget; render(...frames(pSmooth, introT)); return; }
    render(...frames(pSmooth, introT));
    if (visible && !document.hidden) schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(tick); } }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { last = 0; schedule(); } }, { threshold: 0.02 }).observe(sceneEl);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { last = 0; schedule(); } });
  new ResizeObserver(() => { fit(); schedule(); }).observe(sceneEl);
  window.addEventListener('scroll', schedule, { passive: true });
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
      schedule();
    });
    hero.addEventListener('pointerleave', () => { tmx = 0; tmy = 0; tspot.set(0, -50, 0); schedule(); });
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
