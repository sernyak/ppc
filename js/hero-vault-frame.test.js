import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, holoWindow, CFG, clamp01, smooth } from './hero-vault-frame.js';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);

test('до кінця вступу скрол не діє: сцена порожня й нерухома', () => {
  for (const t of [0, 0.5, 0.99]) {
    const f = getFrame(1, t);
    assert.equal(f.holo, 0); assert.equal(f.grains, 0); assert.equal(f.spin, 0); assert.equal(f.orbit, 0);
    assert.equal(f.after, false);
  }
});

test('після вступу при p = 0 — лише фігура, нічого довкола', () => {
  const f = getFrame(0, 1);
  assert.equal(f.holo, 0); assert.equal(f.grains, 0); assert.equal(f.spin, 0); assert.equal(f.orbit, 0); assert.equal(f.elev, 0);
  assert.equal(f.after, true);
});

test('скрол: голограми раніше за зерна, наприкінці все повне, оберт — повний', () => {
  assert.equal(getFrame(CFG.holo[0], 1).holo, 0);
  assert.ok(getFrame(0.55, 1).holo > 0 && getFrame(0.55, 1).grains === 0, 'голограми вже є, зерен ще нема');
  const end = getFrame(1, 1);
  assert.equal(end.holo, 1); assert.equal(end.grains, 1);
  near(end.spin, Math.PI * 2, 'spin'); near(end.orbit, CFG.orbit, 'orbit'); near(end.elev, CFG.elev, 'elev');
});

test('усе монотонно зростає зі скролом і лежить у межах', () => {
  let prev = getFrame(0, 1);
  for (let i = 1; i <= 50; i++) {
    const f = getFrame(i / 50, 1);
    for (const k of ['holo', 'grains', 'spin', 'orbit', 'elev']) assert.ok(f[k] >= prev[k] - 1e-12, `${k} не спадає при p=${i / 50}`);
    assert.ok(f.holo >= 0 && f.holo <= 1 && f.grains >= 0 && f.grains <= 1);
    prev = f;
  }
});

test('вікна голограм: ближній напис зʼявляється раніше за дальній, усі повні в кінці', () => {
  const n = 10;
  assert.equal(holoWindow(0, n, 0), 0);
  assert.ok(holoWindow(0, n, 0.15) > holoWindow(n - 1, n, 0.15));
  assert.equal(holoWindow(n - 1, n, 0.3), 0, 'дальній ще не почав');
  for (let i = 0; i < n; i++) assert.equal(holoWindow(i, n, 1), 1);
  assert.equal(holoWindow(0, 1, 0.5), 0.5 / CFG.holoLen > 1 ? 1 : 0.5 / CFG.holoLen);
});

test('вхід поза межами обрізається', () => {
  assert.deepEqual(getFrame(-3, 7), getFrame(0, 1));
  assert.equal(clamp01(2), 1); assert.equal(clamp01(-1), 0);
  assert.equal(smooth(0, 1, 0.5), 0.5); assert.equal(smooth(2, 4, 4), 1);
});
