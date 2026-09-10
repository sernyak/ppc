/*
 * Хореографія «Каркас збирає себе» — чиста функція без DOM і three.js.
 * Вхід: p — прогрес скролу першого екрана (0..1), introT — прогрес вступу
 * при відкритті (0..1), counts — скільки елементів у групах.
 *
 * Вступ (introT): вузли → внутрішня ґратка малюється → зовнішні бруси
 * замикають каркас → світлові лінії всередині займаються.
 * Скрол (p, лише після вступу): світло всередині розгоряється, пульс
 * пришвидшується, ґратка ледь «дихає», камера обходить каркас.
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
    breathe: [0.15, 0.9],   // внутрішня ґратка ледь дихає
    breatheMax: 0.06,       // частка масштабу
    orbit: 0.9,             // обліт камери, радіани
    elev: 0.08,
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
  const breathe = after ? Math.sin(Math.PI * smooth(S.breathe[0], S.breathe[1], p)) * S.breatheMax : 0;
  const orbit = p * S.orbit, elev = p * S.elev;
  const phase = introT < I.inner[0] ? 0 : introT < I.outer[0] ? 1 : !after ? 2 : (p < 0.05 ? 2 : 3);
  return { p, introT, joints, inner, outer, light, wave, pulseSpeed, breathe, orbit, elev, phase };
}
