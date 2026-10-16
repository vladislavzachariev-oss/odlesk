import * as THREE from './vendor/three.module.min.js';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// keyframes on the scroll axis: [[s, value|array], ...], eased between neighbours
const kf = (s, keys) => {
  if (s <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [s1, v1] = keys[i], [s0, v0] = keys[i - 1];
    if (s <= s1) { const t = sstep(s0, s1, s); return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], t)) : lerp(v0, v1, t); }
  }
  return keys[keys.length - 1][1];
};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
};

const WORKS = [
  { date: '2026.03', hi: '1 200 m² projekce, 12 kanálů zvuku', title: 'Hlubina', sub: 'Imerzivní projekce · výstavní hala', tags: ['projekce', 'zvuk', 'výstava'], img: 'img/hala.webp' },
  { date: '2025.12', hi: '14 nocí adventu', title: 'Brány', sub: 'Světelná instalace · náměstí', tags: ['venkovní', 'festival', 'LED'], img: 'img/brany.webp' },
  { date: '2025.10', hi: '12 minut světla na fasádě', title: 'Fasáda', sub: 'Projekce na budovu · festival světla', tags: ['mapping', 'fasáda', 'zvuk'], img: 'img/fasada.webp' },
  { date: '2025.09', hi: 'nekonečná chodba z jedné krychle', title: 'Zrcadlo', sub: 'Instalace · bývalá tovární hala', tags: ['zrcadla', 'LED', 'mlha'], img: 'img/zrcadlo.webp' },
  { date: '2025.07', hi: 'paprsky hrají se zvukem', title: 'Síť', sub: 'Světlo v mlze · bývalá kotelna', tags: ['světlo', 'mlha', 'zvuk'], img: 'img/sit.webp' },
  { date: '2025.05', hi: 'reaguje na každý krok', title: 'Kroky', sub: 'Interaktivní podlaha · dětská galerie', tags: ['senzory', 'projekce', 'děti'], img: 'img/kroky.webp' },
];
$('#wkList').innerHTML = WORKS.map(w => `<li>${w.title}: ${w.sub}, ${w.date}</li>`).join('');

/* ---------- smooth scroll, anchors ---------- */
const lenis = window.Lenis && !reduce ? new window.Lenis({ lerp: .085, smoothWheel: true }) : null;
const scena = $('#scena');
let vhU = innerHeight;                           // one "screen" of the scene track, in px
const sy = () => (lenis ? lenis.scroll : window.scrollY);
const goTo = y => { if (lenis) lenis.scrollTo(y, { duration: 1.6 }); else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); };
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1), el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  closeMenu();
  goTo(id === 'uvod' ? 0 : id === 'projekty' ? 2.6 * vhU : el.getBoundingClientRect().top + sy());
});

/* ---------- toast, menu, pane ---------- */
const toast = $('#toast');
let toastT;
const say = t => { toast.textContent = t; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 3600); };
$('#write').addEventListener('click', () => say('Tohle je jen ukázka. Na skutečném webu tu bude formulář nebo Váš e-mail.'));

const menu = $('#menu'), burger = $('#burger');
function openMenu() { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('open')); burger.setAttribute('aria-expanded', 'true'); if (lenis) lenis.stop(); }
function closeMenu() {
  if (menu.hidden) return;
  menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); if (lenis) lenis.start();
  setTimeout(() => { if (!menu.classList.contains('open')) menu.hidden = true; }, 450);
}
burger.addEventListener('click', openMenu);
$('#menuX').addEventListener('click', closeMenu);
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

const pane = $('#pane'), paneHd = $('#paneHd');
paneHd.addEventListener('click', () => { const o = pane.classList.toggle('open'); paneHd.setAttribute('aria-expanded', String(o)); blip(o ? 990 : 740, .08, .03); });

/* ---------- sound (WebAudio drone, off until asked) ---------- */
let ac = null, master = null, soundOn = false;
const sndT = $('#sndT');
function audioInit() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360; lp.Q.value = 2.2; lp.connect(master);
  const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = .06; lfoG.gain.value = 200; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
  [[55, 'sawtooth', .05], [55.4, 'sawtooth', .05], [110.3, 'triangle', .035], [164.8, 'sine', .022]].forEach(([f, t, g]) => {
    const o = ac.createOscillator(), gg = ac.createGain(); o.type = t; o.frequency.value = f; gg.gain.value = g; o.connect(gg); gg.connect(lp); o.start();
  });
}
function setSound(on) {
  soundOn = on;
  if (on) { audioInit(); ac.resume(); master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(.5, ac.currentTime, .8); }
  else if (ac) master.gain.setTargetAtTime(0, ac.currentTime, .25);
  sndT.setAttribute('aria-pressed', String(on));
  sndT.querySelector('b').textContent = on ? 'zap' : 'vyp';
}
function blip(f = 880, d = .12, v = .05) {
  if (!soundOn || !ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .02);
}
const sndGone = () => document.body.classList.add('snd-gone');
$('#sndOn').addEventListener('click', () => { setSound(true); sndGone(); store.set('odlesk-snd', '1'); });
$('#sndOff').addEventListener('click', () => { setSound(false); sndGone(); store.set('odlesk-snd', '0'); });
sndT.addEventListener('click', () => setSound(!soundOn));
if (store.get('odlesk-snd') !== null) sndGone();   // remembered choice; the drone itself waits for a click (autoplay rules)
let lastBlip = 0;
document.addEventListener('pointerover', e => {
  if (!e.target.closest('a,button') || performance.now() - lastBlip < 90) return;
  lastBlip = performance.now(); blip(1320, .05, .018);
});

