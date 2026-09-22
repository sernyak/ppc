/*
 * Звук першого екрана «Сховище». Усе синтезується в браузері (Web Audio), без жодного аудіофайла, тож
 * звук точно збігається з кожною крапкою й пластинкою. Модуль нічого не робить, доки людина сама не
 * натисне кнопку: браузери не дають сторінці грати звук без дотику, кліку чи клавіші (прокрутка не
 * рахується). Вибір запамʼятовується; при наступному візиті звук вмикається з першим кліком чи дотиком.
 *
 * Голоси хороводу (крапки по одній залітають справа в коло довкола фігури, кружляють і сідають на місця):
 *   dotIn(i)   — крапка вилітає: короткий свист-проліт справа наліво з падінням тону, як повз вухо;
 *   dotJoin(i) — крапка стала в коло;
 *   ring(x)    — поки крапки кружляють (x — частка крапок у колі): перекат металевих кульок;
 *   dotLand(i) — крапка сіла на місце: металевий «клак».
 * Що саме звучить, вирішує варіант — параметр адреси ?snd= (порівняння на слух на прев'ю):
 *   whoosh — лише проліт на вході (посадка — мʼякий «тік»);
 *   roll   — перекат кульок у колі й «клак» на посадці;
 *   mix    — усе разом: проліт, перекат і «клак» (за замовчуванням);
 *   chime  — попередній кришталевий дзвін, для порівняння.
 * Решта голосів:
 *   lede()    — на телефоні проявився опис: мʼякий повітряний «вууш»;
 *   flap()    — клацання пластинки табло (щільність обмежена, тож хвиля пластинок — шелест, а не тріск);
 *   drone(x)  — низький гул: наростає, поки проростають лінії, далі — ледь чутний фон;
 *   shimmer(x) — тихий електронний шелест голограми, гучність — від її яскравості;
 *   whoosh()  — оберт ядра від кліку: «вууш» і легкий дзвін наприкінці.
 */
const KEY = 'vault-sound';
const VARIANTS = ['mix', 'whoosh', 'roll', 'chime'];

