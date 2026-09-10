import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, CFG } from './hero-crystal-frame.js';

const N = 54;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('до вступу: нічого не намальовано, грані розведені, ядро темне, етап «проєктування»', () => {
  const f = getFrame(0, 0, N);
  assert.equal(f.dots, 0);
  assert.ok(f.struts.every((s) => s.draw === 0 && s.lit === 0));
  assert.ok(near(f.open, CFG.openMax));
  assert.equal(f.core, 0);
  assert.equal(f.phase, 0);
});

test('після вступу у спокої: все намальовано, грані зімкнуті, ядро тліє, каркас ще не світиться', () => {
  const f = getFrame(0, 1, N);
  assert.equal(f.dots, 1);
  assert.ok(f.struts.every((s) => s.draw === 1 && s.lit === 0));
  assert.ok(near(f.open, 0));
  assert.ok(near(f.core, CFG.restCore));
  assert.equal(f.phase, 2);
  assert.equal(f.edges, 0);
});

test('кінець першого екрана: усе світиться, грані знову зімкнуті, камера обійшла', () => {
  const f = getFrame(1, 1, N);
  assert.ok(f.struts.every((s) => s.lit === 1));
  assert.ok(near(f.open, 0, 1e-6));
  assert.equal(f.core, 1);
  assert.equal(f.edges, 1);
  assert.equal(f.phase, 3);
  assert.ok(near(f.orbit, CFG.scroll.orbit));
});

test('під час вступу скрол не вмикає світло (спершу збирання, потім робота)', () => {
  for (const it of [0.2, 0.5, 0.9, 0.999]) {
    const f = getFrame(1, it, N);
    assert.ok(f.struts.every((s) => s.lit === 0), `introT=${it}`);
    assert.equal(f.edges, 0);
  }
});

test('лінія i малюється не пізніше за i+1, і загоряється не пізніше за i+1', () => {
  for (let it = 0; it <= 1.0001; it += 0.01) {
    const f = getFrame(0, it, N);
    for (let i = 0; i < N - 1; i++) assert.ok(f.struts[i].draw >= f.struts[i + 1].draw, `draw @${it}`);
  }
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const f = getFrame(p, 1, N);
    for (let i = 0; i < N - 1; i++) assert.ok(f.struts[i].lit >= f.struts[i + 1].lit, `lit @${p}`);
  }
});

test('усі величини в межах, відкриття не більше за максимум + дихання', () => {
  const lim = CFG.openMax + CFG.scroll.breatheMax + 1e-9;
  for (let it = 0; it <= 1.0001; it += 0.05) for (let p = 0; p <= 1.0001; p += 0.05) {
    const f = getFrame(p, it, N);
    for (const k of ['dots', 'core', 'wave', 'edges']) assert.ok(f[k] >= 0 && f[k] <= 1, `${k} @${p},${it}`);
    assert.ok(f.open >= -1e-9 && f.open <= lim, `open @${p},${it}`);
    assert.ok(f.struts.every((s) => s.draw >= 0 && s.draw <= 1 && s.lit >= 0 && s.lit <= 1));
    assert.ok([0, 1, 2, 3].includes(f.phase));
  }
});

test('етапи йдуть по порядку: проєктування → код → деплой → підтримка', () => {
  let prev = -1;
  for (let it = 0; it <= 1.0001; it += 0.01) { const ph = getFrame(0, it, N).phase; assert.ok(ph >= prev); prev = ph; }
  prev = -1;
  for (let p = 0; p <= 1.0001; p += 0.01) { const ph = getFrame(p, 1, N).phase; assert.ok(ph >= prev); prev = ph; }
});

test('функція чиста: однакові входи — однакові виходи', () => {
  assert.equal(JSON.stringify(getFrame(0.37, 0.8, N)), JSON.stringify(getFrame(0.37, 0.8, N)));
  assert.equal(JSON.stringify(getFrame(-3, 7, N)), JSON.stringify(getFrame(0, 1, N)));
});
