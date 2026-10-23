// Builds sites/index.html - the gallery of sites for clients who ask what Oleksandr has built - from sites/data.json.
// Cards are static HTML (the page works without JS); sites/portfolio.js puts them in the order the owner saved
// (kept by prodavai.site/api/portfolio) and lets him rearrange them. A new card: a row in data.json, its pictures in
// img/ (<id>.jpg 1200x750; a client's mockup also <id>-page.jpg and <id>-phone.jpg), then `node sites/build.mjs`.
// Design concepts are real pages in concepts/<id>/ (sites/concepts.mjs), PDR Service a copy in pdr/.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, 'data.json'), 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const img = (id) => `/sites/img/${id}.jpg`;
const CHIP = { live: 'Працює', proto: 'Прототип' };
const title = 'Приклади сайтів | Олександр Серняк';
const description = 'Сайти, які можна відкрити й погортати, концепти сайтів з AI-асистентом і макети під завдання замовників.';

const live = (s, i) => `
          <article class="work" data-id="${esc(s.id)}">
            <a class="shot" href="${esc(s.href)}" target="_blank" rel="noopener" aria-label="Відкрити ${esc(s.title)}">
              <img src="${img(s.id)}" width="1200" height="750" alt="${esc(s.alt)}" loading="${i < 2 ? 'eager' : 'lazy'}">
            </a>
            <div class="meta">
              <div class="title-row"><h3>${esc(s.title)}</h3><span class="chip ${esc(s.chip)}">${CHIP[s.chip]}</span></div>
              <p class="desc">${esc(s.desc)}</p>${s.small ? `\n              <p class="small">${esc(s.small)}</p>` : ''}
              <a class="open" href="${esc(s.href)}" target="_blank" rel="noopener">Відкрити сайт ↗</a>
            </div>
          </article>`;

const design = (d) => `
          <article class="work" data-id="${esc(d.id)}">
            <a class="shot" href="/sites/concepts/${esc(d.id)}/" target="_blank" rel="noopener" aria-label="Відкрити концепт ${esc(d.title)}">
              <img src="${img(d.id)}" width="1200" height="750" alt="${esc(d.alt)}" loading="lazy">
            </a>
            <div class="meta">
              <h3>${esc(d.title)}</h3>
              <p class="desc">${esc(d.desc)}</p>
              <a class="open" href="/sites/concepts/${esc(d.id)}/" target="_blank" rel="noopener">Відкрити концепт ↗</a>
            </div>
          </article>`;

const concept = (c) => `
          <article class="work" data-id="${esc(c.id)}">
            <button class="shot" type="button" data-view="${esc(c.id)}" data-title="${esc(c.title)}">
              <img src="${img(c.id)}" width="1200" height="750" alt="${esc(c.alt)}" loading="lazy">
              <span class="hint">Погортати</span>
            </button>
            <div class="meta">
              <h3>${esc(c.title)}</h3>
              <p class="desc">${esc(c.desc)}</p>
            </div>
          </article>`;

const html = `<!DOCTYPE html>
<!-- Built by sites/build.mjs from sites/data.json - edit those, not this file. -->
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://ppcmarketing.pro/sites/">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="website">
<meta property="og:locale" content="uk_UA">
<meta property="og:title" content="Приклади сайтів - Олександр Серняк">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://ppcmarketing.pro/sites/">
<meta property="og:image" content="https://ppcmarketing.pro/sites/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://ppcmarketing.pro/sites/og.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/sites/style.css">
<!-- the saved order comes from prodavai.site/api/portfolio: the grids wait for it a moment instead of jumping -->
<script>
  document.documentElement.classList.add('order-pending');
  setTimeout(function () { document.documentElement.classList.remove('order-pending'); }, 1500);
</script>
</head>
<body>
  <div class="wrap">
    <header>
      <a class="eyebrow" href="/">Олександр Серняк</a>
      <h1>Приклади сайтів</h1>
      <p class="lead">Сайти з першого блоку можна відкрити й погортати. Нижче - мої концепти сайтів з AI-асистентом і макети, зроблені під завдання замовників.</p>
    </header>

    <section aria-labelledby="live-h">
      <div class="section-head"><h2 id="live-h">Відкрити й погортати</h2></div>
      <div class="grid" data-section="live">${data.live.map(live).join('')}
      </div>
    </section>

    <section aria-labelledby="designs-h">
      <div class="section-head">
        <h2 id="designs-h">Концепти сайтів з AI&#8209;асистентом</h2>
        <p class="section-note">Бізнеси вигадані, по три варіанти дизайну. Відкриваються як справжні сторінки - на телефоні й комп’ютері</p>
      </div>
      <div class="grid three" data-section="designs">${data.designs.map(design).join('')}
      </div>
    </section>

    <section aria-labelledby="concepts-h">
      <div class="section-head">
        <h2 id="concepts-h">Макети під завдання замовників</h2>
        <p class="section-note">Назви, товари й ціни - демо. Натисніть на макет, щоб побачити всю сторінку й мобільну версію</p>
      </div>
      <div class="grid three" data-section="concepts">${data.concepts.map(concept).join('')}
      </div>
    </section>

    <footer>Олександр Серняк · <a href="/">ppcmarketing.pro</a></footer>
  </div>

  <dialog id="pf-viewer" aria-labelledby="pf-viewer-title">
    <div class="viewer-bar">
      <strong id="pf-viewer-title"></strong>
      <button class="close" type="button" id="pf-viewer-close">Закрити</button>
    </div>
    <div class="viewer-body">
      <figure><figcaption>Комп’ютер</figcaption><img id="pf-viewer-page" alt=""></figure>
      <figure class="phone"><figcaption>Телефон</figcaption><img id="pf-viewer-phone" alt=""></figure>
    </div>
  </dialog>

  <!-- the owner only: shown with a session in this browser, or with ?edit -->
  <button class="edit-toggle" type="button" id="pf-edit" hidden>Змінити порядок</button>
  <div class="editbar" id="pf-bar" hidden>
    <form class="signin" id="pf-signin" hidden>
      <p class="status" id="pf-signin-status" aria-live="polite">Увійдіть паролем від CRM</p>
      <input id="pf-secret" type="password" autocomplete="current-password" placeholder="Пароль від CRM" required>
      <button type="submit" class="primary" id="pf-signin-go">Увійти</button>
      <button type="button" id="pf-code">Код у Telegram</button>
      <button type="button" id="pf-signin-cancel">Скасувати</button>
    </form>
    <div class="controls" id="pf-controls" hidden>
      <p class="status" id="pf-status" aria-live="polite">Переставте картки кнопками «Вище» і «Нижче»</p>
      <button type="button" id="pf-cancel">Скасувати</button>
      <button type="button" class="primary" id="pf-save">Зберегти порядок</button>
    </div>
  </div>

  <script src="/sites/portfolio.js"></script>
</body>
</html>
`;

writeFileSync(join(here, 'index.html'), html);
console.log(`sites/index.html: ${data.live.length} live, ${data.designs.length} concepts, ${data.concepts.length} mockups`);
