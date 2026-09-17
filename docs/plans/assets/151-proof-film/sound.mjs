// Soundtrack for the Proof Film: a light music bed plus UI sound effects synced to
// on-screen events. No voice. Everything is synthesized here except
// public/sounds/click.mp3, the app's own UI click, used for taps and clicks.
//
// Usage: node docs/plans/assets/151-proof-film/sound.mjs
// Needs ffmpeg on PATH and the MP4s from record.mjs. Deterministic: the same
// script always produces the same audio. Re-running replaces the audio track.
import { spawnSync } from "node:child_process";
import { renameSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const SRC_DUR = 67;
const TAU = Math.PI * 2;

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${String(r.stderr).slice(-400)}`);
  return r.stdout;
};

// ── Time map: identical to engine.js, so effects land on the same frames ──────
function buildKnots(holds, speed = 2) {
  const k = [[0, 0]]; let s = 0, o = 0;
  for (const [a, b] of holds) { o += a - s; k.push([a, o]); o += (b - a) / speed; k.push([b, o]); s = b; }
  o += SRC_DUR - s; k.push([SRC_DUR, o]);
  return k;
}
function mapTime(k, x) {
  for (let i = 1; i < k.length; i++) {
    if (x <= k[i][0] || i === k.length - 1) {
      const a = k[i - 1], b = k[i], span = b[0] - a[0];
      return span ? a[1] + (b[1] - a[1]) * Math.min(1, Math.max(0, (x - a[0]) / span)) : b[1];
    }
  }
  return x;
}
const igHolds = readFileSync(join(DIR, "parts/stages.html"), "utf8")
  .match(/data-stage="ig"[^>]*data-holds="([^"]+)"/)[1]
  .split(";").map((p) => p.split(",").map(Number));

const CUTS = {
  main: { knots: buildKnots([]), videos: ["abtalks-proof-film-mobile.mp4", "abtalks-proof-film-web.mp4"] },
  instagram: { knots: buildKnots(igHolds), videos: ["abtalks-proof-film-instagram.mp4"] },
};

// ── On-screen events, in source seconds (see data-* timings in parts/) ──────────
const EVENTS = [
  ["whoosh", 4.2], ["tick", 6.6, { n: 0 }], ["xp", 6.75], ["tick", 8.0, { n: 1 }],
  ["click", 9.1], ["whoosh", 9.7],
  ["type", 11.2, { until: 12.1, chars: 23 }],
  ["line", 12.4], ["line", 13.3], ["line", 14.2], ["line", 15.1], ["pass", 16.0], ["xp", 16.9], ["levelSmall", 18.4],
  ["whoosh", 20.15], ["badge", 20.4],
  ["whooshBig", 27.3], ["count", 28.2, { until: 31 }], ["pop", 31.2, { n: 0 }], ["pop", 31.7, { n: 1 }], ["pop", 32.2, { n: 2 }], ["tick", 32.5, { n: 3 }],
  ["whoosh", 35.45], ["whoosh", 37.85],
  ["type", 38.4, { until: 39.6, chars: 31 }], ["type", 39.8, { until: 40.5, chars: 21 }], ["click", 40.7],
  ["check", 41.4, { n: 0 }], ["check", 41.9, { n: 1 }], ["check", 42.4, { n: 2 }], ["check", 42.9, { n: 3 }], ["check", 43.3, { n: 4 }], ["xp", 43.5],
  ["riser", 44.0, { until: 44.6 }], ["impact", 44.6], ["sparkle", 44.85], ["levelBig", 45.0],
  ["whoosh", 47.55], ["row", 48], ["row", 48.25], ["row", 48.5], ["rowMe", 49.1], ["row", 49.35], ["xp", 50.2], ["chime", 51.45],
  ["whoosh", 53.75], ["count", 54.4, { until: 55.4 }], ["row", 54.8], ["row", 55.2], ["row", 55.6],
  ["whoosh", 56.15], ["row", 56.8], ["row", 57.2], ["row", 57.6], ["row", 58.0],
  ["whooshBig", 60.55],
];

// ── Primitives ─────────────────────────────────────────────────────────────────
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const noiseRng = rng(20260916);
const noise = (n) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = noiseRng() * 2 - 1; return o; };
const bus = (n) => ({ L: new Float32Array(n), R: new Float32Array(n) });

function mix(b, src, at, gain = 1, pan = 0) {
  const off = Math.round(at * SR), gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  const end = Math.min(src.length, b.L.length - off);
  for (let i = Math.max(0, -off); i < end; i++) { b.L[off + i] += src[i] * gl; b.R[off + i] += src[i] * gr; }
}
function lowpass(x, fc) { const a = Math.exp((-TAU * fc) / SR); let y = 0; for (let i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; x[i] = y; } return x; }
function highpass(x, fc) { const a = Math.exp((-TAU * fc) / SR); let y = 0; for (let i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; x[i] -= y; } return x; }
function bandpassSweep(x, fAt, q) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % 32 === 0) {
      const w = (TAU * Math.min(fAt(i / SR), SR * 0.45)) / SR, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
      b0 = alpha / a0; b2 = -alpha / a0; a1 = (-2 * Math.cos(w)) / a0; a2 = (1 - alpha) / a0;
    }
    const y = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
const attackDecay = (t, att, tau) => (t < att ? t / att : 1) * Math.exp(-Math.max(0, t - att) / tau);

// ── Sound effects ──────────────────────────────────────────────────────────────
// Glassy bell: fundamental plus fast-decaying inharmonic partials.
function bell(midi, dur, tau, bright = 0.25) {
  const f = hz(midi), n = Math.round(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = attackDecay(t, 0.002, tau);
    o[i] = e * (Math.sin(TAU * f * t) + bright * Math.sin(TAU * 2.76 * f * t) * Math.exp(-t / (tau * 0.35)) + 0.1 * Math.sin(TAU * 5.4 * f * t) * Math.exp(-t / (tau * 0.15)));
  }
  return o;
}
function chord(notes, gap, dur, tau, bright) {
  const n = Math.round((gap * notes.length + dur) * SR), o = new Float32Array(n);
  notes.forEach((m, k) => { const b = bell(m, dur, tau, bright), off = Math.round(k * gap * SR); for (let i = 0; i < b.length; i++) o[off + i] += b[i] / Math.sqrt(notes.length); });
  return o;
}
function whoosh(dur, f1, f2) {
  const n = Math.round(dur * SR), x = noise(n);
  bandpassSweep(x, (t) => f1 * (f2 / f1) ** (t / dur), 0.8);
  for (let i = 0; i < n; i++) x[i] *= Math.sin((Math.PI * i) / n) ** 2;
  return x;
}
function riser(dur) {
  const n = Math.round(dur * SR), x = noise(n);
  bandpassSweep(x, (t) => 400 * 12 ** (t / dur), 1.2);
  let ph = 0;
  for (let i = 0; i < n; i++) { const p = i / n; ph += (TAU * (180 * 6 ** p)) / SR; x[i] = (x[i] * 0.8 + Math.sin(ph) * 0.25) * p ** 2.4; }
  return x;
}
function impact() {
  const n = Math.round(1.6 * SR), o = new Float32Array(n), hiss = lowpass(noise(n), 1400);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * (38 + 55 * Math.exp(-t / 0.07))) / SR; o[i] = Math.sin(ph) * attackDecay(t, 0.003, 0.55) + hiss[i] * 0.6 * Math.exp(-t / 0.12); }
  return o;
}
function pop(n) {
  const len = Math.round(0.22 * SR), o = new Float32Array(len), base = 520 + 90 * n;
  let ph = 0;
  for (let i = 0; i < len; i++) { const t = i / SR; ph += (TAU * base * (1 + 0.7 * Math.exp(-t / 0.012))) / SR; o[i] = Math.sin(ph) * attackDecay(t, 0.002, 0.05); }
  return o;
}
function blip(freq, tau) {
  const len = Math.round(tau * 6 * SR), o = new Float32Array(len);
  for (let i = 0; i < len; i++) { const t = i / SR; o[i] = Math.sin(TAU * freq * t) * attackDecay(t, 0.002, tau); }
  return o;
}
const keyRng = rng(77);
function keyClick() {
  const len = Math.round(0.04 * SR), o = highpass(noise(len), 2200), v = 0.6 + 0.4 * keyRng();
  for (let i = 0; i < len; i++) { const t = i / SR; o[i] = o[i] * attackDecay(t, 0.0006, 0.0045) * v + 0.35 * Math.sin(TAU * 165 * t) * Math.exp(-t / 0.012); }
  return o;
}
const CLICK = (() => {
  const raw = run("ffmpeg", ["-v", "error", "-i", resolve(DIR, "../../../../public/sounds/click.mp3"), "-f", "f32le", "-ac", "1", "-ar", String(SR), "pipe:1"]);
  const o = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength - (raw.byteLength % 4)));
  let peak = 0; for (const v of o) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < o.length; i++) o[i] /= peak || 1;
  return o;
})();

const SCALE = [74, 76, 78, 79, 81, 83, 85, 86, 88, 90, 91, 93, 95, 97, 98]; // D major, D5 up
function renderEvents(sfx, send, T) {
  const sparkRng = rng(5);
  for (const [kind, at, o = {}] of EVENTS) {
    const t = T(at);
    const put = (buf, gain, pan = 0, wet = 0.25) => { mix(sfx, buf, t, gain, pan); if (wet) mix(send, buf, t, gain * wet); };
    switch (kind) {
      case "whoosh": put(whoosh(0.5, 350, 2600), 0.09, 0, 0.1); break;
      case "whooshBig": put(whoosh(0.9, 180, 3200), 0.15, 0, 0.2); break;
      case "tick": put(bell([86, 88, 90, 93][o.n % 4], 0.4, 0.08, 0.2), 0.16, 0.15); break;
      case "check": put(bell([81, 83, 85, 86, 88][o.n], 0.7, 0.13, 0.25), 0.2, -0.1 + o.n * 0.05); break;
      case "xp": put(chord([93, 98], 0.07, 0.8, 0.22, 0.3), 0.2, 0.1, 0.35); break;
      case "pass": put(chord([86, 90, 93, 98], 0.07, 0.9, 0.25, 0.3), 0.18, 0, 0.35); break;
      case "levelSmall": put(chord([86, 88, 93], 0.06, 0.7, 0.2, 0.25), 0.13, 0, 0.35); break;
      case "levelBig": put(chord([86, 90, 93, 98, 102], 0.09, 1.4, 0.4, 0.3), 0.16, 0, 0.45); break;
      case "badge": put(chord([74, 86, 90, 93], 0.05, 2.2, 0.8, 0.35), 0.2, 0, 0.5); break;
      case "chime": put(chord([86, 93], 0.1, 1.0, 0.3, 0.25), 0.13, 0, 0.35); break;
      case "line": put(blip(1320, 0.012), 0.05, 0.2, 0); break;
      case "row": put(blip(980, 0.02), 0.07, 0.1, 0.1); break;
      case "rowMe": put(chord([88, 93], 0.06, 0.8, 0.22, 0.3), 0.15, 0, 0.3); break;
      case "pop": put(pop(o.n), 0.22, -0.15 + o.n * 0.15, 0.1); break;
      case "click": put(CLICK, 0.45, 0, 0.05); break;
      case "riser": { const d = T(o.until) - t; put(riser(d), 0.16, 0, 0.3); break; }
      case "impact": put(impact(), 0.55, 0, 0.35); break;
      case "sparkle": for (let k = 0; k < 10; k++) { const m = SCALE[8 + Math.floor(sparkRng() * 7)]; const b = bell(m, 0.9, 0.18, 0.3); mix(sfx, b, t + k * 0.13, 0.09 * (1 - k * 0.06), sparkRng() * 1.4 - 0.7); mix(send, b, t + k * 0.13, 0.05); } break;
      case "count": { const end = T(o.until), step = 0.14, count = Math.floor((end - t) / step); for (let k = 0; k <= count; k++) mix(sfx, bell(SCALE[Math.min(k, SCALE.length - 1)], 0.25, 0.05, 0.15), t + k * step, 0.035 + 0.035 * (k / Math.max(1, count)), 0.2); break; }
      case "type": for (let k = 0; k < o.chars; k++) mix(sfx, keyClick(), T(at + ((o.until - at) * k) / o.chars), 0.1, 0.15 * Math.sin(k)); break;
      default: throw new Error(`unknown event ${kind}`);
    }
  }
}

// ── Music ──────────────────────────────────────────────────────────────────────
const TABLE = 4096, tables = new Map();
function padTable(midi, fc) {
  const key = `${midi}:${fc}`;
  if (tables.has(key)) return tables.get(key);
  const f = hz(midi), t = new Float32Array(TABLE), K = Math.min(80, Math.floor(16000 / f));
  for (let k = 1; k <= K; k++) {
    const w = 1 / k / (1 + ((k * f) / fc) ** 4);
    if (w < 0.0015) break;
    for (let i = 0; i < TABLE; i++) t[i] += w * Math.sin((TAU * k * i) / TABLE);
  }
  let peak = 0; for (const v of t) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < TABLE; i++) t[i] /= peak;
  tables.set(key, t);
  return t;
}
function padNote(music, send, midi, at, dur, fc, gain) {
  const table = padTable(midi, fc), start = Math.round(at * SR), rel = 1.1, n = Math.round((dur + rel) * SR);
  for (const [cents, pan] of [[-7, -0.35], [7, 0.35]]) {
    const inc = ((hz(midi) * 2 ** (cents / 1200)) * TABLE) / SR, gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    let ph = ((midi * 131 + cents) % TABLE + TABLE) % TABLE;
    for (let i = 0; i < n && start + i < music.L.length; i++) {
      const t = i / SR;
      const a = t < 0.45 ? Math.sin((t / 0.45) * (Math.PI / 2)) ** 2 : 1;
      const r = t > dur ? Math.exp(-(t - dur) / 0.35) : 1;
      const j = ph | 0, fr = ph - j, v = (table[j] + (table[(j + 1) % TABLE] - table[j]) * fr) * a * r;
      music.L[start + i] += v * gl; music.R[start + i] += v * gr;
      send.L[start + i] += v * gl * 0.3; send.R[start + i] += v * gr * 0.3;
      ph += inc; if (ph >= TABLE) ph -= TABLE;
    }
  }
}
const plucks = new Map();
function pluck(midi) { // Karplus-Strong string
  if (plucks.has(midi)) return plucks.get(midi);
  const N = Math.max(2, Math.round(SR / hz(midi))), len = Math.round(1.4 * SR), r = rng(midi * 97), buf = new Float32Array(N), o = new Float32Array(len);
  for (let i = 0; i < N; i++) buf[i] = r() * 2 - 1;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) buf[i] = 0.5 * (buf[i] + buf[(i + 1) % N]);
  let idx = 0;
  for (let i = 0; i < len; i++) { const cur = buf[idx], nxt = buf[(idx + 1) % N]; o[i] = cur; buf[idx] = 0.9965 * 0.5 * (cur + nxt); idx = (idx + 1) % N; }
  lowpass(o, 4200);
  let peak = 0; for (const v of o) peak = Math.max(peak, Math.abs(v));
  const fade = Math.round(0.25 * SR);
  for (let i = 0; i < len; i++) o[i] = (o[i] / peak) * (i > len - fade ? (len - i) / fade : 1) * Math.min(1, i / 48);
  plucks.set(midi, o);
  return o;
}
function bassNote(music, midi, at, dur, gain) {
  const f = hz(midi), n = Math.round((dur + 0.08) * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, a = Math.min(1, t / 0.006) * (0.65 + 0.35 * Math.exp(-t / 0.12)) * (t > dur ? Math.exp(-(t - dur) / 0.03) : 1);
    o[i] = a * (Math.sin(TAU * f * t) + 0.28 * Math.sin(TAU * 2 * f * t) + 0.08 * Math.sin(TAU * 3 * f * t));
  }
  mix(music, o, at, gain);
}
const KICK = (() => { const n = Math.round(0.45 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * (46 + 95 * Math.exp(-t / 0.035))) / SR; o[i] = Math.sin(ph) * attackDecay(t, 0.002, 0.22); } return o; })();
const HAT = (() => { const n = Math.round(0.08 * SR), o = highpass(noise(n), 7000); for (let i = 0; i < n; i++) o[i] *= attackDecay(i / SR, 0.001, 0.018); return o; })();
const OHAT = (() => { const n = Math.round(0.28 * SR), o = highpass(noise(n), 6500); for (let i = 0; i < n; i++) o[i] *= attackDecay(i / SR, 0.001, 0.07); return o; })();
const CLAP = (() => {
  const n = Math.round(0.3 * SR), o = bandpassSweep(noise(n), () => 1500, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] *= [0, 0.011, 0.022].reduce((s, d) => s + (t >= d ? Math.exp(-(t - d) / 0.008) : 0), 0) * 0.6 + Math.exp(-t / 0.1) * (t > 0.022 ? 1 : 0); }
  return o;
})();

function renderMusic(music, send, T, len) {
  const S = { introEnd: T(4.2), breakAt: T(27.3), bIn: T(28.2), riser: T(44.0), impact: T(44.6), outro: T(60.55) };
  const BEAT = 0.6, BAR = BEAT * 4;
  const CH = [
    { pad: [50, 57, 62, 66], bass: 38, arp: [74, 78, 81, 86] }, // D
    { pad: [45, 52, 57, 61], bass: 33, arp: [73, 76, 81, 85] }, // A
    { pad: [47, 54, 59, 62], bass: 35, arp: [71, 74, 78, 83] }, // Bm
    { pad: [43, 50, 55, 59], bass: 31, arp: [71, 74, 79, 83] }, // G
  ];
  const section = (t) => t < S.introEnd ? "intro" : t >= S.breakAt && t < S.bIn ? "break" : t < S.breakAt ? "A" : t < S.impact ? (t >= S.riser ? "riser" : "B") : "C";
  const FC = { intro: 650, A: 1000, break: 700, B: 1300, riser: 1300, C: 1800 };
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
  const BASS = { 0: 0.54, 3: 0.24, 4: 0.54, 7: 0.24 };
  for (const [start, end] of [[0, S.impact], [S.impact, S.outro]]) {
    for (let bi = 0, b = start; b < end - 0.05; bi++, b += BAR) {
      const barEnd = Math.min(b + BAR, end), ch = CH[bi % 4];
      for (const m of ch.pad) padNote(music, send, m, b, barEnd - b, FC[section(b + 0.01)], 0.05);
      for (let e = 0; e < 8; e++) {
        const t = b + (e * BEAT) / 2;
        if (t >= barEnd - 0.01) break;
        const s = section(t);
        if (s !== "intro") {
          const g = (s === "A" ? 0.1 : s === "break" ? 0.07 : 0.12) * (e % 2 === 0 ? 1 : 0.72);
          mix(music, pluck(ch.arp[ARP[e]]), t, g, e % 2 ? 0.3 : -0.3);
          mix(send, pluck(ch.arp[ARP[e]]), t, g * 0.45);
        }
        if (s === "intro" || s === "break" || s === "riser") continue;
        const onBeat = e % 2 === 0, beatNum = e / 2;
        if (onBeat && (s !== "A" || beatNum === 0 || beatNum === 2)) mix(music, KICK, t, s === "A" ? 0.34 : 0.4);
        if (onBeat && s !== "A" && (beatNum === 1 || beatNum === 3)) { mix(music, CLAP, t, 0.14, 0.05); mix(send, CLAP, t, 0.1); }
        if (!onBeat) mix(music, e === 7 && s === "C" ? OHAT : HAT, t, s === "A" ? 0.04 : 0.055, 0.25);
        else if (s !== "A") mix(music, HAT, t, 0.03, -0.2);
        if (s !== "A" && BASS[e] !== undefined) bassNote(music, ch.bass, t, BASS[e], 0.2);
      }
    }
  }
  // Outro: resolve on D6/9, a slow arpeggio, then fade.
  const od = len - S.outro;
  for (const m of [50, 57, 64, 66, 69]) padNote(music, send, m, S.outro, Math.max(0.5, od - 1.3), 1100, 0.045);
  bassNote(music, 38, S.outro, Math.max(0.5, od - 1.5), 0.2);
  [74, 78, 81, 76, 86].forEach((m, k) => { mix(music, pluck(m), S.outro + 0.35 + k * 0.55, 0.12 * (1 - k * 0.12), k % 2 ? 0.3 : -0.3); mix(send, pluck(m), S.outro + 0.35 + k * 0.55, 0.06); });
}

// ── Reverb (Freeverb) ──────────────────────────────────────────────────────────
function freeverb(send, room = 0.84, damp = 0.22) {
  const n = send.L.length, out = bus(n), k = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], apT = [556, 441, 341, 225];
  for (const [ch, spread] of [["L", 0], ["R", 23]]) {
    const combs = combT.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * k)), i: 0, f: 0 }));
    const aps = apT.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * k)), i: 0 }));
    const x = send[ch], y = out[ch];
    for (let s = 0; s < n; s++) {
      const input = x[s] * 0.015;
      let acc = 0;
      for (const c of combs) { const v = c.buf[c.i]; c.f = v * (1 - damp) + c.f * damp; c.buf[c.i] = input + c.f * room; acc += v; if (++c.i === c.buf.length) c.i = 0; }
      for (const a of aps) { const v = a.buf[a.i]; const o = -acc + v; a.buf[a.i] = acc + v * 0.5; acc = o; if (++a.i === a.buf.length) a.i = 0; }
      y[s] = acc * 3;
    }
  }
  return out;
}

function writeWav(path, L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 8);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 8, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 8, 28); buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34); buf.write("data", 36); buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) { buf.writeFloatLE(L[i], 44 + i * 8); buf.writeFloatLE(R[i], 48 + i * 8); }
  writeFileSync(path, buf);
}

// ── Render each timeline and mux ───────────────────────────────────────────────
for (const [name, cut] of Object.entries(CUTS)) {
  const T = (s) => mapTime(cut.knots, s);
  const len = T(SRC_DUR), n = Math.round(len * SR);
  const music = bus(n), sfx = bus(n), send = bus(n);
  renderMusic(music, send, T, len);
  renderEvents(sfx, send, T);
  const verb = freeverb(send);

  const L = new Float32Array(n), R = new Float32Array(n), fadeIn = 0.6 * SR, fadeOut = 1.0 * SR;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const g = Math.min(1, i / fadeIn) * Math.min(1, (n - i) / fadeOut);
    L[i] = (music.L[i] * 0.62 + sfx.L[i] + verb.L[i] * 0.35) * g;
    R[i] = (music.R[i] * 0.62 + sfx.R[i] + verb.R[i] * 0.35) * g;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  for (let i = 0; i < n; i++) { L[i] *= 0.9 / peak; R[i] *= 0.9 / peak; }

  const wav = join(tmpdir(), `abtalks-film-sound-${name}.wav`), track = join(DIR, `sound-${name}.m4a`);
  writeWav(wav, L, R);
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-af", "highpass=f=30,bass=g=-3:f=140:w=0.7,loudnorm=I=-15:TP=-2:LRA=11,aresample=48000", "-c:a", "aac", "-b:a", "192k", track]);
  rmSync(wav, { force: true });
  console.log(`${name}: soundtrack → sound-${name}.m4a (${len.toFixed(2)}s)`);

  for (const video of cut.videos) {
    const src = join(DIR, video), tmp = join(DIR, `.tmp-${video}`);
    // Video stream only from the source, so re-running replaces the audio instead of stacking it.
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-i", track, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", tmp]);
    renameSync(tmp, src);
    console.log(`${name}: sound → ${video}`);
  }
}
