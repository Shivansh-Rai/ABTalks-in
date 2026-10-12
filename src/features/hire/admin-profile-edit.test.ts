/**
 * Platform Admin per-field edit of a candidate's Experience, Education and
 * self-declared skills from Hire → View Details. Run with:
 *   npm run test:admin-profile-edit
 *
 * No network, no database. Two halves:
 *   - the patch / validation / evidence-backed rules, exercised directly;
 *   - source scans pinning the boundary: every action is admin-gated, writes go
 *     through the candidate's own section writers with an audit row in the same
 *     transaction, recruiters get no controls, and nothing candidate-facing
 *     knows this exists.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_SKILL_CLAIMS,
  STALE_ENTRY_MESSAGE,
  educationEditSchema,
  educationSlotOf,
  experienceEditSchema,
  planEducationEdit,
  planEducationRemoval,
  planExperienceEdit,
  planExperienceRemoval,
  planSkillClaimChange,
  selfDeclaredSkills,
  type SkillRef,
} from "@/features/hire/admin-profile-edit";
import type {
  EducationView,
  ExperienceView,
} from "@/repositories/candidate-detail";

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

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

function filesUnder(rel: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, rel))) {
    const child = `${rel}/${name}`;
    if (statSync(join(root, child)).isDirectory()) out.push(...filesUnder(child));
    else if (/\.(ts|tsx)$/.test(name)) out.push(child);
  }
  return out;
}

const ACTIONS = "src/app/actions/admin-hire-profile-actions.ts";
const REPO = "src/repositories/candidate-detail.ts";
const INSPECTOR = "src/components/hire/candidate-inspector.tsx";
const SECTIONS = "src/components/hire/inspector-admin-sections.tsx";

/* ─── Fixtures ───────────────────────────────────────────────────────────── */

function job(over: Partial<ExperienceView> = {}): ExperienceView {
  return {
    id: "exp_1",
    companyName: "Acme",
    title: "Engineer",
    employmentType: "Full-time",
    locationCity: "Pune",
    startMonth: 1,
    startYear: 2020,
    endMonth: 6,
    endYear: 2022,
    isCurrent: false,
    totalMonths: 30,
    description: null,
    ...over,
  };
}

function school(over: Partial<EducationView> = {}): EducationView {
  return {
    id: "edu_college",
    institutionName: "IIT Bombay",
    collegeId: "cjld2cjxh0000qzrmn831i7rn",
    degree: "B.E / B.Tech",
    fieldOfStudy: "Computer Science",
    startMonth: 7,
    startYear: 2016,
    endMonth: 5,
    graduationYear: 2020,
    isCurrent: false,
    gradeType: "CGPA_10",
    grade: "8.6",
    description: null,
    ...over,
  };
}

const TENTH = school({
  id: "edu_x",
  institutionName: "Delhi Public School",
  collegeId: null,
  degree: "Secondary (10th)",
  fieldOfStudy: null,
  startMonth: null,
  startYear: null,
  endMonth: null,
  graduationYear: 2014,
  gradeType: "PERCENTAGE",
  grade: "88",
});

const TWELFTH = school({
  id: "edu_xii",
  institutionName: "Delhi Public School",
  collegeId: null,
  degree: "Higher Secondary (12th)",
  fieldOfStudy: "Science",
  startMonth: null,
  startYear: null,
  endMonth: null,
  graduationYear: 2016,
  gradeType: "PERCENTAGE",
  grade: "91",
});

const EDUCATION = [school(), TWELFTH, TENTH];

const skill = (skillId: string, name: string): SkillRef => ({ skillId, name });

console.log("\nAdmin per-field profile edit (Hire View Details)\n");

/* ─── Experience ─────────────────────────────────────────────────────────── */

