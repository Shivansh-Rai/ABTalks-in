/**
 * Curated vocabularies for the detailed profile's dropdowns.
 *
 * Deliberately static constants rather than catalog tables. Colleges already
 * have a real catalog (`College`, 54k rows, `/api/colleges/search`) and skills
 * have `Skill`; degrees, departments and role titles do not, and three new
 * tables to hold a few dozen strings each would be a migration nobody needs.
 * Every one of these is a suggestion list, not an allow-list — each field
 * accepts free text so nobody is blocked by a missing entry.
 */

export const MONTHS = [
  { value: 1, label: "January", short: "Jan" },
  { value: 2, label: "February", short: "Feb" },
  { value: 3, label: "March", short: "Mar" },
  { value: 4, label: "April", short: "Apr" },
  { value: 5, label: "May", short: "May" },
  { value: 6, label: "June", short: "Jun" },
  { value: 7, label: "July", short: "Jul" },
  { value: 8, label: "August", short: "Aug" },
  { value: 9, label: "September", short: "Sep" },
  { value: 10, label: "October", short: "Oct" },
  { value: 11, label: "November", short: "Nov" },
  { value: 12, label: "December", short: "Dec" },
] as const;

export function monthShort(month: number | null | undefined): string | null {
  if (month == null) return null;
  return MONTHS.find((m) => m.value === month)?.short ?? null;
}

/** Education spans reach further back than employment; projects reach forward. */
export function yearRange(back: number, forward: number): number[] {
  const now = new Date().getUTCFullYear();
  const years: number[] = [];
  for (let y = now + forward; y >= now - back; y--) years.push(y);
  return years;
}

/**
 * Degrees, as Indian institutions award them.
 *
 * `B.E / B.Tech` is one entry because they are one qualification under two
 * names — a college calls it B.E or B.Tech depending on whether it is affiliated
 * to a university that kept the older title, and no recruiter distinguishes
 * them. `M.E / M.Tech` follows for the same reason. Rows saved before this
 * merge keep whatever text they hold; the picker simply stops offering two.
 */
export const DEGREES = [
  // Undergraduate
  "B.E / B.Tech",
  "B.Sc",
  "B.C.A",
  "B.Com",
  "B.A",
  "B.B.A",
  "B.Des",
  "B.Arch",
  "B.Pharm",
  "B.Ed",
  "B.Voc",
  "LL.B",
  "MBBS",
  "BDS",
  "B.Sc Nursing",
  "BPT",
  "B.A LL.B",
  "B.H.M",
  // Postgraduate
  "M.E / M.Tech",
  "M.Sc",
  "M.C.A",
  "M.B.A",
  "PGDM",
  "M.Com",
  "M.A",
  "M.Des",
  "M.Arch",
  "M.Pharm",
  "M.Ed",
  "LL.M",
  "MD",
  "MS",
  "M.P.H",
  // Integrated, research and school
  "Integrated M.Tech",
  "Integrated M.Sc",
  "Ph.D",
  "Diploma",
  "ITI",
  "Higher Secondary (12th)",
  "Secondary (10th)",
] as const;

/** Old spellings people still type, folded onto the entry above. */
const DEGREE_ALIASES: Record<string, string> = {
  "b.e": "B.E / B.Tech",
  be: "B.E / B.Tech",
  "b.tech": "B.E / B.Tech",
  btech: "B.E / B.Tech",
  "b tech": "B.E / B.Tech",
  "bachelor of engineering": "B.E / B.Tech",
  "bachelor of technology": "B.E / B.Tech",
  "m.e": "M.E / M.Tech",
  me: "M.E / M.Tech",
  "m.tech": "M.E / M.Tech",
  mtech: "M.E / M.Tech",
  "m tech": "M.E / M.Tech",
  bca: "B.C.A",
  mca: "M.C.A",
  bba: "B.B.A",
  mba: "M.B.A",
  bsc: "B.Sc",
  msc: "M.Sc",
  bcom: "B.Com",
  mcom: "M.Com",
  ba: "B.A",
  ma: "M.A",
  llb: "LL.B",
  llm: "LL.M",
  phd: "Ph.D",
  "12th": "Higher Secondary (12th)",
  "10th": "Secondary (10th)",
};

/** Fold a typed degree onto the catalog spelling, or keep it as typed. */
export function canonicalDegree(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  return (
    DEGREE_ALIASES[key] ??
    DEGREES.find((d) => d.toLowerCase() === key) ??
    trimmed
  );
}

export function searchDegrees(query: string, limit = 12): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...DEGREES].slice(0, limit);
  const hit = DEGREE_ALIASES[q];
  const prefix = DEGREES.filter((d) => d.toLowerCase().startsWith(q));
  const contains = DEGREES.filter(
    (d) => !d.toLowerCase().startsWith(q) && d.toLowerCase().includes(q),
  );
  const ordered = [...(hit ? [hit] : []), ...prefix, ...contains];
  return [...new Set(ordered)].slice(0, limit);
}

