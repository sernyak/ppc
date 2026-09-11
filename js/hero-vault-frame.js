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
  figureSpan: 0.6,         // історія фігури (розкриття → світло) вкладається в перші 60 % скролу
  coverage: [0.04, 0.62],  // проєкція розходиться по площині від фігури до країв
  grains: [0.06, 0.66],    // зерна світла летять від фігури на площину
  spin: Math.PI * 2,       // повний оберт фігури за скрол
  orbit: 0.45,             // обліт камери, радіани
  elev: 0.06,
};

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

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
    grains: smooth(cfg.grains[0], cfg.grains[1], ps),
    spin: cfg.spin * s, orbit: cfg.orbit * s, elev: cfg.elev * s, after,
  };
}
