import { GradeType } from "@prisma/client";
import { z } from "zod";
import { assignEducationSlots } from "@/lib/candidate-vocab";
import {
  educationSectionSchema,
  experienceSectionSchema,
} from "@/lib/validations/candidate-profile";
import type {
  EducationView,
  EducationWrite,
  ExperienceView,
  ExperienceWrite,
} from "@/repositories/candidate-detail";

/**
 * Platform Admin edits of one candidate's Experience, Education and
 * self-declared skills, made from Hire → View Details.
 *
 * Pure on purpose: no Prisma, no session. `admin-hire-profile-actions.ts` reads
 * the current rows, hands them here to be patched and checked, and writes the
 * result through the same `saveExperience` / `saveEducation` /
 * `saveSkillClaims` the candidate's own profile uses, so there is one source of
 * truth and no admin-only copy.
 *
 * Two rules live here and nowhere else:
 *
 *   - The edited field must pass the candidate's own form schema, and the edit
 *     must not introduce a problem anywhere else. A problem that was already
 *     on some other field (an imported row with "Bengaluru, India" as its
 *     city) does not block, because the admin did not cause it and is not
 *     looking at it.
 *   - A skill with evidence behind it is never editable. Only self-declared
 *     claims can be added, removed or swapped.
 *
 * Those writers replace a whole section, and a replace mints new row ids. An
 * edit therefore names its row by the id the admin was shown: if the candidate
 * saved in between, that id is gone and the edit is refused as stale rather
 * than applied to whichever row now sits in that position.
 */

export const STALE_ENTRY_MESSAGE =
  "This entry changed since you opened it. The latest version is now shown.";

/** What goes into the audit row: the edited field's value, before and after. */
export type FieldSnapshot = Record<string, string | number | boolean | null>;

export type EditPlan<Row> =
  | {
      ok: true;
      /** False when the value is what was already stored: nothing to write. */
      changed: boolean;
      rows: Row[];
      previous: FieldSnapshot;
      next: FieldSnapshot;
      /** Names the entry in the audit trail, since row ids do not survive a save. */
      entry: string;
    }
  | { ok: false; message: string };

/* ─── Boundary schemas ───────────────────────────────────────────────────── */

const textEdit = <F extends string>(field: F, max: number) =>
  z.object({
    field: z.literal(field),
    value: z.string().trim().max(max, `Keep this under ${max} characters`),
  });

const month = z.number().int().min(1).max(12).nullable();
const year = z
  .number()
  .int()
  .min(1950, "Enter a year between 1950 and 2040")
  .max(2040, "Enter a year between 1950 and 2040")
  .nullable();

const experienceDates = z.object({
  startMonth: month,
  startYear: year,
  endMonth: month,
  endYear: year,
  isCurrent: z.boolean(),
});

export const experienceEditSchema = z.discriminatedUnion("field", [
  textEdit("title", 200),
  textEdit("companyName", 200),
  textEdit("employmentType", 60),
  textEdit("locationCity", 120),
  textEdit("description", 4000),
  z.object({ field: z.literal("dates"), value: experienceDates }),
]);

export type ExperienceEdit = z.infer<typeof experienceEditSchema>;
export type ExperienceDates = z.infer<typeof experienceDates>;

const educationDates = z.object({
  startMonth: month,
  startYear: year,
  endMonth: month,
  graduationYear: year,
  isCurrent: z.boolean(),
});

const educationScore = z.object({
  gradeType: z.enum(GradeType).nullable(),
  grade: z.string().trim().max(40, "Keep this under 40 characters"),
});

export const educationEditSchema = z.discriminatedUnion("field", [
  textEdit("institutionName", 200),
  textEdit("degree", 160),
  textEdit("fieldOfStudy", 160),
  textEdit("description", 4000),
  z.object({ field: z.literal("dates"), value: educationDates }),
  z.object({ field: z.literal("score"), value: educationScore }),
]);

export type EducationEdit = z.infer<typeof educationEditSchema>;
export type EducationDates = z.infer<typeof educationDates>;
export type EducationScore = z.infer<typeof educationScore>;
export type EducationEditField = EducationEdit["field"];

/* ─── "Did this edit make anything worse?" ───────────────────────────────── */

function issueKeys(schema: z.ZodType, value: unknown): string[] {
  const parsed = schema.safeParse(value);
  if (parsed.success) return [];
  return parsed.error.issues.map(
    (issue) => `${issue.path.join(".")}|${issue.message}`,
  );
}

