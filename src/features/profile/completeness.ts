import { phoneSchema } from "@/lib/validations/phone";
import type {
  CandidateDetail,
  CertificationView,
  EducationView,
  ExperienceView,
  ProjectView,
} from "@/repositories/candidate-detail";

/**
 * Profile strength.
 *
 * A UX metric and nothing else. It does not gate recruiter discovery (that is
 * `CandidateVisibility.searchableByRecruiters`), it does not imply the candidate
 * is looking (that is `CandidatePreference.openToWork`), and it never filters
 * anybody out of `/hire`. It exists to tell a candidate what is still worth
 * adding.
 *
 * Weights sum to exactly 100, accumulated as tenths of a percent so 0.5 and
 * 1.5 land without float drift. Experience and Education are gated: a
 * started-but-incomplete first entry contributes 0. Additional rows never
 * increase the score. A candidate with no employment history can still earn
 * the Experience 20% by setting `hasNoWorkExperience`.
 */

export type SectionKey =
  | "basic"
  | "experience"
  | "education"
  | "projects"
  | "skills"
  | "accomplishments"
  | "resume"
  | "links"
  | "preferences";

export type SectionStatus = {
  key: SectionKey;
  label: string;
  complete: boolean;
  /** Percent this section can contribute (0–25). */
  weight: number;
  /** 0–1. How much of this section's own weight has been earned. */
  fraction: number;
  /** Shown when incomplete. Null when there is nothing to ask for. */
  hint: string | null;
  /**
   * The fields whose weight has not been earned, named the way the candidate
   * sees them in the wizard, most valuable first. Empty exactly when this
   * section has earned all of its weight — which is the invariant that makes
   * the overall percentage explainable: the union of every section's `missing`
   * accounts for the entire shortfall below 100.
   *
   * Note this is a stricter test than `complete`. A section can be `complete`
   * (its required fields are in) and still name unearned extras here, e.g. a
   * saved role with no description. Those extras are precisely the gap that
   * used to be invisible on /profile.
   */
  missing: string[];
};

export type ProfileCompleteness = {
  /** 0-100, capped. */
  score: number;
  sections: SectionStatus[];
};

/** Section maxima in tenths of a percent. Sum = 1000. */
const WEIGHT_TENTHS: Record<SectionKey, number> = {
  basic: 250,
  experience: 200,
  education: 150,
  projects: 150,
  skills: 100,
  accomplishments: 50,
  resume: 30,
  links: 40,
  preferences: 30,
};

type SectionScore = {
  earnedTenths: number;
  complete: boolean;
  hint: string | null;
  missing: string[];
};

function filled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((item) => filled(item));
  return true;
}

function validPhone(phone: string | null): boolean {
  if (!filled(phone)) return false;
  return phoneSchema.safeParse(phone).success;
}

function section(
  key: SectionKey,
  label: string,
  scored: SectionScore,
): SectionStatus {
  const weightTenths = WEIGHT_TENTHS[key];
  return {
    key,
    label,
    complete: scored.complete,
    weight: weightTenths / 10,
    fraction: weightTenths === 0 ? 0 : scored.earnedTenths / weightTenths,
    hint: scored.complete ? null : scored.hint,
    missing: scored.missing,
  };
}

