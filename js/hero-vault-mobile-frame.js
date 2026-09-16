/*
 * «Сховище», ТЕЛЕФОН — хореографія без DOM і three.js. Компʼютер має свій
 * модуль і розвивається окремо; тут лише вузький екран.
 *
 * Фігура — як на /preview/3d-v6/ (вузли → ґратка → каркас → світло, від
 * скролу ґратка провертається, фігура докручується; каркас не розсувається).
 *
 * Скрол на телефоні має дві ділянки:
 *  pre — сторінка ще їде вгору, поки опис цілком не зʼявиться на екрані;
 *        фігура тим часом трохи меншає, звільняючи місце опису;
 *  pin — hero стоїть на місці («прилип»), і скрол перекидає пластинки табло:
 *        літери опису проявляються хвилею в порядку читання.
 * Кожна випущена літера доперекидається за власним часом, а якщо скрол
 * пролетів ділянку разом, літери стають у чергу — табло однаково біжить
 * хвилею, і сторінка тримається, доки воно не складеться.
 */
export const FIG = {
  intro: {
    joints: [0.0, 0.26],
    inner: [0.14, 0.66],
    innerLen: 0.10,
    outer: [0.44, 0.96],
    outerLen: 0.12,
    light: [0.80, 1.0],
  },
  scroll: {
    light: [0.0, 0.6],
    swivel: [0.0, 0.9],
    swivelMax: Math.PI / 2,
    spin: 0.8,
  },
  restLight: 0.38,
  pulse: { base: 0.4, gain: 1.6 },
};

export const CFG = {
  introMs: 2400,
  pull: [0.05, 0.85],       // частка ділянки pre: фігура меншає, поки сторінка доїжджає до опису
  pinScreens: 1.1,          // довжина ділянки pin у висотах екрана
  beams: [0.0, 0.14],       // частка pin: промені від фігури до опису проступають разом із першими літерами
  shade: [0.0, 0.12],       // частка pin: темна підкладка під описом
  order: { spread: 0.86, jitter: 0.06 },   // коли скрол відпускає i-ту літеру (частка pin): у порядку читання, з ледь помітним розкидом
  flap: { flips: 3, dur: 0.15, burst: 1.3 },   // burst — за скільки секунд пробігає хвиля, якщо скрол відпустив усе одразу
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

/** Фігура: p — прогрес її історії (0…1), introT — прогрес вступу. */
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

/**
 * Сцена: pre і pin — прогрес двох ділянок скролу (0…1). До кінця вступу скрол не діє.
 * story — наскрізний прогрес для історії фігури.
 */
export function getFrame(pre, pin, introT, cfg = CFG) {
  const after = clamp01(introT) >= 1;
  pre = after ? clamp01(pre) : 0; pin = after ? clamp01(pin) : 0;
  return {
    pull: smooth(cfg.pull[0], cfg.pull[1], pre),
    story: clamp01(pre * 0.35 + pin * 0.65),
    beams: smooth(cfg.beams[0], cfg.beams[1], pin),
    shade: smooth(cfg.shade[0], cfg.shade[1], pin),
    release: pin,
    after,
  };
}

/** Поріг ділянки pin, на якому скрол відпускає i-ту з n літер (r — випадкове 0…1). */
export function letterOrder(i, n, r, cfg = CFG) {
  const O = cfg.order;
  return 0.01 + (n > 1 ? i / (n - 1) : 0) * O.spread + r * O.jitter;
}

/**
 * Черга запуску: літера не стартує раніше за попередню більш ніж на крок хвилі.
 * Повільний скрол черги не помічає, а якщо скрол відпустив усе одразу — табло все одно біжить хвилею.
 * @returns час старту цієї літери
 */
export function queueLaunch(now, lastStart, n, cfg = CFG) {
  const gap = cfg.flap.burst / Math.max(1, n);
  return Math.max(now, lastStart + gap);
}

/** Найдовше, скільки сторінка може тримати людину на описі, якщо вона пролетіла його одним змахом. */
export function maxHold(cfg = CFG) { return cfg.flap.burst + cfg.flap.flips * cfg.flap.dur; }
