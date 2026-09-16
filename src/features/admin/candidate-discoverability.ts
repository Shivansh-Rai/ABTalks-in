import { formatDateTimeIST } from "@/lib/date-utils";

/**
 * Why a candidate does or does not appear in recruiter search.
 *
 * Pure: facts in, checks out. No Prisma, no `server-only` — the loader is
 * `get-candidate-discoverability.ts` and the tests drive this function directly.
 *
 * Every condition below is a clause that really runs in production:
 *
 *  - `searchableUserWhere()` (`src/repositories/talent.ts`) — the one discovery
 *    gate every recruiter surface applies: `deletedAt: null`, `disabledAt: null`,
 *    and a `CandidateVisibility` row with `searchableByRecruiters: true` and
 *    `withdrawnAt: null`. A missing row fails the gate, because the clause is a
 *    relation filter (`visibility: { is: … }`) and there is nothing to join to.
 *  - the profile pool — `listProfileCandidates` / `resolveProfileRefs`
 *    (`src/repositories/hire.ts`): the gate, plus a non-empty `fullName`, plus at
 *    least one `CandidateSkill` with `claimedByCandidate: true`, newest-first by
 *    sign-up date and capped.
 *  - the track pools: a challenge enrolment with at least one submission, a
 *    `ProgramMember` row, or hackathon participation on a team that submitted.
 *
 * There is no candidate-facing switch anywhere in that list. `CandidateVisibility`
 * is an admin moderation record and its own schema comment says so — "not a
 * candidate preference", "not a user-facing opt-in". The per-field `show*`
 * columns were replaced by one platform-wide `RECRUITER_FIELD_POLICY` (plan 133),
 * and `src/features/hire/visibility.test.ts` asserts no candidate surface can ask
 * for or accept a choice about any of this. So a blocker reported here is always
 * something the platform or an admin did, never something the candidate chose,
 * and this panel must never phrase one as a candidate decision.
 */

export type CheckStatus = "OK" | "BLOCKING" | "LIMITING" | "INFO";

export type CheckGroup =
  | "deletion"
  | "account"
  | "moderation"
  | "index"
  | "profile"
  | "skills";

/** Rendered in this order, which is also blocker priority: hardest gate first. */
export const GROUP_ORDER: readonly CheckGroup[] = [
  "deletion",
  "account",
  "moderation",
  "index",
  "profile",
  "skills",
] as const;

export const GROUP_LABEL: Record<CheckGroup, string> = {
  deletion: "Deletion state",
  account: "Account state",
  moderation: "Moderation",
  index: "Search-index state",
  profile: "Profile usability",
  skills: "Skills",
};

export type DiscoverabilityCheck = {
  id: string;
  group: CheckGroup;
  label: string;
  status: CheckStatus;
  /** The actual state, in plain words, with the consequence spelled out. */
  detail: string;
  /** Short phrase naming the blocker for the verdict line. Blocking rows only. */
  summary: string | null;
  /** What an admin can do about it. Null when there is nothing to do. */
  action: string | null;
};

export type DiscoverabilityFacts = {
  deletedAt: Date | null;
  anonymizedAt: Date | null;
  disabledAt: Date | null;
  disabledReason: string | null;
  sessionInvalidatedAt: Date | null;
  /** The discovery record the search gate joins to. */
  gate: {
    exists: boolean;
    searchableByRecruiters: boolean;
    withdrawnAt: Date | null;
  };
  /** Live probe: the platform's own gate clause run against this one user. */
  passesSearchGate: boolean;
  profile: {
    exists: boolean;
    fullName: string;
    headline: string | null;
    locationCity: string | null;
    countryCode: string | null;
    educationCount: number;
    experienceCount: number;
    hasNoWorkExperience: boolean;
  };
  skills: { claimed: number; withEvidence: number };
  /** Live probe: `resolveProfileRefs` returned this user (gate + name + skill). */
  inProfilePool: boolean;
  /** Usable profiles that signed up later; the pool loads the newest `profilePoolCap`. */
  profilePoolAhead: number;
  profilePoolCap: number;
  tracks: {
    challengeWithSubmissions: number;
    programMemberships: number;
    hackathonWithSubmission: number;
  };
};