/* ---------- left ruler ---------- */
const ticks = $('#ticks');
for (let i = 0; i < 41; i++) { const t = document.createElement('i'); if (i % 5 === 0) t.className = 'big'; ticks.appendChild(t); }
const rulerNow = $('#rulerNow'), rulerLbl = rulerNow.querySelector('span'), ruler = $('#ruler');
let secTops = [];
const SECS = [...document.querySelectorAll('[data-name]')];
function measure() {
  vhU = scena.offsetHeight / 9;
  const y = sy();
  secTops = SECS.map(el => [el.id === 'projekty' ? .8 * vhU : el.getBoundingClientRect().top + y, el.dataset.name.toUpperCase()]);
}

/* ---------- reveals and scroll-driven CSS vars ---------- */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .2 });
document.querySelectorAll('.rv').forEach(el => io.observe(el));
const wire1 = $('#wire1'), wire2 = $('#wire2'), feats = [...document.querySelectorAll('.feat')];
function cssProgress(vh) {
  const r1 = wire1.getBoundingClientRect(); wire1.style.setProperty('--p', clamp((vh - r1.top) / (vh * .95), 0, 1).toFixed(3));
  const r2 = wire2.getBoundingClientRect(), p2 = clamp((vh - r2.top) / (vh * 1.1), 0, 1);
  wire2.style.setProperty('--p', p2.toFixed(3)); wire2.style.setProperty('--a', (6 + p2 * 22).toFixed(2)); wire2.style.setProperty('--r', (p2 * 70).toFixed(2));
  for (const f of feats) { const r = f.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh) f.style.setProperty('--p', clamp((vh - r.top) / (vh + r.height), 0, 1).toFixed(3)); }
}

/* ---------- works overlay ---------- */
const wDate = $('#wDate'), wHi = $('#wHi'), wTitle = $('#wTitle'), wSub = $('#wSub'), wTags = $('#wTags'), wNow = $('#wNow'), wBar = $('#wBar'), wkStick = $('#wkStick');
const GLYPHS = 'ABCDEFGHIJKLMNOPRSTUVZ0123456789#%&*+/<>';
function scramble(el, text) {
  if (reduce) { el.textContent = text; return; }
  cancelAnimationFrame(el._raf);
  let f = 0; const n = 20;
  const step = () => {
    f++;
    el.textContent = [...text].map((c, i) => (c === ' ' || i < f / n * text.length) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('');
    if (f < n) el._raf = requestAnimationFrame(step); else el.textContent = text;
  };
  step();
}
let shownIdx = -1;
function showWork(i) {
  if (i === shownIdx) return;
  shownIdx = i;
  const w = WORKS[i];
  wDate.textContent = w.date; scramble(wHi, w.hi); scramble(wTitle, w.title); wSub.textContent = w.sub;
  wTags.innerHTML = w.tags.map(t => `<li>${t}</li>`).join('');
  wNow.textContent = String(i + 1).padStart(2, '0'); wBar.style.width = ((i + 1) / WORKS.length * 100).toFixed(1) + '%';
  blip(520 + i * 70, .3, .04);
}
showWork(0);

/* ---------- WebGL ---------- */
const canvas = $('#gl');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer) document.documentElement.classList.add('no-gl');