function basicScore(detail: CandidateDetail): SectionScore {
  const name = filled(detail.fullName);
  const phone = validPhone(detail.phone);
  // primaryPersona is non-null with a default; every registered profile has it.
  const persona = filled(detail.primaryPersona);
  const city = filled(detail.locationCity);
  const region = filled(detail.locationRegion);
  const country = filled(detail.countryCode);
  const gender = detail.gender !== null;
  const headline = filled(detail.headline);
  const about = filled(detail.summary);

  let earnedTenths = 0;
  if (name) earnedTenths += 40;
  if (phone) earnedTenths += 30;
  if (persona) earnedTenths += 20;
  if (city) earnedTenths += 20;
  if (region) earnedTenths += 20;
  if (country) earnedTenths += 20;
  if (gender) earnedTenths += 20;
  if (headline) earnedTenths += 50;
  if (about) earnedTenths += 30;

  const complete =
    name && phone && persona && city && region && country && gender && headline && about;
  // Ordered by what it is worth, so the first thing a candidate reads is the
  // field that moves the number most.
  const missing = [
    !headline && "Headline",
    !name && "Full name",
    !phone && "Phone number",
    !about && "About you",
    !city && "Current city",
    !region && "State",
    !country && "Country",
    !gender && "Gender",
  ].filter((x): x is string => typeof x === "string");
  return {
    earnedTenths,
    complete,
    hint: "Add a headline, location, and contact details",
    missing,
  };
}

function experienceRequired(row: ExperienceView): boolean {
  return (
    filled(row.companyName) &&
    filled(row.title) &&
    filled(row.employmentType) &&
    filled(row.locationCity) &&
    row.startYear != null &&
    (row.isCurrent || row.endYear != null)
  );
}

function experienceScore(detail: CandidateDetail): SectionScore {
  const rows = detail.experience;
  if (detail.hasNoWorkExperience && rows.length === 0) {
    return { earnedTenths: 200, complete: true, hint: null, missing: [] };
  }
  if (rows.length === 0) {
    return {
      earnedTenths: 0,
      complete: false,
      hint: "Add a role, internship, or freelance work — or mark that you have no work experience yet.",
      missing: [
        "A role, internship or freelance entry — or tick “I have no work experience yet”",
      ],
    };
  }

  const row = rows[0]!;
  if (!experienceRequired(row)) {
    // The gate zeroes the whole section, so the description is unearned too and
    // is named alongside the required fields rather than left for a second pass.
    return {
      earnedTenths: 0,
      complete: false,
      hint: "Finish the required fields on your most recent role",
      missing: [
        !filled(row.companyName) && "Company name",
        !filled(row.title) && "Role title",
        !filled(row.employmentType) && "Employment type",
        !filled(row.locationCity) && "Job location",
        row.startYear == null && "Start date",
        !row.isCurrent && row.endYear == null
          ? "End date (or mark it your current role)"
          : false,
        !filled(row.description) && "Role description",
      ].filter((x): x is string => typeof x === "string"),
    };
  }

  let earnedTenths = 160;
  if (filled(row.description)) earnedTenths += 40;
  return {
    earnedTenths,
    complete: true,
    hint: earnedTenths < 200 ? "Add a description of the role" : null,
    missing: filled(row.description) ? [] : ["Role description"],
  };
}

function educationRequired(row: EducationView): boolean {
  return (
    filled(row.institutionName) &&
    filled(row.degree) &&
    filled(row.fieldOfStudy) &&
    row.startYear != null &&
    (row.isCurrent || row.graduationYear != null)
  );
}

function educationScore(rows: EducationView[]): SectionScore {
  if (rows.length === 0) {
    return {
      earnedTenths: 0,
      complete: false,
      hint: "Add your college or school",
      missing: ["Your college or school"],
    };
  }

  const row = rows[0]!;
  const extras = (r: EducationView): string[] =>
    [
      r.gradeType === null && "Score type (CGPA or percentage)",
      !filled(r.grade) && "Score",
      !filled(r.description) && "Course description",
    ].filter((x): x is string => typeof x === "string");

  if (!educationRequired(row)) {
    return {
      earnedTenths: 0,
      complete: false,
      hint: "Finish the required fields on your first education entry",
      missing: [
        !filled(row.institutionName) && "Institution name",
        !filled(row.degree) && "Degree",
        !filled(row.fieldOfStudy) && "Field of study",
        row.startYear == null && "Start year",
        !row.isCurrent && row.graduationYear == null
          ? "Graduation year (or mark it ongoing)"
          : false,
      ].filter((x): x is string => typeof x === "string").concat(extras(row)),
    };
  }

  let earnedTenths = 130;
  if (row.gradeType !== null) earnedTenths += 10;
  if (filled(row.grade)) earnedTenths += 5;
  if (filled(row.description)) earnedTenths += 5;
  return {
    earnedTenths,
    complete: true,
    hint: earnedTenths < 150 ? "Add your score and a short description" : null,
    missing: extras(row),
  };
}

