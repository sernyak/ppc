/*
 * «Сховище», ТЕЛЕФОН — хореографія без DOM і three.js. Компʼютер має свій
 * модуль і розвивається окремо; тут лише вузький екран.
 *
 * Фігура — як на /preview/3d-v6/ (вузли → ґратка → каркас → світло, від
 * скролу ґратка провертається, фігура докручується; каркас не розсувається).
 *
 * Сцена навмисно проста (прохання власника: «не перевантажувати»): скрол
 * меншає фігуру й опускає її до опису, вмикає промені світла, а сам опис —
 * звичайний текст сторінки, який просто плавно проявляється. Жодної анімації
 * по літерах, жодного прилипання hero й утримання скролу.
 * Фігура йде за скролом в обидва боки (вгору — росте назад на своє місце,
 * щоб під заголовком не лишалось порожнечі), а показаний опис уже не ховається.
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
  introMs: 1800,            // поява фігури — коротша, ніж на компʼютері: на телефоні вона тримає весь перший екран
  span: 0.55,               // за яку частку висоти екрана скрол проходить усю історію
  pull: [0.05, 0.8],        // фігура меншає й опускається до опису
  beams: [0.08, 0.4],       // промені від фігури до опису
  lede: 0.06,               // на цьому прогресі опис проявляється (перехід CSS) і далі вже не ховається
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

/** Сцена: p — прогрес скролу 0…1; до кінця вступу скрол не діє. */
export function getFrame(p, introT, cfg = CFG) {
  const after = clamp01(introT) >= 1;
  p = after ? clamp01(p) : 0;
  return {
    pull: smooth(cfg.pull[0], cfg.pull[1], p),
    story: p,
    beams: smooth(cfg.beams[0], cfg.beams[1], p),
    lede: p >= cfg.lede,      // опис проявляється, щойно почався скрол і фігура пішла вниз
    after,
  };
}
