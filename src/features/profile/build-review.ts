import {
  GRADE_TYPE_LABELS,
  LINK_TYPE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
} from "@/lib/candidate-vocab";
import type { CandidateDetail } from "@/repositories/candidate-detail";
import type { ResumeView } from "@/features/resume/types";

/**
 * The report card: the profile as a recruiter sees it.
 *
 * Built entirely on the server from the same `CandidateDetail` the wizard
 * edits, and handed to the client as plain data — no functions, no icons, no
 * class instances cross the boundary. Every card carries the index of the
 * wizard step that edits it, which is what its Add / Edit button opens.
 *
 * Nothing here invents a field. A card that has no data in the database is
 * rendered empty and listed under "Still missing"; it is never filled with a
 * placeholder that reads like a saved value.
 */

export type ReviewIconKey =
  | "basic"
  | "experience"
  | "education"
  | "projects"
  | "summary"
  | "skills"
  | "certifications"
  | "resume"
  | "links"
  | "career";

export type ReviewLink = { label: string; url: string };

export type ReviewItem = {
  title: string;
  sub: string | null;
  meta: string | null;
  body: string | null;
  chips: string[];
  links: ReviewLink[];
};

export type ReviewPair = {
  label: string;
  value: string;
  /** When set the value renders as a link. */
  url: string | null;
};

export type ReviewBlock =
  | { kind: "sub"; text: string }
  | { kind: "text"; text: string }
  | { kind: "chips"; items: string[] }
  | { kind: "items"; items: ReviewItem[] }
  | { kind: "pairs"; pairs: ReviewPair[] }
  | { kind: "file"; name: string; meta: string };

export type ReviewCard = {
  /** Index into the wizard steps — what Add / Edit opens. */
  stepIndex: number;
  title: string;
  icon: ReviewIconKey;
  emptyHint: string;
  /**
   * One-line summary for the mobile overview row. Empty cards reuse
   * `emptyHint`. Desktop keeps rendering full `blocks`.
   */
  preview: string;
  /** Rendered as a pill when greater than 1. */
  count: number;
  filled: boolean;
  /** Kept out of the "still missing" strip even when empty. */
  noGap: boolean;
  blocks: ReviewBlock[];
};

