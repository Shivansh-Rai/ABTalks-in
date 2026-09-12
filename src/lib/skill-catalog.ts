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
 * THREE RULES, and they are the whole point of the file:
 *
 *  1. **One canonical spelling per skill**, written the way its own docs write
 *     it — "Tailwind CSS", not "Tailwindcss" or "tailwind css"; "scikit-learn",
 *     not "Scikit Learn"; "MATLAB", not "Matlab".
 *  2. **Aliases are how people actually type**, lower-cased: "k8s", "tf",
 *     "fea", "solid works". Punctuation and spacing are already handled by the
 *     squash pass below, so an alias only needs to exist where the letters
 *     themselves differ.
 *  3. **Every name is unique and every alias resolves to exactly one name.**
 *     `profile.test.ts` fails the build if that ever stops being true.
 *
 * Free text is still accepted through the "Other" path — this is the suggested
 * set, not a whitelist.
 */

export type SkillGroup =
  | "Languages"
  | "Frontend"
  | "Backend"
  | "Mobile"
  | "Databases"
  | "Data & AI"
  | "Cloud & DevOps"
  | "Security"
  | "Testing & QA"
  | "Systems"
  | "Tools"
  | "Design"
  | "Research"
  | "Mechanical Engineering"
  | "Electrical Engineering"
  | "Civil Engineering"
  | "Chemical Engineering"
  | "Industrial Engineering"
  | "Product & Business"
  | "Professional";

/** Display order — used wherever the catalog is shown grouped. */
export const SKILL_GROUPS: readonly SkillGroup[] = [
  "Languages",
  "Frontend",
  "Backend",
  "Mobile",
  "Databases",
  "Data & AI",
  "Cloud & DevOps",
  "Security",
  "Testing & QA",
  "Systems",
  "Tools",
  "Design",
  "Research",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Civil Engineering",
  "Chemical Engineering",
  "Industrial Engineering",
  "Product & Business",
  "Professional",
];

export type CanonicalSkill = {
  name: string;
  group: SkillGroup;
  /** Spellings that must fold onto `name`. Compared lower-cased. */
  aliases?: string[];
};

