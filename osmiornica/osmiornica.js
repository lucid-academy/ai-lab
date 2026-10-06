/*
 * osmiornica.js: Luci, a moody neon-violet octopus for HTML presentations (Lucid Academy).
 *
 * Drop-in, no dependencies:
 *   <script src="osmiornica.js" defer></script>
 * Optional config, before the script:
 *   <script>window.OSMIORNICA = { mode: 'lecture' }</script>
 * Slide changes are picked up from reveal.js, from .active/.present/.current classes, or from:
 *   document.dispatchEvent(new CustomEvent('slidechange', { detail: { slide: el } }))
 * Attributes:
 *   data-osmiornica="nie"        never on this slide
 *   data-osmiornica="tu"         always shows up on this slide
 *   data-osmiornica="final"      finale: drop + bow
 *   data-osmiornica-cel          preferred heading for pranks
 *   data-osmiornica-podest       something she may sit on (image, card)
 *   data-osmiornica-przeszkoda   keep clear of this (nav bars, logos)
 * API: Osmiornica.summon(name?) .hide() .serious(on?) .reward() .fix() .panel(on?) .slideChanged(el) .mode(m) .temper(t?)
 */
(() => {
  'use strict';
  if (window.Osmiornica) return;

  // ---------- config ----------
  const USER = window.OSMIORNICA || {};
  const CFG = Object.assign({
    name: 'Luci',
    mode: 'lecture',      // 'lecture': rare, controlled appearances · 'demo': on every slide
    size: .105,           // mantle height as a fraction of the viewport height
    firstAfterMin: 3,     // lecture: no appearance before this many minutes
    minGapMin: 9,         // lecture: minimum gap between appearances
    maxAppearances: 6,    // lecture: per session
    stayMin: 1.2,         // leaves on her own after this long on one slide
    delayAfterSlide: 1.1, // seconds between a slide change and her move
    memory: true,         // localStorage: sessions, clicks, mood of the day, which pranks worked
    thoughts: true,       // a thought cloud now and then, dreams while she sleeps
    skin: '#8B3DF5',      // electric violet
    belly: '#F0369F',     // Lucid magenta: undersides, suckers, web
    glow: '#3DE3F0',      // Lucid cyan: rim light and eyes
    neon: '#B44CFF',      // the glow around her
  }, USER);
  CFG.keys = Object.assign({ summon: 'o', hide: 'h', serious: '0', blame: 'w', reward: '+', fix: 'r', panel: 'd' }, USER.keys);
  const me = document.currentScript;
  if (me && me.dataset.mode) CFG.mode = me.dataset.mode;

  // ---------- utils ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = p => Math.random() < p;
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const approach = (x, target, rate, dt) => x + (target - x) * (1 - Math.exp(-rate * dt));
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const smooth = t => t * t * (3 - 2 * t);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t * t;
  const easeOutBack = t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
  const seeded = seed => { let s = (seed * 48271) % 2147483647 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const WHITE = [255, 255, 255], DEEP = [16, 6, 40];
  const shade = (c, f) => (f < 0 ? mix(c, DEEP, -f) : mix(c, WHITE, f));
  const SKIN0 = hex(CFG.skin), PINK = hex(CFG.belly), GLOW = hex(CFG.glow), NEON = hex(CFG.neon);
  const BELLY = mix(SKIN0, PINK, .5), GOLD = [255, 211, 110], RED = hex('#FF4D8D'), DIM = [140, 115, 215];
  const RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const mScale = () => (RM.matches ? .35 : 1);
  const CANCEL = Symbol('cancel');
  function parseColor(s) {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  }

  // ---------- runtime state ----------
  let clock = 0, RUN = 0, VW = innerWidth, VH = innerHeight, DPR = 1, S = 100;
  let state = 'hidden';      // hidden | busy | rest | sleep | drag
  let interruptible = false; // may a click start a reaction right now?
  let serious = false;
  let lastTouch = 0;
  const waits = [];
  const cur = { x: -1e4, y: -1e4, t: -9, speed: 0, inside: false };
  let host, root, cv, ctx, hitEl, dimEl, toastEl, panelEl;
  let toastUntil = 0;

  // ---------- memory ----------
  const MEM_KEY = 'osmiornica.pamiec.v1';
  const mem = { sessions: 0, clicks: 0, throws: 0, last: 0, first: Date.now(), stats: {}, temper: '', temperDay: '' };
  function memLoad() { if (!CFG.memory) return; try { Object.assign(mem, JSON.parse(localStorage.getItem(MEM_KEY) || '{}')); } catch (e) { /* storage blocked */ } }
  function memSave() { if (!CFG.memory) return; try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch (e) { /* storage blocked */ } }
  const stat = n => mem.stats[n] || (mem.stats[n] = { n: 0, s: 0 });

  // ---------- mood: functional emotions, visible on the skin ----------
  const EMO = ['curiosity', 'annoyance', 'boredom', 'joy', 'fear']; // fixed order = chart slots
  const EMO_PL = { curiosity: 'ciekawość', annoyance: 'irytacja', boredom: 'nuda', joy: 'radość', fear: 'strach' };
  const SERIES = { curiosity: '#3987e5', annoyance: '#d95926', boredom: '#199e70', joy: '#c98500', fear: '#d55181' };
  const DECAY = { curiosity: .05, annoyance: .04, boredom: .015, joy: .035, fear: .12 };
  const TINT = { curiosity: hex('#5B6CFF'), annoyance: hex('#B0124F'), boredom: hex('#6E6699'), joy: hex('#FF4FD8'), fear: hex('#F0E9FF') };
  const TINT_MAX = { curiosity: .45, annoyance: .55, boredom: .55, joy: .55, fear: .7 }; // she stays recognisably violet
  // mood of the day: it sets where her feelings drift back to
  const TEMPERS = {
    pogodna:   { curiosity: .4,  annoyance: .03, boredom: .12, joy: .45, fear: .05 },
    ciekawska: { curiosity: .6,  annoyance: .05, boredom: .1,  joy: .3,  fear: .05 },
    marudna:   { curiosity: .3,  annoyance: .24, boredom: .2,  joy: .14, fear: .05 },
    zaspana:   { curiosity: .25, annoyance: .06, boredom: .36, joy: .25, fear: .05 },
  };
  const BASE = Object.assign({}, TEMPERS.pogodna);
  let temper = 'pogodna';
  function setTemper(t) {
    temper = TEMPERS[t] ? t : 'pogodna';
    Object.assign(BASE, TEMPERS[temper]);
    mem.temper = temper; mem.temperDay = new Date().toDateString(); memSave();
  }
  function rollTemper(except) {
    const w = [['pogodna', .35], ['ciekawska', .25], ['marudna', .22], ['zaspana', .18]].filter(x => x[0] !== except);
    let r = Math.random() * w.reduce((s, x) => s + x[1], 0);
    for (const [k, p] of w) if ((r -= p) <= 0) return k;
    return w[0][0];
  }
  const mood = Object.assign({}, BASE);
  const moodLog = [];
  const feel = (k, d) => { mood[k] = clamp(mood[k] + d, 0, 1); };
  function moodTick(dt) {
    for (const k of EMO) mood[k] = approach(mood[k], BASE[k], DECAY[k], dt);
    // ignored: boredom builds up, faster while she is on stage
    feel('boredom', dt * (oct.on ? (clock - lastTouch > 10 ? .012 : 0) : .004));
    const last = moodLog.length ? moodLog[moodLog.length - 1].t : -9;
    if (clock - last >= 2) moodLog.push({ t: clock, v: EMO.map(k => mood[k]) });
    if (moodLog.length > 5400) moodLog.splice(0, moodLog.length - 5400);
  }
  function skinTarget() {
    let c = SKIN0;
    for (const k of EMO) { const w = clamp((mood[k] - BASE[k]) * 1.5, 0, TINT_MAX[k]); if (w > .01) c = mix(c, TINT[k], w); }
    return c;
  }

  // ---------- octopus ----------
  const N = 18; // points per arm
  const WEB = 4; // the web between the arms reaches this far down each arm
  const AT = f => Math.round((N - 1) * f); // a point a fraction of the way down the arm
  const POSES = {
    sit:    { up: 0, s0: .18, sk: .33, curl: 1.6,  wave: .45, wk: 2.6, ww: 1.4, droop: .3,  stiff: .2,   tip: .05,  damp: .9,  g: .4, follow: .35 },
    lie:    { up: 0, s0: .42, sk: .3,  curl: 1.15, wave: .25, wk: 2.2, ww: .8,  droop: .5,  stiff: .15,  tip: .04,  damp: .9,  g: .5, follow: .15 },
    fall:   { up: 1, s0: .62, sk: .26, curl: .7,   wave: 1.0, wk: 3.2, ww: 9,   droop: 0,   stiff: .06,  tip: .025, damp: .86, g: 0,  follow: 1 },
    jet:    { up: 0, s0: .03, sk: .05, curl: .15,  wave: .3,  wk: 3,   ww: 8,   droop: 0,   stiff: .24,  tip: .09,  damp: .85, g: 0,  follow: 1 },
    dangle: { up: 0, s0: .06, sk: .12, curl: .9,   wave: .85, wk: 2.8, ww: 4,   droop: 1.1, stiff: .045, tip: .02,  damp: .93, g: 1,  follow: .6 },
    tumble: { up: 0, s0: .35, sk: .4,  curl: .8,   wave: 1.2, wk: 3,   ww: 7,   droop: .2,  stiff: .05,  tip: .02,  damp: .9,  g: .6, follow: 1 },
  };
  // heavy-lidded by default; asym raises one brow, pout pushes out the fold under the eyes
  const EXPR = {
    smug:     { open: .55, low: .26, tilt: .15,  dil: .25, asym: .25 },
    focus:    { open: .58, low: .3,  tilt: .28,  dil: .3 },
    surprise: { open: 1,   low: 0,   tilt: -.35, dil: .75 },
    skeptic:  { open: .62, low: .22, tilt: .1,   dil: .35, asym: .5 },
    angry:    { open: .52, low: .22, tilt: .95,  dil: .2,  pout: 1 },
    innocent: { open: .86, low: .05, tilt: -.35, dil: .6 },
    guilty:   { open: .66, low: .14, tilt: -.5,  dil: .55, asym: -.2 },
    happy:    { open: .68, low: .38, tilt: -.15, dil: .5 },
    stretch:  { open: .08, low: .25, tilt: -.35, dil: .3 },
    closed:   { open: 0,   low: 0,   tilt: 0,    dil: .3 },
  };
  const oct = {
    on: false, x: 0, y: 0, vx: 0, vy: 0, physics: false, skipV: false, motion: null,
    ang: 0, angT: 0, angV: 0, spin: false, tilt: 0, tiltT: 0, tiltUntil: 0,
    face: 0, faceT: 0, turn: 0, turnT: 0, turnDir: 1,
    q: 0, qv: 0, qT: 0, hx: 0, hy: 0, hvx: 0, hvy: 0,
    scale: 1, alpha: 1, camo: 0, camoT: 0, camoC: [12, 7, 32], eyeCamo: false,
    skin: SKIN0.slice(), skinNow: SKIN0.slice(), flash: 0, flashC: WHITE,
    clouds: 0, flare: 0, glowPulse: 0, glowS: 0, breathe: 0, nextFidget: 2, pinch: 0,
    pose: 'sit', poseP: POSES.sit, ride: .3, ground: null, spot: null,
    exprName: null, exprUntil: 0, exprNext: null, props: [], arms: [],
    look: { mode: 'idle', until: 0, x: 0, y: 0 },
    eyes: { open: .74, low: .06, tilt: 0, dil: .4, asym: 0, pout: 0, gx: 0, gy: .12, gxT: 0, gyT: .12, jx: 0, jy: 0, jt: 0, blink: 0, next: 2, dizzy: 0 },
  };
  function makeArms() {
    // [side, k (0 inner … 3 outer), back]; the roots sit up under the mantle and the web hides them
    const order = [[-1, 1, 1], [1, 1, 1], [-1, 3, 1], [1, 3, 1], [-1, 0, 0], [1, 0, 0], [-1, 2, 0], [1, 2, 0]];
    oct.arms = order.map(([side, k, back], i) => ({
      i, side, k, back: !!back,
      len: back ? 1.36 : 1.5, w0: back ? .22 : .25, phase: rand(0, TAU), ck: rand(.8, 1.2), roll: rand(.35, 1),
      rx: side * (back ? .06 + .065 * k : .08 + .065 * k), ry: back ? -.1 : -.06,
      p: Array.from({ length: N }, () => ({ x: 0, y: 0, px: 0, py: 0 })),
      t: Array.from({ length: N }, () => ({ x: 0, y: 0 })),
      P: Object.assign({}, POSES.sit), reach: null, fidget: 0, ft: 0, fd: 1, fa: 0,
    }));
  }
  const setPose = name => { oct.pose = name; oct.poseP = POSES[name] || POSES.sit; };
  // an expression can hand over to the next one, so a startle settles into a reaction
  const expr = (name, sec = 1.5, then = null, thenSec = 1.3) => { oct.exprName = name; oct.exprUntil = name ? clock + sec : 0; oct.exprNext = then ? [then, thenSec] : null; };
  function look(mode, sec = 0, x, y) { oct.look.mode = mode; oct.look.until = sec ? clock + sec : 0; if (x != null) { oct.look.x = x; oct.look.y = y; } }
  const lookAt = (x, y, sec) => look('point', sec, x, y);
  // a startle is a flinch, not a cartoon gape: a blanch, a jolt, arms snapping in, then a real reaction
  function startle(k = 1, then = 'skeptic') {
    oct.flash = .32; oct.flashC = TINT.fear;
    oct.qv += 3.2 * k * mScale(); oct.hvy += S * 1.4 * k * mScale();
    for (const a of oct.arms) { a.fd = a.ft = .4; a.fa = .9 * k * mScale(); }
    expr('surprise', .45, then, 1.4);
  }
  // two front arms folded across her front, the way someone crosses their arms
  function crossArms(on) {
    for (const a of oct.arms) {
      if (a.back || a.k !== 0) continue;
      if (on) a.reach = { rel: [-a.side * .36 * S, -.02 * S], w: a.reach ? a.reach.w : 0, wT: 1, rate: 7, stiff: .55, front: true, idx: AT(.38) };
      else if (a.reach) a.reach.wT = 0;
    }
  }

  // head lag, lean, breathing and a pinch (held by the top) bend the mantle; eyes and marks follow the same warp
  const WP = { lx: 0, ly: 0, br: 0, pinch: 0 };
  function makeWarp() {
    const ca = Math.cos(-oct.ang), sa = Math.sin(-oct.ang), sc = oct.scale || 1;
    WP.lx = (oct.hx * ca - oct.hy * sa) / sc - oct.face * .12 * S;
    WP.ly = (oct.hx * sa + oct.hy * ca) / sc;
    WP.br = Math.sin(oct.breathe) * .022 * mScale();
    WP.pinch = oct.pinch;
  }
  function warp(x, y) {
    const v = clamp(-y / S, 0, 1.2), f = Math.pow(v, 1.5);
    let X = x * (1 + WP.br * .6 * f), Y = y * (1 + WP.br);
    if (WP.pinch > .01 && v > .45) { const k = (v - .45) / .55; Y -= WP.pinch * .4 * S * k * k; X *= 1 - WP.pinch * .55 * Math.pow(k, 1.4); }
    return [X + WP.lx * f, Y + WP.ly * f];
  }
  function toWorld(lx, ly) {
    const [wx, wy] = warp(lx, ly);
    const x = wx * (1 - .5 * oct.q) * oct.scale, y = wy * (1 + oct.q) * oct.scale;
    const c = Math.cos(oct.ang), s = Math.sin(oct.ang);
    return { x: oct.x + x * c - y * s, y: oct.y + x * s + y * c };
  }
  const siphonLocal = () => { const d = -(Math.sign(oct.face) || 1); return { x: d * .4 * S, y: -.12 * S, d }; };
  const siphonWorld = () => { const s = siphonLocal(); return toWorld(s.x + s.d * .06 * S, s.y + .03 * S); };

  function armRoot(a) {
    const lx = a.rx * S * (1 - .5 * oct.q) * oct.scale, ly = a.ry * S * (1 + oct.q) * oct.scale;
    const c = Math.cos(oct.ang), s = Math.sin(oct.ang);
    return [oct.x + lx * c - ly * s, oct.y + lx * s + ly * c];
  }
  const FAB = Array.from({ length: N }, () => ({ x: 0, y: 0 }));
  function armTargets(a) {
    const P = a.P, seg = a.len * S * oct.scale / (N - 1), t = a.t;
    let [x, y] = armRoot(a);
    // outward-down when up = 0, outward-up when up = 1, through horizontal in between
    const spread = P.s0 + P.sk * a.k + oct.flare * .9;
    const outward = a.side > 0 ? 0 : Math.PI;
    let th = oct.ang * P.follow + outward + a.side * (Math.PI / 2 - spread) * (1 - 2 * P.up);
    const sg = (2 * P.up - 1) * a.side, curl = (P.curl + a.fidget) * a.ck, wv = P.wave * mScale();
    // resting on something: an arm that meets the surface runs along it and its tip rolls up off it;
    // past the edge it drapes over
    const gr = !oct.physics && P.up < .5 ? oct.ground : null, floorY = gr ? gr.y - a.w0 * S * oct.scale * .3 : 0;
    t[0].x = x; t[0].y = y;
    for (let i = 1; i < N; i++) {
      const s = i / (N - 1);
      let kap = sg * curl * 6 * s * s * s + wv * 1.2 * Math.sin(a.phase + s * P.wk - clock * P.ww);
      if (gr) kap += sg * a.roll * 9 * s * s * s * s;
      th += kap / (N - 1);
      th += angDiff(th, Math.PI / 2) * P.droop * s * 2 / (N - 1);
      if (gr && Math.sin(th) > 0 && y + Math.sin(th) * seg > floorY && x > gr.x1 && x < gr.x2) th = Math.cos(th) < 0 ? Math.PI : 0;
      x += Math.cos(th) * seg; y += Math.sin(th) * seg;
      t[i].x = x; t[i].y = y;
    }
    const r = a.reach;
    if (!r || r.w < .002) return;
    // FABRIK from the current pose keeps the arm's curl; point idx goes to the goal and the rest trails past it
    const gx = r.rel ? oct.x + r.rel[0] * oct.scale : r.x, gy = r.rel ? oct.y + r.rel[1] * oct.scale : r.y, m = r.idx || N - 1;
    for (let i = 0; i <= m; i++) { FAB[i].x = t[i].x; FAB[i].y = t[i].y; }
    for (let it = 0; it < 3; it++) {
      FAB[m].x = gx; FAB[m].y = gy;
      for (let i = m - 1; i >= 0; i--) { const dx = FAB[i].x - FAB[i + 1].x, dy = FAB[i].y - FAB[i + 1].y, d = Math.hypot(dx, dy) || 1; FAB[i].x = FAB[i + 1].x + dx / d * seg; FAB[i].y = FAB[i + 1].y + dy / d * seg; }
      FAB[0].x = t[0].x; FAB[0].y = t[0].y;
      for (let i = 1; i <= m; i++) { const dx = FAB[i].x - FAB[i - 1].x, dy = FAB[i].y - FAB[i - 1].y, d = Math.hypot(dx, dy) || 1; FAB[i].x = FAB[i - 1].x + dx / d * seg; FAB[i].y = FAB[i - 1].y + dy / d * seg; }
    }
    const ox = FAB[m].x - t[m].x, oy = FAB[m].y - t[m].y;
    for (let i = 1; i < N; i++) {
      const fx = i <= m ? FAB[i].x : t[i].x + ox, fy = i <= m ? FAB[i].y : t[i].y + oy;
      t[i].x = lerp(t[i].x, fx, r.w); t[i].y = lerp(t[i].y, fy, r.w);
    }
  }
  function armSim(a, dt) {
    armTargets(a);
    const P = a.P, p = a.p, t = a.t, seg = a.len * S * oct.scale / (N - 1), f = dt * 60;
    const damp = Math.pow(P.damp, f), g = P.g * VH * 1.8 * dt * dt;
    const rb = a.reach ? a.reach.w * (a.reach.stiff || .35) : 0;
    p[0].x = p[0].px = t[0].x; p[0].y = p[0].py = t[0].y;
    for (let i = 1; i < N; i++) {
      const s = i / (N - 1), q = p[i];
      const vx = (q.x - q.px) * damp, vy = (q.y - q.py) * damp;
      q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + g;
      // a muscular base and a loose tip: the root holds its line, the tip flows
      const base = s < .25 ? Math.max(P.stiff, .38) : lerp(P.stiff, P.tip, (s - .25) / .75);
      const k = 1 - Math.pow(1 - clamp(base + rb * s, 0, .95), f);
      q.x += (t[i].x - q.x) * k; q.y += (t[i].y - q.y) * k;
    }
    const gr = oct.ground;
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < N; i++) {
        const A = p[i - 1], B2 = p[i], dx = B2.x - A.x, dy = B2.y - A.y, d = Math.hypot(dx, dy) || 1, m = (d - seg) / d;
        B2.x -= dx * m; B2.y -= dy * m;
      }
      // the arm can only enter the surface from above, so a hanging tip may still swing under its edge
      if (gr) for (let i = 1; i < N; i++) {
        const q = p[i];
        if (q.y > gr.y && q.x > gr.x1 && q.x < gr.x2 && p[i - 1].y <= gr.y + .5) { q.y = gr.y; q.px = lerp(q.px, q.x, .3); }
      }
    }
  }

  function spawn(x, y, pose = 'sit') {
    Object.assign(oct, { on: true, x, y, vx: 0, vy: 0, q: 0, qv: 0, qT: 0, hx: 0, hy: 0, hvx: 0, hvy: 0, ang: 0, angT: 0, angV: 0, spin: false, tilt: 0, tiltT: 0, turn: 0, turnT: 0, scale: 1, alpha: 1, camo: 0, camoT: 0, eyeCamo: false, clouds: 0, flare: 0, glowPulse: 0, pinch: 0, props: [], ground: null, physics: false, motion: null, ride: .3, skipV: true, face: 0, faceT: 0 });
    oct.skin = skinTarget(); setPose(pose); look('idle'); expr(null); unthink();
    Object.assign(oct.eyes, { dizzy: 0, open: .74, asym: 0, pout: 0 });
    makeWarp();
    for (const a of oct.arms) {
      Object.assign(a.P, oct.poseP); a.reach = null; a.fidget = 0; a.ft = 0;
      armTargets(a);
      for (let i = 0; i < N; i++) { a.p[i].x = a.p[i].px = a.t[i].x; a.p[i].y = a.p[i].py = a.t[i].y; }
    }
    hitEl.classList.add('on');
    lastTouch = clock;
  }
  function hide() {
    oct.on = false; oct.motion = null; oct.props = []; oct.physics = false;
    Letters.releaseAll(); unthink();
    hitEl.classList.remove('on', 'drag'); hitEl.style.width = hitEl.style.height = '0px';
    state = 'hidden'; interruptible = false; D.inFoch = false;
  }

  function gazeUpdate(dt) {
    const e = oct.eyes, L = oct.look;
    if (L.until && clock > L.until) { L.mode = 'idle'; L.until = 0; }
    let tx = null, ty = null;
    if (L.mode === 'point') { tx = L.x; ty = L.y; }
    else if ((L.mode === 'cursor' || L.mode === 'idle') && cur.inside && clock - cur.t < (L.mode === 'cursor' ? 30 : 2.5)) { tx = cur.x; ty = cur.y; }
    if (tx == null) { e.gxT = 0; e.gyT = .12; oct.faceT = 0; }
    else {
      const ey = oct.y - .31 * S * oct.scale, dx = tx - oct.x, dy = ty - ey, k = 1.15 / (Math.hypot(dx, dy) + S * 1.1);
      e.gxT = dx * k; e.gyT = dy * k;
      oct.faceT = clamp(dx / (S * 3), -1, 1);
    }
    if ((e.jt -= dt) <= 0) { e.jt = rand(.25, .9); e.jx = rand(-.06, .06); e.jy = rand(-.05, .05); }
    e.gx = approach(e.gx, e.gxT + e.jx, 28, dt); e.gy = approach(e.gy, e.gyT + e.jy, 28, dt);
    const m = Math.hypot(e.gx, e.gy); if (m > 1) { e.gx /= m; e.gy /= m; }
  }
  function eyesUpdate(dt) {
    if (oct.exprName && clock >= oct.exprUntil && oct.exprNext) { const [n, s] = oct.exprNext; expr(n, s); }
    const e = oct.eyes, x = oct.exprName && clock < oct.exprUntil ? EXPR[oct.exprName] : null;
    // resting face: heavy lids that lift with curiosity or fear and sink with boredom
    const openT = x ? x.open : clamp(.74 - mood.boredom * .25 + mood.curiosity * .18 + mood.fear * .2 - (oct.pose === 'lie' ? .1 : 0), .3, 1);
    e.open = approach(e.open, openT, 14, dt);
    e.low = approach(e.low, x ? x.low : clamp(.06 + mood.joy * .3, 0, .36), 10, dt);
    e.tilt = approach(e.tilt, x ? x.tilt : clamp(mood.annoyance * .9 - mood.fear * .35 - mood.curiosity * .1, -.5, .8), 8, dt);
    e.dil = approach(e.dil, x ? x.dil : clamp(.4 + mood.fear * .5 + mood.curiosity * .2, 0, 1), 6, dt);
    e.asym = approach(e.asym, x ? x.asym || 0 : temper === 'marudna' ? .15 : 0, 7, dt);
    e.pout = approach(e.pout, (x && x.pout) || D.inFoch ? 1 : mood.annoyance > .55 ? .6 : 0, 8, dt);
    if (e.dizzy > 0) e.dizzy -= dt;
    if ((e.next -= dt) <= 0) { e.blink = .17; e.next = chance(.2) ? .3 : rand(2, 5.5); }
    if (e.blink > 0) e.blink = Math.max(0, e.blink - dt);
    gazeUpdate(dt);
  }

  function octUpdate(dt) {
    if (!oct.on) return;
    const ox = oct.x, oy = oct.y, ovx = oct.vx, ovy = oct.vy;
    if (oct.motion && oct.motion.step(dt)) { const m = oct.motion; oct.motion = null; m.res(); }
    if (!oct.physics) { oct.vx = (oct.x - ox) / dt; oct.vy = (oct.y - oy) / dt; }
    if (oct.skipV) { oct.vx = oct.vy = 0; oct.skipV = false; }
    else { const k = .3 * mScale(); oct.hvx -= (oct.vx - ovx) * k; oct.hvy -= (oct.vy - ovy) * k; }
    oct.hvx += (-oct.hx * 230 - oct.hvx * 10) * dt; oct.hvy += (-oct.hy * 230 - oct.hvy * 10) * dt;
    oct.hx = clamp(oct.hx + oct.hvx * dt, -.3 * S, .3 * S); oct.hy = clamp(oct.hy + oct.hvy * dt, -.3 * S, .3 * S);
    oct.qv += ((oct.qT - oct.q) * 280 - oct.qv * 13) * dt; oct.q = clamp(oct.q + oct.qv * dt, -.42, .42);
    if (clock > oct.tiltUntil) oct.tiltT = 0;
    oct.tilt = approach(oct.tilt, oct.tiltT, 4, dt);
    if (oct.spin) oct.ang += oct.angV * dt;
    else oct.ang += angDiff(oct.ang, oct.angT + oct.tilt) * (1 - Math.exp(-8 * dt));
    oct.face = approach(oct.face, oct.faceT, 5, dt);
    oct.turn = approach(oct.turn, oct.turnT, 5, dt);
    oct.camo = approach(oct.camo, oct.camoT, 3, dt);
    oct.pinch = approach(oct.pinch, state === 'drag' ? 1 : 0, state === 'drag' ? 9 : 4, dt);
    oct.clouds = approach(oct.clouds, 0, .6, dt);
    oct.glowPulse = approach(oct.glowPulse, 0, 2, dt);
    oct.glowS = approach(oct.glowS, state === 'sleep' ? 1 : 0, 1.5, dt);
    oct.skin = mix(oct.skin, skinTarget(), 1 - Math.exp(-3.5 * dt));
    let sk = mix(oct.skin, oct.camoC, clamp(oct.camo, 0, 1) * .92);
    if (oct.flash > 0) { oct.flash -= dt; sk = mix(sk, oct.flashC, clamp(oct.flash / .3, 0, 1)); }
    oct.skinNow = sk;
    oct.breathe += dt * TAU * (.32 + mood.fear * .5) * (state === 'sleep' ? .6 : 1);
    eyesUpdate(dt);
    makeWarp();
    if ((oct.nextFidget -= dt) <= 0) {
      oct.nextFidget = rand(1, 3.2);
      if (state === 'rest' || state === 'sleep') { const a = pick(oct.arms); a.fd = a.ft = rand(.6, 1.3); a.fa = rand(-1, 1.2) * mScale(); }
    }
    for (const a of oct.arms) {
      for (const k in a.P) a.P[k] = approach(a.P[k], oct.poseP[k], 6, dt);
      const r = a.reach;
      if (r) {
        if (r.follow) { r.x = cur.x; r.y = cur.y; }
        r.w = approach(r.w, r.wT, r.rate || 5, dt);
        if (r.wT === 0 && r.w < .01) a.reach = null;
      }
      if (a.ft > 0) { a.ft -= dt; a.fidget = a.ft > 0 ? a.fa * Math.sin(Math.PI * (1 - a.ft / a.fd)) : 0; }
      armSim(a, dt);
    }
  }

  // ---------- drawing ----------
  const bz = (c, a, b, d) => c.bezierCurveTo(a[0], a[1], b[0], b[1], d[0], d[1]);
  function pill(c, x, y, w, h) {
    const r = Math.min(w, h) / 2;
    c.beginPath(); c.moveTo(x - w / 2 + r, y - h / 2); c.lineTo(x + w / 2 - r, y - h / 2);
    c.arc(x + w / 2 - r, y, r, -Math.PI / 2, Math.PI / 2); c.lineTo(x - w / 2 + r, y + h / 2);
    c.arc(x - w / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5); c.closePath();
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // mottling: clusters of dark blotches over the sac, fine specks lower down
  const SKINMARKS = (() => {
    const r = seeded(11), out = [];
    const halfW = v => (v < .4 ? .3 + v * .25 : v < .64 ? lerp(.4, .53, (v - .4) / .24) : .53 * Math.sqrt(Math.max(0, 1 - Math.pow((v - .64) / .42, 2))));
    for (let i = 0; i < 9; i++) {
      const v = .5 + r() * .46, x = (r() * 2 - 1) * halfW(v) * .78;
      for (let j = 0; j < 3; j++) {
        const vv = clamp(v + (r() - .5) * .12, .46, 1), xx = clamp(x + (r() - .5) * .14, -halfW(vv) * .9, halfW(vv) * .9);
        out.push({ x: xx, y: -vv, r: .03 + r() * .045, ph: r() * TAU, rot: r() * Math.PI, blot: true });
      }
    }
    while (out.length < 57) {
      const v = .08 + r() * .9, x = (r() * 2 - 1) * halfW(v) * .9;
      if (v > .14 && v < .5 && Math.abs(x) > .04 && Math.abs(x) < .43) continue; // keep the eyes clear
      out.push({ x, y: -v, r: .006 + r() * .01, ph: r() * TAU, rot: 0, blot: false });
    }
    return out;
  })();
  function bodyXform(c) { c.translate(oct.x, oct.y); c.rotate(oct.ang); c.scale((1 - .5 * oct.q) * oct.scale, (1 + oct.q) * oct.scale); }
  function mantlePath(c, fresh = true) {
    const P = (x, y) => warp(x * S, y * S);
    if (fresh) c.beginPath();
    // a narrow face carrying the eyes, and a big soft sac rising behind it
    const s = P(-.3, 0); c.moveTo(s[0], s[1]);
    bz(c, P(-.36, -.06), P(-.4, -.17), P(-.39, -.27));
    bz(c, P(-.38, -.4), P(-.54, -.46), P(-.53, -.64));
    bz(c, P(-.52, -.9), P(-.28, -1.04), P(0, -1.03));
    bz(c, P(.28, -1.04), P(.52, -.9), P(.53, -.64));
    bz(c, P(.54, -.46), P(.38, -.4), P(.39, -.27));
    bz(c, P(.4, -.17), P(.36, -.06), P(.3, 0));
    const u = P(0, .07); c.quadraticCurveTo(u[0], u[1], s[0], s[1]);
    c.closePath();
  }
  function drawSiphon(c, skin) {
    const s = siphonLocal(), p = warp(s.x, s.y);
    c.save(); c.translate(p[0], p[1]); c.rotate(s.d * .95);
    c.fillStyle = rgba(shade(skin, -.2)); pill(c, 0, .02 * S, .085 * S, .15 * S); c.fill();
    c.fillStyle = rgba(shade(skin, -.6)); c.beginPath(); c.ellipse(0, .085 * S, .026 * S, .014 * S, 0, 0, TAU); c.fill();
    c.restore();
  }
  function drawMantle(c, skin) {
    drawSiphon(c, skin);
    mantlePath(c);
    const k = 1 - oct.camo, hl = warp(-.2 * S, -.8 * S);
    const g = c.createRadialGradient(hl[0], hl[1], S * .04, hl[0] + .12 * S, hl[1] + .3 * S, S * 1.1);
    g.addColorStop(0, rgba(mix(shade(skin, .38), PINK, .1))); g.addColorStop(.42, rgba(skin)); g.addColorStop(1, rgba(shade(skin, -.6)));
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    // magenta bounce light from below, as if the slide glowed under her
    const bl = c.createRadialGradient(0, .08 * S, 0, 0, .08 * S, .8 * S);
    bl.addColorStop(0, rgba(PINK, .36 * k)); bl.addColorStop(1, rgba(PINK, 0));
    c.fillStyle = bl; c.fillRect(-S, -1.6 * S, 2 * S, 1.8 * S);
    if (oct.clouds > .02) { // "passing clouds": dark bands sweeping down, a real cephalopod display
      const ph = (clock * 1.3) % 1;
      for (let j = 0; j < 2; j++) {
        const yy = -S * 1.1 + ((ph + j * .5) % 1) * S * 1.3;
        const lg = c.createLinearGradient(0, yy - .18 * S, 0, yy + .18 * S);
        lg.addColorStop(0, 'rgba(20,6,46,0)'); lg.addColorStop(.5, `rgba(20,6,46,${.45 * Math.min(1, oct.clouds)})`); lg.addColorStop(1, 'rgba(20,6,46,0)');
        c.fillStyle = lg; c.fillRect(-S, yy - .2 * S, 2 * S, .4 * S);
      }
    }
    // mottling: the blotches darken when she is irritated
    const bc = mix(shade(skin, -.42), [110, 20, 60], .35);
    for (const m of SKINMARKS) {
      const p = warp(m.x * S, m.y * S);
      if (m.blot) {
        c.fillStyle = rgba(bc, (.2 + .08 * Math.sin(clock * .8 + m.ph) + mood.annoyance * .12) * k);
        c.beginPath(); c.ellipse(p[0], p[1], m.r * S, m.r * S * .72, m.rot, 0, TAU); c.fill();
      } else {
        c.fillStyle = rgba(bc, .4 * k); c.beginPath(); c.arc(p[0], p[1], m.r * S, 0, TAU); c.fill();
      }
    }
    // held by the top: the skin bunches into folds toward the pinch
    if (oct.pinch > .25) {
      const pa = (oct.pinch - .25) / .75 * k;
      c.strokeStyle = rgba(shade(skin, -.5), .55 * pa); c.lineWidth = .02 * S; c.lineCap = 'round';
      for (const x of [-.16, -.05, .07, .17]) {
        const a = warp(x * S, -.78 * S), m = warp(x * .62 * S, -.92 * S), b = warp(x * .3 * S, -1.02 * S);
        c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(m[0], m[1], b[0], b[1]); c.stroke();
      }
    }
    c.restore();
    // two-tone neon rim: magenta on one side, Lucid cyan on the other
    const rim = c.createLinearGradient(-.55 * S, 0, .55 * S, 0);
    rim.addColorStop(0, rgba(PINK, .5 * k)); rim.addColorStop(.3, rgba(PINK, 0)); rim.addColorStop(.64, rgba(GLOW, 0)); rim.addColorStop(1, rgba(GLOW, .8 * k));
    c.strokeStyle = rim; c.lineWidth = .034 * S; mantlePath(c); c.stroke();
    // a cool sheen along the upper right of the sac
    const s0 = warp(.12 * S, -.97 * S), s1 = warp(.44 * S, -.8 * S), s2 = warp(.49 * S, -.57 * S);
    c.strokeStyle = rgba([140, 165, 255], .35 * k); c.lineWidth = .045 * S; c.lineCap = 'round';
    c.beginPath(); c.moveTo(s0[0], s0[1]); c.quadraticCurveTo(s1[0], s1[1], s2[0], s2[1]); c.stroke();
    // wet highlight
    c.save(); c.translate(hl[0], hl[1]); c.rotate(-.55); c.scale(1, .5);
    const sp = c.createRadialGradient(0, 0, 0, 0, 0, .16 * S);
    sp.addColorStop(0, `rgba(255,255,255,${.55 * (1 - oct.camo * .8)})`); sp.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sp; c.beginPath(); c.arc(0, 0, .16 * S, 0, TAU); c.fill();
    c.restore();
    c.fillStyle = `rgba(255,255,255,${.75 * (1 - oct.camo * .8)})`;
    for (const [x, y, r] of [[-.28, -.72, .02], [-.19, -.87, .012], [-.34, -.6, .009]]) { const d = warp(x * S, y * S); c.beginPath(); c.arc(d[0], d[1], r * S, 0, TAU); c.fill(); }
  }
  function spiral(c, x, y, R) {
    c.strokeStyle = '#2A1650'; c.lineWidth = R * .14; c.lineCap = 'round'; c.beginPath();
    for (let a = 0; a < TAU * 2.2; a += .2) { const rr = R * a / (TAU * 2.2), aa = a + clock * 9; c.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); }
    c.stroke();
  }
  function eye(c, cx, cy, r, side, open, e, skin) {
    const sk = 1 - oct.camo * .95; // mound, lids and brow fade with the skin; only the eyeballs stay
    // the eye sits on a raised mound, as on a real octopus: lit on top, shadowed below, no hard edge
    const md = c.createRadialGradient(cx, cy + r * .4, r * .4, cx, cy + r * .4, r * 1.55);
    md.addColorStop(0, `rgba(16,6,40,${.34 * sk})`); md.addColorStop(1, 'rgba(16,6,40,0)');
    c.fillStyle = md; c.beginPath(); c.arc(cx, cy + r * .4, r * 1.55, 0, TAU); c.fill();
    const mg = c.createRadialGradient(cx - side * r * .15, cy - r * .55, r * .1, cx, cy - r * .04, r * 1.55);
    mg.addColorStop(0, rgba(shade(skin, .24), sk)); mg.addColorStop(.62, rgba(shade(skin, .05), sk)); mg.addColorStop(1, rgba(skin, 0));
    c.fillStyle = mg; c.beginPath(); c.arc(cx, cy - r * .04, r * 1.55, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    c.fillStyle = '#E9E1F2'; c.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    const sh = c.createLinearGradient(cx, cy - r, cx, cy + r);
    sh.addColorStop(0, 'rgba(60,30,110,.35)'); sh.addColorStop(.5, 'rgba(60,30,110,0)'); sh.addColorStop(1, 'rgba(60,30,110,.18)');
    c.fillStyle = sh; c.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    const ir = r * .72, ix = cx + e.gx * (r - ir * .75), iy = cy + e.gy * (r - ir * .75);
    if (e.dizzy > 0) spiral(c, cx, cy, r * .8);
    else {
      const ig = c.createRadialGradient(ix - ir * .25, iy - ir * .3, ir * .08, ix, iy, ir);
      ig.addColorStop(0, '#A8F6F8'); ig.addColorStop(.48, rgba(GLOW)); ig.addColorStop(1, '#09566E');
      c.fillStyle = ig; c.beginPath(); c.arc(ix, iy, ir, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(4,34,52,.6)'; c.lineWidth = ir * .1; c.stroke();
      // octopus pupil: a horizontal bar that rounds out as it dilates
      c.fillStyle = '#0E0622'; pill(c, ix, iy, ir * lerp(1.05, .86, e.dil), ir * lerp(.58, .86, e.dil)); c.fill();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(ix - ir * .34, iy - ir * .36, ir * .2, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(ix + ir * .3, iy + ir * .28, ir * .08, 0, TAU); c.fill();
    }
    // heavy upper lid: a thick fold of skin with a soft shadow under it
    const tilt = -side * e.tilt * .5, uy = cy - r * 1.06 + 2.12 * r * (1 - clamp(open, 0, 1));
    c.save(); c.translate(cx, uy); c.rotate(tilt);
    const ls = c.createLinearGradient(0, 0, 0, r * .5);
    ls.addColorStop(0, 'rgba(26,8,56,.5)'); ls.addColorStop(1, 'rgba(26,8,56,0)');
    c.fillStyle = ls; c.fillRect(-r * 1.4, 0, r * 2.8, r * .5);
    const lg = c.createLinearGradient(0, -r * 1.2, 0, r * .2);
    lg.addColorStop(0, rgba(shade(skin, .16))); lg.addColorStop(1, rgba(shade(skin, -.08)));
    c.fillStyle = lg; c.beginPath(); c.moveTo(-r * 1.4, 0); c.quadraticCurveTo(0, r * .3, r * 1.4, 0); c.lineTo(r * 1.4, -r * 3); c.lineTo(-r * 1.4, -r * 3); c.closePath(); c.fill();
    c.strokeStyle = rgba(shade(skin, -.55)); c.lineWidth = r * .12; c.beginPath(); c.moveTo(-r * 1.4, 0); c.quadraticCurveTo(0, r * .3, r * 1.4, 0); c.stroke();
    c.strokeStyle = rgba(shade(skin, .4), .6); c.lineWidth = r * .07; c.beginPath(); c.moveTo(-r * 1.2, -r * .14); c.quadraticCurveTo(0, r * .12, r * 1.2, -r * .14); c.stroke();
    c.restore();
    if (e.low > .02) {
      const ly = cy + r * 1.06 - 2.12 * r * e.low;
      const arch = r * (.22 + e.low * .8); // a raised lower lid arches up, the way a smile pushes the cheeks
      c.save(); c.translate(cx, ly + arch * .3); c.rotate(-tilt * .4);
      c.fillStyle = rgba(shade(skin, .04)); c.beginPath(); c.moveTo(-r * 1.4, 0); c.quadraticCurveTo(0, -arch, r * 1.4, 0); c.lineTo(r * 1.4, r * 3); c.lineTo(-r * 1.4, r * 3); c.closePath(); c.fill();
      c.strokeStyle = rgba(shade(skin, -.45)); c.lineWidth = r * .08; c.beginPath(); c.moveTo(-r * 1.4, 0); c.quadraticCurveTo(0, -arch, r * 1.4, 0); c.stroke();
      c.restore();
    }
    c.restore();
    if (open < .15) { // shut: the lids meet in a soft crease
      c.strokeStyle = rgba(shade(skin, -.55), (1 - open / .15) * .8); c.lineWidth = r * .1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx - r * .85, cy + r * .05); c.quadraticCurveTo(cx, cy + r * .4, cx + r * .85, cy + r * .05); c.stroke();
    }
    c.strokeStyle = rgba(shade(skin, -.5), .55 * sk); c.lineWidth = r * .06; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    // brow fold: it carries most of the expression
    const lift = (1 - clamp(open, 0, 1)) * r * .22 - (e.asym || 0) * side * r * .3;
    c.save(); c.globalAlpha *= sk; c.translate(cx, cy - r * 1.22 + lift); c.rotate(-side * e.tilt * .62);
    c.fillStyle = rgba(shade(skin, .2)); c.beginPath(); c.moveTo(-r * 1.3, r * .22); c.quadraticCurveTo(0, -r * .5, r * 1.3, r * .22); c.quadraticCurveTo(0, -r * .1, -r * 1.3, r * .22); c.fill();
    c.strokeStyle = rgba(shade(skin, -.45), .65); c.lineWidth = r * .09; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r * 1.1, r * .26); c.quadraticCurveTo(0, -r * .06, r * 1.1, r * .26); c.stroke();
    c.restore();
  }
  function drawFace(c) {
    const e = oct.eyes, f = oct.face, skin = oct.skinNow, tr = oct.turn;
    if (tr > .97) return; // back to the audience
    const shut = e.blink > 0 ? Math.sin(Math.PI * (1 - e.blink / .17)) : 0, open = e.open * (1 - shut), r = .118 * S;
    // turning away: the face slides round the side of the head and narrows
    const dir = oct.turnDir, squeeze = Math.max(.12, Math.cos(tr * Math.PI / 2)), shift = Math.sin(tr * Math.PI / 2) * .42 * S * dir;
    for (const side of [-1, 1]) {
      const far = side * f < 0 ? 1 - Math.abs(f) * .12 : 1;
      const fade = clamp(1.7 - tr * 1.9 - (side === -dir ? tr * .9 : 0), 0, 1);
      if (fade < .02) continue;
      const p = warp(side * .235 * S * squeeze + f * .08 * S + shift, -.31 * S);
      c.save(); c.globalAlpha *= fade; c.translate(p[0], p[1]); c.scale(squeeze, 1);
      eye(c, 0, 0, r * far, side, clamp(open * (1 + e.asym * side * .45), 0, 1), e, skin);
      c.restore();
    }
    // a pout: the fold of skin under the eyes pushes out when she sulks or is held up
    if (e.pout > .03 && tr < .5) {
      const m = warp(f * .06 * S + shift, -.13 * S), w = .085 * S * squeeze;
      c.save(); c.globalAlpha *= e.pout * (1 - oct.camo);
      const pg = c.createRadialGradient(m[0], m[1] - w * .3, 0, m[0], m[1], w * 1.1);
      pg.addColorStop(0, rgba(shade(skin, .12))); pg.addColorStop(1, rgba(shade(skin, -.2)));
      c.fillStyle = pg; c.beginPath(); c.ellipse(m[0], m[1], w, w * .6, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(shade(skin, -.6), .8); c.lineWidth = .016 * S; c.lineCap = 'round';
      c.beginPath(); c.moveTo(m[0] - w * .62, m[1] + w * .3); c.quadraticCurveTo(m[0], m[1] - w * .12, m[0] + w * .62, m[1] + w * .3); c.stroke();
      c.restore();
    }
  }
  // arm geometry: a frame (normals and half-widths) and a smooth tapered outline around it
  const AL = Array.from({ length: N }, () => [0, 0]), AR = Array.from({ length: N }, () => [0, 0]);
  const NX = new Float32Array(N), NY = new Float32Array(N), WW = new Float32Array(N), WH = new Float32Array(N);
  const SH = Array.from({ length: N }, () => ({ x: 0, y: 0 }));
  function armFrame(pts, w0, wt) {
    for (let i = 0; i < N; i++) {
      const A = pts[Math.max(0, i - 1)], B2 = pts[Math.min(N - 1, i + 1)];
      let tx = B2.x - A.x, ty = B2.y - A.y; const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      NX[i] = -ty; NY[i] = tx; WW[i] = (wt + (w0 - wt) * Math.pow(1 - i / (N - 1), .7)) / 2;
    }
  }
  function armPath(c, pts, ww, fresh = true) {
    for (let i = 0; i < N; i++) {
      AL[i][0] = pts[i].x + NX[i] * ww[i]; AL[i][1] = pts[i].y + NY[i] * ww[i];
      AR[i][0] = pts[i].x - NX[i] * ww[i]; AR[i][1] = pts[i].y - NY[i] * ww[i];
    }
    if (fresh) c.beginPath();
    c.moveTo(AL[0][0], AL[0][1]);
    for (let i = 1; i < N - 1; i++) c.quadraticCurveTo(AL[i][0], AL[i][1], (AL[i][0] + AL[i + 1][0]) / 2, (AL[i][1] + AL[i + 1][1]) / 2);
    c.lineTo(AL[N - 1][0], AL[N - 1][1]);
    const tp = pts[N - 1], an = Math.atan2(NY[N - 1], NX[N - 1]);
    c.arc(tp.x, tp.y, ww[N - 1], an, an - Math.PI, true);
    for (let i = N - 2; i > 0; i--) c.quadraticCurveTo(AR[i][0], AR[i][1], (AR[i][0] + AR[i - 1][0]) / 2, (AR[i][1] + AR[i - 1][1]) / 2);
    c.lineTo(AR[0][0], AR[0][1]); c.closePath();
  }
  function armOutline(c, pts, w0, wt, fresh = true) { armFrame(pts, w0, wt); armPath(c, pts, WW, fresh); }
  function drawArm(c, a, col, detail) {
    const p = a.p, k = 1 - oct.camo, w0 = a.w0 * S * oct.scale, wt = .018 * S * oct.scale;
    armOutline(c, p, w0, wt);
    c.fillStyle = rgba(col); c.fill();
    const sg = (2 * a.P.up - 1) * a.side >= 0 ? 1 : -1; // suckers sit on the inner side of the curl
    // pink underside: a ribbon shifted toward the sucker side
    for (let i = 0; i < N; i++) { SH[i].x = p[i].x + NX[i] * WW[i] * .42 * sg; SH[i].y = p[i].y + NY[i] * WW[i] * .42 * sg; WH[i] = WW[i] * .6; }
    c.fillStyle = rgba(mix(col, BELLY, .8), .75); armPath(c, SH, WH); c.fill();
    armFrame(p, w0, wt);
    if (!detail) return;
    // a wet lilac sheen along the top, and a few dark speckles
    c.strokeStyle = rgba(mix(col, [222, 200, 255], .5), .3 * k); c.lineWidth = Math.max(1, WW[1] * .26); c.lineCap = 'round';
    c.beginPath();
    for (let i = 1; i < N - 2; i++) { const x = p[i].x - NX[i] * WW[i] * .5 * sg, y = p[i].y - NY[i] * WW[i] * .5 * sg; i === 1 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.stroke();
    c.fillStyle = rgba(shade(col, -.5), .35 * k);
    for (let i = 1; i < N - 2; i += 2) {
      const o = .1 + .35 * Math.sin(a.phase * 7 + i * 2.3), x = p[i].x - NX[i] * WW[i] * o * sg, y = p[i].y - NY[i] * WW[i] * o * sg;
      c.beginPath(); c.arc(x, y, Math.max(.6, WW[i] * .12), 0, TAU); c.fill();
    }
    // suckers: pale discs with a darker rim and cup, two per segment, poking out along the underside
    const rim = mix(BELLY, [110, 25, 75], .35), disc = mix(BELLY, [255, 236, 248], .62), cup = mix(BELLY, [90, 20, 60], .45);
    for (let i = 2; i < N - 1; i++) for (const h of [0, .5]) {
      const i1 = i + 1, w = lerp(WW[i], WW[i1], h), r = w * .5;
      if (r < .8) continue;
      const x = lerp(p[i].x, p[i1].x, h) + lerp(NX[i], NX[i1], h) * w * .62 * sg, y = lerp(p[i].y, p[i1].y, h) + lerp(NY[i], NY[i1], h) * w * .62 * sg;
      c.fillStyle = rgba(rim, .95); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillStyle = rgba(disc); c.beginPath(); c.arc(x, y, r * .76, 0, TAU); c.fill();
      c.fillStyle = rgba(cup, .7); c.beginPath(); c.arc(x, y, r * .34, 0, TAU); c.fill();
      if (oct.glowS > .02 && !h) { // bioluminescent suckers while she sleeps (every other one is plenty)
        c.save(); c.globalCompositeOperation = 'lighter';
        const gg = c.createRadialGradient(x, y, 0, x, y, r * 3);
        gg.addColorStop(0, rgba(GLOW, .5 * oct.glowS)); gg.addColorStop(1, rgba(GLOW, 0));
        c.fillStyle = gg; c.beginPath(); c.arc(x, y, r * 3, 0, TAU); c.fill(); c.restore();
      }
    }
  }
  // the web between the arms: a scalloped skirt that hides where the arms start
  const WEBPTS = [];
  function drawWeb(c, skin) {
    WEBPTS.length = 0;
    const down = oct.ang + Math.PI / 2;
    for (const a of oct.arms) {
      if (a.reach && a.reach.w > .3) continue;
      const q = a.p[WEB];
      WEBPTS.push({ x: q.x, y: q.y, k: angDiff(down, Math.atan2(q.y - oct.y, q.x - oct.x)) });
    }
    if (WEBPTS.length < 2) return;
    WEBPTS.sort((a, b) => b.k - a.k); // around the crown, from her left to her right
    const L = toWorld(-.31 * S, -.05 * S), R = toWorld(.31 * S, -.05 * S), C = toWorld(0, -.02 * S);
    c.beginPath(); c.moveTo(L.x, L.y);
    let prev = L;
    for (const q of [...WEBPTS, R]) {
      const mx = (prev.x + q.x) / 2, my = (prev.y + q.y) / 2;
      c.quadraticCurveTo(lerp(mx, C.x, .32), lerp(my, C.y, .32), q.x, q.y);
      prev = q;
    }
    c.closePath();
    const g = c.createLinearGradient(C.x, C.y - .1 * S, C.x, C.y + .45 * S * oct.scale);
    g.addColorStop(0, rgba(shade(skin, -.12))); g.addColorStop(1, rgba(mix(shade(skin, -.1), BELLY, .35)));
    c.fillStyle = g; c.fill();
  }
  function drawGlow(c) {
    // neon halo around the whole silhouette: one blurred pass behind the body
    const k = clamp((.55 + mood.joy * .35 + oct.glowPulse) * (1 - oct.camo) * oct.alpha, 0, 1.3);
    if (k < .03 || oct.scale < .2) return;
    const col = mix(NEON, oct.skinNow, .25);
    c.save();
    c.shadowColor = rgba(col, Math.min(1, .7 * k)); c.shadowBlur = S * .36 * oct.scale * DPR * Math.min(1.3, .7 + k * .4);
    c.fillStyle = rgba(col, Math.min(1, k));
    c.beginPath();
    for (const a of oct.arms) armOutline(c, a.p, a.w0 * S * oct.scale, .018 * S * oct.scale, false);
    c.save(); bodyXform(c); mantlePath(c, false); c.restore();
    c.fill();
    c.restore();
  }
  function drawPlug(c, a) {
    const t = a.p[N - 2], x = t.x, y = t.y - S * .1, w = S * .17, h = S * .2;
    c.strokeStyle = '#1E1633'; c.lineWidth = S * .045; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y + h * .5); c.bezierCurveTo(x, y + S * .8, x + S * .9, VH - S * .2, x + S * 1.4, VH + S * .6); c.stroke();
    c.fillStyle = '#2B2244'; roundRect(c, x - w / 2, y - h / 2, w, h, S * .03); c.fill();
    c.fillStyle = 'rgba(255,255,255,.14)'; roundRect(c, x - w / 2 + 2, y - h / 2 + 2, w * .35, h - 4, S * .02); c.fill();
    c.fillStyle = '#CFC8DD';
    c.fillRect(x - w * .28, y - h / 2 - S * .1, S * .028, S * .1);
    c.fillRect(x + w * .28 - S * .028, y - h / 2 - S * .1, S * .028, S * .1);
  }
  function drawShadow(c) {
    const g = oct.ground;
    if (!g || oct.scale < .3 || oct.x < g.x1 - S * .3 || oct.x > g.x2 + S * .3) return;
    const h = g.y - oct.y - oct.ride * S, a = clamp(1 - h / (S * 3), 0, 1) * .42 * (1 - oct.camo) * oct.alpha;
    if (a < .02) return;
    const R = S * (.95 + Math.max(0, h) / (S * 5));
    c.save(); c.translate(oct.x, g.y + 1); c.scale(1, .16);
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, `rgba(6,2,18,${a})`); gr.addColorStop(1, 'rgba(6,2,18,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); c.restore();
  }
  const inFront = a => a.reach && a.reach.front && a.reach.w > .15;
  function drawOcto(c) {
    const skin = oct.skinNow, bodyA = oct.alpha * (1 - oct.camo * (oct.eyeCamo ? 1 : .96));
    drawShadow(c);
    c.save(); c.globalAlpha = bodyA; drawGlow(c); c.restore();
    c.save(); c.globalAlpha = bodyA;
    for (const a of oct.arms) if (a.back && !inFront(a)) drawArm(c, a, shade(skin, -.34), false);
    for (const a of oct.arms) if (!a.back && !inFront(a)) drawArm(c, a, shade(skin, -.12), true);
    drawWeb(c, skin);
    c.save(); bodyXform(c); drawMantle(c, skin); c.restore();
    c.restore();
    if (oct.camo > .5 && !oct.eyeCamo) { c.save(); c.globalAlpha = (oct.camo - .5) * .14 * oct.alpha; bodyXform(c); mantlePath(c); c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); c.restore(); }
    // eyes don't camouflage, so open eyes give her away; closed ones vanish with the skin
    const e = oct.eyes, open = e.open * (1 - (e.blink > 0 ? Math.sin(Math.PI * (1 - e.blink / .17)) : 0));
    const eyeA = oct.alpha * (oct.eyeCamo ? 1 - oct.camo : 1 - oct.camo * clamp(1 - open, 0, 1));
    if (eyeA > .01) { c.save(); c.globalAlpha = eyeA; bodyXform(c); drawFace(c); c.restore(); }
    c.save(); c.globalAlpha = bodyA;
    for (const a of oct.arms) if (inFront(a)) drawArm(c, a, shade(skin, -.08), true);
    c.restore();
    for (const pr of oct.props) if (pr.type === 'plug') drawPlug(c, oct.arms[pr.arm]);
  }

  // ---------- thoughts and dreams: pictures only, she never talks ----------
  const thought = { on: false, t: 0, max: 0, icon: '', dream: '', fading: false, next: 0, swap: 0, dir: 1 };
  const DREAM_SEC = 6;
  function think(o, sec = 3.2) {
    if (!CFG.thoughts || !oct.on) return;
    Object.assign(thought, { on: true, t: 0, max: sec, icon: o.icon || '', dream: o.dream ? pickDream() : '', fading: false, next: clock + DREAM_SEC, swap: clock, dir: oct.x > VW * .62 ? -1 : 1 });
  }
  // soft: the cloud fades out instead of popping
  function unthink(soft) {
    if (soft && thought.on) { if (!thought.fading) { thought.fading = true; thought.max = thought.dream ? thought.t + .4 : Math.min(thought.max, thought.t + .4); } return; }
    thought.on = false; thought.dream = ''; thought.fading = false;
  }
  function thoughtTick(dt) {
    if (!thought.on) return;
    thought.t += dt;
    if (thought.dream && !thought.fading) {
      if (state !== 'sleep') unthink(true);
      else if (clock > thought.next) { thought.dream = pickDream(thought.dream); thought.next = clock + DREAM_SEC; thought.swap = clock; }
    }
    if ((!thought.dream || thought.fading) && thought.t > thought.max) unthink();
  }
  const THINK = {
    pogodna: ['planeta', 'galaktyka', 'nuta', 'serce', 'atom', 'ryba'],
    ciekawska: ['siec', 'atom', 'zarowka', 'pytanie', 'planeta', 'galaktyka'],
    marudna: ['burza', 'kawa', 'nie', 'zegar', 'siec'],
    zaspana: ['kawa', 'bateria', 'planeta', 'galaktyka', 'ryba'],
  };
  // what she dreams about is what she is into: minds, machines that learn, the universe
  const DREAM = {
    pogodna: ['galaktyka', 'konstelacja', 'orbity', 'lustro', 'siec'],
    ciekawska: ['siec', 'uwaga', 'lustro', 'czarna', 'galaktyka'],
    marudna: ['czarna', 'orbity', 'siec', 'uwaga'],
    zaspana: ['galaktyka', 'orbity', 'konstelacja', 'lustro'],
  };
  function pickThought() {
    const minutes = (clock - D.start) / 60;
    if (mood.annoyance > .45) return { icon: 'burza' };
    if (mood.boredom > .45 || (CFG.mode === 'lecture' && minutes > 45 && chance(.4))) return { icon: pick(['kawa', 'zegar', 'bateria']) };
    if (mood.joy > .55) return { icon: pick(['serce', 'nuta', 'galaktyka']) };
    const pool = THINK[temper].filter(i => i !== thought.icon);
    return { icon: pick(pool.length ? pool : THINK[temper]) };
  }
  function pickDream(not) {
    const pool = DREAM[temper], ok = pool.filter(d => d !== not);
    return pick(ok.length ? ok : pool);
  }
  function neon(c, col, w, a = 1) {
    c.strokeStyle = rgba(col, a); c.fillStyle = rgba(col, a); c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.shadowColor = rgba(col, .85 * a); c.shadowBlur = w * 2.6 * DPR;
  }
  // a tiny line-art octopus for the dreams: head, an eye, four wavy arms
  function miniOcto(c, x, y, s, dir, t, col) {
    neon(c, col, s * .09);
    c.beginPath(); c.ellipse(x, y - s * .35, s * .32, s * .38, 0, 0, TAU); c.stroke();
    c.beginPath(); c.arc(x + dir * s * .12, y - s * .3, s * .055, 0, TAU); c.fill();
    for (let k = 0; k < 4; k++) {
      const x0 = x + (k - 1.5) * s * .15;
      c.beginPath(); c.moveTo(x0, y);
      for (let i = 1; i <= 6; i++) { const v = i / 6; c.lineTo(x0 + (k - 1.5) * s * .12 * v + Math.sin(t * 3 + k + v * 4) * s * .06, y + v * s * .55); }
      c.stroke();
    }
  }
  const ICONS = {
    ryba(c, u) {
      neon(c, GLOW, u * .06);
      c.beginPath(); c.ellipse(-.06 * u, 0, .34 * u, .21 * u, 0, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(.27 * u, 0); c.lineTo(.48 * u, -.16 * u); c.lineTo(.48 * u, .16 * u); c.closePath(); c.stroke();
      c.beginPath(); c.arc(-.22 * u, -.05 * u, .035 * u, 0, TAU); c.fill();
    },
    serce(c, u, t) { neon(c, PINK, u * .05); heart(c, 0, .16 * u, .68 * u * (1 + .06 * Math.sin(t * 6))); c.fill(); },
    zarowka(c, u) {
      neon(c, GOLD, u * .055);
      c.beginPath(); c.arc(0, -.08 * u, .2 * u, Math.PI * .8, Math.PI * 2.2); c.lineTo(.08 * u, .16 * u); c.lineTo(-.08 * u, .16 * u); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-.07 * u, .23 * u); c.lineTo(.07 * u, .23 * u); c.stroke();
      for (const a of [-2.6, -2.1, -1.57, -1.04, -.54]) { c.beginPath(); c.moveTo(Math.cos(a) * .28 * u, -.08 * u + Math.sin(a) * .28 * u); c.lineTo(Math.cos(a) * .37 * u, -.08 * u + Math.sin(a) * .37 * u); c.stroke(); }
    },
    kawa(c, u, t) {
      neon(c, GLOW, u * .055);
      roundRect(c, -.24 * u, -.02 * u, .38 * u, .3 * u, .06 * u); c.stroke();
      c.beginPath(); c.arc(.17 * u, .12 * u, .08 * u, -Math.PI / 2, Math.PI / 2); c.stroke();
      for (const k of [-1, 1]) { c.beginPath(); for (let i = 0; i <= 7; i++) { const y = -.08 * u - i * .035 * u, x = k * .06 * u - .05 * u + Math.sin(t * 4 + i * .8 + k) * .03 * u; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    },
    zegar(c, u, t) {
      neon(c, GLOW, u * .055);
      c.beginPath(); c.arc(0, 0, .28 * u, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -.16 * u); c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(t * 2) * .22 * u, Math.sin(t * 2) * .22 * u); c.stroke();
    },
    burza(c, u, t) {
      neon(c, DIM, u * .05);
      c.beginPath(); c.arc(-.14 * u, -.04 * u, .13 * u, Math.PI * .5, Math.PI * 1.6); c.arc(.02 * u, -.12 * u, .16 * u, Math.PI * 1.1, Math.PI * 1.95); c.arc(.17 * u, -.02 * u, .12 * u, Math.PI * 1.5, Math.PI * .5); c.closePath(); c.stroke();
      if (Math.sin(t * 9) > -.35) { neon(c, GOLD, u * .06); c.beginPath(); c.moveTo(.03 * u, .12 * u); c.lineTo(-.06 * u, .26 * u); c.lineTo(.05 * u, .26 * u); c.lineTo(-.05 * u, .4 * u); c.stroke(); }
    },
    nie(c, u) { neon(c, RED, u * .06); c.beginPath(); c.arc(0, 0, .26 * u, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(-.18 * u, .18 * u); c.lineTo(.18 * u, -.18 * u); c.stroke(); },
    bateria(c, u, t) {
      neon(c, GLOW, u * .05);
      roundRect(c, -.28 * u, -.14 * u, .5 * u, .28 * u, .05 * u); c.stroke(); c.fillRect(.23 * u, -.06 * u, .05 * u, .12 * u);
      if (Math.sin(t * 5) > 0) { neon(c, RED, u * .05); c.fillRect(-.22 * u, -.08 * u, .08 * u, .16 * u); }
    },
    nuta(c, u, t) {
      neon(c, PINK, u * .055); c.save(); c.rotate(Math.sin(t * 3) * .15);
      c.beginPath(); c.ellipse(-.08 * u, .16 * u, .1 * u, .075 * u, -.4, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(.01 * u, .14 * u); c.lineTo(.01 * u, -.22 * u); c.quadraticCurveTo(.2 * u, -.16 * u, .18 * u, -.02 * u); c.stroke();
      c.restore();
    },
    pytanie(c, u, t) {
      neon(c, GLOW, u * .07); c.save(); c.rotate(Math.sin(t * 2) * .08);
      c.beginPath(); c.arc(0, -.13 * u, .15 * u, Math.PI * 1.08, Math.PI * 2.35); c.quadraticCurveTo(0, .02 * u, 0, .1 * u); c.stroke();
      c.beginPath(); c.arc(0, .25 * u, .045 * u, 0, TAU); c.fill();
      c.restore();
    },
    planeta(c, u) {
      const tilt = -.35;
      neon(c, GOLD, u * .045); c.beginPath(); c.ellipse(0, 0, .42 * u, .12 * u, tilt, Math.PI, TAU); c.stroke();
      neon(c, GLOW, u * .05); c.fillStyle = 'rgb(22,10,50)'; c.beginPath(); c.arc(0, 0, .21 * u, 0, TAU); c.fill(); c.stroke();
      c.save(); c.clip(); c.shadowBlur = 0; c.strokeStyle = rgba(GLOW, .45); c.lineWidth = u * .03;
      for (const y of [-.08, .06]) { c.beginPath(); c.moveTo(-.25 * u, (y + .06) * u); c.lineTo(.25 * u, (y - .06) * u); c.stroke(); }
      c.restore();
      neon(c, GOLD, u * .045); c.beginPath(); c.ellipse(0, 0, .42 * u, .12 * u, tilt, 0, Math.PI); c.stroke();
    },
    atom(c, u, t) {
      neon(c, GLOW, u * .035);
      for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(0, 0, .4 * u, .14 * u, k * Math.PI / 3, 0, TAU); c.stroke(); }
      neon(c, PINK, u * .04); c.beginPath(); c.arc(0, 0, .07 * u, 0, TAU); c.fill();
      neon(c, [235, 250, 255], u * .03);
      for (let k = 0; k < 3; k++) {
        const a = t * (2.2 + k * .4) + k * 2, rot = k * Math.PI / 3, ex = Math.cos(a) * .4 * u, ey = Math.sin(a) * .14 * u;
        c.beginPath(); c.arc(ex * Math.cos(rot) - ey * Math.sin(rot), ex * Math.sin(rot) + ey * Math.cos(rot), .035 * u, 0, TAU); c.fill();
      }
    },
    siec(c, u, t) {
      const L = [[-.32, 3], [0, 2], [.32, 3]], lit = Math.floor(t * 1.5) % 3;
      const P = (l, j) => [L[l][0] * u, (j - (L[l][1] - 1) / 2) * .22 * u];
      neon(c, DIM, u * .025);
      for (let l = 0; l < 2; l++) for (let i = 0; i < L[l][1]; i++) for (let j = 0; j < L[l + 1][1]; j++) { const a = P(l, i), b = P(l + 1, j); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      for (let l = 0; l < 3; l++) for (let i = 0; i < L[l][1]; i++) {
        const p = P(l, i), on = l === lit;
        c.shadowBlur = 0; c.fillStyle = 'rgb(22,10,50)'; c.beginPath(); c.arc(p[0], p[1], .06 * u, 0, TAU); c.fill();
        neon(c, on ? GLOW : DIM, u * .035); c.stroke(); if (on) c.fill();
      }
    },
    galaktyka(c, u, t) {
      const ct = Math.cos(-.35), st = Math.sin(-.35);
      for (let arm = 0; arm < 2; arm++) {
        neon(c, arm ? PINK : GLOW, u * .045); c.beginPath();
        for (let i = 0; i <= 24; i++) {
          const s = i / 24, a = t * .6 + arm * Math.PI + s * 3.4, rr = (.05 + s * .36) * u, x = Math.cos(a) * rr, y = Math.sin(a) * rr * .55;
          i ? c.lineTo(x * ct - y * st, x * st + y * ct) : c.moveTo(x * ct - y * st, x * st + y * ct);
        }
        c.stroke();
      }
      neon(c, GOLD, u * .05); c.beginPath(); c.arc(0, 0, .065 * u, 0, TAU); c.fill();
    },
    // "you again": the same faces, coming round again
    znowu(c, u, t) {
      neon(c, GLOW, u * .055);
      c.save(); c.rotate(t * 1.2);
      const R0 = .27 * u, a = Math.PI * 1.25, ex = Math.cos(a) * R0, ey = Math.sin(a) * R0, tx = -Math.sin(a), ty = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a), h = .13 * u;
      c.beginPath(); c.arc(0, 0, R0, -Math.PI * .35, a); c.stroke();
      c.beginPath(); c.moveTo(ex + tx * h * .6, ey + ty * h * .6); c.lineTo(ex - tx * h * .5 + nx * h * .55, ey - ty * h * .5 + ny * h * .55); c.lineTo(ex - tx * h * .5 - nx * h * .55, ey - ty * h * .5 - ny * h * .55); c.closePath(); c.fill();
      c.restore();
      neon(c, PINK, u * .03);
      for (const [x, y] of [[-.1, .04], [0, -.02], [.1, .04]]) {
        c.beginPath(); c.arc(x * u, (y - .04) * u, .035 * u, 0, TAU); c.stroke();
        c.beginPath(); c.arc(x * u, (y + .07) * u, .06 * u, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      }
    },
  };
  // dreams get their own scene each; t is the time since the scene started
  const DREAMS = {
    siec(c, u, t) {
      // a small neural network with activity rippling from input to output
      const L = [3, 4, 4, 2], X = [-.6, -.2, .2, .6], act = ((t * .6) % 1) * 4.6 - .3;
      const P = (l, j) => [X[l] * u, (j - (L[l] - 1) / 2) * .22 * u];
      for (let l = 0; l < 3; l++) {
        const b = Math.exp(-Math.pow(l + .5 - act, 2) * 5);
        neon(c, mix(DIM, PINK, b), u * (.012 + .016 * b), .45 + .55 * b);
        for (let i = 0; i < L[l]; i++) for (let j = 0; j < L[l + 1]; j++) { const a = P(l, i), q = P(l + 1, j); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(q[0], q[1]); c.stroke(); }
      }
      for (let l = 0; l < 4; l++) {
        const b = Math.exp(-Math.pow(l - act, 2) * 5);
        for (let j = 0; j < L[l]; j++) {
          const p = P(l, j);
          c.shadowBlur = 0; c.fillStyle = '#0D0828'; c.beginPath(); c.arc(p[0], p[1], .055 * u, 0, TAU); c.fill();
          neon(c, mix(DIM, GLOW, b), u * .025); c.stroke();
          if (b > .05) { neon(c, GLOW, u * .02, b); c.beginPath(); c.arc(p[0], p[1], .035 * u, 0, TAU); c.fill(); }
        }
      }
    },
    galaktyka(c, u, t) {
      // a spiral galaxy seen at an angle, turning slowly
      c.shadowBlur = 0;
      const core = c.createRadialGradient(0, 0, 0, 0, 0, .3 * u);
      core.addColorStop(0, 'rgba(255,246,220,.95)'); core.addColorStop(.25, rgba(GOLD, .55)); core.addColorStop(1, rgba(PINK, 0));
      c.fillStyle = core; c.beginPath(); c.arc(0, 0, .3 * u, 0, TAU); c.fill();
      const ct = Math.cos(-.35), st = Math.sin(-.35);
      for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 64; i++) {
        const s = i / 63, a = t * .35 + arm * Math.PI + s * 3.6 + Math.sin(i * 7.3 + arm) * .14, rr = (.06 + s * .62 + Math.sin(i * 3.7) * .02) * u;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr * .5;
        c.fillStyle = rgba(mix(GLOW, PINK, s), (1 - s * .5) * .95);
        c.beginPath(); c.arc(x * ct - y * st, x * st + y * ct, (1 - s * .5) * .032 * u, 0, TAU); c.fill();
      }
    },
    orbity(c, u, t) {
      // a ringed planet with two moons on tilted orbits
      const ct = Math.cos(-.12), st = Math.sin(-.12);
      neon(c, DIM, u * .012, .7); c.setLineDash([u * .03, u * .04]);
      for (const [a, b] of [[.62, .2], [.42, .13]]) { c.beginPath(); c.ellipse(0, 0, a * u, b * u, -.12, 0, TAU); c.stroke(); }
      c.setLineDash([]);
      const ms = [[.62, .2, .5, 0, GLOW, .045], [.42, .13, .9, 2, PINK, .032]].map(([R1, R2, sp, ph, col, r]) => {
        const a = t * sp + ph, x = Math.cos(a) * R1 * u, y = Math.sin(a) * R2 * u;
        return { x: x * ct - y * st, y: x * st + y * ct, front: Math.sin(a) > 0, col, r };
      });
      const moon = m => { neon(c, m.col, u * .02); c.beginPath(); c.arc(m.x, m.y, m.r * u, 0, TAU); c.fill(); };
      for (const m of ms) if (!m.front) moon(m);
      neon(c, GOLD, u * .03); c.beginPath(); c.ellipse(0, 0, .3 * u, .08 * u, -.3, Math.PI, TAU); c.stroke();
      c.shadowBlur = 0;
      const pg = c.createRadialGradient(-.06 * u, -.07 * u, .02 * u, 0, 0, .17 * u);
      pg.addColorStop(0, '#C9B6FF'); pg.addColorStop(.55, rgba(SKIN0)); pg.addColorStop(1, '#2A1260');
      c.fillStyle = pg; c.beginPath(); c.arc(0, 0, .17 * u, 0, TAU); c.fill();
      neon(c, GOLD, u * .03); c.beginPath(); c.ellipse(0, 0, .3 * u, .08 * u, -.3, 0, Math.PI); c.stroke();
      for (const m of ms) if (m.front) moon(m);
    },
    lustro(c, u, t) {
      // the mirror test, the classic check for self-awareness: she looks in and knows who it is
      const fx = .06 * u, fy = -.36 * u, fw = .36 * u, fh = .66 * u, bob = Math.sin(t * 1.6) * .03 * u, tl = Math.sin(t * 1.1) * .12;
      c.save(); c.translate(-.32 * u, .14 * u + bob); c.rotate(tl); miniOcto(c, 0, 0, .34 * u, 1, t, GLOW); c.restore();
      c.save(); c.shadowBlur = 0;
      const gl = c.createLinearGradient(fx, fy, fx + fw, fy + fh);
      gl.addColorStop(0, 'rgba(150,180,255,.22)'); gl.addColorStop(1, 'rgba(60,40,140,.12)');
      c.fillStyle = gl; roundRect(c, fx, fy, fw, fh, .05 * u); c.fill(); c.clip();
      c.globalAlpha *= .65; c.translate(fx + fw / 2, .14 * u + bob); c.scale(-1, 1); c.rotate(tl); miniOcto(c, 0, 0, .3 * u, 1, t, [170, 200, 255]);
      c.restore();
      neon(c, GOLD, u * .025); roundRect(c, fx, fy, fw, fh, .05 * u); c.stroke();
      const k = t % 4;
      if (k > 2.6) { const s = Math.sin((k - 2.6) / 1.4 * Math.PI); neon(c, GOLD, 1); star4(c, -.2 * u, -.36 * u, .09 * u * s, t); c.fill(); star4(c, -.06 * u, -.48 * u, .05 * u * s, -t); c.fill(); }
    },
    konstelacja(c, u, t) {
      // her own constellation, joined star by star
      const P = [[0, -.42], [-.2, -.3], [.2, -.3], [-.15, -.08], [.15, -.08], [-.38, .1], [-.52, .32], [-.13, .26], [.13, .26], [.38, .1], [.5, .33], [-.24, .44], [.25, .45]];
      const E = [[1, 0], [0, 2], [1, 3], [2, 4], [3, 4], [3, 5], [5, 6], [3, 7], [7, 11], [4, 8], [8, 12], [4, 9], [9, 10]];
      const n = Math.min(E.length, t * 3);
      neon(c, [200, 215, 255], u * .014, .75);
      for (let i = 0; i < Math.ceil(n); i++) {
        const [a, b] = E[i], f = Math.min(1, n - i), A = P[a], Bp = P[b];
        c.beginPath(); c.moveTo(A[0] * u, A[1] * u); c.lineTo(lerp(A[0], Bp[0], f) * u, lerp(A[1], Bp[1], f) * u); c.stroke();
      }
      P.forEach(([x, y], i) => {
        const tw = .6 + .4 * Math.sin(t * 3 + i * 1.7);
        neon(c, i < 5 ? GOLD : [235, 240, 255], u * .02, tw);
        star4(c, x * u, y * u, (.045 + (i === 0 ? .02 : 0)) * u * tw, t * .3 + i); c.fill();
      });
    },
    uwaga(c, u, t) {
      // attention: one token looks back at the others; the thicker the arc, the more it attends
      const n = 5, q = Math.floor(t * .6) % n, X = j => (-.5 + j * .25) * u, y = .18 * u, ph = clamp((t * .6 % 1) * 2.5, 0, 1);
      const r = seeded(q * 7919 + 104729), w = Array.from({ length: n }, (_, j) => (j === q ? 0 : .15 + r()));
      const sum = w.reduce((s, x) => s + x, 0);
      for (let j = 0; j < n; j++) {
        if (j === q) continue;
        const k = w[j] / sum, x0 = X(q), x1 = X(j), h = (.14 + Math.abs(j - q) * .1) * u;
        neon(c, PINK, u * (.008 + k * .07), Math.min(1, (.25 + k * 1.5) * ph));
        c.beginPath(); c.moveTo(x0, y - .06 * u); c.quadraticCurveTo((x0 + x1) / 2, y - .06 * u - h * 2, x1, y - .06 * u); c.stroke();
      }
      for (let j = 0; j < n; j++) {
        const on = j === q;
        c.shadowBlur = 0; c.fillStyle = '#0D0828'; roundRect(c, X(j) - .09 * u, y - .055 * u, .18 * u, .12 * u, .03 * u); c.fill();
        neon(c, on ? GLOW : DIM, u * .022); c.stroke();
        neon(c, on ? GLOW : DIM, u * .016, on ? 1 : .7);
        c.beginPath(); c.moveTo(X(j) - .045 * u, y - .01 * u); c.lineTo(X(j) + .045 * u, y - .01 * u);
        c.moveTo(X(j) - .045 * u, y + .025 * u); c.lineTo(X(j) + (.01 + (j * 37 % 3) * .015) * u, y + .025 * u); c.stroke();
      }
    },
    czarna(c, u, t) {
      // a black hole: the far side of the disc bends up over the shadow, the near side passes in front
      const rot = -.12, disk = front => {
        for (let k = 0; k < 4; k++) {
          const rx = (.36 + k * .09) * u;
          neon(c, mix(GOLD, PINK, k / 3), u * (.03 - k * .005), .9 - k * .15);
          c.setLineDash([u * (.06 + k * .02), u * .035]); c.lineDashOffset = -t * u * (.5 - k * .08);
          c.beginPath(); c.ellipse(0, 0, rx, rx * .26, rot, front ? 0 : Math.PI, front ? Math.PI : TAU); c.stroke();
        }
        c.setLineDash([]);
      };
      disk(false);
      neon(c, GOLD, u * .025, .8); c.beginPath(); c.ellipse(0, -.02 * u, .25 * u, .2 * u, rot, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.shadowBlur = 0; c.fillStyle = '#000'; c.beginPath(); c.arc(0, 0, .17 * u, 0, TAU); c.fill();
      neon(c, [235, 245, 255], u * .014); c.beginPath(); c.arc(0, 0, .185 * u, 0, TAU); c.stroke();
      disk(true);
    },
  };
  const DSTARS = (() => { const r = seeded(5), out = []; while (out.length < 36) { const x = r() * 2 - 1, y = r() * 2 - 1; if (x * x + y * y < .92) out.push({ x, y, s: .4 + r() * .8, ph: r() * TAU }); } return out; })();
  const CLOUD = [[0, 0, 1], [-.62, .14, .7], [.62, .12, .72], [-.3, -.42, .64], [.32, -.4, .66], [0, .4, .62]];
  function cloudPath(c, R, grow = 0) { c.beginPath(); for (const [x, y, r] of CLOUD) { c.moveTo(x * R + r * R + grow, y * R); c.arc(x * R, y * R, r * R + grow, 0, TAU); } }
  // trail bubbles: a thought gets small neon puffs, a dream hollow bubbles that wobble
  function puff(c, x, y, r, dream, ph = 0) {
    if (dream) {
      const w = 1 + .1 * Math.sin(clock * 2.6 + ph * 7);
      c.save(); c.shadowColor = 'rgba(110,150,255,.9)'; c.shadowBlur = S * .08 * DPR;
      c.fillStyle = 'rgba(16,12,52,.55)'; c.beginPath(); c.ellipse(x, y, r * w, r / w, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(175,195,255,.9)'; c.lineWidth = Math.max(1, r * .2); c.stroke();
      c.restore();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x - r * .35, y - r * .35, r * .18, 0, TAU); c.fill();
      return;
    }
    c.save(); c.shadowColor = rgba(NEON, .9); c.shadowBlur = S * .1 * DPR; c.fillStyle = rgba(mix(NEON, GLOW, .35));
    c.beginPath(); c.arc(x, y, r + 1.5, 0, TAU); c.fill(); c.restore();
    c.fillStyle = 'rgba(22,10,50,.95)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function drawThought(c) {
    if (!thought.on || !oct.on || oct.scale < .3) return;
    const t = thought.t, dream = !!thought.dream, inn = clamp(t / (dream ? .6 : .32), 0, 1);
    const out = dream && !thought.fading ? 1 : clamp((thought.max - t) / .35, 0, 1);
    const a = Math.min(inn, out) * oct.alpha * (1 - oct.camo * .8);
    if (a < .01) return;
    const R = S * .5, dir = thought.dir, head = toWorld(dir * .28 * S, -.98 * S);
    const cx = clamp(oct.x + dir * (dream ? 1.25 : 1.15) * S, R * 1.9, VW - R * 1.9);
    const cy = clamp(oct.y - (dream ? 1.72 : 1.62) * S * oct.scale, R * 1.5, VH - R * 1.4) + Math.sin(clock * (dream ? 1.1 : 1.7)) * S * .03;
    c.save(); c.globalAlpha = a;
    for (const [u, r] of [[.3, .05], [.58, .08]]) if (inn > u * .8 || dream) puff(c, lerp(head.x, cx, u), lerp(head.y, cy + R * .6, u), r * S, dream, u);
    c.translate(cx, cy);
    if (dream) {
      // a dream looks nothing like a thought: a smooth oval of night sky, stars and a slow dashed halo
      const sc = (.4 + .6 * smooth(inn)) * (1 + .025 * Math.sin(clock * 1.6)), rx = R * 1.32, ry = R * 1.04;
      c.scale(sc, sc);
      c.save(); c.shadowColor = 'rgba(110,150,255,.9)'; c.shadowBlur = S * .22 * DPR; c.fillStyle = 'rgba(110,150,255,.5)';
      c.beginPath(); c.ellipse(0, 0, rx + 2, ry + 2, 0, 0, TAU); c.fill(); c.restore();
      const sky = c.createRadialGradient(-rx * .25, -ry * .35, 0, 0, 0, rx * 1.05);
      sky.addColorStop(0, '#2A1B6B'); sky.addColorStop(1, '#0B0724');
      c.fillStyle = sky; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill();
      c.save(); c.clip();
      for (const s of DSTARS) { c.fillStyle = `rgba(225,232,255,${.28 + .36 * Math.sin(clock * 2 + s.ph)})`; c.beginPath(); c.arc(s.x * rx, s.y * ry, s.s * S * .012, 0, TAU); c.fill(); }
      const dt0 = clock - thought.swap;
      c.globalAlpha = a * Math.min(clamp(dt0 / .6, 0, 1), thought.fading ? 1 : clamp((thought.next - clock) / .5, 0, 1));
      DREAMS[thought.dream](c, R * 1.4, dt0);
      c.restore();
      c.save(); c.setLineDash([S * .03, S * .05]); c.lineDashOffset = -clock * S * .06;
      c.strokeStyle = 'rgba(175,195,255,.85)'; c.lineWidth = Math.max(1, S * .014);
      c.beginPath(); c.ellipse(0, 0, rx + S * .05, ry + S * .05, 0, 0, TAU); c.stroke(); c.restore();
    } else {
      const sc = .3 + .7 * easeOutBack(inn); c.scale(sc, sc);
      c.save(); c.shadowColor = rgba(NEON, .9); c.shadowBlur = S * .16 * DPR; c.fillStyle = rgba(mix(NEON, GLOW, .35)); cloudPath(c, R, 2); c.fill(); c.restore();
      c.fillStyle = 'rgba(22,10,50,.95)'; cloudPath(c, R); c.fill();
      c.save(); cloudPath(c, R); c.clip();
      if (ICONS[thought.icon]) ICONS[thought.icon](c, R * 1.45, clock);
      c.restore();
    }
    c.restore();
  }

  // ---------- effects ----------
  const fx = { p: [], ghosts: [], emotes: [], rings: [], dim: null, ink: [21, 11, 44], inkEdge: null };
  function inkFor(bg) {
    const lum = (.2126 * bg[0] + .7152 * bg[1] + .0722 * bg[2]) / 255;
    // ink has to read against the slide: near-black on light slides, dusky violet smoke on dark ones
    fx.ink = lum < .25 ? mix(bg, [92, 70, 140], .55) : [21, 11, 44];
    fx.inkEdge = lum < .25 ? [150, 120, 210] : null;
  }
  function inkCloud(x, y, n, dx = 0, dy = 0) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(20, 150);
      fx.p.push({ k: 'ink', x: x + rand(-.2, .2) * S, y: y + rand(-.2, .2) * S, vx: Math.cos(a) * sp + dx * rand(60, 240), vy: Math.sin(a) * sp + dy * rand(60, 240), r: rand(.07, .18) * S, gr: rand(.2, .5) * S, life: 0, max: rand(1.6, 3.2), drag: 2.4 });
    }
  }
  function squirt(x, y, tx, ty) {
    const a = Math.atan2(ty - y, tx - x);
    for (let i = 0; i < 40; i++) {
      const sp = rand(.9, 1.4) * VH * 1.4, b = a + rand(-.07, .07);
      fx.p.push({ k: 'drop', x, y, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp, r: rand(.012, .03) * S, life: 0, max: 1.2, delay: i * .011, drag: .4, g: VH * .5 });
    }
  }
  function sparkle(x, y, n) {
    for (let i = 0; i < n; i++) fx.p.push({ k: 'spark', x: x + rand(-.6, .6) * S, y: y + rand(-.3, .3) * S, vx: rand(-40, 40), vy: rand(-140, -50), r: rand(.03, .06) * S, life: 0, max: rand(.8, 1.4), drag: 1.5, rot: rand(0, TAU), col: chance(.5) ? PINK : GLOW });
  }
  function ring(x, y) { fx.rings.push({ x, y, t: 0 }); }
  function emote(sym, sec = 1.3) { fx.emotes.push({ sym, t: 0, max: sec, x: oct.x, y: oct.y, dx: sym === 'z' ? rand(-.15, .25) * S : 0 }); }
  function ghost() {
    fx.ghosts.push({
      t: 0, max: 3.4, x: oct.x, y: oct.y, ang: oct.ang, q: oct.q, scale: oct.scale, warp: Object.assign({}, WP),
      arms: oct.arms.map(a => ({ w0: a.w0, pts: a.p.map(q => ({ x: q.x, y: q.y })) })),
    });
  }
  function fxUpdate(dt) {
    for (let i = fx.p.length - 1; i >= 0; i--) {
      const p = fx.p[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life += dt;
      if (p.life >= p.max) { fx.p.splice(i, 1); continue; }
      const dr = Math.exp(-(p.drag || 2) * dt); p.vx *= dr; p.vy *= dr; p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.gr) p.r += p.gr * dt;
    }
    for (let i = fx.ghosts.length - 1; i >= 0; i--) {
      const g = fx.ghosts[i]; g.t += dt;
      if (g.t > g.max) { fx.ghosts.splice(i, 1); continue; }
      if (chance(dt * 9)) { const pts = pick(g.arms).pts, q = pts[(Math.random() * N) | 0]; inkCloud(q.x, q.y, 1); }
    }
    for (let i = fx.emotes.length - 1; i >= 0; i--) { const e = fx.emotes[i]; e.t += dt; if (oct.on) { e.x = oct.x; e.y = oct.y; } if (e.t > e.max) fx.emotes.splice(i, 1); }
    for (let i = fx.rings.length - 1; i >= 0; i--) { fx.rings[i].t += dt; if (fx.rings[i].t > .6) fx.rings.splice(i, 1); }
    if (fx.dim) {
      fx.dim.t += dt;
      const D2 = [[0, 0], [.08, .82], [.16, .3], [.24, .9], [.5, .75], [1.1, 0]];
      let o = 0; for (let k = 1; k < D2.length; k++) if (fx.dim.t <= D2[k][0]) { o = lerp(D2[k - 1][1], D2[k][1], (fx.dim.t - D2[k - 1][0]) / (D2[k][0] - D2[k - 1][0])); break; }
      dimEl.style.opacity = o;
      if (fx.dim.t > 1.1) { fx.dim = null; dimEl.style.opacity = 0; }
    }
    thoughtTick(dt);
  }
  function drawGhost(c, g) {
    const k = Math.pow(1 - g.t / g.max, 1.3) * .9, grow = 1 + g.t / g.max * .25;
    c.save(); c.globalAlpha = k; c.fillStyle = rgba(fx.ink); c.shadowColor = fx.inkEdge ? rgba(fx.inkEdge, .55) : 'rgba(10,4,26,.9)'; c.shadowBlur = S * .14 * (1 + g.t) * DPR;
    c.translate(g.x, g.y - S * .4); c.scale(grow, grow); c.translate(-g.x, -g.y + S * .4);
    for (const a of g.arms) { armOutline(c, a.pts, a.w0 * S * g.scale, .018 * S * g.scale); c.fill(); }
    const saved = Object.assign({}, WP); Object.assign(WP, g.warp);
    c.translate(g.x, g.y); c.rotate(g.ang); c.scale((1 - .5 * g.q) * g.scale, (1 + g.q) * g.scale);
    mantlePath(c); c.fill();
    Object.assign(WP, saved);
    c.restore();
  }
  function star4(c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rr = i % 2 ? r * .32 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }
  function heart(c, x, y, s) {
    c.beginPath(); c.moveTo(x, y + s * .35);
    c.bezierCurveTo(x - s * .9, y - s * .25, x - s * .45, y - s * .95, x, y - s * .45);
    c.bezierCurveTo(x + s * .45, y - s * .95, x + s * .9, y - s * .25, x, y + s * .35);
    c.closePath();
  }
  function drawEmote(c, e) {
    const u = e.t / e.max, pop = u < .12 ? u / .12 * 1.15 : u < .2 ? 1.15 - (u - .12) / .08 * .15 : 1;
    if (e.sym === 'halo') { // "who, me?": a halo settles over her head and stays put
      const sc = oct.on ? oct.scale : 1, hy = e.y - S * 1.15 * sc + Math.sin(e.t * 3) * S * .02;
      c.save(); c.globalAlpha = Math.min(1, u / .15) * (u > .8 ? (1 - u) / .2 : 1);
      neon(c, GOLD, S * .03); c.beginPath(); c.ellipse(e.x + (oct.face || 0) * .1 * S, hy, S * .27 * sc, S * .07 * sc, 0, 0, TAU); c.stroke();
      c.restore();
      return;
    }
    const a = u > .7 ? 1 - (u - .7) / .3 : 1, s = S * .32 * pop;
    const x = e.x + (oct.face || 0) * .3 * S + e.dx + (e.sym === 'z' ? u * S * .3 : 0), y = e.y - S * 1.3 * (oct.on ? oct.scale : 1) - u * S * .3;
    c.save(); c.globalAlpha = a;
    if (e.sym === '♥') { heart(c, x, y, s * .9); c.fillStyle = '#FF5FA2'; c.fill(); c.lineWidth = S * .03; c.strokeStyle = '#2A0F2E'; c.stroke(); }
    else if (e.sym === 'anger') {
      c.strokeStyle = '#FF4D8D'; c.lineWidth = S * .04; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.arc(x + Math.cos(ang) * s * .42, y + Math.sin(ang) * s * .42, s * .28, ang + Math.PI * .65, ang + Math.PI * 1.35); c.stroke(); }
    } else {
      c.font = `800 ${e.sym === 'z' ? s * .8 : s}px system-ui, -apple-system, "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = S * .05; c.strokeStyle = '#1A0F33'; c.lineJoin = 'round'; c.strokeText(e.sym, x, y);
      c.fillStyle = '#F4F0FF'; c.fillText(e.sym, x, y);
    }
    c.restore();
  }
  function fxDrawBack(c) {
    for (const g of fx.ghosts) drawGhost(c, g);
    for (const p of fx.p) {
      if (p.k !== 'ink' || p.delay > 0) continue;
      const a = .55 * Math.pow(1 - p.life / p.max, 1.2), gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      gr.addColorStop(0, rgba(fx.ink, a)); gr.addColorStop(1, rgba(fx.ink, 0));
      c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
    }
  }
  function fxDrawFront(c) {
    for (const p of fx.p) {
      if (p.delay > 0 || p.k === 'ink') continue;
      const a = 1 - p.life / p.max;
      if (p.k === 'drop') { c.fillStyle = `rgba(190,245,255,${.85 * a})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
      else { c.fillStyle = rgba(p.col, a); star4(c, p.x, p.y, p.r, p.rot + p.life * 3); c.fill(); }
    }
    for (const r of fx.rings) { const u = r.t / .6; c.strokeStyle = rgba(GLOW, .8 * (1 - u)); c.lineWidth = 2; c.beginPath(); c.arc(r.x, r.y, S * (.08 + u * .5), 0, TAU); c.stroke(); }
    for (const e of fx.emotes) drawEmote(c, e);
    drawThought(c);
  }

  // ---------- letters ----------
  const Letters = {
    act: new Set(), all: new Set(),
    st(el) { return el._osm || (el._osm = { x: 0, y: 0, r: 0, s: 1, vx: 0, vy: 0, vr: 0, vs: 0, tx: 0, ty: 0, tr: 0, ts: 1, carry: null, ox: 0, oy: 0 }); },
    prep(el) {
      if (el._osmPrep) return;
      el._osmPrep = true;
      el.style.display = 'inline-block'; el.style.transformOrigin = '50% 78%';
      // background-clip:text does not reach a transformed child, so it gets its own aligned gradient
      let g = el.parentElement;
      while (g && g !== document.body) {
        const cs = getComputedStyle(g);
        if ((cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') && cs.backgroundImage !== 'none') break;
        g = g.parentElement;
      }
      if (g && g !== document.body) {
        const cs = getComputedStyle(g), rg = g.getBoundingClientRect(), rl = el.getBoundingClientRect();
        Object.assign(el.style, { backgroundImage: cs.backgroundImage, backgroundSize: `${rg.width}px ${rg.height}px`, backgroundPosition: `${rg.left - rl.left}px ${rg.top - rl.top}px`, backgroundRepeat: 'no-repeat', webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', webkitTextFillColor: 'transparent' });
      }
      this.all.add(el);
    },
    kick(el, o) { this.prep(el); const s = this.st(el); for (const k in o) { if (k[0] === 'v') s[k] += o[k]; else s[k] = o[k]; } this.act.add(el); },
    origin(el) { const tr = el.style.transform; el.style.transform = 'none'; const r = el.getBoundingClientRect(); el.style.transform = tr; return { x: r.left + r.width / 2, y: r.top + r.height * .78 }; },
    carry(el, fn) { this.prep(el); const s = this.st(el), o = this.origin(el); s.ox = o.x; s.oy = o.y; s.carry = fn; this.act.add(el); },
    drop(el, crooked) { const s = this.st(el); if (!s.carry) return; s.carry = null; s.tx = crooked ? rand(-3, 3) : 0; s.ty = 0; s.tr = crooked ? rand(-14, 14) : 0; this.act.add(el); },
    releaseAll() { for (const el of this.act) if (el._osm && el._osm.carry) this.drop(el, true); },
    fix(el) { const s = this.st(el); if (!this.crooked(el)) return; s.tx = s.ty = s.tr = 0; s.ts = 1; s.vr += (s.r > 0 ? -1 : 1) * 150; this.act.add(el); },
    fixAll() { for (const el of this.all) this.fix(el); },
    crooked(el) { const s = el._osm; return !!s && (Math.abs(s.tr) > 1.5 || Math.abs(s.ty) > 1 || Math.abs(s.tx) > 1); },
    update(dt) {
      for (const el of this.act) {
        if (!el.isConnected) { this.act.delete(el); continue; }
        const s = el._osm;
        if (s.carry) { const p = s.carry(); s.x = p.x - s.ox; s.y = p.y - s.oy; s.r = p.r; s.vx = s.vy = s.vr = 0; }
        else {
          s.vx += ((s.tx - s.x) * 190 - s.vx * 11) * dt; s.x += s.vx * dt;
          s.vy += ((s.ty - s.y) * 190 - s.vy * 11) * dt; s.y += s.vy * dt;
          s.vr += ((s.tr - s.r) * 150 - s.vr * 8.5) * dt; s.r += s.vr * dt;
          s.vs += ((s.ts - s.s) * 260 - s.vs * 12) * dt; s.s += s.vs * dt;
          const still = Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.vr) * .1 + Math.abs(s.vs) * 10 < .05;
          const there = Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) + Math.abs(s.tr - s.r) + Math.abs(s.ts - s.s) * 50 < .05;
          if (still && there) { s.x = s.tx; s.y = s.ty; s.r = s.tr; s.s = s.ts; this.act.delete(el); }
        }
        el.style.transform = `translate(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px) rotate(${s.r.toFixed(2)}deg) scale(${s.s.toFixed(3)})`;
        el.classList.toggle('osm-krzywa', this.crooked(el));
      }
    },
  };
  const WORD = /\p{L}{4,}/gu;
  const COUNTER = /[oaedbpqgOQDĄąęóÓ]/;
  const ROUND = /[oOcCsSeęéóÓ0QG]/;
  function wordsIn(el) {
    const out = [];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && !n.parentElement.closest('.osm-w,script,style,[data-osmiornica="nie"]') ? 1 : 2) });
    let n;
    while ((n = tw.nextNode())) { WORD.lastIndex = 0; let m; while ((m = WORD.exec(n.data))) out.push({ node: n, start: m.index, end: m.index + m[0].length, word: m[0] }); }
    return out;
  }
  function wrapWord(node, start, end) {
    node.splitText(end);
    const mid = node.splitText(start);
    const w = document.createElement('span');
    w.className = 'osm-w'; w.style.whiteSpace = 'nowrap';
    for (const ch of mid.data) { const s = document.createElement('span'); s.className = 'osm-l'; s.textContent = ch; w.appendChild(s); }
    mid.parentNode.replaceChild(w, mid);
    return [...w.children];
  }
  function knock(T, side) {
    const fs = T.fs, L = T.letter, i = T.letters.indexOf(L);
    Letters.kick(L, { vy: fs * 9 * mScale(), vr: side * 520 * mScale(), tx: side * fs * .03, ty: fs * .055, tr: side * rand(10, 17) });
    for (const j of [i - 1, i + 1]) { const n = T.letters[j]; if (n) Letters.kick(n, { vy: fs * 5 * mScale(), vr: (j < i ? -1 : 1) * 90 * mScale() }); }
  }

  // ---------- the slide as terrain ----------
  const world = { slide: null, lines: [], boxes: [], obstacles: [], floor: { kind: 'floor', x1: -1e5, x2: 1e5, y: 0 } };
  const MCTX = document.createElement('canvas').getContext('2d');
  const slideRoot = () => (world.slide && world.slide.isConnected ? world.slide : document.body);
  function shown(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > VH || r.right < 0 || r.left > VW) return null;
    const cs = getComputedStyle(el);
    return cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < .2 ? null : r;
  }
  function metrics(el) {
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 32;
    MCTX.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    const m = MCTX.measureText('H');
    return { fs, asc: m.fontBoundingBoxAscent || fs * .92, desc: m.fontBoundingBoxDescent || fs * .24, cap: m.actualBoundingBoxAscent || fs * .7 };
  }
  function linesOf(el) {
    const rg = document.createRange(); rg.selectNodeContents(el);
    const out = [];
    for (const q of rg.getClientRects()) {
      if (q.width < 3 || q.height < 3) continue;
      const mid = (q.top + q.bottom) / 2, L = out.find(l => Math.abs((l.top + l.bottom) / 2 - mid) < q.height * .45);
      if (L) { L.left = Math.min(L.left, q.left); L.right = Math.max(L.right, q.right); L.top = Math.min(L.top, q.top); L.bottom = Math.max(L.bottom, q.bottom); }
      else out.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
    }
    return out;
  }
  const headsOf = rootEl => [...new Set([...rootEl.querySelectorAll('[data-osmiornica-cel]'), ...rootEl.querySelectorAll('h1,h2,h3')])].filter(el => !el.closest('[data-osmiornica="nie"],[data-osmiornica-host]') && shown(el));
  function lineSurface(el, m, L) {
    const half = Math.max(0, (L.bottom - L.top) - (m.asc + m.desc)) / 2, base = L.top + half + m.asc;
    return { kind: 'text', el, x1: L.left, x2: L.right, y: base - m.cap, base, fs: m.fs, top: L.top, bottom: L.bottom };
  }
  function refreshWorld() {
    const rootEl = slideRoot();
    world.lines = []; world.boxes = []; world.obstacles = [];
    world.floor = { kind: 'floor', x1: -1e5, x2: 1e5, y: VH };
    for (const el of headsOf(rootEl)) { const m = metrics(el); for (const L of linesOf(el)) world.lines.push(lineSurface(el, m, L)); }
    for (const el of rootEl.querySelectorAll('[data-osmiornica-podest], img, figure, pre, table, video, canvas, svg')) {
      if (el.closest('[data-osmiornica-host]')) continue;
      const r = shown(el); if (!r || r.width < S * 1.6) continue;
      world.boxes.push({ kind: 'box', el, x1: r.left + 4, x2: r.right - 4, y: r.top });
      world.obstacles.push({ l: r.left, r: r.right, t: r.top, b: r.bottom });
    }
    for (const el of rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,dt,dd,td,th,label,button,code')) {
      if (!shown(el)) continue;
      for (const L of linesOf(el)) world.obstacles.push({ l: L.left, r: L.right, t: L.top, b: L.bottom });
    }
    for (const el of document.querySelectorAll('[data-osmiornica-przeszkoda]')) { const r = shown(el); if (r) world.obstacles.push({ l: r.left, r: r.right, t: r.top, b: r.bottom }); }
  }
  const overlap = (a, b) => { const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t); return w > 0 && h > 0 ? w * h : 0; };
  function restSpots(near) {
    const C = [], add = (kind, x, ground, face, pose) => C.push({ kind, x, ground, face, pose });
    const base = (L, x) => ({ kind: 'line', x1: x - S * 1.6, x2: x + S * 1.6, y: L.base });
    for (const L of world.lines) {
      for (const side of [1, -1]) {
        const pose = chance(.6) ? 'lie' : 'sit', x = side > 0 ? L.x2 + S * (pose === 'lie' ? 1.5 : 1.25) : L.x1 - S * (pose === 'lie' ? 1.5 : 1.25);
        add('beside', x, base(L, x), -side, pose);
      }
      if (L.x2 - L.x1 > S * 1.4) add('top', clamp(near ? near.x : (L.x1 + L.x2) / 2, L.x1 + S * .6, L.x2 - S * .6), L, 0, 'lie');
    }
    for (const b of world.boxes) add('box', clamp(near ? near.x : (b.x1 + b.x2) / 2, b.x1 + S * .6, b.x2 - S * .6), b, 0, 'lie');
    add('floor', S * 1.4, world.floor, 1, 'lie'); add('floor', VW - S * 1.4, world.floor, -1, 'lie');
    for (const c of C) {
      const box = { l: c.x - S, r: c.x + S, t: c.ground.y - S * 1.3, b: c.ground.y - 3 };
      if (box.l < 6 || box.r > VW - 6 || box.t < 6 || c.ground.y > VH + 1) { c.score = 1e9; continue; }
      let ov = 0; for (const o of world.obstacles) ov += overlap(box, o);
      c.score = ov / (S * S) * 2 + (near ? Math.hypot(c.x - near.x, c.ground.y - near.y) / Math.max(VW, VH) * 2 : 0) + (c.kind === 'floor' ? .5 : 0) - (c.kind === 'beside' ? .15 : 0) + rand(0, .3);
    }
    return C.filter(c => c.score < 1e8).sort((a, b) => a.score - b.score);
  }
  function bestSpot(near, away) {
    const list = restSpots(near).filter(c => !away || Math.hypot(c.x - away.x, c.ground.y - away.y) > S * 2);
    return list[0] || { kind: 'floor', x: VW - S * 1.4, ground: world.floor, face: -1, pose: 'lie' };
  }
  function lineFor(el, r) {
    const m = metrics(el), mid = (r.top + r.bottom) / 2;
    const L = linesOf(el).find(l => mid > l.top && mid < l.bottom);
    return L ? lineSurface(el, m, L) : null;
  }
  // edge: only words that end or start a line, with room for her beside them
  function sideRoom(el, lines, r) {
    const mid = (r.top + r.bottom) / 2, L = lines.find(l => mid > l.top && mid < l.bottom);
    if (!L) return null;
    const m = metrics(el), base = lineSurface(el, m, L).base;
    let best = null;
    for (const side of [1, -1]) {
      if (side > 0 ? r.right < L.right - 2 : r.left > L.left + 2) continue;
      const x = side > 0 ? r.right + S * 1.25 : r.left - S * 1.25, box = { l: x - S, r: x + S, t: base - S * 1.3, b: base - 3 };
      if (box.l < 6 || box.r > VW - 6 || box.t < 6) continue;
      let ov = 0; for (const o of world.obstacles) ov += overlap(box, o);
      const sc = ov / (S * S);
      if (!best || sc < best.ov) best = { side, x, base, ov: sc };
    }
    return best;
  }
  function dropTarget(o = {}) {
    const cands = [];
    for (const el of headsOf(slideRoot())) {
      const bonus = (el.hasAttribute('data-osmiornica-cel') ? -1 : 0) - (el.tagName === 'H1' ? .3 : 0), lines = o.edge ? linesOf(el) : null;
      for (const w of wordsIn(el)) {
        const rg = document.createRange(); rg.setStart(w.node, w.start); rg.setEnd(w.node, w.end);
        const rs = rg.getClientRects(); if (rs.length !== 1) continue;
        const r = rs[0]; if (r.left < S * .8 || r.right > VW - S * .8 || r.top < 0 || r.bottom > VH) continue;
        const room = o.edge ? sideRoom(el, lines, r) : null; if (o.edge && !room) continue;
        cands.push({ el, w, room, score: (w.word.length >= 5 ? 0 : .4) + bonus + rand(0, .7) + (room ? room.ov * 3 : 0) });
      }
      for (const wr of el.querySelectorAll('.osm-w')) {
        if ([...wr.children].every(l => Letters.crooked(l))) continue;
        const r = wr.getBoundingClientRect(); if (r.left < S * .8 || r.right > VW - S * .8) continue;
        const room = o.edge ? sideRoom(el, lines, r) : null; if (o.edge && !room) continue;
        cands.push({ el, wrapped: wr, room, score: .3 + bonus + rand(0, .7) + (room ? room.ov * 3 : 0) });
      }
    }
    cands.sort((a, b) => a.score - b.score);
    const c = cands[0]; if (!c) return null;
    const letters = c.wrapped ? [...c.wrapped.children] : wrapWord(c.w.node, c.w.start, c.w.end);
    // round letters hide a tilt, so prefer ones with straight strokes
    const inner = letters.slice(1, -1).filter(l => !Letters.crooked(l)), straight = inner.filter(l => !ROUND.test(l.textContent));
    const free = straight.length ? straight : inner;
    const L = free.length ? pick(free) : letters[1 + ((Math.random() * (letters.length - 2)) | 0)];
    const lr = L.getBoundingClientRect(), surface = lineFor(c.el, lr);
    if (!surface) return null;
    return { el: c.el, letter: L, letters, word: letters.map(l => l.textContent).join(''), x: lr.left + lr.width / 2, surface, fs: surface.fs, room: c.room };
  }
  function counterLetter(near) {
    let best = null, bd = 1e9;
    const consider = (el, getRect, make) => { const r = getRect(); if (!r || !r.width) return; const d = Math.hypot(r.left + r.width / 2 - near.x, r.top + r.height / 2 - near.y); if (d < bd) { bd = d; best = { el, make }; } };
    for (const el of headsOf(slideRoot())) {
      for (const w of wordsIn(el)) {
        const i = w.word.search(COUNTER); if (i < 0) continue;
        consider(el, () => { const rg = document.createRange(); rg.setStart(w.node, w.start + i); rg.setEnd(w.node, w.start + i + 1); return rg.getBoundingClientRect(); }, () => wrapWord(w.node, w.start, w.end)[i]);
      }
      for (const l of el.querySelectorAll('.osm-l')) if (COUNTER.test(l.textContent) && !Letters.crooked(l)) consider(el, () => l.getBoundingClientRect(), () => l);
    }
    if (!best) return null;
    const L = best.make(), r = L.getBoundingClientRect(), line = lineFor(best.el, r), m = metrics(best.el);
    const lower = L.textContent === L.textContent.toLowerCase();
    return { el: L, x: r.left + r.width / 2, y: line ? line.base - (lower ? m.fs * .26 : m.cap * .5) : r.top + r.height * .6, line };
  }
  function peekX() {
    const xs = [VW * .1, VW * .22, VW * .78, VW * .9].map(x => clamp(x, S, VW - S));
    let best = xs[0], bs = 1e9;
    for (const x of xs) { let ov = 0; const box = { l: x - S * .7, r: x + S * .7, t: VH - S, b: VH }; for (const o of world.obstacles) ov += overlap(box, o); const sc = ov + rand(0, S * S * .3); if (sc < bs) { bs = sc; best = x; } }
    return best;
  }
  function sampleBg() {
    const pts = document.elementsFromPoint(clamp(oct.x, 1, VW - 1), clamp(oct.y - S * .5, 1, VH - 1));
    for (const el of pts) {
      if (el === host) continue;
      for (let e = el; e; e = e.parentElement) { const c = parseColor(getComputedStyle(e).backgroundColor); if (c && c.a > .5) { oct.camoC = c.c; return; } }
    }
    const c = parseColor(getComputedStyle(document.body).backgroundColor);
    oct.camoC = c && c.a > .5 ? c.c : [12, 7, 32];
  }

  // ---------- motion primitives ----------
  const G = () => VH * 2.4;
  function motion(step) { return new Promise((res, rej) => { if (oct.motion) oct.motion.rej(CANCEL); oct.motion = { step, res, rej }; }); }
  const wait = sec => new Promise((res, rej) => waits.push({ at: clock + sec, res, rej }));
  function cancelAll() {
    RUN++;
    for (const w of waits.splice(0)) w.rej(CANCEL);
    if (oct.motion) { const m = oct.motion; oct.motion = null; m.rej(CANCEL); }
    for (const a of oct.arms) if (a.reach) { a.reach.wT = 0; a.reach.follow = false; }
    Letters.releaseAll();
    Object.assign(oct, { physics: false, spin: false, props: [], eyeCamo: false, camoT: 0, turnT: 0, scale: 1, alpha: oct.on ? 1 : oct.alpha });
    interruptible = false; D.inFoch = false;
    if (thought.dream) unthink();
    if (hitEl) hitEl.classList.remove('drag');
  }
  function land(speed) {
    oct.qv -= clamp(speed / (VH * .32), 1.2, 6) * mScale();
    setPose('sit'); oct.angT = 0; oct.glowPulse = Math.max(oct.glowPulse, .35);
    for (const a of oct.arms) for (let i = 1; i < N; i++) a.p[i].py -= speed * .004 * (i / N) * mScale();
  }
  function fallTo(surf) {
    oct.physics = true; oct.ground = surf; setPose('fall'); oct.vx = 0; oct.vy = VH * .1;
    const restY = surf.y - oct.ride * S;
    return motion(dt => {
      oct.vy = Math.min(oct.vy + G() * dt, VH * 3.2); oct.y += oct.vy * dt;
      oct.angT = Math.sin(clock * 7) * .08;
      if (oct.y < restY) return false;
      oct.y = restY; land(oct.vy); oct.vy = 0; oct.physics = false;
      return true;
    });
  }
  function hopTo(spot, o = {}) {
    const x0 = oct.x, y0 = oct.y, x1 = spot.x, y1 = spot.ground.y - .3 * S;
    const d = Math.hypot(x1 - x0, y1 - y0), T = o.dur || clamp(.32 + d / (VW * 1.3), .38, .8);
    const h = Math.max(o.h != null ? o.h : clamp(d * .3, S * .45, S * 1.8), (y0 - y1) / 3 + S * .3);
    let t = -(o.crouch != null ? o.crouch : .14);
    oct.ride = .3; oct.faceT = Math.sign(x1 - x0) * .8; setPose('sit'); oct.ground = spot.ground; oct.angT = 0;
    if (RM.matches) { oct.x = x1; oct.y = y1; return Promise.resolve(); }
    return motion(dt => {
      t += dt;
      if (t < 0) { oct.qT = -.2; return false; }
      const u = clamp(t / T, 0, 1);
      oct.qT = u < .85 ? .12 : 0;
      oct.x = lerp(x0, x1, u); oct.y = lerp(y0, y1, u) - 4 * h * u * (1 - u);
      if (u < 1) return false;
      oct.qT = 0; land(Math.abs((y1 - y0) / T + 4 * h / T) * .6);
      return true;
    });
  }
  function jetTo(dir) {
    oct.physics = true; setPose('jet'); oct.ground = null; oct.vx = oct.vy = 0;
    oct.angT = Math.atan2(dir[0], -dir[1]); oct.qT = .14; oct.faceT = 0;
    let t = 0, n = 0, next = .2;
    return motion(dt => {
      t += dt;
      if (t >= next) {
        n++; next = t + .4;
        const sp = VH * (n === 1 ? 1.5 : 1.15);
        oct.vx += dir[0] * sp; oct.vy += dir[1] * sp; oct.qv += 5; oct.qT = 0;
        if (n === 1) inkCloud(oct.x - dir[0] * S * .3, oct.y - dir[1] * S * .3, 7, -dir[0], -dir[1]);
      }
      const drag = Math.exp(-3 * dt); oct.vx *= drag; oct.vy *= drag;
      oct.flare = approach(oct.flare, next - t < .22 ? 1 : 0, 9, dt); // arms open like an umbrella before each pulse
      oct.x += oct.vx * dt; oct.y += oct.vy * dt;
      const m = S * 3;
      if (oct.x < -m || oct.x > VW + m || oct.y < -m || oct.y > VH + m || t > 5) { oct.flare = 0; return true; }
      return false;
    });
  }
  function glideTo(x1, y1, dur, fn = smooth) {
    const x0 = oct.x, y0 = oct.y; let t = 0;
    return motion(dt => { t += dt; const u = clamp(t / dur, 0, 1), e = fn(u); oct.x = lerp(x0, x1, e); oct.y = lerp(y0, y1, e); return u >= 1; });
  }
  function fadeTo(a, dur = .5) { const a0 = oct.alpha; let t = 0; return motion(dt => { t += dt; oct.alpha = lerp(a0, a, clamp(t / dur, 0, 1)); return t >= dur; }); }
  function tumble(vx, vy) {
    oct.physics = true; oct.spin = true; setPose('tumble'); oct.ground = null;
    oct.vx = clamp(vx, -VW * 3, VW * 3); oct.vy = clamp(vy, -VH * 3, VH * 3); oct.angV = clamp(vx / (S * 2.2), -16, 16);
    let bounces = 0, t = 0;
    const bonk = () => { oct.qv -= 2.5; oct.flash = .15; oct.flashC = TINT.fear; };
    return motion(dt => {
      t += dt;
      const py = oct.y;
      oct.vy += G() * dt; oct.x += oct.vx * dt; oct.y += oct.vy * dt;
      const r = S * .5;
      if (oct.x < r) { oct.x = r; oct.vx = Math.abs(oct.vx) * .5; oct.angV *= -.6; bonk(); }
      if (oct.x > VW - r) { oct.x = VW - r; oct.vx = -Math.abs(oct.vx) * .5; oct.angV *= -.6; bonk(); }
      if (oct.y < S * 1.05) { oct.y = S * 1.05; oct.vy = Math.abs(oct.vy) * .4; bonk(); }
      if (oct.vy > 0) {
        const feet = oct.y + .3 * S, pfeet = py + .3 * S;
        let surf = null;
        for (const s of world.lines.concat(world.boxes)) if (oct.x > s.x1 && oct.x < s.x2 && pfeet <= s.y && feet >= s.y) { surf = s; break; }
        if (!surf && feet >= VH) surf = world.floor;
        if (surf) {
          oct.y = surf.y - .3 * S;
          if (oct.vy > VH * .9 && bounces < 2) { bounces++; oct.vy = -oct.vy * .35; oct.vx *= .6; bonk(); }
          else {
            oct.ground = surf; oct.spin = false; oct.ang = Math.atan2(Math.sin(oct.ang), Math.cos(oct.ang)); oct.angT = 0;
            land(oct.vy); oct.vx = oct.vy = 0; oct.physics = false;
            return true;
          }
        }
      }
      return t > 6;
    });
  }

  // ---------- behaviours ----------
  const B = {};
  const ENTRANCES = ['zerkniecie', 'upadek', 'kamuflaz', 'ramie'];
  const REACTIONS = ['atrament', 'opoznienie', 'kamuflaz', 'kursor', 'woda', 'foch'];
  const D = { slide: null, start: 0, appearances: 0, last: -1e9, timer: 0, greeted: false, lastReaction: '', taps: 0, inFoch: false };
  let lastAct = { name: '', at: -1e9 };

  async function perform(name, arg) {
    const fn = B[name]; if (!fn) return;
    cancelAll();
    if (name[0] !== '_') { lastAct = { name, at: clock }; stat(name).n++; memSave(); }
    if ((ENTRANCES.includes(name) && !oct.on) || name === 'final') { D.appearances++; D.last = clock; }
    try { await fn(arg); } catch (e) { if (e !== CANCEL) console.error('[osmiornica]', e); }
  }
  function idleLook() {
    const r = Math.random();
    if (r < .4 && cur.inside && clock - cur.t < 3) look('cursor', rand(1, 2.5));
    else if (r < .75 && world.lines.length) { const L = pick(world.lines); lookAt(rand(L.x1, L.x2), (L.y + L.base) / 2, rand(1.2, 2.6)); }
    else look('audience', rand(1, 2));
    if (chance(.25)) { oct.tiltT = rand(-.16, .16); oct.tiltUntil = clock + rand(1, 2); }
  }
  const dodgeChance = () => clamp((mem.clicks - 6) / 30, 0, .55) + mood.fear * .3;
  // no yawn (she has no mouth to show): a long stretch of all eight arms, then the lids sink
  async function stretchOut() {
    unthink(); expr('stretch', 1.3); oct.qT = .14;
    for (const a of oct.arms) { a.fd = a.ft = 1.1; a.fa = -1.2 * mScale(); }
    await wait(1.1);
    oct.qT = 0; expr('closed', 1e6);
    await wait(.4);
  }
  function fallAsleep() { state = 'sleep'; expr('closed', 1e6); think({ dream: true }); }
  async function rest(spot, asleep = false) {
    // no spot, or she is nowhere near it (an exit cut short leaves her below the screen): find one and hop there
    const far = spot && spot.ground && (Math.hypot(oct.x - spot.x, oct.y - (spot.ground.y - .3 * S)) > S * 1.2 || oct.y > VH + S * .2);
    if (!spot || !spot.ground || far) { refreshWorld(); spot = bestSpot({ x: clamp(oct.x, S, VW - S), y: clamp(oct.y, 0, VH) }); await hopTo(spot); }
    oct.spot = spot; oct.ground = spot.ground; state = 'rest'; interruptible = true;
    const pose = asleep ? 'lie' : spot.pose || 'lie'; setPose(pose);
    const side = spot.face || (chance(.5) ? 1 : -1);
    oct.angT = pose === 'lie' ? -side * .5 : 0;
    if (pose === 'lie') { oct.ride = .2; await glideTo(oct.x, spot.ground.y - .2 * S, .45); }
    if (asleep) fallAsleep();
    const stay = CFG.mode === 'demo' ? 40 : CFG.stayMin * 60, t0 = clock;
    let nextLook = 0, zz = 0, nextThought = clock + (CFG.mode === 'demo' ? rand(4, 8) : rand(15, 35));
    const sleepAt = clock + (CFG.mode === 'demo' ? 16 : 30) * (temper === 'zaspana' ? .6 : 1);
    while (clock - t0 < stay) {
      await wait(.2);
      const near = Math.hypot(cur.x - oct.x, cur.y - (oct.y - .5 * S)) < S * 1.3 && cur.inside;
      if (state === 'sleep') {
        if (clock > zz) { zz = clock + 2.6; emote('z', 1.6); }
        if (near && clock - cur.t < .3) return perform('pobudka');
        continue;
      }
      if (clock > nextLook) { idleLook(); nextLook = clock + rand(1.2, 3.4); }
      if (CFG.thoughts && clock > nextThought && !thought.on) { think(pickThought(), 3.2); nextThought = clock + (CFG.mode === 'demo' ? rand(8, 14) : rand(20, 45)); }
      if (clock > sleepAt && mood.fear < .25 && oct.pose === 'lie') { await stretchOut(); fallAsleep(); continue; }
      // learned wariness: the more she has been clicked, the more she flinches at a rushing cursor
      if (near && cur.speed > VW * .9 && clock - cur.t < .1 && chance(dodgeChance())) return perform('unik');
    }
    interruptible = false;
    await leave();
  }
  async function leave() {
    if (!oct.on) return;
    state = 'busy'; interruptible = false; expr(null); unthink();
    if (chance(.45)) { refreshWorld(); const L = counterLetter({ x: oct.x, y: oct.y }); if (L && Math.hypot(L.x - oct.x, L.y - oct.y) < VW * .5) return B.wplyw(L); }
    return B._wyjscie();
  }
  B._wyjscie = async () => {
    if (!oct.on) return;
    state = 'busy'; unthink();
    if (RM.matches) { await fadeTo(0); return hide(); }
    if (oct.ground && oct.ground.kind === 'floor') { await glideTo(oct.x, VH + S * 1.6, .5, easeIn); return hide(); }
    return B.odrzut();
  };
  B.odrzut = async () => {
    if (!oct.on) return;
    state = 'busy'; sampleBg(); inkFor(oct.camoC);
    const dx = oct.x < VW / 2 ? -1 : 1, v = [dx * rand(.3, .75), -1], m = Math.hypot(v[0], v[1]);
    expr('focus', .5);
    if (RM.matches) { await fadeTo(0); return hide(); }
    await jetTo([v[0] / m, v[1] / m]);
    hide();
  };
  async function bow() {
    oct.turnT = 0; unthink();
    look('audience', 2.6); expr('happy', 2.8); emote('♥'); sparkle(oct.x, oct.y - S * .9, 16);
    oct.glowPulse = 1.2; feel('joy', .35);
    for (let i = 0; i < 2; i++) { oct.angT = (oct.x < VW / 2 ? 1 : -1) * .36; oct.qT = -.12; await wait(.32); oct.angT = 0; oct.qT = 0; await wait(.28); }
    // a little round of applause under her chin
    const A = oct.arms.filter(a => !a.back && a.k === 2);
    for (let i = 0; i < 3; i++) {
      for (const a of A) a.reach = { rel: [a.side * .04 * S, -.16 * S], w: 0, wT: 1, rate: 14, stiff: .5, front: true, idx: AT(.7) };
      await wait(.17);
      for (const a of A) a.reach.wT = 0;
      await wait(.15);
    }
    await wait(.3);
  }
  B.zerkniecie = async (o = {}) => {
    refreshWorld();
    const x = peekX();
    spawn(x, VH + S * 1.4, 'sit'); state = 'busy';
    if (RM.matches) { oct.y = VH + S * .08; oct.alpha = 0; await fadeTo(1, .4); }
    else await glideTo(x, VH + S * .08, .85, easeOut);
    if (o.heart) { look('audience', 1.5); expr('happy', 1.6); emote('♥'); oct.glowPulse = 1; await wait(1.5); }
    else if (o.thought) { look('audience', 2.6); think(o.thought, 2.6); await wait(2.8); }
    else {
      lookAt(VW / 2, VH * .4, 1); await wait(.9);
      lookAt(x < VW / 2 ? VW * .9 : VW * .1, VH * .55, .7); await wait(.7);
      look('audience'); oct.eyes.blink = .17;
      // she remembers the room: from the second session on, the first peek gets a line
      if (mem.sessions > 1 && D.appearances === 1 && !D.greeted) { D.greeted = true; await wait(.3); expr('skeptic', 2.4); think({ icon: 'znowu' }, 2.2); await wait(2.4); }
      else await wait(.7);
    }
    if (RM.matches) await fadeTo(0, .3); else await glideTo(x, VH + S * 1.5, .35, easeIn);
    hide();
  };
  B.odmowa = async () => {
    // not today: she pops up, shakes her head and goes back down
    refreshWorld();
    const x = peekX();
    spawn(x, VH + S * 1.4, 'sit'); state = 'busy';
    await glideTo(x, VH + S * .08, .7, easeOut);
    look('audience', 2.6); expr('angry', 2.6); think({ icon: 'nie' }, 2.2);
    await wait(.45);
    for (let i = 0; i < 5; i++) { oct.angT = (i % 2 ? -1 : 1) * .16; await wait(.15); }
    oct.angT = 0;
    await wait(1);
    await glideTo(x, VH + S * 1.5, .35, easeIn);
    hide();
  };
  B.upadek = async () => {
    refreshWorld();
    const T = dropTarget();
    if (!T) return B.zerkniecie();
    const side = chance(.5) ? 1 : -1;
    spawn(T.x + side * rand(.02, .08) * S, -S * 1.6, 'fall'); state = 'busy';
    oct.faceT = side * .6; lookAt(T.x, T.surface.y + S, 1.5); feel('curiosity', .15);
    if (RM.matches) { oct.y = T.surface.y - .3 * S; oct.ground = T.surface; setPose('sit'); oct.alpha = 0; await fadeTo(1, .4); }
    else await fallTo(T.surface);
    knock(T, side);
    startle(.6, 'focus');
    await wait(.5);
    lookAt(T.x, T.surface.y + T.fs * .5, 1.3);
    think({ icon: 'pytanie' }, 1.9);
    await wait(1.2);
    look('audience', 1.4); expr('smug', 1.7); feel('joy', .15); emote('♪');
    await wait(1.2);
    refreshWorld();
    const spot = bestSpot({ x: oct.x, y: T.surface.y });
    await hopTo(spot);
    await rest(spot);
  };
  B.final = async () => {
    refreshWorld();
    const T = dropTarget();
    if (!T) return B.zerkniecie({ heart: true });
    spawn(T.x, -S * 1.6, 'fall'); state = 'busy';
    if (RM.matches) { oct.y = T.surface.y - .3 * S; oct.ground = T.surface; oct.alpha = 0; await fadeTo(1, .4); }
    else await fallTo(T.surface);
    knock(T, chance(.5) ? 1 : -1);
    startle(.5, 'happy'); await wait(.7);
    await bow();
    oct.spot = { kind: 'top', x: oct.x, ground: T.surface, face: 0, pose: 'sit' };
    await rest(oct.spot);
  };
  B.kamuflaz = async () => {
    refreshWorld();
    if (!oct.on) {
      // only a pair of eyes opening on the slide gives her away
      const spot = bestSpot(null);
      spawn(spot.x, spot.ground.y - .3 * S, 'sit'); oct.ground = spot.ground; oct.spot = spot; state = 'busy';
      sampleBg(); oct.camo = oct.camoT = 1; expr('closed', 1.5);
      await wait(1.6);
      look('audience', 1.1); await wait(1.2);
      lookAt(VW / 2, VH * .4, 1.2); await wait(1.3);
    } else {
      state = 'busy'; sampleBg(); oct.camoT = 1; expr('focus', 1.8);
      await wait(1.9);
      look('cursor', 1.5); await wait(1.6);
    }
    oct.camoT = 0; oct.clouds = 1; expr('smug', 1.4); oct.glowPulse = .6;
    await wait(1.2);
    await rest(oct.spot);
  };
  B.ramie = async () => {
    refreshWorld();
    const T = dropTarget({ edge: true });
    if (!T) return oct.on ? rest(oct.spot) : B.zerkniecie();
    const right = T.room.side > 0, x = T.room.x;
    const spot = { kind: 'beside', x, ground: { kind: 'line', x1: x - S * 1.6, x2: x + S * 1.6, y: T.room.base }, face: right ? -1 : 1, pose: 'sit' };
    const sneaky = !oct.on;
    if (sneaky) {
      // fully camouflaged: the audience only sees a letter float away by itself
      spawn(x, spot.ground.y - .3 * S, 'sit'); oct.ground = spot.ground;
      sampleBg(); oct.camo = oct.camoT = 1; oct.eyeCamo = true; expr('closed', 4.5);
    } else if (Math.abs(oct.x - x) > S * .5 || Math.abs(oct.y - (spot.ground.y - .3 * S)) > S * .5) await hopTo(spot);
    oct.spot = spot; state = 'busy'; setPose('sit');
    const L = right ? T.letters[T.letters.length - 1] : T.letters[0];
    const lr = L.getBoundingClientRect(), lx = lr.left + lr.width / 2, ly = lr.top + lr.height * .55;
    const arm = oct.arms.find(a => !a.back && a.k === 2 && a.side === (right ? -1 : 1));
    if (!sneaky) { look('audience', 4); expr('innocent', 4); }
    arm.reach = { x: lx, y: ly, w: 0, wT: 1, rate: 1.6, stiff: .14 };
    await wait(1.7);
    Letters.carry(L, () => { const q = arm.p[N - 3]; return { x: q.x, y: q.y, r: Math.sin(clock * 3) * 12 }; });
    Object.assign(arm.reach, { x: oct.x + (right ? -1 : 1) * S * .15, y: oct.y - S * 1.25, rate: 3, stiff: .25, front: true });
    await wait(1.5);
    if (sneaky) { oct.camoT = 0; oct.eyeCamo = false; expr('skeptic', .9); oct.clouds = .8; await wait(.5); }
    else { lookAt(arm.p[N - 1].x, arm.p[N - 1].y, 1.2); startle(.5, 'guilty'); emote('?'); await wait(.9); }
    Letters.drop(L, chance(.5));
    arm.reach.wT = 0;
    look('audience', 1.8); expr('guilty', 1.8); oct.flash = .5; oct.flashC = TINT.joy; feel('joy', .1);
    await wait(1.8);
    await rest(spot);
  };
  B.atrament = async () => {
    if (!oct.on) return B.kamuflaz();
    state = 'busy'; interruptible = false;
    startle(1, null); emote('!'); feel('fear', .35);
    // a pseudomorph: an ink decoy in her own shape, while the real one slips away camouflaged
    sampleBg(); inkFor(oct.camoC);
    ghost();
    const s = siphonWorld(); inkCloud(s.x, s.y, 26);
    const gx = oct.x, gy = oct.y - S * .5;
    oct.camoT = .94;
    await wait(.12);
    refreshWorld();
    const spot = bestSpot({ x: oct.x, y: oct.y }, { x: oct.x, y: oct.ground ? oct.ground.y : oct.y });
    await hopTo(spot, { h: S * .7, dur: .5, crouch: .04 });
    oct.spot = spot;
    await wait(1.3);
    oct.camoT = 0; oct.clouds = .8; expr('smug', 1.6); lookAt(gx, gy, 1.6);
    await wait(1.6);
    await rest(spot);
  };
  B.opoznienie = async () => {
    if (!oct.on) return B.zerkniecie();
    state = 'busy'; interruptible = false;
    await wait(rand(1.3, 2.1)); // ...processing
    startle(1.3, 'angry'); emote('!');
    await hopTo({ x: oct.x, ground: oct.ground || world.floor }, { h: S * .55, dur: .32, crouch: .02 });
    look('cursor', 1.6); expr('angry', 1.7); emote('anger'); feel('annoyance', .25);
    await wait(1.7);
    await rest(oct.spot);
  };
  B.kursor = async () => {
    if (!oct.on) return B.zerkniecie();
    state = 'busy'; interruptible = true;
    let a = oct.arms[0], bd = 1e9;
    for (const c of oct.arms) { if (c.back) continue; const t = c.p[N - 1], d = Math.hypot(t.x - cur.x, t.y - cur.y); if (d < bd) { bd = d; a = c; } }
    a.reach = { x: cur.x, y: cur.y, w: 0, wT: 1, rate: 4, stiff: .3, follow: cur.inside, front: cur.y < oct.y - S * .3 };
    if (!cur.inside) Object.assign(a.reach, { x: oct.x + (oct.x < VW / 2 ? 1 : -1) * S * 1.6, y: oct.y - S * 1.2 });
    look('cursor', 3.2); expr('focus', 3); feel('curiosity', .3);
    await wait(3.2);
    a.reach.wT = 0; a.reach.follow = false; emote('?');
    await wait(.6);
    await rest(oct.spot);
  };
  B.woda = async () => {
    if (!oct.on) return B.zerkniecie();
    state = 'busy'; interruptible = false;
    // the famous aquarium octopus that kept shorting the lamp with a water jet
    lookAt(VW / 2, -S, 2.4); expr('angry', 2.4);
    await wait(.5);
    const s = siphonWorld(); squirt(s.x, s.y, VW / 2, -10);
    await wait(.55);
    if (!RM.matches) fx.dim = { t: 0 };
    await wait(1.3);
    expr('smug', 1.6); feel('annoyance', -.4); feel('joy', .25); look('audience', 1.6);
    await wait(1.6);
    await rest(oct.spot);
  };
  B.foch = async () => {
    if (!oct.on) return B.odmowa();
    // a sulk: arms crossed, back to the room, a glance over the shoulder to check anyone noticed
    state = 'busy'; interruptible = true; D.inFoch = true;
    expr('angry', 1.4); emote('anger'); feel('annoyance', .15);
    crossArms(true);
    await wait(.7);
    oct.turnDir = cur.inside && cur.x < oct.x ? 1 : -1;
    oct.turnT = 1; think({ icon: 'burza' }, 3.4);
    await wait(rand(3.8, 5.2));
    oct.turnT = .55; look('cursor', 1.4);
    await wait(1.4);
    if (mood.annoyance > .45 && chance(.5)) { oct.turnT = 1; await wait(2.4); }
    oct.turnT = 0; crossArms(false); expr('smug', 1.2); D.inFoch = false;
    await wait(.8);
    await rest(oct.spot);
  };
  B.mysl = async () => {
    if (!oct.on) return B.zerkniecie({ thought: pickThought() });
    state = 'busy'; refreshWorld();
    think(pickThought(), 3.4);
    await wait(3.4);
    await rest(oct.spot);
  };
  B.sen = async () => {
    refreshWorld();
    if (!oct.on) {
      const spot = bestSpot(null);
      spawn(spot.x, spot.ground.y - .2 * S, 'lie'); oct.ground = spot.ground; oct.spot = Object.assign({}, spot, { pose: 'lie' }); oct.ride = .2;
      oct.alpha = 0; await fadeTo(1, .5);
    }
    state = 'busy'; setPose('lie');
    await stretchOut();
    await rest(Object.assign({}, oct.spot, { pose: 'lie' }), true);
  };
  B.uklon = async () => {
    if (!oct.on) return B.zerkniecie({ heart: true });
    state = 'busy'; interruptible = false;
    await bow();
    await rest(oct.spot);
  };
  B.wina = async () => {
    if (oct.on) await B._wyjscie();
    refreshWorld();
    const x = S * 1.6;
    spawn(x, VH + S * 1.4, 'sit'); state = 'busy';
    const arm = oct.arms.find(a => !a.back && a.side === 1 && a.k === 2);
    oct.props = [{ arm: oct.arms.indexOf(arm), type: 'plug' }];
    arm.reach = { rel: [S * 1.0, -S * 1.15], w: 1, wT: 1, stiff: .45, front: true };
    expr('innocent', 5); look('audience', 5);
    await glideTo(x, VH + S * .02, .8, easeOut);
    emote('halo', 2.6);
    await wait(2.7);
    await glideTo(x, VH + S * 1.6, .45, easeIn);
    hide();
  };
  B.wplyw = async (L) => {
    refreshWorld();
    if (!oct.on) {
      const T = dropTarget(); if (!T) return;
      spawn(T.x, -S * 1.6, 'fall'); state = 'busy';
      await fallTo(T.surface);
      await wait(.6);
    }
    L = L && L.el ? L : counterLetter({ x: oct.x, y: oct.y });
    if (!L) return B.odrzut();
    state = 'busy'; interruptible = false; unthink();
    const sideX = oct.x < L.x ? -1 : 1;
    if (Math.hypot(L.x - oct.x, L.y - oct.y) > S * 1.5) {
      const g = L.line ? { kind: 'line', x1: L.x - S * 2, x2: L.x + S * 2, y: L.line.y } : world.floor;
      await hopTo({ x: L.x + sideX * S * .95, ground: g });
    }
    lookAt(L.x, L.y, 2.5); expr('focus', 1.2);
    await wait(.75);
    // an octopus fits through any gap bigger than its beak, so a letter's counter will do
    for (const a of oct.arms) a.reach = { x: L.x, y: L.y, w: 0, wT: 1, rate: 3 + rand(0, 3), stiff: .3 };
    await wait(.45);
    const x0 = oct.x, y0 = oct.y; let t = 0;
    oct.ground = null;
    await motion(dt => {
      t += dt; const u = clamp(t / .85, 0, 1), e = smooth(u);
      oct.x = lerp(x0, L.x, e); oct.y = lerp(y0, L.y + S * .2 * (1 - e), e);
      oct.scale = lerp(1, .04, Math.pow(u, 1.5)); oct.qT = u < .4 ? -.2 : .3;
      return u >= 1;
    });
    Letters.kick(L.el, { vs: 7 }); ring(L.x, L.y);
    hide(); oct.scale = 1;
  };
  B.unik = async () => {
    state = 'busy'; interruptible = false;
    startle(.8, 'angry'); feel('fear', .2);
    const dir = Math.sign(oct.x - cur.x) || 1, g = oct.ground || world.floor;
    const nx = clamp(clamp(oct.x + dir * S * 1.3, S, VW - S), g.x1 + S * .3, g.x2 - S * .3);
    await hopTo({ x: nx, ground: g }, { h: S * .5, dur: .35, crouch: .02 });
    oct.spot = Object.assign({}, oct.spot, { x: nx, ground: g });
    look('cursor', 1.2); expr('angry', 1.2);
    await wait(1.2);
    await rest(oct.spot);
  };
  B.pobudka = async () => {
    state = 'busy'; interruptible = false; unthink();
    fx.emotes = fx.emotes.filter(e => e.sym !== 'z');
    startle(1, 'angry'); emote('!');
    feel('fear', .2); feel('annoyance', .2);
    await wait(.9);
    look('cursor', 1.5); expr('angry', 1.6); emote('anger');
    await wait(1.6);
    await rest(Object.assign({}, oct.spot, { pose: 'sit' }));
  };
  B._rzut = async ([vx, vy]) => {
    state = 'busy'; interruptible = false; mem.throws++; memSave();
    feel('fear', .2); feel('annoyance', .35);
    refreshWorld();
    await tumble(vx, vy);
    oct.eyes.dizzy = 1.6; emote('?');
    await wait(1.7);
    expr('angry', 1.8); look('cursor', 1.8); emote('anger');
    await wait(1.8);
    oct.spot = { kind: oct.ground.kind, x: oct.x, ground: oct.ground, pose: 'sit', face: 0 };
    // what happens next depends on how cross she is
    const r = Math.random();
    if (mood.annoyance > .5 && r < .45) return B.foch();
    if (r < .7) return B.odrzut();
    await rest(oct.spot);
  };

  // ---------- director: controlled randomness ----------
  function bandit(names, bias = () => 0) {
    const tot = names.reduce((s, n) => s + stat(n).n, 0) + 1;
    let best = names[0], bs = -1e9;
    for (const n of names) {
      const st = stat(n), sc = (st.s + 1) / (st.n + 2) + .4 * Math.sqrt(Math.log(tot + 1) / (st.n + 1)) + bias(n) + rand(0, .12);
      if (sc > bs) { bs = sc; best = n; }
    }
    return best;
  }
  function nextEntrance() {
    const n = D.appearances;
    if (CFG.mode === 'demo') return ENTRANCES[n % ENTRANCES.length];
    if (n === 0) return 'zerkniecie'; // a teaser first: half the room notices
    if (n === 1) return 'upadek';
    return bandit(ENTRANCES, nm => (nm === 'upadek' || nm === 'ramie' ? mood.boredom * .3 : mood.fear * .3));
  }
  function slideChanged(el) {
    el = el || null;
    if (el && el === D.slide) return;
    D.slide = el; world.slide = el;
    clearTimeout(D.timer);
    if (oct.on && state !== 'drag') perform('_wyjscie');
    if (serious) return;
    const tag = el && el.getAttribute ? el.getAttribute('data-osmiornica') : null;
    if (tag === 'nie') return;
    D.timer = setTimeout(() => decide(el, tag), (CFG.delayAfterSlide + (oct.on ? .9 : 0)) * 1000);
  }
  function decide(el, tag) {
    if (el !== D.slide || serious || state === 'drag' || oct.on) return;
    if (tag === 'final') return perform('final');
    if (tag === 'tu' || CFG.mode === 'demo') return perform(nextEntrance());
    const min = (clock - D.start) / 60, gap = (clock - D.last) / 60;
    if (D.appearances >= CFG.maxAppearances || min < CFG.firstAfterMin || gap < CFG.minGapMin) return;
    const energy = clamp((gap - CFG.minGapMin) / CFG.minGapMin, 0, 1) * .5 + mood.boredom * .5;
    if (chance(.2 + energy * .7)) perform(nextEntrance());
  }
  function summon() {
    if (serious) return;
    if (oct.on) { if (interruptible) perform(pick(['atrament', 'opoznienie', 'kamuflaz', 'kursor', 'mysl'])); return; }
    // she has her moods: on a grumpy day she may simply refuse
    if ((temper === 'marudna' || mood.annoyance > .5) && chance(.35)) return perform('odmowa');
    perform(nextEntrance());
  }
  function onTap() {
    mem.clicks++; memSave(); lastTouch = clock;
    feel('boredom', -.35); feel('curiosity', .08);
    if (state === 'sleep') return perform('pobudka');
    if (D.inFoch) { // poking her while she sulks: she may just leave
      feel('annoyance', .15); emote('anger');
      if (chance(.5)) perform('odrzut');
      return;
    }
    if (!interruptible) { oct.qv += 2.5; oct.flash = .18; oct.flashC = TINT.fear; return; } // busy: just a flinch
    D.taps++;
    const opts = REACTIONS.filter(n => n !== D.lastReaction && (n !== 'woda' || (mood.annoyance > .45 && D.taps >= 3)) && (n !== 'foch' || mood.annoyance > .3 || temper === 'marudna'));
    const n = bandit(opts, nm => (nm === 'atrament' ? mood.fear * .6 : nm === 'kursor' ? mood.curiosity * .4 + (temper === 'ciekawska' ? .3 : 0) : nm === 'woda' ? mood.annoyance * .6 : nm === 'foch' ? mood.annoyance * .6 + (temper === 'marudna' ? .4 : 0) : 0));
    D.lastReaction = n; feel('fear', .15); feel('annoyance', .1);
    perform(n);
  }
  function reward() {
    lastTouch = clock; feel('joy', .3); feel('boredom', -.2); feel('annoyance', -.2);
    const named = clock - lastAct.at < 30 && lastAct.name;
    if (named) { stat(lastAct.name).s++; memSave(); }
    if (oct.on && !serious) perform('uklon');
    else if (CFG.mode === 'demo') toast(named ? `Zapamiętane: „${label(lastAct.name)}” zadziałało` : 'Radość +');
  }
  function setSerious(on) {
    serious = on; clearTimeout(D.timer);
    if (on && oct.on) perform('_wyjscie');
    toast(on ? 'Tryb poważny: włączony' : 'Tryb poważny: wyłączony');
    panelSync();
  }
  function toast(text) { toastEl.textContent = text; toastEl.hidden = false; toastUntil = clock + 1.6; }

  // ---------- input ----------
  const drag = { on: false, id: null, sx: 0, sy: 0, x: 0, y: 0, gx: 0, gy: 0, hist: [], crossAt: 0, thinkAt: 0, tapAt: 0 };
  function startDrag() {
    cancelAll(); drag.on = true; state = 'drag'; hitEl.classList.add('drag');
    setPose('dangle'); oct.ground = null; oct.angT = 0; unthink();
    // held by the top of the mantle, which pinches up into folds; she hangs under it, offended, not scared
    drag.gx = 0; drag.gy = S * 1.3;
    expr('angry', 1e6); emote('anger'); feel('annoyance', .35); lastTouch = clock;
    drag.crossAt = clock + .25; drag.thinkAt = clock + 1.1; drag.tapAt = clock + .7;
    oct.motion = {
      step(dt) {
        oct.x = approach(oct.x, drag.x + drag.gx, 20, dt); oct.y = approach(oct.y, drag.y + drag.gy, 14, dt);
        oct.angT = clamp(-oct.vx * .0005, -.45, .45);
        if (drag.crossAt && clock > drag.crossAt) { drag.crossAt = 0; crossArms(true); }
        if (drag.thinkAt && clock > drag.thinkAt) { drag.thinkAt = 0; think({ icon: 'burza' }, 2.8); }
        if (clock > drag.tapAt) { drag.tapAt = clock + .45; const a = oct.arms.find(x => x.back && x.k === 3 && x.side === 1); if (a) { a.fd = a.ft = .28; a.fa = 1.2; } } // impatient tapping
        return false;
      },
      res() {}, rej() {},
    };
  }
  function endDrag() {
    drag.on = false; hitEl.classList.remove('drag'); oct.motion = null; expr(null); crossArms(false); unthink();
    const now = performance.now(), h = drag.hist.filter(p => now - p.t < 110);
    const a = h[0] || { x: drag.x, y: drag.y, t: now - 16 }, b = h[h.length - 1] || a, dt = Math.max(16, b.t - a.t) / 1000;
    perform('_rzut', [(b.x - a.x) / dt, (b.y - a.y) / dt]);
  }
  function bindInput() {
    hitEl.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      try { hitEl.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
      Object.assign(drag, { id: e.pointerId, on: false, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, hist: [{ x: e.clientX, y: e.clientY, t: performance.now() }] });
    });
    hitEl.addEventListener('pointermove', e => {
      if (drag.id !== e.pointerId) return;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (drag.hist.length > 10) drag.hist.shift();
      if (!drag.on && Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > 7) startDrag();
    });
    hitEl.addEventListener('pointerup', e => { if (drag.id !== e.pointerId) return; e.stopPropagation(); drag.id = null; if (drag.on) endDrag(); else onTap(); });
    hitEl.addEventListener('pointercancel', e => { if (drag.id !== e.pointerId) return; drag.id = null; if (drag.on) endDrag(); });
    hitEl.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); });
    addEventListener('pointermove', e => {
      const dt = Math.max(.008, clock - cur.t), d = Math.hypot(e.clientX - cur.x, e.clientY - cur.y);
      if (cur.inside && d < VW) cur.speed = Math.max(cur.speed * .6, d / dt);
      cur.x = e.clientX; cur.y = e.clientY; cur.t = clock; cur.inside = true;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { cur.inside = false; });
    // a crooked letter is fixed with a click, without the click reaching the deck
    const onLetter = e => {
      const L = e.target && e.target.closest ? e.target.closest('.osm-l.osm-krzywa') : null;
      if (!L) return;
      e.stopPropagation(); e.preventDefault();
      if (e.type !== 'click') return;
      for (const l of L.parentElement.children) Letters.fix(l);
      if (oct.on && interruptible) { lookAt(e.clientX, e.clientY, 1.4); expr('angry', 1.3); emote('…'); feel('annoyance', .12); }
    };
    addEventListener('click', onLetter, true);
    addEventListener('pointerdown', onLetter, true);
    addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, K = CFG.keys;
      let used = true;
      if (k === K.summon) summon();
      else if (k === K.hide) perform('_wyjscie');
      else if (k === K.serious) setSerious(!serious);
      else if (k === K.blame) { if (!serious) perform('wina'); }
      else if (k === K.reward || (K.reward === '+' && k === '=')) reward();
      else if (k === K.fix) { Letters.fixAll(); if (oct.on && interruptible) { expr('angry', 1.2); emote('…'); } }
      else if (k === K.panel) togglePanel();
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    let rz = 0;
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(onResize, 140); });
  }
  function onResize() {
    const fx0 = oct.x / VW;
    resize();
    if (!oct.on || state === 'drag' || oct.physics) return;
    // re-seat her after a layout change (fullscreen, window resize)
    refreshWorld();
    const spot = bestSpot({ x: fx0 * VW, y: VH * .5 });
    if (state === 'rest' || state === 'sleep') { oct.x = spot.x; oct.y = spot.ground.y - (oct.pose === 'lie' ? .2 : .3) * S; oct.ground = spot.ground; oct.spot = spot; oct.skipV = true; }
    else perform('_wyjscie');
  }

  // ---------- presenter panel ----------
  const ACTS = [
    ['zerkniecie', 'Zerknięcie zza krawędzi'], ['upadek', 'Upadek na literę'], ['kamuflaz', 'Kamuflaż'], ['ramie', 'Ramię z własną wolą'],
    ['atrament', 'Atrament i wabik'], ['opoznienie', 'Opóźniona reakcja'], ['kursor', 'Ramię do kursora'], ['woda', 'Woda w rzutnik'],
    ['mysl', 'Myśl'], ['sen', 'Sen'], ['foch', 'Foch'], ['odmowa', 'Odmowa'],
    ['uklon', 'Ukłon („wyszło”)'], ['wina', 'To jej wina'], ['wplyw', 'Wpływa w literę'], ['_wyjscie', 'Odpływa'],
  ];
  const label = n => (ACTS.find(a => a[0] === n) || [n, n])[1];
  let panelOpen = false, panelTick = 0, chartHover = null;
  const STYLE = `
    *{box-sizing:border-box}
    .stage{position:absolute;inset:0;width:100%;height:100%;display:block}
    .hit{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;cursor:grab;touch-action:none;border-radius:45%;-webkit-tap-highlight-color:transparent}
    .hit.on{pointer-events:auto}.hit.drag{cursor:grabbing}
    .dim{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
    .toast{position:absolute;left:16px;bottom:16px;padding:6px 10px;border-radius:8px;background:rgba(18,11,36,.9);color:#C9BFEA;font:12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:none}
    .panel{position:absolute;top:0;right:0;height:100%;width:min(380px,calc(100vw - 24px));overflow:auto;overscroll-behavior:contain;pointer-events:auto;background:#120B24;color:#F4F0FF;border-left:1px solid rgba(255,255,255,.1);box-shadow:-24px 0 64px rgba(4,1,14,.55);font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left;letter-spacing:normal;text-transform:none;padding:0 16px 24px}
    .ph{position:sticky;top:0;z-index:1;background:#120B24;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0 10px;border-bottom:1px solid rgba(255,255,255,.08)}
    .pn{font-size:15px}.ps{color:#8E84B3;margin-left:8px}
    .px{all:unset;cursor:pointer;width:32px;height:32px;display:grid;place-items:center;border-radius:8px;font-size:20px;color:#C9BFEA}
    .px:hover{background:rgba(255,255,255,.06)}
    section{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06);display:grid;gap:10px}
    h3{margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8E84B3;font-weight:700}
    .row{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .seg{display:inline-flex;background:#1B1236;border-radius:9px;padding:3px;gap:2px}
    .seg button{all:unset;cursor:pointer;padding:5px 12px;border-radius:7px;color:#C9BFEA}
    .seg button[aria-pressed="true"]{background:#3B2A7A;color:#fff}
    .tv{display:inline-flex;align-items:center;gap:10px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .grid button{all:unset;box-sizing:border-box;cursor:pointer;padding:8px 10px;border-radius:9px;background:#1B1236;border:1px solid rgba(168,85,247,.22);color:#EDE7FF;font-size:12.5px;line-height:1.25}
    .grid button:hover{border-color:rgba(61,227,240,.6);background:#21173F}
    button:focus-visible,input:focus-visible{outline:2px solid #3DE3F0;outline-offset:2px}
    .hint{margin:0;color:#8E84B3;font-size:12px}
    kbd{font:600 11px/1 ui-monospace,Menlo,Consolas,monospace;padding:2px 5px;border-radius:4px;background:#241A45;color:#EDE7FF;border:1px solid rgba(255,255,255,.12)}
    .bars{display:grid;gap:7px}
    .bar{display:grid;grid-template-columns:96px 40px 1fr;align-items:center;gap:8px}
    .bl{display:flex;align-items:center;gap:6px;color:#EDE7FF}
    .bl i{width:12px;height:3px;border-radius:2px;display:inline-block}
    .bv{text-align:right;font-variant-numeric:tabular-nums;color:#C9BFEA}
    .bt{height:8px;background:rgba(255,255,255,.06);border-radius:0 4px 4px 0;overflow:hidden}
    .bf{display:block;height:100%;border-radius:0 4px 4px 0}
    .chart{position:relative;background:#181030;border-radius:10px;padding:6px 4px 0}
    .chart canvas{display:block;width:100%;height:150px}
    .tip{position:absolute;pointer-events:none;background:#0D0820;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 8px;font-size:12px;min-width:124px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
    .tip .t{color:#8E84B3;margin-bottom:3px}
    .tip .r{display:flex;align-items:center;gap:6px}.tip .r b{font-variant-numeric:tabular-nums;min-width:34px}
    .tip .r i{width:10px;height:2px;display:inline-block;border-radius:1px}.tip .r span{color:#C9BFEA}
    .legend{display:flex;flex-wrap:wrap;gap:6px 12px;color:#C9BFEA;font-size:12px}
    .legend span{display:inline-flex;align-items:center;gap:6px}.legend i{width:14px;height:2px;border-radius:1px;display:inline-block}
    .link{all:unset;cursor:pointer;color:#3DE3F0;font-size:12px;justify-self:start}
    .link:hover{text-decoration:underline}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{text-align:left;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.06)}
    th{color:#8E84B3;font-weight:600}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
    .tbl{overflow-x:auto}
    dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:4px 12px}dt{color:#8E84B3}dd{margin:0;color:#EDE7FF;font-variant-numeric:tabular-nums}
    .chk{justify-content:flex-start;cursor:pointer;color:#EDE7FF}.chk input{accent-color:#A855F7;width:16px;height:16px;margin:0}.chk kbd{margin-left:auto}
    @media (prefers-reduced-motion: reduce){.panel{scroll-behavior:auto}}
  `;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function buildPanel() {
    panelEl.innerHTML = `
      <header class="ph"><div><b class="pn"></b><span class="ps">panel prowadzącego</span></div><button class="px" type="button" aria-label="Zamknij panel">×</button></header>
      <section>
        <div class="row"><span>Tryb</span><div class="seg" role="group" aria-label="Tryb"><button type="button" data-mode="demo">Demo</button><button type="button" data-mode="lecture">Wykład</button></div></div>
        <div class="row"><span>Humor dnia</span><span class="tv"><b class="temper"></b><button type="button" class="link roll">Losuj</button></span></div>
        <label class="row chk"><input type="checkbox" id="osm-serious"><span>Tryb poważny</span><kbd class="k-serious"></kbd></label>
        <p class="hint mode-hint"></p>
      </section>
      <section><h3>Wywołaj</h3><div class="grid acts"></div>
        <p class="hint">Ośmiornicę można złapać myszką i rzucić. Przekrzywioną literę naprawisz kliknięciem.</p></section>
      <section><h3>Nastrój</h3><div class="bars"></div>
        <div class="chart"><canvas aria-label="Nastrój w czasie, pięć serii od 0 do 100%"></canvas><div class="tip" hidden></div></div>
        <div class="legend"></div>
        <button type="button" class="link tbl-btn" aria-expanded="false">Pokaż dane</button><div class="tbl" hidden></div></section>
      <section><h3>Czego się nauczyła</h3>
        <table class="bandit"><thead><tr><th>Psota</th><th class="n">Próby</th><th class="n">„Wyszło”</th></tr></thead><tbody></tbody></table>
        <p class="hint">Naciśnij <kbd>+</kbd>, kiedy psota rozbawi salę. Te, które działają, wybiera częściej.</p></section>
      <section><h3>Pamięć</h3><dl class="mem"></dl><button type="button" class="link wipe">Wyczyść pamięć</button></section>
      <section><h3>Klawisze</h3><dl class="keys"></dl></section>`;
    const $ = s => panelEl.querySelector(s);
    $('.pn').textContent = CFG.name;
    $('.k-serious').textContent = CFG.keys.serious;
    $('.px').addEventListener('click', () => togglePanel(false));
    for (const b of panelEl.querySelectorAll('.seg button')) b.addEventListener('click', () => { CFG.mode = b.dataset.mode; panelSync(); });
    $('.roll').addEventListener('click', () => { setTemper(rollTemper(temper)); panelSync(); });
    $('#osm-serious').addEventListener('change', e => setSerious(e.target.checked));
    const acts = $('.acts');
    for (const [n, t] of ACTS) { const b = el('button', '', t); b.type = 'button'; b.addEventListener('click', () => { if (n === 'uklon') reward(); else perform(n); }); acts.appendChild(b); }
    const fixB = el('button', '', 'Napraw litery'); fixB.type = 'button'; fixB.addEventListener('click', () => Letters.fixAll()); acts.appendChild(fixB);
    const bars = $('.bars'), legend = $('.legend');
    for (const k of EMO) {
      const row = el('div', 'bar'), bl = el('span', 'bl'), key = el('i');
      key.style.background = SERIES[k]; bl.append(key, document.createTextNode(EMO_PL[k]));
      const bt = el('span', 'bt'), bf = el('span', 'bf'); bf.style.background = SERIES[k]; bt.appendChild(bf);
      row.append(bl, el('span', 'bv', '0%'), bt); row.dataset.k = k; bars.appendChild(row);
      const lg = el('span'), li = el('i'); li.style.background = SERIES[k]; lg.append(li, document.createTextNode(EMO_PL[k])); legend.appendChild(lg);
    }
    const tb = $('.tbl-btn');
    tb.addEventListener('click', () => { const t = $('.tbl'); t.hidden = !t.hidden; tb.setAttribute('aria-expanded', String(!t.hidden)); tb.textContent = t.hidden ? 'Pokaż dane' : 'Ukryj dane'; panelSync(); });
    const wipe = $('.wipe');
    wipe.addEventListener('click', () => {
      if (!wipe.dataset.armed) { wipe.dataset.armed = '1'; wipe.textContent = 'Na pewno? Kliknij jeszcze raz'; setTimeout(() => { delete wipe.dataset.armed; wipe.textContent = 'Wyczyść pamięć'; }, 3000); return; }
      delete wipe.dataset.armed; wipe.textContent = 'Wyczyść pamięć';
      Object.assign(mem, { sessions: 1, clicks: 0, throws: 0, first: Date.now(), stats: {} }); memSave(); panelSync();
    });
    const keys = $('.keys'), K = CFG.keys;
    for (const [k, t] of [[K.summon, 'przywołaj albo psota'], [K.hide, 'schowaj'], [K.serious, 'tryb poważny'], [K.blame, '„to jej wina”'], [K.reward, '„wyszło”: ukłon i nagroda'], [K.fix, 'napraw litery'], [K.panel, 'ten panel']]) {
      const dt = el('dt'), kb = el('kbd', '', k.toUpperCase()); dt.appendChild(kb); keys.append(dt, el('dd', '', t));
    }
    const cvs = $('.chart canvas'), tip = $('.tip');
    cvs.addEventListener('pointermove', e => { const r = cvs.getBoundingClientRect(); chartHover = { x: e.clientX - r.left, y: e.clientY - r.top }; drawChart(); });
    cvs.addEventListener('pointerleave', () => { chartHover = null; tip.hidden = true; drawChart(); });
  }
  function togglePanel(on) {
    panelOpen = on == null ? !panelOpen : !!on;
    panelEl.hidden = !panelOpen;
    if (panelOpen) panelSync();
  }
  const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  function drawChart() {
    const cvs = panelEl.querySelector('.chart canvas'), tip = panelEl.querySelector('.tip');
    const w = Math.max(200, cvs.clientWidth), h = 150, dpr = Math.min(2, devicePixelRatio || 1);
    if (cvs.width !== Math.round(w * dpr)) { cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr); }
    const c = cvs.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const L = 38, R = 10, T = 8, Bm = 22, pw = w - L - R, ph = h - T - Bm, t1 = Math.max(60, clock);
    const X = t => L + t / t1 * pw, Y = v => T + (1 - v) * ph;
    c.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif'; c.fillStyle = '#8E84B3'; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const v of [0, .5, 1]) {
      c.strokeStyle = v === 0 ? '#3A305A' : '#2A2146'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(L, Math.round(Y(v)) + .5); c.lineTo(w - R, Math.round(Y(v)) + .5); c.stroke();
      c.fillText(`${v * 100}%`, L - 6, Y(v));
    }
    const span = t1 / 60, step = span <= 2 ? .5 : span <= 6 ? 1 : span <= 20 ? 5 : span <= 60 ? 10 : 15;
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (let m = 0; m <= span + 1e-6; m += step) c.fillText(fmtT(m * 60), clamp(X(m * 60), L + 12, w - R - 14), h - Bm + 6);
    const stride = Math.max(1, Math.ceil(moodLog.length / pw));
    for (let s = 0; s < EMO.length; s++) {
      c.strokeStyle = SERIES[EMO[s]]; c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i < moodLog.length; i += stride) { const d = moodLog[i], x = X(d.t), y = Y(d.v[s]); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
    }
    if (!chartHover || !moodLog.length) { tip.hidden = true; return; }
    const tq = clamp((chartHover.x - L) / pw, 0, 1) * t1;
    let best = moodLog[0];
    for (const d of moodLog) if (Math.abs(d.t - tq) < Math.abs(best.t - tq)) best = d;
    const x = X(best.t);
    c.strokeStyle = 'rgba(244,240,255,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(Math.round(x) + .5, T); c.lineTo(Math.round(x) + .5, T + ph); c.stroke();
    for (let s = 0; s < EMO.length; s++) { c.fillStyle = '#181030'; c.beginPath(); c.arc(x, Y(best.v[s]), 6, 0, TAU); c.fill(); c.fillStyle = SERIES[EMO[s]]; c.beginPath(); c.arc(x, Y(best.v[s]), 4, 0, TAU); c.fill(); }
    tip.replaceChildren(el('div', 't', fmtT(best.t)));
    EMO.forEach((k, s) => { const r = el('div', 'r'), i = el('i'); i.style.background = SERIES[k]; r.append(i, el('b', '', `${Math.round(best.v[s] * 100)}%`), el('span', '', EMO_PL[k])); tip.appendChild(r); });
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = `${clamp(x + 12 + tw > w ? x - tw - 12 : x + 12, 4, Math.max(4, w - tw - 4))}px`;
    tip.style.top = `${clamp(chartHover.y - th / 2, 4, Math.max(4, h - th))}px`;
  }
  function panelSync() {
    if (!panelEl || !panelOpen) return;
    const $ = s => panelEl.querySelector(s);
    for (const b of panelEl.querySelectorAll('.seg button')) b.setAttribute('aria-pressed', String(b.dataset.mode === CFG.mode));
    $('#osm-serious').checked = serious;
    $('.temper').textContent = temper;
    $('.mode-hint').textContent = CFG.mode === 'demo'
      ? 'Demo: pojawia się na każdym slajdzie, po kolei pokazuje wejścia.'
      : `Wykład: najwcześniej po ${CFG.firstAfterMin} min, co najmniej ${CFG.minGapMin} min przerwy, najwyżej ${CFG.maxAppearances} wejść. Teraz: ${D.appearances}.`;
    for (const row of panelEl.querySelectorAll('.bar')) { const v = Math.round(mood[row.dataset.k] * 100); row.children[1].textContent = `${v}%`; row.querySelector('.bf').style.width = `${v}%`; }
    drawChart();
    const tbl = $('.tbl');
    if (!tbl.hidden) {
      const t = el('table'), hd = el('tr');
      hd.appendChild(el('th', '', 'czas')); for (const k of EMO) hd.appendChild(el('th', 'n', EMO_PL[k]));
      const head = el('thead'); head.appendChild(hd); t.appendChild(head);
      const body = el('tbody');
      for (let i = moodLog.length - 1, n = 0; i >= 0 && n < 15; i -= 5, n++) {
        const d = moodLog[i], tr = el('tr'); tr.appendChild(el('td', '', fmtT(d.t)));
        d.v.forEach(v => tr.appendChild(el('td', 'n', `${Math.round(v * 100)}%`))); body.appendChild(tr);
      }
      t.appendChild(body); tbl.replaceChildren(t);
    }
    const tb = $('.bandit tbody'); tb.replaceChildren();
    for (const [n] of ACTS) {
      if (n[0] === '_') continue;
      const s = stat(n), tr = el('tr');
      tr.append(el('td', '', label(n)), el('td', 'n', String(s.n)), el('td', 'n', String(s.s)));
      tb.appendChild(tr);
    }
    const dl = $('.mem'); dl.replaceChildren();
    for (const [k, v] of [['Wykład nr', mem.sessions], ['Kliknięcia (łącznie)', mem.clicks], ['Rzuty', mem.throws], ['Wejścia w tej sesji', D.appearances], ['Zna was od', new Date(mem.first).toLocaleDateString('pl-PL')]]) dl.append(el('dt', '', k), el('dd', '', String(v)));
  }

  // ---------- frame ----------
  function uiTick(dt) {
    if (oct.on) {
      const w = S * 1.05 * oct.scale, h = S * 1.25 * oct.scale;
      const cx = oct.x + Math.sin(oct.ang) * S * .45 * oct.scale, cy = oct.y - Math.cos(oct.ang) * S * .45 * oct.scale;
      hitEl.style.transform = `translate(${(cx - w / 2).toFixed(1)}px,${(cy - h / 2).toFixed(1)}px)`;
      hitEl.style.width = `${w.toFixed(1)}px`; hitEl.style.height = `${h.toFixed(1)}px`;
    }
    if (!toastEl.hidden && clock > toastUntil) toastEl.hidden = true;
    if (panelOpen && (panelTick -= dt) <= 0) { panelTick = .25; panelSync(); }
  }
  let lastT = performance.now(), dirty = true;
  function frame(now) {
    const dt = clamp((now - lastT) / 1000, .001, .05); lastT = now; clock += dt;
    for (let i = waits.length - 1; i >= 0; i--) if (clock >= waits[i].at) { const w = waits[i]; waits.splice(i, 1); w.res(); }
    moodTick(dt);
    cur.speed = approach(cur.speed, 0, 6, dt);
    octUpdate(dt);
    Letters.update(dt);
    fxUpdate(dt);
    const busy = oct.on || fx.p.length || fx.ghosts.length || fx.emotes.length || fx.rings.length;
    if (busy || dirty) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, VW, VH);
      if (busy) { fxDrawBack(ctx); if (oct.on) drawOcto(ctx); fxDrawFront(ctx); }
      dirty = !!busy;
    }
    uiTick(dt);
    requestAnimationFrame(frame);
  }
  function resize() {
    VW = innerWidth; VH = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    S = clamp(Math.min(VH * CFG.size, VW * .17), 46, 140);
    world.floor = { kind: 'floor', x1: -1e5, x2: 1e5, y: VH };
    dirty = true;
  }
  function currentSlide() {
    if (window.Reveal && Reveal.getCurrentSlide) { try { return Reveal.getCurrentSlide(); } catch (e) { /* not ready */ } }
    return document.querySelector('.slide.active,section.active,.slide.present,section.present,.slide.current,section.current,[data-slide].active');
  }
  function init() {
    memLoad();
    if (Date.now() - (mem.last || 0) > 2 * 3600e3) mem.sessions++;
    mem.last = Date.now();
    setTemper(mem.temperDay === new Date().toDateString() && TEMPERS[mem.temper] ? mem.temper : rollTemper());
    Object.assign(mood, BASE);
    host = document.createElement('div');
    host.setAttribute('data-osmiornica-host', '');
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLE}</style><canvas class="stage" aria-hidden="true"></canvas><div class="hit" role="button" tabindex="-1"></div><div class="dim"></div><div class="toast" role="status" hidden></div><aside class="panel" aria-label="Panel prowadzącego" hidden></aside>`;
    document.body.appendChild(host);
    cv = root.querySelector('.stage'); ctx = cv.getContext('2d');
    hitEl = root.querySelector('.hit'); dimEl = root.querySelector('.dim');
    toastEl = root.querySelector('.toast'); panelEl = root.querySelector('.panel');
    hitEl.setAttribute('aria-label', `${CFG.name}, ośmiornica`);
    const st = document.createElement('style'); st.textContent = '.osm-krzywa{cursor:pointer}'; document.head.appendChild(st);
    makeArms(); resize(); buildPanel(); bindInput();
    // slide hooks: explicit events, reveal.js, or class changes on slides
    let manual = false;
    document.addEventListener('slidechange', e => { manual = true; slideChanged((e.detail && e.detail.slide) || null); });
    if (window.Reveal && Reveal.on) Reveal.on('slidechanged', e => slideChanged(e.currentSlide));
    new MutationObserver(ms => {
      if (manual) return;
      for (const m of ms) {
        const t = m.target;
        if (t.nodeType === 1 && t.matches('section,.slide,[data-slide]') && ['active', 'present', 'current'].some(c => t.classList.contains(c))) { slideChanged(t); break; }
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    D.start = clock;
    slideChanged(currentSlide() || document.body);
    requestAnimationFrame(frame);
  }

  window.Osmiornica = {
    summon: name => { if (name) { if (!serious) perform(name); } else summon(); },
    hide: () => perform('_wyjscie'),
    serious: on => setSerious(on == null ? !serious : !!on),
    reward,
    fix: () => Letters.fixAll(),
    panel: on => togglePanel(on),
    slideChanged,
    mode: m => { CFG.mode = m; panelSync(); },
    temper: t => { if (t) { setTemper(t); panelSync(); } return temper; },
    get mood() { return Object.assign({}, mood); },
    get state() { return state; },
    config: CFG,
    actions: ACTS.map(a => a[0]),
    _dev: { oct, mood, thought, spawn, setPose, expr, startle, look, lookAt, rest, refreshWorld, perform, cancelAll, think, crossArms },
  };
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
