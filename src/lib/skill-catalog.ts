/**
 * The canonical skill vocabulary the profile offers in its pickers.
 *
 * WHY THIS EXISTS: the `Skill` table was seeded from free-text
 * `StudentProfile.skills` (prisma/seed-platform-taxonomy.ts), so it carries
 * both junk and near-duplicates — "Tailwind css", "Tailwind CSS" and
 * "TailwindCSS" are three rows for one thing. Driving the dropdowns from a
 * curated list makes the picker correct immediately, whatever state the catalog
 * is in, and gives prisma/scripts/dedupe-skills.ts a target to fold onto.
 *
 * One canonical spelling per technology, the way LinkedIn does it. Free text is
 * still accepted through the "Other" path — this is the suggested set, not a
 * whitelist.
 */

export type SkillGroup =
  | "Languages"
  | "Frontend"
  | "Backend"
  | "Databases"
  | "Data & AI"
  | "Cloud & DevOps"
  | "Tools"
  | "Design"
  | "Professional";

export type CanonicalSkill = {
  name: string;
  group: SkillGroup;
  /** Spellings that must fold onto `name`. Compared lower-cased. */
  aliases?: string[];
};

export const CANONICAL_SKILLS: readonly CanonicalSkill[] = [
  // Languages
  { name: "Python", group: "Languages", aliases: ["python3", "py"] },
  { name: "JavaScript", group: "Languages", aliases: ["js", "java script", "ecmascript"] },
  { name: "TypeScript", group: "Languages", aliases: ["ts"] },
  { name: "Java", group: "Languages" },
  { name: "C", group: "Languages" },
  { name: "C++", group: "Languages", aliases: ["cpp", "c plus plus"] },
  { name: "C#", group: "Languages", aliases: ["c sharp", "csharp"] },
  { name: "Go", group: "Languages", aliases: ["golang"] },
  { name: "Rust", group: "Languages" },
  { name: "Kotlin", group: "Languages" },
  { name: "Swift", group: "Languages" },
  { name: "PHP", group: "Languages" },
  { name: "Ruby", group: "Languages" },
  { name: "R", group: "Languages" },
  { name: "Scala", group: "Languages" },
  { name: "Dart", group: "Languages" },

  // Frontend
  { name: "HTML", group: "Frontend", aliases: ["html5"] },
  { name: "CSS", group: "Frontend", aliases: ["css3"] },
  { name: "React", group: "Frontend", aliases: ["react.js", "reactjs", "react js"] },
  { name: "Next.js", group: "Frontend", aliases: ["nextjs", "next js"] },
  { name: "Angular", group: "Frontend", aliases: ["angularjs", "angular.js"] },
  { name: "Vue.js", group: "Frontend", aliases: ["vue", "vuejs", "vue js"] },
  { name: "Svelte", group: "Frontend", aliases: ["sveltekit"] },
  {
    name: "Tailwind CSS",
    group: "Frontend",
    aliases: ["tailwind", "tailwindcss", "tailwind css"],
  },
  { name: "Bootstrap", group: "Frontend" },
  { name: "Redux", group: "Frontend", aliases: ["redux toolkit"] },
  { name: "React Native", group: "Frontend", aliases: ["reactnative", "react-native"] },
  { name: "Flutter", group: "Frontend" },

  // Backend
  { name: "Node.js", group: "Backend", aliases: ["node", "nodejs", "node js"] },
  { name: "Express.js", group: "Backend", aliases: ["express", "expressjs"] },
  { name: "Django", group: "Backend" },
  { name: "Flask", group: "Backend" },
  { name: "FastAPI", group: "Backend", aliases: ["fast api"] },
  { name: "Spring Boot", group: "Backend", aliases: ["springboot", "spring"] },
  { name: ".NET", group: "Backend", aliases: ["dotnet", "asp.net", "aspnet"] },
  { name: "GraphQL", group: "Backend", aliases: ["graph ql"] },
  { name: "REST APIs", group: "Backend", aliases: ["rest", "rest api", "restful apis"] },
  { name: "Microservices", group: "Backend" },

  // Databases
  { name: "SQL", group: "Databases" },
  { name: "PostgreSQL", group: "Databases", aliases: ["postgres", "postgre sql"] },
  { name: "MySQL", group: "Databases", aliases: ["my sql"] },
  { name: "MongoDB", group: "Databases", aliases: ["mongo", "mongo db"] },
  { name: "Redis", group: "Databases" },
  { name: "SQLite", group: "Databases" },
  { name: "Prisma", group: "Databases" },
  { name: "Vector Databases", group: "Databases", aliases: ["vector db", "vectordb"] },
  { name: "ChromaDB", group: "Databases", aliases: ["chroma", "chroma db"] },
  { name: "Pinecone", group: "Databases" },

  // Data & AI
  { name: "Machine Learning", group: "Data & AI", aliases: ["ml"] },
  { name: "Deep Learning", group: "Data & AI", aliases: ["dl"] },
  { name: "Data Analysis", group: "Data & AI", aliases: ["data analytics"] },
  { name: "Data Science", group: "Data & AI" },
  { name: "Data Engineering", group: "Data & AI" },
  { name: "Pandas", group: "Data & AI" },
  { name: "NumPy", group: "Data & AI", aliases: ["num py"] },
  { name: "scikit-learn", group: "Data & AI", aliases: ["sklearn", "scikit learn"] },
  { name: "TensorFlow", group: "Data & AI", aliases: ["tensor flow"] },
  { name: "PyTorch", group: "Data & AI", aliases: ["py torch"] },
  { name: "NLP", group: "Data & AI", aliases: ["natural language processing"] },
  { name: "Computer Vision", group: "Data & AI", aliases: ["opencv"] },
  { name: "Generative AI", group: "Data & AI", aliases: ["gen ai", "genai"] },
  { name: "Prompt Engineering", group: "Data & AI", aliases: ["prompting"] },
  { name: "Context Engineering", group: "Data & AI" },
  {
    name: "Retrieval-Augmented Generation (RAG)",
    group: "Data & AI",
    aliases: ["rag", "retrieval augmented generation"],
  },
  { name: "Embeddings", group: "Data & AI" },
  { name: "AI Agents", group: "Data & AI", aliases: ["agentic ai", "ai agent"] },
  { name: "LangChain", group: "Data & AI", aliases: ["lang chain"] },
  { name: "Model Context Protocol (MCP)", group: "Data & AI", aliases: ["mcp"] },
  { name: "Fine-Tuning", group: "Data & AI", aliases: ["finetuning", "fine tuning"] },
  { name: "Claude", group: "Data & AI" },
  { name: "OpenAI API", group: "Data & AI", aliases: ["openai"] },
  { name: "Power BI", group: "Data & AI", aliases: ["powerbi", "power-bi"] },
  { name: "Tableau", group: "Data & AI" },
  { name: "Excel", group: "Data & AI", aliases: ["ms excel", "microsoft excel"] },
  { name: "Databricks", group: "Data & AI" },
  { name: "PySpark", group: "Data & AI", aliases: ["py spark"] },
  { name: "Apache Spark", group: "Data & AI", aliases: ["spark"] },

  // Cloud & DevOps
  { name: "AWS", group: "Cloud & DevOps", aliases: ["amazon web services"] },
  { name: "Azure", group: "Cloud & DevOps", aliases: ["microsoft azure"] },
  {
    name: "Google Cloud Platform",
    group: "Cloud & DevOps",
    aliases: ["gcp", "google cloud"],
  },
  { name: "Docker", group: "Cloud & DevOps" },
  { name: "Kubernetes", group: "Cloud & DevOps", aliases: ["k8s"] },
  { name: "CI/CD", group: "Cloud & DevOps", aliases: ["cicd", "ci cd"] },
  { name: "Linux", group: "Cloud & DevOps" },
  { name: "Terraform", group: "Cloud & DevOps" },

  // Tools
  { name: "Git", group: "Tools" },
  { name: "GitHub", group: "Tools", aliases: ["git hub"] },
  { name: "Postman", group: "Tools" },
  { name: "Jira", group: "Tools" },
  {
    name: "Data Structures & Algorithms",
    group: "Tools",
    aliases: ["dsa", "data structures and algorithms"],
  },

  // Design
  { name: "Figma", group: "Design" },
  { name: "UI/UX Design", group: "Design", aliases: ["ui ux", "uiux", "ui/ux"] },

  // Professional
  { name: "Problem Solving", group: "Professional" },
  { name: "Communication", group: "Professional" },
  { name: "Teamwork", group: "Professional" },
  { name: "Leadership", group: "Professional" },
  { name: "Project Management", group: "Professional" },
];