export const CANONICAL_SKILLS: readonly CanonicalSkill[] = [
  /* ── Languages ───────────────────────────────────────────────────────── */
  { name: "Python", group: "Languages", aliases: ["python3", "py"] },
  { name: "JavaScript", group: "Languages", aliases: ["js", "ecmascript", "es6"] },
  { name: "TypeScript", group: "Languages", aliases: ["ts"] },
  { name: "Java", group: "Languages", aliases: ["core java"] },
  { name: "C", group: "Languages", aliases: ["c language", "ansi c"] },
  { name: "C++", group: "Languages", aliases: ["cpp", "c plus plus"] },
  { name: "C#", group: "Languages", aliases: ["c sharp", "csharp"] },
  { name: "Go", group: "Languages", aliases: ["golang"] },
  { name: "Rust", group: "Languages" },
  { name: "Kotlin", group: "Languages" },
  { name: "Swift", group: "Languages" },
  { name: "PHP", group: "Languages" },
  { name: "Ruby", group: "Languages" },
  { name: "R", group: "Languages", aliases: ["r language"] },
  { name: "Scala", group: "Languages" },
  { name: "Dart", group: "Languages" },
  { name: "MATLAB", group: "Languages", aliases: ["matlab programming"] },
  { name: "Julia", group: "Languages" },
  { name: "Perl", group: "Languages" },
  { name: "Lua", group: "Languages" },
  { name: "Haskell", group: "Languages" },
  { name: "Elixir", group: "Languages" },
  { name: "Objective-C", group: "Languages", aliases: ["objc"] },
  { name: "Assembly", group: "Languages", aliases: ["asm", "assembly language"] },
  { name: "Bash", group: "Languages", aliases: ["bash scripting"] },
  { name: "Shell Scripting", group: "Languages", aliases: ["shell", "sh scripting"] },
  { name: "PowerShell", group: "Languages", aliases: ["power shell"] },
  { name: "Solidity", group: "Languages" },
  { name: "Fortran", group: "Languages" },
  { name: "Groovy", group: "Languages" },

  /* ── Frontend ────────────────────────────────────────────────────────── */
  { name: "HTML", group: "Frontend", aliases: ["html5"] },
  { name: "CSS", group: "Frontend", aliases: ["css3"] },
  { name: "React", group: "Frontend", aliases: ["react.js", "reactjs", "react js"] },
  { name: "Next.js", group: "Frontend", aliases: ["nextjs", "next js"] },
  { name: "Angular", group: "Frontend", aliases: ["angularjs", "angular.js"] },
  { name: "Vue.js", group: "Frontend", aliases: ["vue", "vuejs", "vue js"] },
  { name: "Svelte", group: "Frontend", aliases: ["sveltekit", "svelte kit"] },
  {
    name: "Tailwind CSS",
    group: "Frontend",
    aliases: ["tailwind", "tailwindcss", "tailwind css"],
  },
  { name: "Bootstrap", group: "Frontend" },
  { name: "Redux", group: "Frontend", aliases: ["redux toolkit", "rtk"] },
  { name: "Sass", group: "Frontend", aliases: ["scss"] },
  { name: "jQuery", group: "Frontend", aliases: ["jquery js"] },
  { name: "Webpack", group: "Frontend", aliases: ["web pack"] },
  { name: "Vite", group: "Frontend", aliases: ["vitejs"] },
  { name: "Astro", group: "Frontend", aliases: ["astrojs"] },
  { name: "Remix", group: "Frontend", aliases: ["remix run"] },
  { name: "Nuxt.js", group: "Frontend", aliases: ["nuxt", "nuxtjs"] },
  { name: "Material UI", group: "Frontend", aliases: ["mui", "material-ui"] },
  { name: "shadcn/ui", group: "Frontend", aliases: ["shadcn", "shad cn"] },
  { name: "Chakra UI", group: "Frontend", aliases: ["chakra"] },
  { name: "Three.js", group: "Frontend", aliases: ["threejs", "three js"] },
  { name: "D3.js", group: "Frontend", aliases: ["d3", "d3js"] },
  { name: "WebGL", group: "Frontend", aliases: ["web gl"] },
  { name: "Storybook", group: "Frontend", aliases: ["story book"] },
  { name: "Framer Motion", group: "Frontend", aliases: ["framer"] },
  { name: "Electron", group: "Frontend", aliases: ["electronjs"] },
  { name: "Web Accessibility", group: "Frontend", aliases: ["a11y", "wcag"] },
  { name: "Responsive Design", group: "Frontend", aliases: ["responsive web design"] },
  {
    name: "Progressive Web Apps",
    group: "Frontend",
    aliases: ["pwa", "progressive web app"],
  },
  { name: "Web Performance", group: "Frontend", aliases: ["core web vitals"] },

  /* ── Backend ─────────────────────────────────────────────────────────── */
  { name: "Node.js", group: "Backend", aliases: ["node", "nodejs", "node js"] },
  { name: "Express.js", group: "Backend", aliases: ["express", "expressjs"] },
  { name: "NestJS", group: "Backend", aliases: ["nest js", "nest"] },
  { name: "Django", group: "Backend" },
  {
    name: "Django REST Framework",
    group: "Backend",
    aliases: ["drf", "django rest"],
  },
  { name: "Flask", group: "Backend" },
  { name: "FastAPI", group: "Backend", aliases: ["fast api"] },
  { name: "Spring Boot", group: "Backend", aliases: ["springboot", "spring"] },
  { name: ".NET", group: "Backend", aliases: ["dotnet", "asp.net", "aspnet"] },
  { name: "ASP.NET Core", group: "Backend", aliases: ["asp net core"] },
  { name: "Laravel", group: "Backend" },
  { name: "Ruby on Rails", group: "Backend", aliases: ["rails", "ror"] },
  { name: "GraphQL", group: "Backend", aliases: ["graph ql"] },
  { name: "REST APIs", group: "Backend", aliases: ["rest", "rest api", "restful apis"] },
  { name: "tRPC", group: "Backend", aliases: ["trpc"] },
  { name: "gRPC", group: "Backend", aliases: ["grpc"] },
  { name: "WebSockets", group: "Backend", aliases: ["web sockets", "websocket"] },
  { name: "Socket.IO", group: "Backend", aliases: ["socketio", "socket io"] },
  { name: "Microservices", group: "Backend", aliases: ["micro services"] },
  { name: "Apache Kafka", group: "Backend", aliases: ["kafka"] },
  { name: "RabbitMQ", group: "Backend", aliases: ["rabbit mq"] },
  { name: "Celery", group: "Backend" },
  { name: "Nginx", group: "Backend", aliases: ["engine x"] },
  { name: "Serverless", group: "Backend", aliases: ["serverless functions"] },
  { name: "API Design", group: "Backend", aliases: ["api development"] },
  {
    name: "Authentication & Authorization",
    group: "Backend",
    aliases: ["auth", "authentication", "authorization"],
  },
  { name: "OAuth", group: "Backend", aliases: ["oauth2", "oauth 2.0"] },
  { name: "JWT", group: "Backend", aliases: ["json web token"] },
  { name: "Caching", group: "Backend", aliases: ["cache"] },
  {
    name: "Event-Driven Architecture",
    group: "Backend",
    aliases: ["event driven", "eda"],
  },

  /* ── Mobile ──────────────────────────────────────────────────────────── */
  {
    name: "Android Development",
    group: "Mobile",
    aliases: ["android", "android dev"],
  },
  { name: "iOS Development", group: "Mobile", aliases: ["ios", "ios dev"] },
  { name: "React Native", group: "Mobile", aliases: ["reactnative", "react-native"] },
  { name: "Flutter", group: "Mobile" },
  { name: "Jetpack Compose", group: "Mobile", aliases: ["compose"] },
  { name: "SwiftUI", group: "Mobile", aliases: ["swift ui"] },
  { name: "Expo", group: "Mobile" },
  { name: "Ionic", group: "Mobile" },
  { name: "Xamarin", group: "Mobile" },
  { name: "Android Studio", group: "Mobile" },

  /* ── Databases ───────────────────────────────────────────────────────── */
  { name: "SQL", group: "Databases", aliases: ["structured query language"] },
  { name: "PostgreSQL", group: "Databases", aliases: ["postgres", "postgre sql"] },
  { name: "MySQL", group: "Databases", aliases: ["my sql"] },
  { name: "MongoDB", group: "Databases", aliases: ["mongo", "mongo db"] },
  { name: "Redis", group: "Databases" },
  { name: "SQLite", group: "Databases", aliases: ["sq lite"] },
  { name: "Prisma", group: "Databases", aliases: ["prisma orm"] },
  { name: "Oracle Database", group: "Databases", aliases: ["oracle", "oracle db"] },
  {
    name: "Microsoft SQL Server",
    group: "Databases",
    aliases: ["sql server", "mssql", "ms sql"],
  },
  { name: "Cassandra", group: "Databases", aliases: ["apache cassandra"] },
  { name: "Neo4j", group: "Databases", aliases: ["neo 4j"] },
  { name: "DynamoDB", group: "Databases", aliases: ["dynamo db"] },
  { name: "Firebase", group: "Databases", aliases: ["firestore"] },
  { name: "Supabase", group: "Databases" },
  { name: "Elasticsearch", group: "Databases", aliases: ["elastic search", "elk"] },
  { name: "Snowflake", group: "Databases" },
  { name: "BigQuery", group: "Databases", aliases: ["big query"] },
  { name: "Vector Databases", group: "Databases", aliases: ["vector db", "vectordb"] },
  { name: "ChromaDB", group: "Databases", aliases: ["chroma", "chroma db"] },
  { name: "Pinecone", group: "Databases" },
  { name: "Weaviate", group: "Databases" },
  { name: "Qdrant", group: "Databases" },
  { name: "FAISS", group: "Databases" },
  { name: "Database Design", group: "Databases", aliases: ["db design", "schema design"] },
  { name: "Query Optimization", group: "Databases", aliases: ["sql tuning"] },
  { name: "Data Modeling", group: "Databases", aliases: ["data modelling"] },

  /* ── Data & AI ───────────────────────────────────────────────────────── */
  { name: "Machine Learning", group: "Data & AI", aliases: ["ml"] },
  { name: "Deep Learning", group: "Data & AI", aliases: ["dl", "neural networks"] },
  { name: "Data Analysis", group: "Data & AI", aliases: ["data analytics"] },
  { name: "Data Science", group: "Data & AI" },
  { name: "Data Engineering", group: "Data & AI" },
  { name: "Pandas", group: "Data & AI" },
  { name: "NumPy", group: "Data & AI", aliases: ["num py"] },
  { name: "SciPy", group: "Data & AI", aliases: ["sci py"] },
  { name: "scikit-learn", group: "Data & AI", aliases: ["sklearn", "scikit learn"] },
  { name: "TensorFlow", group: "Data & AI", aliases: ["tensor flow", "tf"] },
  { name: "PyTorch", group: "Data & AI", aliases: ["py torch", "torch"] },
  { name: "Keras", group: "Data & AI" },
  { name: "XGBoost", group: "Data & AI", aliases: ["xg boost"] },
  { name: "LightGBM", group: "Data & AI", aliases: ["light gbm"] },
  { name: "NLP", group: "Data & AI", aliases: ["natural language processing"] },
  { name: "Computer Vision", group: "Data & AI" },
  { name: "OpenCV", group: "Data & AI", aliases: ["open cv"] },
  { name: "spaCy", group: "Data & AI", aliases: ["spacy nlp"] },
  { name: "NLTK", group: "Data & AI" },
  {
    name: "Hugging Face Transformers",
    group: "Data & AI",
    aliases: ["hugging face", "huggingface", "transformers"],
  },
  { name: "Generative AI", group: "Data & AI", aliases: ["gen ai", "genai"] },
  { name: "Prompt Engineering", group: "Data & AI", aliases: ["prompting"] },
  { name: "Context Engineering", group: "Data & AI" },
  {
    name: "Retrieval-Augmented Generation (RAG)",
    group: "Data & AI",
    aliases: ["rag", "retrieval augmented generation"],
  },
  { name: "Embeddings", group: "Data & AI", aliases: ["vector embeddings"] },
  { name: "AI Agents", group: "Data & AI", aliases: ["agentic ai", "ai agent"] },
  { name: "LangChain", group: "Data & AI", aliases: ["lang chain"] },
  { name: "LangGraph", group: "Data & AI", aliases: ["lang graph"] },
  { name: "LlamaIndex", group: "Data & AI", aliases: ["llama index"] },
  { name: "Model Context Protocol (MCP)", group: "Data & AI", aliases: ["mcp"] },
  { name: "Fine-Tuning", group: "Data & AI", aliases: ["finetuning", "fine tuning"] },
  { name: "Claude", group: "Data & AI", aliases: ["anthropic claude"] },
  { name: "OpenAI API", group: "Data & AI", aliases: ["openai", "gpt api"] },
  { name: "Gemini API", group: "Data & AI", aliases: ["google gemini"] },
  { name: "Ollama", group: "Data & AI" },
  { name: "Stable Diffusion", group: "Data & AI", aliases: ["diffusion models"] },
  { name: "Reinforcement Learning", group: "Data & AI", aliases: ["rl"] },
  { name: "Time Series Analysis", group: "Data & AI", aliases: ["time series"] },
  { name: "Statistics", group: "Data & AI", aliases: ["stats"] },
  { name: "A/B Testing", group: "Data & AI", aliases: ["ab testing", "split testing"] },
  { name: "Feature Engineering", group: "Data & AI" },
  { name: "Model Evaluation", group: "Data & AI", aliases: ["model validation"] },
  { name: "MLOps", group: "Data & AI", aliases: ["ml ops"] },
  { name: "MLflow", group: "Data & AI", aliases: ["ml flow"] },
  { name: "Model Deployment", group: "Data & AI", aliases: ["model serving"] },
  { name: "Data Visualization", group: "Data & AI", aliases: ["data viz", "dataviz"] },
  { name: "Matplotlib", group: "Data & AI", aliases: ["mat plot lib"] },
  { name: "Seaborn", group: "Data & AI" },
  { name: "Plotly", group: "Data & AI" },
  { name: "Power BI", group: "Data & AI", aliases: ["powerbi", "power-bi"] },
  { name: "Tableau", group: "Data & AI" },
  { name: "Looker", group: "Data & AI", aliases: ["looker studio"] },
  { name: "Excel", group: "Data & AI", aliases: ["ms excel", "microsoft excel"] },
  { name: "Apache Airflow", group: "Data & AI", aliases: ["airflow"] },
  { name: "dbt", group: "Data & AI", aliases: ["data build tool"] },
  { name: "ETL", group: "Data & AI", aliases: ["etl pipelines", "elt"] },
  { name: "Data Warehousing", group: "Data & AI", aliases: ["data warehouse"] },
  { name: "Apache Spark", group: "Data & AI", aliases: ["spark"] },
  { name: "PySpark", group: "Data & AI", aliases: ["py spark"] },
  { name: "Hadoop", group: "Data & AI", aliases: ["apache hadoop"] },
  { name: "Hive", group: "Data & AI", aliases: ["apache hive"] },
  { name: "Databricks", group: "Data & AI" },
  { name: "Jupyter", group: "Data & AI", aliases: ["jupyter notebook"] },
  { name: "Recommender Systems", group: "Data & AI", aliases: ["recommendation systems"] },
  { name: "Speech Recognition", group: "Data & AI", aliases: ["asr", "speech to text"] },
  { name: "Anomaly Detection", group: "Data & AI" },
  { name: "Predictive Modeling", group: "Data & AI", aliases: ["predictive modelling"] },
  { name: "Big Data", group: "Data & AI" },
  { name: "Data Cleaning", group: "Data & AI", aliases: ["data wrangling"] },
  { name: "Data Mining", group: "Data & AI" },

  /* ── Cloud & DevOps ──────────────────────────────────────────────────── */
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
  { name: "Linux", group: "Cloud & DevOps", aliases: ["gnu linux"] },
  { name: "Terraform", group: "Cloud & DevOps" },
  { name: "GitHub Actions", group: "Cloud & DevOps", aliases: ["gh actions"] },
  { name: "Jenkins", group: "Cloud & DevOps" },
  { name: "GitLab CI", group: "Cloud & DevOps", aliases: ["gitlab ci/cd"] },
  { name: "Ansible", group: "Cloud & DevOps" },
  { name: "Helm", group: "Cloud & DevOps" },
  { name: "Prometheus", group: "Cloud & DevOps" },
  { name: "Grafana", group: "Cloud & DevOps" },
  { name: "Vercel", group: "Cloud & DevOps" },
  { name: "Netlify", group: "Cloud & DevOps" },
  { name: "Cloudflare", group: "Cloud & DevOps", aliases: ["cloud flare"] },
  { name: "Heroku", group: "Cloud & DevOps" },
  {
    name: "Infrastructure as Code",
    group: "Cloud & DevOps",
    aliases: ["iac"],
  },
  { name: "Observability", group: "Cloud & DevOps", aliases: ["monitoring"] },
  {
    name: "Site Reliability Engineering",
    group: "Cloud & DevOps",
    aliases: ["sre"],
  },
  { name: "Cloud Architecture", group: "Cloud & DevOps", aliases: ["cloud design"] },
  { name: "Load Balancing", group: "Cloud & DevOps" },

  /* ── Security ────────────────────────────────────────────────────────── */
  { name: "Cybersecurity", group: "Security", aliases: ["cyber security", "infosec"] },
  { name: "Penetration Testing", group: "Security", aliases: ["pentesting", "pen testing"] },
  { name: "Network Security", group: "Security" },
  { name: "Application Security", group: "Security", aliases: ["appsec"] },
  { name: "Cryptography", group: "Security", aliases: ["crypto", "encryption"] },
  { name: "OWASP Top 10", group: "Security", aliases: ["owasp"] },
  { name: "Ethical Hacking", group: "Security" },
  { name: "Burp Suite", group: "Security", aliases: ["burpsuite"] },
  { name: "Wireshark", group: "Security" },
  { name: "Metasploit", group: "Security" },
  { name: "Nmap", group: "Security" },
  { name: "SIEM", group: "Security", aliases: ["splunk"] },
  { name: "Incident Response", group: "Security" },
  { name: "Digital Forensics", group: "Security", aliases: ["forensics"] },
  { name: "Malware Analysis", group: "Security" },
  {
    name: "Identity & Access Management",
    group: "Security",
    aliases: ["iam", "identity management"],
  },
  { name: "Vulnerability Assessment", group: "Security", aliases: ["vapt"] },
  { name: "Threat Modeling", group: "Security", aliases: ["threat modelling"] },
  { name: "Secure Code Review", group: "Security" },
  { name: "ISO 27001", group: "Security", aliases: ["iso27001"] },

  /* ── Testing & QA ────────────────────────────────────────────────────── */
  { name: "Unit Testing", group: "Testing & QA" },
  { name: "Integration Testing", group: "Testing & QA" },
  { name: "Test Automation", group: "Testing & QA", aliases: ["automation testing"] },
  { name: "Jest", group: "Testing & QA" },
  { name: "Vitest", group: "Testing & QA" },
  { name: "Pytest", group: "Testing & QA", aliases: ["py test"] },
  { name: "JUnit", group: "Testing & QA", aliases: ["j unit"] },
  { name: "Selenium", group: "Testing & QA" },
  { name: "Cypress", group: "Testing & QA" },
  { name: "Playwright", group: "Testing & QA" },
  { name: "JMeter", group: "Testing & QA", aliases: ["apache jmeter"] },
  { name: "API Testing", group: "Testing & QA" },
  { name: "Manual Testing", group: "Testing & QA" },
  { name: "Performance Testing", group: "Testing & QA", aliases: ["load testing"] },
  {
    name: "Test-Driven Development",
    group: "Testing & QA",
    aliases: ["tdd", "test driven development"],
  },

  /* ── Systems ─────────────────────────────────────────────────────────── */
  {
    name: "Data Structures & Algorithms",
    group: "Systems",
    aliases: ["dsa", "data structures and algorithms", "algorithms"],
  },
  { name: "Operating Systems", group: "Systems", aliases: ["os"] },
  { name: "Computer Networks", group: "Systems", aliases: ["networking"] },
  { name: "TCP/IP", group: "Systems", aliases: ["tcp ip"] },
  { name: "Distributed Systems", group: "Systems" },
  { name: "System Design", group: "Systems", aliases: ["systems design"] },
  { name: "Computer Architecture", group: "Systems" },
  { name: "Parallel Computing", group: "Systems", aliases: ["parallel programming"] },
  { name: "CUDA", group: "Systems", aliases: ["gpu programming"] },
  { name: "Compilers", group: "Systems", aliases: ["compiler design"] },
  { name: "Concurrency", group: "Systems", aliases: ["multithreading"] },
  { name: "Virtualization", group: "Systems", aliases: ["vmware"] },
  { name: "Embedded Linux", group: "Systems" },
  { name: "Real-Time Systems", group: "Systems", aliases: ["real time systems"] },

  /* ── Tools ───────────────────────────────────────────────────────────── */
  { name: "Git", group: "Tools", aliases: ["version control"] },
  { name: "GitHub", group: "Tools", aliases: ["git hub"] },
  { name: "GitLab", group: "Tools", aliases: ["git lab"] },
  { name: "Bitbucket", group: "Tools", aliases: ["bit bucket"] },
  { name: "Postman", group: "Tools" },
  { name: "Jira", group: "Tools" },
  { name: "Confluence", group: "Tools" },
  { name: "Notion", group: "Tools" },
  { name: "VS Code", group: "Tools", aliases: ["vscode", "visual studio code"] },
  { name: "Trello", group: "Tools" },

  /* ── Design ──────────────────────────────────────────────────────────── */
  { name: "Figma", group: "Design" },
  { name: "Adobe XD", group: "Design", aliases: ["xd"] },
  { name: "Sketch", group: "Design" },
  { name: "Photoshop", group: "Design", aliases: ["adobe photoshop", "ps"] },
  { name: "Illustrator", group: "Design", aliases: ["adobe illustrator"] },
  { name: "After Effects", group: "Design", aliases: ["adobe after effects"] },
  { name: "Canva", group: "Design" },
  { name: "Blender", group: "Design" },
  { name: "UI/UX Design", group: "Design", aliases: ["ui ux", "uiux", "ui/ux"] },
  { name: "Wireframing", group: "Design", aliases: ["wireframes"] },
  { name: "Prototyping", group: "Design" },
  { name: "Design Systems", group: "Design" },
  { name: "User Research", group: "Design" },
  { name: "Usability Testing", group: "Design" },
  { name: "Interaction Design", group: "Design", aliases: ["ixd"] },
  { name: "Visual Design", group: "Design" },
  { name: "Typography", group: "Design" },
  { name: "Motion Design", group: "Design", aliases: ["motion graphics"] },
  { name: "Information Architecture", group: "Design" },

  /* ── Research ────────────────────────────────────────────────────────── */
  { name: "Research Methodology", group: "Research", aliases: ["research methods"] },
  { name: "Literature Review", group: "Research", aliases: ["lit review"] },
  { name: "Systematic Review", group: "Research" },
  { name: "Meta-Analysis", group: "Research", aliases: ["meta analysis"] },
  { name: "Academic Writing", group: "Research" },
  { name: "Technical Writing", group: "Research", aliases: ["tech writing"] },
  { name: "Scientific Writing", group: "Research" },
  { name: "Experimental Design", group: "Research", aliases: ["design of experiments", "doe"] },
  { name: "Hypothesis Testing", group: "Research" },
  { name: "Quantitative Research", group: "Research" },
  { name: "Qualitative Research", group: "Research" },
  { name: "Survey Design", group: "Research", aliases: ["questionnaire design"] },
  { name: "Data Collection", group: "Research" },
  { name: "Statistical Analysis", group: "Research" },
  { name: "SPSS", group: "Research", aliases: ["ibm spss"] },
  { name: "Stata", group: "Research" },
  { name: "SAS", group: "Research" },
  { name: "LaTeX", group: "Research", aliases: ["latex typesetting"] },
  { name: "Zotero", group: "Research" },
  { name: "Mendeley", group: "Research" },
  { name: "EndNote", group: "Research", aliases: ["end note"] },
  { name: "Grant Writing", group: "Research", aliases: ["proposal writing"] },
  { name: "Peer Review", group: "Research" },
  { name: "Research Ethics", group: "Research" },
  { name: "Scientific Computing", group: "Research" },
  { name: "Simulation & Modeling", group: "Research", aliases: ["simulation", "modelling"] },
  { name: "Patent Research", group: "Research", aliases: ["patent search"] },
  { name: "Bibliometrics", group: "Research" },
  { name: "Thesis Writing", group: "Research", aliases: ["dissertation"] },
  { name: "Laboratory Techniques", group: "Research", aliases: ["lab techniques"] },

  /* ── Mechanical Engineering ──────────────────────────────────────────── */
  { name: "AutoCAD", group: "Mechanical Engineering", aliases: ["auto cad"] },
  { name: "SolidWorks", group: "Mechanical Engineering", aliases: ["solid works"] },
  { name: "CATIA", group: "Mechanical Engineering" },
  { name: "Fusion 360", group: "Mechanical Engineering", aliases: ["autodesk fusion"] },
  { name: "Creo", group: "Mechanical Engineering", aliases: ["ptc creo", "pro engineer"] },
  { name: "Siemens NX", group: "Mechanical Engineering", aliases: ["unigraphics"] },
  { name: "ANSYS", group: "Mechanical Engineering" },
  { name: "Abaqus", group: "Mechanical Engineering" },
  {
    name: "Finite Element Analysis",
    group: "Mechanical Engineering",
    aliases: ["fea", "finite element method", "fem"],
  },
  {
    name: "Computational Fluid Dynamics",
    group: "Mechanical Engineering",
    aliases: ["cfd"],
  },
  { name: "Thermodynamics", group: "Mechanical Engineering" },
  { name: "Fluid Mechanics", group: "Mechanical Engineering" },
  { name: "Heat Transfer", group: "Mechanical Engineering" },
  { name: "Machine Design", group: "Mechanical Engineering" },
  { name: "Mechanics of Materials", group: "Mechanical Engineering", aliases: ["strength of materials"] },
  { name: "GD&T", group: "Mechanical Engineering", aliases: ["geometric dimensioning and tolerancing"] },
  { name: "CNC Machining", group: "Mechanical Engineering", aliases: ["cnc"] },
  { name: "3D Printing", group: "Mechanical Engineering", aliases: ["additive manufacturing"] },
  { name: "CAM", group: "Mechanical Engineering", aliases: ["computer aided manufacturing"] },
  { name: "Mechatronics", group: "Mechanical Engineering" },
  { name: "HVAC", group: "Mechanical Engineering", aliases: ["heating ventilation and air conditioning"] },
  { name: "Manufacturing Processes", group: "Mechanical Engineering" },
  { name: "Vibration Analysis", group: "Mechanical Engineering" },
  { name: "Sheet Metal Design", group: "Mechanical Engineering" },
  { name: "Product Design", group: "Mechanical Engineering" },
  { name: "Rapid Prototyping", group: "Mechanical Engineering" },

  /* ── Electrical Engineering ──────────────────────────────────────────── */
  { name: "Circuit Design", group: "Electrical Engineering", aliases: ["circuit analysis"] },
  { name: "PCB Design", group: "Electrical Engineering", aliases: ["pcb layout"] },
  { name: "Altium Designer", group: "Electrical Engineering", aliases: ["altium"] },
  { name: "KiCad", group: "Electrical Engineering", aliases: ["ki cad"] },
  { name: "Embedded C", group: "Electrical Engineering" },
  { name: "Embedded Systems", group: "Electrical Engineering" },
  { name: "Microcontrollers", group: "Electrical Engineering", aliases: ["mcu", "8051"] },
  { name: "Arduino", group: "Electrical Engineering" },
  { name: "Raspberry Pi", group: "Electrical Engineering", aliases: ["rpi"] },
  { name: "ESP32", group: "Electrical Engineering", aliases: ["esp 32"] },
  { name: "STM32", group: "Electrical Engineering", aliases: ["stm 32"] },
  { name: "FPGA", group: "Electrical Engineering" },
  { name: "VHDL", group: "Electrical Engineering" },
  { name: "Verilog", group: "Electrical Engineering" },
  { name: "SystemVerilog", group: "Electrical Engineering", aliases: ["system verilog"] },
  { name: "VLSI Design", group: "Electrical Engineering", aliases: ["vlsi"] },
  { name: "Cadence Virtuoso", group: "Electrical Engineering", aliases: ["cadence"] },
  { name: "Xilinx Vivado", group: "Electrical Engineering", aliases: ["vivado"] },
  { name: "Signal Processing", group: "Electrical Engineering" },
  {
    name: "Digital Signal Processing",
    group: "Electrical Engineering",
    aliases: ["dsp"],
  },
  { name: "Control Systems", group: "Electrical Engineering" },
  { name: "Power Electronics", group: "Electrical Engineering" },
  { name: "Power Systems", group: "Electrical Engineering" },
  { name: "Internet of Things", group: "Electrical Engineering", aliases: ["iot"] },
  { name: "RTOS", group: "Electrical Engineering", aliases: ["real time operating system"] },
  { name: "Simulink", group: "Electrical Engineering", aliases: ["matlab simulink"] },
  { name: "LabVIEW", group: "Electrical Engineering", aliases: ["lab view"] },
  { name: "Analog Electronics", group: "Electrical Engineering" },
  { name: "Digital Electronics", group: "Electrical Engineering" },
  { name: "Robotics", group: "Electrical Engineering" },
  { name: "ROS", group: "Electrical Engineering", aliases: ["robot operating system"] },
  { name: "PLC Programming", group: "Electrical Engineering", aliases: ["plc"] },
  { name: "SCADA", group: "Electrical Engineering" },
  { name: "Sensors & Actuators", group: "Electrical Engineering", aliases: ["sensors"] },
  { name: "Motor Control", group: "Electrical Engineering" },
  { name: "Battery Management Systems", group: "Electrical Engineering", aliases: ["bms"] },
  { name: "RF Engineering", group: "Electrical Engineering", aliases: ["radio frequency"] },
  { name: "Antenna Design", group: "Electrical Engineering" },
  { name: "Electrical Machines", group: "Electrical Engineering" },
  { name: "Renewable Energy Systems", group: "Electrical Engineering", aliases: ["solar pv"] },

  /* ── Civil Engineering ───────────────────────────────────────────────── */
  { name: "AutoCAD Civil 3D", group: "Civil Engineering", aliases: ["civil 3d"] },
  { name: "STAAD.Pro", group: "Civil Engineering", aliases: ["staad pro", "staad"] },
  { name: "ETABS", group: "Civil Engineering", aliases: ["e tabs"] },
  { name: "SAP2000", group: "Civil Engineering", aliases: ["sap 2000"] },
  { name: "Revit", group: "Civil Engineering", aliases: ["autodesk revit"] },
  {
    name: "Building Information Modeling",
    group: "Civil Engineering",
    aliases: ["bim"],
  },
  { name: "Structural Analysis", group: "Civil Engineering" },
  { name: "Structural Design", group: "Civil Engineering" },
  { name: "Reinforced Concrete Design", group: "Civil Engineering", aliases: ["rcc design"] },
  { name: "Steel Structures", group: "Civil Engineering", aliases: ["steel design"] },
  { name: "Geotechnical Engineering", group: "Civil Engineering", aliases: ["soil mechanics"] },
  { name: "Surveying", group: "Civil Engineering", aliases: ["land surveying", "total station"] },
  { name: "Construction Management", group: "Civil Engineering" },
  { name: "Primavera P6", group: "Civil Engineering", aliases: ["primavera"] },
  { name: "Microsoft Project", group: "Civil Engineering", aliases: ["ms project"] },
  { name: "Quantity Surveying", group: "Civil Engineering", aliases: ["estimation and costing"] },
  { name: "Transportation Engineering", group: "Civil Engineering", aliases: ["highway engineering"] },
  { name: "Environmental Engineering", group: "Civil Engineering" },
  { name: "Water Resources Engineering", group: "Civil Engineering", aliases: ["hydrology"] },
  { name: "Concrete Technology", group: "Civil Engineering" },
  { name: "Earthquake Engineering", group: "Civil Engineering", aliases: ["seismic design"] },

  /* ── Chemical Engineering ────────────────────────────────────────────── */
  { name: "Aspen Plus", group: "Chemical Engineering", aliases: ["aspen"] },
  { name: "Aspen HYSYS", group: "Chemical Engineering", aliases: ["hysys"] },
  { name: "Process Simulation", group: "Chemical Engineering" },
  { name: "Process Design", group: "Chemical Engineering" },
  { name: "Process Control", group: "Chemical Engineering" },
  { name: "Mass Transfer", group: "Chemical Engineering" },
  { name: "Reaction Engineering", group: "Chemical Engineering", aliases: ["chemical reaction engineering"] },
  { name: "Distillation", group: "Chemical Engineering" },
  { name: "P&ID", group: "Chemical Engineering", aliases: ["piping and instrumentation diagram"] },
  { name: "HAZOP", group: "Chemical Engineering", aliases: ["hazard and operability study"] },
  { name: "Process Safety", group: "Chemical Engineering", aliases: ["safety engineering"] },
  { name: "Unit Operations", group: "Chemical Engineering" },
  { name: "Polymer Science", group: "Chemical Engineering", aliases: ["polymers"] },
  { name: "Process Optimization", group: "Chemical Engineering" },
  { name: "Bioprocess Engineering", group: "Chemical Engineering" },

  /* ── Industrial Engineering ──────────────────────────────────────────── */
  { name: "Lean Manufacturing", group: "Industrial Engineering", aliases: ["lean"] },
  { name: "Six Sigma", group: "Industrial Engineering", aliases: ["6 sigma", "dmaic"] },
  { name: "Quality Control", group: "Industrial Engineering", aliases: ["qc"] },
  { name: "Quality Assurance", group: "Industrial Engineering", aliases: ["qa"] },
  { name: "Supply Chain Management", group: "Industrial Engineering", aliases: ["supply chain", "scm"] },
  { name: "Operations Research", group: "Industrial Engineering", aliases: ["or"] },
  { name: "Kaizen", group: "Industrial Engineering" },
  { name: "5S", group: "Industrial Engineering", aliases: ["five s"] },
  { name: "Value Stream Mapping", group: "Industrial Engineering", aliases: ["vsm"] },
  { name: "Root Cause Analysis", group: "Industrial Engineering", aliases: ["rca"] },
  { name: "Production Planning", group: "Industrial Engineering" },
  { name: "Inventory Management", group: "Industrial Engineering" },
  { name: "Total Quality Management", group: "Industrial Engineering", aliases: ["tqm"] },
  { name: "ISO 9001", group: "Industrial Engineering", aliases: ["iso9001"] },
  { name: "Industrial Automation", group: "Industrial Engineering" },
  { name: "Ergonomics", group: "Industrial Engineering" },
  { name: "Process Improvement", group: "Industrial Engineering" },
  { name: "Logistics", group: "Industrial Engineering" },
  { name: "FMEA", group: "Industrial Engineering", aliases: ["failure mode and effects analysis"] },
  { name: "Statistical Process Control", group: "Industrial Engineering", aliases: ["spc"] },

  /* ── Product & Business ──────────────────────────────────────────────── */
  { name: "Agile", group: "Product & Business", aliases: ["agile methodology"] },
  { name: "Scrum", group: "Product & Business" },
  { name: "Kanban", group: "Product & Business" },
  { name: "Product Management", group: "Product & Business", aliases: ["product owner"] },
  { name: "Product Strategy", group: "Product & Business" },
  { name: "Roadmapping", group: "Product & Business", aliases: ["product roadmap"] },
  { name: "Business Analysis", group: "Product & Business", aliases: ["business analyst"] },
  { name: "Requirements Gathering", group: "Product & Business", aliases: ["requirement analysis"] },
  { name: "Stakeholder Management", group: "Product & Business" },
  { name: "Market Research", group: "Product & Business" },
  { name: "Competitive Analysis", group: "Product & Business" },
  { name: "User Stories", group: "Product & Business" },
  { name: "Go-to-Market Strategy", group: "Product & Business", aliases: ["gtm"] },
  { name: "SEO", group: "Product & Business", aliases: ["search engine optimization"] },
  { name: "Digital Marketing", group: "Product & Business" },
  { name: "Customer Discovery", group: "Product & Business" },
  { name: "Financial Modeling", group: "Product & Business", aliases: ["financial modelling"] },
  { name: "Entrepreneurship", group: "Product & Business", aliases: ["startups"] },

  /* ── Professional ────────────────────────────────────────────────────── */
  { name: "Problem Solving", group: "Professional" },
  { name: "Communication", group: "Professional" },
  { name: "Teamwork", group: "Professional", aliases: ["collaboration"] },
  { name: "Leadership", group: "Professional" },
  { name: "Project Management", group: "Professional", aliases: ["pm"] },
  { name: "Critical Thinking", group: "Professional" },
  { name: "Time Management", group: "Professional" },
  { name: "Adaptability", group: "Professional" },
  { name: "Mentoring", group: "Professional", aliases: ["coaching"] },
  { name: "Public Speaking", group: "Professional" },
  { name: "Presentation Skills", group: "Professional" },
  { name: "Analytical Thinking", group: "Professional" },
  { name: "Attention to Detail", group: "Professional" },
  { name: "Documentation", group: "Professional" },
  { name: "Client Management", group: "Professional", aliases: ["stakeholder communication"] },
  { name: "Creativity", group: "Professional" },
  { name: "Decision Making", group: "Professional" },
  { name: "Conflict Resolution", group: "Professional" },
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

/**
 * What the dropdown offers before anything is typed. The catalog is far too
 * long to dump in full, and an alphabetical first-forty is not a suggestion —
 * this is a spread across the areas the platform actually serves.
 */
export const POPULAR_SKILLS: readonly string[] = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "C++",
  "React",
  "Next.js",
  "Tailwind CSS",
  "Node.js",
  "Django",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "Machine Learning",
  "Deep Learning",
  "Data Analysis",
  "Generative AI",
  "Prompt Engineering",
  "AI Agents",
  "AWS",
  "Docker",
  "Kubernetes",
  "Git",
  "Linux",
  "Data Structures & Algorithms",
  "System Design",
  "Android Development",
  "Cybersecurity",
  "Figma",
  "UI/UX Design",
  "AutoCAD",
  "SolidWorks",
  "MATLAB",
  "Embedded Systems",
  "Research Methodology",
  "Technical Writing",
  "Six Sigma",
  "Agile",
  "Problem Solving",
  "Communication",
];

