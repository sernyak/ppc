import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIG, CFG, figureFrame, figureProgress, getFrame, introRelease, flapStart, flapDone, clamp01, smooth } from './hero-vault-desk-frame.js';

const COUNTS = { joints: 24, inner: 36, outer: 24 };
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);

test('поява фігури: вузли → ґратка → зовнішні бруси → світло', () => {
  const at = (t) => figureFrame(0, t, COUNTS);
  const start = at(0);
  assert.ok(start.joints.every((v) => v === 0) && start.inner.every((v) => v === 0) && start.outer.every((v) => v === 0), 'на старті порожньо');
  assert.ok(at(FIG.intro.inner[0]).joints[0] > 0.99, 'перші вузли вже на місці, коли почала малюватись ґратка');
  assert.ok(at(FIG.intro.outer[0]).outer.every((v) => v === 0), 'зовнішні бруси чекають, доки ґратка намалюється');
  assert.ok(at(FIG.intro.outer[0]).inner[0] > 0.99, 'а ґратка вже почалась');
  assert.equal(at(FIG.intro.light[0] - 0.01).light, 0, 'світло займається лише наприкінці');
  const end = at(1);
  assert.ok(end.joints.every((v) => v === 1) && end.inner.every((v) => v === 1) && end.outer.every((v) => v === 1), 'наприкінці фігура ціла');
  near(end.light, FIG.restLight, 'світло у спокої');
});

test('скрол: ґратка провертається на чверть оберту, фігура докручується, але не росте', () => {
  const f0 = figureFrame(0, 1, COUNTS), f1 = figureFrame(1, 1, COUNTS);
  assert.equal(f0.swivel, 0); assert.equal(f0.spin, 0);
  near(f1.swivel, Math.PI / 2, 'чверть оберту'); near(f1.spin, FIG.scroll.spin, 'докрутка'); near(f1.light, 1, 'світло повне');
  assert.ok(!('open' in f1), 'каркас не розсувається — фігура не росте від скролу');
  assert.equal(figureFrame(1, 0.5, COUNTS).swivel, 0, 'до кінця вступу скрол фігуру не крутить');
});

test('історія фігури стиснута в першу частину скролу', () => {
  assert.equal(figureProgress(0), 0);
  near(figureProgress(CFG.figureSpan / 2), 0.5, 'середина');
  assert.equal(figureProgress(1), 1);
});

test('скрол одразу випускає вогники, і поле формул за ними стає яскравим', () => {
  assert.deepEqual(getFrame(1, 0.9), { coverage: 0, fade: 0, grains: 0, orbit: 0, elev: 0, after: false });
  const f0 = getFrame(0, 1);
  assert.equal(f0.fade, 0); assert.equal(f0.grains, 0);
  assert.ok(getFrame(0.1, 1).grains > 0.05, 'вогники летять з першого руху скролу');
  assert.ok(getFrame(0.2, 1).fade > 0.4, 'поле формул помітно яскравіє невдовзі за вогниками');
  assert.ok(CFG.fade[0] >= CFG.grains[0], 'але не раніше за них');
  const end = getFrame(1, 1);
  assert.equal(end.fade, 1); assert.equal(end.grains, 1); assert.equal(end.coverage, 1);
});

test('яскравість поля формул наростає плавно, без стрибка', () => {
  let prev = 0, maxStep = 0;
  for (let i = 0; i <= 300; i++) { const f = getFrame(i / 300, 1).fade; maxStep = Math.max(maxStep, f - prev); prev = f; }
  assert.ok(maxStep < 0.04, `крок ${maxStep}`);
});

test('усе монотонно зростає зі скролом', () => {
  let prev = getFrame(0, 1), prevF = figureFrame(0, 1, COUNTS);
  for (let i = 1; i <= 60; i++) {
    const f = getFrame(i / 60, 1), ff = figureFrame(i / 60, 1, COUNTS);
    for (const k of ['coverage', 'fade', 'grains', 'orbit', 'elev']) assert.ok(f[k] >= prev[k] - 1e-12, k);
    for (const k of ['swivel', 'spin', 'light', 'wave']) assert.ok(ff[k] >= prevF[k] - 1e-12, k);
    prev = f; prevF = ff;
  }
});

test('у спокої поле формул лише тліє й наростає однією хвилею', () => {
  const a = introRelease(0);
  assert.equal(a.wall, 0); assert.equal(a.cover, 0);
  const b = introRelease(CFG.rest.dur * 5);
  near(b.wall, CFG.rest.wall, 'рівень спокою');
  assert.ok(CFG.rest.wall <= 0.2, 'у спокої значно тьмяніше, ніж після скролу');
  let prev = 0;
  for (let i = 0; i <= 200; i++) { const v = introRelease(CFG.rest.dur * i / 200).wall; assert.ok(v >= prev && v - prev < 0.01); prev = v; }
});

test('табло: хвиля зліва направо, і вся фраза складається за кілька секунд', () => {
  const n = 70;
  assert.ok(flapStart(0, n, 0) >= CFG.flap.delay, 'перша літера — після короткої паузи');
  assert.ok(flapStart(n - 1, n, 0) > flapStart(0, n, 1), 'остання — помітно пізніше за першу');
  for (let i = 0; i < n; i++) assert.ok(flapStart(i, n, 1) + CFG.flap.flips * CFG.flap.dur <= flapDone() + 1e-9, 'кожна літера встигає зупинитись');
  assert.ok(flapDone() < 3, `табло зупиняється за ${flapDone()} с — перший екран не чекає довго`);
  assert.ok(CFG.flap.dur >= 0.1, 'пластинка перекидається не частіше ~10 разів на секунду — без мерехтіння');
});

test('вхід поза межами обрізається', () => {
  assert.deepEqual(getFrame(-3, 7), getFrame(0, 1));
  assert.equal(clamp01(2), 1); assert.equal(smooth(0, 1, 0.5), 0.5);
});
