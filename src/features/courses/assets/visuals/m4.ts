import type {
  ArchitectureVisual,
  CompareVisual,
  FlowVisual,
  SequenceVisual,
} from "../../types";

/** Diagram data for Agentic AI module 4. Reusable anywhere: pass to `visual()` or `<Visual config>`. */

/** Sequential chain with gates */
export const M4_SEQUENTIAL_CHAIN_WITH_GATES: FlowVisual = {
  kind: "flow",
  steps: [
    {
      label: "Parse résumé",
      detail:
        "Model extracts structured fields (education, skills, experience) using a strict output schema.",
    },
    {
      label: "Gate: valid?",
      detail:
        "Code checks the schema and sanity rules, graduation year plausible, at least one skill. On failure: retry once, then flag for manual parsing.",
      tone: "accent",
    },
    {
      label: "Screen",
      detail:
        "Model compares parsed fields with the role's must-haves and returns a score and reasons.",
    },
    {
      label: "Gate: evidence?",
      detail:
        "Code verifies every reason cites a field that actually exists in the parsed data, no invented qualifications.",
      tone: "accent",
    },
    {
      label: "Draft note",
      detail:
        "Model writes a short note for the recruiter from the verified screening result.",
    },
  ],
};

/** Fan-out and fan-in */
export const M4_FAN_OUT_AND_FAN_IN: ArchitectureVisual = {
  kind: "architecture",
  width: 760,
  height: 300,
  nodes: [
    {
      id: "in",
      label: "Parsed application",
      x: 10,
      y: 126,
      w: 150,
      tone: "muted",
      detail: "Shared input to all branches.",
    },
    {
      id: "a",
      label: "Verify degree",
      sub: "registry API",
      x: 240,
      y: 30,
      w: 160,
      detail:
        "Independent check, no dependency on the others, so it can run concurrently.",
    },
    {
      id: "b",
      label: "Assess portfolio",
      sub: "model step",
      x: 240,
      y: 126,
      w: 160,
      detail: "Model reviews linked projects against the role.",
    },
    {
      id: "c",
      label: "Check references",
      sub: "email + model",
      x: 240,
      y: 222,
      w: 160,
      detail:
        "Slowest branch. Its latency sets the latency of the whole fan-out.",
    },
    {
      id: "join",
      label: "Join",
      sub: "wait + merge",
      x: 480,
      y: 126,
      w: 120,
      tone: "primary",
      detail:
        "Waits for all branches (or a quorum / timeout) and merges results into state. Must define what happens if a branch fails.",
    },
    {
      id: "out",
      label: "Screening",
      x: 640,
      y: 126,
      w: 110,
      tone: "success",
      detail: "Continues with merged evidence.",
    },
  ],
  edges: [
    { from: "in", to: "a" },
    { from: "in", to: "b" },
    { from: "in", to: "c" },
    { from: "a", to: "join" },
    { from: "b", to: "join" },
    { from: "c", to: "join" },
    { from: "join", to: "out" },
  ],
  scenarios: [
    {
      name: "All succeed",
      steps: [
        {
          nodes: ["in", "a", "b", "c"],
          edges: [
            ["in", "a"],
            ["in", "b"],
            ["in", "c"],
          ],
          text: "All three branches start at once. Total latency ≈ the slowest branch, not the sum.",
        },
        {
          nodes: ["a", "b", "join"],
          edges: [
            ["a", "join"],
            ["b", "join"],
          ],
          text: "Degree and portfolio finish in ~2 s; the join waits.",
        },
        {
          nodes: ["c", "join"],
          edges: [["c", "join"]],
          text: "References finish at ~6 s. Sequentially this would have taken ~10 s.",
        },
        {
          nodes: ["join", "out"],
          edges: [["join", "out"]],
          text: "Results merged into `state.checks`; the workflow continues.",
          tone: "success",
        },
      ],
    },
    {
      name: "One branch fails",
      steps: [
        {
          nodes: ["in", "a", "b", "c"],
          edges: [
            ["in", "a"],
            ["in", "b"],
            ["in", "c"],
          ],
          text: "Branches start concurrently.",
        },
        {
          nodes: ["a"],
          text: "The degree registry times out after retries.",
          tone: "danger",
        },
        {
          nodes: ["join"],
          edges: [
            ["b", "join"],
            ["c", "join"],
          ],
          text: "The join policy decides: here, a *required* branch failed, so the application is marked `needs_manual_check` rather than failing the whole run.",
          tone: "accent",
        },
        {
          nodes: ["join", "out"],
          edges: [["join", "out"]],
          text: "Screening continues with a clear gap recorded, degrading gracefully instead of blocking or pretending.",
          tone: "accent",
        },
      ],
    },
  ],
};

