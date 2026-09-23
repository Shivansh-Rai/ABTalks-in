/**
 * Import FIRST in every search-QA script, before anything that reaches Prisma.
 *
 * `@/lib/db` constructs its PrismaClient at import time from DATABASE_URL, so
 * the environment has to be settled before that module loads. This does three
 * things, in order:
 *
 *  1. Loads `.env.local` then `.env` (the existing script convention).
 *  2. Points DATABASE_URL and DIRECT_URL at the non-pooled host with the Postgres
 *     session option `default_transaction_read_only=on`. Every statement the
 *     audit — or the real search code it exercises — sends is then refused by the
 *     database if it tries to write. Neon's transaction pooler does not accept
 *     startup options, hence the direct host.
 *  3. Applies `--profile=production`: the recruiter pool depends on hire flags
 *     (`HIRE_CHALLENGE_POOL`, `HIRE_OPEN_COHORT_IDS`). `ENABLE_NEW_TALENT` is
 *     kept only as a search-QA *report label* (`newTalentRead: true`); it is
 *     not a runtime switch. A developer's `.env.local` usually has none of the
 *     hire flags. Values already set in the environment always win; the profile
 *     only fills gaps, and the report prints which values were assumed.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

export const assumedFlags: string[] = [];

const profile = process.argv.find((a) => a.startsWith("--profile="))?.split("=")[1];
if (profile === "production") {
  // Hire-pool production defaults. ENABLE_NEW_TALENT is a report label only
  // (canonical CandidateProfile reads are unconditional). The open cohort list
  // in production is not recorded anywhere in the repo; "all" is the widest
  // reading and is reported as an assumption.
  const defaults: Record<string, string> = {
    ENABLE_NEW_TALENT: "true",
    HIRE_CHALLENGE_POOL: "10",
    HIRE_OPEN_COHORT_IDS: "all",
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!process.env[k]) {
      process.env[k] = v;
      assumedFlags.push(`${k}=${v}`);
    }
  }
}

const source =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.replace("-pooler.", ".");
if (!source) {
  throw new Error("search-qa: DATABASE_URL / DIRECT_URL is not set.");
}
const url = new URL(source);
url.searchParams.set("options", "-c default_transaction_read_only=on");
process.env.DATABASE_URL = url.toString();
process.env.DIRECT_URL = url.toString();

export const databaseHost = url.hostname.replace(/^([^.]{4})[^.]*/, "$1…");
