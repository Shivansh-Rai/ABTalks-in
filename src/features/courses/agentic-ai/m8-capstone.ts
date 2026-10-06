import type { CourseModule } from "../types";
import {
  h2,
  p,
  ul,
  ol,
  note,
  tip,
  warn,
  table,
  code,
  pseudo,
  visual,
  quiz,
  refs,
  exercise,
} from "../blocks";
import { R } from "../references";
import {
  M8_PREPPILOT_USER_FLOW,
  M8_PREPPILOT_END_TO_END_ARCHITECTURE,
  M8_PER_BRIEFING_TOKEN_BUDGET,
  M8_ONE_PREPPILOT_RUN_AS_THE_ORCHESTRATOR_SEES_IT,
} from "../assets/visuals/m8";

export const m8: CourseModule = {
  slug: "capstone",
  number: 8,
  title: "Capstone: Design an Agentic System",
  summary:
    "Put every module together: design, justify and stress-test a complete agentic system, from requirements to architecture, reliability, evaluation, cost and rollout.",
  minutes: 35,
  blocks: [
    h2("brief", "The brief"),
    p(
      "You are the engineer responsible for **PrepPilot**, an interview-preparation research agent for final-year students and recent graduates. A student enters a company and a role, *Backend Engineer, a fintech in Bengaluru*, and within a few minutes receives a **briefing**: what the company does and how it makes money, recent news worth knowing, the role's likely technical focus, the interview process as publicly reported, and a set of tailored practice questions linked to the student's own profile.",
    ),
    p(
      "This module walks through the design as a senior engineer would present it in a design review: problem, requirements, architecture, and then the decisions in each area with their trade-offs. Your capstone exercise is to produce the same document for a system of your choosing.",
    ),

    h2("problem", "Problem definition"),
    p(
      "Students preparing for interviews spend hours stitching together company pages, news, forum posts and job descriptions, often trusting outdated or unreliable sources. The goal is to compress that research into a trustworthy briefing, and to make the student's practice specific to the role.",
    ),
    ul(
      "**Why an agent?** Sources differ per company; what to search next depends on what was found (a recent acquisition changes what matters); the amount of research needed varies widely. The path cannot be scripted in advance.",
      "**Why not a pure agent?** The output has a fixed structure, costs must be bounded, and the student profile is sensitive. So: an agentic research step inside a workflow skeleton.",
      "**Non-goals.** No application submission, no contacting employees, no claims about salaries unless sourced, no guarantees about interview content.",
    ),

    h2("requirements", "Requirements"),
    table(
      ["Type", "Requirement"],
      [
        [
          "Functional",
          "Accept company + role (+ optional job description link); produce a structured briefing with cited sources; generate 10–15 practice questions tied to the role and the student's skills",
        ],
        [
          "Quality",
          "Every factual claim has a source; sources older than 12 months are flagged; unknowns are stated, not guessed",
        ],
        [
          "Latency",
          "First sections streamed within 20 s; full briefing within 3 minutes (p95)",
        ],
        ["Cost", "≤ ₹15 per briefing on average; hard cap ₹40"],
        [
          "Safety",
          "Read-only web access; no personal data about individual employees; student profile never leaves the system except as needed for question generation",
        ],
        [
          "Scale",
          "Peaks of ~2,000 briefings/day in placement season; cache by company+role",
        ],
        [
          "Operability",
          "Every run traced; degraded mode if search or news is unavailable",
        ],
      ],
    ),

    h2("flow", "User flow"),
    visual(
      "PrepPilot user flow",
      "Step through what the student experiences, and what the system does at each moment.",
      M8_PREPPILOT_USER_FLOW,
      "The user flow is itself a workflow; agentic behaviour lives inside *Research*. That split is the central architectural decision of this design.",
    ),

    h2("architecture", "Architecture"),
    p(
      "The complete system is below. Click any component to see its responsibility and design notes. Then run the scenarios, the happy path and three failures, to see how the parts cooperate.",
    ),
    visual(
      "PrepPilot, end-to-end architecture",
      "Click components to inspect them. Choose a scenario and step through it with **Start / Next**.",
      M8_PREPPILOT_END_TO_END_ARCHITECTURE,
      "Every component traces back to an earlier module: runtime and context (2), tools and validation (3), workflow skeleton and parallelism (4), supervisor-style workers (5), memory and retrieval (6), guardrails, resilience and observability (7).",
    ),

    h2("model", "Model choice"),
    p(
      "Two model tiers, chosen with an evaluation set rather than by reputation:",
    ),
    table(
      ["Role", "Model tier", "Why"],
      [
        [
          "Planner",
          "Capable",
          "One call per run; plan quality drives everything downstream",
        ],
        [
          "Research workers",
          "Fast",
          "Many calls; the task (search, read, extract claims) is narrow and verified afterwards",
        ],
        [
          "Composer",
          "Fast (or capable if evals show gains)",
          "Writes from verified claims; quality measured by rubric",
        ],
        [
          "Evaluator checks",
          "Mostly code; fast model for relevance",
          "Deterministic where possible",
        ],
      ],
    ),
    note(
      "Model identifiers live in configuration, and every trace records which model and prompt version produced each step, so a model change can be evaluated, rolled out gradually and rolled back.",
    ),

    h2("tools", "Tool design"),
    code(
      "json",
      "JSON, PrepPilot's tool surface (abridged)",
      `
[
  { "name": "web_search", "writes": false,
    "input_schema": { "query": "string ≤ 200", "recency_days": "int 1–730" },
    "returns": "≤ 8 results: title, url, snippet, published_at" },
  { "name": "fetch_page", "writes": false,
    "input_schema": { "url": "https URL; domain not on blocklist" },
    "returns": "extracted text ≤ 12k chars, title, published_at?" },
  { "name": "company_news", "writes": false,
    "input_schema": { "company": "string", "since": "date" },
    "returns": "≤ 15 items with dates; cached fallback marked as_of" },
  { "name": "kb_lookup", "writes": false,
    "input_schema": { "topic": "string" },
    "returns": "curated explanation passages for interview topics" }
]
`,
      "Four read-only tools. The absence of any write or messaging capability is the single most effective security decision in this design.",
    ),

    h2("context", "Context and memory"),
    p(
      "Each worker's context holds: short role instructions (~600 tokens), its sub-question and scope (~200), claims gathered so far (≤ 2,000), the latest trimmed tool result (≤ 3,000) and a summary of earlier steps (≤ 500). The composer gets verified claims only, never raw pages.",
    ),
    p("Memory is deliberately small:"),
    ul(
      "**Semantic (per student)**: declared skills, projects, target roles, editable by the student in their profile, used only for personalisation.",
      "**Episodic (per student)**: which briefings they generated and which questions they marked as practised, to avoid repetition.",
      "**Shared research cache (per company+role)**: verified claims with sources and dates, reused for 7 days. Contains no student data.",
      "**Never stored**: free-text notes the student types about personal circumstances, or anything about individual company employees.",
    ),

    h2("retrieval", "Retrieval"),
    p(
      "Retrieval serves two corpora: the research cache (hybrid search, filtered by company and freshness) and a curated knowledge base of interview-topic explanations used when generating practice questions. Retrieval recall is measured on a labelled set of 100 company/role queries; the reranker's top-4 is what reaches context.",
    ),

    h2("workflow", "Workflow"),
    pseudo(
      `
async def briefing(req, user):
    state = await store.resume_or_create(req, user)
    if cached := cache.fresh(req.company, req.role, max_age_days=7):
        state.claims = cached.claims
    else:
        state.plan = await planner(req, max_questions=6)                 # capable model
        results = await gather_bounded(
            [research(q, budget=state.budget.split(len(state.plan))) for q in state.plan],
            timeout=120)
        state.claims = verify(flatten(results))                          # grounding + freshness
        cache.put(req.company, req.role, state.claims)
    await store.checkpoint(state)

    sections = [compose(s, state.claims) async for s in SECTIONS]         # streamed
    questions = await personalise(req.role, state.claims, memory.profile(user))
    report = evaluator.check(sections, questions, state.claims)
    if not report.ok:
        sections = await regenerate_once(report.failed, state.claims)
    return deliver(sections, questions, open_issues=report.warnings)
`,
      "A deterministic skeleton with two bounded agentic stages (research, and to a lesser extent composition). Budgets are split across workers; the evaluator runs before delivery.",
    ),

    h2("guardrails", "Guardrails and reliability"),
    table(
      ["Risk", "Control", "Layer"],
      [
        [
          "Injection via web pages",
          "No side-effecting tools; untrusted content labelled; claims need sources",
          "Architecture + validation",
        ],
        [
          "Defamatory or false claims about companies",
          "Sensitive-claim policy (layoffs, lawsuits, finances) needs ≥ 2 reputable sources",
          "Evaluator",
        ],
        [
          "Personal data about employees",
          "Output classifier + instructions; named-individual claims dropped",
          "Output guard",
        ],
        [
          "Search / news outages",
          "Timeouts, retries, breakers, cached fallbacks with as_of dates",
          "Tool executor",
        ],
        [
          "Runaway cost",
          "Per-run cap, per-worker budgets, plan trimming",
          "Orchestrator",
        ],
        [
          "Stale information",
          "Freshness flags; cache TTL; dates on every claim",
          "Retrieval + composer",
        ],
        [
          "Profile misuse",
          "Profile used only in personalisation step; not sent to search",
          "Context builder",
        ],
      ],
    ),
    warn(
      'Sending the student\'s profile to the web-search tool (for "better" queries) would leak personal data to a third party. Personalisation happens only after research, on your own infrastructure.',
      "A subtle leak to avoid",
    ),

    h2("evaluation", "Evaluation"),
    ul(
      "**Offline set**: 150 company/role pairs across sectors and sizes, with reference facts and known pitfalls (recent acquisitions, rebrands, similarly named companies).",
      "**Automatic checks**: source coverage (every claim cited), grounding pass rate, freshness flagging accuracy, structure completeness, cost and latency.",
      "**Rubric grading** of section quality and question relevance by a calibrated model grader, with human review of a weekly sample.",
      "**Adversarial set**: injected pages, look-alike company names, requests about individuals.",
      "**Online signals**: *report an error* rate, questions marked useful, repeat usage.",
      "**Release gate**: no regression beyond tolerance on any metric before a prompt or model change ships.",
    ),

    h2("observability", "Observability"),
    p(
      "Every run produces a trace: plan, each worker's tool calls with durations and outcomes, verification decisions, evaluator scores, cost. Dashboards track p95 latency, cost per briefing, grounding failure rate, breaker states and error reports. Alerts fire on cost anomalies, breaker open for more than 10 minutes, and grounding failure spikes (often a sign of a changed source site or an injection campaign).",
    ),

    h2("cost", "Cost considerations"),
    p(
      "Estimate before building. The figures below are illustrative, substitute your provider's current prices.",
    ),
    visual(
      "Per-briefing token budget",
      "Adjust the budget (in thousands of tokens) and see which stages fit. This is the lever the orchestrator uses when a request is unusually large.",
      M8_PER_BRIEFING_TOKEN_BUDGET,
      "Caching by company+role is the biggest cost lever in practice: in placement season many students target the same companies, so research is shared while personalisation stays per student.",
    ),

    h2("failures", "Failure modes"),
    table(
      ["Failure", "Detection", "Response"],
      [
        [
          "Wrong company (name collision)",
          "Planner confirms with domain/HQ; evaluator checks consistency",
          "Ask the student to disambiguate",
        ],
        [
          "All sources stale",
          "Freshness metadata",
          "Deliver with prominent warning",
        ],
        [
          "Worker loops on search",
          "Repeat detector, per-worker budget",
          "Return partial claims",
        ],
        [
          "Grounding failures spike",
          "Metric alert",
          "Investigate source changes / injection; tighten domains",
        ],
        [
          "Evaluator too strict",
          "Rising incomplete rate in dashboards",
          "Calibrate thresholds against human review",
        ],
        [
          "Cache poisoning (a bad claim cached)",
          "Error reports on cached claims",
          "Invalidate company cache; add case to eval set",
        ],
      ],
    ),

    h2("scaling", "Scaling considerations"),
    ul(
      "**Queue-based execution**: runs are jobs on a queue with worker pools, so placement-season spikes add latency rather than failures; students see queue position.",
      "**Rate limits and quotas** per student and globally per external API; the breaker protects providers and your budget.",
      "**Cache warming**: pre-generate research for the most-targeted companies before each season.",
      "**Stateless workers, checkpointed state**: any worker can resume any run.",
      "**Provider fallback**: a second model provider configured for degraded operation, validated by the same evaluation set.",
    ),

    h2("plan", "Implementation plan"),
    ol(
      "**Week 1**: Requirements, evaluation set v1 (50 pairs), tool contracts, trace schema.",
      "**Week 2**: Single research agent + composer, no memory; measure against evals.",
      "**Week 3**: Workflow skeleton, parallel workers, verification, budgets, checkpoints.",
      "**Week 4**: Guardrails, resilience (timeouts, breakers, fallbacks), adversarial evals.",
      "**Week 5**: Personalisation with consented profile; memory; cache.",
      "**Week 6**: Observability dashboards, alerts, internal beta with 50 students; review traces daily.",
      "**Week 7+**: Gradual rollout; weekly eval review; add failure cases from production to the eval set.",
    ),
    tip(
      "Notice the order: evaluation and tracing come first, multi-worker orchestration comes after a single agent is measured, and personal data comes last, after guardrails exist.",
    ),

    h2("exec", "Step-by-step execution trace"),
    visual(
      "One PrepPilot run, as the orchestrator sees it",
      "Step through the run state.",
      M8_ONE_PREPPILOT_RUN_AS_THE_ORCHESTRATOR_SEES_IT,
      "Budgets and deadlines are tracked as first-class state, not discovered afterwards in a billing report.",
    ),

    h2("checklist", "Capstone checklist"),
    p("Use this to review your own design (and anyone else's):"),
    ul(
      "☐ Problem statement explains **why an agent** and why not something simpler.",
      "☐ Requirements include quality, latency, cost, safety, scale and operability targets.",
      "☐ Architecture diagram shows every component and its responsibility.",
      "☐ Workflow skeleton vs agentic steps is explicit and justified.",
      "☐ Every tool has a schema, read/write classification and approval tier.",
      "☐ Identity and permissions are enforced in code, never supplied by the model.",
      "☐ Context budgets per step; memory write policy with privacy rules.",
      "☐ Retrieval is measured separately (recall) from generation.",
      "☐ Timeouts, retries, breakers and fallbacks for every external dependency.",
      "☐ Prompt-injection analysis: worst-case outcome of a successful injection is acceptable.",
      "☐ Evaluation set with deterministic checks, calibrated graders and an adversarial subset; release gates.",
      "☐ Tracing, dashboards, alerts; failures flow back into the evaluation set.",
      "☐ Cost model with caps; failure-mode table; scaling plan; phased implementation plan.",
    ),

    h2("exercise", "Capstone exercise: your own system"),
    exercise({
      title: "Design review document",
      brief:
        "Pick a problem you care about (examples: a college-admissions help desk, a lab-report feedback agent, a small-business bookkeeping assistant, an open-source issue triager). Produce a design document with the same design sections used in this module (problem definition through implementation plan).",
      tasks: [
        "Write the problem definition, including an honest argument against using an agent.",
        "Draw the architecture (any tool) and label each component with its responsibility.",
        "Specify all tools with schemas, read/write classification and approval tiers.",
        "Define the context budget for your most important model call and your memory write policy.",
        "Complete a risk table (risk, control, layer) with at least six rows, including one prompt-injection path.",
        "Design an evaluation set of at least 20 cases (with 5 adversarial) and your release gate.",
        "Estimate cost per task and a monthly total at your expected volume.",
        "Trace one failure scenario through your architecture end to end.",
        "Review your design against the capstone checklist and list what you would simplify for a first release.",
      ],
      hints: [
        "The strongest designs remove capabilities rather than adding guards.",
        'If your evaluation set has no case where the right answer is "I don\'t know", add some.',
      ],
      model: [
        "A clear boundary between deterministic skeleton and agentic steps.",
        "Tools narrow enough that the risk table is short.",
        "Evaluation defined before implementation details.",
        "A first release that is noticeably simpler than the full design, with a plan to grow it based on evidence.",
      ],
    }),

    h2("quiz", "Final knowledge check"),
    quiz(
      {
        q: "In PrepPilot, why is research agentic but the overall flow a workflow?",
        options: [
          "Agents are always more accurate, so they are used where accuracy matters",
          "What to search next depends on findings (agentic), while the deliverable's structure, budget and stages are known in advance (workflow)",
          "Workflows cannot call models",
          "It is arbitrary",
        ],
        answer: 1,
        why: "Autonomy is granted only where the path must be discovered at runtime; the rest stays predictable and testable.",
      },
      {
        q: "A teammate proposes sending the student's profile to the web-search tool to make queries more specific. What is the main objection?",
        options: [
          "It increases token usage slightly",
          "It leaks personal data to a third-party service; personalisation should happen after research on your own infrastructure",
          "Search tools cannot accept long queries",
          "It would make the cache less effective, which is the only concern",
        ],
        answer: 1,
        why: "Data minimisation and trust boundaries: personal data should not flow to external tools that do not need it.",
      },
      {
        q: "The news API has been down for an hour. What should students experience in a well-designed PrepPilot?",
        options: [
          "An error page until the API recovers",
          "Very slow briefings as every request retries",
          "Briefings with cached news clearly marked with its date, delivered at normal speed",
          "Briefings that silently omit the news section",
        ],
        answer: 2,
        why: "Circuit breaker plus dated fallback gives fast, honest, degraded output rather than errors, slowness or silent gaps.",
      },
      {
        q: "An injected forum page persuades a worker to suggest emailing a CV to an unknown address. Why is the impact limited?",
        options: [
          "The model always detects injections",
          "The system has no messaging or email tools, and sensitive claims require multiple reputable sources",
          "Forum pages are never fetched",
          "The student would never follow the suggestion",
        ],
        answer: 1,
        why: "Capability minimisation and evidence policies bound the damage regardless of whether the model was fooled.",
      },
      {
        q: "After a model upgrade, grounding failures rise from 2% to 9% but user complaints have not yet increased. What should happen?",
        options: [
          "Nothing, since users have not complained",
          "Roll back or halt the rollout and investigate; the release gate or monitoring caught a regression before users noticed",
          "Disable the grounding check",
          "Increase the budget",
        ],
        answer: 1,
        why: "Leading indicators exist so you can act before users are harmed. Evaluation and monitoring are only useful if they gate decisions.",
      },
      {
        q: "Which implementation order best reflects the course's principles?",
        options: [
          "Multi-agent orchestration first, then evaluation later",
          "Personalisation with profile data first to impress users",
          "Evaluation set and tracing first; single agent; then workflow and parallelism; guardrails before personal data; gradual rollout",
          "Build everything at once and test at the end",
        ],
        answer: 2,
        why: "Measure first, start simple, add complexity with evidence, and put safety in place before handling sensitive data.",
      },
      {
        q: 'The evaluator marks many briefings "incomplete", but human reviewers rate most of them as good. What is the best next step?',
        options: [
          "Remove the evaluator",
          "Calibrate evaluator thresholds against the human judgements and add disagreements to the evaluation set",
          "Ignore the reviewers",
          "Increase regeneration attempts to 10",
        ],
        answer: 1,
        why: "Automated checks must be calibrated against human judgement; disagreements are exactly the cases that improve both.",
      },
    ),

    h2("next", "Where to go from here"),
    p(
      "You now have the complete mental model: when to use an agent, how to architect its runtime, how to build and test it, how to compose workflows and teams, how to manage context and memory, and how to make the whole thing reliable. The next step is practice, build the smallest honest version of your capstone, measure it, and let the evidence tell you what to add.",
    ),

    h2("references", "References and further reading"),
    refs(
      R.anthropicAgents,
      R.anthropicMultiAgent,
      R.react,
      R.rag,
      R.injection,
      R.owasp,
      R.otel,
      R.judge,
      R.swebench,
      R.nist,
    ),
  ],
};
