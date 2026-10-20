/* manim-lite: 브라우저에서 도는 아주 작은 Manim 흉내 엔진.
   좌표는 Manim과 같다: 화면 가로 14.22, 세로 8, 원점은 가운데, y는 위쪽이 +. */
(function (global) {
  "use strict";

  const FRAME_W = 14.222, FRAME_H = 8;
  const C = {
    WHITE: "#ffffff", GREY: "#888888", BLACK: "#000000",
    BLUE: "#58c4dd", TEAL: "#5cd0b3", GREEN: "#83c167", YELLOW: "#ffff00",
    GOLD: "#f0ac5f", RED: "#fc6255", MAROON: "#c55f73", PURPLE: "#9a72ac",
    PINK: "#d147bd", ORANGE: "#ff862f", BROWN: "#8b4513",
  };
  const PALETTE = [C.BLUE, C.YELLOW, C.GREEN, C.RED, C.PURPLE, C.ORANGE, C.TEAL, C.PINK, C.GOLD];
  const BG = "#1e1e1e";

  /* ---------- 색 보간 ---------- */
  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbToHex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpColor = (a, b, t) => {
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex([0, 1, 2].map(i => lerp(x[i], y[i], t)));
  };
  const smooth = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  /* ---------- 장면 상태 ---------- */
  let canvas, ctx, unit = 1, speed = 1;
  let mobs = [];
  let running = [];          // 진행 중인 애니메이션
  let runId = 0;             // 다시 실행하면 이전 코드를 멈추게 하는 토큰
  const ABORT = { aborted: true };

  /* ---------- Mobject ---------- */
  class Mob {
    constructor(o = {}) {
      Object.assign(this, {
        x: 0, y: 0, color: C.WHITE, fill: null, fillOpacity: 0, opacity: 1,
        strokeWidth: 4, scale: 1, rotation: 0, progress: 1, z: 0, parent: null,
      }, o);
    }
    // 애니메이션 없이 바로 바꾸는 편의 메서드 (체인 가능)
    set(o) { Object.assign(this, o); return this; }
    moveTo(x, y) { if (Array.isArray(x)) [x, y] = x; this.x = x; this.y = y; return this; }
    shift(dx, dy) { if (Array.isArray(dx)) [dx, dy] = dx; this.x += dx; this.y += dy; return this; }
    get pos() { return [this.x, this.y]; }
    render(c) {
      if (this.opacity <= 0.001 || this.progress <= 0) return;
      c.save();
      c.translate(this.x, this.y);
      if (this.rotation) c.rotate(this.rotation * Math.PI / 180);
      if (this.scale !== 1) c.scale(this.scale, this.scale);
      c.globalAlpha *= this.opacity;
      this.draw(c);
      c.restore();
    }
    strokeFill(c, path) {
      if (this.fill && this.fillOpacity > 0) {
        c.save(); c.globalAlpha *= this.fillOpacity * Math.min(1, this.progress * 1.5);
        c.fillStyle = this.fill; c.fill(path); c.restore();
      }
      if (this.strokeWidth > 0) {
        c.strokeStyle = this.color; c.lineWidth = this.strokeWidth / unit;
        c.lineCap = "round"; c.lineJoin = "round"; c.stroke(path);
      }
    }
  }

  class Circle extends Mob {
    constructor(o = {}) { super(Object.assign({ r: 1 }, o)); }
    draw(c) {
      const p = new Path2D();
      p.arc(0, 0, this.r, -Math.PI / 2, -Math.PI / 2 - this.progress * 2 * Math.PI, true);
      this.strokeFill(c, p);
    }
  }
  class Dot extends Circle {
    constructor(o = {}) { super(Object.assign({ r: 0.08, strokeWidth: 0, fillOpacity: 1 }, o)); if (!this.fill) this.fill = this.color; }
  }
  class Rect extends Mob {
    constructor(o = {}) { super(Object.assign({ w: 2, h: 1, radius: 0 }, o)); }
    draw(c) {
      const { w, h } = this, p = new Path2D();
      if (this.progress >= 1) {
        if (this.radius) p.roundRect(-w / 2, -h / 2, w, h, this.radius); else p.rect(-w / 2, -h / 2, w, h);
      } else {
        // 테두리를 그려 나가는 효과
        const pts = [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2], [-w / 2, h / 2]];
        partialPolyline(p, pts, this.progress);
      }
      this.strokeFill(c, p);
    }
  }
  class Square extends Rect {
    constructor(o = {}) { const s = o.side ?? 2; super(Object.assign({ w: s, h: s }, o)); }
  }
  class Polyline extends Mob {
    constructor(points, o = {}) { super(Object.assign({ points }, o)); }
    draw(c) { const p = new Path2D(); partialPolyline(p, this.points, this.progress); this.strokeFill(c, p); }
  }
  class Line extends Polyline {
    constructor(a, b, o = {}) { super([a, b], o); }
  }
  class Arrow extends Polyline {
    constructor(a, b, o = {}) { super([a, b], Object.assign({ tip: 0.22 }, o)); }
    draw(c) {
      super.draw(c);
      if (this.progress < 0.98) return;
      const [a, b] = this.points, ang = Math.atan2(b[1] - a[1], b[0] - a[0]), t = this.tip;
      const p = new Path2D();
      p.moveTo(b[0], b[1]);
      p.lineTo(b[0] - t * Math.cos(ang - .45), b[1] - t * Math.sin(ang - .45));
      p.lineTo(b[0] - t * Math.cos(ang + .45), b[1] - t * Math.sin(ang + .45));
      p.closePath();
      c.fillStyle = this.color; c.fill(p);
    }
  }
  class Text extends Mob {
    constructor(text, o = {}) { super(Object.assign({ text: String(text), size: 0.5, weight: 700, align: "center", font: "" }, o)); }
    draw(c) {
      const shown = this.progress >= 1 ? this.text : [...this.text].slice(0, Math.ceil([...this.text].length * this.progress)).join("");
      // 캔버스 글자는 y가 아래로 가므로 뒤집고, 1px보다 작은 글꼴이 뭉개지지 않게 100배로 그려서 줄임
      c.scale(0.01, -0.01);
      c.font = `${this.weight} ${this.size * 100}px ${this.font || '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif'}`;
      c.textAlign = this.align; c.textBaseline = "middle";
      c.fillStyle = this.color;
      c.fillText(shown, 0, 0);
    }
  }
  // 동그라미 안에 글자 하나: 사람·글자 카드처럼 쓰는 토큰
  class Token extends Mob {
    constructor(label, o = {}) { super(Object.assign({ label: String(label), r: 0.38, color: C.BLUE, textColor: BG, size: null }, o)); }
    draw(c) {
      const p = new Path2D(); p.arc(0, 0, this.r, 0, 2 * Math.PI);
      c.fillStyle = this.color; c.fill(p);
      c.scale(0.01, -0.01);
      c.font = `800 ${(this.size || this.r * 1.05) * 100}px "Noto Sans KR","Malgun Gothic",sans-serif`;
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = this.textColor;
      c.fillText(this.label, 0, this.r * 4);
    }
  }
  // 묶음: 자식의 위치를 묶음 기준으로 저장. 회전해도 글자는 똑바로 선다.
  class Group extends Mob {
    constructor(children, o = {}) {
      super(o);
      const cx = o.x ?? 0, cy = o.y ?? 0;
      const wasShown = children.some(m => mobs.includes(m));
      this.children = children;
      children.forEach(m => { m.x -= cx; m.y -= cy; m.parent = this; remove(m); });
      if (wasShown) add(this);
    }
    render(c) {
      if (this.opacity <= 0.001) return;
      c.save();
      c.translate(this.x, this.y);
      if (this.scale !== 1) c.scale(this.scale, this.scale);
      c.globalAlpha *= this.opacity;
      const th = this.rotation * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
      for (const m of this.children) {
        const { x, y } = m;
        m.x = x * cs - y * sn; m.y = x * sn + y * cs;
        m.render(c);
        m.x = x; m.y = y;
      }
      c.restore();
    }
  }

  function partialPolyline(p, pts, t) {
    if (pts.length < 2) return;
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
    let left = total * Math.max(0, Math.min(1, t));
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const k = Math.min(1, left / (seg[i - 1] || 1));
      p.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
      left -= seg[i - 1];
    }
  }

  /* ---------- 장면 조작 ---------- */
  function add(...ms) { for (const m of ms.flat()) if (!mobs.includes(m)) mobs.push(m); return ms[0]; }
  function remove(...ms) { for (const m of ms.flat()) mobs = mobs.filter(x => x !== m); }
  function clear() { mobs = []; }

  /* ---------- 애니메이션 ---------- */
  // 모든 애니메이션은 {begin, update(t 0~1), end} 객체. runTime은 기본 1초.
  // o.start: begin 직전에 먼저 넣어 둘 시작값 (예: FadeIn은 opacity 0에서 시작)
  function Animate(mob, target, o = {}) {
    let from;
    const { start, ...rest } = o;
    return Object.assign({
      begin() {
        add(mob.parent ? [] : mob);
        if (start) Object.assign(mob, start);
        from = {};
        for (const k in target) from[k] = mob[k];
      },
      update(t) {
        for (const k in target) {
          const a = from[k], b = target[k];
          if (typeof b === "number") mob[k] = lerp(a, b, t);
          else if (typeof b === "string" && /^#/.test(b) && typeof a === "string" && /^#/.test(a)) mob[k] = lerpColor(a, b, t);
          else if (t >= 1) mob[k] = b;
        }
      },
      end() {},
    }, rest);
  }
  const MoveTo = (mob, x, y, o) => { if (Array.isArray(x)) { o = y; [x, y] = x; } return Animate(mob, { x, y }, o); };
  const Shift = (mob, dx, dy, o) => { if (Array.isArray(dx)) { o = dy; [dx, dy] = dx; } const a = Animate(mob, {}, o); let x0, y0;
    a.begin = () => { add(mob.parent ? [] : mob); x0 = mob.x; y0 = mob.y; };
    a.update = t => { mob.x = x0 + dx * t; mob.y = y0 + dy * t; }; return a; };
  const Rotate = (mob, deg, o) => { const a = Animate(mob, {}, o); let r0;
    a.begin = () => { add(mob.parent ? [] : mob); r0 = mob.rotation; };
    a.update = t => { mob.rotation = r0 + deg * t; }; return a; };
  const FadeIn = (mob, o = {}) => Animate(mob, { opacity: mob.opacity || 1 }, { start: { opacity: 0, progress: 1 }, ...o });
  const FadeOut = (mob, o = {}) => { const a = Animate(mob, { opacity: 0 }, o); a.end = () => { remove(mob); mob.opacity = 0; }; return a; };
  const Create = (mob, o = {}) => Animate(mob, { progress: 1 }, { start: { progress: 0 }, ...o });
  const Write = Create;
  const Uncreate = (mob, o = {}) => { const a = Animate(mob, { progress: 0 }, o); a.end = () => remove(mob); return a; };
  const ChangeColor = (mob, color, o) => Animate(mob, { color }, o);
  const ScaleTo = (mob, scale, o) => Animate(mob, { scale }, o);
  // a가 사라지면서 b가 a 자리에서 제자리로 날아온다
  const ReplacementTransform = (a, b, o = {}) => {
    let ax, ay, bx, by, aop;
    return Object.assign({
      begin() { ax = a.x; ay = a.y; bx = b.x; by = b.y; aop = a.opacity; b.x = ax; b.y = ay; b.opacity = 0; add(b); },
      update(t) {
        a.x = lerp(ax, bx, t); a.y = lerp(ay, by, t); a.opacity = aop * (1 - t);
        b.x = lerp(ax, bx, t); b.y = lerp(ay, by, t); b.opacity = t;
      },
      end() { remove(a); a.x = ax; a.y = ay; a.opacity = aop; },
    }, o);
  };
  const Transform = ReplacementTransform;
  const Indicate = (mob, o = {}) => { let s0, c0; return Object.assign({
    begin() { s0 = mob.scale; c0 = mob.color; },
    update(t) { const k = Math.sin(Math.PI * t); mob.scale = s0 * (1 + 0.25 * k); mob.color = lerpColor(c0, C.YELLOW, k); },
    end() { mob.scale = s0; mob.color = c0; },
  }, o); };
  // 글자 속 숫자를 from에서 to까지 세어 올라감. fmt(n)으로 글자를 만든다.
  const CountTo = (txt, from, to, fmt = n => String(n), o = {}) => Object.assign({
    begin() { add(txt); },
    update(t) { txt.text = fmt(Math.round(lerp(from, to, t))); },
    end() {},
  }, { ease: t => t }, o);
  // 여러 애니메이션을 조금씩 늦게 시작
  const LaggedStart = (anims, lag = 0.1, o = {}) => {
    anims = anims.flat();
    const n = anims.length, span = 1 / (1 + lag * Math.max(0, n - 1) * 1);
    const started = new Set();
    return Object.assign({
      runTime: o.runTime ?? Math.max(1, 0.6 + lag * n),
      begin() {},
      update(t) {
        anims.forEach((a, i) => {
          const t0 = (i * lag * span), t1 = Math.min(1, t0 + span);
          if (t >= t0 && !started.has(a)) { started.add(a); a.begin(); }
          if (started.has(a)) a.update((a.ease || smooth)(Math.max(0, Math.min(1, (t - t0) / (t1 - t0)))));
        });
      },
      end() { anims.forEach(a => { if (!started.has(a)) { a.begin(); } a.update(1); a.end(); }); },
      ease: t => t,
    }, o);
  };

  // play(anim, anim, ..., {runTime})
  function play(...args) {
    const myRun = runId;
    let opts = {};
    if (args.length && !args[args.length - 1].begin && typeof args[args.length - 1] === "object" && !Array.isArray(args[args.length - 1])) opts = args.pop();
    const anims = args.flat();
    if (myRun !== runId) return Promise.reject(ABORT);
    anims.forEach(a => a.begin());
    const dur = (opts.runTime ?? Math.max(...anims.map(a => a.runTime ?? 1))) * 1000;
    return new Promise((resolve, reject) => {
      running.push({ anims, t0: performance.now(), dur, resolve, reject, run: myRun, ease: opts.ease });
    });
  }
  function wait(sec = 1) {
    const myRun = runId;
    return new Promise((resolve, reject) => {
      running.push({ anims: [], t0: performance.now(), dur: sec * 1000, resolve, reject, run: myRun });
    });
  }

  function tick(now) {
    for (const job of running.slice()) {
      if (job.run !== runId) { running.splice(running.indexOf(job), 1); job.reject(ABORT); continue; }
      job.elapsed = (job.elapsed || 0) + (job.last ? (now - job.last) * speed : 0);
      job.last = now;
      const t = job.dur ? Math.min(1, job.elapsed / job.dur) : 1;
      for (const a of job.anims) a.update((a.ease || job.ease || smooth)(t));
      if (t >= 1) {
        for (const a of job.anims) a.end();
        running.splice(running.indexOf(job), 1);
        job.resolve();
      }
    }
    draw();
    requestAnimationFrame(tick);
  }

  function draw() {
    if (!canvas) return;
    const w = canvas.width, h = canvas.height;
    unit = w / FRAME_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
    ctx.setTransform(unit, 0, 0, -unit, w / 2, h / 2);
    for (const m of mobs.slice().sort((a, b) => a.z - b.z)) m.render(ctx);
  }

  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.width * dpr * FRAME_H / FRAME_W);
  }

  /* ---------- 수학 도우미 ---------- */
  const fact = n => n <= 1 ? 1 : n * fact(n - 1);
  const comb = (n, r) => fact(n) / (fact(r) * fact(n - r));
  const range = (a, b) => b === undefined ? [...Array(a).keys()] : [...Array(b - a).keys()].map(i => i + a);
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹", SUB = "₀₁₂₃₄₅₆₇₈₉";
  const sup = n => String(n).split("").map(d => SUP[d]).join("");
  const sub = n => String(n).split("").map(d => SUB[d]).join("");
  const polar = (r, deg, cx = 0, cy = 0) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
  // 같은 것이 있는 순열을 중복 없이 모두 나열
  function distinctPerms(arr) {
    const out = [], a = arr.slice().sort(), used = Array(a.length).fill(false), cur = [];
    (function go() {
      if (cur.length === a.length) { out.push(cur.join("")); return; }
      for (let i = 0; i < a.length; i++) {
        if (used[i] || (i > 0 && a[i] === a[i - 1] && !used[i - 1])) continue;
        used[i] = true; cur.push(a[i]); go(); cur.pop(); used[i] = false;
      }
    })();
    return out;
  }

  /* ---------- 사용자 코드 실행 ---------- */
  // Manim처럼 new 없이 Circle(...)로 만들 수 있게 감싼다
  const make = K => (...a) => new K(...a);
  const api = {
    Mob, Circle: make(Circle), Dot: make(Dot), Rect: make(Rect), Square: make(Square), Line: make(Line),
    Arrow: make(Arrow), Polyline: make(Polyline), Text: make(Text), Token: make(Token), Group: make(Group),
    add, remove, clear, play, wait,
    Animate, MoveTo, Shift, Rotate, FadeIn, FadeOut, Create, Write, Uncreate, ChangeColor, ScaleTo,
    Transform, ReplacementTransform, Indicate, CountTo, LaggedStart,
    fact, comb, range, sup, sub, polar, distinctPerms,
    PALETTE, ...C,
    UP: [0, 1], DOWN: [0, -1], LEFT: [-1, 0], RIGHT: [1, 0], ORIGIN: [0, 0],
  };

  function run(code, onError) {
    runId++;
    for (const job of running.splice(0)) job.reject(ABORT);
    clear();
    const names = Object.keys(api);
    let fn;
    try {
      fn = new Function(...names, `"use strict"; return (async () => {\n${code}\n})();`);
    } catch (e) { onError(e); return; }
    const myRun = runId;
    Promise.resolve()
      .then(() => fn(...names.map(k => api[k])))
      .catch(e => { if (e !== ABORT && myRun === runId) onError(e); });
  }
  function stop() { runId++; for (const job of running.splice(0)) job.reject(ABORT); }

  function mount(el) {
    canvas = el; ctx = el.getContext("2d");
    resize();
    addEventListener("resize", resize);
    requestAnimationFrame(tick);
  }

  global.ManimLite = { mount, run, stop, api, setSpeed: s => { speed = s; } };
})(window);