suite("an experience edit changes one field of one row", () => {
  const rows = [job(), job({ id: "exp_2", companyName: "Globex", title: "Lead" })];
  const plan = planExperienceEdit(rows, "exp_2", { field: "title", value: "Staff Engineer" });
  assert(plan.ok && plan.changed, "edit is accepted");
  if (!plan.ok) return;
  assert(plan.rows.length === 2, "no row added or dropped");
  assert(plan.rows[1]!.title === "Staff Engineer", "the named row is patched");
  assert(plan.rows[1]!.companyName === "Globex", "its other fields are untouched");
  assert(
    JSON.stringify(plan.rows[0]) === JSON.stringify({ ...rows[0], id: undefined, totalMonths: undefined }),
    "the other row is written back exactly as read",
  );
  assert(plan.previous.title === "Lead" && plan.next.title === "Staff Engineer", "audit holds before and after");
});

suite("saving the value already stored writes nothing", () => {
  const plan = planExperienceEdit([job()], "exp_1", { field: "title", value: "Engineer" });
  assert(plan.ok && !plan.changed, "unchanged edit is a no-op");
});

suite("an edit against a row that no longer exists is refused as stale", () => {
  const plan = planExperienceEdit([job()], "exp_gone", { field: "title", value: "X" });
  assert(!plan.ok && plan.message === STALE_ENTRY_MESSAGE, "stale row id is refused");
  const removal = planExperienceRemoval([job()], "exp_gone");
  assert(!removal.ok && removal.message === STALE_ENTRY_MESSAGE, "stale removal is refused");
});

suite("the edited field must pass the candidate form's own rules", () => {
  const badCity = planExperienceEdit([job()], "exp_1", { field: "locationCity", value: "Pune 411001" });
  assert(!badCity.ok, "a city with digits is refused");
  const noEmployer = planExperienceEdit([job()], "exp_1", { field: "companyName", value: "" });
  assert(!noEmployer.ok, "a role cannot lose its employer");
  const backwards = planExperienceEdit([job()], "exp_1", {
    field: "dates",
    value: { startMonth: 1, startYear: 2023, endMonth: 6, endYear: 2022, isCurrent: false },
  });
  assert(!backwards.ok, "a role cannot end before it started");
});

suite("a problem already on another field does not block the edit", () => {
  const rows = [job(), job({ id: "exp_2", locationCity: "Bengaluru, India" })];
  const other = planExperienceEdit(rows, "exp_1", { field: "title", value: "Senior Engineer" });
  assert(other.ok && other.changed, "another row's old problem does not block");
  const sameRow = planExperienceEdit(rows, "exp_2", { field: "title", value: "Senior Engineer" });
  assert(sameRow.ok && sameRow.changed, "the same row's other field does not block");
  if (sameRow.ok) {
    assert(sameRow.rows[1]!.locationCity === "Bengaluru, India", "the old value is written back untouched");
  }
});

suite("an old problem on the edited field itself still has to be fixed", () => {
  const rows = [job({ locationCity: "Bengaluru, India" })];
  const stillBad = planExperienceEdit(rows, "exp_1", { field: "locationCity", value: "Mumbai, India" });
  assert(!stillBad.ok, "swapping one invalid city for another is refused");
  const fixed = planExperienceEdit(rows, "exp_1", { field: "locationCity", value: "Mumbai" });
  assert(fixed.ok && fixed.changed, "a valid city is accepted");
});

suite("experience dates keep what the writer can store", () => {
  const noMonth = planExperienceEdit([job()], "exp_1", {
    field: "dates",
    value: { startMonth: 1, startYear: 2020, endMonth: null, endYear: 2022, isCurrent: false },
  });
  assert(!noMonth.ok, "an end year with no month would be dropped by saveExperience");
  const current = planExperienceEdit([job()], "exp_1", {
    field: "dates",
    value: { startMonth: 1, startYear: 2020, endMonth: 6, endYear: 2022, isCurrent: true },
  });
  assert(current.ok && current.changed, "marking a role current is accepted");
  if (current.ok) {
    assert(
      current.rows[0]!.endYear === null && current.rows[0]!.endMonth === null,
      "a current role has no end date",
    );
  }
});

