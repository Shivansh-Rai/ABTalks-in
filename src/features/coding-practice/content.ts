/**
 * Coding practice content: questions, starter code, harnesses and test cases.
 *
 * The content is JSON in this folder, not database rows. It is validated once
 * per server instance and then served from memory, so reading a question or
 * its tests costs no database query.
 *
 * SERVER-ONLY. Hidden tests, harnesses and reference solutions live here. Only
 * `getPracticeQuestion` returns data that is safe to hand to a client
 * component; never import the JSON files from anywhere else.
 */
import "server-only";
import type {
  CodeLanguageId,
  RunTestCase,
} from "@/features/code-runner/languages";
import {
  isPracticeProgramSlug,
  practiceActivityId,
  type PracticeProgramSlug,
} from "@/features/coding-practice/constants";
import {
  practiceChallengeSchema,
  practiceDaySchemaFor,
  type PracticeChallengeContent,
  type PracticeDayContent,
  type PracticeQuestionContent,
} from "@/lib/validations/coding-practice";
import arraysStringsChallenge from "./content/arrays-strings/challenge.json";
import arraysStringsDay01 from "./content/arrays-strings/day-01.json";

/** Add a challenge: one entry here, one slug in PRACTICE_PROGRAM_SLUGS. */
const RAW: Record<PracticeProgramSlug, { challenge: unknown; days: unknown[] }> =
  {
    "arrays-strings": {
      challenge: arraysStringsChallenge,
      days: [arraysStringsDay01],
    },
  };

type Loaded = {
  challenge: PracticeChallengeContent;
  days: Map<number, PracticeDayContent>;
};

const loaded = new Map<PracticeProgramSlug, Loaded>();

function load(slug: string): Loaded | null {
  if (!isPracticeProgramSlug(slug)) return null;
  const cached = loaded.get(slug);
  if (cached) return cached;

  const raw = RAW[slug];
  const challenge = practiceChallengeSchema.parse(raw.challenge);
  if (challenge.programSlug !== slug) {
    throw new Error(
      `[coding-practice] challenge.json for "${slug}" declares programSlug "${challenge.programSlug}"`,
    );
  }
  const daySchema = practiceDaySchemaFor(challenge);
  const days = new Map<number, PracticeDayContent>();
  for (const rawDay of raw.days) {
    const day = daySchema.parse(rawDay);
    if (days.has(day.day)) {
      throw new Error(`[coding-practice] "${slug}" has two files for day ${day.day}`);
    }
    days.set(day.day, day);
  }

  const result = { challenge, days };
  loaded.set(slug, result);
  return result;
}

function findQuestion(
  slug: string,
  day: number,
  slot: number,
): { content: Loaded; question: PracticeQuestionContent } | null {
  const content = load(slug);
  const question = content?.days
    .get(day)
    ?.questions.find((q) => q.slot === slot);
  return content && question ? { content, question } : null;
}

export type PracticeChallenge = PracticeChallengeContent & {
  /** Days that have content, ascending. */
  days: number[];
};

export function getPracticeChallenge(slug: string): PracticeChallenge | null {
  const content = load(slug);
  if (!content) return null;
  return {
    ...content.challenge,
    days: [...content.days.keys()].sort((a, b) => a - b),
  };
}

export type PracticeDayIndexEntry = {
  day: number;
  questions: {
    slot: number;
    title: string;
    difficulty: PracticeQuestionContent["difficulty"];
    tags: string[];
    activityId: string;
  }[];
};

/** Every day that has content, with the titles the day list shows. */
export function getPracticeDayIndex(slug: string): PracticeDayIndexEntry[] {
  const content = load(slug);
  if (!content) return [];
  return [...content.days.values()]
    .sort((a, b) => a.day - b.day)
    .map((d) => ({
      day: d.day,
      questions: d.questions.map((q) => ({
        slot: q.slot,
        title: q.title,
        difficulty: q.difficulty,
        tags: q.tags,
        activityId: practiceActivityId(content.challenge.idCode, d.day, q.slot),
      })),
    }));
}

/** Client-safe. No hidden tests, no harness, no solution. */
export type PracticeQuestion = {
  activityId: string;
  day: number;
  slot: number;
  title: string;
  difficulty: PracticeQuestionContent["difficulty"];
  tags: string[];
  statementMd: string;
  languages: CodeLanguageId[];
  defaultLanguage: CodeLanguageId;
  starterCode: Partial<Record<CodeLanguageId, string>>;
  examples: { input: string; output: string; explanation: string }[];
};

export function getPracticeQuestion(
  slug: string,
  day: number,
  slot: number,
): PracticeQuestion | null {
  const found = findQuestion(slug, day, slot);
  if (!found) return null;
  const { content, question } = found;
  return {
    activityId: practiceActivityId(content.challenge.idCode, day, slot),
    day,
    slot,
    title: question.title,
    difficulty: question.difficulty,
    tags: question.tags,
    statementMd: question.statementMd,
    languages: content.challenge.languages,
    defaultLanguage: content.challenge.defaultLanguage,
    starterCode: Object.fromEntries(
      content.challenge.languages.map((l) => [l, question.starterCode[l] ?? ""]),
    ),
    examples: question.tests.flatMap((t) =>
      !t.hidden && t.display && t.explanation
        ? [
            {
              input: t.display.input,
              output: t.display.output,
              explanation: t.explanation,
            },
          ]
        : [],
    ),
  };
}

/** SERVER-ONLY. Every test, hidden ones included, sample tests first. */
export function getPracticeTests(
  slug: string,
  day: number,
  slot: number,
): { timeLimitSec: number; tests: RunTestCase[] } | null {
  const found = findQuestion(slug, day, slot);
  if (!found) return null;
  const tests = found.question.tests.map((t) => ({
    input: t.input,
    expectedOutput: t.expectedOutput,
    hidden: t.hidden,
    ...(t.hidden || !t.display
      ? {}
      : { displayInput: t.display.input, displayOutput: t.display.output }),
  }));
  return {
    timeLimitSec: found.question.timeLimitSec,
    tests: [...tests.filter((t) => !t.hidden), ...tests.filter((t) => t.hidden)],
  };
}

/**
 * SERVER-ONLY. The program actually sent to the executor: the question's
 * hidden prefix, the learner's code, then the hidden driver. Null when the
 * question or the language does not exist.
 */
export function buildPracticeSource(
  slug: string,
  day: number,
  slot: number,
  language: CodeLanguageId,
  userCode: string,
): string | null {
  const found = findQuestion(slug, day, slot);
  if (!found?.content.challenge.languages.includes(language)) return null;
  const harness = found.question.harness[language];
  if (!harness) return null;
  return `${harness.prefix}${userCode}\n${harness.driver}`;
}