/** Conditional routing */
export const M4_CONDITIONAL_ROUTING: ArchitectureVisual = {
  kind: "architecture",
  width: 760,
  height: 330,
  nodes: [
    {
      id: "in",
      label: "Incoming email",
      x: 10,
      y: 140,
      w: 130,
      tone: "muted",
      detail: "Unstructured input of unknown type.",
    },
    {
      id: "router",
      label: "Router",
      sub: "label + confidence",
      x: 180,
      y: 140,
      w: 140,
      tone: "primary",
      detail:
        "Returns `{label, confidence}` as structured output. The route decision itself is code: `if confidence < 0.7: human`.",
    },
    {
      id: "billing",
      label: "Billing path",
      sub: "invoice tools",
      x: 400,
      y: 20,
      w: 160,
      detail: "Own prompt and read-only billing tools.",
    },
    {
      id: "tech",
      label: "Technical path",
      sub: "docs RAG + logs",
      x: 400,
      y: 100,
      w: 160,
      detail: "Retrieves from product docs and error logs.",
    },
    {
      id: "sales",
      label: "Sales path",
      sub: "CRM handoff",
      x: 400,
      y: 180,
      w: 160,
      detail:
        "No model answer at all, creates a CRM lead. Not every branch needs AI.",
    },
    {
      id: "human",
      label: "Human queue",
      sub: "unclear / sensitive",
      x: 400,
      y: 260,
      w: 160,
      tone: "accent",
      detail:
        "Low confidence, legal threats, or anything the router was not designed for.",
    },
    {
      id: "reply",
      label: "Reply / action",
      x: 620,
      y: 140,
      w: 130,
      tone: "success",
      detail: "Each path produces its own output, logged with the route taken.",
    },
  ],
  edges: [
    { from: "in", to: "router" },
    { from: "router", to: "billing", label: "billing" },
    { from: "router", to: "tech", label: "technical" },
    { from: "router", to: "sales", label: "sales" },
    { from: "router", to: "human", label: "low conf." },
    { from: "billing", to: "reply" },
    { from: "tech", to: "reply" },
    { from: "sales", to: "reply" },
  ],
  scenarios: [
    {
      name: '"Charged twice this month"',
      steps: [
        {
          nodes: ["in", "router"],
          edges: [["in", "router"]],
          text: "Router returns `{label: billing, confidence: 0.94}`.",
        },
        {
          nodes: ["router", "billing"],
          edges: [["router", "billing"]],
          text: "Confidence is above threshold → billing path with invoice tools.",
        },
        {
          nodes: ["billing", "reply"],
          edges: [["billing", "reply"]],
          text: "The billing path finds the duplicate charge and drafts a reply.",
          tone: "success",
        },
      ],
    },
    {
      name: '"Your app broke my payroll, lawyer cc\'d"',
      steps: [
        {
          nodes: ["in", "router"],
          edges: [["in", "router"]],
          text: "Router returns `{label: technical, confidence: 0.55}` and a `legal` flag.",
        },
        {
          nodes: ["router", "human"],
          edges: [["router", "human"]],
          text: "Low confidence *and* a sensitive flag → human queue. No automated reply is sent.",
          tone: "accent",
        },
      ],
    },
  ],
};

