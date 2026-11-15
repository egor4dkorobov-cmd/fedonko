/* ======================================================
   ФОН «НИТИ» (WebGL) + ДОПОЛНИТЕЛЬНЫЕ АНИМАЦИИ
   ====================================================== */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Фон «Нити» ---------- */
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const NOISE = `
    precision highp float;
    float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);
    }
    const mat2 M=mat2(.8,.6,-.6,.8);
    float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=M*p*2.02;a*=.5;}return s;}
    float fbm3(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*noise(p);p=M*p*2.02;a*=.5;}return s;}
  `;
  /* шлейф курсора: прошлый кадр сносится потоком, размывается и тает */
  const SIM = NOISE + `
    uniform sampler2D uPrev;uniform vec2 uRes,uA,uB;uniform float uTime,uDt,uForce,uAsp,uRad;
    float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);return length(pa-ba*h);}
    void main(){
      vec2 uv=gl_FragCoord.xy/uRes;vec2 p=uv*vec2(uAsp,1.);
      vec2 s=p*3.2+vec2(0.,uTime*.12);float e=.02;
      float n=fbm3(s),nx=fbm3(s+vec2(e,0.)),ny=fbm3(s+vec2(0.,e));
      vec2 vel=vec2(ny-n,n-nx)/e*.085+vec2(0.,.05);
      vec2 src=uv-vel*uDt*vec2(1./uAsp,1.);
      vec2 px=1./uRes;
      vec4 c=texture2D(uPrev,src);
      vec4 bl=.25*(texture2D(uPrev,src+vec2(px.x,0.))+texture2D(uPrev,src-vec2(px.x,0.))+texture2D(uPrev,src+vec2(0.,px.y))+texture2D(uPrev,src-vec2(0.,px.y)));
      c=mix(c,bl,.3);
      float dens=max(c.r*exp(-uDt*.6)-.0035,0.);
      float heat=max(c.g*exp(-uDt*1.5)-.006,0.);
      float d=seg(p,uA*vec2(uAsp,1.),uB*vec2(uAsp,1.));
      float sp=exp(-d*d/(uRad*uRad))*uForce;
      gl_FragColor=vec4(min(dens+sp,1.),min(heat+sp,1.),0.,1.);
    }
  `;
  /* сами нити; uLight=1 — светлый вариант для первого экрана, 0 — тёмный для винного блока */
  const DRAW = NOISE + `
    uniform sampler2D uDye;uniform vec2 uRes,uMouse,uDyePx;uniform float uTime,uLight,uScale;
    float ridge(vec2 p){
      float a=.5,s=0.;
      for(int i=0;i<5;i++){float n=1.-abs(2.*noise(p)-1.);s+=a*n*n;p=M*p*2.03;a*=.5;}
      return s;
    }
    void main(){
      vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;
      vec2 p=(uv-.5)*vec2(asp,1.),m=(uMouse-.5)*vec2(asp,1.);
      vec4 d0=texture2D(uDye,uv);
      vec2 o=uDyePx*2.;
      vec2 grad=vec2(texture2D(uDye,uv+vec2(o.x,0.)).r-texture2D(uDye,uv-vec2(o.x,0.)).r,
                     texture2D(uDye,uv+vec2(0.,o.y)).r-texture2D(uDye,uv-vec2(0.,o.y)).r);
      float t=uTime;
      vec2 q=(p-grad*.3)*1.35*uScale;
      vec2 w=vec2(fbm(q+vec2(0.,t*.08)),fbm(q+vec2(3.1,7.7)-t*.07));
      float f=ridge(q+2.2*w+vec2(t*.03,0.));
      float g=fbm(q*.8-w+vec2(0.,t*.03));
      float dens=pow(d0.r,1.15)*(.5+fbm(q*4.+vec2(0.,-t*.3)));
      float md=length(p-m);
      float edge=smoothstep(0.,.24,uv.y)*smoothstep(0.,.2,1.-uv.y);
      if(uLight>.5){
        float i=pow(f,2.3)*1.05+dens*.9+exp(-md*md*10.)*.1;
        vec3 tint=mix(vec3(.86,.15,.47),vec3(.43,.16,.85),smoothstep(.3,.72,g));
        float calm=mix(.45,1.,smoothstep(.1,.55,length(p*vec2(.55,1.25))));   // под текстом спокойнее
        float a=clamp(i,0.,1.)*.36*edge*calm;
        gl_FragColor=vec4(tint*a,a);
      }else{
        vec3 col=vec3(.95,.32,.62)*pow(f,2.4)*.62
                +vec3(.50,.25,1.)*pow(f,5.)*.9*(1.-g)
                +mix(vec3(.60,.34,1.),vec3(1.,.50,.76),d0.g)*dens*.7
                +vec3(.9,.3,.6)*exp(-md*md*9.)*.06;
        col*=edge;
        float a=clamp(max(col.r,max(col.g,col.b)),0.,1.);
        gl_FragColor=vec4(min(col,vec3(a)),a);
      }
    }
  `;

  function threads(host, light) {
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'threads';
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false });
    if (!gl) { canvas.remove(); return; }

    let simProg, drawProg, targets = null, simW = 2, simH = 2, cssH = 600;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = (frag) => {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(p, 0, 'a');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
      return { p, u };
    };
    const target = (w, h) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fbo };
    };
    function resize() {
      const r = host.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      cssH = r.height;
      const s = Math.min(devicePixelRatio || 1, 1100 / r.width, 1.5);   // нити мягкие — высокое разрешение не нужно
      const w = Math.max(2, Math.round(r.width * s)), h = Math.max(2, Math.round(r.height * s));
      if (canvas.width === w && canvas.height === h && targets) return;
      canvas.width = w; canvas.height = h;
      simW = Math.max(2, w >> 1); simH = Math.max(2, h >> 1);
      if (targets) targets.forEach((t) => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); });
      targets = [target(simW, simH), target(simW, simH)];
      if (reduced) draw(0.016);
    }
    function setup() {
      simProg = program(SIM); drawProg = program(DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.BLEND);
      targets = null;
      resize();
    }

    const mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, px: 0.5, py: 0.5, last: -1e9 };
    let T = 40 + (light ? 0 : 17), lastT = 0, raf = 0, visible = false;

    function draw(dt) {
      if (!targets) return;
      const asp = canvas.width / canvas.height;
      const moved = Math.hypot((mouse.sx - mouse.px) * asp, mouse.sy - mouse.py);
      const live = performance.now() - mouse.last < 4000;
      const force = reduced ? 0 : (Math.min(0.3, moved * 7) + 0.008) * (live ? 1 : 0.45);

      const [src, dst] = targets;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, simW, simH);
      gl.useProgram(simProg.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
      let u = simProg.u;
      gl.uniform1i(u.uPrev, 0);
      gl.uniform2f(u.uRes, simW, simH);
      gl.uniform2f(u.uA, mouse.px, mouse.py);
      gl.uniform2f(u.uB, mouse.sx, mouse.sy);
      gl.uniform1f(u.uTime, T); gl.uniform1f(u.uDt, dt);
      gl.uniform1f(u.uForce, force); gl.uniform1f(u.uAsp, asp);
      gl.uniform1f(u.uRad, 0.05 * Math.min(1.4, 620 / cssH));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      targets.reverse();

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(drawProg.p);
      gl.bindTexture(gl.TEXTURE_2D, dst.tex);
      u = drawProg.u;
      gl.uniform1i(u.uDye, 0);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform2f(u.uDyePx, 1 / simW, 1 / simH);
      gl.uniform2f(u.uMouse, mouse.sx, mouse.sy);
      gl.uniform1f(u.uTime, T);
      gl.uniform1f(u.uLight, light ? 1 : 0);
      gl.uniform1f(u.uScale, Math.max(0.7, Math.min(1.7, cssH / 620)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function frame(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
      T += dt;
      if (now - mouse.last > 4000) {        // курсора рядом нет — нити живут сами
        const a = now / 1000;
        mouse.x = 0.5 + 0.36 * Math.sin(a * 0.41) * Math.cos(a * 0.13);
        mouse.y = 0.5 + 0.30 * Math.sin(a * 0.57 + 1.3);
      }
      const k = 1 - Math.exp(-dt * 14);
      mouse.px = mouse.sx; mouse.py = mouse.sy;
      mouse.sx += (mouse.x - mouse.sx) * k; mouse.sy += (mouse.y - mouse.sy) * k;
      draw(dt);
      raf = visible ? requestAnimationFrame(frame) : 0;
    }
    const start = () => { if (!raf && visible && !reduced) { lastT = performance.now(); raf = requestAnimationFrame(frame); } };

    addEventListener('pointermove', (e) => {
      if (!visible) return;
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
      if (x < -0.05 || x > 1.05 || y < -0.1 || y > 1.1) return;
      mouse.x = x; mouse.y = y; mouse.last = performance.now();
    }, { passive: true });

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });
    canvas.addEventListener('webglcontextrestored', () => { try { setup(); start(); } catch (err) { canvas.remove(); } });

    try { setup(); } catch (err) { console.error('Фон «Нити» не запустился:', err); canvas.remove(); return; }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else addEventListener('resize', resize);
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;      // вне экрана фон не рисуется
      if (visible) start();
    }, { rootMargin: '80px' }).observe(host);
    if (reduced) draw(0.016);
    requestAnimationFrame(() => canvas.classList.add('ready'));
  }

  threads(document.querySelector('.hero-center'), true);
  threads(document.querySelector('.cta'), false);

  /* ---------- Полоса прогресса прокрутки ---------- */
  const bar = document.createElement('div');
  bar.className = 'scroll-bar';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  let barQueued = false;
  const paintBar = () => {
    barQueued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener('scroll', () => { if (!barQueued) { barQueued = true; requestAnimationFrame(paintBar); } }, { passive: true });
  paintBar();

  /* ---------- Свет под курсором на карточках ---------- */
  document.querySelectorAll('.feature, .step, .plan').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });

  /* ---------- Свечение первого экрана смещается за курсором ---------- */
  const hero = document.querySelector('.hero-center');
  if (hero && !reduced && matchMedia('(hover: hover)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--gx', (((e.clientX - r.left) / r.width - 0.5) * 70).toFixed(1) + 'px');
      hero.style.setProperty('--gy', (((e.clientY - r.top) / r.height - 0.5) * 50).toFixed(1) + 'px');
    }, { passive: true });
  }

  /* ---------- После появления блок снова реагирует на наведение без задержки ---------- */
  document.querySelectorAll('.reveal').forEach((el) => {
    el.addEventListener('transitionend', function done(e) {
      if (e.target !== el || e.propertyName !== 'opacity' || !el.classList.contains('in')) return;
      el.classList.remove('reveal');
      el.style.transitionDelay = '';
      el.removeEventListener('transitionend', done);
    });
  });

  /* ---------- Серверы: порядок появления строк и счётчик пинга ---------- */
  const servers = document.querySelector('.servers');
  if (servers) [...servers.children].forEach((li, i) => li.style.setProperty('--i', i));

  function countUp(node, to, suffix, duration, delay) {
    if (reduced) return;
    node.textContent = '0' + suffix;
    const t0 = performance.now() + delay;
    (function step(now) {
      const k = Math.min(1, Math.max(0, (now - t0) / duration));
      node.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  const once = (el, fn) => {
    if (!el) return;
    const o = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      o.disconnect(); fn();
    }, { threshold: 0.15 });
    o.observe(el);
  };
  once(servers, () => {
    [...servers.children].forEach((li, i) => {
      const text = li.querySelector('em').firstChild;       // «18 мс » перед полосками
      if (text && text.nodeType === 3) countUp(text, +li.dataset.ping, ' мс ', 700, 250 + i * 45);
    });
  });
  /* ---------- Тарифы: цена «набегает» ---------- */
  once(document.querySelector('.plans'), () => {
    document.querySelectorAll('.price b').forEach((b, i) => {
      const m = b.textContent.match(/^(\d+)(.*)$/);
      if (m) countUp(b, +m[1], m[2], 900, 150 + i * 120);
    });
  });
})();