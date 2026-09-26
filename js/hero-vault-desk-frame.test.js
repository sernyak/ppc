import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIG, CFG, DANCE, FIG_DANCE, danceFrame, danceSpeed, KICK, kickFrame, figureFrame, figureProgress, getFrame, introRelease, REST_LEDE, flapStart, flapDone, clamp01, smooth } from './hero-vault-desk-frame.js';

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
  assert.ok(getFrame(0.1, 1).grains > 0.01, 'вогники летять з першого руху скролу');
  assert.ok(getFrame(0.5, 1).fade > 0.4, 'поле формул помітно яскравіє невдовзі за вогниками');
  assert.ok(CFG.fade[0] >= CFG.grains[0], 'але не раніше за них');
  const end = getFrame(1, 1);
  assert.equal(end.fade, 1); assert.equal(end.grains, 1); assert.equal(end.coverage, 1);
});

test('після того, як поле формул розгорілось, скрол голограму вже не крутить — лишається тільки кінець доріжки', () => {
  assert.ok(CFG.fade[1] < 1, 'поле формул розгоряється до кінця доріжки');
  assert.ok(CFG.coverage[1] <= 0.95 && CFG.figureSpan <= 0.95 && CFG.grains[1] <= CFG.fade[1], 'поле, фігура й вогники теж встигають');
  const tail = (1 - CFG.fade[1]) * (CFG.trackVh - 100) / 100;
  assert.ok(tail <= 0.1, `після нього лишається ${tail.toFixed(3)} екрана скролу — майже одразу далі`);
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

test('фото: поле формул проявляється разом з описом', () => {
  const n = 370, first = flapStart(0, n, 0), done = flapDone();
  assert.equal(introRelease(first - 0.01, REST_LEDE).wall, 0, 'до першої літери написів ще немає');
  assert.ok(introRelease(first + 0.3, REST_LEDE).wall > 0, 'написи займаються разом із табло');
  assert.ok(introRelease(done - 0.3, REST_LEDE).wall < REST_LEDE.wall, 'і ще наростають, поки табло складається');
  near(introRelease(done, REST_LEDE).wall, REST_LEDE.wall, 'повні — коли сіла остання літера');
  near(introRelease(done, REST_LEDE).cover, REST_LEDE.cover, 'хвиля дійшла до краю тоді ж');
  let prev = 0;
  for (let i = 0; i <= 400; i++) { const v = introRelease(done * i / 400, REST_LEDE).wall; assert.ok(v >= prev && v - prev < 0.01, 'без стрибків'); prev = v; }
});

test('табло: увесь опис складається сам, хвилею в порядку читання, за кілька секунд — без скролу', () => {
  const n = 370;                                          // стільки літер в описі
  for (let i = 1; i < n; i++) assert.ok(flapStart(i, n, 0.5) > flapStart(i - 1, n, 0.5), 'хвиля в порядку читання');
  assert.ok(flapStart(0, n, 0) >= CFG.flap.delay, 'перша літера — після короткої паузи');
  assert.ok(flapStart(n - 1, n, 0) > flapStart(0, n, 1), 'остання — помітно пізніше за першу');
  for (let i = 0; i < n; i++) assert.ok(flapStart(i, n, 1) + CFG.flap.flips * CFG.flap.dur <= flapDone() + 1e-9, 'кожна літера встигає зупинитись');
  assert.ok(flapDone() < 3, `табло зупиняється за ${flapDone()} с — перший екран не чекає довго`);
  assert.ok(CFG.flap.delay >= CFG.titleRise, 'спершу заголовок підіймається й звільняє місце, лише потім зʼявляється текст');
  assert.ok(CFG.flap.dur >= 0.1, 'пластинка перекидається не частіше ~10 разів на секунду — без мерехтіння');
});

test('фото-варіант, хоровод: крапки по одній стають у коло, заповнюють його рівно й лише потім сідають', () => {
  const n = 24, jit = Array.from({ length: n }, (_, i) => (i * 7 % n) / n);
  const s = danceFrame(0, n, jit);
  assert.ok(s.every((d) => d.scale === 0 && d.glow === 0 && d.ride === 0), 'на старті нічого немає');
  const e = danceFrame(1, n, jit);
  assert.ok(e.every((d) => d.landed && d.seat === 1 && Math.abs(d.scale - 1) < 1e-9 && d.glow === 0), 'наприкінці всі на місцях');
  /* по одній: кожна наступна заходить пізніше; у мить, коли зайшла остання, ланцюжок рівно обіймає коло */
  const gapMs = (DANCE.enter[1] - DANCE.enter[0]) / (n - 1) * DANCE.introMs;
  assert.ok(gapMs >= 50, `між входами ${gapMs.toFixed(0)} мс`);
  const atFull = danceFrame(DANCE.enter[1], n, jit);
  const step = atFull[0].ride - atFull[1].ride;
  assert.ok(Math.abs(step * n - 2 * Math.PI * DANCE.fill * n / (n - 1)) < 1e-6, 'сусідні крапки на колі — на однаковій відстані');
  assert.ok(atFull.every((d) => d.seat === 0), 'поки коло збирається, ніхто не сідає');
  assert.ok(DANCE.seat[0] >= DANCE.enter[1] + DANCE.inLen - 0.04, 'сідати починають, коли в колі вже всі');
  assert.ok(FIG_DANCE.intro.inner[0] >= DANCE.seat[1] - 1e-9, 'лінії — лише після того, як сіла остання');
  assert.ok(danceSpeed() < 2 * Math.PI, `коло кружляє не швидше за оберт на секунду (${danceSpeed().toFixed(2)} рад/с)`);
});

test('фото-варіант, хоровод: плавно — без стрибків розміру й світла', () => {
  const n = 24, jit = Array.from({ length: n }, (_, i) => (i * 7 % n) / n);
  let prev = danceFrame(0, n, jit), maxD = 0;
  for (let i = 1; i <= 4000; i++) {
    const f = danceFrame(i / 4000, n, jit);
    f.forEach((d, k) => { maxD = Math.max(maxD, Math.abs(d.scale - prev[k].scale), Math.abs(d.glow - prev[k].glow), Math.abs(d.seat - prev[k].seat), Math.abs(d.reach - prev[k].reach)); });
    prev = f;
  }
  assert.ok(maxD < 0.03, `найбільший стрибок за 1/4000 вступу: ${maxD}`);
});

test('клік по фігурі: ядро робить рівно один оберт і мʼяко зупиняється', () => {
  assert.deepEqual(kickFrame(-1), { turn: 0, boost: 0 });
  assert.equal(kickFrame(0).turn, 0);
  assert.ok(Math.abs(kickFrame(KICK.dur).turn - 2 * Math.PI) < 1e-9, 'повний оберт');
  assert.ok(Math.abs(kickFrame(KICK.dur).boost) < 1e-9 && kickFrame(KICK.dur / 2).boost > 0.99, 'світло спалахує посередині й згасає');
  let prev = 0;
  for (let i = 1; i <= 200; i++) { const v = kickFrame(KICK.dur * i / 200).turn; assert.ok(v >= prev, 'обертається в один бік'); prev = v; }
});

test('вхід поза межами обрізається', () => {
  assert.deepEqual(getFrame(-3, 7), getFrame(0, 1));
  assert.equal(clamp01(2), 1); assert.equal(smooth(0, 1, 0.5), 0.5);
});
