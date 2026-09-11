/*
 * Хореографія сцени «Сховище» навколо радіанта — чисті функції без DOM і
 * three.js. Сам радіант (поява каркаса, розкриття, ґратка, спиці, поворот,
 * світло) живе в hero-crystal-frame.js — це той самий модуль, що й на
 * /preview/3d/; тут його історія стиснута в першу частину скролу
 * (figureProgress), щоб невелика прокрутка одразу запускала розкриття.
 * Своє тут: проєкція формул на невидиму площину збоку (розходиться від фігури
 * до країв), зерна світла, що летять на неї, оберт фігури й обліт камери.
 * Усе — функції від прогресу скролу p, скрол назад складає все назад; до
 * кінця вступу скрол не діє.
 */
export const CFG = {
  /* Поява при завантаженні — своя, не з модуля орієнтира: спершу з простору злітаються всі вузли
     (кожен спалахує ще в польоті й сідає на своє місце), коротка пауза з ледь помітним «вдихом» —
     і лише потім між ними по черзі проростають бруси. Так дві дії не накладаються одна на одну. */
  intro: {
    /* частки від 2400 мс: вузли летять 0–912 мс, далі пауза ~730 мс, бруси 1640–2400 мс */
    dots: [0, 0.38], dotLen: 0.2375,   // вікно прильоту вузлів і тривалість прильоту кожного
    drift: 0.62,                       // звідки летить вузол: частка розміру фігури понад своє місце
    links: [0.683, 1], linkLen: 0.19,  // бруси проростають лише після того, як усі вузли на місцях
    bump: 0.22,                        // «вдих» вузлів на паузі перед зʼєднанням
  },
  figureSpan: 0.6,         // історія фігури (розкриття → світло) вкладається в перші 60 % скролу
  /* черга подій при скролі: спершу на очах збирається внутрішня ґратка-ядро (вона малюється в перші ~0,2
     скролу) — її нічим не перекриваємо; далі з ядра вирушають зерна; і аж потім наздоганяють написи,
     які не вмикаються різко, а плавно набирають яскравість */
  grains: [0.1, 0.64],     // зерна світла летять із ядра на площину — коли ґратка вже впізнавана
  fade: [0.24, 0.52],      // яскравість проєкції
  coverage: [0.24, 0.78],  // і сама хвиля написів по площині — від фігури до країв
  spin: Math.PI * 2,       // повний оберт фігури за скрол
  orbit: 0.45,             // обліт камери, радіани
  elev: 0.06,
};

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

/** Вікна появи: n елементів по черзі проходять свій відрізок довжиною len усередині span. */
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

/**
 * Поява фігури при завантаженні — замінює вступ модуля орієнтира.
 * @returns {{joints: number[], drift: number[], edges: number[]}}
 *   joints — масштаб вузла, drift — у скільки разів він ще далі від центру, ніж його місце,
 *   edges — на яку частку намальовано брус.
 */
export function introFrame(introT, counts, cfg = CFG) {
  const t = clamp01(introT), I = cfg.intro;
  const fly = windows(counts.jointsOuter, t, I.dots, I.dotLen);
  const bump = smooth(I.links[0] - 0.1, I.links[0], t) * (1 - smooth(I.links[0], I.links[0] + 0.14, t));
  return {
    joints: fly.map((u) => smooth(0, 0.45, u) * (1 + I.bump * bump)),   // спалахує ще в польоті
    drift: fly.map((u) => 1 + I.drift * (1 - smooth(0, 1, u))),
    edges: windows(counts.outer, t, I.links, I.linkLen),
  };
}

/** Прогрес для модуля фігури: її історія проходить за перші figureSpan скролу. */
export function figureProgress(p, cfg = CFG) { return clamp01(clamp01(p) / cfg.figureSpan); }

/**
 * @param {number} p — прогрес скролу 0…1
 * @param {number} introT — прогрес вступу 0…1 (скрол діє лише після вступу)
 */
export function getFrame(p, introT, cfg = CFG) {
  p = clamp01(p); introT = clamp01(introT);
  const after = introT >= 1, ps = after ? p : 0;
  const s = smooth(0, 1, ps);
  return {
    coverage: smooth(cfg.coverage[0], cfg.coverage[1], ps),
    fade: smooth(cfg.fade[0], cfg.fade[1], ps),
    grains: smooth(cfg.grains[0], cfg.grains[1], ps),
    spin: cfg.spin * s, orbit: cfg.orbit * s, elev: cfg.elev * s, after,
  };
}
