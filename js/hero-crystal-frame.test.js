import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, CFG } from './hero-crystal-frame.js';

const C = { jointsOuter: 12, outer: 24, jointsInner: 12, inner: 24, spokes: 12 };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const all = (arr, fn) => arr.every(fn);
const none = (arr) => all(arr, (v) => v === 0);
const full = (arr) => all(arr, (v) => v === 1);

test('до вступу: порожньо', () => {
  const f = getFrame(0, 0, C);
  assert.ok(none(f.jointsOuter) && none(f.outer) && none(f.jointsInner) && none(f.inner) && none(f.spokes));
  assert.equal(f.light, 0); assert.equal(f.open, 1); assert.equal(f.swivel, 0);
  assert.equal(f.phase, 0);
});

test('після вступу у спокої: зовнішній каркас зібраний, усередині ще нічого, світла немає', () => {
  const f = getFrame(0, 1, C);
  assert.ok(full(f.jointsOuter) && full(f.outer));
  assert.ok(none(f.jointsInner) && none(f.inner) && none(f.spokes));
  assert.equal(f.light, 0); assert.equal(f.open, 1); assert.equal(f.swivel, 0); assert.equal(f.spin, 0);
  assert.equal(f.phase, 0);
});

test('під час вступу скрол нічого не робить', () => {
  for (const it of [0.2, 0.6, 0.999]) {
    const f = getFrame(1, it, C);
    assert.ok(none(f.inner) && none(f.spokes) && f.light === 0 && f.open === 1 && f.swivel === 0, `introT=${it}`);
  }
});

test('кінець історії: усе зібрано, каркас знову зімкнутий, ґратка провернута на чверть, повне світло', () => {
  const f = getFrame(1, 1, C);
  assert.ok(full(f.jointsInner) && full(f.inner) && full(f.spokes));
  assert.ok(near(f.open, 1, 1e-9), 'каркас зімкнувся назад');
  assert.ok(near(f.swivel, Math.PI / 2));
  assert.equal(f.light, 1);
  assert.ok(near(f.orbit, CFG.scroll.orbit) && near(f.spin, CFG.scroll.spin));
  assert.equal(f.phase, 3);
});

test('історія скролу йде по порядку: розкриття → ґратка → спиці → поворот → замикання → світло', () => {
  let opened = null, innerDone = null, spokesStart = null, swivelStart = null, closedBack = null, lightStart = null, maxOpen = 1;
  for (let p = 0; p <= 1.0001; p += 0.005) {
    const f = getFrame(p, 1, C);
    maxOpen = Math.max(maxOpen, f.open);
    if (opened == null && f.open > 1 + CFG.scroll.openMax * 0.75) opened = p;
    if (innerDone == null && full(f.inner)) innerDone = p;
    if (spokesStart == null && f.spokes[0] > 0) spokesStart = p;
    if (swivelStart == null && f.swivel > 0.01) swivelStart = p;
    if (closedBack == null && opened != null && p > 0.5 && f.open < 1.02) closedBack = p;
    if (lightStart == null && f.light > 0.01) lightStart = p;
  }
  assert.ok(near(maxOpen, 1 + CFG.scroll.openMax, 1e-6), 'каркас розкривається на повний максимум');
  assert.ok(opened < innerDone && innerDone <= spokesStart + 0.02, 'ґратка домальована, коли починають спиці');
  assert.ok(spokesStart <= swivelStart, 'спиці раніше за поворот');
  assert.ok(closedBack != null && lightStart > swivelStart, 'світло після початку повороту');
  assert.ok(getFrame(0.5, 1, C).open > 1 + CFG.scroll.openMax * 0.5, 'на половині скролу каркас ще розкритий');
  assert.ok(CFG.scroll.openMax <= 0.1, 'розкриття ледь помітне: фігура не має рости від скролу');
});

test('елемент i у кожній групі не пізніше за i+1', () => {
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const fi = getFrame(0, t, C), fs = getFrame(t, 1, C);
    for (const arr of [fi.jointsOuter, fi.outer, fs.jointsInner, fs.inner, fs.spokes]) for (let i = 0; i < arr.length - 1; i++) assert.ok(arr[i] >= arr[i + 1], `@${t}`);
  }
});

test('усі величини в межах', () => {
  for (let it = 0; it <= 1.0001; it += 0.05) for (let p = 0; p <= 1.0001; p += 0.05) {
    const f = getFrame(p, it, C);
    for (const k of ['light', 'wave']) assert.ok(f[k] >= 0 && f[k] <= 1, `${k} @${p},${it}`);
    assert.ok(f.open >= 1 - 1e-9 && f.open <= 1 + CFG.scroll.openMax + 1e-9, `open @${p},${it}`);
    assert.ok(f.swivel >= 0 && f.swivel <= Math.PI / 2 + 1e-9);
    assert.ok([...f.jointsOuter, ...f.outer, ...f.jointsInner, ...f.inner, ...f.spokes].every((v) => v >= 0 && v <= 1));
    assert.ok([0, 1, 2, 3].includes(f.phase));
  }
});

test('етапи не повертаються назад уздовж скролу', () => {
  let prev = -1;
  for (let p = 0; p <= 1.0001; p += 0.01) { const ph = getFrame(p, 1, C).phase; assert.ok(ph >= prev); prev = ph; }
});

test('функція чиста', () => {
  assert.equal(JSON.stringify(getFrame(0.37, 0.8, C)), JSON.stringify(getFrame(0.37, 0.8, C)));
  assert.equal(JSON.stringify(getFrame(-3, 7, C)), JSON.stringify(getFrame(0, 1, C)));
});
