/* =========================================================
   СЕТЬ FAO: вращающаяся Земля
   Снимки Земли: NASA Blue Marble / Black Marble (свободное использование)
   - сама планета рисуется видеокартой (WebGL) по снимкам NASA
   - метки серверов, подписи и дуга подключения — обычные элементы поверх
   - всё перерисовывается только когда что-то меняется (прокрутка, перетаскивание)
   ========================================================= */
(function globe() {
  const sec = document.querySelector('.globe-sec');
  if (!sec) return;

  const box = sec.querySelector('.globe-box');
  const glCanvas = sec.querySelector('.globe-gl');
  const svg = sec.querySelector('.globe-svg');
  const layer = sec.querySelector('.globe-labels');
  const stars = sec.querySelector('.globe-stars');
  const timed = [...sec.querySelectorAll('[data-at]')];
  const bar = sec.querySelector('.globe-progress i');
  const header = document.querySelector('.header');

  const RAD = Math.PI / 180;
  const K = 1.6;               // холст в 1,6 раза больше планеты (место под свечение и подписи)
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- где стоят серверы: [долгота, широта] и куда смотрит подпись ---------- */
  const PLACE = {
    NL: { at: [4.9, 52.37],    off: [-0.34, -0.30] },   // Амстердам
    GB: { at: [-0.13, 51.51],  off: [-0.46, -0.02] },   // Лондон
    DE: { at: [8.68, 50.11],   off: [0.04, 0.42] },     // Франкфурт
    FR: { at: [2.35, 48.86],   off: [-0.40, 0.22] },    // Париж
    SE: { at: [18.07, 59.33],  off: [-0.06, -0.42] },   // Стокгольм
    FI: { at: [24.94, 60.17],  off: [0.26, -0.34] },    // Хельсинки
    TR: { at: [28.98, 41.01],  off: [0.34, 0.26] },     // Стамбул
    KZ: { at: [76.89, 43.24],  off: [0.34, -0.10] },    // Алматы
    US: { at: [-74.0, 40.71],  off: [0.30, 0.24] },     // Нью-Йорк
    CA: { at: [-79.38, 43.65], off: [-0.30, -0.26] },   // Торонто
    JP: { at: [139.69, 35.69], off: [0.30, -0.22] },    // Токио
    SG: { at: [103.82, 1.35],  off: [0.10, 0.36] },     // Сингапур
  };
  const YOU = { at: [37.62, 55.75], off: [0.36, 0.15], name: 'Вы · Москва' };

  /* ---------- математика: точка на шаре → точка на экране ---------- */
  const geo = (lon, lat) => {
    const a = lon * RAD, b = lat * RAD;
    return [Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a)];
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // три оси «камеры», которая смотрит на точку (lon0, lat0): вправо, вверх и на зрителя
  function basis(lon0, lat0) {
    const a = lon0 * RAD, b = lat0 * RAD;
    return {
      E: [Math.cos(a), 0, -Math.sin(a)],
      N: [-Math.sin(b) * Math.sin(a), Math.cos(b), -Math.sin(b) * Math.cos(a)],
      W: [Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a)],
    };
  }
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* ---------- серверы берём из списка на странице (название, пинг, флаг) ---------- */
  const servers = [];
  document.querySelectorAll('.servers li').forEach((li) => {
    const flag = li.querySelector('.flag');
    const code = flag && flag.title;
    if (!PLACE[code]) return;
    servers.push({
      code,
      name: [...li.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(),
      ping: +li.dataset.ping,
      flag: flag.querySelector('svg').outerHTML,
      v3: geo(...PLACE[code].at),
      off: PLACE[code].off,
    });
  });
  servers.sort((a, b) => a.ping - b.ping);     // у самых быстрых подписи важнее
  const nearest = servers[0];
  const you = { name: YOU.name, v3: geo(...YOU.at), off: YOU.off, isYou: true };
  const points = [you, ...servers];

  if (nearest) {
    sec.querySelector('.gs-country').textContent = nearest.name;
    sec.querySelector('.gs-ping').textContent = nearest.ping + ' мс';
  }

  /* ---------- создаём метки, подписи и линии ---------- */
  const mk = (tag, cls) => { const e = document.createElementNS(SVGNS, tag); if (cls) e.setAttribute('class', cls); svg.appendChild(e); return e; };
  const arcGlow = mk('path', 'g-arc-glow');
  const arc = mk('path', 'g-arc');
  const packets = mk('path', 'g-packets');
  [arcGlow, arc, packets].forEach((p) => p.setAttribute('pathLength', '1'));
  arc.style.strokeDasharray = arcGlow.style.strokeDasharray = '1';

  points.forEach((s) => {
    s.line = mk('line');
    s.dot = document.createElement('div');
    s.dot.className = 'gm' + (s.isYou ? ' you' : '');
    s.dot.innerHTML = '<i></i><u></u><b></b>';
    s.label = document.createElement('div');
    s.label.className = 'gl' + (s.isYou ? ' you' : '') + (s.off[0] < 0 ? ' to-left' : '');
    s.label.innerHTML = s.isYou
      ? `<span class="gl-chip">${s.name}</span>`
      : `<span class="gl-chip"><span class="gl-flag">${s.flag}</span>${s.name}<small>${s.ping} мс</small></span>`;
    layer.append(s.dot, s.label);
  });

  /* ---------- состояние ---------- */
  let S = 0, R = 0, C = 0;           // размер планеты, радиус и центр холста (в пикселях)
  let OUT = 60;                      // на сколько пикселей подписи могут выступать за планету
  let p = 0;                         // прогресс прокрутки блока: 0…1
  let dLon = 0, dLat = 0;            // на сколько планету повернули мышью
  let dragging = false, lastDrag = 0;
  let gl = null, prog = null, uni = null, texReady = 0;
  let queued = false;

  function measure() {
    S = box.clientWidth; R = S / 2; C = (S * K) / 2;
    const stage = box.parentElement;
    const cols = getComputedStyle(stage).gridTemplateColumns.split(' ').length;
    OUT = cols > 1 ? parseFloat(getComputedStyle(stage).columnGap) - 16     // на компьютере — в пределах отступа до текста
                   : Math.max(8, (innerWidth - S) / 2 - 10);               // на телефоне — до края экрана
    svg.setAttribute('viewBox', `0 0 ${S * K} ${S * K}`);
    points.forEach((s) => { const c = s.label.firstElementChild; s.w = c.offsetWidth; s.h = c.offsetHeight; });
    if (gl) {
      const px = Math.round(Math.min(S * K * Math.min(devicePixelRatio || 1, 2), 1700));
      if (glCanvas.width !== px) { glCanvas.width = glCanvas.height = px; gl.viewport(0, 0, px, px); }
    }
    drawStars();
  }

  /* ---------- звёзды (рисуются один раз) ---------- */
  function drawStars() {
    const w = stars.clientWidth, h = stars.clientHeight;
    if (!w || (stars.width === w && stars.height === h)) return;
    stars.width = w; stars.height = h;
    const c = stars.getContext('2d');
    let seed = 7;                                             // свой «случайный» генератор — звёзды всегда на тех же местах
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = Math.round((w * h) / 4200);
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, r = rnd() * 1.1 + 0.25, a = rnd() * 0.7 + 0.15, t = rnd();
      c.globalAlpha = a;
      c.fillStyle = t < 0.12 ? '#d8b4fe' : t < 0.2 ? '#fbcfe8' : '#ffffff';
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    }
  }

  /* ---------- куда смотрит камера ---------- */
  function view() {
    const t = clamp(p / 0.78);
    const e = 1 - Math.pow(1 - t, 1.6);                       // к финалу вращение мягко замедляется
    // тур в сторону настоящего вращения Земли: Америка → Япония, Сингапур → Казахстан → Европа
    const lon0 = -96 - 246 * e + dLon;
    const lat0 = clamp(33 + 16 * smooth(0.55, 0.78, p) + dLat, -65, 78);
    return basis(lon0, lat0);
  }

  /* ---------- перерисовка ---------- */
  function render() {
    queued = false;
    if (!S) return;
    const B = view();

    // 1. планета
    if (gl && texReady === 3) {
      gl.uniformMatrix3fv(uni.rot, false, [...B.E, ...B.N, ...B.W]);
      gl.uniform2f(uni.res, glCanvas.width, glCanvas.height);
      gl.uniform1f(uni.r, (glCanvas.width / (S * K)) * R);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 2. метки серверов, подписи и линии
    const youA = smooth(0.78, 0.84, p);                       // «Вы» появляется только в финале
    const placed = [];
    for (const s of points) {
      const x = dot(s.v3, B.E), y = dot(s.v3, B.N), z = dot(s.v3, B.W);
      let v = smooth(0.08, 0.3, z);                           // чем ближе к краю планеты, тем прозрачнее
      if (s.isYou) v *= youA;
      const sx = C + x * R, sy = C - y * R;
      s.sx = sx; s.sy = sy; s.z = z;
      s.dot.style.opacity = v.toFixed(3);
      s.dot.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${(0.55 + 0.45 * v).toFixed(3)})`;

      // подпись: место рядом с меткой; если там уже стоит другая подпись — прячем
      let lx = sx + s.off[0] * R;
      const ly = clamp(sy + s.off[1] * R, C - R - 4, C + R + 22);   // и не поднимается к заголовку
      // подпись не уходит дальше поля вокруг планеты (чтобы не налезать на соседний текст)
      if (s.off[0] < 0) lx = Math.max(lx, C - R - OUT + s.w); else lx = Math.min(lx, C + R + OUT - s.w);
      const left = s.off[0] < 0 ? lx - s.w : lx;
      const rect = [left - 4, ly - s.h / 2 - 3, left + s.w + 4, ly + s.h / 2 + 3];
      const clash = placed.some((q) => rect[0] < q[2] && rect[2] > q[0] && rect[1] < q[3] && rect[3] > q[1]);
      const show = z > 0.5 && !clash;                       // подпись — только когда сервер хорошо виден
      if (show) placed.push(rect);
      s.label.classList.toggle('hidden', !show);
      s.label.style.opacity = show ? v.toFixed(3) : 0;
      s.label.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;

      // линия от метки к подписи
      const len = Math.hypot(lx - sx, ly - sy) || 1, gap = 6;
      s.line.setAttribute('x1', (sx + ((lx - sx) / len) * gap).toFixed(1));
      s.line.setAttribute('y1', (sy + ((ly - sy) / len) * gap).toFixed(1));
      s.line.setAttribute('x2', lx.toFixed(1));
      s.line.setAttribute('y2', ly.toFixed(1));
      s.line.style.opacity = show ? (v * 0.9).toFixed(3) : 0;
    }

    // 3. дуга подключения «Вы → ближайший сервер»
    const drawn = smooth(0.84, 0.93, p);
    if (nearest && youA > 0.01) {
      let d = '', pen = false;
      const a = you.v3, b = nearest.v3;
      const om = Math.acos(clamp(dot(a, b), -1, 1)), so = Math.sin(om) || 1;
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const ka = Math.sin((1 - t) * om) / so, kb = Math.sin(t * om) / so;
        const h = 1 + 0.16 * Math.sin(Math.PI * t);           // дуга приподнята над поверхностью
        const q = [(a[0] * ka + b[0] * kb) * h, (a[1] * ka + b[1] * kb) * h, (a[2] * ka + b[2] * kb) * h];
        const z = dot(q, B.W);
        if (z < 0) { pen = false; continue; }                 // часть за планетой не рисуем
        d += (pen ? 'L' : 'M') + (C + dot(q, B.E) * R).toFixed(1) + ' ' + (C - dot(q, B.N) * R).toFixed(1);
        pen = true;
      }
      const vis = Math.min(youA, smooth(0.0, 0.25, Math.min(you.z, nearest.z)));
      for (const el of [arc, arcGlow, packets]) el.setAttribute('d', d);
      arc.style.strokeDashoffset = arcGlow.style.strokeDashoffset = (1 - drawn).toFixed(3);
      arc.style.opacity = arcGlow.style.opacity = vis.toFixed(3);
      packets.style.opacity = (vis * smooth(0.92, 0.97, p)).toFixed(3);
    } else {
      arc.style.opacity = arcGlow.style.opacity = packets.style.opacity = 0;
    }

    // 4. преимущества, статус, полоска прогресса
    timed.forEach((el) => el.classList.toggle('on', p >= +el.dataset.at));
    bar.style.transform = `scaleX(${p.toFixed(3)})`;
  }
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };

  /* ---------- прокрутка ---------- */
  function onScroll() {
    const r = sec.getBoundingClientRect();
    const hh = header.offsetHeight;
    header.classList.toggle('on-dark', r.top <= hh * 0.5 && r.bottom > hh * 0.5);
    if (r.bottom < -50 || r.top > innerHeight + 50) return;   // блок не на экране — ничего не делаем
    const np = clamp(-r.top / (r.height - innerHeight));
    if (np !== p) { p = np; request(); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); onScroll(); request(); });

  /* ---------- перетаскивание планеты ---------- */
  let px0 = 0, py0 = 0, backLoop = false;
  box.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    dragging = true; px0 = e.clientX; py0 = e.clientY;
    box.classList.add('dragging');
    box.setPointerCapture(e.pointerId);
  });
  box.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const k = 57.3 / R;                                       // пиксели → градусы
    dLon -= (e.clientX - px0) * k;
    dLat = clamp(dLat + (e.clientY - py0) * k, -70, 70);
    px0 = e.clientX; py0 = e.clientY;
    request();
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false; lastDrag = performance.now();
    box.classList.remove('dragging');
    if (!backLoop) { backLoop = true; requestAnimationFrame(springBack); }
  };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);
  // отпустили — через секунду планета плавно возвращается на место
  function springBack(now) {
    if (dragging) { backLoop = false; return; }
    const dt = Math.min(now - (springBack.t || now), 100); springBack.t = now;
    if (now - lastDrag > 1000) {
      dLon = ((dLon + 540) % 360) - 180;                      // возвращаемся кратчайшим путём
      const k = Math.exp(-dt / 220);                          // одинаковая скорость на любом компьютере
      dLon *= k; dLat *= k;
      if (Math.abs(dLon) < 0.05 && Math.abs(dLat) < 0.05) { dLon = dLat = 0; backLoop = false; springBack.t = 0; render(); return; }
      render();
    }
    requestAnimationFrame(springBack);
  }

  /* ---------- сама планета: шейдер для видеокарты ---------- */
  const VERT = `#version 300 es
    void main() {
      vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`;
  const FRAG = `#version 300 es
    precision highp float;
    uniform sampler2D uDay, uNight, uWater;
    uniform vec2 uRes;
    uniform float uR;
    uniform mat3 uRot;
    uniform vec3 uSun;
    out vec4 o;
    const float PI = 3.14159265, TAU = 6.2831853;
    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uR;
      float d = length(p);

      // свечение атмосферы вокруг планеты: ярче со стороны солнца
      float sunSide = clamp(dot(normalize(vec3(p, 0.0001)), uSun) * 0.6 + 0.55, 0.0, 1.0);
      float h = max(d - 1.0, 0.0);
      float glow = (exp(-h * 16.0) * 0.6 + exp(-h * 4.5) * 0.13) * (0.22 + 0.78 * sunSide);
      vec3 haloCol = mix(vec3(0.32, 0.55, 1.0), vec3(0.60, 0.40, 1.0), smoothstep(0.0, 0.3, h));
      vec4 halo = vec4(haloCol * glow, glow);

      vec4 sph = vec4(0.0);
      if (d < 1.0) {
        float z = sqrt(1.0 - d * d);
        vec3 n = vec3(p, z);                 // точка на шаре, как её видит зритель
        vec3 w = uRot * n;                   // та же точка на «настоящей» Земле
        float uA = atan(w.x, w.z) / TAU + 0.5;
        float uB = fract(uA + 0.5) - 0.5;
        float u = (fwidth(uA) <= fwidth(uB)) ? uA : uB;   // без шва на 180-м меридиане
        vec2 uv = vec2(u, asin(clamp(w.y, -1.0, 1.0)) / PI + 0.5);

        vec3 day = texture(uDay, uv).rgb;
        vec3 night = texture(uNight, uv).rgb;
        float water = texture(uWater, uv).r;

        float ndl = dot(n, uSun);
        float dayF = smoothstep(-0.20, 0.30, ndl);        // мягкая граница дня и ночи

        vec3 lit = day * (0.08 + 1.25 * max(ndl, 0.0));
        vec3 hv = normalize(uSun + vec3(0.0, 0.0, 1.0));
        lit += vec3(1.0, 0.93, 0.82) * pow(max(dot(n, hv), 0.0), 150.0) * water * 0.28;  // блик на океане

        float cityGlow = max(night.r - night.b * 0.85, 0.0);
        vec3 dark = night * 0.45 + vec3(1.0, 0.76, 0.42) * cityGlow * 5.5;               // огни городов

        vec3 col = mix(dark, lit, dayF);
        float rim = pow(1.0 - z, 2.6);
        col += vec3(0.34, 0.58, 1.0) * rim * (0.12 + 0.8 * dayF);                        // дымка по краю

        float edge = smoothstep(1.0, 1.0 - 2.5 / uR, d);
        sph = vec4(col, 1.0) * edge;
      }
      o = sph + halo * (1.0 - sph.a);
    }`;

  function initGL() {
    try {
      gl = glCanvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
    } catch (e) { gl = null; }
    if (!gl) return;                                          // нет WebGL — остаётся запасной шар
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('globe:', gl.getProgramInfoLog(prog)); gl = null; return; }
    gl.useProgram(prog);
    uni = { rot: gl.getUniformLocation(prog, 'uRot'), res: gl.getUniformLocation(prog, 'uRes'), r: gl.getUniformLocation(prog, 'uR') };
    const s = [-0.62, 0.42, 0.66], sl = Math.hypot(...s);     // откуда светит солнце (слева сверху)
    gl.uniform3f(gl.getUniformLocation(prog, 'uSun'), s[0] / sl, s[1] / sl, s[2] / sl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

    [['uDay', 'img/earth-day.jpg'], ['uNight', 'img/earth-night.jpg'], ['uWater', 'img/earth-water.jpg']].forEach(([name, src], i) => {
      gl.uniform1i(gl.getUniformLocation(prog, name), i);
      const img = new Image();
      img.onload = () => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        if (++texReady === 3) { measure(); render(); box.classList.add('ready'); }
      };
      img.src = src;
    });
    glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); box.classList.remove('ready'); });
  }

  /* ---------- запуск: текстуры грузим, только когда блок уже близко ---------- */
  let started = false;
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !started) { started = true; initGL(); }
  }, { rootMargin: '150% 0px' }).observe(sec);
  new IntersectionObserver((entries) => {
    sec.classList.toggle('offscreen', !entries[0].isIntersecting);
  }).observe(sec);

  measure();
  onScroll();
  render();
})();
