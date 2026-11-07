// Отключены ли анимации в настройках системы
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Есть ли у устройства мышь (на телефоне свой курсор не нужен)
const hasMouse = window.matchMedia('(pointer: fine)').matches;

/* ===== Бегущая лента: широкие MLN и звёздочки ===== */
(function marquee() {
  const track = document.querySelector('.marquee-track');
  const word = '<svg class="marquee-word" viewBox="0 0 300 80"><text x="0" y="72" textLength="300" lengthAdjust="spacingAndGlyphs" font-size="96" font-family="Archivo, Oswald, Impact, sans-serif" font-weight="900" font-stretch="125%" fill="#0b0b0c">MLN</text></svg>';
  const star = '<svg class="marquee-star" viewBox="0 0 40 40"><g stroke="#0b0b0c" stroke-width="7" stroke-linecap="round"><line x1="20" y1="4" x2="20" y2="36"/><line x1="6.1" y1="12" x2="33.9" y2="28"/><line x1="6.1" y1="28" x2="33.9" y2="12"/></g></svg>';
  // одна группа шире любого экрана, вторая — её копия, чтобы лента шла без разрыва
  const group = `<div class="marquee-group">${(word + star).repeat(10)}</div>`;
  track.innerHTML = group + group;
})();

/* ===== Шапка темнеет при прокрутке ===== */
const header = document.querySelector('.header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ===== Надпись MLN «собирается» по буквам ===== */
const title = document.querySelector('.hero-title');
title.innerHTML = [...title.textContent]
  .map((ch, i) => `<span class="ch" style="animation-delay:${0.15 + i * 0.15}s">${ch}</span>`)
  .join('');

/* ===== Свой курсор: точка + круг, круг растёт на кнопках ===== */
if (hasMouse) {
  document.body.classList.add('has-cursor');
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  let mx = innerWidth / 2, my = innerHeight / 2;  // где мышь
  let rx = mx, ry = my;                           // где круг (догоняет мышь)

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px)`;
  });

  (function follow() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(follow);
  })();

  // На всём, что можно нажать, круг увеличивается
  // на всём, что можно нажать (в том числе на кнопках, которые появляются позже), круг растёт
  document.addEventListener('mouseover', (e) => {
    ring.classList.toggle('big', !!e.target.closest('a, button, .card'));
  });

  // Над фото «до/после» прячем круг курсора — там своя линза
  const frame = document.querySelector('.ba-frame');
  if (frame) frame.addEventListener('mouseenter', () => ring.classList.add('hide'));
  if (frame) frame.addEventListener('mouseleave', () => ring.classList.remove('hide'));

  // Курсор ушёл за окно — прячем
  document.addEventListener('mouseleave', () => { dot.style.opacity = 0; ring.style.opacity = 0; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = ''; ring.style.opacity = ''; });
}

/* ===== 3D-наклон карточек за курсором ===== */
if (hasMouse && !reduceMotion) {
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;   // 0…1 слева направо
      const y = (e.clientY - r.top) / r.height;   // 0…1 сверху вниз
      const max = 5;                              // максимальный наклон в градусах
      card.style.transform = `rotateY(${(x - 0.5) * max * 2}deg) rotateX(${(0.5 - y) * max * 2}deg)`;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

/* ===== До / после: круг-линза ===== */
(function beforeAfter() {
  const frame = document.querySelector('.ba-frame');
  if (!frame) return;   // блока нет на странице — ничего не делаем
  const after = frame.querySelector('.ba-after');
  const lens = frame.querySelector('.ba-lens');

  // Размер линзы зависит от размера фото: ~30% ширины, но не меньше 110px
  const radius = () => Math.max(110, frame.clientWidth * 0.3);

  function moveTo(clientX, clientY) {
    const rect = frame.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const r = radius();
    after.style.setProperty('--x', `${x}px`);
    after.style.setProperty('--y', `${y}px`);
    after.style.setProperty('--r', `${r}px`);
    lens.style.width = lens.style.height = `${r * 2}px`;
    lens.style.transform = `translate(${x - r}px, ${y - r}px)`;
  }

  function show(e) {
    moveTo(e.clientX, e.clientY);
    // Сначала круг плавно раскрывается, потом следует за курсором без задержки
    requestAnimationFrame(() => setTimeout(() => frame.classList.add('active'), 300));
    frame.classList.add('open');
  }

  function hide() {
    frame.classList.remove('active', 'open');
    after.style.setProperty('--r', '0px');
  }

  // Мышь
  frame.addEventListener('mouseenter', show);
  frame.addEventListener('mousemove', (e) => {
    if (!frame.classList.contains('open')) show(e);
    moveTo(e.clientX, e.clientY);
  });
  frame.addEventListener('mouseleave', hide);

  // Телефон: коснулся — линза там, где палец; ведёшь пальцем — она едет
  frame.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    frame.classList.add('open', 'active');
    moveTo(t.clientX, t.clientY);
  }, { passive: true });
  frame.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    moveTo(t.clientX, t.clientY);
  }, { passive: true });
  frame.addEventListener('touchend', () => setTimeout(hide, 1200));
})();

/* ===== Блоки плавно появляются при прокрутке ===== */
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const el = entry.target;
      el.classList.add('in');
      io.unobserve(el);
      // убираем задержку, чтобы потом наклон карточек срабатывал сразу
      setTimeout(() => { el.style.transitionDelay = ''; }, 1500);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((el, i) => {
  // карточки в одном ряду появляются по очереди
  const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
  el.style.transitionDelay = `${siblings.indexOf(el) * 0.1}s`;
  io.observe(el);
});

/* ===== Частички пудры на главном экране ===== */
(function powder() {
  const canvas = document.querySelector('.powder');
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];
  let mouse = { x: -9999, y: -9999 };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 9000);   // чем больше экран — тем больше пылинок
    particles = Array.from({ length: count }, makeParticle);
  }

  function makeParticle() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.3,               // размер
      vx: (Math.random() - 0.5) * 0.15,           // медленный дрейф
      vy: -(Math.random() * 0.35 + 0.05),         // поднимаются вверх
      a: Math.random() * 0.6 + 0.15,              // прозрачность
      gold: Math.random() < 0.35,                 // часть пылинок золотые
      tw: Math.random() * Math.PI * 2,            // мерцание
    };
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      // пылинки разлетаются от курсора
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 120) {
        const f = (120 - dist) / 120 * 0.8;
        p.x += (dx / dist) * f;
        p.y += (dy / dist) * f;
      }
      p.x += p.vx; p.y += p.vy; p.tw += 0.03;
      if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      if (p.x < -5) p.x = w + 5;
      if (p.x > w + 5) p.x = -5;

      const alpha = p.a * (0.6 + Math.sin(p.tw) * 0.4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.gold ? `rgba(220,186,120,${alpha})` : `rgba(235,230,220,${alpha * 0.6})`;
      ctx.fill();
    }
    if (!reduceMotion) requestAnimationFrame(draw);
  }

  canvas.parentElement.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  canvas.parentElement.addEventListener('mouseleave', () => { mouse.x = mouse.y = -9999; });

  window.addEventListener('resize', resize);
  resize();
  draw();
})();


/* =========================================================
   ЗАСТАВКА: ждём загрузку страницы, но не меньше 1,6 секунды
   ========================================================= */
(function loader() {
  const start = performance.now();
  let done = false;
  function open() {
    if (done) return; done = true;
    const wait = reduceMotion ? 0 : Math.max(0, 1600 - (performance.now() - start));
    setTimeout(() => {
      document.body.classList.remove('loading');
      document.body.classList.add('loaded');
    }, wait);
  }
  if (document.readyState === 'complete') open();
  else window.addEventListener('load', open);
  setTimeout(open, 4000);   // на случай, если что-то грузится слишком долго
})();

/* =========================================================
   ПАРАЛЛАКС на главном экране: мышь + прокрутка
   ========================================================= */
(function parallax() {
  if (reduceMotion) return;
  const hero = document.querySelector('.hero');
  const layers = [...hero.querySelectorAll('[data-depth]')];
  let tx = 0, ty = 0, cx = 0, cy = 0;
  if (hasMouse) {
    hero.addEventListener('mousemove', (e) => {
      tx = e.clientX / innerWidth - 0.5;
      ty = e.clientY / innerHeight - 0.5;
    });
    hero.addEventListener('mouseleave', () => { tx = ty = 0; });
  }
  (function tick() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    const sy = window.scrollY;
    if (sy < innerHeight * 1.3) {
      for (const l of layers) {
        const d = +l.dataset.depth, k = +l.dataset.scroll;
        l.style.translate = `${(-cx * d * 34).toFixed(1)}px ${(-cy * d * 24 + sy * k).toFixed(1)}px`;
      }
    }
    requestAnimationFrame(tick);
  })();
})();

/* =========================================================
   ВРАЩАЮЩАЯСЯ БАНКА: надпись едет по кругу при прокрутке
   ========================================================= */
(function showcase() {
  const section = document.querySelector('.showcase');
  if (!section) return;
  const logoEl = document.getElementById('sc-logo');
  const lid = document.getElementById('sc-lid');
  const inside = document.getElementById('sc-inside');
  const back = document.getElementById('sc-back');
  const feats = [...section.querySelectorAll('[data-at]')];
  const bar = section.querySelector('.showcase-progress i');

  // контуры букв MLN: пары (u — положение по кругу 0..1, v — высота)
  const LOGO = [[0.0,170.0,0.0085,170.0,0.017,170.0,0.0254,170.0,0.0339,170.0,0.0424,170.0,0.0509,170.0,0.0594,170.0,0.0679,170.0,0.0679,162.3,0.0679,154.7,0.0679,147.0,0.0679,139.3,0.0679,131.6,0.0679,124.0,0.0679,116.3,0.0679,108.6,0.0798,116.3,0.0918,124.0,0.1037,131.6,0.1157,139.3,0.1276,147.0,0.1395,154.7,0.1515,162.3,0.1634,170.0,0.1704,170.0,0.1773,170.0,0.1842,170.0,0.1912,170.0,0.1981,170.0,0.2051,170.0,0.212,170.0,0.2189,170.0,0.2309,162.3,0.2428,154.7,0.2548,147.0,0.2667,139.3,0.2787,131.6,0.2906,124.0,0.3026,116.3,0.3145,108.6,0.3145,116.3,0.3145,124.0,0.3145,131.6,0.3145,139.3,0.3145,147.0,0.3145,154.7,0.3145,162.3,0.3145,170.0,0.323,170.0,0.3315,170.0,0.34,170.0,0.3484,170.0,0.3569,170.0,0.3654,170.0,0.3739,170.0,0.3824,170.0,0.3824,159.8,0.3824,149.5,0.3824,139.3,0.3824,129.1,0.3824,118.8,0.3824,108.6,0.3824,98.3,0.3824,88.1,0.3707,88.1,0.3591,88.1,0.3474,88.1,0.3358,88.1,0.3242,88.1,0.3125,88.1,0.3009,88.1,0.2893,88.1,0.2771,95.9,0.2649,103.6,0.2527,111.4,0.2405,119.1,0.2283,126.9,0.2161,134.7,0.2039,142.4,0.1917,150.2,0.1794,142.4,0.167,134.7,0.1547,126.9,0.1424,119.1,0.1301,111.4,0.1178,103.6,0.1054,95.9,0.0931,88.1,0.0815,88.1,0.0698,88.1,0.0582,88.1,0.0466,88.1,0.0349,88.1,0.0233,88.1,0.0116,88.1,0.0,88.1],[0.4656,170.0,0.4881,170.0,0.5105,170.0,0.533,170.0,0.5555,170.0,0.5779,170.0,0.6004,170.0,0.6229,170.0,0.6454,170.0,0.6454,168.2,0.6454,166.4,0.6454,164.6,0.6454,162.7,0.6454,160.9,0.6454,159.1,0.6454,157.3,0.6454,155.5,0.6314,155.5,0.6174,155.5,0.6034,155.5,0.5894,155.5,0.5754,155.5,0.5614,155.5,0.5474,155.5,0.5334,155.5,0.5334,147.1,0.5334,138.6,0.5334,130.2,0.5334,121.8,0.5334,113.4,0.5334,105.0,0.5334,96.5,0.5334,88.1,0.525,88.1,0.5165,88.1,0.508,88.1,0.4995,88.1,0.491,88.1,0.4825,88.1,0.4741,88.1,0.4656,88.1],[0.7033,170.0,0.7118,170.0,0.7203,170.0,0.7288,170.0,0.7372,170.0,0.7457,170.0,0.7542,170.0,0.7627,170.0,0.7712,170.0,0.7712,162.6,0.7712,155.1,0.7712,147.7,0.7712,140.2,0.7712,132.8,0.7712,125.4,0.7712,117.9,0.7712,110.5,0.7903,117.9,0.8094,125.4,0.8286,132.8,0.8477,140.2,0.8668,147.7,0.886,155.1,0.9051,162.6,0.9242,170.0,0.9337,170.0,0.9432,170.0,0.9526,170.0,0.9621,170.0,0.9716,170.0,0.9811,170.0,0.9905,170.0,1.0,170.0,1.0,159.8,1.0,149.5,1.0,139.3,1.0,129.1,1.0,118.8,1.0,108.6,1.0,98.3,1.0,88.1,0.9915,88.1,0.983,88.1,0.9746,88.1,0.9661,88.1,0.9576,88.1,0.9491,88.1,0.9406,88.1,0.9321,88.1,0.9321,95.6,0.9321,103.0,0.9321,110.5,0.9321,117.9,0.9321,125.4,0.9321,132.8,0.9321,140.3,0.9321,147.7,0.9132,140.3,0.8943,132.8,0.8753,125.4,0.8564,117.9,0.8374,110.5,0.8185,103.0,0.7995,95.6,0.7806,88.1,0.7709,88.1,0.7613,88.1,0.7516,88.1,0.742,88.1,0.7323,88.1,0.7226,88.1,0.713,88.1,0.7033,88.1]];
  const CX = 150, RX = 130, RY = 22;
  const TH0 = -80 * Math.PI / 180, SPAN = 177 * Math.PI / 180;
  const HALF = Math.PI / 2;

  function logoPath(rot) {
    let d = '';
    for (const c of LOGO) {
      const th = [];
      for (let i = 0; i < c.length; i += 2) th.push(TH0 + c[i] * SPAN + rot);
      // приводим букву к углу от -180° до 180°, не разрывая её
      const mid = (Math.min(...th) + Math.max(...th)) / 2;
      const norm = Math.atan2(Math.sin(mid), Math.cos(mid));
      const shift = norm - mid;
      if (th.every((t) => Math.abs(t + shift) > HALF)) continue;   // буква целиком сзади
      for (let i = 0, j = 0; i < c.length; i += 2, j++) {
        const t = Math.max(-HALF, Math.min(HALF, th[j] + shift));
        d += (j ? 'L' : 'M') + (CX + RX * Math.sin(t)).toFixed(1) + ' ' + (c[i + 1] + RY * Math.cos(t)).toFixed(1);
      }
      d += 'Z';
    }
    return d;
  }

  const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  let last = -1;

  function update() {
    const r = section.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight));
    if (p !== last) {
      last = p;
      const rot = ease(clamp(p / 0.7)) * Math.PI * 2;           // полный оборот
      logoEl.setAttribute('d', logoPath(rot));
      // этикетка сзади: её центр на противоположной стороне банки
      const tb = rot - Math.PI, cb = Math.cos(tb);
      if (cb > 0) {
        back.setAttribute('opacity', Math.min(1, cb * 1.5));
        back.setAttribute('transform', `translate(${(CX + RX * Math.sin(tb)).toFixed(1)} ${(RY * cb - RY).toFixed(1)}) scale(${cb.toFixed(3)} 1) translate(-150 0)`);
      } else back.setAttribute('opacity', 0);
      const o = ease(clamp((p - 0.7) / 0.2));                   // крышка поднимается
      lid.setAttribute('transform', `translate(${o * 14} ${-o * 95}) rotate(${-o * 9} 150 60)`);
      inside.setAttribute('opacity', o > 0.02 ? 1 : 0);
      feats.forEach((f) => f.classList.toggle('on', p >= +f.dataset.at));
      bar.style.transform = `scaleX(${p})`;
    }
    requestAnimationFrame(update);
  }
  update();
})();

/* =========================================================
   КОРЗИНА
   ========================================================= */
const Cart = (function () {
  const VIEW = { 'jar-wax': '0 0 300 220', 'jar-clay': '0 0 300 220', spray: '0 0 170 380', powder: '0 0 120 380', set: '0 0 300 220' };
  const USE  = { 'jar-wax': 'pk-jar-wax', 'jar-clay': 'pk-jar-clay', spray: 'pk-spray', powder: 'pk-powder', set: 'pk-jar-wax' };
  const fmt = (n) => n.toLocaleString('ru-RU') + ' ₽';
  const packSvg = (pack) => `<svg viewBox="${VIEW[pack]}"><use href="#${USE[pack]}"/></svg>`;

  let items = [];
  try { items = JSON.parse(localStorage.getItem('mln-cart')) || []; } catch (e) { items = []; }
  const save = () => { try { localStorage.setItem('mln-cart', JSON.stringify(items)); } catch (e) {} };

  const body = document.body;
  const btn = document.querySelector('.cart-btn');
  const countEl = document.querySelector('.cart-count');
  const list = document.querySelector('.cart-items');
  const totalEl = document.querySelector('.cart-total b');
  const toast = document.querySelector('.toast');
  let toastTimer;

  function showToast(html) {
    toast.innerHTML = html;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function render() {
    const count = items.reduce((s, i) => s + i.qty, 0);
    countEl.textContent = count;
    countEl.classList.toggle('show', count > 0);
    totalEl.textContent = fmt(items.reduce((s, i) => s + i.qty * i.price, 0));
    if (!items.length) { list.innerHTML = '<p class="cart-empty">Пока пусто. Добавь что-нибудь из линейки MLN.</p>'; return; }
    list.innerHTML = items.map((i) => `
      <div class="cart-item" data-id="${i.id}">
        <div class="cart-thumb">${packSvg(i.pack)}</div>
        <div><h4>${i.name}</h4><div class="ci-price">${fmt(i.price)}</div></div>
        <div class="qty"><button data-act="minus" aria-label="Меньше">−</button><span>${i.qty}</span><button data-act="plus" aria-label="Больше">+</button></div>
      </div>`).join('');
  }

  // банка «улетает» в корзину
  function fly(fromEl) {
    if (!fromEl || reduceMotion) return Promise.resolve();
    const a = fromEl.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const clone = fromEl.cloneNode(true);
    clone.classList.add('fly');
    Object.assign(clone.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: 0 });
    document.body.appendChild(clone);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = clone.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(.6) rotate(-10deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.08) rotate(-20deg)`, opacity: 0.4 },
    ], { duration: 800, easing: 'cubic-bezier(.5,0,.4,1)' });
    return anim.finished.then(() => clone.remove());
  }

  function add(data, fromEl) {
    const found = items.find((i) => i.id === data.id);
    if (found) found.qty++;
    else items.push({ id: data.id, name: data.name, price: +data.price, pack: data.pack, qty: 1 });
    save();
    fly(fromEl).then(() => {
      render();
      countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
    });
    showToast(`<b>${data.name}</b> — в корзине`);
  }

  // любая кнопка «В корзину» на странице
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.add-to-cart');
    if (!b) return;
    const holder = b.closest('[data-id]');
    if (!holder) return;
    const art = holder.querySelector('.card-art svg, .qr-art svg') || document.querySelector('.bundle-art .b-wax');
    add(holder.dataset, art);
  });

  // + / − в корзине
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('.cart-item').dataset.id;
    const it = items.find((i) => i.id === id);
    it.qty += b.dataset.act === 'plus' ? 1 : -1;
    if (it.qty <= 0) items = items.filter((i) => i !== it);
    save(); render();
  });

  const open = () => { body.classList.add('cart-open'); document.querySelector('.cart').setAttribute('aria-hidden', 'false'); };
  const close = () => { body.classList.remove('cart-open'); document.querySelector('.cart').setAttribute('aria-hidden', 'true'); };
  btn.addEventListener('click', open);
  document.querySelector('.cart-close').addEventListener('click', close);
  document.querySelector('.cart-overlay').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.querySelector('.cart-order').addEventListener('click', () => {
    showToast(items.length ? 'Это учебный сайт: заказ <b>не отправляется</b>' : 'Корзина пока пустая');
  });

  render();
  return { packSvg, fmt };
})();

