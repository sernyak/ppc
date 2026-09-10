/*
 * Хореографія першого екрана /ai «Сховище» — чисті функції без DOM і three.js,
 * щоб її можна було тестувати в node.
 *
 * Завантаження (introT 0→1, ~1,8 с) — лише поява: кристал зʼявляється й повільно
 * обертається, ядро ледь тліє, біля кристала на стінах проступає слабкий відблиск
 * формул. Зала темна. Це запрошення, а не шоу.
 *
 * Скрол (p 0→1) — головне: активація (ядро спалахує, світлові смужки ґратки
 * загоряються, під кристалом зʼявляється світло на підлозі), проєкція
 * «виливається» на стіни від кристала до далекого краю зали, летять зерна світла
 * й промені, під кінець загоряється задня стіна; кристал робить повний оберт,
 * піднімається й трохи росте, камера підʼїжджає до нього й облітає збоку.
 * Усе — функції від p, тому скрол назад складає все назад.
 */
export const CFG = {
  introMs: 1800,
  intro: {
    appear: [0.0, 0.7],     // кристал зʼявляється (масштаб і яскравість)
    core: [0.25, 1.0],      // ядро тліє до рівня спокою
    strips: [0.35, 1.0],
    hint: [0.5, 1.0],       // слабкий відблиск формул біля кристала
  },
  rest: { core: 0.35, strips: 0.15, coverage: 0.06 },   // стан спокою після появи при p = 0
  scroll: {
    activate: [0.0, 0.22],  // ядро, смужки, світло на підлозі
    coverage: [0.08, 0.72], // проєкція доходить до далекого краю зали
    beams: [0.15, 0.75],
    grains: [0.12, 0.8],
    back: [0.55, 1.0],      // задня стіна
    dolly: 0.15,            // частка відстані до кристала
    orbit: 0.62,            // радіани, обліт камери
    elev: 0.05,
    spin: Math.PI * 2,      // повний оберт кристала
    rise: 0.45,             // підйом кристала, одиниці сцени
    scale: 1.04,            // кристал ледь росте
  },
};

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

/**
 * @param {number} p — прогрес скролу 0…1
 * @param {number} introT — прогрес появи 0…1
 * @returns {{appear:number, core:number, strips:number, glow:number, coverage:number, back:number,
 *            beams:number, grains:number, dolly:number, orbit:number, elev:number, spin:number,
 *            rise:number, scale:number, after:boolean}}
 */
export function getFrame(p, introT, cfg = CFG) {
  p = clamp01(p); introT = clamp01(introT);
  const I = cfg.intro, S = cfg.scroll, R = cfg.rest;
  const after = introT >= 1;
  const k = after ? 1 : introT * introT;   // під час появи скрол діє слабко, щоб не ламати вступ

  const appear = smooth(I.appear[0], I.appear[1], introT);
  const coreRest = R.core * smooth(I.core[0], I.core[1], introT);
  const stripsRest = R.strips * smooth(I.strips[0], I.strips[1], introT);
  const coverageRest = R.coverage * smooth(I.hint[0], I.hint[1], introT);

  const act = smooth(S.activate[0], S.activate[1], p) * k;
  const core = coreRest + (1 - coreRest) * act;
  const strips = stripsRest + (1 - stripsRest) * act;
  const coverage = coverageRest + (1 - coverageRest) * smooth(S.coverage[0], S.coverage[1], p) * k;
  const beams = smooth(S.beams[0], S.beams[1], p) * k;
  const grains = smooth(S.grains[0], S.grains[1], p) * k;
  const back = smooth(S.back[0], S.back[1], p) * k;
  const s = smooth(0, 1, p) * k;
  return {
    appear, core: clamp01(core), strips: clamp01(strips), glow: act, coverage: clamp01(coverage), back, beams, grains,
    dolly: S.dolly * s, orbit: S.orbit * s, elev: S.elev * s, spin: S.spin * s, rise: S.rise * s, scale: 1 + (S.scale - 1) * s,
    after,
  };
}