/** Recovery ladder for one step */
export const M4_RECOVERY_LADDER_FOR_ONE_STEP: FlowVisual = {
  kind: "flow",
  steps: [
    {
      label: "Attempt",
      detail: "Primary model parses the résumé against the schema.",
    },
    {
      label: "Retry",
      detail:
        "Schema validation failed. Retry once, including the validation error in the prompt, this fixes most malformed outputs.",
      tone: "accent",
    },
    {
      label: "Alternate",
      detail:
        "Still failing? Try an alternate strategy: a different model, or extracting text with OCR first if the PDF was a scan.",
      tone: "accent",
    },
    {
      label: "Degrade",
      detail:
        "Proceed with partial data, clearly marked (`parsed.partial = true`), if downstream steps can cope.",
      tone: "accent",
    },
    {
      label: "Escalate",
      detail:
        "Route to a human queue with the error and the attempts made. Never silently drop the item.",
      tone: "danger",
    },
  ],
};

/** Approval gate */
export const M4_APPROVAL_GATE: SequenceVisual = {
  kind: "sequence",
  actors: [
    { id: "wf", label: "Workflow" },
    { id: "store", label: "State store" },
    { id: "queue", label: "Approval inbox" },
    { id: "human", label: "Recruiter" },
  ],
  scenarios: [
    {
      name: "Approved",
      messages: [
        {
          from: "wf",
          to: "store",
          label: "checkpoint state",
          note: "Persist *before* waiting, the wait may last hours.",
        },
        {
          from: "wf",
          to: "queue",
          label: "request: fast-track?",
          note: "Include the evidence, the proposed action and what happens on approve/reject.",
        },
        { from: "queue", to: "human", label: "notify" },
        { from: "human", to: "queue", label: "approve", style: "return" },
        {
          from: "queue",
          to: "wf",
          label: "resume(run_id, approve)",
          style: "return",
          note: "Resume from the checkpoint; no work is redone.",
        },
        { from: "wf", to: "wf", label: "schedule interview", style: "self" },
      ],
    },
    {
      name: "Rejected with feedback",
      messages: [
        { from: "wf", to: "store", label: "checkpoint state" },
        { from: "wf", to: "queue", label: "request: fast-track?" },
        { from: "queue", to: "human", label: "notify" },
        {
          from: "human",
          to: "queue",
          label: 'reject: "missing SQL"',
          style: "error",
        },
        {
          from: "queue",
          to: "wf",
          label: "resume(run_id, reject, reason)",
          style: "return",
          note: "The reason is stored, it is gold for evaluating the screening step later.",
        },
        {
          from: "wf",
          to: "wf",
          label: "route to standard review",
          style: "self",
        },
      ],
    },
  ],
};