/** Plain names, for pickers that only need the list. */
export const CANONICAL_SKILL_NAMES: readonly string[] = CANONICAL_SKILLS.map(
  (s) => s.name,
);

/**
 * The handful shown as one-tap chips. Deliberately short — the full list is one
 * keystroke away in the search box, and twenty chips is a wall, not a shortcut.
 */
export const PROFILE_QUICK_SKILLS: readonly string[] = [
  "Python",
  "JavaScript",
  "React",
  "Node.js",
  "SQL",
  "Machine Learning",
  "Prompt Engineering",
  "Git",
];

/** name or alias (lower-cased) → canonical name. */
const BY_KEY = new Map<string, string>();
for (const skill of CANONICAL_SKILLS) {
  BY_KEY.set(skill.name.toLowerCase(), skill.name);
  for (const alias of skill.aliases ?? []) {
    BY_KEY.set(alias.toLowerCase(), skill.name);
  }
}

/** Letters and digits only, so "Tailwind CSS" and "tailwindcss" collide. */
function squash(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const BY_SQUASH = new Map<string, string>();
for (const [key, name] of BY_KEY) {
  const squashed = squash(key);
  if (squashed && !BY_SQUASH.has(squashed)) BY_SQUASH.set(squashed, name);
}

/**
 * Fold a typed skill onto its canonical spelling, or return it trimmed when the
 * catalog has never heard of it. This is what stops "tailwindcss" and
 * "Tailwind css" from becoming separate claims.
 */
export function canonicalSkillName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return (
    BY_KEY.get(trimmed.toLowerCase()) ?? BY_SQUASH.get(squash(trimmed)) ?? trimmed
  );
}

export function isCanonicalSkill(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return BY_KEY.has(trimmed.toLowerCase()) || BY_SQUASH.has(squash(trimmed));
}