suite("empty optional text is stored as null, as the candidate form does", () => {
  const plan = planExperienceEdit([job({ description: "Built things" })], "exp_1", {
    field: "description",
    value: "",
  });
  assert(plan.ok && plan.changed && plan.rows[0]!.description === null, "blank clears to null");
});

suite("removing an experience entry removes exactly that row", () => {
  const rows = [job(), job({ id: "exp_2", companyName: "Globex" })];
  const plan = planExperienceRemoval(rows, "exp_1");
  assert(plan.ok && plan.rows.length === 1, "one row left");
  if (!plan.ok) return;
  assert(plan.rows[0]!.companyName === "Globex", "the other row survives");
  assert(plan.previous.companyName === "Acme", "audit keeps what was removed");
});

suite("the boundary schema refuses unknown fields and out-of-range years", () => {
  assert(!experienceEditSchema.safeParse({ field: "organizationId", value: "x" }).success, "unknown field");
  assert(!experienceEditSchema.safeParse({ field: "title", value: "x".repeat(201) }).success, "over-long title");
  assert(
    !experienceEditSchema.safeParse({
      field: "dates",
      value: { startMonth: 13, startYear: 2020, endMonth: null, endYear: null, isCurrent: true },
    }).success,
    "month 13",
  );
  assert(!educationEditSchema.safeParse({ field: "collegeId", value: "x" }).success, "collegeId is not editable");
  assert(
    !educationEditSchema.safeParse({ field: "score", value: { gradeType: "MADE_UP", grade: "9" } }).success,
    "unknown score type",
  );
});

/* ─── Education ──────────────────────────────────────────────────────────── */

suite("education rows land in the candidate form's slots", () => {
  assert(educationSlotOf(EDUCATION, "edu_x") === "tenth", "Class X");
  assert(educationSlotOf(EDUCATION, "edu_xii") === "twelfth", "Class XII");
  assert(educationSlotOf(EDUCATION, "edu_college") === "higher", "college");
});

suite("a school slot only takes the fields the candidate's form shows", () => {
  const description = planEducationEdit(EDUCATION, "edu_x", { field: "description", value: "Head boy" });
  assert(!description.ok, "Class X has no description");
  const degree = planEducationEdit(EDUCATION, "edu_xii", { field: "degree", value: "B.Sc" });
  assert(!degree.ok, "Class XII's degree is set by its tab");
  const stream = planEducationEdit(EDUCATION, "edu_xii", { field: "fieldOfStudy", value: "Commerce" });
  assert(stream.ok && stream.changed, "Class XII's stream is editable");
});

suite("renaming an institution drops the stale catalog link", () => {
  const renamed = planEducationEdit(EDUCATION, "edu_college", {
    field: "institutionName",
    value: "IIT Delhi",
  });
  assert(renamed.ok && renamed.changed, "rename accepted");
  if (renamed.ok) {
    assert(renamed.rows[0]!.institutionName === "IIT Delhi", "name written");
    assert(renamed.rows[0]!.collegeId === null, "collegeId cleared");
    assert(renamed.rows[1]!.institutionName === "Delhi Public School", "other rows untouched");
  }
  const same = planEducationEdit(EDUCATION, "edu_college", {
    field: "institutionName",
    value: "IIT Bombay",
  });
  assert(same.ok && !same.changed, "the same name keeps its link and writes nothing");
});

suite("an education edit cannot break the timeline", () => {
  const early = planEducationEdit(EDUCATION, "edu_college", {
    field: "dates",
    value: { startMonth: 7, startYear: 2015, endMonth: 5, graduationYear: 2019, isCurrent: false },
  });
  assert(!early.ok, "college cannot start before Class XII");
  const later = planEducationEdit(EDUCATION, "edu_college", {
    field: "dates",
    value: { startMonth: 7, startYear: 2017, endMonth: 5, graduationYear: 2021, isCurrent: false },
  });
  assert(later.ok && later.changed, "a consistent date range is accepted");
});