export function createSound() {
  let ctx = null, master = null, wet = null, noiseBuf = null, drone = null, shim = null;
  let rollBus = null, rumble = null, panL = null, panR = null;
  let on = false, lastFlap = 0, lastIn = 0, lastClack = 0, ringX = 0, nextGrain = 0, ringIdle = 0;
  const want = (() => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } })();
  const variant = (() => { try { const v = new URLSearchParams(location.search).get('snd'); return VARIANTS.includes(v) ? v : 'mix'; } catch (e) { return 'mix'; } })();
  const flies = variant === 'whoosh' || variant === 'mix', rolls = variant === 'roll' || variant === 'mix';

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
    if (rolls) buildRoll();
    return true;
  }
  const pan = (v) => { if (!ctx.createStereoPanner) return null; const p = ctx.createStereoPanner(); p.pan.value = v; return p; };
  /* перекат: дрібні клацання кульок ідуть у дві трохи рознесені точки стерео, під ними — рокіт кочення,
     який «пульсує» з частотою оберту кульки; гучність рокоту — від того, скільки крапок зараз у колі */
  function buildRoll() {
    rollBus = ctx.createGain(); rollBus.gain.value = 1; rollBus.connect(master);
    panL = pan(-0.35); panR = pan(0.35);
    for (const p of [panL, panR]) if (p) p.connect(rollBus);
    rumble = ctx.createGain(); rumble.gain.value = 0;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const low = ctx.createBiquadFilter(); low.type = 'bandpass'; low.frequency.value = 240; low.Q.value = 0.7;
    const mid = ctx.createBiquadFilter(); mid.type = 'bandpass'; mid.frequency.value = 1100; mid.Q.value = 1.3;
    const midG = ctx.createGain(); midG.gain.value = 0.45;
    const am = ctx.createGain(); am.gain.value = 0.72;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 6.5; lfoG.gain.value = 0.28;
    lfo.connect(lfoG); lfoG.connect(am.gain); lfo.start();
    src.connect(low); low.connect(am); src.connect(mid); mid.connect(midG); midG.connect(am);
    am.connect(rumble); rumble.connect(rollBus); src.start();
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
  /* металевий обертон: миттєвий удар і швидке згасання (у дзвона — мʼяка атака, у металу — ні) */
  function ping(freq, t0, dur, gain, out) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.0012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out || master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  /* проліт: повітря (широка смуга шуму) і тонкий свист (вузька смуга) наростають до моменту, коли крапка
     пролітає найближче, і тоді тон різко падає — ефект Доплера; звук зсувається справа до центру */
  function flyby(t0, level) {
    const dur = 0.17 + Math.random() * 0.05, f0 = 2600 + Math.random() * 900, f1 = f0 * (0.3 + Math.random() * 0.06);
    const pass = t0 + dur * 0.5, p = pan(0.85);
    if (p) { p.pan.setValueAtTime(0.85, t0); p.pan.linearRampToValueAtTime(0.1, t0 + dur); p.connect(master); p.connect(wet); }
    const out = p || master;
    for (const [q, mul, g] of [[1.3, 1, 0.55], [9, 1.7, 0.22]]) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0 * mul, t0); bp.frequency.setTargetAtTime(f1 * mul, pass - dur * 0.08, dur * 0.14);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(g * level, pass); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(bp); bp.connect(e); e.connect(out);
      s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
    }
  }
  /* одне клацання кульки в колі: два неоднакові (інгармонійні) обертони в смузі 3–6 кГц і крихітний удар шуму */
  function grain(t, x) {
    const f = 3000 + Math.random() * 3000, g = (0.011 + 0.02 * Math.random()) * (0.55 + 0.45 * x);
    const out = (Math.random() < 0.5 ? panL : panR) || rollBus;
    ping(f, t, 0.02 + Math.random() * 0.025, g, out);
    ping(f * (1.43 + Math.random() * 0.12), t, 0.012 + Math.random() * 0.012, g * 0.5, out);
    if (Math.random() < 0.5) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 5;
      const e = ctx.createGain(); e.gain.setValueAtTime(g * 2.2, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.004);
      s.connect(bp); bp.connect(e); e.connect(out);
      s.start(t, Math.random() * 0.5); s.stop(t + 0.01);
    }
  }
  /* кулька сідає в гніздо: удар шуму, металеві обертони (неоднакові) і коротке глухе «ток» корпусу */
  function clack(t) {
    const f = 2100 + Math.random() * 900;
    noise(t, 0.012, 0.1, 4200, 2.2);
    ping(f, t, 0.09 + Math.random() * 0.03, 0.034);
    ping(f * 2.32, t, 0.05, 0.017);
    ping(f * 3.87, t, 0.028, 0.009);
    tone(360 + Math.random() * 80, t, 0.045, 0.028, 'triangle', false);
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
    variant,
    dotIn() {
      if (!flies || !live()) return;
      const now = ctx.currentTime;
      if (now - lastIn < 0.03) return;                            // пропущені кадри не зливаються в один гучний пучок
      lastIn = now;
      flyby(now, variant === 'mix' ? 0.75 : 1);
    },
    dotJoin(i) {
      if (!live()) return;
      if (variant === 'chime') api.chime(i);
      else if (variant === 'roll') { const t = ctx.currentTime; ping(4200 + Math.random() * 900, t, 0.035, 0.02, (i % 2 ? panL : panR) || rollBus); }
    },
    dotLand() {
      if (!live()) return;
      if (!rolls) { api.tick(); return; }
      const now = ctx.currentTime;
      if (now - lastClack < 0.014) return;                        // крапки сідають густо — не частіше ~70 ударів на секунду
      lastClack = now;
      clack(now);
    },
    /* x — частка крапок, що зараз кружляють; викликається щокадру, поки йде хоровод */
    ring(x) {
      if (!rumble) return;
      x = Math.max(0, Math.min(1, x));
      if (x !== ringX) { ringX = x; rumble.gain.setTargetAtTime(on ? 0.7 * x : 0, ctx.currentTime, 0.09); }
      clearTimeout(ringIdle);
      if (x > 0) ringIdle = setTimeout(() => api.ring(0), 250);    // кадри зупинились (вкладку сховали) — рокіт не зависає
      if (!live() || x <= 0) return;
      const now = ctx.currentTime, rate = 20 + 40 * x;           // 20…60 клацань на секунду
      if (nextGrain < now) nextGrain = now + 0.004;
      while (nextGrain < now + 0.06) { grain(nextGrain, x); nextGrain += -Math.log(1 - Math.random()) / rate; }
    },
    lede() {
      if (!live()) return;
      if (variant === 'chime') { api.chime(2); return; }
      const t0 = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(420, t0); bp.frequency.exponentialRampToValueAtTime(1500, t0 + 0.7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.26); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
      s.connect(bp); bp.connect(g); g.connect(master); g.connect(wet);
      s.start(t0, Math.random() * 0.2); s.stop(t0 + 0.8);
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
    silence() {
      if (!ctx) return;
      for (const v of [drone, shim, rumble]) if (v) v.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      ringX = 0;
    },
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
