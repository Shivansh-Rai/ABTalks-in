/**
 * Zero-cost RAG sanity check — no API key, no network call, no embedding
 * provider needed. Dry-runs the real chunking logic (chunk-markdown.ts)
 * against the actual knowledge/processed/*.md files and prints every chunk
 * so bad boundaries (too big, too small, empty, heading swallowed into the
 * wrong section) can be caught before any embedding provider is chosen.
 *
 * Run: npx tsx scripts/inspect-chunks.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chunkMarkdown } from "./chunk-markdown";

const KNOWLEDGE_DIR = join(process.cwd(), "knowledge", "processed");

// Rough heuristics, not hard rules — flagged for human review, not auto-fixed.
const TOO_SMALL_CHARS = 40; // likely a heading with no real content
const TOO_LARGE_CHARS = 1800; // likely worth splitting further

function main() {
  const files = readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  let totalChunks = 0;
  const flags: string[] = [];

  for (const file of files) {
    const raw = readFileSync(join(KNOWLEDGE_DIR, file), "utf8");
    const chunks = chunkMarkdown(raw, file.replace(/\.md$/, ""));
    totalChunks += chunks.length;

    console.log(`\n=== ${file} — ${chunks.length} chunk(s) ===`);
    chunks.forEach((chunk, i) => {
      const len = chunk.text.length;
      let flag = "";
      if (len < TOO_SMALL_CHARS) flag = " [FLAG: very small]";
      if (len > TOO_LARGE_CHARS) flag = " [FLAG: very large]";
      if (flag) flags.push(`${file} #${i} "${chunk.heading}" (${len} chars)${flag}`);

      const preview = chunk.text.replace(/\s+/g, " ").trim().slice(0, 100);
      console.log(`  #${i} "${chunk.heading}" — ${len} chars${flag}`);
      console.log(`      "${preview}${chunk.text.length > 100 ? "…" : ""}"`);
    });
  }

  console.log(`\n\nTotal: ${totalChunks} chunks across ${files.length} files.`);
  if (flags.length > 0) {
    console.log(`\n${flags.length} chunk(s) flagged for review:`);
    flags.forEach((f) => console.log(`  - ${f}`));
  } else {
    console.log("No size flags raised.");
  }
}

main();