suite("a score needs its scale", () => {
  const rows = [school({ gradeType: null, grade: null }), TWELFTH, TENTH];
  const bare = planEducationEdit(rows, "edu_college", {
    field: "score",
    value: { gradeType: null, grade: "8.6" },
  });
  assert(!bare.ok, "a score with no type is refused");
  const tooHigh = planEducationEdit(rows, "edu_college", {
    field: "score",
    value: { gradeType: "CGPA_10", grade: "11" },
  });
  assert(!tooHigh.ok, "a CGPA above 10 is refused");
  const good = planEducationEdit(rows, "edu_college", {
    field: "score",
    value: { gradeType: "CGPA_10", grade: "8.6" },
  });
  assert(good.ok && good.changed, "a score with its scale is accepted");
});

suite("removing an education entry keeps the rest in order", () => {
  const plan = planEducationRemoval(EDUCATION, "edu_xii");
  assert(plan.ok && plan.rows.length === 2, "one row removed");
  if (!plan.ok) return;
  assert(plan.rows[0]!.institutionName === "IIT Bombay", "college still first");
  assert(plan.rows[1]!.degree === "Secondary (10th)", "Class X still after it");
});

/* ─── Skills ─────────────────────────────────────────────────────────────── */

const REACT = skill("sk_react", "React");
const NODE = skill("sk_node", "Node.js");
const PYTHON = skill("sk_python", "Python");
const CLAIMS = [REACT, NODE, PYTHON];
/** Python carries evidence; Claude API is programme-verified and not claimed. */
const EVIDENCE = [PYTHON, skill("sk_claude", "Claude API")];

suite("only claims with no evidence behind them are self-declared", () => {
  const names = selfDeclaredSkills(CLAIMS, EVIDENCE).map((s) => s.name);
  assert(names.join(",") === "React,Node.js", `got ${names.join(",")}`);
});

suite("an evidence-backed skill cannot be removed, replaced or re-added", () => {
  const remove = planSkillClaimChange(CLAIMS, EVIDENCE, { kind: "remove", skillId: "sk_python" });
  assert(!remove.ok, "remove refused");
  const replace = planSkillClaimChange(CLAIMS, EVIDENCE, {
    kind: "replace",
    skillId: "sk_python",
    skill: skill("sk_go", "Go"),
  });
  assert(!replace.ok, "replace refused");
  const addById = planSkillClaimChange(CLAIMS, EVIDENCE, { kind: "add", skill: skill("sk_claude", "Claude API") });
  assert(!addById.ok, "adding a programme-verified skill is refused");
  const addByName = planSkillClaimChange(CLAIMS, EVIDENCE, { kind: "add", skill: skill("sk_other", "claude api") });
  assert(!addByName.ok, "matched by name as well as id");
  const into = planSkillClaimChange(CLAIMS, EVIDENCE, {
    kind: "replace",
    skillId: "sk_react",
    skill: skill("sk_claude", "Claude API"),
  });
  assert(!into.ok, "a claim cannot be swapped onto an evidence-backed skill");
});

suite("removing a claim leaves every other claim in the written set", () => {
  const plan = planSkillClaimChange(CLAIMS, EVIDENCE, { kind: "remove", skillId: "sk_react" });
  assert(plan.ok && plan.changed, "remove accepted");
  if (!plan.ok) return;
  const ids = plan.claims.map((c) => c.skillId).join(",");
  // saveSkillClaims withdraws whatever is missing from this set, so the
  // evidence-backed claim must still be in it.
  assert(ids === "sk_node,sk_python", `got ${ids}`);
  assert(plan.previous?.name === "React" && plan.next === null, "audit before and after");
});

