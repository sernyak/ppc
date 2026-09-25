/*
 * Проекція формул для телефона: похила напівпрозора площина з рядками економіки клієнта, як «Матриця»,
 * покладена набік. На компʼютері таке саме поле живе просто в `hero-vault-desk.js` — воно там більше вміє
 * (хвиля від фігури, підсвітка від кліку, межа по кадру фото, перекидання знаків від скролу). Тут навмисно
 * лишилось тільки те, що потрібно телефону: написи пишуться раз і не рухаються, яскравість — стала й низька,
 * поле просто доповнює композицію й ні до чого не привʼязане (прохання власника 2026-09-25).
 *
 * createHolo(THREE, renderer, opts) → { mesh, ready, setLevel(x), tick(t) }
 *   setLevel(x) — 0…1, загальна яскравість поля (сцена плавно виводить його після появи фігури);
 *   tick(t)     — секунди, лише для ледь помітного «дихання»; з prefers-reduced-motion можна не кликати.
 */

/* Не про мої проєкти, а про економіку того, хто читає. Три голоси: модель · результат · процес. */
const CORPUS = [
  'LTV / CAC = 3,8', 'ROAS = дохід / витрати', 'маржа = чек × частота − CAC',
  '∂ прибуток / ∂ бюджет', 'точка окупності: 2,5 міс', 'сегмент × канал × маржа',
  'прогноз попиту на 14 днів', 'p(оплата | джерело)', 'план / факт = 96 %',
  'CAC ↓ 34 % за 6 тижнів', 'конверсія 2,1 % → 3,4 %', 'обробка заявки: 4 год → 3 хв',
  'відмови на оплаті −41 %', 'повторні покупки 19 % → 31 %', 'вартість ліда $12,40',
  'середній чек ↑ 22 %', '12 год рутини на тиждень → 0', 'ручна робота 68 % → 8 %',
  '0 втрачених заявок', 'A/B: +18 % до кошика', 'заявка → CRM → дзвінок за 60 с',
  'звіт щопонеділка о 08:00', 'оплата → документ → пошта', 'відповідь клієнту 24/7 · 30 с',
  'щоденна звірка: 0 розбіжностей', 'клік → лід → оплата', 'черга: 0 · очікування → 0',
];