/* =========================================================
   ТЕСТ «ПОДБЕРИ СРЕДСТВО»
   ========================================================= */
(function quiz() {
  const box = document.querySelector('.quiz-box');
  if (!box) return;

  const QUESTIONS = [
    { q: 'Какие у тебя волосы?', opts: [
      { v: 'thin',   b: 'Тонкие',            s: 'Быстро ложатся и теряют объём' },
      { v: 'normal', b: 'Обычные',           s: 'Ни тонкие, ни жёсткие' },
      { v: 'thick',  b: 'Густые и жёсткие',  s: 'Плохо держат форму, торчат' } ] },
    { q: 'Какой результат нужен?', opts: [
      { v: 'volume',  b: 'Объём',            s: 'Поднять волосы от корней' },
      { v: 'texture', b: 'Текстура',         s: 'Небрежно, как после пляжа' },
      { v: 'smooth',  b: 'Гладкая укладка',  s: 'Аккуратно и по-классике' } ] },
    { q: 'Блеск или мат?', opts: [
      { v: 'matte', b: 'Матовый',           s: 'Как будто без средства' },
      { v: 'shine', b: 'Лёгкий блеск',      s: 'Ухоженный, «собранный» вид' } ] },
  ];

  const PRODUCTS = {
    powder: { name: 'Пудра для объёма', price: 1090, pack: 'powder',   why: 'Поднимает волосы от корней и не утяжеляет. То, что нужно, когда причёска «падает» к обеду.' },
    spray:  { name: 'Солевой спрей',    price: 990,  pack: 'spray',    why: 'Даёт небрежную текстуру и лёгкую фиксацию. Отлично работает перед феном.' },
    clay:   { name: 'Глина',            price: 1390, pack: 'jar-clay', why: 'Матовая, с сильной фиксацией. Справится даже с самыми непослушными волосами.' },
    wax:    { name: 'Воск',             price: 1290, pack: 'jar-wax',  why: 'Гладкая укладка с лёгким блеском. Для аккуратной классики на весь день.' },
  };

  // сколько очков получает каждое средство за ответ
  const SCORE = {
    thin:    { powder: 2, spray: 1 },
    normal:  { spray: 1, clay: 1, wax: 1 },
    thick:   { clay: 2, wax: 1 },
    volume:  { powder: 3, spray: 1 },
    texture: { spray: 3, clay: 2 },
    smooth:  { wax: 3 },
    matte:   { clay: 2, powder: 1, spray: 1 },
    shine:   { wax: 3 },
  };

  let answers = [];

  function stepHTML(i) {
    const q = QUESTIONS[i];
    return `
      <div class="quiz-progress"><i style="width:${(i / QUESTIONS.length) * 100}%"></i></div>
      <div class="quiz-step">
        <span class="quiz-num">${String(i + 1).padStart(2, '0')} / ${String(QUESTIONS.length).padStart(2, '0')}</span>
        <h3 class="quiz-q">${q.q}</h3>
        <div class="quiz-opts ${q.opts.length === 2 ? 'two' : ''}">
          ${q.opts.map((o) => `<button class="quiz-opt" data-v="${o.v}"><b>${o.b}</b><span>${o.s}</span></button>`).join('')}
        </div>
        ${i > 0 ? '<button class="quiz-back">← Назад</button>' : ''}
      </div>`;
  }

  function resultHTML() {
    const total = { powder: 0, spray: 0, clay: 0, wax: 0 };
    answers.forEach((a) => Object.entries(SCORE[a]).forEach(([k, v]) => (total[k] += v)));
    const id = Object.keys(total).sort((a, b) => total[b] - total[a])[0];
    const p = PRODUCTS[id];
    return `
      <div class="quiz-progress"><i style="width:100%"></i></div>
      <div class="quiz-result" data-id="${id}" data-name="${p.name}" data-price="${p.price}" data-pack="${p.pack}">
        <div class="qr-art">${Cart.packSvg(p.pack)}</div>
        <div>
          <span class="quiz-num">Твоё средство</span>
          <h3>${p.name}</h3>
          <p>${p.why}</p>
          <div class="qr-actions">
            <b class="price">${Cart.fmt(p.price)}</b>
            <button class="btn btn-small shine add-to-cart">В корзину</button>
            <button class="quiz-restart">Пройти заново</button>
          </div>
        </div>
      </div>`;
  }

  function show() {
    box.innerHTML = answers.length < QUESTIONS.length ? stepHTML(answers.length) : resultHTML();
  }

  box.addEventListener('click', (e) => {
    const opt = e.target.closest('.quiz-opt');
    if (opt) { answers.push(opt.dataset.v); show(); return; }
    if (e.target.closest('.quiz-back')) { answers.pop(); show(); return; }
    if (e.target.closest('.quiz-restart')) { answers = []; show(); }
  });

  show();
})();
