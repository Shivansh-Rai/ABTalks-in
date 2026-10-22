"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Briefcase,
  Check,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  Sparkles,
  UserCheck,
  UserRound,
} from "lucide-react";
import { DeskShortlistButton } from "@/components/hire/desk-shortlist-button";
import { ShortlistButton } from "@/components/talent/shortlist-button";
import {
  SampleCardNotice,
  type SampleDemand,
} from "@/components/hire/sample-card-notice";
import type {
  MatchCardData,
  MatchDecision,
  MatchTriage,
} from "@/components/hire/match-card";
import { recallAiSummary } from "@/components/hire/evidence-cache";
import { isLockedPreview } from "@/features/hire/locked-preview";
import {
  orderedSkills,
  skillHighlighted,
} from "@/features/hire/skill-highlight";
import {
  LockedField,
  UpgradeNotice,
  useUpgradePrompt,
} from "@/components/hire/locked-field";
import { cn } from "@/lib/utils";
import type { JobSpec } from "@/lib/validations/hire";
import { OpenToWorkBadge } from "@/components/hire/hire-card-facts";
import {
  recruiterSummary,
  summaryInputFromMatch,
} from "@/features/hire/candidate-summary";
import {
  summaryCardFromMatch,
  summaryRequestKey,
  summarySearchFromSpec,
} from "@/features/hire/candidate-summary-ai";

/** Skill chips on a result card before the rest collapse into "+N". */
const CARD_SKILLS = 8;

/** Roughly three lines on the card, before the sentence-boundary trim below. */
const SUMMARY_PREVIEW_CHARS = 280;

/**
 * The card's share of the AI summary â€” a 3-line preview of the same prose the
 * View Details panel shows (session-cached Gemini when present, otherwise
 * `recruiterSummary`). Full text stays in the sidebar; cards never call Gemini.
 *
 * Cuts on a sentence end where there is one in range, so the preview reads as
 * a finished thought rather than a severed clause; falls back to a word
 * boundary otherwise. The CSS line-clamp behind this is a second safety net
 * for a single very long sentence, not the primary mechanism â€” clamping alone
 * would still ship the whole string to the browser and still break mid-word.
 */
export function summaryPreview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= SUMMARY_PREVIEW_CHARS) return flat;

  const window = flat.slice(0, SUMMARY_PREVIEW_CHARS);
  // A sentence end, but only if it lands in the back half â€” cutting at the
  // first full stop of a long paragraph would throw away most of the preview.
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  if (sentence > SUMMARY_PREVIEW_CHARS * 0.5) {
    return flat.slice(0, sentence + 1);
  }
  const space = window.lastIndexOf(" ");
  return `${flat.slice(0, space > 0 ? space : SUMMARY_PREVIEW_CHARS).trimEnd()}â€¦`;
}

const WORK_MODE: Record<string, string> = {
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
  FLEXIBLE: "Flexible",
};

/**
 * A stable tint index for a skill name.
 *
 * Same hash the design mockup uses, so "React" is the same hue on every card,
 * in the inspector, and between sessions â€” the colour is information about the
 * skill, not about where it happened to be rendered.
 */
function skillTint(skill: string): string {
  let hash = 0;
  for (let i = 0; i < skill.length; i += 1) {
    hash = (hash * 31 + skill.charCodeAt(i)) % 997;
  }
  return `desk-pill--c${hash % 6}`;
}

/**
 * A stand-in surname of the same length as the real one.
 *
 * Deterministic from the name itself, so a candidate's block does not change
 * shape between renders, and never derived from the real letters â€” the point is
 * that the actual surname is not written into the page at all. It is only ever
 * seen through a blur, so the letters carry no meaning; what matters is that the
 * word is the right length and has a name-like silhouette.
 */
const MASK_LETTERS = "abcdefghijklmnopqrstuvwxyz";

function decoySurname(seedText: string, length: number): string {
  let seed = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    seed = (seed * 31 + seedText.charCodeAt(i)) % 9973;
  }
  let out = "";
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 73 + 41) % 9973;
    out += MASK_LETTERS[seed % MASK_LETTERS.length];
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Given name in the clear, family name behind a blur.
 *
 * The blur is CSS, but the text under it is a decoy â€” the real surname is never
 * put in the DOM, so this is not the "blur over real text" that `LockedField`
 * warns about. Reading the page source yields nothing.
 *
 * A single-token name is left alone: there is no family name to hide, and
 * blurring the only word would leave the card anonymous.
 */
