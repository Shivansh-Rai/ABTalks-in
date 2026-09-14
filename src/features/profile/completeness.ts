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
  return {
    earnedTenths,
    complete,
    hint: "Add a headline, location, and contact details",
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
    return { earnedTenths: 200, complete: true, hint: null };
  }
  if (rows.length === 0) {
    return {
      earnedTenths: 0,
      complete: false,
      hint: "Add a role, internship, or freelance work — or mark that you have no work experience yet.",
    };
  }

  const row = rows[0]!;
  if (!experienceRequired(row)) {
    return {
      earnedTenths: 0,
      complete: false,
      hint: "Finish the required fields on your most recent role",
    };
  }

  let earnedTenths = 160;
  if (filled(row.description)) earnedTenths += 40;
  return {
    earnedTenths,
    complete: true,
    hint: earnedTenths < 200 ? "Add a description of the role" : null,
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
    };
  }

  const row = rows[0]!;
  if (!educationRequired(row)) {
    return {
      earnedTenths: 0,
      complete: false,
      hint: "Finish the required fields on your first education entry",
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
  };
}

function projectScore(rows: ProjectView[]): SectionScore {
  if (rows.length === 0) {
    return {
      earnedTenths: 0,
      complete: false,
      hint: "Add something you have built",
    };
  }

  const row = rows[0]!;
  let earnedTenths = 0;
  if (filled(row.title)) earnedTenths += 30;
  if (filled(row.description)) earnedTenths += 40;
  if (filled(row.techStack)) earnedTenths += 30;
  if (filled(row.repoUrl)) earnedTenths += 30;
  if (filled(row.liveUrl)) earnedTenths += 20;

  return {
    earnedTenths,
    complete: earnedTenths === 150,
    hint: "Add a name, description, tech stack, and links",
  };
}

function skillsScore(detail: CandidateDetail): SectionScore {
  const claimed = detail.skills.filter((s) => s.claimedByCandidate);
  const unique = new Set(claimed.map((s) => s.skillId)).size;
  const earnedTenths = unique === 0 ? 0 : unique >= 3 ? 100 : 50;
  return {
    earnedTenths,
    complete: unique >= 3,
    hint: "Add at least three skills",
  };
}

function accomplishmentsScore(
  certs: CertificationView[],
  awards: string | null,
): SectionScore {
  const cert = certs[0];
  let earnedTenths = 0;
  if (cert) {
    if (filled(cert.name)) earnedTenths += 10;
    if (filled(cert.issuer)) earnedTenths += 10;
    if (cert.issuedYear != null) earnedTenths += 10;
    if (filled(cert.credentialUrl)) earnedTenths += 10;
  }
  if (filled(awards)) earnedTenths += 10;

  const certRequired =
    cert != null &&
    filled(cert.name) &&
    filled(cert.issuer) &&
    cert.issuedYear != null &&
    filled(cert.credentialUrl);
  const awarded = filled(awards);

  // Either one finishes the section, which is what the hint has always
  // promised. It used to require a certification, so a candidate who wrote up
  // their awards watched the step stay grey with nothing telling them why.
  // A started-but-unfinished certification is called out on its own, because
  // that is a gap the candidate can see and did not intend.
  return {
    earnedTenths,
    complete: certRequired || awarded,
    hint:
      cert != null && !certRequired
        ? "Finish the certification — it needs a name, issuer, issue year, and credential link"
        : "Add a certification or an award you have received",
  };
}

function resumeScore(hasResume: boolean): SectionScore {
  return {
    earnedTenths: hasResume ? 30 : 0,
    complete: hasResume,
    hint: "Upload a resume or add a resume link",
  };
}

function linksScore(detail: CandidateDetail): SectionScore {
  let earnedTenths = 0;
  if (filled(detail.linkedinUrl)) earnedTenths += 15;
  if (filled(detail.githubUsername)) earnedTenths += 15;
  if (filled(detail.portfolioUrl)) earnedTenths += 10;
  return {
    earnedTenths,
    complete: earnedTenths === 40,
    hint: "Add LinkedIn, GitHub, and a portfolio",
  };
}

function preferencesScore(detail: CandidateDetail): SectionScore {
  const pref = detail.preference;
  const roles = filled(pref?.preferredRoles);
  const locations = filled(pref?.preferredLocations);
  let earnedTenths = 0;
  if (roles) earnedTenths += 15;
  if (locations) earnedTenths += 15;
  return {
    earnedTenths,
    complete: roles && locations,
    hint: "Tell us the roles and locations you want",
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
