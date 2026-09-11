/*
 * Перший екран /ai — «Сховище».
 * Радіант — той самий, що на /preview/3d/: металевий каркас кубооктаедра з
 * брусів шліфованого алюмінію, всередині вкладена ґратка зі спицями й синіми
 * світловими лініями; при відкритті збирається порожній каркас, далі скрол
 * веде його історію (каркас розсувається, малюється ґратка, спиці, чверть
 * оберту, каркас замикається, займається світло) — хореографія і код побудови
 * взяті звідти без змін (hero-crystal-frame.js). Своя тут лише поява при
 * завантаженні: спершу з простору злітаються всі вузли, і аж потім між ними
 * проростають бруси. Фігура відкидає тінь на сторінку.
 *
 * Своє тут — те, що довкола: історія фігури стиснута в першу частину скролу,
 * тож невелика прокрутка одразу запускає розкриття; фігура робить повний
 * оберт; формули його систем проєктуються збоку на невидиму площину — вона не
 * має ні кольору, ні країв, видно лише світло написів: вони проступають
 * рядками від фігури і розходяться до країв. Спершу з ядра крізь раму летять
 * вогники — вони випереджають написи, ніби самі й створюють проєкцію, — а
 * написи наздоганяють пізніше й плавно набирають яскравість, щоб устигнути
 * роздивитись, як збирається ґратка; камера облітає фігуру. Розмір фігури не
 * змінюється. На компʼютері hero липкий на час прокрутки; миша дає
 * паралакс, рядки біля курсора яскравішають; на телефоні 30 к/с. Поза екраном
 * цикл спить, при «зменшити рух» — один нерухомий кадр.
 *
 * Для знімків: ?p=0.5 фіксує прогрес скролу, ?intro=1 — вступ, ?still=1 — один кадр.
 */
