// Renders film.html to MP4, frame by frame, with headless Brave (Chromium) + ffmpeg.
// Every frame is a pure function of time, so the output is deterministic.
//
// Usage:
//   node docs/plans/assets/151-proof-film/record.mjs mobile|web|ig|all
//   node docs/plans/assets/151-proof-film/record.mjs sheet     # 9-frame contact sheets only
//
// Needs: Brave or Chrome (set BROWSER=/path/to/binary), ffmpeg on PATH.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const BROWSER = process.env.BROWSER
  ?? ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
if (!BROWSER) throw new Error("No Chromium browser found; set BROWSER=/path/to/chrome");
const arg = process.argv[2] ?? "all";
const SHEET = arg === "sheet";
const cuts = arg === "all" || SHEET ? ["mobile", "web", "ig"] : [arg];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withBrowser(fn) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = join(tmpdir(), `abtalks-film-profile-${port}`);
  const proc = spawn(BROWSER, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--force-device-scale-factor=1", "about:blank",
  ], { stdio: "ignore" });
  try {
    let page;
    for (let i = 0; i < 80 && !page; i++) {
      try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
      if (!page) await sleep(250);
    }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    let id = 0; const pending = new Map(); const waiters = [];
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method) for (const w of waiters.filter((w) => w.method === m.method)) { waiters.splice(waiters.indexOf(w), 1); w.res(m.params); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    const once = (method) => new Promise((res) => waiters.push({ method, res }));
    const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
    await send("Page.enable");
    await fn({ send, once, evaluate });
    ws.close();
  } finally {
    proc.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}

const SHEET_TIMES = [3, 8.2, 19, 23.5, 34, 43.6, 46, 51.8, 59.5];

await withBrowser(async ({ send, once, evaluate }) => {
  for (const cut of cuts) {
    const [w, h] = cut === "ig" ? [1080, 1920] : [1920, 1080];
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    const loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url: `file://${join(DIR, "film.html")}?record=${cut}` });
    await loaded;
    await evaluate("window.__ready");
    await sleep(500);

    const frames = join(tmpdir(), `abtalks-film-${cut}`);
    rmSync(frames, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });
    const dur = await evaluate("window.__dur");
    const times = SHEET ? SHEET_TIMES : Array.from({ length: Math.round(dur * FPS) }, (_, k) => k / FPS);

    const t0 = Date.now();
    for (let k = 0; k < times.length; k++) {
      // Sheets sample source time; mapped cuts convert through the film's own time map.
      const expr = SHEET ? `window.__seek(window.__outOf(${times[k]}))` : `window.__seek(${times[k]})`;
      await evaluate(expr);
      const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 94 });
      writeFileSync(join(frames, `f_${String(k).padStart(5, "0")}.jpg`), Buffer.from(data, "base64"));
      if (!SHEET && k % 300 === 0) console.log(`${cut}: frame ${k}/${times.length} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }

    const ff = (args) => { const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" }); if (r.status !== 0) throw new Error(`ffmpeg failed for ${cut}`); };
    if (SHEET) {
      const scale = cut === "ig" ? "360:640" : "960:540";
      ff(["-framerate", "1", "-i", join(frames, "f_%05d.jpg"), "-vf", `scale=${scale},tile=${cut === "ig" ? "9x1" : "3x3"}:padding=8:color=0xE4E7E7`, "-frames:v", "1", join(tmpdir(), `abtalks-film-sheet-${cut}.jpg`)]);
      console.log(`sheet → ${join(tmpdir(), `abtalks-film-sheet-${cut}.jpg`)}`);
    } else {
      const out = join(DIR, `abtalks-proof-film-${cut === "ig" ? "instagram" : cut}.mp4`);
      ff(["-framerate", String(FPS), "-i", join(frames, "f_%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
      console.log(`${cut}: ${times.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${out}`);
    }
    rmSync(frames, { recursive: true, force: true });
  }
});
