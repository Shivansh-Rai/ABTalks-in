import type { Domain } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ValidateGithubResult } from "@/features/submission/validate-github-url";
import {
  normalizeGithubUrl,
  validateGithubUrl,
} from "@/features/submission/validate-github-url";

const GITHUB_COMMIT =
  /^https:\/\/github\.com\/[^/]+\/[^/]+\/commit\/[a-f0-9]{7,40}(\/.*)?$/i;

const GITHUB_REPO =
  /^https:\/\/github\.com\/[^/]+\/[^/]+(\/.*)?$/i;

export function getGithubUrlType(url: string): "commit" | "repo" | null {
  const trimmed = url.trim();
  if (GITHUB_COMMIT.test(trimmed)) return "commit";
  if (GITHUB_REPO.test(trimmed)) return "repo";
  return null;
}

/**
 * GitHub repo URLs for SE/DS/AI (unchanged). GitHub commit or repo URLs for CLAUDE.
 */
export async function validateSubmissionUrl(
  url: string,
  domain: Domain,
  currentUserId: string,
  allowSlot?: { enrollmentId: string; dayNumber: number },
): Promise<ValidateGithubResult> {
  if (domain === "CLAUDE") {
    return validateClaudeGithubUrl(url, currentUserId, allowSlot);
  }
  return validateGithubUrl(url, currentUserId, allowSlot);
}

async function validateClaudeGithubUrl(
  url: string,
  _currentUserId: string,
  allowSlot?: { enrollmentId: string; dayNumber: number },
): Promise<ValidateGithubResult> {
  const trimmed = url.trim();
  const urlType = getGithubUrlType(trimmed);

  if (!urlType) {
    return {
      ok: false,
      reason: "invalid_format",
      message:
        "Submit a GitHub URL — either a specific commit (https://github.com/user/repo/commit/abc123) or your repo URL (https://github.com/user/repo).",
    };
  }

  if (allowSlot && urlType === "commit") {
    const duplicate = await checkClaudeCommitDuplicate(
      trimmed,
      allowSlot.enrollmentId,
      allowSlot.dayNumber,
    );
    if (!duplicate.ok) {
      return duplicate;
    }
  }

  return { ok: true };
}

export async function checkClaudeCommitDuplicate(
  url: string,
  enrollmentId: string,
  dayNumber: number,
): Promise<ValidateGithubResult> {
  const normalized = normalizeGithubUrl(url.trim());

  const existing = await prisma.submission.findFirst({
    where: {
      enrollmentId,
      githubUrl: normalized,
      dayNumber: { not: dayNumber },
    },
    select: { dayNumber: true },
  });

  if (existing) {
    return {
      ok: false,
      reason: "duplicate",
      message: `This commit URL was already submitted for Day ${existing.dayNumber}. Push a new commit for this day.`,
    };
  }

  return { ok: true };
}
