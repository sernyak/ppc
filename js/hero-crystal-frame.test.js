import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, CFG } from './hero-crystal-frame.js';

const C = { joints: 24, inner: 36, outer: 24 };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const all = (arr, fn) => arr.every(fn);

test('до вступу: нічого не зібрано, світла немає, етап «проєктування»', () => {
  const f = getFrame(0, 0, C);
  assert.ok(all(f.joints, (v) => v === 0) && all(f.inner, (v) => v === 0) && all(f.outer, (v) => v === 0));
  assert.equal(f.light, 0);
  assert.equal(f.phase, 0);
});

test('після вступу у спокої: каркас зібраний, світло тліє, дихання нульове', () => {
  const f = getFrame(0, 1, C);
  assert.ok(all(f.joints, (v) => v === 1) && all(f.inner, (v) => v === 1) && all(f.outer, (v) => v === 1));
  assert.ok(near(f.light, CFG.restLight));
  assert.ok(near(f.breathe, 0));
  assert.equal(f.phase, 2);
});

test('кінець першого екрана: повне світло, камера обійшла, етап «підтримка»', () => {
  const f = getFrame(1, 1, C);
  assert.equal(f.light, 1);
  assert.ok(near(f.breathe, 0, 1e-6));
  assert.ok(near(f.orbit, CFG.scroll.orbit));
  assert.equal(f.phase, 3);
});

test('під час вступу скрол не розганяє світло (спершу збирання, потім робота)', () => {
  for (const it of [0.2, 0.5, 0.9, 0.999]) {
    const f = getFrame(1, it, C);
    assert.ok(f.light <= CFG.restLight + 1e-9, `introT=${it}`);
    assert.ok(near(f.breathe, 0));
  }
});

test('порядок збирання: вузли → внутрішня ґратка → зовнішні бруси, і кожен елемент i не пізніше за i+1', () => {
  let innerStarted = null, outerStarted = null, jointsDone = null;
  for (let it = 0; it <= 1.0001; it += 0.005) {
    const f = getFrame(0, it, C);
    for (const arr of [f.joints, f.inner, f.outer]) for (let i = 0; i < arr.length - 1; i++) assert.ok(arr[i] >= arr[i + 1], `order @${it}`);
    if (jointsDone == null && f.joints.every((v) => v === 1)) jointsDone = it;
    if (innerStarted == null && f.inner[0] > 0) innerStarted = it;
    if (outerStarted == null && f.outer[0] > 0) outerStarted = it;
  }
  assert.ok(innerStarted > 0 && outerStarted > innerStarted, 'зовнішні бруси починаються після внутрішньої ґратки');
  assert.ok(jointsDone < outerStarted, 'усі вузли стоять до того, як ростуть зовнішні бруси');
});

test('усі величини в межах', () => {
  for (let it = 0; it <= 1.0001; it += 0.05) for (let p = 0; p <= 1.0001; p += 0.05) {
    const f = getFrame(p, it, C);
    for (const k of ['light', 'wave']) assert.ok(f[k] >= 0 && f[k] <= 1, `${k} @${p},${it}`);
    assert.ok(f.breathe >= -1e-9 && f.breathe <= CFG.scroll.breatheMax + 1e-9);
    assert.ok([...f.joints, ...f.inner, ...f.outer].every((v) => v >= 0 && v <= 1));
    assert.ok([0, 1, 2, 3].includes(f.phase));
  }
});

test('етапи йдуть по порядку і не повертаються назад', () => {
  let prev = -1;
  for (let it = 0; it <= 1.0001; it += 0.01) { const ph = getFrame(0, it, C).phase; assert.ok(ph >= prev); prev = ph; }
  prev = -1;
  for (let p = 0; p <= 1.0001; p += 0.01) { const ph = getFrame(p, 1, C).phase; assert.ok(ph >= prev); prev = ph; }
});

test('функція чиста', () => {
  assert.equal(JSON.stringify(getFrame(0.37, 0.8, C)), JSON.stringify(getFrame(0.37, 0.8, C)));
  assert.equal(JSON.stringify(getFrame(-3, 7, C)), JSON.stringify(getFrame(0, 1, C)));
});
