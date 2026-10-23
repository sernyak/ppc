// /sites/: the saved card order, the mockup viewer and the owner's rearranging.
// The order lives on prodavai.site (POST /api/portfolio, functions/src/portfolio.ts in the ПродавAI repo; it lets this
// site in by CORS). Sign-in is the ПродавAI CRM's - its password, or a code its bot sends to Telegram - through the same
// endpoint; the session it buys is kept in this browser.
(function () {
  'use strict';

  var API = 'https://prodavai.site/api/portfolio';
  /** the blocks, the same as PORTFOLIO_SECTIONS on the server */
  var SECTIONS = ['live', 'designs', 'concepts'];
  var SESSION_KEY = 'ppc-sites-session';

  var $ = function (id) { return document.getElementById(id); };
  var grids = {};
  SECTIONS.forEach(function (s) { grids[s] = document.querySelector('[data-section="' + s + '"]'); });

  function post(body) {
    return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      })
      .catch(function () { return { ok: false, status: 0, data: {} }; });
  }

  function storedSession() {
    try { return localStorage.getItem(SESSION_KEY) || ''; } catch (e) { return ''; }
  }
  var session = storedSession();
  function keepSession(value) {
    try {
      if (value) localStorage.setItem(SESSION_KEY, value);
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* private mode: the session lives until the tab closes */ }
    session = value;
  }

  // ---- the order ---------------------------------------------------------------------------------

  function cardsOf(s) { return Array.prototype.slice.call(grids[s].querySelectorAll(':scope > [data-id]')); }
  function currentOrder() {
    var o = {};
    SECTIONS.forEach(function (s) { o[s] = cardsOf(s).map(function (e) { return e.dataset.id; }); });
    return o;
  }

  /** Puts the cards in the saved order; cards the order doesn't know (added since) keep their place at the end. */
  function apply(order) {
    SECTIONS.forEach(function (s) {
      var list = order[s];
      if (!Array.isArray(list)) return;
      var grid = grids[s];
      var left = new Map(cardsOf(s).map(function (e) { return [e.dataset.id, e]; }));
      list.forEach(function (id) {
        var el = typeof id === 'string' ? left.get(id) : undefined;
        if (!el) return;
        grid.append(el);
        left.delete(id);
      });
      left.forEach(function (el) { grid.append(el); });
    });
  }

  post({ action: 'load' }).then(function (r) {
    if (r.ok && r.data.order && typeof r.data.order === 'object') apply(r.data.order);
  }).finally(function () { document.documentElement.classList.remove('order-pending'); });

  // ---- the mockup viewer -------------------------------------------------------------------------

  var viewer = $('pf-viewer');
  function openViewer(btn) {
    var id = btn.dataset.view;
    var title = btn.dataset.title || '';
    $('pf-viewer-title').textContent = title;
    var page = $('pf-viewer-page');
    var phone = $('pf-viewer-phone');
    page.src = '/sites/img/' + id + '-page.jpg';
    page.alt = title + ': уся сторінка на комп’ютері';
    phone.src = '/sites/img/' + id + '-phone.jpg';
    phone.alt = title + ': мобільна версія';
    if (typeof viewer.showModal === 'function') viewer.showModal();
    else viewer.setAttribute('open', '');
    viewer.scrollTop = 0;
  }
  function closeViewer() {
    if (typeof viewer.close === 'function') viewer.close();
    else viewer.removeAttribute('open');
  }
  $('pf-viewer-close').addEventListener('click', closeViewer);
  viewer.addEventListener('click', function (e) { if (e.target === viewer) closeViewer(); });

  // ---- rearranging (the owner) -------------------------------------------------------------------

  var toggle = $('pf-edit');
  var bar = $('pf-bar');
  var signin = $('pf-signin');
  var signinStatus = $('pf-signin-status');
  var secret = $('pf-secret');
  var controls = $('pf-controls');
  var statusLine = $('pf-status');
  var saveBtn = $('pf-save');
  var cancelBtn = $('pf-cancel');

  var editing = false;
  var before = currentOrder();
  var signinMode = 'password';
  /** signing in again in the middle of rearranging: the new order stays on the page and is saved after it */
  var resume = false;

  function showToggle() { toggle.hidden = editing || !(session || new URLSearchParams(location.search).has('edit')); }
  showToggle();

  function movers(s) {
    var cards = cardsOf(s);
    cards.forEach(function (card, i) {
      var box = card.querySelector(':scope > .mover');
      if (!box) {
        box = document.createElement('div');
        box.className = 'mover';
        var pos = document.createElement('span');
        pos.className = 'pos';
        box.append(pos);
        [['up', '↑ Вище'], ['down', '↓ Нижче']].forEach(function (pair) {
          var b = document.createElement('button');
          b.type = 'button';
          b.dataset.move = pair[0];
          b.textContent = pair[1];
          var h = card.querySelector('h3');
          b.setAttribute('aria-label', (h ? h.textContent : '') + ': ' + (pair[0] === 'up' ? 'вище' : 'нижче'));
          box.append(b);
        });
        card.prepend(box);
      }
      box.querySelector('.pos').textContent = (i + 1) + ' з ' + cards.length;
      box.querySelector('[data-move="up"]').disabled = i === 0;
      box.querySelector('[data-move="down"]').disabled = i === cards.length - 1;
    });
  }

  function changed() { return JSON.stringify(currentOrder()) !== JSON.stringify(before); }

  function startEditing() {
    editing = true;
    before = currentOrder();
    document.body.classList.add('editing');
    SECTIONS.forEach(movers);
    bar.hidden = false;
    signin.hidden = true;
    controls.hidden = false;
    statusLine.textContent = 'Переставте картки кнопками «Вище» і «Нижче»';
    showToggle();
  }

  function stopEditing() {
    editing = false;
    document.body.classList.remove('editing');
    document.querySelectorAll('.mover').forEach(function (m) { m.remove(); });
    bar.hidden = true;
    showToggle();
  }

  function askSignIn(text, again) {
    resume = Boolean(again);
    signinMode = 'password';
    secret.type = 'password';
    secret.value = '';
    secret.placeholder = 'Пароль від CRM';
    secret.autocomplete = 'current-password';
    secret.removeAttribute('inputmode');
    signinStatus.textContent = text || 'Увійдіть паролем від CRM';
    bar.hidden = false;
    controls.hidden = true;
    signin.hidden = false;
    toggle.hidden = true;
    secret.focus();
  }

  toggle.addEventListener('click', function () { if (session) startEditing(); else askSignIn(); });

  function backToControls(text) {
    resume = false;
    signin.hidden = true;
    controls.hidden = false;
    statusLine.textContent = text;
  }

  $('pf-signin-cancel').addEventListener('click', function () {
    if (resume) { backToControls('Порядок не збережено'); return; }
    bar.hidden = true;
    signin.hidden = true;
    showToggle();
  });

  $('pf-code').addEventListener('click', function () {
    signinStatus.textContent = 'Надсилаю код…';
    post({ action: 'code' }).then(function (r) {
      if (!r.ok) {
        signinStatus.textContent = String(r.data.message || 'Не вдалося надіслати код. Спробуйте ще раз');
        return;
      }
      signinMode = 'code';
      secret.type = 'text';
      secret.value = '';
      secret.placeholder = '6 цифр';
      secret.autocomplete = 'one-time-code';
      secret.setAttribute('inputmode', 'numeric');
      signinStatus.textContent = 'Код надіслано в Telegram. Введіть 6 цифр';
      secret.focus();
    });
  });

  signin.addEventListener('submit', function (e) {
    e.preventDefault();
    var go = $('pf-signin-go');
    go.disabled = true;
    post(signinMode === 'password' ? { action: 'password', password: secret.value } : { action: 'login', code: secret.value }).then(function (r) {
      go.disabled = false;
      if (r.ok && typeof r.data.session === 'string') {
        keepSession(r.data.session);
        if (resume) backToControls('Увійшли. Натисніть «Зберегти порядок»');
        else startEditing();
        return;
      }
      signinStatus.textContent = String(r.data.message || 'Не вийшло увійти. Спробуйте ще раз');
    });
  });

  function move(card, step) {
    var grid = card.parentElement;
    if (step < 0 && card.previousElementSibling) grid.insertBefore(card, card.previousElementSibling);
    if (step > 0 && card.nextElementSibling) grid.insertBefore(card.nextElementSibling, card);
    SECTIONS.forEach(movers);
    var same = card.querySelector('[data-move="' + (step < 0 ? 'up' : 'down') + '"]');
    var other = card.querySelector('[data-move="' + (step < 0 ? 'down' : 'up') + '"]');
    (same.disabled ? other : same).focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    statusLine.textContent = changed() ? 'Порядок змінено. Натисніть «Зберегти порядок»' : 'Порядок як був';
  }

  document.addEventListener('click', function (e) {
    var target = e.target;
    var mv = target.closest('[data-move]');
    if (mv) { move(mv.closest('.work'), mv.dataset.move === 'up' ? -1 : 1); return; }
    if (editing) {
      // while rearranging, a tap on a card must not leave the page
      if (target.closest('.work a, .work [data-view]')) e.preventDefault();
      return;
    }
    var view = target.closest('[data-view]');
    if (view) openViewer(view);
  });

  cancelBtn.addEventListener('click', function () {
    apply(before);
    stopEditing();
  });

  saveBtn.addEventListener('click', function () {
    if (!changed()) { stopEditing(); return; }
    saveBtn.disabled = cancelBtn.disabled = true;
    statusLine.textContent = 'Зберігаю…';
    post({ action: 'save', session: session, order: currentOrder() }).then(function (r) {
      saveBtn.disabled = cancelBtn.disabled = false;
      if (r.ok) { stopEditing(); return; }
      if (r.status === 401) {
        keepSession('');
        askSignIn('Вхід застарів. Увійдіть ще раз - порядок лишається на сторінці', true);
        return;
      }
      statusLine.textContent = 'Не вдалося зберегти. Натисніть «Зберегти порядок» ще раз';
    });
  });
})();
