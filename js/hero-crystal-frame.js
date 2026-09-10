/*
 * Хореографія «Каркас збирає себе» — чиста функція без DOM і three.js.
 * Вхід: p — прогрес скролу першого екрана (0..1), introT — прогрес вступу
 * при відкритті (0..1), counts — скільки елементів у групах.
 *
 * Вступ (introT): вузли → внутрішня ґратка малюється → зовнішні бруси
 * замикають каркас → світлові лінії всередині займаються.
 * Скрол (p, лише після вступу): зовнішній каркас розсувається, внутрішня
 * ґратка провертається на чверть оберту (спиці витягуються і знову стають
 * прямими), світло всередині розгоряється, пульс пришвидшується, камера
 * обходить фігуру. Скрол назад складає все назад.
 */
export const CFG = {
  intro: {
    joints: [0.0, 0.26],    // вузли зʼявляються знизу вгору
    inner: [0.14, 0.66],    // внутрішня ґратка і спиці малюються
    innerLen: 0.10,
    outer: [0.44, 0.96],    // зовнішні бруси ростуть і замикають каркас
    outerLen: 0.12,
    light: [0.80, 1.0],     // світлові лінії займаються
  },
  scroll: {
    light: [0.0, 0.6],      // світло розгоряється до повного
    open: [0.04, 0.78],     // зовнішній каркас розсувається
    openMax: 0.34,          // на скільки (частка розміру)
    swivel: [0.0, 0.9],     // внутрішня ґратка провертається
    swivelMax: Math.PI / 2, // чверть оберту: кубооктаедр збігається сам із собою, спиці знову прямі
    orbit: 0.6,             // обліт камери, радіани
    elev: 0.08,
    spin: 0.8,              // додатковий поворот усієї фігури, радіани
  },
  restLight: 0.38,          // яскравість світла у спокої після вступу
  pulse: { base: 0.4, gain: 1.6 },
};

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

function windows(n, t, span, len) {
  const out = new Array(n), w = span[1] - span[0] - len;
  for (let i = 0; i < n; i++) { const k = n > 1 ? i / (n - 1) : 0; out[i] = clamp01((t - (span[0] + w * k)) / len); }
  return out;
}

export function getFrame(p, introT, counts, cfg = CFG) {
  p = clamp01(p); introT = clamp01(introT);
  const I = cfg.intro, S = cfg.scroll, after = introT >= 1;
  const joints = windows(counts.joints, introT, I.joints, 0.08);
  const inner = windows(counts.inner, introT, I.inner, I.innerLen);
  const outer = windows(counts.outer, introT, I.outer, I.outerLen);
  const light = after ? cfg.restLight + (1 - cfg.restLight) * smooth(S.light[0], S.light[1], p) : smooth(I.light[0], I.light[1], introT) * cfg.restLight;
  const wave = after ? 0.35 + 0.65 * smooth(0, 0.6, p) : 0.35;
  const pulseSpeed = cfg.pulse.base + cfg.pulse.gain * p;
  const open = after ? 1 + S.openMax * smooth(S.open[0], S.open[1], p) : 1;
  const swivel = after ? S.swivelMax * smooth(S.swivel[0], S.swivel[1], p) : 0;
  const orbit = p * S.orbit, elev = p * S.elev, spin = after ? S.spin * smooth(0, 1, p) : 0;
  const phase = introT < I.inner[0] ? 0 : introT < I.outer[0] ? 1 : !after ? 2 : (p < 0.05 ? 2 : 3);
  return { p, introT, joints, inner, outer, light, wave, pulseSpeed, open, swivel, spin, orbit, elev, phase };
}