export type CandidateDiscoverability = {
  /** Whether any recruiter surface can return this candidate today. */
  appears: boolean;
  /** One line naming the real blocker, or confirming the candidate is reachable. */
  verdict: string;
  /** The blocking check the verdict names. Null when the candidate appears. */
  blocker: DiscoverabilityCheck | null;
  checks: DiscoverabilityCheck[];
  /** Conditions that do not block but cut down where the candidate turns up. */
  limitCount: number;
};

function when(date: Date): string {
  return formatDateTimeIST(date);
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * A profile-level gap stops the candidate dead only when no track record carries
 * them. Someone with challenge submissions and no profile row still reaches
 * recruiters through the challenge pool, and saying otherwise would be a lie.
 */
function trackCarry(tracks: string[]): string {
  if (tracks.length === 0) return "";
  return ` They still reach recruiters through ${listOf(tracks)}, so this narrows where they turn up rather than removing them.`;
}

function listOf(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function evaluateDiscoverability(
  f: DiscoverabilityFacts,
): CandidateDiscoverability {
  const checks: DiscoverabilityCheck[] = [];
  const push = (c: DiscoverabilityCheck) => checks.push(c);

  const trackPools: string[] = [];
  if (f.tracks.challengeWithSubmissions > 0) trackPools.push("the 60-day challenge pool");
  if (f.tracks.programMemberships > 0) trackPools.push("the AI cohort pool");
  if (f.tracks.hackathonWithSubmission > 0) trackPools.push("the hackathon pool");
  const inTrackPool = trackPools.length > 0;
  const carry = trackCarry(trackPools);
  /** Profile-level gaps degrade to LIMITING when a track record carries them. */
  const profileGap: CheckStatus = inTrackPool ? "LIMITING" : "BLOCKING";

  /* ── Deletion state ──────────────────────────────────────────────────── */

  if (f.deletedAt) {
    push({
      id: "account-deleted",
      group: "deletion",
      label: "Account deleted",
      status: "BLOCKING",
      detail: `The account was deleted on ${when(f.deletedAt)}. Every recruiter query starts by excluding deleted accounts, so nothing about this candidate is read after that.`,
      summary: "the account was deleted",
      action:
        "Deletion is a one-way door here — there is no restore that puts this candidate back into recruiter search.",
    });
  } else {
    push({
      id: "account-deleted",
      group: "deletion",
      label: "Account deleted",
      status: "OK",
      detail: "The account is not deleted.",
      summary: null,
      action: null,
    });
  }

  push(
    f.anonymizedAt
      ? {
          id: "account-anonymized",
          group: "deletion",
          label: "Personal details erased",
          status: "INFO",
          detail: `Personal details were erased on ${when(f.anonymizedAt)}. Name, phone, links and résumé no longer hold real data, so anything below that looks empty is the erasure, not a candidate who never filled it in.`,
          summary: null,
          action: null,
        }
      : {
          id: "account-anonymized",
          group: "deletion",
          label: "Personal details erased",
          status: "OK",
          detail: "Personal details are intact — nothing has been erased.",
          summary: null,
          action: null,
        },
  );

  /* ── Account state ───────────────────────────────────────────────────── */

  if (f.disabledAt) {
    const reason = f.disabledReason?.trim();
    push({
      id: "account-suspended",
      group: "account",
      label: "Account suspended",
      status: "BLOCKING",
      detail: `The account was suspended on ${when(f.disabledAt)}${reason ? ` — reason on file: ${reason}` : " with no reason on file"}. The search gate drops suspended accounts from every recruiter surface.`,
      summary: "the account is suspended",
      action: "Restore the account from Account ops at the top of this page.",
    });
  } else {
    push({
      id: "account-suspended",
      group: "account",
      label: "Account suspended",
      status: "OK",
      detail: "The account is active.",
      summary: null,
      action: null,
    });
  }

  if (f.sessionInvalidatedAt) {
    push({
      id: "sessions-invalidated",
      group: "account",
      label: "Sessions invalidated",
      status: "INFO",
      detail: `Sessions were force-invalidated on ${when(f.sessionInvalidatedAt)}. That signs the candidate out of the site and has no effect on recruiter search — do not read it as a blocker.`,
      summary: null,
      action: null,
    });
  }

  /* ── Moderation ──────────────────────────────────────────────────────── */

  if (!f.gate.exists) {
    push({
      id: "moderation-stop",
      group: "moderation",
      label: "Moderation stop",
      status: "INFO",
      detail:
        "Cannot be read: this candidate has no recruiter-discovery record for a moderation stop to sit on. See Search-index state below.",
      summary: null,
      action: null,
    });
  } else if (!f.gate.searchableByRecruiters) {
    push({
      id: "moderation-stop",
      group: "moderation",
      label: "Moderation stop",
      status: "BLOCKING",
      detail:
        "An admin moderation action switched recruiter search off for this candidate. The gate checks that switch on every recruiter query, so the candidate is filtered out platform-wide.",
      summary: "an admin moderation stop is in force",
      action:
        "Only platform/admin code can clear it — deleting an account sets it, and nothing on the candidate's side can set or unset it.",
    });
  } else {
    push({
      id: "moderation-stop",
      group: "moderation",
      label: "Moderation stop",
      status: "OK",
      detail: "No moderation stop is in force on this account.",
      summary: null,
      action: null,
    });
  }

  if (f.gate.withdrawnAt) {
    push({
      id: "moderation-durable-stop",
      group: "moderation",
      label: "Durable moderation stop",
      status: "BLOCKING",
      detail: `A durable moderation stop was recorded on ${when(f.gate.withdrawnAt)}. Enrolling the candidate in another track cannot undo it: both enrolment paths return early when this stop is set, and the gate requires it to be clear.`,
      summary: "a durable moderation stop is in force",
      action:
        "Set by account deletion. Clearing it is an admin database change, not an action on this page.",
    });
  }

  /* ── Search-index state ──────────────────────────────────────────────── */

  if (!f.gate.exists) {
    push({
      id: "discovery-record",
      group: "index",
      label: "Recruiter-discovery record",
      status: "BLOCKING",
      detail:
        "This candidate has no recruiter-discovery record. The search gate joins to that record, so a candidate without one is filtered out of every recruiter query before their profile is ever read — however complete that profile is.",
      summary: "the candidate has no recruiter-discovery record",
      action:
        "The record is written automatically the next time the candidate is enrolled in a challenge or a cohort. Accounts that predate that path were given one by the 078 Phase 2b backfill; an account created outside both still has none.",
    });
  } else {
    push({
      id: "discovery-record",
      group: "index",
      label: "Recruiter-discovery record",
      status: "OK",
      detail:
        "A recruiter-discovery record exists, so the search gate has something to join to.",
      summary: null,
      action: null,
    });
  }

  const profileUsable =
    f.profile.exists && f.profile.fullName.trim().length > 0 && f.skills.claimed > 0;
  const cappedOut = profileUsable && f.profilePoolAhead >= f.profilePoolCap;

  if (profileUsable) {
    push(
      cappedOut
        ? {
            id: "profile-pool-cap",
            group: "index",
            label: "Profile pool cap",
            status: inTrackPool ? "LIMITING" : "BLOCKING",
            detail: `${f.profilePoolAhead} candidates with a usable profile signed up after this one. The profile pool loads only the newest ${f.profilePoolCap} by sign-up date, so this candidate is trimmed off before ranking and a search never reaches them.${carry}`,
            summary: "newer candidates fill the profile pool ahead of this one",
            action:
              "A platform limit, not a candidate problem — raising the pool cap is the only fix.",
          }
        : {
            id: "profile-pool-cap",
            group: "index",
            label: "Profile pool cap",
            status: "OK",
            detail: `${f.profilePoolAhead} newer ${plural(f.profilePoolAhead, "candidate sits", "candidates sit")} ahead of this one and the pool loads the newest ${f.profilePoolCap}, so this candidate is inside the cap.`,
            summary: null,
            action: null,
          },
    );
  }

  push({
    id: "track-pools",
    group: "index",
    label: "Track pools",
    status: "INFO",
    detail: inTrackPool
      ? `In ${listOf(trackPools)}, so a recruiter searching those tracks can reach this candidate even when the profile is thin.`
      : "In no track pool: no challenge submissions, no cohort membership, no hackathon submission. The profile pool is the only route to this candidate.",
    summary: null,
    action: null,
  });

  /* ── Profile usability ───────────────────────────────────────────────── */

  if (!f.profile.exists) {
    push({
      id: "profile-record",
      group: "profile",
      label: "Profile record",
      status: profileGap,
      detail: `No candidate profile has ever been created for this account, so the profile pool — which reads profile rows — has nothing to return.${carry}`,
      summary: "there is no candidate profile",
      action: "The candidate creates one by filling in their profile.",
    });
  } else {
    push({
      id: "profile-record",
      group: "profile",
      label: "Profile record",
      status: "OK",
      detail: "A candidate profile exists.",
      summary: null,
      action: null,
    });

    const named = f.profile.fullName.trim().length > 0;
    push(
      named
        ? {
            id: "profile-name",
            group: "profile",
            label: "Name",
            status: "OK",
            detail: `Name on file: ${f.profile.fullName.trim()}.`,
            summary: null,
            action: null,
          }
        : {
            id: "profile-name",
            group: "profile",
            label: "Name",
            status: profileGap,
            detail: `The profile has no name. The profile pool requires a non-empty name, so this candidate is excluded from it.${carry}`,
            summary: "the profile has no name",
            action: "The candidate adds their name in Basic information.",
          },
    );

    push(
      f.profile.headline?.trim()
        ? {
            id: "profile-headline",
            group: "profile",
            label: "Headline",
            status: "OK",
            detail: `Headline set, so keyword search has something to match: ${f.profile.headline.trim()}.`,
            summary: null,
            action: null,
          }
        : {
            id: "profile-headline",
            group: "profile",
            label: "Headline",
            status: "LIMITING",
            detail:
              "No headline. Keyword search matches on name and headline only, so a recruiter typing a role rather than a name will not find this candidate.",
            summary: null,
            action: "The candidate adds a headline in Basic information.",
          },
    );

    const place = [f.profile.locationCity, f.profile.countryCode]
      .map((v) => v?.trim())
      .filter((v): v is string => Boolean(v));
    push(
      place.length > 0
        ? {
            id: "profile-location",
            group: "profile",
            label: "Location",
            status: "OK",
            detail: `Location on file: ${place.join(", ")}.`,
            summary: null,
            action: null,
          }
        : {
            id: "profile-location",
            group: "profile",
            label: "Location",
            status: "LIMITING",
            detail:
              "No city and no country on the profile, so every location-filtered search drops this candidate.",
            summary: null,
            action: "The candidate adds a location in Basic information.",
          },
    );

    push(
      f.profile.educationCount > 0
        ? {
            id: "profile-education",
            group: "profile",
            label: "Education",
            status: "OK",
            detail: `${f.profile.educationCount} education ${plural(f.profile.educationCount, "entry", "entries")} on file, so graduation-year filters can match.`,
            summary: null,
            action: null,
          }
        : {
            id: "profile-education",
            group: "profile",
            label: "Education",
            status: "LIMITING",
            detail:
              "No education entries, so any graduation-year filter drops this candidate.",
            summary: null,
            action: "The candidate adds education.",
          },
    );

    const experienceAnswered =
      f.profile.experienceCount > 0 || f.profile.hasNoWorkExperience;
    push(
      experienceAnswered
        ? {
            id: "profile-experience",
            group: "profile",
            label: "Experience",
            status: "OK",
            detail:
              f.profile.experienceCount > 0
                ? `${f.profile.experienceCount} experience ${plural(f.profile.experienceCount, "entry", "entries")} on file, so minimum-experience filters can match.`
                : "Marked as having no work experience yet, which is an answer rather than a gap.",
            summary: null,
            action: null,
          }
        : {
            id: "profile-experience",
            group: "profile",
            label: "Experience",
            status: "LIMITING",
            detail:
              "No experience entries, and the profile is not marked as having none yet, so any minimum-experience filter drops this candidate.",
            summary: null,
            action:
              "The candidate adds a role, or marks that they have no work experience yet.",
          },
    );
  }

  /* ── Skills ──────────────────────────────────────────────────────────── */

  if (f.skills.claimed === 0) {
    push({
      id: "skills-claimed",
      group: "skills",
      label: "Skills on the profile",
      status: profileGap,
      detail: `No skills on the profile. The profile pool requires at least one skill the candidate has added, so this candidate is excluded from it.${carry}`,
      summary: "the profile has no skills",
      action: "The candidate adds skills in the Skills section of their profile.",
    });
  } else {
    push({
      id: "skills-claimed",
      group: "skills",
      label: "Skills on the profile",
      status: "OK",
      detail: `${f.skills.claimed} ${plural(f.skills.claimed, "skill", "skills")} on the profile, which is what the profile pool requires.`,
      summary: null,
      action: null,
    });

    push(
      f.skills.withEvidence > 0
        ? {
            id: "skills-evidence",
            group: "skills",
            label: "Skill evidence",
            status: "OK",
            detail: `${f.skills.withEvidence} of ${f.skills.claimed} ${plural(f.skills.claimed, "skill carries", "skills carry")} evidence, so an evidence-floor filter can still match this candidate.`,
            summary: null,
            action: null,
          }
        : {
            id: "skills-evidence",
            group: "skills",
            label: "Skill evidence",
            status: "LIMITING",
            detail:
              "None of these skills carry evidence, so every evidence score is zero and a search with a minimum-evidence floor returns nobody. Nothing on the platform writes skill evidence today, so this is true for nearly every candidate — it is a platform gap, not a candidate one.",
            summary: null,
            action:
              "Nothing to do on this page: evidence writing is unimplemented (P0-0).",
          },
    );
  }

  /* ── Verdict ─────────────────────────────────────────────────────────── */

  const appears =
    f.passesSearchGate && ((f.inProfilePool && !cappedOut) || inTrackPool);

  let blocker = appears ? null : (checks.find((c) => c.status === "BLOCKING") ?? null);

  if (!appears && !blocker) {
    // The listed conditions are the whole gate, so this should be unreachable.
    // If it fires, the panel is wrong about the platform rather than the
    // platform being mysterious, and it says so instead of inventing a cause.
    blocker = {
      id: "unexplained",
      group: "index",
      label: "Unexplained",
      status: "BLOCKING",
      detail:
        "The platform's own search gate was run against this candidate and did not return them, but none of the conditions above explains it. Treat this as a bug in this panel, not as a fact about the candidate.",
      summary: "the live search gate rejects this candidate and no listed condition explains it",
      action: "Report it — the checks above have drifted from the live query.",
    };
    push(blocker);
  }

  const limitCount = checks.filter((c) => c.status === "LIMITING").length;

  const verdict = appears
    ? limitCount === 0
      ? "Appears in recruiter search."
      : `Appears in recruiter search, with ${limitCount} ${plural(limitCount, "condition", "conditions")} narrowing where they turn up.`
    : `Does not appear in recruiter search — ${blocker?.summary ?? "no cause identified"}.`;

  return { appears, verdict, blocker, checks, limitCount };
}
