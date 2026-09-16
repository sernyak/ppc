import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIG, CFG, figureFrame, getFrame, letterOrder, queueLaunch, maxHold, clamp01, smooth } from './hero-vault-mobile-frame.js';

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

test('до кінця вступу скрол нічого не робить', () => {
  const f = getFrame(1, 1, 0.9);
  assert.equal(f.pull, 0); assert.equal(f.release, 0); assert.equal(f.beams, 0); assert.equal(f.story, 0); assert.equal(f.after, false);
});

test('фігура встигає зменшитись ще до того, як hero прилипне', () => {
  assert.equal(getFrame(CFG.pull[1], 0, 1).pull, 1);
  assert.ok(CFG.pull[1] < 1, 'рух фігури закінчується всередині ділянки pre');
  assert.equal(getFrame(1, 0, 1).release, 0, 'поки hero не прилип, жодна літера не зʼявляється');
});

test('скрол на прилиплому hero відпускає літери в порядку читання, і всі встигають', () => {
  const n = 430;
  let prev = -1;
  for (let i = 0; i < n; i++) {
    const o = letterOrder(i, n, 0.5);
    assert.ok(o > 0 && o < 1, `поріг ${o} у межах ділянки`);
    assert.ok(letterOrder(i, n, 1) <= 0.94 && letterOrder(i, n, 0) >= 0.01);
    assert.ok(o > prev, 'хвиля йде в порядку читання'); prev = o;
  }
  assert.equal(getFrame(1, 1, 1).release, 1, 'наприкінці ділянки відпущено все');
});

test('черга: повільний скрол її не помічає, швидкий — все одно отримує хвилю', () => {
  const n = 430, gap = CFG.flap.burst / n;
  assert.equal(queueLaunch(10, 2, n), 10, 'давно ніхто не стартував — стартує одразу');
  let last = -Infinity, first = null;
  for (let i = 0; i < n; i++) { last = queueLaunch(5, last, n); if (first == null) first = last; }
  assert.ok(Math.abs(last - first - gap * (n - 1)) < 1e-9, 'усе відпущено разом — старти розтягуються хвилею');
  assert.ok(last - first <= CFG.flap.burst, 'хвиля не довша за burst');
});

test('сторінка не тримає людину довго', () => {
  assert.ok(maxHold() <= 2.2, `максимальна затримка ${maxHold()} с`);
  assert.ok(CFG.flap.dur >= 0.1, 'пластинка перекидається не частіше ~10 разів на секунду — без мерехтіння');
});

test('усе монотонно зростає зі скролом', () => {
  let prev = getFrame(0, 0, 1);
  for (let i = 1; i <= 40; i++) {
    for (let j = 0; j <= 4; j++) {
      const f = getFrame(i / 40, j / 4, 1);
      assert.ok(f.story >= 0 && f.story <= 1);
    }
    const f = getFrame(i / 40, i / 40, 1);
    for (const k of ['pull', 'story', 'beams', 'shade', 'release']) assert.ok(f[k] >= prev[k] - 1e-12, k);
    prev = f;
  }
  assert.equal(clamp01(-1), 0); assert.equal(smooth(0, 1, 1), 1);
});
