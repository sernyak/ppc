import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, CFG, clamp01, smooth } from './hero-vault-frame.js';

const keys = ['core', 'lattice', 'coverage', 'back', 'beams', 'halo'];

test('до початку вступу зала темна', () => {
  const f = getFrame(0, 0);
  for (const k of keys) assert.equal(f[k], 0, k);
  assert.equal(f.dolly, 0); assert.equal(f.orbit, 0); assert.equal(f.spin, 0);
  assert.equal(f.after, false);
});

test('після вступу при p = 0 — стан спокою з конфігурації', () => {
  const f = getFrame(0, 1);
  assert.equal(f.core, 1); assert.equal(f.lattice, 1);
  assert.ok(Math.abs(f.coverage - CFG.rest.coverage) < 1e-9);
  assert.ok(Math.abs(f.beams - CFG.rest.beams) < 1e-9);
  assert.ok(Math.abs(f.halo - CFG.rest.halo) < 1e-9);
  assert.equal(f.back, 0);
  assert.equal(f.after, true);
});

test('скрол веде проєкцію до повного покриття, задню стіну — лише в кінці', () => {
  let prev = getFrame(0, 1);
  for (let i = 1; i <= 40; i++) {
    const f = getFrame(i / 40, 1);
    assert.ok(f.coverage >= prev.coverage - 1e-12, 'coverage не спадає');
    assert.ok(f.beams >= prev.beams - 1e-12, 'beams не спадають');
    assert.ok(f.orbit >= prev.orbit - 1e-12, 'orbit не спадає');
    prev = f;
  }
  const end = getFrame(1, 1);
  assert.equal(end.coverage, 1); assert.equal(end.back, 1); assert.equal(end.beams, 1);
  assert.ok(Math.abs(end.orbit - CFG.scroll.orbit) < 1e-9);
  assert.ok(Math.abs(end.dolly - CFG.scroll.dolly) < 1e-9);
  assert.equal(getFrame(0.4, 1).back, 0, 'до половини скролу задня стіна темна');
});

test('усі величини в межах 0…1, скрол під час вступу діє слабко', () => {
  for (const p of [0, 0.3, 0.7, 1]) for (const t of [0, 0.2, 0.5, 0.8, 1]) {
    const f = getFrame(p, t);
    for (const k of keys) assert.ok(f[k] >= 0 && f[k] <= 1, `${k} при p=${p} t=${t}`);
  }
  assert.ok(getFrame(1, 0.3).coverage < getFrame(1, 1).coverage);
  assert.ok(getFrame(1, 0.3).orbit < getFrame(1, 1).orbit);
});

test('вхід поза межами обрізається', () => {
  assert.deepEqual(getFrame(-3, 7), getFrame(0, 1));
  assert.equal(clamp01(2), 1); assert.equal(clamp01(-1), 0);
  assert.equal(smooth(0, 1, 0.5), 0.5); assert.equal(smooth(2, 4, 4), 1);
});
