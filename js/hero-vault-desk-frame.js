/*
 * «Сховище», КОМПʼЮТЕР — хореографія без DOM і three.js. Телефон має свій
 * модуль і розвивається окремо; тут лише десктоп.
 *
 * Фігура — як на /preview/3d-v6/: при відкритті з простору виринають усі
 * вузли (зовнішні й внутрішні), між ними малюється внутрішня ґратка зі
 * спицями, зовнішні бруси замикають каркас, займається світло. Зі скролом
 * ґратка провертається на чверть оберту (спиці витягуються і знову стають
 * прямими), фігура докручується, світло розгоряється й пульсує. На відміну
 * від v6, каркас НЕ розсувається — фігура не росте (прохання власника).
 *
 * Сцена, у такому порядку: фігура повністю зʼявляється (усі вузли, ґратка,
 * каркас, світло) → заголовок плавно підіймається й звільняє місце → перше
 * речення опису САМЕ проявляється ефектом табло (перекидні пластинки); поле
 * формул за фігурою тим часом ледь тліє.
 * Скрол випускає вогники з ядра, поле формул стає яскравим, а решта опису
 * проявляється тим самим табло — хвилею в порядку читання (вилітання літер
 * з ядра прибрано: власнику воно гальмувало скрол).
 */
export const FIG = {
  intro: {
    joints: [0.0, 0.26],    // вузли виринають знизу вгору
    inner: [0.14, 0.66],    // внутрішня ґратка і спиці малюються
    innerLen: 0.10,
    outer: [0.44, 0.96],    // зовнішні бруси ростуть і замикають каркас
    outerLen: 0.12,
    light: [0.80, 1.0],     // світлові лінії займаються
  },
  scroll: {
    light: [0.0, 0.6],      // світло розгоряється до повного
    swivel: [0.0, 0.9],     // внутрішня ґратка провертається
    swivelMax: Math.PI / 2, // чверть оберту: кубооктаедр збігається сам із собою, спиці знову прямі
    spin: 0.8,              // додатковий поворот усієї фігури, радіани
  },
  restLight: 0.38,          // яскравість світла у спокої після вступу
  pulse: { base: 0.4, gain: 1.6 },
};

export const CFG = {
  introMs: 2400,
  /* Доріжка прилипання коротка (150vh, тобто пів екрана скролу): уся історія — вогники, поле формул,
     поворот фігури й випуск літер — вкладається в той самий відрізок, де вилітають літери. Щойно вони сіли,
     сторінка одразу гортається далі: крутити голограму скролом після тексту вже не треба (прохання власника). */
  trackVh: 150,
  figureSpan: 0.9,          // історія фігури (поворот ґратки, світло) — за той самий відрізок
  /* ґратка вже зібрана при завантаженні, тож чекати нічого: перший рух скролу випускає вогники,
     і за ними одразу розгоряється поле формул */
  grains: [0.03, 0.7],
  fade: [0.08, 0.85],       // яскравість поля формул і випуск решти літер опису
  coverage: [0.05, 0.9],    // хвиля поля формул від фігури до країв
  orbit: 0.45,              // обліт камери, радіани (0,6 відносило поле формул аж у правий кут)
  elev: 0.08,
  /* що сцена робить сама після вступу: поле формул тліє (wall — частка повної яскравості) */
  rest: { dur: 2.0, wall: 0.12, cover: 0.32 },
  /* заголовок підіймається, щойно фігура повністю зʼявилась; скільки секунд триває підйом */
  titleRise: 1.0,
  /* табло: кожна літера першого речення кілька разів перекидає пластинку й зупиняється на своєму знаку;
     delay (секунд від кінця вступу) — щоб табло почалось, коли заголовок уже звільнив місце */
  flap: { delay: 1.05, spread: 1.1, jitter: 0.15, flips: 3, dur: 0.15, burst: 1.1 },
  /* решта опису: коли скрол відпускає j-ту літеру (частка fade) — у порядку читання, з ледь помітним розкидом;
     не раніше за min, інакше при скролі назад літера не ховалася б (fade < поріг − 0,03 ніколи не справджується) */
  order: { min: 0.04, spread: 0.8, jitter: 0.05 },
};

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

function windows(n, t, span, len) {
  const out = new Array(n), w = span[1] - span[0] - len;
  for (let i = 0; i < n; i++) {
    const k = n > 1 ? i / (n - 1) : 0;
    let v = (t - (span[0] + w * k)) / len;
    if (v > 1 - 1e-9) v = 1;
    out[i] = clamp01(v);
  }
  return out;
}

/** Прогрес для фігури: її історія проходить за перші figureSpan скролу. */
export function figureProgress(p, cfg = CFG) { return clamp01(clamp01(p) / cfg.figureSpan); }

/**
 * Фігура: p — прогрес її історії (0…1), introT — прогрес вступу.
 * counts = {joints, inner, outer}: вузли всі разом, ґратка разом зі спицями, зовнішні бруси.
 */
export function figureFrame(p, introT, counts, fig = FIG) {
  p = clamp01(p); introT = clamp01(introT);
  const I = fig.intro, S = fig.scroll, after = introT >= 1, ps = after ? p : 0;
  return {
    joints: windows(counts.joints, introT, I.joints, 0.08),
    inner: windows(counts.inner, introT, I.inner, I.innerLen),
    outer: windows(counts.outer, introT, I.outer, I.outerLen),
    light: after ? fig.restLight + (1 - fig.restLight) * smooth(S.light[0], S.light[1], ps) : smooth(I.light[0], I.light[1], introT) * fig.restLight,
    wave: 0.35 + 0.65 * smooth(0, 0.6, ps),
    pulseSpeed: fig.pulse.base + fig.pulse.gain * ps,
    swivel: S.swivelMax * smooth(S.swivel[0], S.swivel[1], ps),
    spin: S.spin * smooth(0, 1, ps),
  };
}

