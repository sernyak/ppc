import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, figureProgress, CFG, clamp01, smooth } from './hero-vault-frame.js';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);

test('до кінця вступу скрол не діє: сцена порожня й нерухома', () => {
  for (const t of [0, 0.5, 0.99]) {
    const f = getFrame(1, t);
    assert.equal(f.coverage, 0); assert.equal(f.grains, 0); assert.equal(f.spin, 0); assert.equal(f.orbit, 0);
    assert.equal(f.after, false);
  }
});

test('після вступу при p = 0 — лише фігура, нічого довкола', () => {
  const f = getFrame(0, 1);
  assert.equal(f.coverage, 0); assert.equal(f.grains, 0); assert.equal(f.spin, 0); assert.equal(f.orbit, 0); assert.equal(f.elev, 0);
  assert.equal(f.after, true);
});

test('невелика прокрутка вже запускає проєкцію, наприкінці все повне, оберт — повний', () => {
  assert.equal(getFrame(CFG.coverage[0], 1).coverage, 0);
  assert.ok(getFrame(0.15, 1).coverage > 0.05, 'на 15 % скролу проєкція вже помітна');
  assert.ok(getFrame(CFG.grains[0], 1).grains === 0 && getFrame(CFG.grains[0] + 0.1, 1).grains > 0, 'зерна йдуть слідом');
  assert.ok(CFG.grains[0] >= CFG.coverage[0], 'зерна не раніше за проєкцію');
  const end = getFrame(1, 1);
  assert.equal(end.coverage, 1); assert.equal(end.grains, 1);
  near(end.spin, Math.PI * 2, 'spin'); near(end.orbit, CFG.orbit, 'orbit'); near(end.elev, CFG.elev, 'elev');
});

test('історія фігури стиснута в першу частину скролу', () => {
  assert.equal(figureProgress(0), 0);
  near(figureProgress(CFG.figureSpan / 2), 0.5, 'середина');
  assert.equal(figureProgress(CFG.figureSpan), 1);
  assert.equal(figureProgress(1), 1, 'після цього фігура стоїть у кінцевому стані');
  assert.equal(figureProgress(-1), 0);
});

test('усе монотонно зростає зі скролом і лежить у межах', () => {
  let prev = getFrame(0, 1);
  for (let i = 1; i <= 50; i++) {
    const f = getFrame(i / 50, 1);
    for (const k of ['coverage', 'grains', 'spin', 'orbit', 'elev']) assert.ok(f[k] >= prev[k] - 1e-12, `${k} не спадає при p=${i / 50}`);
    assert.ok(f.coverage >= 0 && f.coverage <= 1 && f.grains >= 0 && f.grains <= 1);
    prev = f;
  }
});

test('вхід поза межами обрізається', () => {
  assert.deepEqual(getFrame(-3, 7), getFrame(0, 1));
  assert.equal(clamp01(2), 1); assert.equal(clamp01(-1), 0);
  assert.equal(smooth(0, 1, 0.5), 0.5); assert.equal(smooth(2, 4, 4), 1);
});