const seeded = (seed) => { let s = seed * 7919 + 13; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

export function createHolo(THREE, renderer, {
  w = 7.2, h = 4.2,            // розмір площини у світі
  cols = 360, rows = 22,       // сітка знаків: скільки слотів по горизонталі й рядків
  cell = 56,                   // піксель клітинки в атласі гліфів
  tint = 0x6f82a2,             // колір написів: холодний сірий, як у спокої на компʼютері
  seed = 97,
} = {}) {
  const gridData = new Uint8Array(cols * rows * 4);
  const gridTex = new THREE.DataTexture(gridData, cols, rows, THREE.RGBAFormat);
  gridTex.needsUpdate = true;

  const blankTex = () => { const c = document.createElement('canvas'); c.width = c.height = 4; return new THREE.CanvasTexture(c); };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: blankTex() }, uGrid: { value: gridTex },
      uCell: { value: new THREE.Vector2(cols, rows) }, uAt: { value: new THREE.Vector2(1, 1) },
      uTint: { value: new THREE.Color(tint) }, uOpacity: { value: 0 },
      uTime: { value: 0 }, uEdge: { value: 0.26 },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D uAtlas; uniform sampler2D uGrid; uniform vec2 uCell; uniform vec2 uAt;
      uniform vec3 uTint; uniform float uOpacity; uniform float uTime; uniform float uEdge;
      varying vec2 vUv; varying vec3 vW;
      void main(){
        /* у uGrid для кожної комірки: номер гліфа (R), яскравість (G), середина слота в частках знака (B), скільки слотів він займає (A) */
        vec2 cp = vec2(vUv.x, 1.0 - vUv.y) * uCell;
        vec2 ci = floor(cp), f = fract(cp);
        vec4 cellData = texture2D(uGrid, (ci + 0.5) / uCell);
        float gi = floor(cellData.r * 255.0 + 0.5);
        vec2 gp = vec2(mod(gi, uAt.x), floor(gi / uAt.x));
        float lx = cellData.b + (f.x - 0.5) / max(1.0, cellData.a * 255.0);
        vec4 t = texture2D(uAtlas, (gp + vec2(lx, f.y)) / uAt); t.a *= cellData.g * 1.35;
        /* краї розчиняються, щоб площина не читалась прямокутником, а глибші рядки — тьмяніші */
        float edge = smoothstep(0.0, uEdge, vUv.x) * smoothstep(1.0, 1.0 - uEdge, vUv.x) * smoothstep(0.0, uEdge, vUv.y) * smoothstep(1.0, 1.0 - uEdge, vUv.y);
        float depth = mix(1.0, 0.45, smoothstep(0.0, 1.0, vUv.x));
        float breathe = 0.93 + 0.07 * sin(uTime * 0.4 + vW.y * 0.8);
        float lit = uOpacity * edge * depth * breathe;
        gl_FragColor = vec4(uTint * t.rgb * t.a * lit, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        /* полотно прозоре з premultiplied alpha: альфа = яскравість пікселя, інакше браузер гасить світло */
        gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.visible = false;
  mesh.renderOrder = -2;

  /* атлас гліфів: усі знаки корпусу плюс пʼять мініатюрних графіків */
  function glyphAtlas() {
    const set = [' '];
    for (const line of CORPUS) for (const ch of line) if (!set.includes(ch)) set.push(ch);
    const kinds = ['bars', 'rise', 'funnel'];
    const acols = 16, total = set.length + kinds.length, arows = Math.ceil(total / acols);
    const c = document.createElement('canvas'); c.width = acols * cell; c.height = arows * cell;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineJoin = 'round'; g.lineCap = 'round';
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const fsm = Math.round(cell * 0.74);
    g.font = `500 ${fsm}px Inter, sans-serif`;
    const slotW = w / cols, fsWorld = (h / rows) * 0.74;
    const ratio = {}, slots = {};
    for (const ch of set) { const wd = g.measureText(ch).width / fsm; ratio[ch] = wd; slots[ch] = Math.max(1, Math.round(wd * fsWorld / slotW)); }
    const at = (i) => [(i % acols) * cell, Math.floor(i / acols) * cell];
    set.forEach((ch, i) => {
      if (ch === ' ') return;
      const [x, y] = at(i), wd = ratio[ch] * fsm;
      g.save(); g.translate(x + cell * 0.04, y + cell * 0.76); g.scale((cell * 0.92) / wd, 1);
      g.fillText(ch, 0, 0); g.restore();
    });
    const r = seeded(5), charts = [];
    kinds.forEach((kind, k) => {
      const gi = set.length + k, [x, y] = at(gi);
      drawChart(g, kind, x, y, cell, cell, r);
      charts.push({ gi, k: Math.max(2, Math.round((h / rows) * 2 / slotW)) });
    });
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const index = {}; set.forEach((ch, i) => { index[ch] = i; });
    return { tex, cols: acols, rows: arows, index, charts, slotsOf: (ch) => slots[ch] || slots[' '] };
  }
  function drawChart(g, kind, x, y, cw0, hh, r) {
    const pad = hh * 0.22, top = y + pad, ch = hh - pad * 2, cw = cw0 - pad * 2, ox = x + pad;
    g.lineWidth = Math.max(1.5, hh * 0.075);
    if (kind === 'bars') {
      const n = 5, bw = cw / (n * 1.6);
      for (let i = 0; i < n; i++) { const bh = ch * (0.24 + 0.76 * (i / (n - 1))); g.fillRect(ox + i * bw * 1.6, top + ch - bh, bw, bh); }
    } else if (kind === 'rise') {
      const n = 6; g.beginPath();
      for (let i = 0; i < n; i++) {
        const tt = i / (n - 1), v = tt * 0.8 + 0.1 * r();
        const py = top + ch - Math.min(ch, ch * (0.1 + 0.85 * v));
        i ? g.lineTo(ox + tt * cw, py) : g.moveTo(ox, py);
      }
      g.stroke();
    } else {
      for (let i = 0; i < 3; i++) { const fw = cw * (1 - i * 0.3), fh = ch * 0.22; g.fillRect(ox + (cw - fw) / 2, top + i * ch * 0.39, fw, fh); }
    }
  }
  /* один рядок: фрази корпусу через проміжки, зрідка — мініатюрний графік */
  function writeRow(glyphs, y, rowSeed) {
    const r = seeded(rowSeed), space = Math.max(1, Math.round(glyphs.slotsOf(' ') * 1.1));
    const base = y * cols * 4;
    let x = -Math.floor(r() * cols * 0.25);
    const put = (gi, k, x0) => {
      for (let j = 0; j < k; j++) {
        const cx = x0 + j;
        if (cx < 0 || cx >= cols) continue;
        const i = base + cx * 4;
        gridData[i] = gi; gridData[i + 1] = 105;
        gridData[i + 2] = Math.round((j + 0.5) / k * 255); gridData[i + 3] = k;
      }
    };
    while (x < cols) {
      if (r() < 0.12) {
        const c = glyphs.charts[Math.floor(r() * glyphs.charts.length)];
        if (x >= 0 && x + c.k <= cols) put(c.gi, c.k, x);
        x += c.k;
      } else {
        const line = CORPUS[Math.floor(r() * CORPUS.length)];
        for (const ch of line) {
          const k = glyphs.slotsOf(ch), gi = glyphs.index[ch] || 0;
          if (gi && x >= 0 && x + k <= cols) put(gi, k, x);
          x += k;
        }
      }
      x += space * (2 + Math.floor(r() * 4));
    }
  }

  /* чекаємо Inter: запасним шрифтом ширини знаків інші, і рядки довелося б перемальовувати */
  const fontsReady = Promise.race([
    Promise.all([document.fonts.load('400 40px Inter'), document.fonts.load('500 40px Inter')]).catch(() => null),
    new Promise((r) => setTimeout(r, 1200)),
  ]);
  const ready = fontsReady.then(() => {
    const glyphs = glyphAtlas();
    material.uniforms.uAtlas.value.dispose();
    material.uniforms.uAtlas.value = glyphs.tex;
    material.uniforms.uAt.value.set(glyphs.cols, glyphs.rows);
    gridData.fill(0);
    for (let y = 0; y < rows; y++) writeRow(glyphs, y, seed + y * 3);
    gridTex.needsUpdate = true;
    return true;
  });

  return {
    mesh,
    material,
    ready,
    setLevel(x) {
      const v = Math.max(0, Math.min(1, x));
      material.uniforms.uOpacity.value = v;
      mesh.visible = v > 0.002;
    },
    tick(t) { material.uniforms.uTime.value = t; },
  };
}