const VS = /* glsl */`
varying vec2 vUv; varying vec3 vP;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const HASH = /* glsl */`float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`;

const ROOM_FS = /* glsl */`
uniform float uT, uIntro, uPurple, uGlow, uWordH;
uniform sampler2D uWord;
varying vec2 vUv; varying vec3 vP;
${HASH}
void main(){
  float u = 1. - vUv.x;                                   // seen from inside: un-mirror, front of the room = .5
  vec2 g = vec2(u * 104., (vP.y + 20.) / 1.09);
  vec2 id = floor(g), f = fract(g);
  float r = h21(id), r2 = h21(id + 17.3);
  float e = min(min(f.x, 1. - f.x), min(f.y, 1. - f.y));
  float seam = 1. - smoothstep(.0, .03, e);
  float face = smoothstep(.025, .08, e);
  vec3 vio = vec3(.40, .22, 1.), blu = vec3(.10, .22, 1.);
  vec3 lc = mix(blu, vio, r2);
  float d = abs(u - .5) * 2.2 + abs(vP.y - .5) * .025;    // intro: panels switch on from the front centre outwards
  float on = smoothstep(0., .1, uIntro * 1.3 - d - r * .12);
  vec3 col = vec3(.010, .010, .017) + vec3(.008) * r;
  float slot = floor(uT * .22 + r * 9.);
  float lit = step(.91, h21(id + slot)) * (.55 + .45 * sin(uT * 2.6 + r * 40.));
  float ang = u * 6.2832;
  float wave = pow(.5 + .5 * sin(ang * 4. - uT * .42 + vP.y * .32), 12.);
  float side = mix(.45, 1., exp(-pow((u - .5) * 4.5, 2.)));
  col += lc * (lit * .16 + wave * .05) * face * side;
  vec2 gq = vec2((u - .5) * 113.1, vP.y - .5);           // world units around the front glow
  col += vio * .15 * exp(-dot(gq, gq) * .022) * uGlow * face;
  float wy = (vP.y - .5) / uWordH + .5;
  if (wy > 0. && wy < 1.) col += vec3(.05, .05, .068) * texture2D(uWord, vec2(fract(u * 3.), wy)).r * face;
  col = mix(col, vec3(.042, .042, .058), seam * .9);
  vec2 q = abs(fract(g / 4. + .5) - .5) * 4.;             // panel units from the nearest 4x4 crossing
  float cr = max(step(q.x, .035) * step(q.y, .28), step(q.y, .035) * step(q.x, .28));
  col += vec3(.2) * cr;
  float chk = step(.56, h21(id * 1.31 + 3.));
  float pw = pow(.5 + .5 * sin(ang * 2. - uT * .7 + vP.y * .2), 3.);
  vec3 deep = vec3(.26, .13, 1.);
  col += deep * uPurple * face * side * (.012 + chk * (.06 + .11 * r) * (.6 + .4 * sin(uT * 1.7 + r * 30.)) + pw * .045);
  col *= mix(.35, 1., smoothstep(-2.6, .5, vP.y)) * smoothstep(17., 7., vP.y) * on;
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FLOOR_FS = /* glsl */`
uniform float uT, uIntro, uPurple, uGlow;
varying vec2 vUv; varying vec3 vP;
void main(){
  vec2 p = vP.xz;
  float r = length(p);
  vec2 g = abs(fract(p / 1.09 + .5) - .5);
  float ln = 1. - smoothstep(0., .016, min(g.x, g.y));
  vec3 vio = vec3(.40, .22, 1.);
  vec3 col = vec3(.005, .005, .009);
  col += vec3(.036, .036, .05) * ln * smoothstep(19., 6., r);
  col += vio * .045 * smoothstep(9., 17.5, r) * (.5 + uPurple * 1.6);
  float fz = exp(-p.x * p.x * .025) * smoothstep(-2., -17., p.y);
  col += vio * .07 * fz * uGlow;
  col *= uIntro;
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const CARD_FS = /* glsl */`
uniform sampler2D uMap;
uniform float uRev, uAct, uImgA, uCardA, uVel, uT;
varying vec2 vUv;
${HASH}
void main(){
  vec2 uv = vUv - .5;
  if (uCardA > uImgA) uv.y *= uImgA / uCardA; else uv.x *= uCardA / uImgA;
  uv = uv * (1. - .04 * uAct) + .5;
  vec2 tg = floor(vUv * vec2(22., 22. / uCardA));
  float th = h21(tg) * .55 + (1. - vUv.y) * .15 + abs(vUv.x - .5) * .5;
  float on = uRev * 1.3 - th;
  if (on < 0.) discard;
  float edge = smoothstep(.14, 0., on);
  float sh = clamp(uVel, -1., 1.) * .012;
  vec3 c = vec3(texture2D(uMap, uv + vec2(sh, 0.)).r, texture2D(uMap, uv).g, texture2D(uMap, uv - vec2(sh, 0.)).b);
  c *= mix(.3, 1., uAct);
  c = mix(c, vec3(.6, .5, 1.), edge * .85);
  vec2 lg = fract(vUv * vec2(180., 180. / uCardA));
  c *= 1. - .07 * step(.8, max(lg.x, lg.y)) * (1. - uAct * .7);
  float fr = step(min(min(vUv.x, 1. - vUv.x) * uCardA, min(vUv.y, 1. - vUv.y)), .005);
  c = mix(c, vec3(1.), fr * .3);
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;

function textCanvas(text, maxW, pad, weight = 800, family = 'Unbounded') {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `${weight} 400px ${family}`;
  let m = x.measureText(text);
  const fs = 400 * maxW / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
  x.font = `${weight} ${fs}px ${family}`; m = x.measureText(text);
  c.width = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2;
  c.height = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2;
  x.font = `${weight} ${fs}px ${family}`;                // a resize resets the context
  x.fillStyle = '#fff';
  x.fillText(text, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
  return c;
}

// thick glass ring: a rounded-rectangle profile turned around the axis, facing the camera
function lensGeometry(Rc, a, b, cr, seg) {
  const pts = [];
  const corners = [[Rc + a - cr, b - cr, 0], [Rc - a + cr, b - cr, Math.PI / 2], [Rc - a + cr, -b + cr, Math.PI], [Rc + a - cr, -b + cr, Math.PI * 1.5]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= 10; i++) { const an = a0 + i / 10 * Math.PI / 2; pts.push(new THREE.Vector2(cx + Math.cos(an) * cr, cy + Math.sin(an) * cr)); }
  pts.push(pts[0].clone());
  const g = new THREE.LatheGeometry(pts, seg);
  // the winding must agree with the normals, or the glass renders inside out
  const pos = g.attributes.position, nor = g.attributes.normal, idx = g.index;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    A.fromBufferAttribute(pos, idx.getX(t)); B.fromBufferAttribute(pos, idx.getX(t + 1)); C.fromBufferAttribute(pos, idx.getX(t + 2));
    const fn = B.sub(A).cross(C.sub(A));
    if (fn.lengthSq() < 1e-10) continue;
    N.fromBufferAttribute(nor, idx.getX(t));
    if (fn.dot(N) < 0) for (let i = 0; i < idx.count; i += 3) { const s = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, s); }
    break;
  }
  g.rotateX(Math.PI / 2);
  return g;
}

function noiseNormal(n = 256) {
  const hgt = new Float32Array(n * n);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const [gs, amp] of [[8, 1], [16, .55], [32, .3], [64, .16]]) {
    const v = Array.from({ length: gs * gs }, rnd);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x / n * gs, fy = y / n * gs, ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const g = (i, j) => v[((j % gs) * gs) + (i % gs)];
      hgt[y * n + x] += amp * lerp(lerp(g(ix, iy), g(ix + 1, iy), tx), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), tx), ty);
    }
  }
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = hgt[y * n + (x + 1) % n] - hgt[y * n + (x - 1 + n) % n], dy = hgt[((y + 1) % n) * n + x] - hgt[((y - 1 + n) % n) * n + x];
    const v = new THREE.Vector3(-dx * 6, -dy * 6, 1).normalize(), o = (y * n + x) * 4;
    data[o] = (v.x * .5 + .5) * 255; data[o + 1] = (v.y * .5 + .5) * 255; data[o + 2] = (v.z * .5 + .5) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 2); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}

