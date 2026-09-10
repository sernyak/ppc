/*
 * Хореографія «Кристал збирає себе» — чиста функція без DOM і three.js.
 * Вхід: p — прогрес скролу першого екрана (0..1), introT — прогрес вступу
 * при відкритті (0..1), n — кількість ліній каркаса. Вихід — числа кадру.
 *
 * Вступ (introT): точки → лінії малюються → грані сходяться → ядро тліє.
 * Скрол (p, лише після вступу): каркас загоряється знизу вгору, хвиля світла
 * і вогники пришвидшуються, грані «дихають» (ледь розходяться й сходяться),
 * ребра оболонки підсвічуються, камера обходить кристал.
 */
export const CFG = {
  intro: {
    dots: [0.0, 0.28],      // вікно появи точок
    struts: [0.14, 0.72],   // вікно малювання ліній (кожна — у своєму підвікні strutLen)
    strutLen: 0.10,
    close: [0.42, 0.98],    // грані сходяться
    ignite: [0.84, 1.0],    // ядро тліє
  },
  scroll: {
    light: [0.0, 0.62],     // лінії загоряються знизу вгору
    strutLen: 0.12,
    breathe: [0.18, 0.92],  // грані ледь розходяться й сходяться
    breatheMax: 0.20,       // у радіусах кристала
    edges: [0.55, 0.95],    // ребра оболонки підсвічуються
    orbit: 0.9,             // обліт камери, радіани
    elev: 0.08,             // підйом камери, радіани
  },
  openMax: 0.62,            // на скільки радіусів розведені грані на старті
  pulse: { base: 0.35, gain: 1.2 },
  restCore: 0.45,           // яскравість ядра у спокої після вступу
};

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

export function getFrame(p, introT, n, cfg = CFG) {
  p = clamp01(p); introT = clamp01(introT);
  const I = cfg.intro, S = cfg.scroll, after = introT >= 1;
  const dots = clamp01((introT - I.dots[0]) / (I.dots[1] - I.dots[0]));
  const struts = new Array(n);
  const drawSpan = I.struts[1] - I.struts[0] - I.strutLen;
  const litSpan = S.light[1] - S.light[0] - S.strutLen;
  for (let i = 0; i < n; i++) {
    const k = n > 1 ? i / (n - 1) : 0;
    const draw = clamp01((introT - (I.struts[0] + drawSpan * k)) / I.strutLen);
    const lit = after ? clamp01((p - (S.light[0] + litSpan * k)) / S.strutLen) : 0;
    struts[i] = { draw, lit };
  }
  const closed = smooth(I.close[0], I.close[1], introT);
  const breathe = after ? Math.sin(Math.PI * smooth(S.breathe[0], S.breathe[1], p)) * S.breatheMax : 0;
  const open = (1 - closed) * cfg.openMax + breathe;
  const core = smooth(I.ignite[0], I.ignite[1], introT) * (cfg.restCore + (1 - cfg.restCore) * smooth(0, 0.5, p));
  const wave = after ? 0.25 + 0.75 * smooth(0, 0.6, p) : 0;
  const pulseSpeed = cfg.pulse.base + cfg.pulse.gain * p;
  const edges = after ? smooth(S.edges[0], S.edges[1], p) : 0;
  const orbit = p * S.orbit, elev = p * S.elev;
  const phase = introT < I.struts[0] ? 0 : introT < I.close[0] ? 1 : !after ? 2 : (p < 0.05 ? 2 : 3);
  return { p, introT, dots, struts, open, core, wave, pulseSpeed, edges, orbit, elev, phase };
}
