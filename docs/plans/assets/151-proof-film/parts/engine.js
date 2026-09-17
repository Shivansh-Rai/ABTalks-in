(() => {
  const SRC_DUR = 67;
  const RECORD = new URLSearchParams(location.search).get("record");
  let REDUCE = false;
  try { REDUCE = !RECORD && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const eo = (x) => 1 - Math.pow(1 - x, 3);
  const prog = (t, a, d) => clamp((t - a) / d);
  const lerp = (a, b, p) => a + (b - a) * p;
  const nums = (s) => s.split(",").map(Number);
  const fmt = (n) => Math.round(n).toLocaleString("en-IN");

  // Every frame must be identical on every render, so randomness is seeded.
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };

  // Output time ↔ source time. Holds play at 2× for the Instagram cut.
  function buildKnots(holds, speed) {
    const k = [[0, 0]]; let s = 0, o = 0;
    for (const [a, b] of holds) { o += a - s; k.push([a, o]); o += (b - a) / speed; k.push([b, o]); s = b; }
    o += SRC_DUR - s; k.push([SRC_DUR, o]);
    return k;
  }
  function interp(k, x, from, to) {
    for (let i = 1; i < k.length; i++) {
      if (x <= k[i][from] || i === k.length - 1) {
        const a = k[i - 1], b = k[i], span = b[from] - a[from];
        return span ? lerp(a[to], b[to], clamp((x - a[from]) / span)) : b[to];
      }
    }
    return x;
  }

  // Shared story numbers (source time).
  const LEVELS = [[-1, "Explorer", 1, 100], [18.4, "Learner", 2, 750], [29.6, "Practitioner", 3, 2500], [45, "Builder", 4, 6000]];
  function xpAt(t) {
    if (t < 17.6) return 50;
    if (t < 28.2) return 50 + 56 * eio(prog(t, 17.6, 0.8));
    if (t < 43.7) return 106 + 2534 * eio(prog(t, 28.2, 2.8));
    if (t < 50.4) return 2640 + 300 * eio(prog(t, 43.7, 0.6));
    return 2940 + 400 * eio(prog(t, 50.4, 0.6));
  }
  function gateAt(t, xp) {
    if (t < 18.4) return "First verified activity ✓";
    if (t < 29.6) return "Next · Practitioner: checked work on 7 days (1/7)";
    if (t < 45) return xp >= 2500 ? "XP ✓ · 1 step to Builder: ship a verified build" : "Next · Builder: 2,500 XP + a verified build";
    return "Next · Proven Builder: finish a program · verify a skill";
  }
  const CHIPS = [
    { a: 6.6, text: "+50 XP", from: "quest1", to: "xp50" },
    { a: 16.8, text: "+56 XP", from: "passBanner", to: "xp" },
    { a: 43.4, text: "+300 XP", from: "checks", to: "xp" },
    { a: 50.1, text: "+400 XP", from: "meRow", to: "xp" },
  ];
  const CLICKS = [{ at: 9.1, anchor: "startBtn" }, { at: 40.7, anchor: "submitBtn" }];
  const HEAT = ["", "#D4EBEC", "#8CC3C8", "#2E8791", "#03535F"];

  function createFilm(stage) {
    const W = +stage.dataset.w, H = +stage.dataset.h;
    const qa = (s) => [...stage.querySelectorAll(s)];
    const ref = (n) => stage.querySelector(`[data-ref="${n}"]`);
    const refs = (n) => qa(`[data-ref="${n}"]`);

    const wins = qa("[data-win]").map((el) => { const [a, b] = nums(el.dataset.win); return { el, a, b, dy: REDUCE ? 0 : +(el.dataset.dy ?? 16) }; });
    const ons = qa("[data-on]").map((el) => ({ el, at: +el.dataset.on }));
    const nows = qa("[data-now]").map((el) => { const [a, b] = nums(el.dataset.now); return { el, a, b }; });
    const shows = qa("[data-show]").map((el) => { const [a, b] = nums(el.dataset.show); return { el, a, b }; });
    const texts = qa("[data-texts]").map((el) => ({ el, list: JSON.parse(el.dataset.texts) }));
    const counts = qa("[data-count]").map((el) => { const [a, b, f, to] = nums(el.dataset.count); return { el, a, b, f, to }; });
    const bars = qa("[data-bar]").map((el) => { const [a, b, f, to] = nums(el.dataset.bar); return { el, a, b, f, to }; });
    const types = qa("[data-type]").map((el) => { const [a, b] = nums(el.dataset.type); return { el, a, b, text: el.dataset.text }; });
    const focuses = qa("[data-focus]").map((el) => { const [a, b] = nums(el.dataset.focus); return { el, a, b }; });
    const grows = qa("[data-grow]").map((el) => ({ el, at: +el.dataset.grow, h: 0 }));
    const stops = qa("[data-stop]").map((el) => { const [a, b] = nums(el.dataset.stop); return { el, a, b }; });

    const holds = (stage.dataset.holds || "").split(";").filter(Boolean).map(nums);
    const knots = buildKnots(holds, 2);
    const film = { stage, W, H, dur: knots[knots.length - 1][1] };
    film.src = (o) => interp(knots, o, 1, 0);
    film.out = (s) => interp(knots, s, 0, 1);

    const chip = ref("chip"), tap = ref("tap"), cursor = ref("cursor"), ripple = ref("ripple");
    const railFill = ref("railFill"), ringArc = ref("ringArc");
    const lvlPills = refs("lvlPill"), xpNames = refs("xpName"), xpNums = refs("xpNum"), xpNexts = refs("xpNext"), xpBars = refs("xpBar"), xpGates = refs("xpGate");

    film.measure = () => grows.forEach((g) => {
      const inner = g.el.firstElementChild;
      g.h = inner.offsetHeight + (parseFloat(getComputedStyle(inner).marginBottom) || 0);
    });
    film.fit = (vp) => { stage.style.transform = RECORD ? "none" : `scale(${vp.clientWidth / W})`; };

    function center(name) {
      const el = stage.querySelector(`[data-anchor="${name}"]`);
      if (!el) return null;
      const sr = stage.getBoundingClientRect(), k = sr.width / W || 1, r = el.getBoundingClientRect();
      const y = el.dataset.anchorY === "top" ? (r.top - sr.top) / k + 40 : (r.top + r.height / 2 - sr.top) / k;
      return [(r.left + r.width / 2 - sr.left) / k, y];
    }

    function drawChip(t) {
      const c = CHIPS.find((c) => t >= c.a && t < c.a + 1.25);
      const from = c && center(c.from), to = c && center(c.to);
      if (!c || !from || !to) { chip.style.opacity = 0; chip.style.visibility = "hidden"; return; }
      const p = (t - c.a) / 1.25, pop = eo(clamp(p / 0.2)), fly = eio(clamp((p - 0.5) / 0.5));
      const pos = REDUCE ? to : [lerp(from[0], to[0], fly), lerp(from[1], to[1], fly)];
      chip.textContent = c.text;
      chip.style.visibility = "visible";
      chip.style.opacity = Math.min(pop, 1 - clamp((p - 0.85) / 0.15));
      chip.style.transform = `translate(${pos[0].toFixed(1)}px,${pos[1].toFixed(1)}px) translate(-50%,-50%) scale(${REDUCE ? 1 : (lerp(0.6, 1, pop) * lerp(1, 0.6, fly)).toFixed(3)})`;
    }

    function drawTap(t) {
      const hit = CLICKS.find((k) => t >= k.at && t < k.at + 0.7);
      const pos = hit && center(hit.anchor);
      if (!pos || REDUCE) { tap.style.opacity = 0; return; }
      const p = (t - hit.at) / 0.7;
      tap.style.opacity = 0.9 * (1 - p);
      tap.style.transform = `translate(${pos[0]}px,${pos[1]}px) scale(${lerp(0.5, 1.35, eo(p))})`;
    }

    function drawCursor(t) {
      const hit = CLICKS.find((k) => t >= k.at - 1.3 && t < k.at + 0.9);
      const pos = hit && center(hit.anchor);
      if (!pos || REDUCE) { cursor.style.opacity = 0; return; }
      const [x, y] = pos, mv = eio(prog(t, hit.at - 1.2, 1.0)), leave = eio(prog(t, hit.at + 0.35, 0.5));
      const px = lerp(lerp(x + 190, x, mv), x + 70, leave), py = lerp(lerp(y + 140, y, mv), y + 46, leave);
      const press = t >= hit.at && t < hit.at + 0.16 ? 0.84 : 1;
      cursor.style.opacity = Math.min(prog(t, hit.at - 1.3, 0.25), 1 - prog(t, hit.at + 0.6, 0.3));
      cursor.style.transform = `translate(${(px - 5).toFixed(1)}px,${(py - 2.5).toFixed(1)}px) scale(${press})`;
      const rp = prog(t, hit.at, 0.5);
      ripple.style.opacity = t >= hit.at && rp < 1 ? 0.9 * (1 - rp) : 0;
      ripple.style.transform = `scale(${lerp(0.4, 2.2, eo(rp))})`;
    }

    // Heatmap: 26 weeks × 7 days. Day 1 is Wednesday of week 19; "seven weeks later" is Thursday of week 26.
    const heat = ref("heat"), hx = heat && heat.getContext("2d");
    const idx = (c, r) => c * 7 + r;
    const laterCells = [];
    { const R = rng(42); for (let i = idx(18, 3); i <= idx(25, 3); i++) { const r = R(); laterCells.push({ i, lv: r < 0.3 ? 0 : r < 0.5 ? 1 : r < 0.72 ? 2 : r < 0.9 ? 3 : 4 }); } }
    function drawHeat(t) {
      if (!hx) return;
      const cell = +heat.dataset.cell, gap = +heat.dataset.gap, empty = heat.dataset.empty, future = heat.dataset.future;
      hx.setTransform(2, 0, 0, 2, 0, 0);
      hx.clearRect(0, 0, heat.width / 2, heat.height / 2);
      const today = t < 27.4 ? idx(18, 2) : idx(25, 3), lit = new Map();
      if (t >= 17) lit.set(idx(18, 2), 2);
      const n = Math.floor(eio(prog(t, 28.2, 2.8)) * laterCells.length);
      for (let k = 0; k < n; k++) if (laterCells[k].lv) lit.set(laterCells[k].i, laterCells[k].lv);
      if (t >= 43.4) lit.set(idx(25, 3), 4);
      const rad = Math.max(2, cell / 5);
      for (let c = 0; c < 26; c++) for (let r = 0; r < 7; r++) {
        const i = idx(c, r), x = c * (cell + gap), y = r * (cell + gap);
        hx.beginPath(); hx.roundRect(x, y, cell, cell, rad);
        hx.fillStyle = i > today ? future : (HEAT[lit.get(i) || 0] || empty);
        hx.fill();
        if (i === today) { hx.lineWidth = Math.max(1.2, cell / 10); hx.strokeStyle = "#03535F"; hx.stroke(); }
      }
    }

    // Level-up burst: squares from the same heatmap vocabulary.
    const burst = ref("burst"), bx = burst && burst.getContext("2d");
    const PARTS = (() => { const R = rng(7); return Array.from({ length: 84 }, (_, i) => ({ ang: i * 2.39996 + R() * 0.4, sp: 110 + R() * 250, sz: 6 + R() * 10, dl: R() * 0.3, col: ["#FFFFFF", "#D4EBEC", "#18D39B", "#FFFFFF"][i % 4], rot: R() * 6 })); })();
    function drawBurst(t) {
      if (!bx || t < 44.6 || t > 47.7) return;
      const cw = burst.width / 2, ch = burst.height / 2, cx = +burst.dataset.cx, cy = +burst.dataset.cy, f = Math.min(2.2, cw / 390);
      bx.setTransform(2, 0, 0, 2, 0, 0);
      bx.clearRect(0, 0, cw, ch);
      if (REDUCE) return;
      for (const q of PARTS) {
        const p = prog(t, 44.85 + q.dl, 1.7);
        if (p <= 0 || p >= 1) continue;
        const r = eo(p) * q.sp * f, x = cx + Math.cos(q.ang) * r, y = cy + Math.sin(q.ang) * r + p * p * 60 * f;
        bx.save(); bx.translate(x, y); bx.rotate(q.rot + p * 2); bx.globalAlpha = (1 - p) * 0.95;
        bx.fillStyle = q.col; bx.beginPath(); bx.roundRect(-q.sz / 2, -q.sz / 2, q.sz, q.sz, 3); bx.fill(); bx.restore();
      }
    }

    // Outro: a stage-wide contribution grid that fills along the long axis.
    const og = ref("outroGrid"), ox = og && og.getContext("2d");
    if (og) { og.width = W; og.height = H; }
    const cols = Math.ceil(W / 30) + 1, rows = Math.ceil(H / 30) + 1, landscape = W >= H;
    const OCELLS = (() => { const R = rng(99), a = []; for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) a.push({ c, r, v: R(), lv: 1 + Math.floor(R() * 4) }); return a; })();
    function drawOutro(t) {
      if (!ox || t < 60.6) return;
      ox.clearRect(0, 0, W, H);
      const front = eio(prog(t, 60.8, 2.4)) * ((landscape ? cols : rows) + 2);
      for (const k of OCELLS) {
        if (k.v > 0.42 || (landscape ? k.c : k.r) > front) continue;
        const x = k.c * 30 + 6, y = k.r * 30 + 6, dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
        ox.globalAlpha = clamp((Math.sqrt(dx * dx + dy * dy) - 0.35) * 1.1) * 0.5;
        ox.fillStyle = HEAT[k.lv];
        ox.beginPath(); ox.roundRect(x, y, 22, 22, 4); ox.fill();
      }
      ox.globalAlpha = 1;
    }

    film.render = (t) => {
      for (const w of wins) {
        if (t < w.a || t > w.b) { w.el.style.opacity = 0; w.el.style.visibility = "hidden"; continue; }
        const i = w.a < 0 ? 1 : eio(clamp((t - w.a) / 0.55)), out = w.b > 90 ? 1 : eio(clamp((w.b - t) / 0.45));
        const o = Math.min(i, out);
        w.el.style.opacity = o;
        w.el.style.visibility = o > 0.001 ? "visible" : "hidden";
        const ty = (1 - i) * w.dy - (1 - out) * w.dy * 0.35;
        w.el.style.transform = ty ? `translateY(${ty.toFixed(2)}px)` : "";
      }
      for (const x of ons) x.el.classList.toggle("on", t >= x.at);
      for (const x of nows) x.el.classList.toggle("now", t >= x.a && t < x.b);
      for (const x of shows) x.el.style.display = t >= x.a && t < x.b ? "" : "none";
      for (const x of texts) { let v = x.list[0][1]; for (const [at, s] of x.list) if (t >= at) v = s; if (x.el.textContent !== v) x.el.textContent = v; }
      for (const x of counts) x.el.textContent = fmt(lerp(x.f, x.to, eio(prog(t, x.a, x.b - x.a))));
      for (const x of bars) x.el.style.width = lerp(x.f, x.to, eio(prog(t, x.a, x.b - x.a))) + "%";
      for (const x of focuses) x.el.classList.toggle("focus", t >= x.a && t < x.b);
      for (const x of types) {
        const n = Math.round(x.text.length * prog(t, x.a, x.b - x.a));
        const caret = t >= x.a - 0.3 && t < x.b + 0.5 && Math.floor(t * 2.6) % 2 === 0;
        x.el.textContent = t < x.a ? "" : x.text.slice(0, n);
        if (caret) { const c = document.createElement("span"); c.className = "caret"; x.el.append(c); }
      }
      for (const g of grows) {
        const p = REDUCE ? (t >= g.at ? 1 : 0) : eo(prog(t, g.at, 0.6));
        g.el.style.height = (g.h * p).toFixed(1) + "px";
        g.el.style.opacity = REDUCE ? p : prog(t, g.at + 0.15, 0.45);
      }
      let fill = 0;
      stops.forEach((s, k) => {
        s.el.classList.toggle("on", t >= s.a && t < s.b);
        s.el.classList.toggle("done", t >= s.b);
        if (k > 0) fill += eo(prog(t, s.a, 0.9)) * 25;
      });
      if (railFill) railFill.style.width = fill + "%";

      const xp = xpAt(t);
      let L = LEVELS[0]; for (const l of LEVELS) if (t >= l[0]) L = l;
      const pulse = L[0] > 0 && t < L[0] + 1.4;
      lvlPills.forEach((el) => { el.textContent = `${L[1]} · L${L[2]}`; el.classList.toggle("pulse", pulse); });
      xpNames.forEach((el) => { el.textContent = `${L[1]} · Level ${L[2]}`; });
      xpNums.forEach((el) => { el.textContent = fmt(xp); });
      xpNexts.forEach((el) => { el.textContent = fmt(L[3]) + (el.closest(".wrail") ? " XP" : ""); });
      xpBars.forEach((el) => { el.style.width = Math.min(100, (xp / L[3]) * 100) + "%"; });
      xpGates.forEach((el) => { el.textContent = gateAt(t, xp); });
      if (ringArc) ringArc.setAttribute("stroke-dashoffset", (502.65 * (1 - eio(prog(t, 44.9, 1.0)))).toFixed(2));

      drawChip(t);
      if (tap) drawTap(t);
      if (cursor) drawCursor(t);
      drawHeat(t); drawBurst(t); drawOutro(t);
    };
    return film;
  }

  // ── Player ─────────────────────────────────────────────────
  const films = {};
  document.querySelectorAll(".stage").forEach((s) => { films[s.dataset.stage] = createFilm(s); });
  const viewports = [...document.querySelectorAll(".viewport")];
  const vpOf = (cut) => viewports.find((v) => v.dataset.cut === cut);
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  if (RECORD) {
    document.body.classList.add("record");
    const film = films[RECORD];
    viewports.forEach((v) => { v.hidden = v.dataset.cut !== RECORD; });
    const vp = vpOf(RECORD);
    vp.style.width = film.W + "px"; vp.style.height = film.H + "px";
    film.fit(vp); film.measure(); film.render(0);
    window.__dur = film.dur;
    window.__size = [film.W, film.H];
    window.__seek = (o) => { film.render(film.src(o)); return true; };
    window.__outOf = (src) => film.out(src);
    window.__ready = fontsReady.then(() => { film.measure(); film.render(0); return true; });
    return;
  }

  const CHAPTERS = [["Intro", 0, 3], ["First Steps", 4.2, 9], ["Mission", 10.2, 19.5], ["Badge", 20.3, 24], ["Streak", 27.4, 34.5], ["Hackathon", 35.5, 43.8], ["Results", 47.6, 52.8], ["Recruiter view", 53.7, 59.8], ["Outro", 60.6, 66]];
  const $ = (s) => document.querySelector(s);
  const playBtn = $("#play"), timeEl = $("#time"), scrub = $("#scrub"), chaps = $("#chaps");
  const tabs = [...document.querySelectorAll(".cuts button")];
  const PAUSE_SVG = '<rect x="3" y="2" width="3.5" height="12" rx="1" fill="#fff"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="#fff"/>';
  const PLAY_SVG = '<path d="M4 2.5v11l9.5-5.5z" fill="#fff"/>';
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  tabs.forEach((b) => { const f = films[b.dataset.cut]; b.querySelector("small").textContent = mmss(f.dur); });

  let cut = "mobile", film = films.mobile, t = 0, playing = false, last = null, dragging = false, chapButtons = [];

  // Soundtrack: one track per timeline. Mobile and web share the full-length track.
  const soundBtn = $("#sound");
  const sndMain = document.getElementById("snd-main"), sndIg = document.getElementById("snd-instagram");
  const tracks = { mobile: sndMain, web: sndMain, ig: sndIg };
  let soundOn = false;
  const SOUND_ON_SVG = '<path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor"/><path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.5 6.5 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
  const SOUND_OFF_SVG = '<path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor"/><path d="M10.5 6l4 4M14.5 6l-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
  const pauseAudio = () => { for (const a of new Set(Object.values(tracks))) if (a && !a.paused) a.pause(); };
  function syncSoundBtn() {
    soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    soundBtn.querySelector("svg").innerHTML = soundOn ? SOUND_ON_SVG : SOUND_OFF_SVG;
    soundBtn.querySelector("span").textContent = soundOn ? "Sound on" : "Sound off";
  }
  function startAudio() {
    const a = tracks[cut];
    if (!a) return;
    a.currentTime = t;
    const p = a.play();
    if (p) p.catch(() => { soundOn = false; syncSoundBtn(); });
  }
  if (!sndMain && !sndIg) soundBtn.hidden = true;
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn; syncSoundBtn();
    if (!soundOn) pauseAudio();
    else { if (!playing) { if (t >= film.dur) t = 0; playing = true; } startAudio(); }
  });
  syncSoundBtn();
  try { const saved = localStorage.getItem("abtalks-proof-film-cut"); if (films[saved]) cut = saved; } catch (e) {}
  const hash = location.hash.slice(1); if (films[hash]) cut = hash;

  function select(next) {
    pauseAudio();
    cut = next; film = films[next];
    viewports.forEach((v) => { v.hidden = v.dataset.cut !== next; });
    tabs.forEach((b) => b.setAttribute("aria-selected", b.dataset.cut === next ? "true" : "false"));
    film.fit(vpOf(next)); film.measure();
    scrub.max = film.dur.toFixed(2);
    t = REDUCE ? film.out(3) : 0; playing = !REDUCE;
    chaps.innerHTML = "";
    chapButtons = CHAPTERS.map(([name, start, rest]) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = name;
      b.addEventListener("click", () => { t = film.out(REDUCE ? rest : start); if (!REDUCE) playing = true; });
      chaps.append(b); return b;
    });
    try { localStorage.setItem("abtalks-proof-film-cut", next); } catch (e) {}
  }
  tabs.forEach((b) => b.addEventListener("click", () => select(b.dataset.cut)));
  const toggle = () => { if (!playing && t >= film.dur) t = 0; playing = !playing; };
  playBtn.addEventListener("click", toggle);
  scrub.addEventListener("input", () => { dragging = true; t = +scrub.value; });
  scrub.addEventListener("change", () => { dragging = false; });
  addEventListener("keydown", (e) => {
    const tag = e.target.tagName;
    if (e.key === " " && tag !== "BUTTON" && tag !== "INPUT") { e.preventDefault(); toggle(); }
    if (tag === "INPUT") return;
    if (e.key === "ArrowRight") t = Math.min(film.dur, t + 5);
    if (e.key === "ArrowLeft") t = Math.max(0, t - 5);
  });
  addEventListener("resize", () => film.fit(vpOf(cut)));

  function frame(ts) {
    if (playing && last != null) { t += Math.min(0.1, (ts - last) / 1000); if (t >= film.dur) { t = film.dur; playing = false; } }
    last = playing ? ts : null;
    const a = soundOn ? tracks[cut] : null;
    if (a) {
      if (!playing) { if (!a.paused) a.pause(); }
      else if (a.paused) { if (!a.ended && t < film.dur - 0.1) startAudio(); }
      else if (Math.abs(a.currentTime - t) > 0.25) a.currentTime = t;  // a seek or a stall: realign
      else t = a.currentTime;                                           // otherwise the audio is the clock
    }
    film.render(film.src(t));
    playBtn.querySelector("svg").innerHTML = playing ? PAUSE_SVG : PLAY_SVG;
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    timeEl.textContent = `${mmss(t)} / ${mmss(film.dur)}`;
    if (!dragging) scrub.value = t;
    const s = film.src(t); let cur = 0; CHAPTERS.forEach((c, k) => { if (s >= c[1]) cur = k; });
    chapButtons.forEach((b, k) => b.setAttribute("aria-current", k === cur ? "true" : "false"));
    requestAnimationFrame(frame);
  }
  select(cut);
  fontsReady.then(() => { film.fit(vpOf(cut)); film.measure(); });
  requestAnimationFrame(frame);
})();
