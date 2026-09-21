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

/*
 * Поява у фото-варіанті (телефон — так само, як на компʼютері) — «ХОРОВОД». Крапки по одній залітають з-за правого краю й стають у коло, яке
 * кружляє довкола фігури: кожна нова приєднується в тому ж місці, тож коло заповнюється рівно, як люди,
 * що беруться за руки. Коли в колі всі, крапки по спіралі (не зупиняючи кружляння) сідають на свої місця,
 * і лише тоді між ними проростають лінії.
 */
export const DANCE = {
  introMs: 3600,
  enter: [0.03, 0.4],       // вікно, у якому крапки по одній залітають у коло
  inLen: 0.07,              // скільки кожна підлітає до кола
  seat: [0.44, 0.62],       // крапки сідають на місця (з легким розкидом у черзі)
  seatLen: 0.13,
  land: 0.1,                // мʼякий спалах після посадки
  fill: 0.96,               // яку частку кола займає ланцюжок, коли зайшла остання
};
/** Фігура для фото-варіанта: лінії проростають лише після того, як сіла остання крапка. */
export const FIG_DANCE = { ...FIG, intro: { ...FIG.intro, inner: [0.62, 0.84], innerLen: 0.09, outer: [0.7, 0.97], outerLen: 0.11, light: [0.86, 1.0] } };

/** Кутова швидкість кола, рад/с: за вікно входу ланцюжок обходить частку fill повного кола. */
export function danceSpeed(cfg = DANCE) { return (2 * Math.PI * cfg.fill) / ((cfg.enter[1] - cfg.enter[0]) * cfg.introMs / 1000); }

/**
 * @param {number} introT — прогрес вступу 0…1
 * @param {number} n — скільки крапок
 * @param {number[]} jit — розкид черги посадки кожної 0…1
 * @returns {{ride: number, reach: number, seat: number, scale: number, glow: number, landed: boolean}[]}
 *   ride — кут, який крапка вже пройшла по колу (рад), reach — наскільки підлетіла до кола (0…1),
 *   seat — наскільки опустилась на своє місце (0…1), scale, glow — розмір і світіння іскри
 */
export function danceFrame(introT, n, jit, cfg = DANCE) {
  const t = clamp01(introT), sec = cfg.introMs / 1000, w = danceSpeed(cfg);
  const out = [];
  for (let i = 0; i < n; i++) {
    const s0 = cfg.enter[0] + (n > 1 ? i / (n - 1) : 0) * (cfg.enter[1] - cfg.enter[0]);
    const b0 = cfg.seat[0] + clamp01(jit[i] || 0) * (cfg.seat[1] - cfg.seat[0] - cfg.seatLen);
    const started = t > s0, seatP = smooth(b0, b0 + cfg.seatLen, t);
    const landed = t >= b0 + cfg.seatLen, after = clamp01((t - b0 - cfg.seatLen) / cfg.land);
    const bump = landed ? Math.sin(Math.PI * after) : 0;
    const appear = smooth(s0, s0 + cfg.inLen * 0.6, t);
    out.push({
      ride: started ? w * (t - s0) * sec : 0,
      reach: smooth(s0, s0 + cfg.inLen, t),
      seat: seatP,
      landed,
      scale: appear * (0.55 + 0.45 * seatP) * (1 + 0.28 * bump),
      glow: !landed ? appear * (0.75 + 0.25 * seatP) : 1 - smooth(0, 1, after),
    });
  }
  return out;
}

/*
 * Дотик до фігури (фото-варіант): ядро робить повний оберт — розганяється й мʼяко зупиняється, світло
 * ліній на цей час яскравішає. Кубооктаедр після оберту збігається сам із собою.
 */
export const KICK = { dur: 1.6 };
export function kickFrame(since, cfg = KICK) {
  if (!(since >= 0)) return { turn: 0, boost: 0 };
  const x = clamp01(since / cfg.dur);
  const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  return { turn: 2 * Math.PI * e, boost: Math.sin(Math.PI * x) };
}