/**
 * The problem that refuses an edit, or null when it may be saved.
 *
 * Two kinds block: any problem on the edited field itself (`ownPaths`), old or
 * new, because the admin is looking at that field and can fix it; and any
 * problem `after` has that `before` did not, wherever it lands. Row counts are
 * equal on both sides, so a path names the same row in each.
 */
function blockingIssue(
  schema: z.ZodType,
  before: unknown,
  after: unknown,
  ownPaths: readonly string[],
): string | null {
  const known = new Set(issueKeys(schema, before));
  const own = new Set(ownPaths);
  const hit = issueKeys(schema, after).find(
    (key) => own.has(key.slice(0, key.indexOf("|"))) || !known.has(key),
  );
  return hit ? hit.slice(hit.indexOf("|") + 1) : null;
}

const rowPaths = (index: number, fields: readonly string[]): string[] =>
  fields.map((field) => `rows.${index}.${field}`);

const EXPERIENCE_DATE_FIELDS = [
  "startMonth",
  "startYear",
  "endMonth",
  "endYear",
  "isCurrent",
] as const;

const EDUCATION_DATE_FIELDS = [
  "startMonth",
  "startYear",
  "endMonth",
  "graduationYear",
  "isCurrent",
] as const;

const blankToNull = (value: string): string | null =>
  value === "" ? null : value;

function sameSnapshot(a: FieldSnapshot, b: FieldSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ─── Experience ─────────────────────────────────────────────────────────── */

function experienceWrite(row: ExperienceView): ExperienceWrite {
  return {
    companyName: row.companyName,
    title: row.title,
    employmentType: row.employmentType,
    locationCity: row.locationCity,
    startMonth: row.startMonth,
    startYear: row.startYear,
    endMonth: row.endMonth,
    endYear: row.endYear,
    isCurrent: row.isCurrent,
    description: row.description,
  };
}

function experienceEntry(row: ExperienceWrite): string {
  return [row.title, row.companyName].filter(Boolean).join(" at ");
}

function experienceSection(rows: readonly ExperienceWrite[]) {
  return { hasNoWorkExperience: false, rows };
}

export function planExperienceEdit(
  rows: readonly ExperienceView[],
  rowId: string,
  edit: ExperienceEdit,
): EditPlan<ExperienceWrite> {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index === -1) return { ok: false, message: STALE_ENTRY_MESSAGE };

  const before = rows.map(experienceWrite);
  const current = before[index]!;
  let patched: ExperienceWrite;
  let previous: FieldSnapshot;
  let next: FieldSnapshot;

  if (edit.field === "dates") {
    const dates = edit.value;
    if (dates.startYear === null) {
      return { ok: false, message: "Add the year this role started" };
    }
    if (dates.startMonth === null) {
      return { ok: false, message: "Pick the month this role started" };
    }
    // `saveExperience` stores an end date only when it has both halves, so a
    // year with no month would be dropped without a word.
    if (!dates.isCurrent && dates.endYear !== null && dates.endMonth === null) {
      return { ok: false, message: "Pick the month this role ended" };
    }
    const value = dates.isCurrent
      ? { ...dates, endMonth: null, endYear: null }
      : dates;
    patched = { ...current, ...value };
    previous = {
      startMonth: current.startMonth,
      startYear: current.startYear,
      endMonth: current.endMonth,
      endYear: current.endYear,
      isCurrent: current.isCurrent,
    };
    next = { ...value };
  } else if (edit.field === "title" || edit.field === "companyName") {
    patched = { ...current, [edit.field]: edit.value };
    previous = { [edit.field]: current[edit.field] };
    next = { [edit.field]: edit.value };
  } else {
    const value = blankToNull(edit.value);
    patched = { ...current, [edit.field]: value };
    previous = { [edit.field]: current[edit.field] };
    next = { [edit.field]: value };
  }

  const after = before.map((row, i) => (i === index ? patched : row));
  const entry = experienceEntry(current);
  if (sameSnapshot(previous, next)) {
    return { ok: true, changed: false, rows: before, previous, next, entry };
  }

  const problem = blockingIssue(
    experienceSectionSchema,
    experienceSection(before),
    experienceSection(after),
    rowPaths(
      index,
      edit.field === "dates" ? EXPERIENCE_DATE_FIELDS : [edit.field],
    ),
  );
  if (problem) return { ok: false, message: problem };

  return { ok: true, changed: true, rows: after, previous, next, entry };
}