import * as THREE from 'three';
import { getFrame as figureFrame, clamp01 } from './hero-crystal-frame.js';
import { getFrame as sceneFrame, figureProgress, introFrame } from './hero-vault-frame.js';

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
  const lo = matchMedia('(max-width: 767px)').matches || !fine; // телефон/планшет: без сяйва навколо ліній, 30 к/с

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { sceneEl.classList.add('vault-nogl'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lo ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0b0f19, 0);

  /* усе спільне — до першого використання */
  /* фігура — як на /preview/3d/, лише в півтора раза менша (прохання власника) */
  const R = band ? 0.56 : 0.81;
  const cPos = band ? new THREE.Vector3(0, R + 0.5, 0) : new THREE.Vector3(5.0, R + 0.7, 0.6);
  const cam0 = band ? new THREE.Vector3(0, cPos.y + 0.2, 7.4) : new THREE.Vector3(0.3, cPos.y + 0.2, 8.8);
  const target = band ? new THREE.Vector3(0, cPos.y + 0.05, 0) : new THREE.Vector3(3.1, cPos.y, 0);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
  const tmpS = new THREE.Vector3(), tmpT = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0), mtx = new THREE.Matrix4();
  const LIGHT = new THREE.Color(0x47a0ff);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  /* обʼєм каркаса: дальні бруси розчиняються в тлі, а ближні бруси ЗОВНІШНЬОЇ рами напівпрозорі —
     інакше при повільному обертанні передні грані глухо закривають задні й ядро, і фігура читається
     як плаский силует. Підбір на льоту: ?xray=0…1 (1 — рама глуха), ?fog=число (більше — тумана менше) */
  scene.fog = new THREE.Fog(0x0b0f19, 1, 30);
  const xrayQ = q.has('xray') ? parseFloat(q.get('xray')) : null;
  const fogQ = q.has('fog') ? parseFloat(q.get('fog')) : null;
  const xray = { uCz: { value: 9 }, uCr: { value: R }, uFront: { value: xrayQ != null ? xrayQ : 0.6 } };
  function seeThrough(mat) {
    mat.transparent = true; mat.depthWrite = false;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, xray);
      sh.fragmentShader = 'uniform float uCz; uniform float uCr; uniform float uFront;\n' + sh.fragmentShader
        .replace('#include <premultiplied_alpha_fragment>',
          'gl_FragColor.a *= mix(uFront, 1.0, smoothstep(uCz - uCr * 0.9, uCz + uCr * 0.15, vFogDepth));\n\t#include <premultiplied_alpha_fragment>');
    };
  }
  const camera = new THREE.PerspectiveCamera(band ? 44 : 34, 1, 0.1, 80);
  const d0 = cam0.distanceTo(target);
  const az0 = Math.atan2(cam0.x - target.x, cam0.z - target.z), el0 = Math.asin((cam0.y - target.y) / d0);

  /* світло і тінь — як на /preview/3d/ */
  const key = new THREE.DirectionalLight(0xe8eeff, 1.5);
  key.position.set(cPos.x - 2.2, 9, cPos.z + 4.5); key.target.position.set(cPos.x, 0, cPos.z); scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(lo ? 1024 : 2048, lo ? 1024 : 2048);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 6; key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30; key.shadow.bias = -0.0006; key.shadow.radius = 9;
  scene.add(key);
  const fillA = new THREE.PointLight(0xb9b0f0, 2.4, 16, 2); fillA.position.set(cPos.x + 5, 3.5, cPos.z - 3); scene.add(fillA);
  const fillB = new THREE.PointLight(0x60a5fa, 3, 16, 2); fillB.position.set(cPos.x - 5, 2.5, cPos.z + 4); scene.add(fillB);
  scene.add(new THREE.HemisphereLight(0x3a4a70, 0x05070d, 0.65));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24, fog: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cPos.x, 0, cPos.z); floor.receiveShadow = true; scene.add(floor);

  /* ---------- радіант: побудова як на /preview/3d/ ---------- */
  const outer = new THREE.Group(); outer.rotation.set(0.22, 0, 0.12); outer.position.copy(cPos);
  const spin = new THREE.Group(); outer.add(spin); scene.add(outer);
  const innerGrp = new THREE.Group(); spin.add(innerGrp);              // внутрішня ґратка (провертається окремо)

  const brushed = brushedTexture();
  const metalOuter = new THREE.MeshStandardMaterial({ color: 0x9fa6ae, metalness: 0.86, roughness: 0.5, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.006, envMapIntensity: 0.95 });
  const metalInner = new THREE.MeshStandardMaterial({ color: 0x848b94, metalness: 0.86, roughness: 0.54, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.004, envMapIntensity: 0.85 });
  seeThrough(metalOuter);   // ядро лишається щільним — воно має читатись, просвічує лише зовнішня рама

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

  /* ---------- проєкція формул: невидима похила площина збоку за фігурою ---------- */
  const H = 7.5;
  const wallC = band ? new THREE.Vector3(2.8, H / 2, -2.2) : new THREE.Vector3(9.3, H / 2, -1.8);
  const wallRot = band ? -Math.PI / 2 + 0.95 : -Math.PI / 2 + 0.62;
  const WW = band ? 13 : 19;
  const wallN = new THREE.Vector3(-Math.cos(wallRot + Math.PI / 2), 0, Math.sin(wallRot + Math.PI / 2)); // нормаль площини
  const wallU = new THREE.Vector3(Math.cos(wallRot), 0, -Math.sin(wallRot));                             // напрям уздовж площини
  const wallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(wallN, wallC);
  const wallPoint = (a, b) => wallC.clone().addScaledVector(wallU, a).add(new THREE.Vector3(0, b, 0));   // точка на площині (уздовж, по висоті)
  const wallCorners = [];
  for (const a of [-WW / 2, WW / 2]) for (const b of [-H / 2, H / 2]) wallCorners.push(wallPoint(a, b));
  /* хвиля світла росте з тієї точки площини, що лежить рівно за фігурою (її «тінь» з погляду камери),
     тож написи проступають від силуету фігури назовні, а не з краю кадру */
  const wallOrigin = wallC.clone(), figRay = new THREE.Ray();
  const wallMat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: blankTexture() }, uMapB: { value: blankTexture() }, uMix: { value: 0 },
      uTint: { value: new THREE.Color(0xbcd3ff) }, uOpacity: { value: 1.0 },
      uOrigin: { value: wallOrigin }, uRadius: { value: 0 }, uSoft: { value: 2.0 },
      uSpot: { value: new THREE.Vector3(0, -50, 0) }, uSpotR: { value: 3.0 }, uSpotK: { value: fine && !lo ? 0.7 : 0 }, uTime: { value: 0 },
      uEdge: { value: band ? 0.3 : 0.2 },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uMap; uniform sampler2D uMapB; uniform float uMix;
      uniform vec3 uTint; uniform float uOpacity; uniform vec3 uOrigin; uniform float uRadius; uniform float uSoft;
      uniform vec3 uSpot; uniform float uSpotR; uniform float uSpotK; uniform float uTime; uniform float uEdge;
      varying vec2 vUv; varying vec3 vW;
      void main(){
        /* два набори написів: поки видно один, другий домальовується, далі повільний перехід між ними.
           Перехід іде смугою по стіні, а не одразу всюди, — так рядки змінюються по черзі, без спалаху. */
        float band = smoothstep(-0.35, 0.35, uMix * 1.7 - 0.35 - (vUv.x * 0.55 + vUv.y * 0.45) * 0.7);
        vec4 t = mix(texture2D(uMap, vUv), texture2D(uMapB, vUv), band);
        float turn = 1.0 - 0.45 * (1.0 - abs(band * 2.0 - 1.0));      // на самому переході рядок ледь тьмянішає
        float d = distance(vW, uOrigin);
        float m = 1.0 - smoothstep(uRadius - uSoft, uRadius + uSoft * 0.25, d);
        float fall = 1.0 / (1.0 + d * d * 0.014);
        /* площина не має країв: написи мʼяко згасають до її меж */
        float edge = smoothstep(0.0, uEdge, vUv.x) * smoothstep(1.0, 1.0 - uEdge, vUv.x) * smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
        float spot = 1.0 + uSpotK * (1.0 - smoothstep(0.0, uSpotR, distance(vW, uSpot)));
        float breathe = 0.92 + 0.08 * sin(uTime * 0.45 + vW.z * 0.7 + vW.y * 0.9);
        /* одна повільна світла хвиля йде вздовж стіни — рядки на ній оживають */
        float sweep = 1.0 + 0.5 * smoothstep(0.55, 1.0, sin(uTime * 0.16 - vUv.x * 3.4 - vUv.y * 1.1) * 0.5 + 0.5);
        vec3 c = uTint * t.rgb * t.a * uOpacity * m * edge * (0.35 + 0.65 * fall) * spot * breathe * sweep * turn;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        /* альфа = яскравість готового пікселя: площина проявляється лише там, де є світло напису */
        gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    /* полотно прозоре з premultiplied alpha: адитивне змішування додає і колір, і альфу,
       тож чорного прямокутника немає, а композитор отримує коректні пікселі (rgb ≤ a) */
    blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WW, H), wallMat); wall.position.copy(wallC); wall.rotation.y = wallRot; scene.add(wall);
  /* Дві полотнини з написами: одна на екрані, друга тим часом домальовується рядок за рядком
     (по кілька рядків за кадр, щоб не було ривка), і далі вони плавно міняються місцями. */
  const TW = lo ? 2048 : 4096, TH = lo ? 768 : 1536, TROWS = lo ? 22 : 30;
  const sheets = [wallSheet(TW, TH), wallSheet(TW, TH)];
  let front = 0, sheetSeed = 23, painter = null, mixT = 0, nextSwap = 0;
  const fontsReady = Promise.race([Promise.all([document.fonts.load('400 40px Inter'), document.fonts.load('600 40px Inter')]).catch(() => null), new Promise((r) => setTimeout(r, 1200))]);
  fontsReady.then(() => {
    paintAll(sheets[0], TROWS, sheetSeed);                 // перший набір — одразу цілком
    wallMat.uniforms.uMap.value = sheets[0].tex; wallMat.uniforms.uMapB.value = sheets[0].tex;
    nextSwap = t + SWAP_EVERY;
    schedule();
  });
  const SWAP_EVERY = lo ? 11 : 8, SWAP_TIME = lo ? 3.4 : 2.6, ROWS_PER_FRAME = lo ? 1 : 2;
  /* крок життя стіни: домалювати трохи наступного набору, а коли готовий — повільно перевести на нього */
  function stepWall(dt) {
    if (!wall.visible || !nextSwap) return;
    if (painter) {
      for (let i = 0; i < ROWS_PER_FRAME && painter; i++) if (!painter.next().done) continue; else painter = null;
      if (!painter) { sheets[1 - front].tex.needsUpdate = true; wallMat.uniforms.uMapB.value = sheets[1 - front].tex; mixT = 0.0001; }
      return;
    }
    if (mixT > 0) {                                        // перехід між наборами
      mixT = Math.min(1, mixT + dt / SWAP_TIME);
      wallMat.uniforms.uMix.value = mixT;
      if (mixT >= 1) { front = 1 - front; wallMat.uniforms.uMap.value = sheets[front].tex; wallMat.uniforms.uMix.value = mixT = 0; nextSwap = t + SWAP_EVERY; }
      return;
    }
    if (t >= nextSwap) painter = paintRows(sheets[1 - front], TROWS, (sheetSeed += 7));
  }

  /* зерна світла, що летять від фігури на площину проєкції */
  const rnd = seeded(31);
  const N = lo ? 1100 : 2600;
  const gDir = [], gMax = [], gPhase = [], gSpeed = [], gPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const p = wallPoint((rnd() - 0.5) * (WW - 3), (rnd() - 0.5) * (H - 2));
    const dir = p.clone().sub(cPos); const dist = dir.length(); dir.normalize();
    gDir.push(dir.x, dir.y, dir.z); gMax.push(dist); gPhase.push(rnd()); gSpeed.push(0.035 + rnd() * 0.055);
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('aDir', new THREE.Float32BufferAttribute(gDir, 3));
  gGeo.setAttribute('aMax', new THREE.Float32BufferAttribute(gMax, 1));
  gGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(gPhase, 1));
  gGeo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(gSpeed, 1));
  gGeo.boundingSphere = new THREE.Sphere(cPos.clone(), 30);
  const grainMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOrigin: { value: cPos.clone() }, uStart: { value: R * 0.12 }, uSpread: { value: 0 }, uSize: { value: lo ? 5 : 8 }, uPR: { value: renderer.getPixelRatio() }, uColorA: { value: new THREE.Color(0x60a5fa) }, uColorB: { value: new THREE.Color(0xa78bfa) },
      uWave: wallMat.uniforms.uOrigin, uReach: { value: 0 }, uSoft: wallMat.uniforms.uSoft },
    vertexShader: `attribute vec3 aDir; attribute float aMax; attribute float aPhase; attribute float aSpeed;
      uniform float uTime; uniform vec3 uOrigin; uniform vec3 uWave; uniform float uReach; uniform float uSoft;
      uniform float uStart; uniform float uSpread; uniform float uSize; uniform float uPR; varying float vA; varying float vK;
      void main(){ float u = fract(aPhase + uTime * aSpeed); vec3 p = uOrigin + aDir * mix(uStart, aMax, u);   // з ядра фігури до своєї точки на площині
        /* мають власний, швидший фронт: вогники летять уже тоді, коли написів ще немає, і весь час випереджають їх */
        float lit = 1.0 - smoothstep(uReach + uSoft * 0.6, uReach + uSoft * 2.4, distance(uOrigin + aDir * aMax, uWave));
        /* зʼявляються, вийшовши з ядра, і гаснуть, торкнувшись площини */
        vA = smoothstep(0.0, 0.16, u) * (1.0 - smoothstep(0.86, 1.0, u)) * lit * smoothstep(0.0, 0.12, uSpread); vK = aPhase;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = min(uSize * uPR * (6.0 / -mv.z), 9.0 * uPR); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColorA; uniform vec3 uColorB; varying float vA; varying float vK;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.08, length(c)); vec3 col = mix(uColorA, uColorB, vK);
        gl_FragColor = vec4(col * a * vA * 0.85, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)); }`,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const grains = new THREE.Points(gGeo, grainMat); grains.visible = false; scene.add(grains);

  /* ---------- стан і цикл ---------- */
  let w = 1, h = 1;
  let introMs = -300, last = 0, t = 0, angle = 0.4, frameNo = 0, lastInput = 0;
  let pTarget = 0, pSmooth = 0, mx = 0, my = 0, tmx = 0, tmy = 0, yaw = 0, tyaw = 0;
  let visible = false, running = false;
  const spot = new THREE.Vector3(0, -50, 0), tspot = new THREE.Vector3(0, -50, 0);
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const track = document.getElementById('vault-track');

  function fit() {
    w = Math.max(1, sceneEl.clientWidth); h = Math.max(1, sceneEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    grainMat.uniforms.uPR.value = renderer.getPixelRatio();
  }
  function progress() {
    if (dbgP != null) return dbgP;
    /* компʼютер: hero липкий на час прокрутки доріжки; телефон: історію веде положення сторінки */
    const span = !band && track ? Math.max(1, track.offsetHeight - window.innerHeight) : window.innerHeight * 0.5;
    return clamp01(window.scrollY / span);
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
  const camPos = new THREE.Vector3();
  function apply(fF, fS, tt) {
    /* радіант — як на /preview/3d/ */
    const open = fF.open;
    jointsOuter.forEach((j, i) => { j.m.scale.setScalar(Math.max(0.001, fF.jointsOuter[i])); j.m.position.copy(j.v).multiplyScalar(open * fF.drift[i]); });
    outerBeams.forEach((b, i) => placeBeam(b.m, tmpS.copy(VO[b.i]).multiplyScalar(open), tmpT.copy(VO[b.j]).multiplyScalar(open), fF.outer[i]));
    jointsInner.forEach((j, i) => j.m.scale.setScalar(Math.max(0.001, fF.jointsInner[i])));
    innerGrp.rotation.y = fF.swivel;
    innerEdges.forEach((L, i) => { const d = fF.inner[i]; placeBeam(L.bar, L.a, L.b, d); placeBeam(L.strip, L.a, L.b, d); if (L.glow) placeBeam(L.glow, L.a, L.b, d); lightOf(L, fF, tt); });
    spokes.forEach((L, i) => {
      const d = fF.spokes[i];
      const a = tmpS.copy(VO[L.idx]).multiplyScalar(open), b = tmpT.copy(VI[L.idx]).applyAxisAngle(UP, fF.swivel);
      placeBeam(L.bar, a, b, d); placeBeam(L.strip, a, b, d); if (L.glow) placeBeam(L.glow, a, b, d); lightOf(L, fF, tt);
    });
    /* повільне обертання у спокої + повний оберт від скролу, ледь помітне плавання, паралакс від миші; розмір не змінюється */
    spin.rotation.y = angle + fS.spin + mx * 0.06;
    outer.rotation.x = 0.22 + my * 0.03;
    outer.position.y = cPos.y + Math.sin(tt * 0.6) * 0.03;
    /* камера: обліт без підʼїзду, паралакс від миші або поворот від пальця */
    const az = az0 + fS.orbit + mx * 0.14 + yaw, el = el0 + fS.elev + my * 0.07;
    camPos.set(target.x + d0 * Math.cos(el) * Math.sin(az), target.y + d0 * Math.sin(el), target.z + d0 * Math.cos(el) * Math.cos(az));
    camera.position.copy(camPos); camera.lookAt(target);
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const cz = camera.position.distanceTo(outer.position), rr = R * open;
    xray.uCz.value = cz; xray.uCr.value = rr;
    scene.fog.near = cz - rr * 1.1; scene.fog.far = cz + rr * (fogQ != null ? fogQ : 11.0);
    /* проєкція: хвиля росте з точки площини за фігурою; зерна летять на неї */
    figRay.origin.copy(camera.position); figRay.direction.copy(outer.position).sub(camera.position).normalize();
    if (!figRay.intersectPlane(wallPlane, wallOrigin)) wallOrigin.copy(wallC);
    let far = 0;
    for (const c of wallCorners) far = Math.max(far, c.distanceTo(wallOrigin));
    wallMat.uniforms.uRadius.value = fS.coverage * far;
    wallMat.uniforms.uOpacity.value = fS.fade;
    wallMat.uniforms.uTime.value = tt; wallMat.uniforms.uSpot.value.copy(spot);
    wall.visible = fS.fade > 0.002;
    grainMat.uniforms.uTime.value = tt; grainMat.uniforms.uSpread.value = fS.grains;
    grainMat.uniforms.uReach.value = fS.grains * far; grains.visible = fS.grains > 0.001;
  }
  /* фігура: усе зі спільного модуля орієнтира, крім появи при завантаженні — вона своя */
  const frames = (p, introT) => {
    const fF = figureFrame(figureProgress(p), introT, COUNTS);
    const iv = introFrame(introT, COUNTS);
    fF.jointsOuter = iv.joints; fF.outer = iv.edges; fF.drift = iv.drift;
    return [fF, sceneFrame(p, introT)];
  };
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
    const dt = Math.min(last ? now - last : 16, 50); last = now;      // покадрово, крок ≤ 50 мс (iOS присипляє цикл)
    t += dt / 1000; frameNo++;
    if (dbgIntro == null) introMs += dt;
    const introT = dbgIntro != null ? dbgIntro : clamp01(introMs / 2400);
    pTarget = progress();
    pSmooth += (pTarget - pSmooth) * 0.16;
    mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08; yaw += (tyaw - yaw) * 0.1;
    spot.lerp(tspot, 0.12);
    stepWall(dt / 1000);                                                 // стіна живе: домальовує наступний набір і переходить на нього
    angle += dt / 1000 * 0.1;                                            // повільне обертання у спокої
    if (still) { pSmooth = pTarget; render(...frames(pSmooth, introT)); return; }
    if (!(lo && frameNo % 2)) render(...frames(pSmooth, introT));
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
      tmy = clamp01((ev.clientY - Math.max(r.top, 0)) / Math.min(r.height, window.innerHeight)) * 2 - 1;
      /* точка на площині проєкції під курсором — рядки поруч яскравішають */
      const cr = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - cr.left) / cr.width) * 2 - 1, -((ev.clientY - cr.top) / cr.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(wallPlane, tspot)) tspot.set(0, -50, 0);
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

  /* ---------- геометрія (як на /preview/3d/) ---------- */
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
  /* ---------- текстура формул ---------- */
  function blankTexture() { const c = document.createElement('canvas'); c.width = c.height = 4; return new THREE.CanvasTexture(c); }
  /* Кілька карток серед формул — коротка розповідь про мене, якщо хтось захоче вчитатись.
     Вони стоять на тих самих місцях в обох наборах, тож при зміні написів не миготять і їх можна дочитати. */
  /* Точка площини, куди дивиться камера крізь фігуру, — довкола неї і розкладаємо картки:
     так вони завжди лягають поруч із силуетом, а не за кадром. off = [уздовж площини, по висоті]. */
  const camBase = target.clone().add(new THREE.Vector3(d0 * Math.cos(el0) * Math.sin(az0), d0 * Math.sin(el0), d0 * Math.cos(el0) * Math.cos(az0)));
  const shadow0 = wallC.clone();
  new THREE.Ray(camBase, cPos.clone().sub(camBase).normalize()).intersectPlane(wallPlane, shadow0);
  const aShadow = shadow0.clone().sub(wallC).dot(wallU);
  const atOf = (du, dv) => [(aShadow + du) / WW + 0.5, 0.5 - (shadow0.y + dv - wallC.y) / H];
  const SALES = (band ? [
    { off: [0.2, 2.2], t: 'Що я роблю', l: ['Автоматизую те, що зʼїдає час:', 'заявки, розрахунки, звіти,', 'відповіді клієнтам.'] },
    { off: [0.6, 4.4], t: 'З чого почати', l: ['Безкоштовний зразок', 'на ваших даних.', 'sernyak.a@gmail.com'] },
  ] : [
    { off: [-0.9, 2.5], t: 'Що я роблю', l: ['Автоматизую те, що зʼїдає час:', 'заявки, розрахунки, звіти,', 'відповіді клієнтам.'] },
    { off: [4.4, 1.5], t: 'Як я рахую', l: ['Не «впровадження», а гроші:', 'скільки коштує година рутини', 'і коли система окупиться.'] },
    { off: [-4.2, 4.0], t: 'Що ви отримуєте', l: ['Робочу систему у вашій CRM.', 'Код і доступи — ваші.', 'Підтримує той, хто будував.'] },
    { off: [3.0, 4.6], t: 'З чого почати', l: ['Безкоштовний зразок на ваших', 'даних: беру ваш процес', 'і показую автоматизованим.', 'sernyak.a@gmail.com'] },
  ]).map((card) => ({ ...card, at: atOf(card.off[0], card.off[1]) }));
  function wallSheet(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return { c, g: c.getContext('2d'), tex };
  }
  function paintAll(sheet, rows, seed) { const it = paintRows(sheet, rows, seed); while (!it.next().done); sheet.tex.needsUpdate = true; }
  function* paintRows(sheet, rows, seed) {
    /* Не про мої проєкти, а про економіку того, хто читає: як рахується його прибуток, що коштує
       рутина, наскільки швидше йде заявка. Три голоси: модель · результат · процес. */
    const CORPUS = [
      'LTV / CAC = 3,8', 'ROAS = дохід / витрати на рекламу', 'маржа = чек × частота − CAC',
      '∂ прибуток / ∂ бюджет каналу', 'точка окупності: 2,5 міс', 'сегмент × канал × маржа',
      'прогноз попиту на 14 днів', 'p(оплата | джерело, час відповіді)', 'план / факт = 96 %',
      'CAC ↓ 34 % за 6 тижнів', 'конверсія 2,1 % → 3,4 %', 'обробка заявки: 4 год → 3 хв',
      'відмови на оплаті −41 %', 'повторні покупки 19 % → 31 %', 'вартість ліда $12,40',
      'середній чек ↑ 22 %', '12 год рутини на тиждень → 0', 'ручна робота 68 % → 8 %',
      '0 втрачених заявок', 'A/B: +18 % до кошика', 'заявка → CRM → дзвінок за 60 с',
      'звіт щопонеділка о 08:00', 'оплата → документ → пошта', 'відповідь клієнту 24/7 · 30 с',
      'щоденна звірка: 0 розбіжностей', 'клік → лід → оплата: одна нитка',
      'дублікат ⇔ (сума, дата, контрагент)', 'черга: 0 · час очікування → 0',
    ];
    const CHARTS = ['bars', 'rise', 'drop', 'funnel', 'donut'];
    const { c, g } = sheet, w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    const r = seeded(seed), lh = h / rows, fs = Math.round(lh * 0.55);
    /* Картки помітно більші за формули — інакше на екрані їх не прочитати. Розмір беремо з реального
       виміру тексту, а рядки формул потім обходять ці прямокутники. */
    const cfs = Math.round(fs * (lo ? 1.55 : 1.7)), cLead = cfs * 1.5, pad = cfs * 0.8;
    const boxes = SALES.map((card) => {
      g.font = `600 ${Math.round(cfs * 1.15)}px Inter, sans-serif`;
      let tw = g.measureText(card.t).width;
      g.font = `400 ${cfs}px Inter, sans-serif`;
      for (const line of card.l) tw = Math.max(tw, g.measureText(line).width);
      const bw = tw + pad * 2, bh = cLead * (card.l.length + 1.35) + pad;
      return { card, cfs, cLead, pad, x: Math.min(w - bw, Math.max(0, card.at[0] * w - bw / 2)), y: Math.min(h - bh, card.at[1] * h), w: bw, h: bh };
    });
    const hit = (x, y) => boxes.find((b) => x > b.x - lh * 0.5 && x < b.x + b.w + lh * 0.5 && y > b.y - lh * 0.4 && y < b.y + b.h + lh * 0.4);
    g.textBaseline = 'middle';
    g.fillStyle = '#9dc2ff'; g.strokeStyle = '#9dc2ff'; g.lineJoin = 'round'; g.lineCap = 'round';
    /* маленький графік у рядок — той самий колір і товщина, що й текст */
    function chart(kind, x, cy) {
      const ch = lh * 0.6, top = cy - ch / 2, cw = chartWidth(kind, lh);
      g.lineWidth = Math.max(1, ch * 0.075);
      if (kind === 'bars') {
        const n = 5, bw = cw / (n * 1.55);
        for (let i = 0; i < n; i++) { const bh = ch * (0.22 + 0.78 * (i / (n - 1)) * (0.72 + r() * 0.5)); g.fillRect(x + i * bw * 1.55, top + ch - bh, bw, bh); }
      } else if (kind === 'rise' || kind === 'drop') {
        const n = 6; g.beginPath();
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1), v = (kind === 'rise' ? t : 1 - t) * (0.72 + r() * 0.5);
          const py = top + ch - Math.min(ch, ch * (0.12 + 0.8 * v));
          i ? g.lineTo(x + t * cw, py) : g.moveTo(x, py);
        }
        g.stroke();
      } else if (kind === 'funnel') {
        for (let i = 0; i < 3; i++) { const fw = cw * (1 - i * 0.28), fh = ch * 0.24; g.fillRect(x + (cw - fw) / 2, top + i * ch * 0.38, fw, fh); }
      } else {
        const rad = ch * 0.42, cx = x + rad, cyy = top + ch / 2;
        g.beginPath(); g.arc(cx, cyy, rad, 0, Math.PI * 2); g.globalAlpha *= 0.45; g.stroke();
        g.globalAlpha /= 0.45;
        g.beginPath(); g.arc(cx, cyy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * (0.9 + r() * 0.8)); g.stroke();
      }
    }
    /* рядок за рядком, зліва направо, з проміжками — написи не лягають один на одного */
    for (let row = 0; row < rows; row++) {
      const cy = (row + 0.5) * lh;
      let x = -r() * w * 0.3;                                   // рядки зсунуті один відносно одного
      while (x < w) {
        const strong = r() < 0.16;
        g.globalAlpha = strong ? 0.95 : 0.3 + r() * 0.32;
        if (r() < 0.17) {
          const kind = CHARTS[Math.floor(r() * CHARTS.length)], cw = chartWidth(kind, lh);
          const b = hit(x, cy) || hit(x + cw, cy);
          if (b) { x = b.x + b.w + lh * 0.6; continue; }
          chart(kind, x, cy); x += cw;
        } else {
          const line = CORPUS[Math.floor(r() * CORPUS.length)];
          g.font = `${strong ? 600 : 400} ${fs}px Inter, sans-serif`;
          const lw = g.measureText(line).width;
          const b = hit(x, cy) || hit(x + lw, cy);
          if (b) { x = b.x + b.w + lh * 0.6; continue; }
          g.fillText(line, x, cy);
          x += lw;
        }
        x += fs * (1.4 + r() * 2.2);
      }
      yield row;
    }
    for (const b of boxes) { drawCard(g, b, lh, fs); yield 'card'; }
  }
  function chartWidth(kind, lh) { const ch = lh * 0.6; return kind === 'donut' ? ch : ch * 2.1; }
  /* картка: тонка рамка, заголовок і кілька рядків — трохи яскравіші за формули довкола */
  function drawCard(g, b) {
    const { cfs, cLead, pad } = b;
    g.save();
    g.strokeStyle = '#9dc2ff'; g.fillStyle = '#9dc2ff'; g.lineWidth = Math.max(1.5, cfs * 0.045);
    g.globalAlpha = 0.4;                                   // не рамка, а два кутики — стіна не має виглядати як інтерфейс
    g.beginPath();
    g.moveTo(b.x, b.y + pad * 1.1); g.lineTo(b.x, b.y); g.lineTo(b.x + b.w * 0.38, b.y);
    g.moveTo(b.x + b.w, b.y + b.h - pad * 1.1); g.lineTo(b.x + b.w, b.y + b.h); g.lineTo(b.x + b.w * 0.62, b.y + b.h);
    g.stroke();
    g.globalAlpha = 1;
    g.font = `600 ${Math.round(cfs * 1.15)}px Inter, sans-serif`;
    g.fillText(b.card.t, b.x + pad, b.y + pad + cfs * 0.3);
    g.globalAlpha = 0.78;
    g.font = `400 ${cfs}px Inter, sans-serif`;
    b.card.l.forEach((line, i) => g.fillText(line, b.x + pad, b.y + pad + cLead * (1.25 + i)));
    g.restore();
  }
  function seeded(seed) { let s = seed * 7919 + 13; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
}