function projectScore(rows: ProjectView[]): SectionScore {
  if (rows.length === 0) {
    return {
      earnedTenths: 0,
      complete: false,
      hint: "Add something you have built",
      missing: ["A project — name, description, tech stack and links"],
    };
  }

  const row = rows[0]!;
  let earnedTenths = 0;
  if (filled(row.title)) earnedTenths += 30;
  if (filled(row.description)) earnedTenths += 40;
  if (filled(row.techStack)) earnedTenths += 30;
  if (filled(row.repoUrl)) earnedTenths += 30;
  if (filled(row.liveUrl)) earnedTenths += 20;

  // GitHub (repo) is required for the section tick; the live demo is an optional
  // extra that still earns weight and appears in `missing` when blank — same
  // shape as experience description / education grade.
  const gateMet =
    filled(row.title) &&
    filled(row.description) &&
    filled(row.techStack) &&
    filled(row.repoUrl);

  return {
    earnedTenths,
    complete: gateMet,
    hint: !gateMet
      ? "Add a name, description, tech stack, and GitHub link"
      : earnedTenths < 150
        ? "Add a live demo link if you have one"
        : null,
    missing: [
      !filled(row.description) && "Project description",
      !filled(row.title) && "Project name",
      !filled(row.techStack) && "Tech stack",
      !filled(row.repoUrl) && "Repository link",
      !filled(row.liveUrl) && "Live demo link",
    ].filter((x): x is string => typeof x === "string"),
  };
}

function skillsScore(detail: CandidateDetail): SectionScore {
  const claimed = detail.skills.filter((s) => s.claimedByCandidate);
  const unique = new Set(claimed.map((s) => s.skillId)).size;
  const earnedTenths = unique === 0 ? 0 : unique >= 3 ? 100 : 50;
  const short = 3 - unique;
  return {
    earnedTenths,
    complete: unique >= 3,
    hint: "Add at least three skills",
    missing:
      unique >= 3
        ? []
        : unique === 0
          ? ["At least three skills"]
          : [`${short} more skill${short === 1 ? "" : "s"}`],
  };
}

/**
 * Empty certifications = full credit (optional section). A started
 * certification must be finished (name, issuer, issue year, credential link).
 * Awards are optional garnish and never hold the score when there are no certs.
 */
function accomplishmentsScore(
  certs: CertificationView[],
  awards: string | null,
): SectionScore {
  if (certs.length === 0) {
    return {
      earnedTenths: 50,
      complete: true,
      hint: null,
      missing: [],
    };
  }

  const cert = certs[0]!;
  let earnedTenths = 0;
  if (filled(cert.name)) earnedTenths += 10;
  if (filled(cert.issuer)) earnedTenths += 10;
  if (cert.issuedYear != null) earnedTenths += 10;
  if (filled(cert.credentialUrl)) earnedTenths += 10;
  if (filled(awards)) earnedTenths += 10;

  const certRequired =
    filled(cert.name) &&
    filled(cert.issuer) &&
    cert.issuedYear != null &&
    filled(cert.credentialUrl);
  const awarded = filled(awards);

  const certMissing = [
    !filled(cert.name) && "Certification name",
    !filled(cert.issuer) && "Certification issuer",
    cert.issuedYear == null && "Issue year",
    !filled(cert.credentialUrl) && "Credential link",
  ].filter((x): x is string => typeof x === "string");

  return {
    earnedTenths,
    complete: certRequired,
    hint: !certRequired
      ? "Finish the certification — it needs a name, issuer, issue year, and credential link"
      : awarded
        ? null
        : "Add an award you have received if you have one",
    // Awards remain an optional extra once the cert gate is met — same shape as
    // project live URL / role description.
    missing: [...certMissing, ...(awarded ? [] : ["Awards or honours"])],
  };
}

