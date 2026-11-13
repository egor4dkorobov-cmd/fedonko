/* ===== Шапка получает тонкую линию при прокрутке ===== */
const header = document.querySelector('.header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ===== Мини-приложение: переключатель защиты ===== */
(function app() {
  const box = document.querySelector('.app');
  const btn = box.querySelector('.power');
  const statusText = box.querySelector('.app-status-text');
  const hint = box.querySelector('.app-hint');
  const timer = box.querySelector('.app-timer');
  const ip = box.querySelector('.app-ip');
  let state = 'off', started = 0, tick = null, wait = null;

  const pad = (n) => String(n).padStart(2, '0');
  function showTime() {
    const s = Math.floor((Date.now() - started) / 1000);
    timer.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }

  function set(next) {
    state = next;
    box.dataset.state = next;
    btn.setAttribute('aria-pressed', next === 'on');
    if (next === 'off') {
      statusText.textContent = 'Не защищено';
      hint.textContent = 'Нажмите, чтобы подключиться';
      btn.setAttribute('aria-label', 'Подключить защиту');
      ip.textContent = 'открыт';
      clearInterval(tick); clearTimeout(wait);
      timer.textContent = '00:00:00';
    } else if (next === 'connecting') {
      statusText.textContent = 'Подключение…';
      hint.textContent = 'Выбираем быстрый сервер';
    } else {
      statusText.textContent = 'Защищено';
      hint.textContent = 'Соединение зашифровано';
      btn.setAttribute('aria-label', 'Отключить защиту');
      ip.textContent = 'скрыт';
      started = Date.now(); showTime();
      tick = setInterval(showTime, 1000);
    }
  }

  btn.addEventListener('click', () => {
    if (state === 'off') {
      set('connecting');
      wait = setTimeout(() => set('on'), 1200);   // имитация подключения
    } else {
      set('off');
    }
  });
})();

/* ===== Серверы: сортируем по пингу — от самого быстрого ===== */
(function sortServers() {
  const list = document.querySelector('.servers');
  [...list.children]
    .sort((a, b) => a.dataset.ping - b.dataset.ping)
    .forEach((li) => list.appendChild(li));
  // сколько строк в колонке — половина списка (чтобы читалось сверху вниз)
  list.style.setProperty('--rows', Math.ceil(list.children.length / 2));
})();

/* ===== Индикатор пинга у серверов ===== */
document.querySelectorAll('.servers li').forEach((li) => {
  const ping = +li.dataset.ping;
  const level = ping < 50 ? 3 : ping < 100 ? 2 : 1;   // 3 полоски — отлично, 1 — далеко
  li.querySelector('em').innerHTML =
    `${ping} мс <span class="bars${level === 2 ? ' mid' : ''}" aria-hidden="true">` +
    [1, 2, 3].map((i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('') + '</span>';
});

/* ===== Вопросы: открыт только один ответ за раз ===== */
const faqItems = document.querySelectorAll('.faq details');
faqItems.forEach((d) => d.addEventListener('toggle', () => {
  if (d.open) faqItems.forEach((o) => { if (o !== d) o.open = false; });
}));

/* ===== Плавное появление блоков ===== */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach((el) => {
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
  el.style.transitionDelay = `${sibs.indexOf(el) * 0.08}s`;
  io.observe(el);
});
