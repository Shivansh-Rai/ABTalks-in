/**
 * Build-time knowledge extraction (docs/plans/063-chatbot-dynamic-knowledge-ingestion.md).
 *
 * public source modules (allowlisted in scripts/knowledge-sources.ts)
 *   -> auth-drift check against middleware.ts + in-page auth calls
 *   -> normalized markdown
 *   -> knowledge/generated/<id>.md
 *   -> content hash recorded in knowledge/generated/.manifest.json
 *
 * Run: npx tsx scripts/extract-public-content.ts
 *
 * This never writes to knowledge/processed/ (the small, hand-maintained
 * supplementary layer) — only knowledge/generated/, which this script fully
 * owns. Do not hand-edit files under knowledge/generated/; edit the source
 * component/data module instead and re-run this script (or let the build do it).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { KNOWLEDGE_SOURCES } from "./knowledge-sources";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "knowledge", "generated");
const MANIFEST_PATH = path.join(GENERATED_DIR, ".manifest.json");
const MIDDLEWARE_PATH = path.join(ROOT, "middleware.ts");

type Manifest = Record<string, { contentHash: string; generatedAt: string }>;

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return {};
  }
}

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Extracts the string literals inside `middleware.ts`'s `protectedPaths`
 * array via a plain-text regex (not an import — middleware.ts pulls in
 * next-auth/edge config that isn't meant to run in a plain Node script).
 * This is a heuristic, not a full static analyzer — good enough as a
 * regression tripwire, not a formal guarantee. See §5 of the plan.
 */
function getProtectedPathPrefixes(): string[] {
  const src = readFileSync(MIDDLEWARE_PATH, "utf8");
  const match = /const protectedPaths\s*=\s*\[([\s\S]*?)\];/.exec(src);
  if (!match) {
    throw new Error(
      "extract-public-content: could not find `protectedPaths` in middleware.ts — " +
        "the auth-drift check can't run blind. Fix this script or middleware.ts.",
    );
  }
  return [...match[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}

/** Route -> page.tsx file, for the small set of routes this pipeline cares about. */
const ROUTE_PAGE_FILES: Record<string, string> = {
  "/": "src/components/landing/modernist/landing-page.tsx",
  "/challenges": "src/app/challenges/page.tsx",
  "/claude-signup": "src/app/claude-signup/page.tsx",
  "/ai-workshop": "src/app/ai-workshop/page.tsx",
  "/ai-workshop/events": "src/app/ai-workshop/events/page.tsx",
  "/ai-cohort-register": "src/app/ai-cohort-register/page.tsx",
  "/ai-cohort-india": "src/app/ai-cohort-india/page.tsx",
  "/program": "src/app/program/page.tsx",
};

const SUSPICIOUS_AUTH_PATTERNS = [
  /requireAdmin\s*\(/,
  /requireProgramMember\s*\(/,
  /requireRecruiter\s*\(/,
  /requireRole\s*\(/,
  /redirect\s*\(\s*["'`]\/login/,
];

/**
 * Fails loudly if a previously-public route now looks protected — either by
 * middleware's protectedPaths prefix list, or by an auth-gate pattern newly
 * present in its page file. This is the regression tripwire from §5 of the
 * plan: better to break the build than silently start ingesting content
 * that just became members-only or admin-only.
 */
function assertRouteStillPublic(route: string, protectedPrefixes: string[]) {
  const matchedPrefix = protectedPrefixes.find((p) => route === p || route.startsWith(p));
  if (matchedPrefix) {
    throw new Error(
      `extract-public-content: route "${route}" now matches middleware protectedPaths prefix "${matchedPrefix}". ` +
        `A knowledge source in scripts/knowledge-sources.ts assumes this route is public — ` +
        `either the allowlist is stale (remove/fix the source) or this is a real access-control regression. ` +
        `Failing the build rather than silently ingesting now-protected content.`,
    );
  }

  const pageFile = ROUTE_PAGE_FILES[route];
  if (!pageFile) return; // no mapped page file to scan — nothing further to check
  const fullPath = path.join(ROOT, pageFile);
  if (!existsSync(fullPath)) return;
  const src = readFileSync(fullPath, "utf8");
  const hit = SUSPICIOUS_AUTH_PATTERNS.find((re) => re.test(src));
  if (hit) {
    throw new Error(
      `extract-public-content: "${pageFile}" (route "${route}") now contains an auth-gate pattern (${hit}). ` +
        `A knowledge source assumes this route is public. Failing the build — see scripts/knowledge-sources.ts.`,
    );
  }
}

async function main() {
  mkdirSync(GENERATED_DIR, { recursive: true });
  const protectedPrefixes = getProtectedPathPrefixes();
  const manifest = loadManifest();
  const nextManifest: Manifest = {};

  let changed = 0;
  let unchanged = 0;
  let failed = 0;

  for (const source of KNOWLEDGE_SOURCES) {
    for (const route of source.routes) {
      assertRouteStillPublic(route, protectedPrefixes);
    }

    let body: string | null;
    try {
      body = await source.load();
    } catch (err) {
      failed++;
      console.error(`[extract] FAILED "${source.id}":`, (err as Error).message);
      continue;
    }

    if (!body) {
      console.warn(`[extract] "${source.id}" returned no content this run — skipping.`);
      continue;
    }

    const contentHash = hashContent(body);
    const outPath = path.join(GENERATED_DIR, `${source.id}.md`);
    const prev = manifest[source.id];

    if (prev?.contentHash === contentHash && existsSync(outPath)) {
      unchanged++;
      nextManifest[source.id] = prev;
      continue;
    }

    writeFileSync(outPath, body, "utf8");
    nextManifest[source.id] = { contentHash, generatedAt: new Date().toISOString() };
    changed++;
    console.log(`[extract] wrote ${source.id}.md (${prev ? "changed" : "new"})`);
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2), "utf8");
  console.log(
    `[extract] done — ${changed} changed, ${unchanged} unchanged, ${failed} failed, ${KNOWLEDGE_SOURCES.length} total sources.`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[extract] fatal:", err);
  process.exitCode = 1;
});