suite("adding and swapping self-declared claims", () => {
  const add = planSkillClaimChange(CLAIMS, EVIDENCE, { kind: "add", skill: skill("sk_go", "Go") });
  assert(add.ok && add.changed, "add accepted");
  if (add.ok) assert(add.claims.length === 4, "one more claim");

  const dup = planSkillClaimChange(CLAIMS, EVIDENCE, { kind: "add", skill: REACT });
  assert(!dup.ok, "a skill already claimed is refused");

  const swap = planSkillClaimChange(CLAIMS, EVIDENCE, {
    kind: "replace",
    skillId: "sk_react",
    skill: skill("sk_next", "Next.js"),
  });
  assert(swap.ok && swap.changed, "swap accepted");
  if (swap.ok) {
    const ids = swap.claims.map((c) => c.skillId).join(",");
    assert(ids === "sk_node,sk_python,sk_next", `got ${ids}`);
  }

  const same = planSkillClaimChange(CLAIMS, EVIDENCE, { kind: "replace", skillId: "sk_react", skill: REACT });
  assert(same.ok && !same.changed, "swapping a skill for itself writes nothing");

  const gone = planSkillClaimChange(CLAIMS, EVIDENCE, { kind: "remove", skillId: "sk_missing" });
  assert(!gone.ok, "a claim that is not there cannot be removed");
});

suite("the candidate's own cap on skills applies to an admin add", () => {
  const full = Array.from({ length: MAX_SKILL_CLAIMS }, (_, i) => skill(`sk_${i}`, `Skill ${i}`));
  const add = planSkillClaimChange(full, [], { kind: "add", skill: skill("sk_new", "New") });
  assert(!add.ok, "the 61st skill is refused");
  const swap = planSkillClaimChange(full, [], { kind: "replace", skillId: "sk_0", skill: skill("sk_new", "New") });
  assert(swap.ok && swap.changed, "a swap at the cap is still allowed");
});

/* ─── The boundary, pinned in source ─────────────────────────────────────── */

suite("every admin edit action calls requireAdmin before anything else", () => {
  const actions = code(ACTIONS).split("export async function ").slice(1);
  assert(actions.length === 6, `expected 6 exported actions, found ${actions.length}`);
  for (const action of actions) {
    const name = /^\w+/.exec(action)?.[0];
    // The body opens at the first brace that ends a line; braces inside the
    // return type sit mid-line.
    const first = action
      .slice(action.indexOf("{\n") + 1)
      .trimStart()
      .split("\n")[0]!
      .trim();
    assert(
      first === "await requireAdmin();" || first === "const admin = await requireAdmin();",
      `${name} must call requireAdmin() first, found: ${first}`,
    );
  }
});

suite("admin edits write through the candidate's own section writers", () => {
  const src = code(ACTIONS);
  assert(!src.includes("@/lib/db"), "no Prisma client in the action file");
  assert(!/\b(prisma|tx)\.\w+\.(create|update|upsert|delete)/.test(src), "no ad-hoc writes");
  for (const writer of ["saveExperience(", "saveEducation(", "saveSkillClaims("]) {
    assert(src.includes(writer), `${writer} is the write path`);
  }
  // The read the candidate's /profile uses, so one source of truth.
  assert(src.includes("getCandidateDetail("), "education is read where /profile reads it");
  assert(src.includes('revalidatePath("/profile")'), "the candidate's profile is refreshed");
});