const FLOOR_Y = -2.6, CARD_R = 6;
const CAM_P = [[0, [0, .45, 9.5]], [1, [0, .7, 6.2]], [1.6, [0, .6, 4.6]], [2.3, [0, .45, -3]], [9, [0, .45, -3]]];
const CAM_T = [[0, [0, .45, 0]], [1, [0, .35, -2.5]], [2.3, [0, .6, -9]], [9, [0, .6, -9]]];
const LENS_P = [[0, [0, .45, 2.6]], [.9, [3.4, 1, 1.6]], [1.7, [-3.6, .8, -.8]], [2.35, [0, 4.7, -15]], [6.9, [0, 4.7, -15]], [7.8, [0, .5, -8.6]]];
const LENS_S = [[0, 1], [.9, .82], [1.7, .82], [2.35, .9], [6.9, .9], [7.8, 1.0]];

function buildGL(r) {
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.setClearColor(0x050508, 1);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, 1, .1, 120);
  const U = { uT: { value: 0 }, uIntro: { value: 0 }, uPurple: { value: 0 }, uGlow: { value: 1 }, uWord: { value: null }, uWordH: { value: 6 } };

  const room = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 40, 128, 1, true), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: ROOM_FS, side: THREE.BackSide }));
  scene.add(room);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(18, 96), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FLOOR_FS }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; scene.add(floor);

  // environment for the glass: a dark room with a few bright panels, baked once
  const pmrem = new THREE.PMREMGenerator(r);
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12), new THREE.MeshBasicMaterial({ color: 0x07070c, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
  panel(18, 1.2, 0, 13, -3, '#ffffff', 7); panel(7, 7, -14, 2, -7, '#6a4cff', 3.2); panel(7, 7, 14, 1, -5, '#3a5cff', 2.6);
  panel(12, 2, 0, -1, 15, '#ffffff', 2.2); panel(2.5, 11, 9, 0, -14, '#ffffff', 1.6); panel(2.5, 11, -9, 0, -14, '#b9a6ff', 1.4);
  const envTex = pmrem.fromScene(es, .03).texture;

  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: .08, transmission: 1, thickness: 1.4, ior: 1.5, dispersion: 4,
    attenuationColor: new THREE.Color('#b9a6ff'), attenuationDistance: 3.2,
    clearcoat: 1, clearcoatRoughness: .04, iridescence: .35, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 480],
    envMap: envTex, envMapIntensity: 1.25, specularIntensity: 1, normalMap: noiseNormal(), normalScale: new THREE.Vector2(.25, .25),
  });
  const lens = new THREE.Mesh(lensGeometry(1.72, .44, .36, .17, 200), lensMat);
  const lensPivot = new THREE.Group(); lensPivot.add(lens); scene.add(lensPivot);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(4, 6, 7); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x8a6bff, 2.5); rim.position.set(-6, -2, -4); scene.add(rim);

  let wm = null, wmAspect = 5;
  const letters = new THREE.Group(); scene.add(letters);
  const letterMeta = [];
  const cards = [], cardMats = [];
  const texLoader = new THREE.TextureLoader();
  const aniso = Math.min(8, r.capabilities.getMaxAnisotropy());

  function load(tick) {
    return Promise.all(WORKS.map((w, i) => texLoader.loadAsync(w.img).then(t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
      const m = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: t }, uRev: { value: 0 }, uAct: { value: 0 }, uImgA: { value: t.image.width / t.image.height }, uCardA: { value: 1.6 }, uVel: { value: 0 }, uT: U.uT },
        vertexShader: VS, fragmentShader: CARD_FS, toneMapped: false,
      });
      cardMats[i] = m;
    }).catch(() => {
      cardMats[i] = new THREE.MeshBasicMaterial({ color: 0x15151f });
    }).finally(tick)));
  }

  function afterFonts() {
    // giant white wordmark, refracted by the lens
    const wc = textCanvas('ODLESK', 2600, 24);
    const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace; wt.anisotropy = aniso;
    wmAspect = wc.width / wc.height;
    wm = new THREE.Mesh(new THREE.PlaneGeometry(wmAspect, 1), new THREE.MeshBasicMaterial({ map: wt, alphaTest: .5, alphaToCoverage: true, toneMapped: false }));
    scene.add(wm);
    // the same word, faint and huge, around the walls
    const ww = textCanvas('ODLESK', 2000, 30);
    const wwt = new THREE.CanvasTexture(ww); wwt.wrapS = THREE.RepeatWrapping;
    U.uWord.value = wwt; U.uWordH.value = (2 * Math.PI * 18 / 3) / (ww.width / ww.height) * .82;
    // PROJEKTY: stacked layers give the letters depth when they turn
    const LH = 2.7, layers = 14, s = LH / 320;
    let total = 0;
    const metas = [...'PROJEKTY'].map(ch => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 320;
      const x = c.getContext('2d'); x.font = '800 250px Unbounded'; x.fillStyle = '#fff'; x.textAlign = 'center';
      x.fillText(ch, 160, 274);
      const adv = x.measureText(ch).width * s * .9;
      total += adv;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
      return { ch, t, adv };
    });
    let acc = -total / 2;
    for (const m of metas) {
      const g = new THREE.Group(), geo = new THREE.PlaneGeometry(320 * s, LH);
      const mats = [];
      for (let k = 0; k < layers; k++) {
        const col = k === 0 ? new THREE.Color('#e4e4ec') : new THREE.Color('#5a5a68').lerp(new THREE.Color('#121218'), k / layers);
        const mat = new THREE.MeshBasicMaterial({ map: m.t, alphaTest: .5, color: col, toneMapped: false });
        mats.push([mat, col.clone()]);
        const mesh = new THREE.Mesh(geo, mat); mesh.position.z = -k * .03; g.add(mesh);
      }
      letters.add(g);
      letterMeta.push({ g, mats, mid: acc + m.adv / 2 });
      acc += m.adv;
    }
    letters.userData.total = total;
    letters.visible = false;
    layout();
    r.compile(scene, cam);
  }

  let aspect = 1, fitK = 1, angW = .9, DELTA = 1.1;
  function layout() {
    const w = innerWidth, h = innerHeight;
    aspect = w / h;
    r.setPixelRatio(Math.min(devicePixelRatio, w < 760 ? 1.5 : 1.75));
    r.setSize(w, h, false);
    cam.fov = aspect < 1 ? 60 : aspect < 1.45 ? 50 : 42; cam.aspect = aspect; cam.updateProjectionMatrix();
    const tanH = Math.tan(cam.fov * Math.PI / 360);
    fitK = clamp(aspect / 1.75, .42, 1);
    if (wm) { const visW = 2 * 9.5 * tanH * aspect, ww = Math.min(12, visW * (aspect < 1 ? .9 : .76)); wm.scale.setScalar(ww / wmAspect); }
    const hfov = 2 * Math.atan(tanH * aspect);
    angW = Math.min(.93, hfov * (aspect < 1 ? .8 : .62));
    DELTA = angW + (aspect < 1 ? .16 : .2);
    const arc = angW * CARD_R, cardH = arc / (aspect < 1 ? .78 : 1.62);
    if (cardMats.length === WORKS.length) {
      for (const c of cards) { scene.remove(c); c.geometry.dispose(); }
      cards.length = 0;
      const geo = new THREE.PlaneGeometry(1, cardH, 48, 1), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const a = p.getX(i) * angW; p.setXYZ(i, Math.sin(a) * CARD_R, p.getY(i), -Math.cos(a) * CARD_R); }
      geo.computeVertexNormals();
      WORKS.forEach((_, i) => {
        const mesh = new THREE.Mesh(i ? geo.clone() : geo, cardMats[i]);
        if (cardMats[i].uniforms) cardMats[i].uniforms.uCardA.value = arc / cardH;
        mesh.position.set(0, .55, -3); mesh.visible = false; cards.push(mesh); scene.add(mesh);
      });
    }
  }

  // lens orientation: user quaternion, auto spin, drag with inertia, reset
  const qUser = new THREE.Quaternion(), qStep = new THREE.Quaternion(), autoAxis = new THREE.Vector3(.28, 1, .12).normalize();
  const spinAxis = new THREE.Vector3(1, .35, 0).normalize(), tmpV = new THREE.Vector3();
  const inertia = new THREE.Vector3();
  let dragging = false, autoPause = 0, resetT = -1; const qFrom = new THREE.Quaternion();
  function rotateBy(dx, dy) {
    tmpV.set(dy, dx, 0); const len = tmpV.length(); if (len < 1e-4) return;
    tmpV.normalize().applyQuaternion(cam.quaternion);
    qStep.setFromAxisAngle(tmpV, len * .009); qUser.premultiply(qStep);
    inertia.copy(tmpV).multiplyScalar(len * .009);
    autoPause = 3; resetT = -1;
  }
  function resetLens() { qFrom.copy(qUser); resetT = 0; inertia.set(0, 0, 0); autoPause = 3.5; }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitLens(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); return ray.intersectObject(lens, false).length > 0; }

  const look = new THREE.Vector3();
  let mx = 0, my = 0, tmx = 0, tmy = 0, prevShown = 0, vel = 0;
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { tmx = e.clientX / innerWidth * 2 - 1; tmy = e.clientY / innerHeight * 2 - 1; } }, { passive: true });

  function update(S, t, dt, intro) {
    U.uT.value = t; U.uIntro.value = intro;
    mx += (tmx - mx) * .05; my += (tmy - my) * .05;
    const cp = kf(S, CAM_P), ct = kf(S, CAM_T);
    cam.position.set(cp[0] + mx * .3, cp[1] - my * .14, cp[2]);
    look.set(ct[0] + mx * .7, ct[1] - my * .35, ct[2]);
    cam.lookAt(look);

    U.uPurple.value = kf(S, [[6.9, 0], [7.6, 1]]);
    U.uGlow.value = kf(S, [[0, 1], [1, .45], [2.3, .25], [6.9, .25], [7.7, 1.1]]);

    if (wm) {
      const sink = sstep(.2, .95, S) + (1 - intro);
      wm.position.set(0, .45 - sink * 6.6, 0);
      wm.visible = S < 1.4;
    }

    // lens path and orientation
    const lp = kf(S, LENS_P), ls = kf(S, LENS_S) * (aspect < 1 ? 1 + .45 * U.uPurple.value : 1) * fitK * (.25 + .75 * Math.min(1, intro * 1.25));
    const xk = aspect < 1 ? .45 : 1;
    lensPivot.position.set(lp[0] * xk, lp[1], lp[2]);
    lensPivot.scale.setScalar(ls);
    if (resetT >= 0) {
      resetT = Math.min(1, resetT + dt / .9);
      qUser.slerpQuaternions(qFrom, new THREE.Quaternion(), sstep(0, 1, resetT));
      if (resetT >= 1) resetT = -1;
    } else if (!dragging) {
      if (inertia.lengthSq() > 1e-7) { const a = inertia.length(); qStep.setFromAxisAngle(tmpV.copy(inertia).normalize(), a); qUser.premultiply(qStep); inertia.multiplyScalar(.93); }
      autoPause -= dt;
      if (autoPause <= 0 && !reduce) { qStep.setFromAxisAngle(autoAxis, dt * .32); qUser.premultiply(qStep); }
    }
    lens.quaternion.copy(qUser);

    // PROJEKTY letters rise from the floor, then part for the camera
    if (letterMeta.length) {
      letters.visible = S > .4 && S < 2.3;
      if (letters.visible) {
        const R = 8, cx = 0, cz = 5.5, total = letters.userData.total;
        const LS = aspect < 1 ? .5 : 1, sweep = (aspect < 1 ? .62 : .1) * total * LS / R;
        const rot = kf(S, [[.6, sweep], [1.75, -sweep]]);
        letterMeta.forEach((m, j) => {
          const a = sstep(.45 + j * .035, .98 + j * .035, S), e = sstep(1.55 + j * .025, 2.15 + j * .025, S);
          const side = (m.mid >= 0 ? 1 : -1);
          const ang = m.mid * LS / R + rot + side * e * .5;
          const rr = R + e * 3.5;
          m.g.scale.setScalar(LS);
          m.g.position.set(cx + Math.sin(ang) * rr, lerp(FLOOR_Y - 3.6, LS < 1 ? .2 : .6, a), cz - Math.cos(ang) * rr);
          m.g.rotation.set((1 - a) * -1.0, -ang - side * e * .9, 0);
          const k = (1 - e) * a;
          for (const [mat, base] of m.mats) mat.color.copy(base).multiplyScalar(k);
        });
      }
    }

    // works carousel
    if (cards.length) {
      const raw = clamp((S - 2.55) / .88, 0, WORKS.length - 1);
      const k = Math.floor(raw), shown = Math.min(WORKS.length - 1, k + sstep(.22, .78, raw - k));
      vel = lerp(vel, dt > 0 ? (shown - prevShown) / dt * .35 : 0, .2); prevShown = shown;
      const rev = kf(S, [[1.95, 0], [2.6, 1], [6.95, 1], [7.55, 0]]);
      const on = rev > 0;
      cards.forEach((c, i) => {
        const ang = -(i - shown) * DELTA;
        c.visible = on && Math.abs(ang) < 2.3;
        c.rotation.y = ang + mx * -.02;
        const u = c.material.uniforms;
        if (u) { u.uRev.value = rev; u.uAct.value = 1 - clamp(Math.abs(i - shown), 0, 1); u.uVel.value = vel; }
      });
      if (S > 2.2 && S < 7.3) showWork(Math.round(shown));
    }
  }

  return {
    scene, cam, lens, load, afterFonts, layout, update, rotateBy, resetLens, hitLens, lensMat, qUser,
    setDragging(v) { dragging = v; if (v) inertia.set(0, 0, 0); },
  };
}

