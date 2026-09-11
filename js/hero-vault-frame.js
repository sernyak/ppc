/*
 * Хореографія сцени «Сховище» навколо радіанта — чисті функції без DOM і
 * three.js. Сам радіант (поява каркаса, розкриття, ґратка, спиці, поворот,
 * світло) живе в hero-crystal-frame.js — це той самий модуль, що й на
 * /preview/3d/. Тут лише те, що довкола: голограми формул у повітрі, зерна
 * світла, оберт фігури й обліт камери. Усе — функції від прогресу скролу p,
 * скрол назад складає все назад; до кінця вступу скрол не діє.
 */
export const CFG = {
  holo: [0.42, 0.96],      // голограми проступають від ближніх до дальніх
  holoLen: 0.2,            // вікно появи одного напису (частка прогресу голограм)
  grains: [0.58, 0.95],    // зерна світла розлітаються від фігури
  spin: Math.PI * 2,       // повний оберт фігури за скрол
  orbit: 0.45,             // обліт камери, радіани
  elev: 0.06,
};

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

/** Вікно появи напису i з n за загальним прогресом голограм holo (0…1): ближні першими. */
export function holoWindow(i, n, holo, len = CFG.holoLen) {
  const start = (n > 1 ? i / (n - 1) : 0) * (1 - len);
  let v = (holo - start) / len;
  if (v > 1 - 1e-9) v = 1;                                   // без хвостів плаваючої коми в самому кінці вікна
  return clamp01(v);
}

/**
 * @param {number} p — прогрес скролу 0…1
 * @param {number} introT — прогрес вступу 0…1 (скрол діє лише після вступу)
 */
export function getFrame(p, introT, cfg = CFG) {
  p = clamp01(p); introT = clamp01(introT);
  const after = introT >= 1, ps = after ? p : 0;
  const s = smooth(0, 1, ps);
  return {
    holo: smooth(cfg.holo[0], cfg.holo[1], ps),
    grains: smooth(cfg.grains[0], cfg.grains[1], ps),
    spin: cfg.spin * s, orbit: cfg.orbit * s, elev: cfg.elev * s, after,
  };
}