export type ProfileReview = {
  name: string;
  headline: string | null;
  /** City / region — secondary on mobile. */
  location: string | null;
  /** Phone — secondary on mobile. */
  phone: string | null;
  /** Persona badge (always shown with Open to work). */
  persona: string;
  /** "Updated …" — secondary on mobile. */
  updatedLabel: string | null;
  openToWork: boolean;
  score: number;
  cards: ReviewCard[];
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthYear(month: number | null, year: number | null): string {
  if (!year) return "";
  const name = month && month >= 1 && month <= 12 ? MONTH_SHORT[month - 1] : "";
  return name ? `${name} '${String(year).slice(-2)}` : String(year);
}

function span(
  fromMonth: number | null,
  fromYear: number | null,
  toMonth: number | null,
  toYear: number | null,
  isCurrent: boolean,
): string {
  const from = monthYear(fromMonth, fromYear);
  const to = isCurrent ? "Present" : monthYear(toMonth, toYear);
  if (!from && !to) return "";
  return from && to ? `${from} to ${to}` : from || to;
}

function join(parts: (string | null | undefined)[], sep = " · "): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Relative time, formatted on the server so the client never recomputes it. */
function lastUpdated(updatedAt: Date): string {
  const diffMs = updatedAt.getTime() - Date.now();
  const absSec = Math.round(Math.abs(diffMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absSec < 60) return `Updated ${rtf.format(Math.round(diffMs / 1000), "second")}`;
  if (absSec < 3600)
    return `Updated ${rtf.format(Math.round(diffMs / 60_000), "minute")}`;
  if (absSec < 86_400)
    return `Updated ${rtf.format(Math.round(diffMs / 3_600_000), "hour")}`;
  if (absSec < 86_400 * 30)
    return `Updated ${rtf.format(Math.round(diffMs / 86_400_000), "day")}`;
  if (absSec < 86_400 * 365)
    return `Updated ${rtf.format(Math.round(diffMs / (86_400_000 * 30)), "month")}`;
  return `Updated ${rtf.format(Math.round(diffMs / (86_400_000 * 365)), "year")}`;
}

const PREVIEW_MAX = 100;

function truncatePreview(text: string, max = PREVIEW_MAX): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function previewFromItem(item: ReviewItem): string {
  return truncatePreview(join([item.title, item.sub, item.meta], ", "));
}

function previewFromBlocks(
  emptyHint: string,
  blocks: ReviewBlock[],
  options: {
    skillNames?: string[];
    verifiedSkillCount?: number;
  } = {},
): string {
  if (blocks.length === 0) return emptyHint;

  if (options.skillNames && options.skillNames.length > 0) {
    const listed = options.skillNames.slice(0, 3).join(" · ");
    const more =
      options.skillNames.length > 3
        ? ` +${options.skillNames.length - 3}`
        : "";
    const verified =
      options.verifiedSkillCount && options.verifiedSkillCount > 0
        ? ` · ${options.verifiedSkillCount} skills verified`
        : "";
    return truncatePreview(`${listed}${more}${verified}`);
  }

  for (const block of blocks) {
    if (block.kind === "items" && block.items[0]) {
      return previewFromItem(block.items[0]);
    }
    if (block.kind === "file") {
      return truncatePreview(join([block.name, block.meta], " · "));
    }
    if (block.kind === "text") {
      return truncatePreview(block.text);
    }
    if (block.kind === "pairs" && block.pairs.length > 0) {
      return truncatePreview(
        block.pairs
          .slice(0, 3)
          .map((p) => p.label)
          .join(" · "),
      );
    }
    if (block.kind === "chips" && block.items.length > 0) {
      return truncatePreview(block.items.slice(0, 3).join(" · "));
    }
  }

  return emptyHint;
}

function card(
  stepIndex: number,
  title: string,
  icon: ReviewIconKey,
  emptyHint: string,
  blocks: ReviewBlock[],
  options: {
    count?: number;
    noGap?: boolean;
    preview?: string;
  } = {},
): ReviewCard {
  const filled = blocks.length > 0;
  return {
    stepIndex,
    title,
    icon,
    emptyHint,
    preview: options.preview ?? previewFromBlocks(emptyHint, blocks),
    count: options.count ?? 0,
    filled,
    noGap: options.noGap ?? false,
    blocks,
  };
}

export function buildProfileReview({
  detail,
  personaLabel,
  score,
  resume,
  mockInterviewCount,
  verifiedAccomplishments,
  verifiedSkills,
  stepIndexByKey,
}: {
  detail: CandidateDetail;
  personaLabel: string;
  score: number;
  resume: ResumeView | null;
  mockInterviewCount: number;
  /** Platform-derived; read-only on the report card as in the section. */
  verifiedAccomplishments: readonly {
    key: string;
    title: string;
    detail: string | null;
    outcomeLabel: string;
  }[];
  /** Derived from curriculum + completion; shown beside the claimed skills. */
  verifiedSkills: readonly { skillId: string; name: string }[];
  /** The wizard's own ordering, so Add / Edit always opens the right step. */
  stepIndexByKey: Record<string, number>;
}): ProfileReview {
  const at = (key: string) => stepIndexByKey[key] ?? 0;

  /* ---- basic ---- */
  const basicBlocks: ReviewBlock[] = [];
  const summary = nonEmpty(detail.summary);
  if (summary) {
    basicBlocks.push({ kind: "sub", text: "Profile summary" });
    basicBlocks.push({ kind: "text", text: summary });
  }

  /* ---- experience ---- */
  const experienceItems: ReviewItem[] = detail.experience.map((e) => ({
    title: e.title || "Role",
    sub: join([e.companyName, e.employmentType, e.locationCity]) || null,
    meta:
      span(e.startMonth, e.startYear, e.endMonth, e.endYear, e.isCurrent) ||
      null,
    body: nonEmpty(e.description),
    chips: [],
    links: [],
  }));

  /* ---- education ---- */
  const educationItems: ReviewItem[] = detail.education.map((e) => {
    const head = join([e.degree, e.fieldOfStudy], " — ");
    const gradeLabel = e.gradeType
      ? (GRADE_TYPE_LABELS[e.gradeType] ?? e.gradeType)
      : null;
    const grade = e.grade
      ? gradeLabel
        ? `${e.grade} ${gradeLabel}`
        : e.grade
      : null;
    return {
      title: head || e.institutionName || "Education",
      sub: head ? nonEmpty(e.institutionName) : null,
      meta:
        join([
          span(
            e.startMonth,
            e.startYear,
            e.endMonth,
            e.graduationYear,
            e.isCurrent,
          ),
          grade ? `Scored ${grade}` : null,
        ]) || null,
      body: nonEmpty(e.description),
      chips: [],
      links: [],
    };
  });

  /* ---- projects ---- */
  const projectItems: ReviewItem[] = detail.projects.map((p) => {
    const links: ReviewLink[] = [];
    if (p.liveUrl) links.push({ label: "Live", url: p.liveUrl });
    if (p.repoUrl) links.push({ label: "Code", url: p.repoUrl });
    return {
      title: p.title || "Project",
      sub: null,
      meta: null,
      body: nonEmpty(p.description),
      chips: p.techStack,
      links,
    };
  });

  /* ---- mock interview: earned, never entered ---- */
  const mockBlocks: ReviewBlock[] =
    mockInterviewCount > 0
      ? [
          {
            kind: "text",
            text:
              mockInterviewCount === 1
                ? "Mock interview completed. Each finished interview keeps its own scored report."
                : `${mockInterviewCount} mock interviews completed. Each finished interview keeps its own scored report.`,
          },
        ]
      : [];

  /* ---- skills ---- */
  const claimed = detail.skills.filter((s) => s.claimedByCandidate);
  const skillBlocks: ReviewBlock[] = [];
  if (claimed.length > 0) {
    skillBlocks.push({ kind: "chips", items: claimed.map((s) => s.name) });
  }
  if (verifiedSkills.length > 0) {
    skillBlocks.push({ kind: "sub", text: "Verified by ABTalks" });
    skillBlocks.push({
      kind: "chips",
      items: verifiedSkills.map((s) => s.name),
    });
  }

  /* ---- certifications ---- */
  const certificationItems: ReviewItem[] = detail.certifications.map((c) => ({
    title: c.name || "Certification",
    sub: nonEmpty(c.issuer),
    meta:
      span(c.issuedMonth, c.issuedYear, c.expiresMonth, c.expiresYear, false) ||
      null,
    body: null,
    chips: [],
    links: c.credentialUrl
      ? [{ label: "Credential", url: c.credentialUrl }]
      : [],
  }));

  /* ---- accomplishments: verified + certifications + awards ---- */
  const accomplishmentBlocks: ReviewBlock[] = [];
  if (verifiedAccomplishments.length > 0) {
    accomplishmentBlocks.push({ kind: "sub", text: "Verified by ABTalks" });
    accomplishmentBlocks.push({
      kind: "items",
      items: verifiedAccomplishments.map((v) => ({
        title: v.title,
        sub: v.detail,
        meta: v.outcomeLabel,
        body: null,
        chips: [],
        links: [],
      })),
    });
  }
  if (certificationItems.length > 0) {
    accomplishmentBlocks.push({ kind: "sub", text: "Certifications" });
    accomplishmentBlocks.push({ kind: "items", items: certificationItems });
  }
  const awards = nonEmpty(detail.awards);
  if (awards) {
    accomplishmentBlocks.push({ kind: "sub", text: "Awards" });
    accomplishmentBlocks.push({ kind: "text", text: awards });
  }

  /* ---- resume ---- */
  const resumeBlocks: ReviewBlock[] = [];
  if (resume) {
    const label =
      resume.fileName ?? resume.sourceUrl ?? "Resume on file";
    const meta =
      resume.strength !== null
        ? `${resume.strength.overallScore}/100 · ${resume.strength.band}`
        : resume.status === "READY"
          ? "Ready"
          : resume.status.toLowerCase();
    resumeBlocks.push({ kind: "file", name: label, meta });
    if (resume.strength && resume.strength.tips.length > 0) {
      resumeBlocks.push({ kind: "sub", text: "What to improve" });
      // Tips are sentences, not labels — each one is its own line.
      for (const tip of resume.strength.tips) {
        resumeBlocks.push({ kind: "text", text: tip });
      }
    }
  }

  /* ---- links ---- */
  const linkPairs: ReviewPair[] = [];
  if (detail.linkedinUrl) {
    linkPairs.push({
      label: "LinkedIn",
      value: detail.linkedinUrl,
      url: detail.linkedinUrl,
    });
  }
  if (detail.githubUsername) {
    const url = `https://github.com/${detail.githubUsername}`;
    linkPairs.push({ label: "GitHub", value: url, url });
  }
  if (detail.portfolioUrl) {
    linkPairs.push({
      label: "Portfolio",
      value: detail.portfolioUrl,
      url: detail.portfolioUrl,
    });
  }
  for (const link of detail.links) {
    linkPairs.push({
      label: link.label ?? LINK_TYPE_LABELS[link.type] ?? link.type,
      value: link.url,
      url: link.url,
    });
  }
  const linkBlocks: ReviewBlock[] =
    linkPairs.length > 0 ? [{ kind: "pairs", pairs: linkPairs }] : [];

  /* ---- career preferences ---- */
  const pref = detail.preference;
  const prefPairs: ReviewPair[] = [];
  const prefBlocks: ReviewBlock[] = [];
  if (pref) {
    const push = (label: string, value: string) => {
      if (value) prefPairs.push({ label, value, url: null });
    };
    push("Open to work", pref.openToWork ? "Yes" : "");
    push(
      "Preferred job type",
      pref.opportunityTypes
        .map((t) => OPPORTUNITY_TYPE_LABELS[t] ?? t)
        .join(", "),
    );
    push("Work mode", pref.remotePreference ?? "");
    push(
      "Notice period",
      pref.noticePeriodDays === null ? "" : `${pref.noticePeriodDays} days`,
    );
    push(
      "Available from",
      monthYear(pref.availableFromMonth, pref.availableFromYear),
    );
    push("Willing to relocate", pref.willingToRelocate ? "Yes" : "");

    if (prefPairs.length > 0) prefBlocks.push({ kind: "pairs", pairs: prefPairs });
    if (pref.preferredRoles.length > 0) {
      prefBlocks.push({ kind: "sub", text: "Preferred roles" });
      prefBlocks.push({ kind: "chips", items: pref.preferredRoles });
    }
    if (pref.preferredLocations.length > 0) {
      prefBlocks.push({ kind: "sub", text: "Preferred locations" });
      prefBlocks.push({ kind: "chips", items: pref.preferredLocations });
    }
  }

  const cards: ReviewCard[] = [
    card(
      at("basic"),
      "Basic Information",
      "basic",
      "Add a summary so recruiters can read you in one paragraph.",
      basicBlocks,
    ),
    card(
      at("experience"),
      "Experience",
      "experience",
      "Add the roles and internships you have done.",
      experienceItems.length > 0
        ? [{ kind: "items", items: experienceItems }]
        : [],
      { count: experienceItems.length },
    ),
    card(
      at("education"),
      "Education",
      "education",
      "Add your degree, college and years so recruiters can place you.",
      educationItems.length > 0
        ? [{ kind: "items", items: educationItems }]
        : [],
      { count: educationItems.length },
    ),
    card(
      at("projects"),
      "Projects",
      "projects",
      "Show what you have built — with links a recruiter can open.",
      projectItems.length > 0 ? [{ kind: "items", items: projectItems }] : [],
      { count: projectItems.length },
    ),
    card(
      at("mock"),
      "Mock Interview",
      "summary",
      "No mock interview yet — they are live AI interviews, and each one you finish keeps its own scored report.",
      mockBlocks,
      { count: mockInterviewCount, noGap: true },
    ),
    card(
      at("skills"),
      "Skills",
      "skills",
      "Add the skills you want to be found for.",
      skillBlocks,
      {
        count: claimed.length + verifiedSkills.length,
        preview: previewFromBlocks(
          "Add the skills you want to be found for.",
          skillBlocks,
          {
            skillNames: claimed.map((s) => s.name),
            verifiedSkillCount: verifiedSkills.length,
          },
        ),
      },
    ),
    card(
      at("accomplishments"),
      "Accomplishments",
      "certifications",
      "Add the certifications you hold and the awards you have won.",
      accomplishmentBlocks,
      { count: verifiedAccomplishments.length + certificationItems.length },
    ),
    card(
      at("resume"),
      "Resume",
      "resume",
      "Upload your resume to see how strong it is and what to improve.",
      resumeBlocks,
    ),
    card(
      at("links"),
      "Links",
      "links",
      "Add where your work lives.",
      linkBlocks,
    ),
    card(
      at("preferences"),
      "Career Preferences",
      "career",
      "Tell recruiters what you are looking for — roles, locations and availability.",
      prefBlocks,
    ),
  ];

  const place = join([detail.locationCity, detail.locationRegion], ", ");

  return {
    name: detail.fullName || "Your name",
    headline: nonEmpty(detail.headline),
    location: place || null,
    phone: nonEmpty(detail.phone),
    persona: personaLabel,
    updatedLabel: lastUpdated(detail.updatedAt),
    openToWork: detail.preference?.openToWork ?? false,
    score,
    cards,
  };
}