const gl = renderer ? buildGL(renderer) : null;

/* ---------- lens HUD: quaternion readout, gizmo, material pane ---------- */
const hud = $('#hud'), gz = $('#gizmo'), gctx = gz.getContext('2d');
const qEls = ['#qx', '#qy', '#qz', '#qw'].map(s => $(s));
const fmt = v => (Math.abs(v) >= .995 ? (v < 0 ? '-1.0' : '1.0') : v.toFixed(2).replace(/^(-?)0\./, '$1.').replace(/^-\.00$/, '.00'));
const AX = [[1, 0, 0, '#ff5a5a'], [0, 1, 0, '#5cff8a'], [0, 0, 1, '#5a8cff']];
const gv = new THREE.Vector3();
function drawGizmo(q) {
  const s = gz.width, h = s / 2, R = s * .33, x = gctx;
  x.clearRect(0, 0, s, s);
  x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(h, h, s * .45, 0, 7); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(h - s * .45, h); x.lineTo(h + s * .45, h); x.moveTo(h, h - s * .45); x.lineTo(h, h + s * .45); x.stroke();
  const pts = [];
  for (const [ax, ay, az, col] of AX) {
    gv.set(ax, ay, az).applyQuaternion(q);
    pts.push({ x: h + gv.x * R, y: h - gv.y * R, z: gv.z, col, pos: true }, { x: h - gv.x * R, y: h + gv.y * R, z: -gv.z, col, pos: false });
  }
  pts.sort((a, b) => a.z - b.z);
  for (const p of pts) {
    if (p.pos) { x.strokeStyle = p.col; x.lineWidth = 3; x.beginPath(); x.moveTo(h, h); x.lineTo(p.x, p.y); x.stroke(); }
    x.beginPath(); x.arc(p.x, p.y, p.pos ? s * .075 : s * .052, 0, 7);
    x.fillStyle = p.pos ? p.col : 'rgba(11,11,16,.85)'; x.fill();
    x.lineWidth = 2; x.strokeStyle = p.col; x.stroke();
  }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(h, h, s * .03, 0, 7); x.fill();
}

