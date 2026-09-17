// Assembles parts/ into one self-contained film.html (plan 151 concept film).
// Usage: node docs/plans/assets/151-proof-film/build.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(DIR, p), "utf8");
const LOGO = readFileSync(resolve(DIR, "../../../../public/abt-logo2.png")).toString("base64");

function sections(text, tag) {
  const out = {};
  const re = new RegExp(`<!-- @${tag} (\\S+) -->`, "g");
  const marks = [...text.matchAll(re)];
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    out[m[1]] = text.slice(m.index + m[0].length, end).trim();
  });
  return out;
}

const parts = sections(read("parts/shared.html"), "part");
const phone = (variant) =>
  parts.phone
    .replace("__HINT_ANCHOR__", variant === "ig" ? "xp50" : "hint")
    .replace("__CHECKS__", parts.checks)
    .replace("__SKILL__", [parts.skillcard, parts.skillevidence, parts.skillnext].join("\n"))
    .replace("__BADGE__", parts.badge)
    .replace("__LEVELUP__", parts.levelup);

const fill = (tpl) =>
  tpl.replace(/\{\{([a-z-]+)(?:\|([a-z]+))?\}\}/g, (_, name, variant) => {
    if (name === "phone") return phone(variant);
    if (!(name in parts)) throw new Error(`unknown part {{${name}}}`);
    return parts[name];
  });

const stages = sections(read("parts/stages.html"), "stage");
// Soundtracks from sound.mjs, embedded so the page stays a single file.
const audio = ["main", "instagram"]
  .filter((name) => existsSync(join(DIR, `sound-${name}.m4a`)))
  .map((name) => `<audio id="snd-${name}" preload="auto" src="data:audio/mp4;base64,${readFileSync(join(DIR, `sound-${name}.m4a`)).toString("base64")}"></audio>`)
  .join("\n");
const html = read("parts/shell.html")
  .replace("{{styles}}", () => read("parts/styles.css"))
  .replace("{{engine}}", () => read("parts/engine.js"))
  .replace("{{audio}}", () => audio)
  .replace(/\{\{stage:([a-z]+)\}\}/g, (_, cut) => fill(stages[cut]))
  .replaceAll("__LOGO__", LOGO);

if (/\{\{|__[A-Z_]+__/.test(html)) throw new Error("unresolved placeholder in film.html");
writeFileSync(join(DIR, "film.html"), html);
console.log(`film.html · ${(html.length / 1024).toFixed(0)} KB`);