/**
 * Departments, per degree.
 *
 * A flat list cannot serve both a B.Tech and a B.Com: offering "Mechanical
 * Engineering" to a commerce student is noise, and the seventeen entries this
 * replaced covered engineering and almost nothing else. The Department field
 * reads the degree beside it and offers that degree's branches.
 *
 * Free text still wins — a degree the catalog lacks falls back to every branch
 * below, and anything typed is kept as typed.
 */
const ENGINEERING_BRANCHES = [
  "Computer Science and Engineering",
  "Information Technology",
  "Artificial Intelligence and Machine Learning",
  "Data Science",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Chemical Engineering",
  "Aerospace Engineering",
  "Automobile Engineering",
  "Biomedical Engineering",
  "Biotechnology",
  "Industrial and Production Engineering",
  "Instrumentation and Control Engineering",
  "Marine Engineering",
  "Metallurgical Engineering",
  "Mining Engineering",
  "Petroleum Engineering",
  "Robotics and Automation",
  "Mechatronics",
  "Textile Engineering",
  "Agricultural Engineering",
  "Environmental Engineering",
  "Food Technology",
  "Electronics and Instrumentation",
  "Computer Science and Business Systems",
  "Mathematics and Computing",
];

const SCIENCE_BRANCHES = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Statistics",
  "Computer Science",
  "Information Technology",
  "Data Science",
  "Biology",
  "Botany",
  "Zoology",
  "Microbiology",
  "Biotechnology",
  "Biochemistry",
  "Environmental Science",
  "Electronics",
  "Geology",
  "Agriculture",
  "Forensic Science",
  "Nursing",
  "Home Science",
];

const COMMERCE_BRANCHES = [
  "Commerce",
  "Accounting and Finance",
  "Banking and Insurance",
  "Taxation",
  "Financial Markets",
  "Economics",
  "Business Economics",
  "Cost and Management Accounting",
];

const ARTS_BRANCHES = [
  "English",
  "Hindi",
  "History",
  "Political Science",
  "Economics",
  "Psychology",
  "Sociology",
  "Journalism and Mass Communication",
  "Philosophy",
  "Geography",
  "Public Administration",
  "Social Work",
  "Fine Arts",
  "Education",
  "Literature",
];

const MANAGEMENT_BRANCHES = [
  "Marketing",
  "Finance",
  "Human Resource Management",
  "Operations Management",
  "Information Technology and Systems",
  "Business Analytics",
  "International Business",
  "Entrepreneurship",
  "Supply Chain Management",
  "General Management",
  "Business Administration",
];

const DESIGN_BRANCHES = [
  "Product Design",
  "UI/UX Design",
  "Communication Design",
  "Graphic Design",
  "Fashion Design",
  "Interior Design",
  "Industrial Design",
  "Animation and VFX",
  "Game Design",
  "Textile Design",
];

const PHARMACY_BRANCHES = [
  "Pharmaceutics",
  "Pharmacology",
  "Pharmaceutical Chemistry",
  "Pharmacognosy",
  "Pharmacy Practice",
  "Quality Assurance",
];

const MEDICAL_BRANCHES = [
  "General Medicine",
  "General Surgery",
  "Paediatrics",
  "Obstetrics and Gynaecology",
  "Orthopaedics",
  "Dermatology",
  "Radiology",
  "Anaesthesiology",
  "Psychiatry",
  "Community Medicine",
  "Dentistry",
  "Physiotherapy",
  "Public Health",
];

const LAW_BRANCHES = [
  "Corporate Law",
  "Criminal Law",
  "Constitutional Law",
  "Intellectual Property Law",
  "Cyber Law",
  "International Law",
  "Taxation Law",
  "Labour Law",
];

const ARCHITECTURE_BRANCHES = [
  "Architecture",
  "Urban and Regional Planning",
  "Landscape Architecture",
  "Construction Management",
  "Interior Architecture",
];

const COMPUTER_APPLICATION_BRANCHES = [
  "Computer Applications",
  "Software Development",
  "Data Science",
  "Cloud Computing",
  "Cyber Security",
  "Artificial Intelligence and Machine Learning",
];

const SCHOOL_STREAMS = [
  "Science (PCM)",
  "Science (PCB)",
  "Science (PCMB)",
  "Commerce",
  "Arts / Humanities",
  "Vocational",
];

const TRADE_BRANCHES = [
  "Computer Engineering",
  "Civil Engineering",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Electronics Engineering",
  "Automobile Engineering",
  "Fitter",
  "Electrician",
  "Welder",
  "Draughtsman",
];