/** name or alias (lower-cased) → canonical name. */
const BY_KEY = new Map<string, string>();
/** canonical name (lower-cased) → entry, for group lookups. */
const BY_NAME = new Map<string, CanonicalSkill>();
for (const skill of CANONICAL_SKILLS) {
  BY_KEY.set(skill.name.toLowerCase(), skill.name);
  BY_NAME.set(skill.name.toLowerCase(), skill);
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

/** The catalog entry behind a name or alias, for its group. */
export function canonicalSkillEntry(raw: string): CanonicalSkill | null {
  const name = canonicalSkillName(raw);
  if (!name) return null;
  return BY_NAME.get(name.toLowerCase()) ?? null;
}

/** The group a skill belongs to, or null for free text the catalog lacks. */
export function skillGroupOf(raw: string): SkillGroup | null {
  return canonicalSkillEntry(raw)?.group ?? null;
}

/**
 * How well `entry` answers `q`. Lower is better; null means no match.
 *
 * The ladder matters more than it looks: typing "java" must put Java above
 * JavaScript, and typing "k8s" — which appears in no name at all — must still
 * find Kubernetes. Aliases therefore rank below names but above a substring
 * hit buried in the middle of some longer name.
 */
function rankSkill(entry: CanonicalSkill, q: string, qSquash: string): number | null {
  const name = entry.name.toLowerCase();
  const nameSquash = squash(entry.name);
  const aliases = entry.aliases ?? [];

  if (name === q || nameSquash === qSquash) return 0;
  // An exact alias beats a name that merely starts with the query: someone
  // typing "ml" means Machine Learning, not MLOps, and "fea" means Finite
  // Element Analysis, not Feature Engineering.
  for (const alias of aliases) {
    if (alias === q || squash(alias) === qSquash) return 1;
  }
  if (name.startsWith(q) || nameSquash.startsWith(qSquash)) return 2;
  for (const alias of aliases) {
    if (alias.startsWith(q) || squash(alias).startsWith(qSquash)) return 3;
  }
  if (name.includes(q)) return 4;
  for (const alias of aliases) {
    if (alias.includes(q)) return 5;
  }
  // Last resort, and only for a real word: the group itself. In a catalog this
  // wide, "civil" or "research" is how someone browses a field they know the
  // shape of but not the tool names in.
  if (q.length >= 4 && entry.group.toLowerCase().includes(q)) return 6;
  return null;
}

export type SkillSearchHit = {
  name: string;
  group: SkillGroup;
};

/**
 * Alias-aware search over the catalog. This is what both the Skills picker and
 * the project Tech stack field type against, so "k8s", "tailwindcss" and "fea"
 * all land on the properly spelled entry rather than on nothing.
 *
 * An empty query returns the popular spread rather than 450 rows.
 */
export function searchCanonicalSkills(query: string, limit = 20): SkillSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return POPULAR_SKILLS.slice(0, limit).flatMap((name) => {
      const entry = BY_NAME.get(name.toLowerCase());
      return entry ? [{ name: entry.name, group: entry.group }] : [];
    });
  }

  const qSquash = squash(q);
  const scored: { entry: CanonicalSkill; rank: number }[] = [];
  for (const entry of CANONICAL_SKILLS) {
    const rank = rankSkill(entry, q, qSquash);
    if (rank !== null) scored.push({ entry, rank });
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.entry.name.length !== b.entry.name.length) {
      return a.entry.name.length - b.entry.name.length;
    }
    return a.entry.name.localeCompare(b.entry.name);
  });

  return scored
    .slice(0, limit)
    .map(({ entry }) => ({ name: entry.name, group: entry.group }));
}

/** Names only — the shape `PwSuggest` and `PwTags` want. */
export function searchCanonicalSkillNames(query: string, limit = 20): string[] {
  return searchCanonicalSkills(query, limit).map((hit) => hit.name);
}