/** Сцена довкола фігури: p — прогрес скролу 0…1; до кінця вступу скрол не діє. */
export function getFrame(p, introT, cfg = CFG) {
  p = clamp01(p); introT = clamp01(introT);
  const after = introT >= 1, ps = after ? p : 0;
  const s = smooth(0, 1, ps);
  return {
    coverage: smooth(cfg.coverage[0], cfg.coverage[1], ps),
    fade: smooth(cfg.fade[0], cfg.fade[1], ps),
    grains: smooth(cfg.grains[0], cfg.grains[1], ps),
    orbit: cfg.orbit * s, elev: cfg.elev * s, after,
  };
}

/** Рівні, які сцена тримає сама після вступу, без скролу (sinceIntro — секунд від кінця вступу). */
export function introRelease(sinceIntro, cfg = CFG) {
  const s = smooth(0, 1, clamp01(sinceIntro / cfg.rest.dur));
  return { wall: cfg.rest.wall * s, cover: cfg.rest.cover * s };
}

/**
 * Табло: коли (у секундах від кінця вступу) i-та з n літер починає перекидати пластинки.
 * Хвиля йде зліва направо, з легким розкидом, щоб не було механічного ланцюжка.
 * @param {number} r — випадкове 0…1 для цієї літери
 */
export function flapStart(i, n, r, cfg = CFG) {
  const F = cfg.flap;
  return F.delay + (n > 1 ? i / (n - 1) : 0) * F.spread + r * F.jitter;
}

/** Поріг fade, на якому скрол відпускає j-ту з m літер решти опису (r — випадкове 0…1). */
export function restOrder(j, m, r, cfg = CFG) {
  const O = cfg.order;
  return O.min + (m > 1 ? j / (m - 1) : 0) * O.spread + r * O.jitter;
}

/**
 * Черга: літера не стартує раніше за попередню більш ніж на крок хвилі. Повільний скрол черги не помічає,
 * а якщо швидкий скрол відпустив усе разом — табло однаково біжить хвилею за burst секунд.
 */
export function queueLaunch(now, lastStart, m, cfg = CFG) {
  return Math.max(now, lastStart + cfg.flap.burst / Math.max(1, m));
}

/** Найдовше, скільки сторінка тримає швидкий скрол, поки табло решти опису складається. */
export function maxHold(cfg = CFG) { return cfg.flap.burst + cfg.flap.flips * cfg.flap.dur; }

/*
 * Поява у фото-варіанті — «вибух із ядра». Спершу в центрі розгоряється іскра, тоді всі 24 вузли вилітають
 * із неї на свої місця (внутрішні — першими, у них коротший шлях) з легким перельотом, світяться в польоті й
 * мʼяко спалахують у мить посадки; лише потім між ними проростають лінії. Один рух, без мерехтіння.
 */
export const BURST = {
  core: [0.0, 0.16],        // іскра в центрі розгоряється
  fly: [0.12, 0.46],        // вікно, у якому вузли вилітають
  flyLen: 0.2,              // скільки летить кожен
  land: 0.14,               // спалах після посадки й згасання
};
/** Фігура для фото-варіанта: лінії проростають лише після того, як вузли сіли. */
export const FIG_BURST = { ...FIG, intro: { ...FIG.intro, inner: [0.46, 0.76], innerLen: 0.1, outer: [0.58, 0.97], outerLen: 0.12, light: [0.8, 1.0] } };

function easeOutBack(u) { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }

/**
 * @param {number} introT — прогрес вступу 0…1
 * @param {number[]} ranks — черга кожного вузла 0…1 (менше — вилітає раніше)
 * @returns {{core: number, joints: {pos: number, scale: number, glow: number}[]}}
 *   pos — частка шляху від центру до місця вузла (з перельотом), scale — розмір, glow — світіння іскри
 */
export function burstFrame(introT, ranks, cfg = BURST) {
  const t = clamp01(introT), w = cfg.fly[1] - cfg.fly[0] - cfg.flyLen;
  const joints = ranks.map((k) => {
    const s0 = cfg.fly[0] + clamp01(k) * w, u = clamp01((t - s0) / cfg.flyLen);
    const after = clamp01((t - s0 - cfg.flyLen) / cfg.land);
    const landed = t >= s0 + cfg.flyLen;
    const bump = landed ? Math.sin(Math.PI * after) : 0;          // мʼякий спалах: 0 → пік → 0
    return {
      pos: landed ? 1 : u <= 0 ? 0 : easeOutBack(u),
      scale: smooth(0, 0.35, u) * (1 + 0.28 * bump),
      glow: !landed ? smooth(0, 0.25, u) * (0.5 + 0.5 * u) : 1 - smooth(0, 1, after),   // займається плавно, не стрибком
    };
  });
  const core = smooth(cfg.core[0], cfg.core[1], t) * (1 - smooth(cfg.fly[0] + 0.04, cfg.fly[0] + 0.22, t));
  return { core, joints };
}

/** Коли табло цілком зупиниться: остання літера + усі її перекидання. */
export function flapDone(cfg = CFG) {
  const F = cfg.flap;
  return F.delay + F.spread + F.jitter + F.flips * F.dur;
}