export const DEPARTMENTS_BY_DEGREE: Readonly<Record<string, readonly string[]>> = {
  "B.E / B.Tech": ENGINEERING_BRANCHES,
  "M.E / M.Tech": ENGINEERING_BRANCHES,
  "Integrated M.Tech": ENGINEERING_BRANCHES,
  Diploma: TRADE_BRANCHES,
  ITI: TRADE_BRANCHES,
  "B.Sc": SCIENCE_BRANCHES,
  "M.Sc": SCIENCE_BRANCHES,
  "Integrated M.Sc": SCIENCE_BRANCHES,
  "B.Sc Nursing": ["Nursing", "Midwifery", "Community Health Nursing"],
  "B.C.A": COMPUTER_APPLICATION_BRANCHES,
  "M.C.A": COMPUTER_APPLICATION_BRANCHES,
  "B.Com": COMMERCE_BRANCHES,
  "M.Com": COMMERCE_BRANCHES,
  "B.A": ARTS_BRANCHES,
  "M.A": ARTS_BRANCHES,
  "B.B.A": MANAGEMENT_BRANCHES,
  "M.B.A": MANAGEMENT_BRANCHES,
  PGDM: MANAGEMENT_BRANCHES,
  "B.H.M": ["Hotel Management", "Hospitality Management", "Culinary Arts"],
  "B.Des": DESIGN_BRANCHES,
  "M.Des": DESIGN_BRANCHES,
  "B.Arch": ARCHITECTURE_BRANCHES,
  "M.Arch": ARCHITECTURE_BRANCHES,
  "B.Pharm": PHARMACY_BRANCHES,
  "M.Pharm": PHARMACY_BRANCHES,
  MBBS: MEDICAL_BRANCHES,
  MD: MEDICAL_BRANCHES,
  MS: MEDICAL_BRANCHES,
  BDS: MEDICAL_BRANCHES,
  BPT: MEDICAL_BRANCHES,
  "M.P.H": MEDICAL_BRANCHES,
  "LL.B": LAW_BRANCHES,
  "LL.M": LAW_BRANCHES,
  "B.A LL.B": LAW_BRANCHES,
  "B.Ed": ARTS_BRANCHES,
  "M.Ed": ARTS_BRANCHES,
  "B.Voc": TRADE_BRANCHES,
  "Higher Secondary (12th)": SCHOOL_STREAMS,
  "Secondary (10th)": SCHOOL_STREAMS,
};

/** Every branch, deduped — the fallback when the degree is unknown or blank. */
export const FIELDS_OF_STUDY: readonly string[] = [
  ...new Set(
    [
      ENGINEERING_BRANCHES,
      COMPUTER_APPLICATION_BRANCHES,
      SCIENCE_BRANCHES,
      MANAGEMENT_BRANCHES,
      COMMERCE_BRANCHES,
      ARTS_BRANCHES,
      DESIGN_BRANCHES,
      ARCHITECTURE_BRANCHES,
      PHARMACY_BRANCHES,
      MEDICAL_BRANCHES,
      LAW_BRANCHES,
      TRADE_BRANCHES,
      SCHOOL_STREAMS,
    ].flat(),
  ),
];

/**
 * Branches worth offering beside a degree. A Ph.D can be in anything, and an
 * unrecognised degree should not narrow anything, so both get the full list.
 */
export function departmentsForDegree(degree: string): readonly string[] {
  const canonical = canonicalDegree(degree);
  return DEPARTMENTS_BY_DEGREE[canonical] ?? FIELDS_OF_STUDY;
}

export const COMMON_ROLES = [
  "Software Engineer",
  "Senior Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Mobile Engineer",
  "Data Scientist",
  "Data Analyst",
  "Data Engineer",
  "Machine Learning Engineer",
  "AI Engineer",
  "MLOps Engineer",
  "DevOps Engineer",
  "Site Reliability Engineer",
  "Cloud Engineer",
  "QA Engineer",
  "Product Manager",
  "Engineering Manager",
  "UI/UX Designer",
  "Business Analyst",
  "Technical Writer",
  "Research Intern",
  "Software Engineering Intern",
  "Data Science Intern",
] as const;

export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Internship",
  "Contract",
  "Freelance",
  "Apprenticeship",
] as const;

/** Stored on `CandidatePreference.remotePreference`, which is a free string. */
export const WORK_MODES = ["Remote", "Hybrid", "On-site", "Flexible"] as const;

export const GRADE_TYPE_LABELS: Record<string, string> = {
  PERCENTAGE: "Percentage",
  CGPA_10: "CGPA (out of 10)",
  GPA_4: "GPA (out of 4)",
  GRADE: "Letter grade",
  OTHER: "Other",
};

export const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  INTERNSHIP: "Internship",
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
};


export const LINK_TYPE_LABELS: Record<string, string> = {
  PORTFOLIO: "Portfolio",
  LINKEDIN: "LinkedIn",
  GITHUB: "GitHub",
  LEETCODE: "LeetCode",
  CODECHEF: "CodeChef",
  CODEFORCES: "Codeforces",
  KAGGLE: "Kaggle",
  BEHANCE: "Behance",
  DRIBBBLE: "Dribbble",
  OTHER: "Other",
};

/** Additional-link types only — the three first-class links have their own fields. */
export const EXTRA_LINK_TYPES = [
  "LEETCODE",
  "CODECHEF",
  "CODEFORCES",
  "KAGGLE",
  "BEHANCE",
  "DRIBBBLE",
  "OTHER",
] as const;

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  TRANSGENDER: "Transgender",
};

export const PERSONA_LABELS: Record<string, string> = {
  STUDENT: "Student",
  PROFESSIONAL: "Working professional",
  OTHER: "Other",
};
