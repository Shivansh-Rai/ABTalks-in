import { z } from "zod";
import {
  ASSESSMENT_CONTENT_SHAPE,
  correctOptionIssues,
  type AssessmentContent,
} from "@/lib/validations/assessment";

/**
 * Plan 185 — filling the assessment builder from a JSON file.
 *
 * Runs in the browser: the file is read, checked and handed to the builder's
 * state. It is never uploaded or stored. Nothing is written until the recruiter
 * or admin presses Save draft or Publish, where the server validates the draft
 * again exactly as it does for a hand-built one.
 *
 * No server imports: this module is shared by the recruiter and admin builders.
 */

/** Files larger than this are refused before they are read. */
export const MAX_IMPORT_BYTES = 1_000_000;

export const ASSESSMENT_IMPORT_FORMAT_VERSION = 1;

/** Where the annotated sample lives (public/documents). */
export const ASSESSMENT_IMPORT_FORMAT_HREF =
  "/documents/assessment-import-format.json";
export const ASSESSMENT_IMPORT_FORMAT_FILENAME = "assessment-import-format.json";

/** How many problems are listed before the rest are summarised. */
const MAX_ISSUES_SHOWN = 20;

/**
 * The file: assessment content plus the format's version. Strict at every
 * level, so a misspelt key ("isCorect") is named instead of being dropped and
 * leaving a question with no correct answer.
 */
export const assessmentImportSchema = z
  .object({
    formatVersion: z.literal(
      ASSESSMENT_IMPORT_FORMAT_VERSION,
      `Set "formatVersion" to ${ASSESSMENT_IMPORT_FORMAT_VERSION}`,
    ),
    ...ASSESSMENT_CONTENT_SHAPE,
  })
  .strict()
  .superRefine((file, ctx) => {
    for (const issue of correctOptionIssues(file.questions)) {
      ctx.addIssue({ code: "custom", ...issue });
    }
  });

export type AssessmentImportResult =
  | { ok: true; data: AssessmentContent }
  | { ok: false; message: string; issues: string[] };

/**
 * Remove `//` and block comments and trailing commas, so the downloadable
 * sample (which explains itself in comments and ships its optional fields
 * commented out) can be edited and imported as it is.
 *
 * String-aware: `//` inside "https://…" and a comma inside a question's text
 * are data, never syntax. Comments become spaces and keep their newlines, so a
 * position in a JSON.parse error still points at the right line of the file.
 */
export function stripJsonComments(text: string): string {
  let out = "";
  let i = 0;
  let inString = false;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inString) {
      out += ch;
      if (ch === "\\" && next !== undefined) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }

    if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      for (; i < stop; i++) out += text[i] === "\n" ? "\n" : " ";
      continue;
    }

    out += ch;
    i++;
  }

  return dropTrailingCommas(out);
}

/** `[1, 2, ]` and `{ "a": 1, }` — what is left when a last line is commented out. */
function dropTrailingCommas(text: string): string {
  let out = "";
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1];
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "}" || text[j] === "]") {
        out += " ";
        continue;
      }
    }

    out += ch;
  }

  return out;
}

/** ["questions", 2, "options", 1, "body"] → "Question 3, option 2, body". */
function describePath(path: PropertyKey[]): string {
  if (path.length === 0) return "File";
  if (path[0] !== "questions" || typeof path[1] !== "number") {
    return path.map(String).join(".");
  }
  const parts = [`Question ${path[1] + 1}`];
  const rest = path.slice(2);
  if (rest[0] === "options" && typeof rest[1] === "number") {
    parts.push(`option ${rest[1] + 1}`);
    if (rest.length > 2) parts.push(rest.slice(2).map(String).join("."));
  } else if (rest.length > 0) {
    parts.push(rest.map(String).join("."));
  }
  return parts.join(", ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The only keys an option may carry. Mirrors `optionSchema`. */
const OPTION_KEYS = ["body", "isCorrect"];

/**
 * Misspelt keys on an option, read from the raw file.
 *
 * The option schema is the builder's own and is not strict, so on its own it
 * would drop `"isCorect": true` without a word and the question would then
 * fail as "no correct option" — true, but not the cause. Making that schema
 * strict would change what the draft accepts everywhere, so the check lives
 * here, where it applies to files only.
 */
function unknownOptionKeyIssues(json: unknown): string[] {
  const issues: string[] = [];
  const questions =
    isRecord(json) && Array.isArray(json.questions) ? json.questions : [];
  questions.forEach((question: unknown, qi: number) => {
    const options =
      isRecord(question) && Array.isArray(question.options)
        ? question.options
        : [];
    options.forEach((option: unknown, oi: number) => {
      if (!isRecord(option)) return;
      for (const key of Object.keys(option)) {
        if (!OPTION_KEYS.includes(key)) {
          issues.push(
            `Question ${qi + 1}, option ${oi + 1}: Unrecognized key: "${key}"`,
          );
        }
      }
    });
  });
  return issues;
}

const QUESTION_TYPES = '"MULTIPLE_CHOICE", "PARAGRAPH" or "FILE_UPLOAD"';

function describeIssue(issue: z.core.$ZodIssue): string {
  const where = describePath(issue.path);
  // A question whose "type" is missing or unknown fails the union as a whole,
  // with nothing more useful than "Invalid input".
  if (issue.code === "invalid_union") {
    const atType = issue.path[issue.path.length - 1] === "type";
    return atType
      ? `${where}: must be ${QUESTION_TYPES}`
      : `${where}, type: must be ${QUESTION_TYPES}`;
  }
  return `${where}: ${issue.message}`;
}

/**
 * Read a file's text into assessment content, or say exactly what is wrong.
 * All-or-nothing: one bad question refuses the whole file, so the builder is
 * never left half-filled.
 */
export function parseAssessmentImport(text: string): AssessmentImportResult {
  // Notepad on Windows saves UTF-8 with a byte-order mark JSON.parse rejects.
  const source = text.replace(/^﻿/, "");
  if (source.trim() === "") {
    return { ok: false, message: "This file is empty.", issues: [] };
  }

  let json: unknown;
  try {
    json = JSON.parse(stripJsonComments(source));
  } catch (error) {
    return {
      ok: false,
      message: "This file is not valid JSON.",
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }

  const parsed = assessmentImportSchema.safeParse(json);
  // Misspelt option keys first: they are usually the cause of what follows.
  const optionKeyIssues = unknownOptionKeyIssues(json);
  if (!parsed.success || optionKeyIssues.length > 0) {
    const all = [
      ...new Set([
        ...optionKeyIssues,
        ...(parsed.success ? [] : parsed.error.issues.map(describeIssue)),
      ]),
    ];
    const issues = all.slice(0, MAX_ISSUES_SHOWN);
    if (all.length > issues.length) {
      issues.push(`and ${all.length - issues.length} more`);
    }
    return {
      ok: false,
      message: "This file does not match the assessment format.",
      issues,
    };
  }

  // The version is the file's concern, not the assessment's.
  const { formatVersion: _formatVersion, ...content } = parsed.data;
  void _formatVersion;
  return { ok: true, data: content };
}
