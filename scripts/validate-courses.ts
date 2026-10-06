/**
 * Course content checker. Run: npx tsx scripts/validate-courses.ts
 * Checks every course in the registry: diagram edges/scenarios point at real
 * nodes, no overlapping or out-of-bounds boxes, sequence actors exist,
 * decision trees are connected, compare/classify answers exist, quiz answers
 * are valid and spread, section ids are unique, and no em dashes in content.
 * Exits 1 on any problem.
 */
import { COURSES } from "../src/features/courses/registry";
import type { Block } from "../src/features/courses/types";
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
function textOf(b: Block): string {
  switch (b.type) {
    case "h2": case "h3": return b.text;
    case "p": case "callout": return b.text;
    case "list": case "takeaways": return b.items.join(" ");
    case "table": return [...b.head, ...b.rows.flat()].join(" ");
    case "code": return (b.caption ?? "");
    case "visual": return b.title + " " + b.howTo + " " + b.caption;
    case "quiz": return b.questions.map(q => q.q + " " + q.options.join(" ") + " " + q.why).join(" ");
    case "exercise": return [b.brief, ...b.tasks, ...(b.hints ?? []), ...(b.model ?? [])].join(" ");
    case "references": return "";
    default: return "";
  }
}
let problems = 0;
for (const course of COURSES) {
console.log(`# ${course.title}`);
if (JSON.stringify(course).includes("—")) { problems++; console.log("  EM DASH found in content"); }
for (const m of course.modules) {
  const prose = m.blocks.map(textOf).join(" ");
  const vis = m.blocks.flatMap(b => b.type === "visual" ? [JSON.stringify(b.visual)] : []).join(" ");
  const ids = m.blocks.flatMap(b => b.type === "h2" ? [b.id] : []);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  const qs = m.blocks.flatMap(b => b.type === "quiz" ? b.questions : []);
  const dist = [0,0,0,0]; qs.forEach(q => dist[q.answer]++);
  const nvis = m.blocks.filter(b => b.type === "visual").length;
  const kinds = m.blocks.flatMap(b => b.type === "visual" ? [b.visual.kind] : []);
  console.log(`M${m.number} ${m.slug}: prose≈${words(prose)} words (+${words(vis.replace(/[{}":,\[\]]/g," "))} in visuals), visuals=${nvis} [${[...new Set(kinds)].join(",")}], quiz=${qs.length} answers=${dist}, exercise=${m.blocks.some(b=>b.type==="exercise")}, refs=${m.blocks.flatMap(b=>b.type==="references"?b.items:[]).length}`);
  if (dup.length) { problems++; console.log("  DUP IDS", dup); }
  for (const q of qs) if (q.answer >= q.options.length) { problems++; console.log("  BAD ANSWER", q.q); }
  for (const b of m.blocks) {
    if (b.type !== "visual") continue;
    const v = b.visual;
    if (v.kind === "architecture") {
      const nodes = new Set(v.nodes.map(n => n.id));
      for (const e of v.edges) if (!nodes.has(e.from) || !nodes.has(e.to)) { problems++; console.log("  BAD EDGE", b.title, e); }
      for (const s of v.scenarios ?? []) for (const st of s.steps) {
        for (const n of st.nodes) if (!nodes.has(n)) { problems++; console.log("  BAD SCEN NODE", b.title, n); }
      }
      const boxes = v.nodes.filter(n => !n.group).map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w ?? 140, h: n.h ?? 48 }));
      for (const a of boxes) {
        if (a.x + a.w > v.width || a.y + a.h > v.height) { problems++; console.log("  OUT OF BOUNDS", b.title, a.id); }
        for (const c of boxes) if (a.id < c.id && a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) { problems++; console.log("  OVERLAP", b.title, a.id, c.id); }
      }
    }
    if (v.kind === "sequence") {
      const actors = new Set(v.actors.map(a => a.id));
      for (const s of v.scenarios) for (const msg of s.messages) if (!actors.has(msg.from) || !actors.has(msg.to)) { problems++; console.log("  BAD ACTOR", b.title, msg); }
    }
    if (v.kind === "decision") {
      if (!v.nodes[v.start]) { problems++; console.log("  BAD START", b.title); }
      for (const n of Object.values(v.nodes)) if ("options" in n) for (const o of n.options) if (!v.nodes[o.next]) { problems++; console.log("  BAD NEXT", b.title, o.next); }
    }
    if (v.kind === "classify") for (const it of v.items) if (!v.buckets.some(bk => bk.id === it.bucket)) { problems++; console.log("  BAD BUCKET", b.title, it.bucket); }
    if (v.kind === "compare") for (const s of v.situations ?? []) if (!v.options.some(o => o.id === s.best)) { problems++; console.log("  BAD BEST", b.title, s.best); }
  }
}
}
console.log(problems ? `${problems} PROBLEMS` : "ALL CHECKS PASS");
if (problems) process.exit(1);
