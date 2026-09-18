/**
 * Recruiter-search bugs that are confirmed, reported, and not yet fixed.
 *
 * A strict "expected failure" list. A golden test tied to an issue here runs
 * every time; when it fails it is reported as XFAIL (known, still NOT READY);
 * when it unexpectedly PASSES the suite fails with "known issue fixed — remove
 * it from known-issues.ts". So a fix cannot land silently, and a pinned issue
 * can never quietly become a permanent excuse.
 *
 * Removing an entry is the last step of fixing the bug, never the first.
 *
 * PURE.
 */
import type { QaCategory, Severity } from "@/features/search-qa/types";

export type KnownIssue = {
  id: string;
  category: QaCategory;
  severity: Severity;
  title: string;
  /** Where the defect lives, as `path:line` at the time it was pinned. */
  location: string;
  evidence: string;
  proposedFix: string;
};

/**
 * Fixed on 2026-09-16 and therefore removed from this registry (their tests are
 * now ordinary assertions): QA-KI-001 work-mode label/enum, QA-KI-002 zero-budget
 * sentinel, QA-KI-003 "Any" city sentinel, QA-KI-005 NULLS-FIRST education pick.
 * Fixed 2026-09-17: QA-KI-004 compound / catalog skill names split apart,
 * QA-KI-009 catalog skill aliases and city renames ignored by matching,
 * QA-KI-006 rank window cut before the must-have gate, QA-KI-008 evidence-free
 * candidates listed above evidence-backed ones, QA-KI-010 "c++" never parsed,
 * QA-KI-007 saved PROFILE matches rendered as CLAUDE refs, QA-KI-011 admin
 * discoverability panel reporting tracks the loaders do not load.
 *
 * The registry is empty on purpose, not by accident: every confirmed issue is
 * fixed and asserted by an ordinary test. Pin the next one here.
 */
/** Registry ids keep one shape so a typo in a pin still reads as an id. */
export type KnownIssueId = `QA-KI-${string}`;

export const KNOWN_ISSUES: Readonly<Partial<Record<KnownIssueId, KnownIssue>>> = {};

export function knownIssue(id: KnownIssueId): KnownIssue | null {
  return KNOWN_ISSUES[id] ?? null;
}

/** Open issues, in id order, for reports and the admin page. */
export function openKnownIssues(): KnownIssue[] {
  return Object.values(KNOWN_ISSUES)
    .filter((k): k is KnownIssue => Boolean(k))
    .sort((a, b) => a.id.localeCompare(b.id));
}