suite("every admin write carries an audit row in the same transaction", () => {
  const src = code(ACTIONS);
  const writes = (src.match(/await save(Experience|Education|SkillClaims)\(/g) ?? []).length;
  const audits = (src.match(/writeAudit\(tx, \{/g) ?? []).length;
  assert(writes === 5, `expected 5 writes, found ${writes}`);
  assert(audits === writes, `each write needs its audit: ${audits} audits for ${writes} writes`);
  assert(!src.includes("writeClient"), "no second transaction for the audit");
  for (const entity of ["CandidateExperience", "CandidateEducation", "CandidateSkill"]) {
    assert(src.includes(`entityType: "${entity}"`), `${entity} is audited`);
  }
  assert(src.includes("previousState: plan.previous"), "before snapshot");
  assert(src.includes("newState: plan.next"), "after snapshot");
  assert(src.includes("targetUserId: userId"), "names the candidate");

  const repo = code(REPO);
  for (const fn of ["saveEducation", "saveExperience", "saveSkillClaims"]) {
    const body = repo.slice(repo.indexOf(`export async function ${fn}`));
    const end = body.indexOf("\n}\n");
    assert(
      body.slice(0, end).includes("await afterWrite?.(tx);"),
      `${fn} runs the hook inside its transaction`,
    );
  }
});

suite("admin edits never touch skill evidence", () => {
  const src = code(ACTIONS);
  for (const word of ["skillEvidence", "evidenceScore", "evidenceCount", "verified:"]) {
    assert(!src.includes(word), `action file must not write ${word}`);
  }
  assert(src.includes("planSkillClaimChange("), "the evidence-backed guard is on the write path");
  const sections = code(SECTIONS);
  assert(sections.includes("Self-declared"), "controls sit on self-declared chips");
  assert(!sections.includes("Evidence-backed"), "the admin editor never renders evidence-backed chips");
});

suite("recruiters get no edit controls", () => {
  const src = code(INSPECTOR);
  assert(src.includes("const { isAdmin } = useHireAuth();"), "reads the admin flag");
  assert(
    src.includes("const adminCanEdit = isAdmin && !sample && !preview;"),
    "samples and locked previews are never editable",
  );
  assert(src.includes("if (!adminCanEdit) return;"), "the admin loader is skipped for everyone else");
  // Each admin component is rendered only where `adminProfile` is set.
  for (const component of ["AdminExperienceEntry", "AdminEducationList", "AdminSelfDeclaredSkills"]) {
    const at = src.indexOf(`<${component}`);
    assert(at > 0, `${component} is mounted`);
    const lead = src.slice(Math.max(0, at - 400), at);
    assert(
      lead.includes("if (adminProfile) {") || lead.includes("adminProfile ? ("),
      `${component} is behind adminProfile`,
    );
  }
  assert(!src.includes("Pencil"), "the read-only markup carries no pencil of its own");

  const provider = code("src/components/hire/hire-auth-provider.tsx");
  assert(provider.includes("isAdmin = false"), "isAdmin defaults to false");
  const layout = code("src/app/hire/layout.tsx");
  assert(
    layout.includes("isAdmin={session?.user?.isAdmin === true}"),
    "the flag comes from the session, strictly true",
  );
});

suite("the recruiter loaders are unchanged and expose no education rows", () => {
  const src = code("src/app/actions/hire-view-actions.ts");
  assert(!src.includes("getCandidateDetail"), "no full-profile read on the recruiter surface");
  assert(!src.includes("requireAdmin"), "recruiter loaders are not admin actions");
  assert(!/save(Experience|Education|SkillClaims)/.test(src), "no writes in hire-view-actions");
});

suite("nothing candidate-facing knows about admin editing", () => {
  const surfaces = [...filesUnder("src/components/profile"), ...filesUnder("src/app/profile")];
  assert(surfaces.length > 10, "profile surfaces found");
  for (const file of surfaces) {
    const src = read(file);
    for (const marker of [
      "admin-hire-profile-actions",
      "admin-profile-edit",
      "admin-inline-field",
      "inspector-admin-sections",
      "edited by",
      "Edited by",
    ]) {
      assert(!src.includes(marker), `${file} must not mention ${marker}`);
    }
  }
  for (const file of ["experience-section", "education-section", "skills-section"]) {
    const src = read(`src/components/profile/${file}.tsx`);
    assert(!/admin/i.test(src), `${file} must not mention admins`);
  }
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
