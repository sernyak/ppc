/*
 * Хореографія першого екрана /ai «Сховище» — чисті функції без DOM і three.js,
 * щоб її можна було тестувати в node.
 *
 * Вступ (introT 0→1, ~2,6 с): темна зала → ядро кристала загоряється → ґратка
 * світиться → проєкція «виливається» на стіни довкола кристала → зʼявляються
 * промені. Після вступу зала в стані спокою: стіни освітлені приблизно
 * наполовину від кристала.
 *
 * Скрол (p 0→1): проєкція повзе по стінах від кристала до далекого краю зали,
 * під кінець загоряється задня стіна; камера підʼїжджає до кристала й трохи
 * обходить його; промені густішають; кристал повільно провертається.
 * Усе — функції від p, тому скрол назад складає все назад.
 */
export const CFG = {
  introMs: 2600,
  intro: {
    core: [0.0, 0.32],      // ядро й ґратка загоряються
    lattice: [0.12, 0.55],
    walls: [0.3, 1.0],      // проєкція розходиться по стінах до стану спокою
    beams: [0.5, 1.0],
    halo: [0.2, 0.8],
  },
  rest: { coverage: 0.42, beams: 0.5, halo: 0.55 },   // стан спокою після вступу при p = 0
  scroll: {
    coverage: [0.0, 0.82],  // проєкція доходить до далекого краю
    back: [0.5, 1.0],       // задня стіна
    beams: [0.0, 0.7],
    dolly: 0.16,            // частка відстані до кристала
    orbit: 0.26,            // радіани, обліт камери
    elev: 0.05,
    spin: 0.7,              // поворот кристала, радіани
  },
};

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

/**
 * @param {number} p — прогрес скролу 0…1
 * @param {number} introT — прогрес вступу 0…1
 * @returns {{core:number, lattice:number, coverage:number, back:number, beams:number, halo:number,
 *            dolly:number, orbit:number, elev:number, spin:number, after:boolean}}
 */
export function getFrame(p, introT, cfg = CFG) {
  p = clamp01(p); introT = clamp01(introT);
  const I = cfg.intro, S = cfg.scroll, R = cfg.rest;
  const after = introT >= 1;
  const k = after ? 1 : introT * introT;   // під час вступу скрол діє слабко, щоб не ламати вступ

  const core = smooth(I.core[0], I.core[1], introT);
  const lattice = smooth(I.lattice[0], I.lattice[1], introT);
  const wallsIntro = smooth(I.walls[0], I.walls[1], introT);
  const coverage = R.coverage * wallsIntro + (1 - R.coverage) * smooth(S.coverage[0], S.coverage[1], p) * k;
  const back = smooth(S.back[0], S.back[1], p) * k;
  const beams = R.beams * smooth(I.beams[0], I.beams[1], introT) + (1 - R.beams) * smooth(S.beams[0], S.beams[1], p) * k;
  const halo = R.halo * smooth(I.halo[0], I.halo[1], introT) + (1 - R.halo) * smooth(0, 1, p) * k;
  const s = smooth(0, 1, p) * k;
  return {
    core, lattice, coverage: clamp01(coverage), back, beams: clamp01(beams), halo: clamp01(halo),
    dolly: S.dolly * s, orbit: S.orbit * s, elev: S.elev * s, spin: S.spin * s, after,
  };
}
