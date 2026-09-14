/**
 * Admin read-only talent project inspection — T-278 / TC-A-016. Run with:
 *   npm run test:admin-project-inspect
 *
 * No network, no database. This suite exists to pin ONE claim: the admin
 * inspection surface cannot modify anything. It proves that structurally —
 * no server action is imported, no Prisma writer is called — rather than by
 * asserting that some button is disabled. R2 of plan 115 §10 is explicit:
 * "hiding a button is not security".
 *
 * It also pins the other half of the R1 carve-out: the recruiter-scoped
 * predicates on the recruiter's own path must stay exactly where they are. If
 * a later change relaxes them to make something easier, these tests fail.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

/** Prose must not be able to satisfy an assertion. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

const LOADER = "src/features/admin/inspect-talent-project.ts";
const INSPECTOR = "src/components/admin/talent-project-inspector.tsx";
const DETAIL = "src/app/admin/hire/projects/[requestId]/page.tsx";
const LIST = "src/app/admin/hire/projects/page.tsx";
const SURFACE = [LOADER, INSPECTOR, DETAIL, LIST];

const WRITERS = [
  ".update(",
  ".updateMany(",
  ".create(",
  ".createMany(",
  ".upsert(",
  ".delete(",
  ".deleteMany(",
];

console.log("\nT-278 admin talent project inspection — read-only guarantee\n");

suite("no file on the surface imports a server action", () => {
  for (const f of SURFACE) {
    const src = code(f);
    assert(
      !src.includes("@/app/actions/"),
      `${f} must not import from @/app/actions/* — that is the whole guarantee`,
    );
  }
});

suite("no file on the surface calls a Prisma writer", () => {
  for (const f of SURFACE) {
    const src = code(f);
    for (const w of WRITERS) {
      assert(!src.includes(`prisma${w}`), `${f} must not call prisma${w}`);
      assert(
        !src.includes(`talentRequest${w}`) &&
          !src.includes(`talentRequestMatch${w}`),
        `${f} must not write TalentRequest/TalentRequestMatch (${w})`,
      );
    }
  }
});

suite("the surface never writes lastViewedAt, viewedAt or an audit row", () => {
  for (const f of SURFACE) {
    const src = code(f);
    // Reading and displaying them is the point; assigning them is not.
    assert(
      !/lastViewedAt\s*:\s*(new Date|now)/.test(src),
      `${f} must not stamp lastViewedAt — it drives the recruiter's New badges`,
    );
    assert(
      !/viewedAt\s*:\s*(new Date|now)/.test(src),
      `${f} must not stamp viewedAt`,
    );
    assert(
      !src.includes("adminAction"),
      `${f} must not write an AdminAction row — AdminAction.targetUserId cannot name a TalentRequest`,
    );
  }
});

suite("the detail page gates on requireAdmin and 404s a miss", () => {
  const src = code(DETAIL);
  assert(src.includes("requireAdmin"), "detail page must call requireAdmin");
  assert(src.includes("notFound"), "an unknown id must be notFound(), never 403");
  assert(
    !src.includes("searchParams"),
    "scope must come from params, never the query string",
  );
});

suite("the list page gates on requireAdmin", () => {
  assert(code(LIST).includes("requireAdmin"), "list page must call requireAdmin");
});

suite("the admin path does not go through the recruiter gates", () => {
  for (const f of SURFACE) {
    const src = code(f);
    assert(
      !src.includes("requireRecruiterWorkspace"),
      `${f} must not use requireRecruiterWorkspace — it takes no id by design`,
    );
    assert(
      !src.includes("requireApprovedRecruiter"),
      `${f} must not use a recruiter gate; admin-ness is a separate axis`,
    );
  }
});

suite("the loader resolves the OWNER and reuses loadRequestMatches unchanged", () => {
  const src = code(LOADER);
  assert(
    src.includes("loadRequestMatches"),
    "the loader must reuse loadRequestMatches rather than re-query without scoping",
  );
  assert(
    src.includes("request.recruiterUserId"),
    "it must pass the OWNER's recruiterUserId, not the admin's",
  );
});

suite("the inspector is a Server Component with no interactivity", () => {
  // Comments are stripped first: this file's own doc block discusses
  // "use client" in prose, and a directive is a string literal, not a comment,
  // so a real one still survives the strip.
  const src = code(INSPECTOR);
  assert(!src.includes('"use client"'), "the inspector must not be a client component");
  assert(!src.includes("useState"), "no state");
  assert(!src.includes("onClick"), "no handlers");
  assert(!src.includes("<form"), "no forms");
});

suite("the recruiter's own path keeps its recruiterUserId predicates", () => {
  // The carve-out was granted on the condition that R1 still holds between
  // recruiters. If either of these is relaxed, the exception no longer applies.
  const page = code("src/app/hire/[requestId]/page.tsx");
  assert(
    page.includes("recruiterUserId: userId"),
    "hire/[requestId]/page.tsx must keep its recruiterUserId filter",
  );
  const loader = code("src/features/hire/load-request-matches.ts");
  assert(
    /where:\s*\{\s*id:\s*requestId,\s*recruiterUserId\s*\}/.test(loader),
    "loadRequestMatches must keep its recruiterUserId filter",
  );
});

suite("no server action file was added for this surface", () => {
  // A read-only page needs none, and an admin-*.ts action file would fall
  // under the requireAdmin sweep in isolation.test.ts.
  const actions = readdirSync(join(root, "src/app/actions"));
  assert(
    !actions.some((f) => f.includes("talent-project-inspect") || f.includes("admin-project")),
    "no server action may be created for the inspection surface",
  );
});

suite("directory sweep: nothing under the admin projects route mutates", () => {
  const dir = join(root, "src/app/admin/hire/projects");
  const files: string[] = [];
  (function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".ts") || full.endsWith(".tsx")) files.push(full);
    }
  })(dir);
  assert(files.length >= 2, `expected the list and detail pages, found ${files.length}`);
  for (const f of files) {
    const src = stripComments(readFileSync(f, "utf8"));
    assert(
      !src.includes("@/app/actions/"),
      `${f} imports a server action — the route must stay read-only`,
    );
    assert(!src.includes('"use server"'), `${f} must not declare a server action`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