/** Complete application workflow */
export const M4_COMPLETE_APPLICATION_WORKFLOW: ArchitectureVisual = {
  kind: "architecture",
  width: 800,
  height: 300,
  nodes: [
    {
      id: "parse",
      label: "Parse",
      sub: "model + gate",
      x: 10,
      y: 120,
      w: 110,
      detail: "Structured extraction with schema gate and recovery ladder.",
    },
    {
      id: "checks",
      label: "Checks",
      sub: "parallel ×3",
      x: 150,
      y: 120,
      w: 110,
      detail:
        "Degree, portfolio and references concurrently; join with gap policy.",
    },
    {
      id: "screen",
      label: "Screen",
      sub: "model + gate",
      x: 290,
      y: 120,
      w: 110,
      tone: "primary",
      detail:
        "Scores against must-haves; evidence gate ensures reasons cite real fields.",
    },
    {
      id: "route",
      label: "Route",
      sub: "code",
      x: 430,
      y: 120,
      w: 100,
      detail:
        "Thresholds in code: < 40 reject-with-feedback, 40–75 standard review, > 75 fast-track candidate.",
    },
    {
      id: "reject",
      label: "Feedback email",
      x: 570,
      y: 20,
      w: 130,
      detail:
        "Templated, reviewed text, rejections are sensitive and must be consistent.",
    },
    {
      id: "review",
      label: "Standard review",
      x: 570,
      y: 120,
      w: 130,
      detail: "Human queue with the screening summary attached.",
    },
    {
      id: "approve",
      label: "Approval gate",
      sub: "recruiter",
      x: 570,
      y: 220,
      w: 130,
      tone: "accent",
      detail:
        "Fast-track requires a recruiter's approval before an interview is scheduled.",
    },
    {
      id: "sched",
      label: "Schedule",
      x: 720,
      y: 220,
      w: 70,
      tone: "success",
      detail: "Calendar tool; idempotent booking.",
    },
  ],
  edges: [
    { from: "parse", to: "checks" },
    { from: "checks", to: "screen" },
    { from: "screen", to: "route" },
    { from: "route", to: "reject", label: "< 40" },
    { from: "route", to: "review", label: "40–75" },
    { from: "route", to: "approve", label: "> 75" },
    { from: "approve", to: "sched" },
  ],
  scenarios: [
    {
      name: "Strong candidate",
      steps: [
        { nodes: ["parse"], text: "Résumé parsed; schema gate passes." },
        {
          nodes: ["checks"],
          edges: [["parse", "checks"]],
          text: "Three checks run in parallel and all succeed.",
        },
        {
          nodes: ["screen"],
          edges: [["checks", "screen"]],
          text: "Score 84 with cited evidence.",
        },
        {
          nodes: ["route", "approve"],
          edges: [
            ["screen", "route"],
            ["route", "approve"],
          ],
          text: "Code routes > 75 to the approval gate. The workflow checkpoints and waits.",
          tone: "accent",
        },
        {
          nodes: ["approve", "sched"],
          edges: [["approve", "sched"]],
          text: "Recruiter approves; interview scheduled.",
          tone: "success",
        },
      ],
    },
    {
      name: "Borderline candidate",
      steps: [
        {
          nodes: ["parse", "checks"],
          edges: [["parse", "checks"]],
          text: "Parsed; the references branch times out, recorded as a gap.",
        },
        {
          nodes: ["screen"],
          edges: [["checks", "screen"]],
          text: "Score 68; the gap is noted in the reasons.",
        },
        {
          nodes: ["route", "review"],
          edges: [
            ["screen", "route"],
            ["route", "review"],
          ],
          text: "Routed to standard human review with the full summary. No automated decision on a borderline case.",
          tone: "accent",
        },
      ],
    },
  ],
};

/** Three designs compared */
export const M4_THREE_DESIGNS_COMPARED: CompareVisual = {
  kind: "compare",
  options: [
    {
      id: "wf",
      label: "Pure workflow",
      summary: "Fixed graph; model steps inside nodes.",
    },
    {
      id: "hybrid",
      label: "Workflow + agentic step",
      summary:
        "Fixed skeleton with one bounded agent node where exploration is needed.",
    },
    {
      id: "agent",
      label: "Agent",
      summary: "The model drives the whole process through tools.",
    },
  ],
  dimensions: [
    {
      label: "Predictability",
      values: {
        wf: "High",
        hybrid: "High outside the agent node",
        agent: "Low–medium",
      },
    },
    {
      label: "Handles surprises",
      values: {
        wf: "Only anticipated ones",
        hybrid: "Inside the agent node",
        agent: "Anywhere",
      },
    },
    {
      label: "Auditability",
      values: { wf: "Excellent", hybrid: "Good", agent: "Needs rich tracing" },
    },
  ],
  situations: [
    {
      label: "Invoice processing at 50k/day",
      best: "wf",
      why: "High volume demands predictable cost and latency; the steps are known. Model steps extract fields; code validates.",
    },
    {
      label: "Customer onboarding with occasional odd documents",
      best: "hybrid",
      why: "Most cases follow the path; a bounded agent handles the unusual documents without making every case unpredictable.",
    },
    {
      label: "Open-ended security investigation",
      best: "agent",
      why: "Each finding determines the next probe; enumerating paths upfront is impossible.",
    },
  ],
};