export function planExperienceRemoval(
  rows: readonly ExperienceView[],
  rowId: string,
): EditPlan<ExperienceWrite> {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index === -1) return { ok: false, message: STALE_ENTRY_MESSAGE };

  const before = rows.map(experienceWrite);
  const removed = before[index]!;
  return {
    ok: true,
    changed: true,
    rows: before.filter((_, i) => i !== index),
    previous: { ...removed },
    next: {},
    entry: experienceEntry(removed),
  };
}

/* ─── Education ──────────────────────────────────────────────────────────── */

/**
 * Which form slot a saved row reads back into. The candidate's Education form
 * shows fewer fields for Class X and Class XII than for a degree, and drops
 * whatever a school slot does not show the next time the candidate saves.
 */
export type EducationSlot = "tenth" | "twelfth" | "higher";

/**
 * The fields an admin may edit on a row in each slot: exactly the ones the
 * candidate's own form shows there. Offering more would write a value that
 * vanishes on the candidate's next save.
 */
export const EDITABLE_EDUCATION_FIELDS: Record<
  EducationSlot,
  readonly EducationEditField[]
> = {
  tenth: ["institutionName", "dates", "score"],
  twelfth: ["institutionName", "fieldOfStudy", "dates", "score"],
  higher: [
    "institutionName",
    "degree",
    "fieldOfStudy",
    "dates",
    "score",
    "description",
  ],
};

export function educationSlotOf(
  rows: readonly EducationView[],
  rowId: string,
): EducationSlot {
  const slots = assignEducationSlots(rows);
  if (slots.tenth?.id === rowId) return "tenth";
  if (slots.twelfth?.id === rowId) return "twelfth";
  return "higher";
}

function educationWrite(row: EducationView): EducationWrite {
  return {
    institutionName: row.institutionName,
    collegeId: row.collegeId,
    degree: row.degree,
    fieldOfStudy: row.fieldOfStudy,
    startMonth: row.startMonth,
    startYear: row.startYear,
    endMonth: row.endMonth,
    graduationYear: row.graduationYear,
    isCurrent: row.isCurrent,
    gradeType: row.gradeType,
    grade: row.grade,
    description: row.description,
  };
}

function educationEntry(row: EducationWrite): string {
  return [row.degree, row.institutionName].filter(Boolean).join(" at ");
}

export function planEducationEdit(
  rows: readonly EducationView[],
  rowId: string,
  edit: EducationEdit,
): EditPlan<EducationWrite> {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index === -1) return { ok: false, message: STALE_ENTRY_MESSAGE };

  const slot = educationSlotOf(rows, rowId);
  if (!EDITABLE_EDUCATION_FIELDS[slot].includes(edit.field)) {
    return { ok: false, message: "That field is not part of this entry." };
  }

  const before = rows.map(educationWrite);
  const current = before[index]!;
  let patched: EducationWrite;
  let previous: FieldSnapshot;
  let next: FieldSnapshot;

  if (edit.field === "dates") {
    const dates = edit.value;
    const value = dates.isCurrent
      ? { ...dates, endMonth: null, graduationYear: null }
      : dates;
    patched = { ...current, ...value };
    previous = {
      startMonth: current.startMonth,
      startYear: current.startYear,
      endMonth: current.endMonth,
      graduationYear: current.graduationYear,
      isCurrent: current.isCurrent,
    };
    next = { ...value };
  } else if (edit.field === "score") {
    const value = {
      gradeType: edit.value.gradeType,
      grade: blankToNull(edit.value.grade),
    };
    patched = { ...current, ...value };
    previous = { gradeType: current.gradeType, grade: current.grade };
    next = { ...value };
  } else if (edit.field === "institutionName") {
    // A retyped name no longer matches the catalog college it was picked from.
    // The candidate's own form clears the link the same way when a name is
    // typed rather than chosen.
    const renamed = edit.value !== current.institutionName;
    const collegeId = renamed ? null : current.collegeId;
    patched = { ...current, institutionName: edit.value, collegeId };
    previous = {
      institutionName: current.institutionName,
      collegeId: current.collegeId,
    };
    next = { institutionName: edit.value, collegeId };
  } else {
    const value = blankToNull(edit.value);
    patched = { ...current, [edit.field]: value };
    previous = { [edit.field]: current[edit.field] };
    next = { [edit.field]: value };
  }

  const after = before.map((row, i) => (i === index ? patched : row));
  const entry = educationEntry(current);
  if (sameSnapshot(previous, next)) {
    return { ok: true, changed: false, rows: before, previous, next, entry };
  }

  const problem = blockingIssue(
    educationSectionSchema,
    { rows: before },
    { rows: after },
    rowPaths(
      index,
      edit.field === "dates"
        ? EDUCATION_DATE_FIELDS
        : edit.field === "score"
          ? ["gradeType", "grade"]
          : [edit.field],
    ),
  );
  if (problem) return { ok: false, message: problem };

  return { ok: true, changed: true, rows: after, previous, next, entry };
}

