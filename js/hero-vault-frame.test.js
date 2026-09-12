import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, figureProgress, introFrame, introRelease, CFG, clamp01, smooth } from './hero-vault-frame.js';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);

test('до кінця вступу скрол не діє: сцена порожня й нерухома', () => {
  for (const t of [0, 0.5, 0.99]) {
    const f = getFrame(1, t);
    assert.equal(f.coverage, 0); assert.equal(f.fade, 0); assert.equal(f.grains, 0); assert.equal(f.spin, 0); assert.equal(f.orbit, 0);
    assert.equal(f.after, false);
  }
});

test('після вступу при p = 0 — лише фігура, нічого довкола', () => {
  const f = getFrame(0, 1);
  assert.equal(f.coverage, 0); assert.equal(f.fade, 0); assert.equal(f.grains, 0); assert.equal(f.pull, 0); assert.equal(f.spin, 0); assert.equal(f.orbit, 0); assert.equal(f.elev, 0);
  assert.equal(f.after, true);
});

test('спершу зерна з ядра, написи — пізніше; наприкінці все повне, оберт — повний', () => {
  assert.equal(getFrame(CFG.grains[0], 1).grains, 0);
  assert.ok(getFrame(0.08, 1).grains === 0, 'поки формується ядро, зерен ще немає');
  assert.ok(getFrame(0.22, 1).grains > 0.02, 'зерна вирушають раніше за написи');
  assert.ok(CFG.coverage[0] > CFG.grains[0] + 0.1, 'написи наздоганяють помітно пізніше за зерна');
  assert.equal(getFrame(CFG.coverage[0], 1).coverage, 0);
  assert.equal(getFrame(0.2, 1).fade, 0, 'поки збирається ґратка, написів ще немає');
  assert.ok(getFrame(0.44, 1).fade > 0.4, 'далі проєкція помітна');
  const end = getFrame(1, 1);
  assert.equal(end.coverage, 1); assert.equal(end.grains, 1); assert.equal(end.fade, 1);
  near(end.spin, Math.PI * 2, 'spin'); near(end.orbit, CFG.orbit, 'orbit'); near(end.elev, CFG.elev, 'elev');
});

test('яскравість написів наростає плавно, без стрибка', () => {
  let prev = 0, maxStep = 0;
  for (let i = 0; i <= 200; i++) {
    const f = getFrame(i / 200, 1).fade;
    maxStep = Math.max(maxStep, f - prev);
    prev = f;
  }
  assert.ok(maxStep < 0.04, `найбільший крок яскравості ${maxStep} — проєкція не має вмикатись ривком`);
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
    for (const k of ['coverage', 'fade', 'grains', 'pull', 'spin', 'orbit', 'elev']) assert.ok(f[k] >= prev[k] - 1e-12, `${k} не спадає при p=${i / 50}`);
    assert.ok(f.coverage >= 0 && f.coverage <= 1 && f.grains >= 0 && f.grains <= 1);
    prev = f;
  }
});

test('вхід поза межами обрізається', () => {
  assert.deepEqual(getFrame(-3, 7), getFrame(0, 1));
  assert.equal(clamp01(2), 1); assert.equal(clamp01(-1), 0);
  assert.equal(smooth(0, 1, 0.5), 0.5); assert.equal(smooth(2, 4, 4), 1);
});

test('поява: спершу всі вузли на місцях, лише потім бруси', () => {
  const counts = { jointsOuter: 12, outer: 24 };
  const atLinks = introFrame(CFG.intro.links[0], counts);
  assert.ok(atLinks.joints.every((v) => v > 0.99), 'до початку зʼєднання всі вузли вже зʼявились');
  assert.ok(atLinks.drift.every((v) => Math.abs(v - 1) < 1e-9), 'і всі сіли на свої місця');
  assert.ok(atLinks.edges.every((v) => v === 0), 'жоден брус ще не почав рости');
  const start = introFrame(0, counts);
  assert.ok(start.joints.every((v) => v === 0) && start.drift.every((v) => v > 1.5), 'на старті вузли ще летять здалеку');
  const end = introFrame(1, counts);
  assert.ok(end.joints.every((v) => Math.abs(v - 1) < 1e-9), 'наприкінці вузли рівно свого розміру');
  assert.ok(end.edges.every((v) => v === 1), 'і каркас замкнений');
});

test('поява: «вдих» вузлів — один мʼякий горб, без блимання', () => {
  const counts = { jointsOuter: 12, outer: 24 };
  let prev = 0, ups = 0;
  for (let i = 0; i <= 300; i++) {
    const v = introFrame(i / 300, counts).joints[0];
    if (v > prev + 1e-9 && prev > 0) ups++;
    prev = v;
  }
  const peak = Math.max(...Array.from({ length: 301 }, (_, i) => introFrame(i / 300, counts).joints[0]));
  assert.ok(peak > 1 && peak <= 1 + CFG.intro.bump + 1e-9, `пік ${peak} — вдих помітний, але не стрибок`);
  assert.ok(ups < 200, 'яскравих коливань немає: одне наростання і один спад');
});

test('сцена оживає сама: перший екран не порожній ще до скролу', () => {
  const at0 = introRelease(0);
  assert.equal(at0.letters, 0); assert.equal(at0.wall, 0); assert.equal(at0.cover, 0);
  const mid = introRelease(CFG.rest.dur / 2);
  assert.ok(mid.letters > 0 && mid.wall > 0, 'через секунду після вступу вже щось є');
  const end = introRelease(CFG.rest.dur * 3);
  assert.ok(Math.abs(end.letters - CFG.rest.letters) < 1e-9 && Math.abs(end.wall - CFG.rest.wall) < 1e-9, 'і зупиняється на рівні спокою');
});

test('самостійний випуск не зʼїдає скрол: решта абзацу лишається йому', () => {
  assert.ok(CFG.rest.letters < 0.1, 'сама вилітає лише перша частина опису');
  assert.ok(CFG.rest.wall < 0.5 && CFG.rest.cover < 0.6, 'поле даних у спокої лише тліє');
  let prev = -1, maxStep = 0;
  for (let i = 0; i <= 300; i++) {
    const v = introRelease(CFG.rest.dur * i / 300).wall;
    if (prev >= 0) maxStep = Math.max(maxStep, v - prev);
    assert.ok(v >= prev, 'наростає монотонно');
    prev = v;
  }
  assert.ok(maxStep < 0.01, `крок ${maxStep} — одна повільна хвиля, нічого не спалахує`);
});

test('телефон: фігура відходить і звільняє місце ще до появи написів', () => {
  assert.equal(getFrame(0, 1).pull, 0, 'при завантаженні фігура на весь кадр');
  assert.ok(getFrame(CFG.fade[0], 1).pull > 0.9, 'до першого напису вона вже відійшла й зменшилась');
  assert.equal(getFrame(1, 1).pull, 1);
});
