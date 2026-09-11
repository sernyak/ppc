/*
 * Хореографія радіанта — чиста функція без DOM і three.js.
 * Вхід: p — прогрес скролу історії (0..1), introT — прогрес вступу при
 * відкритті (0..1), counts — скільки елементів у групах.
 *
 * Вступ (introT, ~1,5 с): лише зовнішній каркас — вузли зʼявляються, бруси
 * ростуть і замикають порожню фігуру. Далі вона повільно обертається.
 *
 * Скрол (p) — головне: каркас розсувається, всередині лінія за лінією
 * малюється ґратка, спиці зʼєднують її з зовнішніми вузлами, ґратка
 * провертається на чверть оберту (спиці витягуються і знову стають прямими,
 * бо кубооктаедр за чверть оберту збігається сам із собою), каркас
 * сходиться назад і замикає ґратку, всередині займається світло і починає
 * пульсувати. Скрол назад складає все у зворотному порядку.
 */
export const CFG = {
  intro: {
    joints: [0.0, 0.5],     // зовнішні вузли зʼявляються знизу вгору
    outer: [0.22, 1.0],     // зовнішні бруси ростуть
    outerLen: 0.22,
  },
  scroll: {
    open: [0.0, 0.3],       // каркас ледь розсувається
    close: [0.6, 0.86],     // і сходиться назад
    openMax: 0.08,          // на скільки (частка розміру); власник: фігура не має «рости» від скролу
    inner: [0.04, 0.34],    // внутрішня ґратка малюється
    innerLen: 0.12,
    innerJoints: [0.02, 0.26],
    spokes: [0.32, 0.6],    // спиці зʼєднують ґратку з каркасом
    spokeLen: 0.14,
    swivel: [0.36, 0.8],    // ґратка провертається
    swivelMax: Math.PI / 2,
    light: [0.62, 0.92],    // світло займається
    orbit: 0.9,             // обліт камери, радіани
    elev: 0.1,
    spin: 1.2,              // додатковий поворот фігури, радіани
  },
  pulse: { base: 0.4, gain: 1.6 },
};

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

function windows(n, t, span, len) {
  const out = new Array(n), w = span[1] - span[0] - len;
  for (let i = 0; i < n; i++) {
    const k = n > 1 ? i / (n - 1) : 0;
    let v = (t - (span[0] + w * k)) / len;
    if (v > 1 - 1e-9) v = 1;                                   // без хвостів плаваючої коми в самому кінці вікна
    out[i] = clamp01(v);
  }
  return out;
}

export function getFrame(p, introT, counts, cfg = CFG) {
  p = clamp01(p); introT = clamp01(introT);
  const I = cfg.intro, S = cfg.scroll, after = introT >= 1;
  const ps = after ? p : 0;                                   // скрол працює лише після вступу
  const jointsOuter = windows(counts.jointsOuter, introT, I.joints, 0.1);
  const outer = windows(counts.outer, introT, I.outer, I.outerLen);
  const jointsInner = windows(counts.jointsInner, ps, S.innerJoints, 0.08);
  const inner = windows(counts.inner, ps, S.inner, S.innerLen);
  const spokes = windows(counts.spokes, ps, S.spokes, S.spokeLen);
  const open = 1 + S.openMax * (smooth(S.open[0], S.open[1], ps) - smooth(S.close[0], S.close[1], ps));
  const swivel = S.swivelMax * smooth(S.swivel[0], S.swivel[1], ps);
  const light = smooth(S.light[0], S.light[1], ps);
  const wave = 0.35 + 0.65 * light;
  const pulseSpeed = cfg.pulse.base + cfg.pulse.gain * ps;
  const orbit = ps * S.orbit, elev = ps * S.elev, spin = S.spin * smooth(0, 1, ps);
  const phase = !after || ps < 0.03 ? 0 : ps < S.spokes[0] ? 1 : ps < S.close[1] ? 2 : 3;
  return { p, introT, jointsOuter, outer, jointsInner, inner, spokes, open, swivel, light, wave, pulseSpeed, orbit, elev, spin, phase };
}
