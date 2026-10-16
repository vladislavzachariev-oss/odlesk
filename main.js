/* Odlesk — ukázka. Jedno plátno WebGL: skleněný hranol láme nápis, projekty se střídají rozpadem na pixely. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = () => innerWidth <= 640;

  const canvas = $('#gl'), track = $('#track'), stage = $('#stage');
  const W = { date: $('#wDate'), kind: $('#wKind'), title: $('#wTitle'), text: $('#wText'), tags: $('#wTags') };

  const WORKS = [
    { date: '2026.03', kind: 'Imerzivní projekce', title: 'Hlubina', text: 'Projekce přes stěny i podlahu výstavní haly, zvuk ve dvanácti kanálech.', tags: ['projekce', 'zvuk', '1 200 m²'], img: 'img/hala.webp' },
    { date: '2025.12', kind: 'Světelná instalace', title: 'Brány', text: 'Sedm svítících oblouků na náměstí, čtrnáct nocí adventu.', tags: ['venkovní', 'festival', 'LED'], img: 'img/brany.webp' },
    { date: '2025.09', kind: 'Instalace', title: 'Zrcadlo', text: 'Zrcadlová krychle v bývalé tovární hale. Odrážejí se v ní světla i lidé kolem.', tags: ['zrcadla', 'LED', 'kouř'], img: 'img/zrcadlo.webp' },
    { date: '2025.05', kind: 'Interaktivní podlaha', title: 'Kroky', text: 'Projekce, která reaguje na každý krok. Pro dětskou část galerie.', tags: ['senzory', 'projekce', 'děti'], img: 'img/kroky.webp' }
  ];

  /* ---------- časová osa: scéna 0 úvod, 1–4 projekty, 5 bílá ---------- */
  const HOLD0 = .7, TR = .8, HOLD = .75;
  const SEG = [], START = [0];
  let t = 0;
  SEG.push({ a: 0, b: 0, s: t, e: (t += HOLD0) });
  for (let i = 1; i <= 5; i++) {
    START[i] = t;
    SEG.push({ a: i - 1, b: i, s: t, e: (t += TR), tr: 1 });
    if (i < 5) SEG.push({ a: i, b: i, s: t, e: (t += HOLD) });
  }
  const TOTAL = t, SPAN = TR * 2 + HOLD;
  const holdAt = i => i === 0 ? 0 : START[i] + TR;

  function sceneAt(u) {
    for (const s of SEG) if (u < s.e) return { a: s.a, b: s.b, p: s.tr ? clamp((u - s.s) / (s.e - s.s)) : 0 };
    return { a: 5, b: 5, p: 0 };
  }
  const kindOf = i => i === 0 ? 0 : i === 5 ? 2 : 1;

  let VH = innerHeight, lastW = innerWidth;
  function layout() {
    track.style.height = Math.round(TOTAL * VH + stage.offsetHeight) + 'px';
  }
  layout();

  /* ---------- plynulé rolování ---------- */
  const lenis = window.Lenis && !reduce ? new Lenis({ lerp: .09, smoothWheel: true }) : null;
  const scrollTo = y => lenis ? lenis.scrollTo(y, { duration: 1.6 }) : scrollTo0(y);
  const scrollTo0 = y => window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });

  document.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    scrollTo(Math.round(holdAt(+a.dataset.go) * VH));
  }));
  document.querySelectorAll('a[href^="#"]:not([data-go])').forEach(a => a.addEventListener('click', e => {
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    scrollTo(el.getBoundingClientRect().top + scrollY);
  }));

  /* ---------- texty projektů ---------- */
  const GLY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=';
  function scramble(el, text, dur = 560) {
    if (reduce) { el.textContent = text; return; }
    const id = (el._sid = (el._sid || 0) + 1), t0 = performance.now();
    const step = now => {
      if (el._sid !== id) return;
      const k = clamp((now - t0) / dur), n = Math.floor(k * text.length);
      let s = text.slice(0, n);
      for (let i = n; i < text.length; i++) s += text[i] === ' ' ? ' ' : GLY[(Math.random() * GLY.length) | 0];
      el.textContent = s;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  let shown = -1;
  function showWork(i) {
    if (i === shown) return;
    shown = i;
    const w = WORKS[i - 1];
    scramble(W.title, w.title);
    scramble(W.kind, w.kind, 420);
    scramble(W.date, w.date, 360);
    W.text.textContent = w.text;
    W.tags.innerHTML = w.tags.map(x => `<li>${x}</li>`).join('');
    $('#cNow').textContent = String(i).padStart(2, '0');
    $('#cBar').style.setProperty('--k', i / 4);
  }
  showWork(1);

  const kontakt = $('#kontakt');
  let idxNow = -1, midNow = null, lightNow = null;
  function ui(st) {
    const idx = st.p < .5 ? st.a : st.b;
    const mid = st.a !== st.b && st.p > .35 && st.p < .65 && kindOf(st.a) === 1 && kindOf(st.b) === 1;
    if (idx !== idxNow) {
      idxNow = idx;
      stage.dataset.scene = idx;
      stage.classList.toggle('is-work', idx >= 1 && idx <= 4);
      if (idx >= 1 && idx <= 4) showWork(idx);
    }
    if (mid !== midNow) { midNow = mid; stage.classList.toggle('is-mid', mid); }
    const light = idx === 5 && kontakt.getBoundingClientRect().top > 64;
    if (light !== lightNow) { lightNow = light; document.body.classList.toggle('is-light', light); }
  }

  /* ---------- hodiny, studio, kontakt ---------- */
  const clock = $('#clock');
  const fmt = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => { clock.textContent = 'LBC ' + fmt.format(new Date()); };
  tick(); setInterval(tick, 1000);

  const say = $('#say');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { say.classList.add('in'); o.disconnect(); } }), { threshold: .35 }).observe(say);
  } else say.classList.add('in');

  const toast = $('#toast');
  let toastT;
  $('#write').addEventListener('click', () => {
    toast.textContent = 'Tohle je jen ukázka, zpráva se nikam neodeslala.';
    toast.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 3200);
  });

  /* ---------- WebGL ---------- */
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) document.documentElement.classList.add('no-gl');

  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define STEPS __STEPS__
