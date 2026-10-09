/**
 * Runs every coding practice question's stored reference solution against all
 * of its tests (hidden ones included) on the real executor, and fails if any
 * is not accepted. Run it after changing a question, a test or a harness,
 * before the content ships.
 *
 *   npm run coding-practice:verify
 *
 * Needs JUDGE0_URL in .env.local. Requests are paced because the executor is a
 * free shared service; a full run takes a few minutes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { judge } from "../src/features/code-runner/judge0";
import { PRACTICE_PROGRAM_SLUGS } from "../src/features/coding-practice/constants";
import {
  buildPracticeSource,
  getPracticeDayIndex,
  getPracticeSolution,
  getPracticeTests,
} from "../src/features/coding-practice/content";

const GAP_MS = 2_000;
const RETRY_AFTER_MS = 35_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  if (!process.env.JUDGE0_URL) {
    throw new Error("JUDGE0_URL is not set. Add it to .env.local.");
  }
  let failures = 0;
  for (const slug of PRACTICE_PROGRAM_SLUGS) {
    for (const day of getPracticeDayIndex(slug)) {
      for (const question of day.questions) {
        const label = `${slug} day ${String(day.day).padStart(2, "0")} q${question.slot}  ${question.title}`;
        const solution = getPracticeSolution(slug, day.day, question.slot);
        const run = getPracticeTests(slug, day.day, question.slot);
        const source = solution
          ? buildPracticeSource(slug, day.day, question.slot, solution.language, solution.code)
          : null;
        if (!solution || !run || !source) {
          failures++;
          console.log(`✗ ${label}: no stored solution`);
          continue;
        }

        let result = await judge({
          language: solution.language,
          code: source,
          tests: run.tests,
          timeLimitSec: run.timeLimitSec,
        });
        if (result.verdict === "unavailable") {
          await sleep(RETRY_AFTER_MS);
          result = await judge({
            language: solution.language,
            code: source,
            tests: run.tests,
            timeLimitSec: run.timeLimitSec,
          });
        }

        if (result.verdict === "accepted") {
          console.log(`✓ ${label}`);
        } else {
          failures++;
          console.log(
            `✗ ${label}: ${result.verdict} (${result.passedCount}/${result.total})`,
          );
        }
        await sleep(GAP_MS);
      }
    }
  }
  console.log(failures === 0 ? "\nAll solutions accepted." : `\n${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
