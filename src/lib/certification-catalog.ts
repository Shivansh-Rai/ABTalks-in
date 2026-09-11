/**
 * Suggestions for the Accomplishments → Certifications rows.
 *
 * Both lists are SUGGESTIONS, never a whitelist: the issuer box and the name box
 * both accept anything typed. A candidate's certificate is theirs, and a
 * dropdown that refused unknown values would simply lose data.
 */

/** Widely used certificate issuers, Indian ones first. */
export const CERTIFICATE_PROVIDERS: readonly string[] = [
  "NPTEL",
  "Coursera",
  "Udemy",
  "edX",
  "Udacity",
  "Great Learning",
  "Simplilearn",
  "upGrad",
  "Scaler",
  "GeeksforGeeks",
  "HackerRank",
  "LinkedIn Learning",
  "Google",
  "Microsoft",
  "AWS",
  "IBM",
  "Meta",
  "Oracle",
  "Cisco",
  "Salesforce",
  "Databricks",
  "DeepLearning.AI",
  "Anthropic",
  "CBSE",
  "AICTE",
  "IIT Bombay",
  "IIT Madras",
  "Internshala",
];

/**
 * Well-known courses, so picking the certificate name fills the issuer in too.
 * Kept to genuinely recognisable ones — a long tail here would be a worse
 * autocomplete, not a better one.
 */
export type KnownCourse = { name: string; provider: string };

export const KNOWN_COURSES: readonly KnownCourse[] = [
  // Coursera
  { name: "Machine Learning Specialization", provider: "Coursera" },
  { name: "Deep Learning Specialization", provider: "Coursera" },
  { name: "Google Data Analytics Professional Certificate", provider: "Coursera" },
  { name: "Google IT Support Professional Certificate", provider: "Coursera" },
  { name: "Google UX Design Professional Certificate", provider: "Coursera" },
  { name: "Google Project Management Professional Certificate", provider: "Coursera" },
  { name: "Google Cybersecurity Professional Certificate", provider: "Coursera" },
  { name: "IBM Data Science Professional Certificate", provider: "Coursera" },
  { name: "Meta Front-End Developer Professional Certificate", provider: "Coursera" },
  { name: "Python for Everybody Specialization", provider: "Coursera" },
  { name: "AI For Everyone", provider: "Coursera" },
  { name: "Generative AI with Large Language Models", provider: "Coursera" },

  // Udemy
  { name: "The Complete Web Development Bootcamp", provider: "Udemy" },
  { name: "100 Days of Code: The Complete Python Pro Bootcamp", provider: "Udemy" },
  { name: "The Complete JavaScript Course", provider: "Udemy" },
  { name: "React - The Complete Guide", provider: "Udemy" },
  { name: "Machine Learning A-Z: AI, Python & R", provider: "Udemy" },
  { name: "The Complete SQL Bootcamp", provider: "Udemy" },
  { name: "Docker & Kubernetes: The Practical Guide", provider: "Udemy" },
  { name: "AWS Certified Solutions Architect - Associate", provider: "Udemy" },
  { name: "The Data Science Course: Complete Data Science Bootcamp", provider: "Udemy" },

  // NPTEL
  { name: "Programming in Java (NPTEL)", provider: "NPTEL" },
  { name: "Data Structures and Algorithms using Java (NPTEL)", provider: "NPTEL" },
  { name: "Introduction to Machine Learning (NPTEL)", provider: "NPTEL" },
  { name: "Python for Data Science (NPTEL)", provider: "NPTEL" },
  { name: "Database Management System (NPTEL)", provider: "NPTEL" },
  { name: "Cloud Computing (NPTEL)", provider: "NPTEL" },

  // Vendor certifications
  { name: "AWS Certified Cloud Practitioner", provider: "AWS" },
  { name: "AWS Certified Developer - Associate", provider: "AWS" },
  { name: "Microsoft Certified: Azure Fundamentals (AZ-900)", provider: "Microsoft" },
  { name: "Microsoft Certified: Power BI Data Analyst (PL-300)", provider: "Microsoft" },
  { name: "Google Cloud Associate Cloud Engineer", provider: "Google" },
  { name: "Databricks Certified Data Engineer Associate", provider: "Databricks" },
  { name: "Oracle Certified Professional: Java SE Developer", provider: "Oracle" },
  { name: "Cisco Certified Network Associate (CCNA)", provider: "Cisco" },
  { name: "Salesforce Certified Administrator", provider: "Salesforce" },

  // edX / Udacity
  { name: "CS50's Introduction to Computer Science", provider: "edX" },
  { name: "Data Analyst Nanodegree", provider: "Udacity" },
  { name: "Full Stack Web Developer Nanodegree", provider: "Udacity" },
];

export const KNOWN_COURSE_NAMES: readonly string[] = KNOWN_COURSES.map(
  (c) => c.name,
);

const PROVIDER_BY_COURSE = new Map(
  KNOWN_COURSES.map((c) => [c.name.toLowerCase(), c.provider] as const),
);

/** The issuer for a known course name, or null when we do not recognise it. */
export function providerForCourse(name: string): string | null {
  return PROVIDER_BY_COURSE.get(name.trim().toLowerCase()) ?? null;
}
