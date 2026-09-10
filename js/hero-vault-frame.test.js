import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, CFG, clamp01, smooth } from './hero-vault-frame.js';

const unit = ['appear', 'core', 'strips', 'glow', 'coverage', 'back', 'beams', 'grains'];
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);

test('до появи все темне й нерухоме', () => {
  const f = getFrame(0, 0);
  for (const k of unit) assert.equal(f[k], 0, k);
  assert.equal(f.dolly, 0); assert.equal(f.orbit, 0); assert.equal(f.spin, 0); assert.equal(f.rise, 0); assert.equal(f.scale, 1);
  assert.equal(f.after, false);
});

test('після появи при p = 0 — тихий стан спокою: кристал є, ядро тліє, зала темна', () => {
  const f = getFrame(0, 1);
  assert.equal(f.appear, 1);
  near(f.core, CFG.rest.core, 'core'); near(f.strips, CFG.rest.strips, 'strips'); near(f.coverage, CFG.rest.coverage, 'coverage');
  assert.equal(f.glow, 0); assert.equal(f.beams, 0); assert.equal(f.grains, 0); assert.equal(f.back, 0);
  assert.equal(f.orbit, 0); assert.equal(f.spin, 0); assert.equal(f.rise, 0);
  assert.equal(f.after, true);
});

test('скрол робить головне: активація на початку, проєкція далі, задня стіна в кінці', () => {
  const a = getFrame(CFG.scroll.activate[1], 1);
  assert.equal(a.core, 1); assert.equal(a.strips, 1); assert.equal(a.glow, 1);
  assert.ok(a.coverage < 0.5, 'на момент активації стіни ще не залиті');
  assert.equal(getFrame(0.4, 1).back, 0, 'до половини скролу задня стіна темна');
  const end = getFrame(1, 1);
  assert.equal(end.coverage, 1); assert.equal(end.back, 1); assert.equal(end.beams, 1); assert.equal(end.grains, 1);
  near(end.orbit, CFG.scroll.orbit, 'orbit'); near(end.dolly, CFG.scroll.dolly, 'dolly');
  near(end.spin, CFG.scroll.spin, 'spin'); near(end.rise, CFG.scroll.rise, 'rise'); near(end.scale, CFG.scroll.scale, 'scale');
});

test('усе монотонно зростає зі скролом і лежить у межах 0…1', () => {
  let prev = getFrame(0, 1);
  for (let i = 1; i <= 50; i++) {
    const f = getFrame(i / 50, 1);
    for (const k of [...unit, 'dolly', 'orbit', 'spin', 'rise', 'scale']) assert.ok(f[k] >= prev[k] - 1e-12, `${k} не спадає при p=${i / 50}`);
    for (const k of unit) assert.ok(f[k] >= 0 && f[k] <= 1, `${k} у межах`);
    prev = f;
  }
});

test('скрол під час появи діє слабко; вхід поза межами обрізається', () => {
  assert.ok(getFrame(1, 0.3).coverage < getFrame(1, 1).coverage);
  assert.ok(getFrame(1, 0.3).spin < getFrame(1, 1).spin);
  assert.deepEqual(getFrame(-3, 7), getFrame(0, 1));
  assert.equal(clamp01(2), 1); assert.equal(clamp01(-1), 0);
  assert.equal(smooth(0, 1, 0.5), 0.5); assert.equal(smooth(2, 4, 4), 1);
});