export function planEducationRemoval(
  rows: readonly EducationView[],
  rowId: string,
): EditPlan<EducationWrite> {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index === -1) return { ok: false, message: STALE_ENTRY_MESSAGE };

  const before = rows.map(educationWrite);
  const removed = before[index]!;
  return {
    ok: true,
    changed: true,
    rows: before.filter((_, i) => i !== index),
    previous: { ...removed },
    next: {},
    entry: educationEntry(removed),
  };
}

/* ─── Skills ─────────────────────────────────────────────────────────────── */

/** The cap `skillSectionSchema` puts on the candidate's own list. */
export const MAX_SKILL_CLAIMS = 60;

export type SkillRef = { skillId: string; name: string };

export type SkillClaimChange =
  | { kind: "add"; skill: SkillRef }
  | { kind: "remove"; skillId: string }
  | { kind: "replace"; skillId: string; skill: SkillRef };

export type SkillClaimPlan =
  | {
      ok: true;
      changed: boolean;
      /** The full claim set to hand `saveSkillClaims`, which replaces the set. */
      claims: { skillId: string }[];
      previous: SkillRef | null;
      next: SkillRef | null;
    }
  | { ok: false; message: string };

/**
 * Evidence-backed means the skill row carries evidence or a programme the
 * candidate completed teaches it. Matched by name as well as id because that is
 * how View Details groups its chips.
 */
export function isEvidenceBacked(
  skill: SkillRef,
  evidenceBacked: readonly SkillRef[],
): boolean {
  const name = skill.name.trim().toLowerCase();
  return evidenceBacked.some(
    (other) =>
      other.skillId === skill.skillId ||
      other.name.trim().toLowerCase() === name,
  );
}

/** The claims an admin may touch: claimed by the candidate, no evidence behind them. */
export function selfDeclaredSkills(
  claims: readonly SkillRef[],
  evidenceBacked: readonly SkillRef[],
): SkillRef[] {
  return claims.filter((claim) => !isEvidenceBacked(claim, evidenceBacked));
}

const EVIDENCE_BACKED_MESSAGE =
  "Evidence-backed skills cannot be edited from here.";

/**
 * `claims` is every skill the candidate currently claims, evidence-backed ones
 * included: they stay in the set that is written back, because leaving one out
 * would withdraw a claim the admin never touched.
 */
export function planSkillClaimChange(
  claims: readonly SkillRef[],
  evidenceBacked: readonly SkillRef[],
  change: SkillClaimChange,
): SkillClaimPlan {
  const unchanged = (skill: SkillRef | null): SkillClaimPlan => ({
    ok: true,
    changed: false,
    claims: claims.map(({ skillId }) => ({ skillId })),
    previous: skill,
    next: skill,
  });

  let removed: SkillRef | null = null;
  if (change.kind !== "add") {
    const found = claims.find((claim) => claim.skillId === change.skillId);
    if (!found) {
      return { ok: false, message: "That skill is no longer on this profile." };
    }
    if (isEvidenceBacked(found, evidenceBacked)) {
      return { ok: false, message: EVIDENCE_BACKED_MESSAGE };
    }
    removed = found;
  }

  let added: SkillRef | null = null;
  if (change.kind !== "remove") {
    added = change.skill;
    if (removed && removed.skillId === added.skillId) return unchanged(removed);
    if (isEvidenceBacked(added, evidenceBacked)) {
      return {
        ok: false,
        message: `${added.name} is already evidence-backed on this profile.`,
      };
    }
    if (claims.some((claim) => claim.skillId === added!.skillId)) {
      return {
        ok: false,
        message: `${added.name} is already on this profile.`,
      };
    }
    if (!removed && claims.length >= MAX_SKILL_CLAIMS) {
      return {
        ok: false,
        message: `This profile already has ${MAX_SKILL_CLAIMS} skills.`,
      };
    }
  }

  const kept = claims.filter((claim) => claim.skillId !== removed?.skillId);
  const nextClaims = added ? [...kept, added] : kept;
  return {
    ok: true,
    changed: true,
    claims: nextClaims.map(({ skillId }) => ({ skillId })),
    previous: removed,
    next: added,
  };
}