if (gl) {
  let drag = null;
  const startDrag = (e, kind) => { drag = { kind, x: e.clientX, y: e.clientY, id: e.pointerId }; gl.setDragging(true); };
  gz.addEventListener('pointerdown', e => { gz.setPointerCapture(e.pointerId); startDrag(e, 'giz'); e.preventDefault(); });
  addEventListener('pointerdown', e => {
    if (drag || e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('a,button,input,label,.pane,.hud,.menu,.snd') || !ready || S > 2.4) return;
    if (gl.hitLens(e.clientX, e.clientY)) { startDrag(e, 'lens'); e.preventDefault(); document.body.style.cursor = 'grabbing'; }
  });
  addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    gl.rotateBy(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY;
  });
  const end = () => { if (!drag) return; drag = null; gl.setDragging(false); document.body.style.cursor = ''; };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  $('#qReset').addEventListener('click', () => { gl.resetLens(); blip(660, .2, .04); });

  const mat = gl.lensMat;
  pane.querySelectorAll('input[type=range]').forEach(inp => {
    const out = inp.nextElementSibling;
    const apply = () => {
      const v = parseFloat(inp.value), k = inp.dataset.k;
      if (k === 'grain') mat.normalScale.set(v, v); else mat[k] = v;
      out.textContent = v.toFixed(k === 'dispersion' ? 1 : 2);
      inp.style.setProperty('--f', ((v - inp.min) / (inp.max - inp.min) * 100).toFixed(1) + '%');
    };
    inp.addEventListener('input', apply); apply();
  });
  $('#sw').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    mat.attenuationColor.set(b.dataset.c);
    $('#sw').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    blip(880, .1, .03);
  });
} else {
  hud.classList.add('off'); pane.classList.add('off');
}