export function splitName(name: string): { given: string; masked: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { given: name.trim(), masked: null };
  const family = parts.slice(1).join(" ");
  return {
    given: parts[0]!,
    // At least four glyphs so a two-letter surname still reads as a word.
    masked: decoySurname(name, Math.max(4, Array.from(family).length)),
  };
}

/**
 * The card's name treatment, as a component so the inspector can render the
 * identical thing. Two hand-rolled copies would drift, and the surname showing
 * clear in the panel while blurred on the card is exactly the inconsistency
 * this exists to stop.
 *
 * `revealed` is true only after this recruiter has CONTACT_SHARED access.
 * Until then the family name stays a decoy behind the blur (D-1.7).
 */
export function MaskedName({
  name,
  revealed = false,
}: {
  name: string;
  revealed?: boolean;
}) {
  if (revealed) {
    return <span className="desk-name">{name}</span>;
  }
  const { given, masked } = splitName(name);
  return (
    <span className="desk-name">
      <span>{given}</span>
      {masked && (
        <span className="desk-name__gate" aria-label="Surname hidden">
          <span aria-hidden="true">{masked}</span>
        </span>
      )}
    </span>
  );
}

export function DeskMatchCard({
  match,
  rank,
  selected,
  onOpen,
  onCartToggle,
  sampleDemand,
  onDecision,
  requestId,
  searchSpec = null,
}: {
  match: MatchCardData & Partial<MatchTriage>;
  rank?: number;
  selected?: boolean;
  onOpen?: () => void;
  onCartToggle?: (inCart: boolean) => void;
  sampleDemand?: SampleDemand;
  onDecision?: (decision: MatchDecision) => void;
  requestId?: string | null;
  /** Active desk search â€” used only to key the session Gemini cache. */
  searchSpec?: JobSpec | null;
}) {
  const sample = match.candidateRef.startsWith("SAMPLE:");
  const preview = isLockedPreview(match) ? match.preview : null;
  const decision = match.decision ?? "UNDECIDED";
  const rejected = decision === "REJECTED";
  const showTriage = Boolean(requestId && match.candidateUserId && onDecision);

  function pickDecision(next: MatchDecision) {
    if (!onDecision) return;
    onDecision(decision === next ? "UNDECIDED" : next);
  }
  const { upgradeOpen, openUpgrade, dismissUpgrade } = useUpgradePrompt();
  const e = match.evidence ?? {};
  // The skills the recruiter actually asked for, hoisted to the front. The card
  // draws eight chips out of a list that is routinely fifteen or twenty long,
  // and stored order is the order the candidate typed their stack in â€” so a
  // search for "snowflake" could return a card whose chips never say Snowflake.
  // To the reader that is a wrong result, not a truncated one.
  const needles = match.highlightSkills ?? [];
  const skills = orderedSkills(e.skills ?? [], needles);

  const summaryInput = summaryInputFromMatch(match);
  // Same key the inspector uses so a Gemini summary written in View Details
  // can reappear on the card without a second model call. Hooks must run
  // before the locked/sample early returns below.
  const summaryCacheKey = useMemo(() => {
    if (sample || preview) return null;
    return summaryRequestKey({
      candidateRef: match.candidateRef,
      card: summaryCardFromMatch(match),
      search: summarySearchFromSpec(searchSpec),
    });
  }, [sample, preview, match, searchSpec]);

  const [cachedAiSummary, setCachedAiSummary] = useState<string | null>(null);
  useEffect(() => {
    if (!summaryCacheKey) {
      setCachedAiSummary(null);
      return;
    }
    setCachedAiSummary(
      recallAiSummary(match.candidateRef, summaryCacheKey),
    );
  }, [summaryCacheKey, match.candidateRef, selected]);

  const summary = summaryPreview(
    cachedAiSummary ??
      recruiterSummary(match.rationale, summaryInput),
  );

  // The card is the click target, not just the "View more details" link.
  // Everything interactive inside it â€” the two shortlist buttons, the intro
  // button, the locked-field reveals â€” must keep its own click, and a click that
  // ends a text selection is a read, not a request to open the panel.
  function openFromCard(event: MouseEvent<HTMLElement>) {
    if (!onOpen) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, label, select, textarea, [role='button']")) {
      return;
    }
    if ((window.getSelection()?.toString() ?? "").length > 0) return;
    onOpen();
  }

  if (preview) {
    const p = preview;
    return (
      <article
        className={cn("desk-card", "desk-card--locked", onOpen && "desk-card--clickable")}
        onClick={openFromCard}
      >
        {sampleDemand && <SampleCardNotice {...sampleDemand} />}
        <div className="desk-card__head" style={{ marginTop: 12 }}>
          <div className="desk-card__who">
            <span className="desk-card__avatar" aria-hidden="true">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="desk-card__role">
                <LockedField
                  value={p.displayName}
                  label="Candidate name"
                  onReveal={openUpgrade}
                />
              </h3>
              <p className="desk-card__ref">
                {match.jobRole}
                {typeof e.yearsExperience === "number" && e.yearsExperience > 0
                  ? ` Â· ${e.yearsExperience}+ yrs`
                  : ""}
              </p>
              <p className="desk-card__stack">
                <LockedField
                  value={p.locationLabel}
                  label="Location"
                  onReveal={openUpgrade}
                />
                {" Â· "}
                <LockedField
                  value={p.educationLine}
                  label="Education"
                  onReveal={openUpgrade}
                />
              </p>
            </div>
          </div>
        </div>

        {(e.skills ?? []).length > 0 && (
          <div className="desk-card__facts">
            {(e.skills ?? []).map((sk) => (
              <span key={sk} className={`desk-pill ${skillTint(sk)}`}>
                {sk}
              </span>
            ))}
          </div>
        )}

        <p className="desk-card__stack" style={{ marginTop: 10 }}>
          Expected{" "}
          <LockedField
            value={p.compensationBand}
            label="Expected compensation"
            onReveal={openUpgrade}
          />
        </p>

        {upgradeOpen && <UpgradeNotice onDismiss={dismissUpgrade} />}

        <p className="desk-card__why">
          An example of what a full profile looks like, not a person in the
          pool. Blurred fields are what Pro fills in.
        </p>

        {onOpen && (
          <div className="desk-card__cta">
            <button type="button" className="desk-ghost" onClick={onOpen}>
              View more details
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </article>
    );
  }

  if (sample) {
    return (
      <article
        className={cn("desk-card", "desk-card--sample", onOpen && "desk-card--clickable")}
        onClick={openFromCard}
      >
        {sampleDemand && <SampleCardNotice {...sampleDemand} />}
        <h3 className="desk-card__role" style={{ marginTop: 12 }}>
          {match.jobRole}
        </h3>
        {typeof e.yearsExperience === "number" && e.yearsExperience > 0 && (
          <p className="desk-card__ref">{e.yearsExperience}+ years</p>
        )}
        {skills.length > 0 && (
          <div className="desk-card__facts">
            {skills.map((s) => (
              <span key={s} className={`desk-pill ${skillTint(s)}`}>
                {s}
              </span>
            ))}
          </div>
        )}
        <p className="desk-card__why">
          This is what a match would look like. Nobody in the pool fits it yet.
        </p>
        {onOpen && (
          <div className="desk-card__cta">
            <button type="button" className="desk-ghost" onClick={onOpen}>
              View more details
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </article>
    );
  }

  // The result card (Figma 1646:209). Score and evidence pills are not on it â€”
  // the profile panel carries both; the card is who, where, which skills, and
  // Scout's reason. A missing fact drops out of the meta row rather than
  // printing a placeholder.
  const years =
    typeof e.yearsExperience === "number" && e.yearsExperience > 0
      ? `${e.yearsExperience} yr${e.yearsExperience === 1 ? "" : "s"} experience`
      : null;
  const meta = [
    { key: "location", Icon: MapPin, label: match.locationLabel },
    {
      key: "mode",
      Icon: Clock,
      label: e.workMode ? (WORK_MODE[e.workMode] ?? e.workMode) : null,
    },
    { key: "experience", Icon: Briefcase, label: years },
    { key: "education", Icon: GraduationCap, label: e.educationLevel },
  ].filter((m) => Boolean(m.label));
  const shownSkills = skills.slice(0, CARD_SKILLS);
  // The row's avatar: the candidate's initial, the same treatment as the
  // thread's avatars, instead of a stock silhouette photo.
  const initial =
    (match.displayName?.trim() || match.jobRole || "").charAt(0).toUpperCase() ||
    null;
  const name = match.displayName ? (
    <MaskedName
      name={match.displayName}
      revealed={match.engagementStatus === "CONTACT_SHARED"}
    />
  ) : (
    match.jobRole
  );
  const shortlisted = decision === "SHORTLISTED";

  // One row of the results panel (plan: results as one divided list). Same
  // content as the card it replaced: who, where, which skills, Scout's reason.
  // Clicking the row (or the name, for keyboards) opens the profile, so there
  // is no separate View More Details button.
  return (
    <article
      className={cn(
        "desk-row",
        rank === 1 && "desk-row--top",
        selected && "is-selected",
        onOpen && "is-clickable",
        rejected && "is-rejected",
      )}
      onClick={openFromCard}
    >
      <span className="desk-row__avatar" aria-hidden="true">
        {initial ?? <UserRound className="size-4" />}
      </span>

      <div className="desk-row__main">
        <header className="desk-row__head">
          <div className="desk-row__who">
            <div className="desk-row__title">
              <h3 className="desk-row__name">
                {onOpen ? (
                  <button type="button" className="desk-row__open" onClick={onOpen}>
                    {name}
                  </button>
                ) : (
                  name
                )}
              </h3>
              <OpenToWorkBadge openToWork={match.openToWork} />
              {rank === 1 && <span className="desk-row__badge">Top match</span>}
              {showTriage &&
                (match.viewedAt ? (
                  <span className="desk-badge desk-badge--viewed">Viewed</span>
                ) : match.isNew ? (
                  <span className="desk-badge desk-badge--new">New</span>
                ) : null)}
            </div>
            {meta.length > 0 && (
              <ul className="desk-row__meta">
                {meta.map(({ key, Icon, label }) => (
                  <li key={key}>
                    <Icon
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="desk-row__actions" onClick={(ev) => ev.stopPropagation()}>
            {/* Save for later keeps its own name (as the icon's label): two
                controls both called "Shortlist", writing to different stores,
                is what TC-R-004 caught. */}
            <DeskShortlistButton
              icon
              candidateRef={match.candidateRef}
              jobRole={match.jobRole}
              match={match}
            />
            {showTriage && (
              <button
                type="button"
                className="desk-row__btn desk-row__btn--quiet"
                onClick={() => pickDecision("REJECTED")}
              >
                {rejected ? "Undo" : "Reject"}
              </button>
            )}
            {showTriage ? (
              // PROJECT CONTEXT (T-149). Writes TalentRequestMatch.decision via
              // setMatchDecisionAction, keyed on requestId + candidateUserId, so
              // it works for every track. `decision` is read back from the
              // persisted row and survives reload. The legacy cart button is
              // deliberately not rendered here: it would be a second,
              // differently-persisted shortlist on the same row.
              <button
                type="button"
                aria-pressed={shortlisted}
                aria-label={shortlisted ? "In shortlist" : "Add to shortlist"}
                title={shortlisted ? "In shortlist" : "Add to shortlist"}
                onClick={() => pickDecision("SHORTLISTED")}
                className={cn(
                  "desk-row__btn desk-row__btn--primary",
                  shortlisted && "is-on",
                )}
              >
                {shortlisted ? (
                  <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <UserCheck
                    size={14}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}
                {shortlisted ? "Shortlisted" : "Shortlist"}
              </button>
            ) : (
              // No project = no TalentRequestMatch row to decide on, so the desk
              // keeps its existing device/cart behaviour untouched.
              <ShortlistButton
                candidateRef={match.candidateRef}
                programMemberId={match.programMemberId}
                initialShortlisted={match.shortlisted ?? false}
                jobRole={match.jobRole}
                totalScore={match.score}
                displayName={match.displayName}
                skills={e.skills ?? []}
                snapshot={match}
                onToggle={onCartToggle}
                className={cn(
                  "desk-row__btn desk-row__btn--primary",
                  match.shortlisted && "is-on",
                )}
                podLabel
              />
            )}
            {/* "Request an intro" stays off the desk row on purpose: the
                recruiter reads the profile before asking for an introduction.
                `RequestIntroButton` still renders in `MatchCard`. */}
          </div>
        </header>

        {skills.length > 0 && (
          <ul className="desk-row__skills" aria-label="Skills">
            {shownSkills.map((s) => {
              const hit = skillHighlighted(s, needles);
              return (
                <li key={s} className={cn("desk-row__chip", hit && "is-hit")}>
                  {hit && <Check className="size-3" strokeWidth={1.75} aria-hidden="true" />}
                  {s}
                </li>
              );
            })}
            {skills.length > shownSkills.length && (
              <li className="desk-row__chip desk-row__chip--more">
                +{skills.length - shownSkills.length}
              </li>
            )}
          </ul>
        )}

        <p className="desk-row__summary">
          {/* The sparkle alone marks the AI summary; the words repeated on
              every row were noise. Screen readers still hear the label. */}
          <span className="desk-row__summary-label" title="AI summary">
            {/* A line icon rather than ai-summary-sparkle.svg: that file is
                drawn at a 2px stroke on a 15px box and read as bold here. */}
            <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">AI summary:</span>
          </span>
          {summary}
        </p>
      </div>
    </article>
  );
}
