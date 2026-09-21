import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIG, CFG, KICK, figureFrame, getFrame, kickFrame, clamp01, smooth } from './hero-vault-mobile-frame.js';

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

test('скрол: фігура меншає, вмикаються промені, опис просто проявляється', () => {
  const f0 = getFrame(0, 1);
  assert.equal(f0.pull, 0); assert.equal(f0.beams, 0); assert.equal(f0.lede, false, 'без скролу опису ще немає');
  assert.equal(getFrame(CFG.lede, 1).lede, true, 'щойно почався скрол — опис проявляється');
  assert.ok(CFG.lede <= 0.1, 'і не змушує довго гортати');
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