/* ---------- loading ---------- */
const ldPct = $('#ldPct'), ldDraw = $('#ldDraw'), heroEl = $('#uvod');
let ready = false, introT0 = 0, tt = 0, S = 0;
async function boot() {
  let done = 0; const total = (gl ? WORKS.length : 0) + 1;
  const tick = () => { done++; const pct = Math.round(done / total * 100); ldPct.textContent = String(pct).padStart(2, '0'); ldDraw.style.strokeDashoffset = String(100 - pct); };
  const fonts = Promise.race([
    Promise.all([document.fonts.load('800 200px Unbounded'), document.fonts.load('300 40px Archivo'), document.fonts.load('400 12px "IBM Plex Mono"')]),
    new Promise(res => setTimeout(res, 4500)),
  ]).then(tick);
  await Promise.all([fonts, gl ? gl.load(tick) : null]);
  if (gl) { try { gl.afterFonts(); } catch (e) { console.error(e); } }
  measure();
  setTimeout(() => { document.body.classList.remove('is-loading'); ready = true; introT0 = tt; }, 380);
}
boot();

/* ---------- frame ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; tt += dt;
  if (lenis) lenis.raf(now);
  const y = sy(), vh = innerHeight;
  S = y / vhU;
  const intro = ready ? (reduce ? 1 : 1 - Math.pow(1 - clamp((tt - introT0) / 2.4, 0, 1), 3)) : 0;

  // ruler: marker follows the page, label is the section under the middle of the screen
  const docH = document.documentElement.scrollHeight - vh;
  rulerNow.style.transform = `translateY(${(clamp(y / docH, 0, 1) * ruler.clientHeight).toFixed(1)}px) translateY(-50%)`;
  let lbl = 'ÚVOD';
  for (const [top, name] of secTops) if (y + vh * .5 >= top) lbl = name;
  if (rulerLbl.textContent !== lbl) rulerLbl.textContent = lbl;

  const inScene = S < 8.7;
  hud.classList.toggle('off', !gl || !inScene || !ready);
  pane.classList.toggle('off', !gl || S > 2.3 || !ready);
  if (S > 2.3 && pane.classList.contains('open')) { pane.classList.remove('open'); paneHd.setAttribute('aria-expanded', 'false'); }
  wkStick.classList.toggle('on', S > 2.35 && S < 7.25);
  cssProgress(vh);
  heroEl.style.setProperty('--ho', clamp(1 - S * 2.4, 0, 1).toFixed(3));

  if (gl && S < 9.02) {
    gl.update(S, tt, dt, intro);
    renderer.render(gl.scene, gl.cam);
    const q = gl.qUser;
    if (!hud.classList.contains('off')) { qEls[0].textContent = fmt(q.x); qEls[1].textContent = fmt(q.y); qEls[2].textContent = fmt(q.z); qEls[3].textContent = fmt(q.w); drawGizmo(q); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

let rT;
addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (gl) gl.layout(); measure(); }, 120); });
measure();
if (gl) gl.layout();

// test hook: jump to a point of the scene track (in screens)
const jump = yy => { if (lenis) lenis.scrollTo(yy, { immediate: true }); else window.scrollTo(0, yy); };
window.__odlesk = { go(s) { jump(s * vhU); }, to(id, f = 0) { jump(document.getElementById(id).getBoundingClientRect().top + sy() + f * innerHeight); }, get S() { return S; }, get ready() { return ready; } };