#define ISTEPS __ISTEPS__
uniform vec2 uRes; uniform float uT, uP, uCell, uS, uSz, uD;
uniform vec2 uM; uniform vec3 uKA, uKB; uniform vec4 uWR; uniform mat3 uR;
uniform sampler2D uA, uB, uW;

float h11(float x){return fract(sin(x*127.1)*43758.5453);}
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n11(float x){float i=floor(x),f=fract(x);return mix(h11(i),h11(i+1.),f*f*(3.-2.*f));}

/* pozadí úvodu: tma, modrá záře, světelné pruhy, jemná mřížka a nápis */
vec3 bg(vec2 uv){
  vec2 fc=uv*uRes;
  vec2 p=(fc-.5*uRes)/uS;
  vec3 c=vec3(.010,.013,.035);
  c+=vec3(.05,.09,.36)*exp(-2.6*dot(p-vec2(0.,.06),p-vec2(0.,.06)));
  float sh=pow(n11(uv.x*14.+uT*.12),4.)*smoothstep(.1,1.,uv.y);
  c+=vec3(.22,.28,.62)*sh*.22;
  vec2 g=fract(fc/(72.*uD));
  float ln=max(step(g.x,1./(72.*uD)),step(g.y,1./(72.*uD)));
  c+=vec3(.5,.6,1.)*ln*.035;
  vec2 wp=(fc-uWR.xy+uM*8.*uD)/uWR.zw+.5;
  if(wp.x>0.&&wp.x<1.&&wp.y>0.&&wp.y<1.){
    float w=texture2D(uW,wp).r;
    c=mix(c,vec3(.95,.96,1.),w);
  }
  return c;
}
vec3 env(vec3 d){
  vec3 c=mix(vec3(.008,.01,.025),vec3(.05,.07,.2),clamp(d.y*.5+.5,0.,1.));
  c+=vec3(1.)*smoothstep(.82,.97,d.y)*.85;
  c+=vec3(.7,.78,1.)*smoothstep(.9,.99,d.x)*.35;
  return c;
}
float sdPrism(vec3 p,vec2 h){vec3 q=abs(p);return max(q.z-h.y,max(q.x*.866025+p.y*.5,-p.y)-h.x*.5);}
#define PH vec2(.22,.58)
float map(vec3 p){return sdPrism(uR*(p/uSz),PH)*uSz-.02*uSz;}
/* blízkost hrany: druhá největší ze vzdáleností k rovinám stěn */
float edgeF(vec3 w){
  vec3 p=uR*(w/uSz);
  float a=abs(p.z)-PH.y, b=p.x*.866025+p.y*.5-PH.x*.5, c=-p.x*.866025+p.y*.5-PH.x*.5, d=-p.y-PH.x*.5;
  float m2=max(min(max(a,b),max(c,d)),max(min(a,b),min(c,d)));
  return smoothstep(-.016,-.001,m2);
}
vec3 nrm(vec3 p){vec2 e=vec2(.0015,0.);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
vec2 toUV(vec2 xy){vec2 p=xy*(2.4/4.0);return (p*uS+.5*uRes)/uRes;}
vec3 bgAt(vec3 o,vec3 d){
  if(d.z>-.05) return env(d);
  float t=(-.8-o.z)/d.z;
  return bg(toUV((o+d*t).xy));
}
vec3 hero(vec2 fc){
  vec2 uv=fc/uRes;
  vec2 p=(fc-.5*uRes)/uS;
  vec3 ro=vec3(0.,0.,3.2), rd=normalize(vec3(p,-2.4));
  vec3 base=bg(uv);
  base*=1.-.25*dot(p,p);
  float rad=.7*uSz;
  float b=dot(ro,rd), h=b*b-(dot(ro,ro)-rad*rad);
  if(h<0.) return base;
  float t=max(0.,-b-sqrt(h)), d=1.; bool hit=false;
  for(int i=0;i<STEPS;i++){d=map(ro+rd*t);if(d<.001){hit=true;break;}t+=d;if(t>-b+sqrt(h))break;}
  if(!hit) return base;
  vec3 pos=ro+rd*t, n=nrm(pos);
  vec3 ri=refract(rd,n,1./1.22);
  vec3 q=pos-n*.004; float ti=.02;
  for(int i=0;i<ISTEPS;i++){float di=-map(q+ri*ti);if(di<.0015)break;ti+=max(di,.012);}
  vec3 pe=q+ri*ti, ne=nrm(pe);
  vec3 col;
  for(int k=0;k<3;k++){
    float eta=1.22+(float(k)-1.)*.009;
    vec3 o=refract(ri,-ne,eta);
    if(dot(o,o)<.01) o=reflect(ri,-ne);
    vec3 s=bgAt(pe,o);
    if(k==0) col.r=s.r; else if(k==1) col.g=s.g; else col.b=s.b;
  }
  col=col*exp(-ti*vec3(.22,.12,.04))+vec3(.015,.02,.05);
  float fr=pow(1.-max(dot(-rd,n),0.),4.)*.7+.03;
  vec3 rf=reflect(rd,n);
  col=mix(col,env(rf),fr);
  col+=vec3(1.)*pow(max(dot(rf,normalize(vec3(.4,.8,.5))),0.),70.)*1.2;
  col+=vec3(.5,.6,1.)*pow(1.-max(dot(-rd,n),0.),6.)*.25;
  col+=vec3(.82,.88,1.)*edgeF(pos)*.42;
  return col;
}
vec3 img(sampler2D tx,vec2 uv,vec3 k){
  float ca=uRes.x/uRes.y;
  vec2 st=uv-.5;
  if(ca>k.y) st.y*=k.y/ca; else st.x*=ca/k.y;
  st=st/k.z+uM*.012;
  vec3 c=texture2D(tx,st+.5).rgb;
  float dl=length(uv*vec2(.85,1.5));
  c*=mix(.45,1.,smoothstep(.12,.9,dl));
  c*=mix(.62,1.,smoothstep(0.,.5,uv.y));
  c*=mix(1.,.72,smoothstep(.82,1.,uv.y));
  return c;
}
vec3 sceneA(vec2 fc){if(uKA.x<.5)return hero(fc);if(uKA.x<1.5)return img(uA,fc/uRes,uKA);return vec3(1.);}
vec3 sceneB(vec2 fc){if(uKB.x<.5)return hero(fc);if(uKB.x<1.5)return img(uB,fc/uRes,uKB);return vec3(1.);}

void main(){
  vec2 fc=gl_FragCoord.xy;
  float pk=sin(3.14159265*uP);
  float cs=floor(mix(1.,uCell,pk*pk*(3.-2.*pk)));
  vec2 q=(floor(fc/cs)+.5)*cs;
  vec2 g=floor(fc/uCell);
  float r=h21(g), th=.1+.8*r;
  bool flip=uP>th;
  vec3 c=flip?sceneB(q):sceneA(q);
  float k=flip?uKB.x:uKA.x;
  float fl=(1.-smoothstep(0.,.045,abs(uP-th)))*step(.001,uP)*step(uP,.999);
  if(fl>0.){
    float r2=h21(g+7.3);
    if(r2>.82) c=mix(c,vec3(.85,1.,.24),fl);
    else c=mix(c,c.brg*1.35+.06,fl*.7);
  }
  if(k<1.5) c+=(h21(fc+fract(uT*7.)*91.)-.5)*.035;
  gl_FragColor=vec4(c,1.);
}`;

  let prog, U = {}, texs = [], wordTex, wordAsp = 4, dpr = 1, dprCap = 1.5;
  const loaded = [false, false, false, false];
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { window.__glerr = gl.getShaderInfoLog(s); console.error(window.__glerr); return null; }
    return s;
  }
  function tex(src) {
    const tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([8, 9, 20]));
    return tx;
  }

  /* nápis ODLESK do textury: bílý na černé, šířka 2048 px */
  const wc = document.createElement('canvas');
  function drawWord() {
    const x = wc.getContext('2d'), font = s => `800 ${s}px Unbounded, "Arial Black", sans-serif`;
    x.font = font(200);
    const m = x.measureText('ODLESK');
    const asc = m.actualBoundingBoxAscent || 150, dsc = m.actualBoundingBoxDescent || 0;
    const size = 200 * 1960 / m.width;
    wc.width = 2048;
    wc.height = Math.ceil((asc + dsc) * size / 200 + 88);
    wordAsp = wc.width / wc.height;
    x.fillStyle = '#000'; x.fillRect(0, 0, wc.width, wc.height);
    x.fillStyle = '#fff'; x.font = font(size); x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillText('ODLESK', 1024, 44 + asc * size / 200);
    if (wordTex) { gl.bindTexture(gl.TEXTURE_2D, wordTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, wc); }
  }

  function initGL() {
    const steps = phone() ? ['44', '22'] : ['64', '32'];
    const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS.replace('__STEPS__', steps[0]).replace('__ISTEPS__', steps[1]));
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { window.__glerr = gl.getProgramInfoLog(prog); return false; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uT', 'uP', 'uCell', 'uS', 'uSz', 'uD', 'uM', 'uKA', 'uKB', 'uWR', 'uR', 'uA', 'uB', 'uW'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
    gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1); gl.uniform1i(U.uW, 2);

    texs = [null, ...WORKS.map(() => tex(null))];
    WORKS.forEach((w, i) => {
      const im = new Image();
      im.onload = () => { gl.bindTexture(gl.TEXTURE_2D, texs[i + 1]); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); loaded[i] = true; };
      im.src = w.img;
    });
    texs[0] = texs[5] = tex(null);
    drawWord();
    wordTex = tex(wc);
    if (document.fonts && document.fonts.load) document.fonts.load('800 100px Unbounded').then(drawWord).catch(() => {});
    return true;
  }

  function resize() {
    if (!gl) return;
    dprCap = phone() ? 1.25 : 1.5;
    dpr = Math.min(devicePixelRatio || 1, dprCap) * dprScale;
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  let dprScale = 1;

  /* otočení hranolu: dlouhá osa vodorovně, točí se kolem ní, myš ho naklání */
  function rot(spin, mx, my) {
    const r = (ax, a) => { const c = Math.cos(a), s = Math.sin(a);
      return ax === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c] : ax === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1]; };
    const mul = (A, B) => { const o = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return o; };
    const M = mul(mul(mul(r('z', spin), r('y', Math.PI / 2 + .3 + mx * .4)), r('x', .12 + my * .25)), r('z', -.2));
    return new Float32Array([M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]]);
  }

  let frames = 0, slow = 0, t0 = performance.now(), lastNow = t0, stillWhite = false;
  function draw(st, now) {
    const white = st.a === 5 && st.b === 5;
    if (white && stillWhite) return;
    stillWhite = white;
    const dt = now - lastNow; lastNow = now;
    if (st.a === 0 || st.b === 0) {
      frames++;
      if (frames > 20 && frames < 140) { if (dt > 26) slow++; if (slow > 40 && dprScale > .5) { dprScale *= .75; slow = 0; frames = 0; resize(); } }
    }
    mouse.x += (mouse.tx - mouse.x) * .06; mouse.y += (mouse.ty - mouse.y) * .06;
    const u = scrollY / VH, T = (now - t0) / 1000;
    const k = i => [kindOf(i), 1920 / 1072, i >= 1 && i <= 4 ? 1.03 + .08 * clamp((u - START[i]) / SPAN) : 1];
    const ww = canvas.width * (phone() ? .92 : .9);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uT, T);
    gl.uniform1f(U.uP, st.p);
    gl.uniform1f(U.uCell, Math.round((phone() ? 34 : 56) * dpr));
    gl.uniform1f(U.uS, Math.min(canvas.width, canvas.height * 1.25));
    gl.uniform1f(U.uSz, phone() ? .66 : Math.min(1, (canvas.width / canvas.height) / 1.25));
    gl.uniform1f(U.uD, dpr);
    gl.uniform2f(U.uM, mouse.x, mouse.y);
    gl.uniform3fv(U.uKA, k(st.a)); gl.uniform3fv(U.uKB, k(st.b));
    gl.uniform4f(U.uWR, canvas.width / 2, canvas.height * .48, ww, ww / wordAsp);
    gl.uniformMatrix3fv(U.uR, false, rot(reduce ? .5 : T * .22, mouse.x, mouse.y));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texs[st.a]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texs[st.b]);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, wordTex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const ok = gl && initGL();
  if (gl && !ok) document.documentElement.classList.add('no-gl');
  resize();

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mouse.tx = e.clientX / innerWidth * 2 - 1; mouse.ty = -(e.clientY / innerHeight * 2 - 1);
    stillWhite = false;
  }, { passive: true });
  addEventListener('resize', () => {
    if (innerWidth !== lastW || Math.abs(innerHeight - VH) > VH * .25) { lastW = innerWidth; VH = innerHeight; layout(); }
    resize(); stillWhite = false;
  });

  let st = sceneAt(0);
  function frame(now) {
    if (lenis) lenis.raf(now);
    st = sceneAt(scrollY / VH);
    ui(st);
    if (ok) draw(st, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* háčky pro kontrolu snímků */
  window.__state = () => ({ u: +(scrollY / VH).toFixed(3), a: st.a, b: st.b, p: +st.p.toFixed(3), scene: idxNow, gl: !!ok, err: window.__glerr || '', loaded: loaded.join(','), dpr: +dpr.toFixed(2), total: TOTAL, track: track.offsetHeight });
  window.__go = u => { const y = Math.round(u * VH); if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); };
})();
