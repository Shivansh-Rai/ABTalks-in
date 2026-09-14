import { CandidateLinkType } from "@prisma/client";
import { LINK_TYPE_LABELS } from "@/lib/candidate-vocab";

/**
 * Declared coding-profile links a recruiter may see on View Detail (T-216).
 * Always labelled SELF-REPORTED in the UI — never verified, never synced.
 */
export type SelfReportedExternalLink = {
  provider: "GITHUB" | "LEETCODE" | "CODECHEF";
  label: string;
  url: string;
};

const CODING_EXTRA_TYPES = new Set<CandidateLinkType>([
  CandidateLinkType.LEETCODE,
  CandidateLinkType.CODECHEF,
]);

/**
 * Shape recruiter-safe declared links from already-selected profile fields.
 * Callers must not pass email, phone, linkedinUrl, or resumeUrl.
 */
export function shapeSelfReportedExternalLinks(input: {
  githubUsername: string | null | undefined;
  /** Platform policy: whether declared GitHub profiles are shown to recruiters. */
  githubAllowedByPolicy: boolean;
  links: Array<{ type: CandidateLinkType; url: string; label: string | null }>;
}): SelfReportedExternalLink[] {
  const out: SelfReportedExternalLink[] = [];

  const username = input.githubUsername?.trim();
  if (input.githubAllowedByPolicy && username) {
    out.push({
      provider: "GITHUB",
      label: LINK_TYPE_LABELS.GITHUB ?? "GitHub",
      url: `https://github.com/${username}`,
    });
  }

  for (const row of input.links) {
    if (!CODING_EXTRA_TYPES.has(row.type)) continue;
    const url = row.url.trim();
    if (!url) continue;
    const provider = row.type as "LEETCODE" | "CODECHEF";
    out.push({
      provider,
      label: LINK_TYPE_LABELS[provider] ?? provider,
      url,
    });
  }

  return out;
}