function resumeScore(hasResume: boolean): SectionScore {
  return {
    earnedTenths: hasResume ? 30 : 0,
    complete: hasResume,
    hint: "Upload a resume or add a resume link",
    missing: hasResume ? [] : ["A resume upload or resume link"],
  };
}

/**
 * LinkedIn + GitHub = full credit (optional portfolio). Portfolio alone still
 * earns its 1% when present without the other two, but never completes the
 * section or appears in `missing`.
 */
function linksScore(detail: CandidateDetail): SectionScore {
  const hasLinkedin = filled(detail.linkedinUrl);
  const hasGithub = filled(detail.githubUsername);
  const hasPortfolio = filled(detail.portfolioUrl);

  let earnedTenths = 0;
  if (hasLinkedin) earnedTenths += 15;
  if (hasGithub) earnedTenths += 15;
  if (hasPortfolio) earnedTenths += 10;

  // LinkedIn + GitHub = full credit; portfolio is optional garnish.
  if (hasLinkedin && hasGithub) {
    return {
      earnedTenths: 40,
      complete: true,
      hint: null,
      missing: [],
    };
  }

  return {
    earnedTenths,
    complete: false,
    hint: "Add LinkedIn and GitHub",
    missing: [
      !hasLinkedin && "LinkedIn profile",
      !hasGithub && "GitHub username",
    ].filter((x): x is string => typeof x === "string"),
  };
}

/**
 * Empty roles + empty locations = full credit (optional section). Starting
 * either half still requires both. Open to work and the other preference
 * fields never score.
 */
function preferencesScore(detail: CandidateDetail): SectionScore {
  const pref = detail.preference;
  const roles = filled(pref?.preferredRoles);
  const locations = filled(pref?.preferredLocations);

  if (!roles && !locations) {
    return {
      earnedTenths: 30,
      complete: true,
      hint: null,
      missing: [],
    };
  }

  let earnedTenths = 0;
  if (roles) earnedTenths += 15;
  if (locations) earnedTenths += 15;
  return {
    earnedTenths,
    complete: roles && locations,
    hint: "Tell us the roles and locations you want",
    missing: [
      !roles && "Preferred roles",
      !locations && "Preferred locations",
    ].filter((x): x is string => typeof x === "string"),
  };
}

export function computeCompleteness(
  detail: CandidateDetail,
  extras: { hasResume: boolean },
): ProfileCompleteness {
  const scored: { key: SectionKey; label: string; score: SectionScore }[] = [
    { key: "basic", label: "Basic information", score: basicScore(detail) },
    { key: "experience", label: "Experience", score: experienceScore(detail) },
    { key: "education", label: "Education", score: educationScore(detail.education) },
    { key: "projects", label: "Projects", score: projectScore(detail.projects) },
    { key: "skills", label: "Skills", score: skillsScore(detail) },
    {
      key: "accomplishments",
      label: "Accomplishments",
      score: accomplishmentsScore(detail.certifications, detail.awards),
    },
    { key: "resume", label: "Resume", score: resumeScore(extras.hasResume) },
    { key: "links", label: "Links", score: linksScore(detail) },
    {
      key: "preferences",
      label: "Career preferences",
      score: preferencesScore(detail),
    },
  ];

  const earnedTenths = scored.reduce((sum, s) => sum + s.score.earnedTenths, 0);

  return {
    score: Math.min(100, Math.round(earnedTenths / 10)),
    sections: scored.map((s) => section(s.key, s.label, s.score)),
  };
}
