/*
 * Звук першого екрана «Сховище». Усе синтезується в браузері (Web Audio), без жодного аудіофайла, тож
 * звук точно збігається з кожною крапкою й пластинкою. Модуль нічого не робить, доки людина сама не
 * натисне кнопку: браузери не дають сторінці грати звук без дотику, кліку чи клавіші (прокрутка не
 * рахується). Вибір запамʼятовується; при наступному візиті звук вмикається з першим кліком чи дотиком.
 *
 * Голоси:
 *   chime(i)  — кришталевий дзвін, коли крапка стає в хоровод (тон піднімається з кожною);
 *   tick()    — мʼякий «тік», коли крапка сідає на місце;
 *   flap()    — клацання пластинки табло (щільність обмежена, тож хвиля пластинок — шелест, а не тріск);
 *   drone(x)  — низький гул: наростає, поки проростають лінії, далі — ледь чутний фон;
 *   shimmer(x) — тихий електронний шелест голограми, гучність — від її яскравості;
 *   whoosh()  — оберт ядра від кліку: «вууш» і легкий дзвін наприкінці.
 */
const KEY = 'vault-sound';

export function createSound() {
  let ctx = null, master = null, wet = null, noiseBuf = null, drone = null, shim = null;
  let on = false, lastFlap = 0;
  const want = (() => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } })();

  /* пентатоніка від ля першої октави: крапки хороводу підіймаються по ній і на десятій повертаються вниз */
  const SCALE = [440, 494, 554, 659, 740, 880, 988, 1109, 1319, 1480];

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(comp); comp.connect(ctx.destination);
    /* простір: коротка штучна луна (згасаючий шум), лише для дзвонів і «вууш» */
    const verb = ctx.createConvolver();
    const len = Math.round(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir;
    wet = ctx.createGain(); wet.gain.value = 0.28;
    wet.connect(verb); verb.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    /* постійні голоси: гул і шелест — завжди грають, керуємо лише гучністю */
    drone = ctx.createGain(); drone.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.7;
    for (const [type, f, g] of [['sawtooth', 55, 0.35], ['sawtooth', 55.4, 0.35], ['sine', 110, 0.5]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(lp); o.start();
    }
    lp.connect(drone); drone.connect(master);
    shim = ctx.createGain(); shim.gain.value = 0;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 6;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.35; lfoG.gain.value = 1400;
    lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start();
    src.connect(bp); bp.connect(shim); shim.connect(master); src.start();
    return true;
  }
  /* розблокувати звук — лише всередині обробника дотику/кліку/клавіші */
  function unlock() {
    if (!ctx && !build()) return false;
    if (ctx.state !== 'running') ctx.resume();
    const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); b.connect(ctx.destination); b.start();   // iOS: «розморожує» вивід
    return true;
  }
  function setOn(v) {
    on = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* без сховища просто не запамʼятаємо */ }
    if (v) { if (!unlock()) { on = false; return false; } master.gain.setTargetAtTime(0.42, ctx.currentTime, 0.08); }
    else if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    if (api.onToggle) api.onToggle(on);
    return on;
  }
  /* після повторного візиту: вибір «увімкнено» памʼятаємо, але чекаємо першого дотику чи кліку */
  if (want) {
    const first = (ev) => {
      if (ev.target && ev.target.closest && ev.target.closest('.vault-sound')) return;   // клік по самій кнопці вона обробить сама
      if (!on) setOn(true);
      for (const e of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(e, first, true);
    };
    for (const e of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(e, first, true);
  }
  const live = () => on && ctx && ctx.state === 'running';

  function tone(freq, t0, dur, gain, type = 'sine', toWet = true) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); if (toWet) g.connect(wet);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, gain, f, q, fEnd) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f, t0); if (fEnd) bp.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.004, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
    return g;
  }

  const api = {
    onToggle: null,
    get on() { return on; },
    get wanted() { return want; },
    toggle() { return setOn(!on); },
    chime(i) {
      if (!live()) return;
      const f = SCALE[i % SCALE.length], t0 = ctx.currentTime;
      tone(f, t0, 1.1, 0.07); tone(f * 2.76, t0, 0.5, 0.018);      // основний тон + «скляний» обертон
    },
    tick() {
      if (!live()) return;
      tone(1250 + Math.random() * 200, ctx.currentTime, 0.06, 0.03, 'sine', false);
    },
    flap() {
      if (!live()) return;
      const now = ctx.currentTime;
      if (now - lastFlap < 1 / 42) return;                        // не частіше ~42 клацань на секунду
      lastFlap = now;
      noise(now, 0.028, 0.05 + Math.random() * 0.035, 2600 + Math.random() * 1600, 1.6);
      tone(170 + Math.random() * 40, now, 0.03, 0.035, 'triangle', false);
    },
    drone(x) { if (ctx && drone) drone.gain.setTargetAtTime(on ? 0.16 * Math.max(0, Math.min(1, x)) : 0, ctx.currentTime, 0.25); },
    shimmer(x) { if (ctx && shim) shim.gain.setTargetAtTime(on ? 0.05 * Math.max(0, Math.min(1, x)) : 0, ctx.currentTime, 0.3); },
    whoosh(dur = 1.6) {
      if (!live()) return;
      const t0 = ctx.currentTime;
      const g = noise(t0, dur, 0.12, 320, 1.2, 2600);
      g.connect(wet);
      tone(1319, t0 + dur * 0.92, 1.4, 0.05); tone(1976, t0 + dur * 0.92, 0.9, 0.02);   // дзвін, коли ядро зупинилось
    },
    silence() { if (ctx) { drone && drone.gain.setTargetAtTime(0, ctx.currentTime, 0.15); shim && shim.gain.setTargetAtTime(0, ctx.currentTime, 0.15); } },
  };
  return api;
}

/* Кнопка звуку: маленький круглий динамік унизу праворуч першого екрана. Видно лише, поки на екрані hero. */
export function soundButton(snd, hero, { onEnable } = {}) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'vault-sound';
  const ICON_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
  const ICON_ON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  const paint = (on) => {
    b.innerHTML = on ? ICON_ON : ICON_OFF;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? 'Вимкнути звук' : 'Увімкнути звук');
    b.title = on ? 'Вимкнути звук' : 'Увімкнути звук';
  };
  paint(false);                                              // до першого дотику звук ще не грає — показуємо чесно
  snd.onToggle = (on) => paint(on);
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const was = snd.on, now = snd.toggle();
    if (now && !was && onEnable) onEnable();
  });
  document.body.appendChild(b);
  requestAnimationFrame(() => b.classList.add('is-ready'));
  if (hero) new IntersectionObserver((es) => b.classList.toggle('is-away', !es[0].isIntersecting), { threshold: 0.15 }).observe(hero);
  return { repaint: () => paint(snd.on) };
}
