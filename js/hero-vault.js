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
  const wallMode = sceneEl.dataset.variant === 'wall';         // варіант «Стіна»: фігура збоку проєктує опис на похилу площину
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
  const R = band ? 0.61 : 0.97;
  const cPos = wallMode
    ? (band ? new THREE.Vector3(-0.8, R + 0.2, 0.4) : new THREE.Vector3(-2.3, R + 0.35, 0.6))
    : (band ? new THREE.Vector3(0, R + 0.3, 0) : new THREE.Vector3(5.0, R + 0.7, 0.6));
  const cam0 = wallMode
    ? (band ? new THREE.Vector3(0.5, cPos.y + 0.9, 6.6) : new THREE.Vector3(0.4, cPos.y + 0.1, 9.2))
    : (band ? new THREE.Vector3(0, cPos.y, 7.0) : new THREE.Vector3(0.3, cPos.y + 0.2, 8.8));
  const target = wallMode
    ? (band ? new THREE.Vector3(0.75, cPos.y + 1.25, 0) : new THREE.Vector3(1.55, cPos.y - 0.05, 0))
    : (band ? new THREE.Vector3(0, cPos.y - 0.72, 0) : new THREE.Vector3(3.1, cPos.y + 0.6, 0));   // дивимось нижче фігури — вона стає під заголовком, а знизу лишається місце під текст
  /* телефон: зі скролом камера відходить і веде погляд правіше — фігура меншає і йде ліворуч, даючи місце стіні */
  const PULL_BACK = 0, PULL_SIDE = 0, RISE = wallMode ? 0 : 0.42, SHRINK = wallMode ? 0 : 0.34;   // телефон: фігура сама підіймається до заголовка й меншає
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
  const xray = { uCz: { value: 9 }, uCr: { value: R }, uFront: { value: xrayQ != null ? xrayQ : (band ? 0.84 : 0.6) } };
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
  const H = band ? 1.6 : 7.5;
  const wallC = band ? new THREE.Vector3(0, 1.0, 0) : new THREE.Vector3(9.3, H / 2, -1.8);   // ставиться точно під абзац у fitLede()
  const wallRot = band ? 0 : -Math.PI / 2 + 0.62;   // телефон: площина дивиться прямо на глядача
  let WW = band ? 1.9 : 19;
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
      uAtlas: { value: blankTexture() }, uGrid: { value: blankData() }, uCell: { value: new THREE.Vector2(1, 1) }, uAt: { value: new THREE.Vector2(1, 1) },
      uPlain: { value: blankTexture() }, uUsePlain: { value: band ? 1 : 0 },
      /* на компʼютері голограма — тло історії, а не текст для читання: тон сіріший і тьмяніший за абзац
         ліворуч, щоб не було сумніву, що саме читати. На телефоні вона сама і є текстом, тож лишається світлою */
      uTint: { value: new THREE.Color(band ? 0xbcd3ff : 0x8295b5) }, uOpacity: { value: 1.0 },
      uOrigin: { value: wallOrigin }, uRadius: { value: 0 }, uSoft: { value: band ? 0.5 : 2.0 },
      uSpot: { value: new THREE.Vector3(0, -50, 0) }, uSpotR: { value: 3.0 }, uSpotK: { value: fine && !lo ? 0.7 : 0 }, uTime: { value: 0 },
      uEdge: { value: band ? 0.025 : 0.2 },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uAtlas; uniform sampler2D uGrid; uniform vec2 uCell; uniform vec2 uAt; uniform sampler2D uPlain; uniform float uUsePlain; uniform vec3 uTint; uniform float uOpacity; uniform vec3 uOrigin; uniform float uRadius; uniform float uSoft;
      uniform vec3 uSpot; uniform float uSpotR; uniform float uSpotK; uniform float uTime; uniform float uEdge;
      varying vec2 vUv; varying vec3 vW;
      void main(){
        /* стіна — сітка знаків: у uGrid для кожної комірки лежить номер гліфа (R) і його яскравість (G),
           сам знак береться з атласа. Так кожен символ можна міняти окремо, як у заставці «Матриці». */
        vec2 cp = vec2(vUv.x, 1.0 - vUv.y) * uCell;
        vec2 ci = floor(cp), f = fract(cp);
        vec4 cellData = texture2D(uGrid, (ci + 0.5) / uCell);
        float gi = floor(cellData.r * 255.0 + 0.5);
        vec2 gp = vec2(mod(gi, uAt.x), floor(gi / uAt.x));
        /* знак ширший за слот: у B лежить його середина в частках знака, в A — скільки слотів він займає,
           тож шрифт лишається пропорційним, а міняти можна й далі кожен знак окремо */
        float lx = cellData.b + (f.x - 0.5) / max(1.0, cellData.a * 255.0);
        vec4 t = texture2D(uAtlas, (gp + vec2(lx, f.y)) / uAt); t.a *= cellData.g * 1.35;
        /* Телефон: готовий напис замість сітки знаків — і йому додаємо фактуру проєкції, інакше це просто
           текст на тлі: растрові смужки, легкий розлад кольорів по краях літер, ледь помітне плавання
           і світла смуга, що раз на кілька секунд повільно сходить згори. Читабельність не страждає. */
        float holo = 1.0, halo = 0.0;
        if (uUsePlain > 0.5) {
          /* Літери беремо різко, без зсувів: розліт кольорів і плавання читались як розмитість.
             Проєкцію тепер видає не спотворення тексту, а мʼякий ореол ДОВКОЛА нього і світло, що по ньому йде. */
          t = texture2D(uPlain, vUv);
          halo = (texture2D(uPlain, vUv + vec2(0.0035, 0.0)).a + texture2D(uPlain, vUv - vec2(0.0035, 0.0)).a
                + texture2D(uPlain, vUv + vec2(0.0, 0.006)).a + texture2D(uPlain, vUv - vec2(0.0, 0.006)).a) * 0.25;
          halo = max(0.0, halo - t.a);                    // світиться лише поле навколо літери, самої літери не торкається
          float scan = 0.93 + 0.07 * sin(gl_FragCoord.y * 1.35);
          float band = (1.0 - fract(uTime * 0.12)) - vUv.y;
          holo = scan * (1.0 + 0.4 * exp(-band * band * 40.0)) * mix(0.9, 1.12, vUv.y);
        }
        float d = distance(vW, uOrigin);
        float m = 1.0 - smoothstep(uRadius - uSoft, uRadius + uSoft * 0.25, d);
        float fall = 1.0 / (1.0 + d * d * 0.014);
        /* площина не має країв: написи мʼяко згасають до її меж */
        float edge = smoothstep(0.0, uEdge, vUv.x) * smoothstep(1.0, 1.0 - uEdge, vUv.x) * smoothstep(0.0, uEdge, vUv.y) * smoothstep(1.0, 1.0 - uEdge, vUv.y);
        float spot = 1.0 + uSpotK * (1.0 - smoothstep(0.0, uSpotR, distance(vW, uSpot)));
        float breathe = 0.92 + 0.08 * sin(uTime * 0.45 + vW.z * 0.7 + vW.y * 0.9);
        float lit = uOpacity * m * edge * (0.35 + 0.65 * fall) * spot * breathe;
        vec3 c = uTint * t.rgb * t.a * lit * holo + uTint * halo * 0.5 * lit;
        /* ледь помітне поле самого променя — щоб текст читався як напис на світлі, а не на тлі сторінки */
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
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WW, H), wallMat); wall.position.copy(wallC); wall.rotation.y = wallRot;
  if (band || wallMode) {
    /* голограма лежить нижче тіньової підлоги — та писала б глибину і відсікала її; малюємо без перевірки
       глибини й найпершою, щоб зерна лишались поверх */
    wallMat.depthTest = false; wall.renderOrder = -1;
  }
  scene.add(wall);
  /* підкладка: мʼяка темна пляма трохи ближче до глядача, ніж напис. Адитивним матеріалом затемнити
     не можна, тож це окрема площина зі звичайним змішуванням — вона й ховає зерна, що летять за нею. */
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
  shade.renderOrder = -2; shade.visible = false;
  if (band || wallMode) scene.add(shade);
  /* Не про мої проєкти, а про економіку того, хто читає: як рахується його прибуток, що коштує
     рутина, наскільки швидше йде заявка. Три голоси: модель · результат · процес. */
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
  /* ---------- жива стіна: сітка знаків, як у заставці «Матриці», тільки покладеній набік ----------
     У кожному рядку час від часу пробігає «голова» — яскравий знак, що переписує рядок за собою:
     комірка на мить перебирає випадкові символи і сідає на новий. Рядки йдуть не в такт, тож у кадрі
     одночасно оновлюються лише кілька — стіна живе, але не рябить. */
  const COLS = lo ? 300 : 700, ROWS = lo ? 26 : 30;
  const gridData = new Uint8Array(COLS * ROWS * 4);
  const gridTex = new THREE.DataTexture(gridData, COLS, ROWS, THREE.RGBAFormat);
  gridTex.needsUpdate = true;
  const rowChars = Array.from({ length: ROWS }, () => []);   // знаки рядка: {tg — цільовий, gi — показаний, k — слотів, x0, roll, glow}
  const headX = new Float32Array(ROWS), headSpeed = new Float32Array(ROWS), headWait = new Float32Array(ROWS);
  const rowRnd = seeded(97);
  for (let y = 0; y < ROWS; y++) { headX[y] = -4; headSpeed[y] = COLS / (2.6 + rowRnd() * 2.2); headWait[y] = rowRnd() * 9; }
  const fontsReady = Promise.race([Promise.all([document.fonts.load('400 40px Inter'), document.fonts.load('600 40px Inter')]).catch(() => null), new Promise((r) => setTimeout(r, 1200))]);
  let glyphs = null;
  fontsReady.then(() => {
    if (band || wallMode) { schedule(); return; }                  // тут стіна формул не потрібна
    glyphs = glyphAtlas(64);
    wallMat.uniforms.uAtlas.value = glyphs.tex;
    wallMat.uniforms.uAt.value.set(glyphs.cols, glyphs.rows);
    wallMat.uniforms.uGrid.value = gridTex;
    wallMat.uniforms.uCell.value.set(COLS, ROWS);
    for (let y = 0; y < ROWS; y++) writeRow(y, 11 + y * 3);        // перший текст — уже на місці
    paintGrid();
    schedule();
  });
  /* розкласти рядок: слова з проміжками, подекуди маленький графік; кожен знак займає стільки слотів,
     скільки має природної ширини в Inter — звідси пропорційний шрифт при посимвольній механіці */
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
  /* перекласти знаки рядків у сітку слотів для відеокарти */
  function paintGrid() {
    gridData.fill(0);
    for (let y = 0; y < ROWS; y++) {
      const base = y * COLS * 4;
      for (const ch of rowChars[y]) {
        const bright = Math.min(255, 105 + ch.glow * 150);
        for (let j = 0; j < ch.k; j++) {
          const i = base + (ch.x0 + j) * 4;
          if (ch.x0 + j < 0 || ch.x0 + j >= COLS) continue;
          gridData[i] = ch.gi;
          gridData[i + 1] = bright;
          gridData[i + 2] = Math.round((j + 0.5) / ch.k * 255);
          gridData[i + 3] = ch.k;
        }
      }
    }
    gridTex.needsUpdate = true;
  }
  let gridSeed = 400, rollTick = 0;
  function stepGrid(dt) {
    if (!glyphs || band || wallMode || !wall.visible) return;
    rollTick += dt;
    const roll = rollTick > 0.055;                                  // знаки перебираються ~18 разів на секунду
    if (roll) rollTick = 0;
    for (let y = 0; y < ROWS; y++) {
      const from = headX[y];
      if (headWait[y] > 0) { headWait[y] -= dt; if (headWait[y] <= 0) { writeRow(y, (gridSeed += 13)); headX[y] = -3; } }
      else {
        headX[y] += headSpeed[y] * dt;
        if (from > COLS + 2) { headWait[y] = 5 + rowRnd() * 11; headX[y] = COLS + 3; }   // рядок постояв — і знову
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

  /* зерна світла, що летять від фігури на площину проєкції */
  const rnd = seeded(31);
  const N = lo ? 1100 : 2600;
  const gTo = [], gPhase = [], gSpeed = [], gPos = new Float32Array(N * 3);
  /* телефон: ціль зерен — смуга під фігурою, там, де на екрані лежить абзац; десктоп — площина збоку */
  const fallPoint = () => new THREE.Vector3(cPos.x + (rnd() - 0.5) * 1.9, cPos.y - 1.15 - rnd() * 1.65, cPos.z + (rnd() - 0.5) * 0.7);   // перезаписується у fitLede
  for (let i = 0; i < N; i++) {
    const p = (band || wallMode) ? fallPoint() : wallPoint((rnd() - 0.5) * (WW - 3), (rnd() - 0.5) * (H - 2));
    gTo.push(p.x, p.y, p.z); gPhase.push(rnd()); gSpeed.push(0.035 + rnd() * 0.055);
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('aTo', new THREE.Float32BufferAttribute(gTo, 3));
  gGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(gPhase, 1));
  gGeo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(gSpeed, 1));
  gGeo.boundingSphere = new THREE.Sphere(cPos.clone(), 30);
  const grainMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOrigin: { value: cPos.clone() }, uStart: { value: R * 0.12 }, uSpread: { value: 0 }, uSize: { value: lo ? 5 : 8 }, uPR: { value: renderer.getPixelRatio() }, uColorA: { value: new THREE.Color(0x60a5fa) }, uColorB: { value: new THREE.Color(0xa78bfa) },
      uWave: wallMat.uniforms.uOrigin, uReach: { value: 0 }, uSoft: wallMat.uniforms.uSoft },
    vertexShader: `attribute vec3 aTo; attribute float aPhase; attribute float aSpeed;
      uniform float uTime; uniform vec3 uOrigin; uniform vec3 uWave; uniform float uReach; uniform float uSoft;
      uniform float uStart; uniform float uSpread; uniform float uSize; uniform float uPR; varying float vA; varying float vK;
      void main(){ float u = fract(aPhase + uTime * aSpeed);
        vec3 d = aTo - uOrigin; float maxD = length(d); vec3 p = uOrigin + d / max(maxD, 0.001) * mix(uStart, maxD, u);   // з ядра фігури до своєї цілі
        /* мають власний, швидший фронт: вогники летять уже тоді, коли написів ще немає, і весь час випереджають їх */
        float lit = 1.0 - smoothstep(uReach + uSoft * 0.6, uReach + uSoft * 2.4, distance(aTo, uWave));
        /* зʼявляються, вийшовши з ядра, і гаснуть, торкнувшись площини */
        vA = smoothstep(0.0, 0.16, u) * (1.0 - smoothstep(0.55, 0.88, u)) * lit * smoothstep(0.0, 0.12, uSpread); vK = aPhase;
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

  /* Далекий пил: кілька сотень ледь помітних цяток у глибині навколо фігури. Вони нічого не «роблять»,
     але дають простору глибину — без них перші секунди виглядають пласко. */
  const DUST = lo ? 420 : 700;
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

  /* Туманності: кілька великих мʼяких плям світла далеко за фігурою. Саме вони дають глибину —
     дрібні цятки самі по собі читаються як шум на пласкому тлі. */
  const NEB = lo ? 7 : 11;
  const nPos = new Float32Array(NEB * 3), nSeed = new Float32Array(NEB), nSize = new Float32Array(NEB);
  for (let i = 0; i < NEB; i++) {
    const a = rnd() * Math.PI * 2, rr = 3 + rnd() * 9;
    nPos[i * 3] = cPos.x + Math.cos(a) * rr;
    nPos[i * 3 + 1] = cPos.y + (rnd() - 0.5) * 8;
    nPos[i * 3 + 2] = cPos.z - 4 - rnd() * 9;
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

  /* ---------- стан і цикл ---------- */
  let w = 1, h = 1;
  let introMs = -300, last = 0, t = 0, angle = 0.4, frameNo = 0, lastInput = 0;
  let pTarget = 0, pSmooth = 0, mx = 0, my = 0, tmx = 0, tmy = 0, yaw = 0, tyaw = 0;
  let visible = false, running = false;
  const spot = new THREE.Vector3(0, -50, 0), tspot = new THREE.Vector3(0, -50, 0);
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const track = document.getElementById('vault-track');
  const lede = (band || wallMode) ? document.getElementById('vault-lede') : null;
  /* Текст абзацу малюємо голограмою на площині під фігурою — саме його «виводять» зерна.
     Сам абзац лишається в розмітці (пошук і читалки його бачать), але стає прозорим носієм місця,
     а площина стає рівно туди, де він лежить. */
  let ledeTokens = null;
  if (lede) {
    ledeTokens = [];
    (function walk(node, bold) {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) for (const w of n.nodeValue.split(/\s+/)) { if (w) ledeTokens.push({ w, bold }); }
        else if (n.nodeType === 1) walk(n, bold || n.tagName === 'STRONG');
      }
    })(lede, false);
    lede.classList.add('vault-lede-holo');
  }
  /* Атлас літер: кожен знак абзацу в своїй квадратній комірці, звичайним і жирним накресленням.
     Далі кожна літера стає окремою площинкою, що вилітає з ядра фігури й сідає на своє місце в рядку. */
  const LCELL = 64, LFS = 42;
  function letterAtlas() {
    const set = [];
    for (const t of ledeTokens) for (const ch of t.w) { const k = ch + (t.bold ? '1' : '0'); if (!set.includes(k)) set.push(k); }
    const cols = 16, rows = Math.ceil(set.length / cols);
    const c = document.createElement('canvas'); c.width = cols * LCELL; c.height = rows * LCELL;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const adv = {}, index = {};
    set.forEach((k, i) => {
      const ch = k.slice(0, -1), bold = k.endsWith('1');
      g.font = `${bold ? 700 : 400} ${LFS}px Inter, sans-serif`;
      g.fillText(ch, (i % cols + 0.5) * LCELL, (Math.floor(i / cols) + 0.5) * LCELL);
      adv[k] = g.measureText(ch).width / LFS;                   // ширина знака в частках кегля
      index[k] = i;
    });
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return { tex, cols, rows, adv, index, space: adv[' 0'] || 0.26 };
  }
  /* Розкладка абзацу по літерах у пікселях CSS — точно так само, як його верстає браузер. */
  function ledeLayout(atlas, fsCss, boxW) {
    const out = [], lh = fsCss * 1.42, pad = 0;
    let x = pad, y = fsCss * 0.95;
    const widthOf = (word, bold) => { let w = 0; for (const ch of word) w += (atlas.adv[ch + (bold ? '1' : '0')] || 0.3) * fsCss; return w; };
    const sp = atlas.space * fsCss;
    for (const t of ledeTokens) {
      const tw = widthOf(t.w, t.bold);
      if (/^[,.;:!?»)\]]/.test(t.w)) x -= sp;
      if (x > pad && x + tw > boxW) { x = pad; y += lh; }
      for (const ch of t.w) {
        const k = ch + (t.bold ? '1' : '0'), a = (atlas.adv[k] || 0.3) * fsCss;
        out.push({ k, cx: x + a / 2, cy: y - fsCss * 0.32, bold: t.bold });
        x += a;
      }
      x += tw > 0 ? sp : 0;
    }
    return { letters: out, height: y + lh * 0.4 };
  }
  /* поставити площину рівно на місце абзацу і перемалювати текст під її поточний розмір */
  const ledeCorner = new THREE.Vector3(), ndcToWorld = new THREE.Vector3();
  function fitLede() {
    if (!lede) return;
    if (wallMode) return fitWallLede();
    const r = lede.getBoundingClientRect(), b = sceneEl.getBoundingClientRect();
    if (!r.width || !b.width) return;
    /* Голограма стоїть обличчям до камери й лягає рівно на прямокутник абзацу. Вертикальна площина
       при погляді згори проєктувалась би трапецією — нижні рядки розповзались за краї екрана. */
    const cx = ((r.left + r.width / 2 - b.left) / b.width) * 2 - 1;
    const cy = -(((r.top + r.height / 2 - b.top) / b.height) * 2 - 1);
    ndcToWorld.set(cx, cy, 0.5).unproject(camera).sub(camera.position).normalize();
    const D = 6.2, TILT = 0.13;                     // легкий нахил лишає відчуття обʼєму, майже без спотворення
    wall.position.copy(camera.position).addScaledVector(ndcToWorld, D);
    wall.quaternion.copy(camera.quaternion); wall.rotateX(-TILT);
    const vh = 2 * D * Math.tan(camera.fov * Math.PI / 360);
    const ww = vh * camera.aspect * (r.width / b.width), hh = vh * (r.height / b.height) / Math.cos(TILT);
    if (ww < 0.05 || hh < 0.05) return;
    WW = ww;
    wall.geometry.dispose();
    wall.geometry = new THREE.PlaneGeometry(ww, hh);
    wall.updateMatrixWorld();
    shade.geometry.dispose();
    shade.geometry = new THREE.PlaneGeometry(ww * 1.22, hh * 1.3);
    shade.position.copy(wall.position).addScaledVector(ndcToWorld, -0.12);   // трохи ближче до глядача
    shade.quaternion.copy(wall.quaternion);
    const fsCss = parseFloat(getComputedStyle(lede).fontSize) || 18;
    placeLetters(ww, hh, fsCss, r.width, r.height);
    const onPlane = (u, v, out) => wall.localToWorld(out.set(u * ww / 2, v * hh / 2, 0));
    onPlane(0, 1.12, wallOrigin);                   // хвиля світла заходить згори, з боку фігури
    wallCorners.length = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) wallCorners.push(onPlane(sx, sy, new THREE.Vector3()));
    const a = gGeo.attributes.aTo;
    for (let i = 0; i < N; i++) {                   // зерна летять саме на цю площину
      onPlane((rnd2() - 0.5) * 1.92, (rnd2() - 0.5) * 1.92, ledeCorner);
      a.setXYZ(i, ledeCorner.x, ledeCorner.y, ledeCorner.z);
    }
    a.needsUpdate = true;
  }
  /* Літери летять із ядра фігури й сідають у рядок: кожна — своя площинка з гліфом з атласа.
     Порядок прильоту — зліва направо, рядок за рядком, тож слова складаються на очах. */
  let letterAtl = null, letters = null, letterMat = null, letterOrder = null, letterLaunch = null;
  function buildLetters() {
    if (!lede || letters) return;
    letterAtl = letterAtlas();
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);          // не «q» — так звався б обʼєкт параметрів URL
    geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
    letterMat = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: letterAtl.tex }, uGrid: { value: new THREE.Vector2(letterAtl.cols, letterAtl.rows) },
        uOrigin: { value: new THREE.Vector3() }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) },
        uTint: { value: new THREE.Color(0xcfe0ff) }, uTime: { value: 0 }, uOpacity: { value: 0 }, uAge: { value: q.has('age') ? parseFloat(q.get('age')) : 0 },
      },
      vertexShader: `attribute vec3 aTo; attribute vec2 aGlyph; attribute float aSize; attribute float aLaunch; attribute float aSeed; attribute float aRow;
        uniform vec3 uOrigin; uniform vec3 uRight; uniform vec3 uUp; uniform vec2 uGrid; uniform float uTime; uniform float uAge;
        varying vec2 vUv; varying float vFly; varying float vRow; varying float vSeed;
        void main(){
          /* Скрол лише ВИПУСКАЄ літеру; далі вона летить за власним часом, тож навіть при блискавичному
             скролі видно, як знаки складаються в текст. Затримка і тривалість — у кожної свої. */
          if (aLaunch < 0.0) { vFly = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float delay = fract(aSeed * 3.7) * 0.85;
          float dur = 1.05 + fract(aSeed * 11.0) * 0.75;
          float t = clamp((uTime + uAge - aLaunch - delay) / dur, 0.0, 1.0);   // uAge — лише для знімків: стільки секунд «уже минуло»
          float e = t * t * (3.0 - 2.0 * t);
          vFly = e; vRow = aRow; vSeed = aSeed;
          vec3 from = uOrigin + vec3(sin(aSeed * 51.0), cos(aSeed * 37.0), sin(aSeed * 23.0)) * 0.14;
          /* дуга через власну контрольну точку збоку — літери розлітаються врозтіч і сходяться на місця */
          vec3 ctrl = mix(from, aTo, 0.45)
                    + uRight * (sin(aSeed * 61.0) * 1.15)
                    + uUp * (0.25 + fract(aSeed * 17.0) * 0.7);
          vec3 mid = mix(mix(from, ctrl, e), mix(ctrl, aTo, e), e);
          /* сідає з коротким загасаючим коливанням — відчутний «клац» на місце */
          float st = clamp((t - 0.72) / 0.28, 0.0, 1.0);
          mid += (uRight * sin(aSeed * 91.0) + uUp * cos(aSeed * 73.0)) * sin(st * 12.0) * (1.0 - st) * (1.0 - st) * 0.035;
          float sz = aSize * mix(0.42, 1.0, e);
          float sp = sin(aSeed * 29.0) * (1.0 - e) * 3.4;          // у польоті знак крутиться помітніше
          vec2 rp = vec2(position.x * cos(sp) - position.y * sin(sp), position.x * sin(sp) + position.y * cos(sp));
          vec3 w = mid + uRight * (rp.x * sz) + uUp * (rp.y * sz);
          vUv = (aGlyph + vec2(uv.x, 1.0 - uv.y)) / uGrid;   // атлас без flipY, а uv квада рахується знизу
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: `uniform sampler2D uAtlas; uniform vec3 uTint; uniform float uOpacity; uniform float uTime;
        varying vec2 vUv; varying float vFly; varying float vRow; varying float vSeed;
        void main(){
          float a = texture2D(uAtlas, vUv).a;
          if (a < 0.01 || vFly < 0.001) discard;
          float scan = 0.93 + 0.07 * sin(gl_FragCoord.y * 1.35);
          float glow = 1.0 + 1.5 * (1.0 - vFly);                   // у польоті літера світліша, на місці — спокійна
          float land = exp(-pow((vFly - 0.9) * 11.0, 2.0)) * 1.6;   // спалах у мить приземлення
          float beam = exp(-pow((fract(uTime * 0.11) - vRow) * 7.0, 2.0)) * 0.75;   // блік, що повільно сходить по тексту
          vec3 c = uTint * a * uOpacity * scan * (glow + land + beam);
          gl_FragColor = vec4(c, 1.0);
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
  }
  /* розкласти літери по площині абзацу і роздати їм цілі */
  function placeLetters(ww, hh, fsCss, rw, rh) {
    buildLetters();
    if (!letters) return;
    const lay = ledeLayout(letterAtl, fsCss, rw);
    const n = lay.letters.length, scale = ww / rw;
    const to = new Float32Array(n * 3), gl = new Float32Array(n * 2), sz = new Float32Array(n), or = new Float32Array(n), sd = new Float32Array(n), rowv = new Float32Array(n);
    letterOrder = or; letterLaunch = new Float32Array(n).fill(-1);
    const v = new THREE.Vector3();
    lay.letters.forEach((L, i) => {
      wall.localToWorld(v.set((L.cx - rw / 2) * scale, (rh / 2 - L.cy) * scale, 0.004));
      to[i * 3] = v.x; to[i * 3 + 1] = v.y; to[i * 3 + 2] = v.z;
      const gi = letterAtl.index[L.k];
      gl[i * 2] = gi % letterAtl.cols; gl[i * 2 + 1] = Math.floor(gi / letterAtl.cols);
      sz[i] = (LCELL / LFS) * fsCss * scale;
      /* порядок переважно зліва направо, але перемішаний: сусідні літери летять урозтіч, а не ланцюжком */
      /* найпізніший старт + найдовший політ мусять укластися до кінця: 0,46 + 0,48 < 1, інакше частина
         літер так і не сяде на місце */
      or[i] = 0.07 + Math.min(0.83, (i / n) * 0.45 + rnd2() * 0.4);   // скрол відпускає літери приблизно зліва направо
      sd[i] = rnd2();   // власний характер польоту кожної літери
      rowv[i] = L.cy / rh;
    });
    const g = letters.geometry;
    g.setAttribute('aTo', new THREE.InstancedBufferAttribute(to, 3));
    g.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(gl, 2));
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(sz, 1));
    g.setAttribute('aLaunch', new THREE.InstancedBufferAttribute(letterLaunch, 1));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1));
    g.setAttribute('aRow', new THREE.InstancedBufferAttribute(rowv, 1));
    g.instanceCount = n;
    letterMat.uniforms.uRight.value.set(1, 0, 0).applyQuaternion(wall.quaternion);
    letterMat.uniforms.uUp.value.set(0, 1, 0).applyQuaternion(wall.quaternion);
  }
  /* Варіант «Стіна»: площина стоїть праворуч від фігури й похило до глядача, опис лягає на неї.
     Розмір беремо з кадру, щоб вона заповнювала вільну половину екрана, а не тікала за край. */
  function fitWallLede() {
    const b = sceneEl.getBoundingClientRect();
    if (!b.width) return;
    const D = band ? 6.4 : 8.6, TILT = band ? 0.1 : 0.08;
    const cx = band ? 0.18 : 0.5, cy = band ? 0.2 : -0.04;     // центр площини в кадрі
    ndcToWorld.set(cx, cy, 0.5).unproject(camera).sub(camera.position).normalize();
    wall.position.copy(camera.position).addScaledVector(ndcToWorld, D);
    wall.quaternion.copy(camera.quaternion);
    wall.rotateX(-TILT); wall.rotateY(band ? 0.22 : 0.24);      // легкий розворот до фігури, щоб рядки не злипались
    const vh = 2 * D * Math.tan(camera.fov * Math.PI / 360);
    const ww = vh * camera.aspect * (band ? 0.86 : 0.5), hh = vh * (band ? 0.44 : 0.5);
    wall.geometry.dispose();
    wall.geometry = new THREE.PlaneGeometry(ww, hh);
    wall.updateMatrixWorld();
    WW = ww;
    shade.geometry.dispose();
    shade.geometry = new THREE.PlaneGeometry(ww * 1.16, hh * 1.24);
    shade.position.copy(wall.position).addScaledVector(ndcToWorld, -0.1);
    shade.quaternion.copy(wall.quaternion);
    /* кегль підбираємо так, щоб опис уклався в площину: ширина рядка в умовних «пікселях» = 640 */
    const boxW = band ? 640 : 560, fsCss = boxW * (band ? 0.034 : 0.042);   // кегль такий, щоб опис читався і вкладався в площину
    placeLetters(ww, hh, fsCss, boxW, boxW * hh / ww);
    const onPlane = (u, v, out) => wall.localToWorld(out.set(u * ww / 2, v * hh / 2, 0));
    onPlane(-0.9, 1.1, wallOrigin);
    wallCorners.length = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) wallCorners.push(onPlane(sx, sy, new THREE.Vector3()));
    const a = gGeo.attributes.aTo;
    for (let i = 0; i < N; i++) {
      onPlane((rnd2() - 0.5) * 1.9, (rnd2() - 0.5) * 1.9, ledeCorner);
      a.setXYZ(i, ledeCorner.x, ledeCorner.y, ledeCorner.z);
    }
    a.needsUpdate = true;
  }
  const rnd2 = seeded(77);

  function fit() {
    w = Math.max(1, sceneEl.clientWidth); h = Math.max(1, sceneEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    grainMat.uniforms.uPR.value = renderer.getPixelRatio();
    /* площину під абзац рахуємо з базового положення камери — інакше unproject дає не ті координати */
    camera.position.set(target.x + d0 * Math.cos(el0) * Math.sin(az0), target.y + d0 * Math.sin(el0), target.z + d0 * Math.cos(el0) * Math.cos(az0));
    camera.lookAt(target); camera.updateMatrixWorld();
    fitLede();
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
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
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
    outer.position.y = cPos.y + Math.sin(tt * 0.6) * 0.03 + (band ? RISE * fS.pull : 0);
    if (band) outer.scale.setScalar(1 - SHRINK * fS.pull);
    grainMat.uniforms.uOrigin.value.copy(outer.position);          // зерна вилітають із фігури, де б вона не була
    /* камера: обліт без підʼїзду, паралакс від миші або поворот від пальця */
    /* телефон: камера стоїть нерухомо — голограма тексту прибита до місця абзацу, обліт зсунув би її з кадру */
    const az = az0 + (band ? 0 : fS.orbit + mx * 0.14 + yaw), el = el0 + (band ? 0 : fS.elev + my * 0.07);
    const dist = band ? d0 * (1 + PULL_BACK * fS.pull) : d0;
    look.copy(target); if (band) look.x += PULL_SIDE * fS.pull;
    camPos.set(look.x + dist * Math.cos(el) * Math.sin(az), look.y + dist * Math.sin(el), look.z + dist * Math.cos(el) * Math.cos(az));
    camera.position.copy(camPos); camera.lookAt(look);
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const cz = camera.position.distanceTo(outer.position), rr = R * open;
    xray.uCz.value = cz; xray.uCr.value = rr;
    scene.fog.near = cz - rr * 1.1; scene.fog.far = cz + rr * (fogQ != null ? fogQ : 11.0);
    /* проєкція: хвиля росте з точки площини за фігурою; зерна летять на неї */
    if (!band) {
      figRay.origin.copy(camera.position); figRay.direction.copy(outer.position).sub(camera.position).normalize();
      if (!figRay.intersectPlane(wallPlane, wallOrigin)) wallOrigin.copy(wallC);
    }
    let far = 0;
    for (const c of wallCorners) far = Math.max(far, c.distanceTo(wallOrigin));
    wallMat.uniforms.uRadius.value = fS.coverage * far;
    wallMat.uniforms.uOpacity.value = fS.fade;
    wallMat.uniforms.uTime.value = tt; wallMat.uniforms.uSpot.value.copy(spot);
    wall.visible = !band && !wallMode && fS.fade > 0.002;
    shade.visible = (band || wallMode) && fS.fade > 0.002; shadeMat.uniforms.uOp.value = fS.fade * 0.62;
    if (letters) {
      letters.visible = fS.fade > 0.002;
      letterMat.uniforms.uOpacity.value = 1;
      letterMat.uniforms.uTime.value = tt;
      letterMat.uniforms.uOrigin.value.copy(outer.position);
      /* скрол лише відкриває «ворота»: щойно він дійшов до порога літери, та вилітає і далі живе своїм часом */
      let touched = false;
      for (let i = 0; i < letterOrder.length; i++) {
        if (letterLaunch[i] < 0 && fS.fade >= letterOrder[i]) { letterLaunch[i] = tt; touched = true; }
        else if (letterLaunch[i] >= 0 && fS.fade < letterOrder[i] - 0.03) { letterLaunch[i] = -1; touched = true; }
      }
      if (touched) letters.geometry.attributes.aLaunch.needsUpdate = true;
    }
    dustMat.uniforms.uTime.value = tt; nebMat.uniforms.uTime.value = tt;
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
    stepGrid(Math.min(dt / 1000, 0.05));                                 // жива стіна: знаки перебираються й міняються
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
  function blankData() { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); t.needsUpdate = true; return t; }
  /* Атлас: усі знаки, що трапляються в текстах, плюс маленькі графіки — кожен із двох сусідніх комірок.
     Сітка стіни бере звідси знак за номером, тож будь-яку комірку можна змінити окремо. */
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
    /* скільки слотів під знак: його природна ширина в Inter, переведена в слоти стіни */
    const slotW = WW / COLS, fsWorld = (H / ROWS) * 0.74;
    const ratio = {}, slots = {};
    for (const ch of set) { const w = g.measureText(ch).width / fsm; ratio[ch] = w; slots[ch] = Math.max(1, Math.round(w * fsWorld / slotW)); }
    const at = (i) => [(i % cols) * cell, Math.floor(i / cols) * cell];
    /* знак малюємо розтягнутим на всю комірку атласа — на стіні він стиснеться назад до своїх k слотів */
    set.forEach((ch, i) => {
      if (ch === ' ') return;
      const [x, y] = at(i), w = ratio[ch] * fsm;
      g.save(); g.translate(x + cell * 0.04, y + cell * 0.76); g.scale((cell * 0.92) / w, 1);
      g.fillText(ch, 0, 0); g.restore();
    });
    const r = seeded(5), charts = [];
    kinds.forEach((kind, k) => {
      const gi = set.length + k, [x, y] = at(gi);
      drawGlyphChart(g, kind, x, y, cell, cell, r);          // у квадраті: на стіні розтягнеться до 2:1
      charts.push({ gi, k: Math.max(2, Math.round((H / ROWS) * 2 / slotW)) });
    });
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const index = {}; set.forEach((ch, i) => { index[ch] = i; });
    return { tex, cols, rows, index, letters: set.length, charts, slotsOf: (ch) => slots[ch] || slots[' '] };
  }
  /* графік у прямокутнику w×h — той самий словник, що був у написах: стовпчики, тренд, воронка, кільце */
  function drawGlyphChart(g, kind, x, y, w, h, r) {
    const pad = h * 0.22, top = y + pad, ch = h - pad * 2, cw = w - pad * 2, ox = x + pad;
    g.lineWidth = Math.max(1.5, h * 0.075);
    if (kind === 'bars') {
      const n = 5, bw = cw / (n * 1.6);
      for (let i = 0; i < n; i++) { const bh = ch * (0.24 + 0.76 * (i / (n - 1))); g.fillRect(ox + i * bw * 1.6, top + ch - bh, bw, bh); }
    } else if (kind === 'rise' || kind === 'drop') {
      const n = 6; g.beginPath();
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), v = (kind === 'rise' ? t : 1 - t) * 0.8 + 0.1 * r();
        const py = top + ch - Math.min(ch, ch * (0.1 + 0.85 * v));
        i ? g.lineTo(ox + t * cw, py) : g.moveTo(ox, py);
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
