import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIG, CFG, KICK, DANCE, FIG_DANCE, figureFrame, getFrame, kickFrame, danceFrame, danceSpeed, clamp01, smooth } from './hero-vault-mobile-frame.js';

const COUNTS = { joints: 24, inner: 36, outer: 24 };
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);

test('фігура: поява як на v6, від скролу крутиться, але не росте', () => {
  const s = figureFrame(0, 0, COUNTS);
  assert.ok(s.joints.every((v) => v === 0) && s.outer.every((v) => v === 0));
  assert.ok(figureFrame(0, FIG.intro.outer[0], COUNTS).outer.every((v) => v === 0), 'зовнішні бруси — після ґратки');
  const e = figureFrame(1, 1, COUNTS);
  assert.ok(e.joints.every((v) => v === 1) && e.inner.every((v) => v === 1) && e.outer.every((v) => v === 1));
  near(e.swivel, Math.PI / 2, 'чверть оберту'); near(e.light, 1, 'світло');
  assert.ok(!('open' in e), 'каркас не розсувається');
});

test('поява фігури на телефоні коротша за компʼютерну', () => {
  assert.ok(CFG.introMs <= 2000, `вступ ${CFG.introMs} мс`);
});

test('до кінця вступу скрол нічого не робить', () => {
  const f = getFrame(1, 0.9);
  assert.equal(f.pull, 0); assert.equal(f.beams, 0); assert.equal(f.story, 0); assert.equal(f.lede, false); assert.equal(f.after, false);
});

test('опис проявляється сам, щойно зібралась фігура; скрол меншає фігуру й вмикає промені', () => {
  assert.equal(getFrame(0, 0.99).lede, false, 'поки фігура збирається, опису ще немає');
  const f0 = getFrame(0, 1);
  assert.equal(f0.pull, 0); assert.equal(f0.beams, 0);
  assert.equal(f0.lede, true, 'фігура зібралась — опис видно без жодного скролу');
  const f1 = getFrame(1, 1);
  assert.equal(f1.pull, 1); assert.equal(f1.beams, 1); assert.equal(f1.story, 1);
  assert.ok(CFG.pull[1] <= 0.9 && CFG.beams[1] <= 0.9, 'усе встигає до кінця відрізка скролу');
});

test('усе монотонно зростає зі скролом', () => {
  let prev = getFrame(0, 1);
  for (let i = 1; i <= 40; i++) {
    const f = getFrame(i / 40, 1);
    for (const k of ['pull', 'story', 'beams']) assert.ok(f[k] >= prev[k] - 1e-12, k);
    prev = f;
  }
  assert.equal(clamp01(-1), 0); assert.equal(smooth(0, 1, 1), 1);
});

test('дотик до фігури: ядро робить рівно один оберт і мʼяко зупиняється', () => {
  assert.deepEqual(kickFrame(-1), { turn: 0, boost: 0 });
  assert.ok(Math.abs(kickFrame(KICK.dur).turn - 2 * Math.PI) < 1e-9 && Math.abs(kickFrame(KICK.dur).boost) < 1e-9);
  let prev = 0;
  for (let i = 1; i <= 200; i++) { const v = kickFrame(KICK.dur * i / 200).turn; assert.ok(v >= prev); prev = v; }
});

test('фото-варіант, телефон: хоровод — по одній у коло, рівно, лише потім посадка й лінії', () => {
  const n = 24, jit = Array.from({ length: n }, (_, i) => (i * 7 % n) / n);
  assert.ok(danceFrame(0, n, jit).every((d) => d.scale === 0 && d.glow === 0));
  assert.ok(danceFrame(1, n, jit).every((d) => d.landed && d.seat === 1 && Math.abs(d.scale - 1) < 1e-9));
  const atFull = danceFrame(DANCE.enter[1], n, jit);
  assert.ok(atFull.every((d) => d.seat === 0), 'поки коло збирається, ніхто не сідає');
  assert.ok(FIG_DANCE.intro.inner[0] >= DANCE.seat[1] - 1e-9, 'лінії — після останньої посадки');
  assert.ok(danceSpeed() < 2 * Math.PI);
  let prev = danceFrame(0, n, jit), maxD = 0;
  for (let i = 1; i <= 4000; i++) {
    const f = danceFrame(i / 4000, n, jit);
    f.forEach((d, k) => { maxD = Math.max(maxD, Math.abs(d.scale - prev[k].scale), Math.abs(d.glow - prev[k].glow), Math.abs(d.seat - prev[k].seat)); });
    prev = f;
  }
  assert.ok(maxD < 0.03, `стрибок ${maxD}`);
});
