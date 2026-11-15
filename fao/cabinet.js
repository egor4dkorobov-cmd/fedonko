/* =========================================================
   ЛИЧНЫЙ КАБИНЕТ FAO (демо-версия)
   Настоящего сервера нет: все данные хранятся в браузере
   (localStorage). Для настоящего кабинета понадобятся сервер,
   база данных и платёжная система.
   ========================================================= */
(function () {
  'use strict';

  const KEY = 'fao-cabinet';
  const REF_PERCENT = 10;                       // сколько % от оплаты друга получает пригласивший
  const MAX_DEVICES = 5;
  const PLANS = { 1: { name: '1 месяц', price: 299 }, 6: { name: '6 месяцев', price: 1494 }, 12: { name: '1 год', price: 2388 } };
  const DAY = 86400000;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- хранение ---------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  let memory = null;                             // если браузер не даёт сохранять — держим в памяти
  function save() {
    memory = S;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ничего страшного */ }
  }

  /* ---------- форматирование ---------- */
  const money = (n) => Math.round(n).toLocaleString('ru-RU').replace(/ | /g, ' ') + ' ₽';
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };
  const dateLong = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateShort = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const addMonths = (t, m) => { const d = new Date(t); d.setMonth(d.getMonth() + m); return d.getTime(); };
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------- демо-данные при первом входе ---------- */
  function demo(email) {
    const now = Date.now();
    const code = (email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'friend').toLowerCase() + Math.floor(100 + Math.random() * 900);
    const refs = [
      { id: uid(), name: 'Анна К.', date: now - 26 * DAY, paid: [2388] },
      { id: uid(), name: 'Илья С.', date: now - 19 * DAY, paid: [299] },
      { id: uid(), name: 'Марк Д.', date: now - 11 * DAY, paid: [1494] },
      { id: uid(), name: 'Ольга П.', date: now - 6 * DAY, paid: [] },
      { id: uid(), name: 'Денис Т.', date: now - 2 * DAY, paid: [] },
    ];
    return {
      email,
      refCode: code,
      balance: 450,
      plan: 1,
      started: now - 12 * DAY,
      until: now + 18 * DAY,
      devices: [
        { id: uid(), type: 'phone', name: 'iPhone 15', where: 'Москва', last: now - 5 * 60000 },
        { id: uid(), type: 'laptop', name: 'MacBook Air', where: 'Москва', last: now - 3 * 3600000 },
        { id: uid(), type: 'tv', name: 'Телевизор Samsung', where: 'Москва', last: now - 2 * DAY },
      ],
      referrals: refs,
      payments: [
        { id: uid(), kind: 'ref', title: 'Бонус за друга · Марк Д.', sum: 149, date: now - 10 * DAY },
        { id: uid(), kind: 'out', title: 'Подписка · 1 месяц', sum: 299, date: now - 12 * DAY },
        { id: uid(), kind: 'in', title: 'Пополнение баланса', sum: 300, date: now - 12 * DAY },
        { id: uid(), kind: 'ref', title: 'Бонус за друга · Илья С.', sum: 30, date: now - 18 * DAY },
        { id: uid(), kind: 'ref', title: 'Бонус за друга · Анна К.', sum: 239, date: now - 25 * DAY },
        { id: uid(), kind: 'in', title: 'Пополнение баланса', sum: 500, date: now - 40 * DAY },
        { id: uid(), kind: 'out', title: 'Подписка · 1 месяц', sum: 299, date: now - 42 * DAY },
      ],
    };
  }

  let S = load();

  /* ---------- маленькие помощники интерфейса ---------- */
  const toastEl = $('.toast');
  let toastT;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }
  function flash(el) {
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countTo(el, to, fmt) {
    const from = +(el.dataset.v || 0);
    el.dataset.v = to;
    if (reduce || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* =========================================================
     ВХОД
     ========================================================= */
  const auth = $('#auth'), dash = $('#dash');
  const fEmail = $('#step-email'), fCode = $('#step-code');
  const emailIn = fEmail.querySelector('input');
  const boxes = $$('.code-boxes input', fCode);
  let pendingEmail = '';

  function showAuth() {
    auth.hidden = false; dash.hidden = true; $('.user').hidden = true;
    fEmail.hidden = false; fCode.hidden = true;
    emailIn.value = ''; setErr(fEmail, '');
    emailIn.focus({ preventScroll: true });
  }
  function setErr(form, text, inputs = []) {
    form.querySelector('.form-error').textContent = text;
    $$('input', form).forEach((i) => i.classList.toggle('invalid', inputs.includes(i)));
  }

  fEmail.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = emailIn.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      setErr(fEmail, v ? 'Похоже, в почте ошибка. Пример: you@mail.ru' : 'Введите почту', [emailIn]);
      emailIn.focus();
      return;
    }
    pendingEmail = v.toLowerCase();
    setErr(fEmail, '');
    $('.sent-to', fCode).textContent = pendingEmail;
    fEmail.hidden = true; fCode.hidden = false;
    boxes.forEach((b) => (b.value = '')); setErr(fCode, '');
    boxes[0].focus();
  });

  // поля кода: только цифры, сами переходят к следующей, Backspace — к предыдущей, вставка целиком
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      const d = b.value.replace(/\D/g, '');
      if (d.length > 1) { fill(d, i); return; }
      b.value = d;
      if (d && i < boxes.length - 1) boxes[i + 1].focus();
      if (boxes.every((x) => x.value)) fCode.requestSubmit ? fCode.requestSubmit() : fCode.dispatchEvent(new Event('submit'));
    });
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ''; e.preventDefault(); }
      if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
      if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
    });
    b.addEventListener('paste', (e) => {
      const d = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      if (!d) return;
      e.preventDefault(); fill(d, 0);
    });
  });
  function fill(digits, from) {
    digits.slice(0, boxes.length - from).split('').forEach((c, k) => (boxes[from + k].value = c));
    const next = boxes.find((x) => !x.value);
    (next || boxes[boxes.length - 1]).focus();
    if (!next) fCode.requestSubmit ? fCode.requestSubmit() : fCode.dispatchEvent(new Event('submit'));
  }

  fCode.addEventListener('submit', (e) => {
    e.preventDefault();
    const empty = boxes.filter((x) => !x.value);
    if (empty.length) { setErr(fCode, 'Введите все 4 цифры', empty); empty[0].focus(); return; }
    // демо: подходит любой код
    const old = load();
    S = old && old.email === pendingEmail ? old : demo(pendingEmail);
    save();
    showDash();
    toast('Вы вошли в кабинет');
  });
  $('.js-change-email').addEventListener('click', () => {
    fCode.hidden = true; fEmail.hidden = false; emailIn.value = pendingEmail; emailIn.focus();
  });

  $('.js-logout').addEventListener('click', () => {
    if (S) { S.loggedOut = true; save(); }
    showAuth();
    toast('Вы вышли из кабинета');
  });
  $('.js-reset').addEventListener('click', () => {
    S = demo(S.email); save(); render(true);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    toast('Демо-данные сброшены');
  });

  /* =========================================================
     КАБИНЕТ
     ========================================================= */
  function showDash() {
    S.loggedOut = false; save();
    auth.hidden = true; dash.hidden = false;
    const u = $('.user'); u.hidden = false;
    $('.user-email', u).textContent = S.email;
    $('.avatar', u).textContent = S.email[0];
    $('.hello').textContent = 'Здравствуйте, ' + S.email.split('@')[0] + '!';
    render(true);
  }

  function render(first) {
    renderSub(); renderBalance(); renderRef(); renderDevices(); renderHistory();
    if (first) $$('.ref-list li.new').forEach((li) => li.classList.remove('new'));
  }

  /* ---------- подписка ---------- */
  function renderSub() {
    const card = $('.card-sub');
    const left = S.until ? Math.max(0, Math.ceil((S.until - Date.now()) / DAY)) : 0;
    const on = left > 0;
    const st = $('.status', card);
    st.className = 'status ' + (on ? 'on' : 'off');
    $('.status-text', st).textContent = on ? 'Активна' : 'Не активна';
    card.classList.toggle('expired', !on);

    countTo($('.days-left', card), left, (v) => Math.round(v));
    $('.days-word', card).textContent = plural(left, 'день', 'дня', 'дней');

    // кольцо: какая часть оплаченного срока ещё осталась
    const total = S.until && S.started ? Math.max(1, (S.until - S.started) / DAY) : 30;
    const part = on ? Math.max(3, Math.min(100, (left / total) * 100)) : 0;
    requestAnimationFrame(() => ($('.ring-fg', card).style.strokeDasharray = part + ' 100'));

    $('.sub-until', card).innerHTML = on
      ? `Действует до <b>${dateLong(S.until)}</b>`
      : (S.until ? `Закончилась <b>${dateLong(S.until)}</b>` : 'Подписки пока нет');
    // строки «Тариф» и «Оплачена»
    const plan = PLANS[S.plan] || PLANS[1];
    $('.sf-plan', card).textContent = S.until ? `${plan.name} · ${money(plan.price)}` : '—';
    $('.sf-paid', card).textContent = S.started ? 'с ' + dateLong(S.started) : '—';

    // подсказка: хватит ли баланса на продление
    const hint = $('.sub-hint', card);
    const fits = [12, 6, 1].find((m) => S.balance >= PLANS[m].price);
    let text;
    if (!on) text = 'VPN отключён. Продлите подписку, чтобы снова пользоваться сервисом.';
    else if (fits) text = `На балансе ${money(S.balance)} — хватит, чтобы продлить на ${PLANS[fits].name.replace('1 месяц', 'месяц')}.`;
    else text = `На балансе ${money(S.balance)} — пополните ещё ${money(PLANS[1].price - S.balance)}, чтобы продлить на месяц.`;
    if (on && left <= 3) text = 'Подписка скоро закончится. ' + text;
    hint.textContent = text;
    hint.classList.toggle('warn', !on || left <= 3);
    $('.js-open-plans', card).textContent = on ? 'Продлить подписку' : 'Оформить подписку';
  }

  /* ---------- баланс ---------- */
  function renderBalance() {
    countTo($('.balance-num'), S.balance, (v) => Math.round(v).toLocaleString('ru-RU').replace(/ | /g, ' '));
  }

  /* ---------- рефералы ---------- */
  function refLink() {
    const base = location.origin && location.origin !== 'null' ? location.origin + location.pathname.replace(/cabinet\.html$/, '') : 'https://fao.example/';
    return base + '?ref=' + S.refCode;
  }
  function renderRef() {
    const link = refLink();
    $('.ref-input').value = link;
    $('.js-share').href = 'https://t.me/share/url?url=' + encodeURIComponent(link) +
      '&text=' + encodeURIComponent('Пользуюсь VPN FAO — быстрый и без логов. Подключайся по моей ссылке:');

    const paidRefs = S.referrals.filter((r) => r.paid.length);
    const earned = S.referrals.reduce((s, r) => s + r.paid.reduce((a, p) => a + bonus(p), 0), 0);
    countTo($('.st-invited'), S.referrals.length, (v) => Math.round(v));
    countTo($('.st-paid'), paidRefs.length, (v) => Math.round(v));
    countTo($('.st-earned'), earned, money);

    $('.ref-list').innerHTML = S.referrals.length ? S.referrals.slice().sort((a, b) => b.date - a.date).map((r) => {
      const sum = r.paid.reduce((a, p) => a + bonus(p), 0);
      return `<li data-id="${r.id}"${r.fresh ? ' class="new"' : ''}>
        <span class="ref-who"><span class="avatar" aria-hidden="true">${esc(r.name[0])}</span><span>${esc(r.name)}</span></span>
        <span class="ref-state${r.paid.length ? ' paid' : ''}">${r.paid.length ? 'Оплатил' + (r.paid.length > 1 ? ' ×' + r.paid.length : '') : 'Пока не оплатил'} · ${dateShort(r.date)}</span>
        <span class="ref-earn${sum ? '' : ' zero'}">${sum ? '+' + money(sum) : '0 ₽'}</span>
      </li>`;
    }).join('') : '<li class="dev-empty" style="display:block">Пока никого. Отправьте ссылку другу!</li>';
    S.referrals.forEach((r) => delete r.fresh);
  }
  const bonus = (p) => Math.round(p * REF_PERCENT / 100);

  $('.js-copy').addEventListener('click', async () => {
    const input = $('.ref-input'), text = input.value;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      input.focus(); input.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    }
    const lbl = $('.js-copy span');
    if (ok) { lbl.textContent = 'Скопировано'; toast('Ссылка скопирована'); setTimeout(() => (lbl.textContent = 'Скопировать'), 1800); }
    else { input.select(); toast('Выделили ссылку — скопируйте её вручную'); }
  });

  // демо: один из друзей (или новый) оплатил год → нам 10%
  const NEW_NAMES = ['Вика Л.', 'Саша М.', 'Катя Р.', 'Тимур Б.', 'Лена Ф.', 'Глеб Н.'];
  $('.js-demo-pay').addEventListener('click', () => {
    const price = PLANS[12].price;
    let r = S.referrals.find((x) => !x.paid.length);
    if (!r) {
      r = { id: uid(), name: NEW_NAMES[S.referrals.length % NEW_NAMES.length], date: Date.now(), paid: [] };
      S.referrals.push(r);
    }
    r.paid.push(price); r.fresh = true;
    const b = bonus(price);
    S.balance += b;
    S.payments.unshift({ id: uid(), kind: 'ref', title: 'Бонус за друга · ' + r.name, sum: b, date: Date.now() });
    save(); render();
    flash($('.card-balance')); flash($('.card-ref'));
    toast(`${r.name} оплатил(а) год — вам +${money(b)}`);
  });

  /* ---------- устройства ---------- */
  const DEV_ICONS = {
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
    tv: '<rect x="2.5" y="4.5" width="19" height="12.5" rx="2"/><path d="M8 20.5h8"/>',
    tablet: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  };
  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return 'в сети сейчас';
    if (m < 60) return `${m} мин назад`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`;
    const d = Math.round(h / 24);
    return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
  }
  function renderDevices() {
    const n = S.devices.length;
    $('.dev-count').textContent = `${n} из ${MAX_DEVICES}`;
    $$('.dev-bar i').forEach((i, k) => i.classList.toggle('on', k < n));
    $('.dev-list').innerHTML = n ? S.devices.map((d) => `
      <li>
        <span class="dev-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${DEV_ICONS[d.type] || DEV_ICONS.phone}</svg></span>
        <span class="dev-txt"><b>${esc(d.name)}</b><span>${esc(d.where)} · ${ago(d.last)}</span></span>
        <button type="button" class="dev-off" data-id="${d.id}" aria-label="Отключить ${esc(d.name)}">Отключить</button>
      </li>`).join('') : '<li class="dev-empty" style="border:0;justify-content:center">Нет подключённых устройств</li>';
    const add = $('.js-add-dev');
    add.disabled = n >= MAX_DEVICES;
    add.textContent = n >= MAX_DEVICES ? 'Подключено максимум — 5 устройств' : '+ Подключить устройство';
  }
  // «Отключить» сначала спрашивает подтверждение
  let devToOff = null;
  $('.dev-list').addEventListener('click', (e) => {
    const b = e.target.closest('.dev-off');
    if (!b) return;
    const d = S.devices.find((x) => x.id === b.dataset.id);
    if (!d) return;
    devToOff = d.id;
    $('.do-name').textContent = d.name;
    openModal('#m-devoff');
  });
  $('.js-devoff-yes').addEventListener('click', () => {
    const d = S.devices.find((x) => x.id === devToOff);
    S.devices = S.devices.filter((x) => x.id !== devToOff);
    devToOff = null;
    save();
    closeModal($('#m-devoff'));
    renderDevices();
    toast(`${d ? d.name : 'Устройство'} отключено`);
    const next = $('.dev-off') || $('.js-add-dev'); next.focus({ preventScroll: true });
  });
  const NEW_DEVICES = [
    { type: 'phone', name: 'Android-телефон' }, { type: 'tablet', name: 'iPad' },
    { type: 'laptop', name: 'Ноутбук Windows' }, { type: 'tv', name: 'Android TV' }, { type: 'phone', name: 'iPhone 13' },
  ];
  $('.js-add-dev').addEventListener('click', () => {
    if (S.devices.length >= MAX_DEVICES) return;
    if (!isOn()) { toast('Сначала продлите подписку'); openModal('#m-plans'); return; }
    const names = S.devices.map((d) => d.name);
    const pick = NEW_DEVICES.find((d) => !names.includes(d.name)) || NEW_DEVICES[0];
    S.devices.push({ id: uid(), ...pick, where: 'Москва', last: Date.now() });
    save(); renderDevices(); flash($('.card-dev'));
    toast(`${pick.name} подключено`);
  });
  const isOn = () => S.until && S.until > Date.now();

  /* ---------- история ---------- */
  const H_ICONS = {
    in: '<path d="M12 5v14M5 12h14"/>',
    out: '<path d="M12 3 5 6v5.5c0 4.6 3 8 7 9.5 4-1.5 7-4.9 7-9.5V6l-7-3z"/>',
    ref: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M17 8v6M14 11h6"/>',
  };
  function renderHistory() {
    const list = S.payments.slice().sort((a, b) => b.date - a.date).slice(0, 12);
    $('.hist-list').innerHTML = list.length ? list.map((p) => `
      <li class="h-${p.kind}">
        <span class="h-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${H_ICONS[p.kind]}</svg></span>
        <span class="h-txt"><b>${esc(p.title)}</b><span>${dateLong(p.date)}</span></span>
        <span class="h-sum">${p.kind === 'out' ? '−' : '+'}${money(p.sum)}</span>
      </li>`).join('') : '<li class="dev-empty" style="display:block">Платежей пока нет</li>';
  }

  /* =========================================================
     ОКНА: продление и пополнение
     ========================================================= */
  let lastFocus = null;
  function openModal(sel) {
    const m = $(sel);
    lastFocus = document.activeElement;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    if (sel === '#m-plans') updatePay();
    if (sel === '#m-topup') resetTopup();
    const first = m.querySelector('.js-cancel, input:checked, .chip, button:not(.modal-x)');
    (first || m.querySelector('button')).focus({ preventScroll: true });
  }
  function closeModal(m) {
    m.hidden = true;
    if (!$$('.modal').some((x) => !x.hidden)) document.body.style.overflow = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.js-close')) closeModal(m); });
  });
  document.addEventListener('keydown', (e) => {
    const m = $$('.modal').find((x) => !x.hidden);
    if (!m) return;
    if (e.key === 'Escape') closeModal(m);
    if (e.key === 'Tab') {                       // фокус не уходит за пределы окна
      const f = $$('button, input, [href]', m).filter((x) => !x.disabled && x.offsetParent !== null);
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); }
    }
  });

  /* ---------- продление ---------- */
  $('.js-open-plans').addEventListener('click', () => openModal('#m-plans'));
  const planVal = () => +$('#m-plans input[name=plan]:checked').value;
  $$('#m-plans input[name=plan]').forEach((r) => r.addEventListener('change', updatePay));
  let shortBy = 0, backToPlans = false;
  function updatePay() {
    const price = PLANS[planVal()].price;
    $('.ps-balance').textContent = money(S.balance);
    $('.ps-price').textContent = money(price);
    shortBy = Math.max(0, price - S.balance);
    const warn = $('.pay-warn'), btn = $('.js-pay');
    if (shortBy) {
      warn.hidden = false;
      warn.textContent = `На балансе не хватает ${money(shortBy)}. Пополните баланс — и сразу сможете оплатить.`;
      btn.textContent = `Пополнить на ${money(Math.max(100, shortBy))}`;
    } else {
      warn.hidden = true;
      const from = isOn() ? S.until : Date.now();
      btn.textContent = `Оплатить ${money(price)} · до ${dateLong(addMonths(from, planVal()))}`;
    }
  }
  $('.js-pay').addEventListener('click', () => {
    const m = planVal(), price = PLANS[m].price;
    if (shortBy) {                               // денег мало — открываем пополнение с нужной суммой
      backToPlans = true;
      closeModal($('#m-plans'));
      openModal('#m-topup');
      $('.topup-input').value = Math.max(100, shortBy);
      $('.topup-input').dispatchEvent(new Event('input'));
      $('.topup-input').focus();
      return;
    }
    const from = isOn() ? S.until : Date.now();
    if (!isOn()) S.started = Date.now();
    S.until = addMonths(from, m);
    S.plan = m;
    S.balance -= price;
    S.payments.unshift({ id: uid(), kind: 'out', title: 'Подписка · ' + PLANS[m].name, sum: price, date: Date.now() });
    save(); closeModal($('#m-plans')); render();
    flash($('.card-sub')); flash($('.card-balance'));
    toast(`Готово! Подписка действует до ${dateLong(S.until)}`);
  });

  /* ---------- пополнение ---------- */
  $('.js-open-topup').addEventListener('click', () => { backToPlans = false; openModal('#m-topup'); });
  const topIn = $('.topup-input'), topErr = $('#m-topup .form-error');
  function resetTopup() {
    $$('.chip').forEach((c) => c.classList.remove('on'));
    topIn.value = ''; topIn.classList.remove('invalid'); topErr.textContent = '';
  }
  $$('.chip').forEach((c) => c.addEventListener('click', () => {
    $$('.chip').forEach((x) => x.classList.toggle('on', x === c));
    topIn.value = c.dataset.sum; topIn.classList.remove('invalid'); topErr.textContent = '';
  }));
  topIn.addEventListener('input', () => {
    $$('.chip').forEach((x) => x.classList.toggle('on', x.dataset.sum === topIn.value));
    topIn.classList.remove('invalid'); topErr.textContent = '';
  });
  topIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('.js-topup').click(); });
  $('.js-topup').addEventListener('click', () => {
    const v = Math.round(+topIn.value);
    if (!topIn.value || !(v >= 100 && v <= 50000)) {
      topErr.textContent = topIn.value ? 'Сумма должна быть от 100 до 50 000 ₽' : 'Выберите или введите сумму';
      topIn.classList.add('invalid'); topIn.focus();
      return;
    }
    S.balance += v;
    S.payments.unshift({ id: uid(), kind: 'in', title: 'Пополнение баланса', sum: v, date: Date.now() });
    save(); closeModal($('#m-topup')); render();
    flash($('.card-balance'));
    toast(`Баланс пополнен на ${money(v)}`);
    if (backToPlans) { backToPlans = false; openModal('#m-plans'); }   // вернулись к оплате подписки
  });

  /* ---------- старт ---------- */
  if (S && S.email && !S.loggedOut) showDash(); else showAuth();
  // раз в минуту обновляем «осталось дней» и «был в сети»
  setInterval(() => { if (!dash.hidden) { renderSub(); renderDevices(); } }, 60000);
})();
