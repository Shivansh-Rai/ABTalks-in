import type {
  ArchitectureVisual,
  BudgetVisual,
  CompareVisual,
  FlowVisual,
  SequenceVisual,
} from "../../types";

/** Diagram data for Agentic AI module 6. Reusable anywhere: pass to `visual()` or `<Visual config>`. */

/** Context lifecycle for one agent step */
export const M6_CONTEXT_LIFECYCLE_FOR_ONE_AGENT_STEP: FlowVisual = {
  kind: "flow",
  loop: {
    label:
      "Next step: the context is rebuilt from state, not simply appended to.",
  },
  stateTitle: "Context size at this stage",
  steps: [
    {
      label: "Gather",
      detail:
        "Collect candidates: instructions, goal, plan, recent observations, retrieved documents, memory lookups, older history.",
      state: { candidates: "~46k tokens", "in context": "0" },
    },
    {
      label: "Rank",
      detail:
        "Score each candidate by relevance to *this* decision and by priority (instructions and goal always win).",
      state: { candidates: "~46k tokens", "in context": "0" },
    },
    {
      label: "Compress",
      detail:
        "Summarise old turns, trim tool payloads to key fields, keep only top reranked passages.",
      state: { candidates: "~19k tokens", "in context": "0" },
    },
    {
      label: "Pack",
      detail:
        "Assemble within the budget. Put instructions first and the current task and freshest evidence near the end, where they are used most reliably.",
      state: { candidates: "-", "in context": "~12k tokens" },
    },
    {
      label: "Call",
      detail: "The model decides. Everything it did not see, it cannot use.",
      state: { candidates: "-", "in context": "~12k tokens" },
    },
    {
      label: "Write back",
      detail:
        "The decision and new observation are written to **state**. Anything worth keeping beyond this run is considered for **long-term memory**: deliberately, not automatically.",
      tone: "success",
      state: { candidates: "-", "in context": "discarded; state updated" },
    },
  ],
};

/** Memory architecture around an agent */
export const M6_MEMORY_ARCHITECTURE_AROUND_AN_AGENT: ArchitectureVisual = {
  kind: "architecture",
  width: 780,
  height: 330,
  nodes: [
    {
      id: "agent",
      label: "Agent step",
      sub: "context → model",
      x: 300,
      y: 140,
      w: 170,
      tone: "primary",
      detail:
        "Receives a context built from the stores and emits a decision plus observations.",
    },
    {
      id: "work",
      label: "Working state",
      sub: "this run",
      x: 300,
      y: 20,
      w: 170,
      detail:
        "Authoritative record of the current run. Always consulted; trimmed and summarised as it grows.",
    },
    {
      id: "mm",
      label: "Memory manager",
      sub: "write policy",
      x: 300,
      y: 260,
      w: 170,
      tone: "accent",
      detail:
        "Decides what is worth remembering, deduplicates, attaches provenance and expiry, and enforces privacy rules. The model can *propose* memories; the manager *commits* them.",
    },
    {
      id: "epi",
      label: "Episodic log",
      sub: "past runs",
      x: 20,
      y: 70,
      w: 160,
      detail:
        "Summaries of past tasks and outcomes, searchable by similarity and time.",
    },
    {
      id: "sem",
      label: "Semantic store",
      sub: "facts, prefs",
      x: 20,
      y: 210,
      w: 160,
      detail:
        "Stable facts with keys, sources and timestamps: `preferred_session_length = 45m (stated 2 Sep)`.",
    },
    {
      id: "docs",
      label: "Knowledge base",
      sub: "docs index",
      x: 590,
      y: 70,
      w: 170,
      detail:
        "Organisation documents behind a retrieval pipeline (RAG). Read-only for the agent.",
    },
    {
      id: "proc",
      label: "Procedures",
      sub: "playbooks",
      x: 590,
      y: 210,
      w: 170,
      detail:
        "Task-specific instructions and examples, selected by task type rather than similarity.",
    },
  ],
  edges: [
    { from: "work", to: "agent", label: "always" },
    { from: "epi", to: "agent", label: "similar", dashed: true },
    { from: "sem", to: "agent", label: "by key", dashed: true },
    { from: "docs", to: "agent", label: "retrieve", dashed: true },
    { from: "proc", to: "agent", label: "by task", dashed: true },
    { from: "agent", to: "mm", label: "proposals" },
    { from: "mm", to: "sem", label: "commit" },
    { from: "mm", to: "epi", label: "log" },
  ],
  scenarios: [
    {
      name: "Read for a decision",
      steps: [
        {
          nodes: ["work", "agent"],
          edges: [["work", "agent"]],
          text: "Working state (goal, plan, last observation) always goes in.",
        },
        {
          nodes: ["proc", "agent"],
          edges: [["proc", "agent"]],
          text: "Task type is *weekly plan* → the scheduling playbook is selected.",
        },
        {
          nodes: ["sem", "agent"],
          edges: [["sem", "agent"]],
          text: "Keyed lookups fetch the exam date and session-length preference.",
        },
        {
          nodes: ["epi", "agent"],
          edges: [["epi", "agent"]],
          text: "A similarity search over past plans surfaces: *Sunday sessions were skipped 4/4 times.*",
        },
        {
          nodes: ["agent"],
          text: "The context now holds ~3k tokens of highly relevant memory instead of the student's entire history.",
          tone: "success",
        },
      ],
    },
    {
      name: "Write after the run",
      steps: [
        {
          nodes: ["agent", "mm"],
          edges: [["agent", "mm"]],
          text: "The model proposes two memories: *student says evenings suit them better* and *student mentioned a medical condition*.",
        },
        {
          nodes: ["mm"],
          text: "The manager applies policy: preference → store; health information → **not stored** (sensitive, not needed for the task).",
          tone: "accent",
        },
        {
          nodes: ["mm", "sem"],
          edges: [["mm", "sem"]],
          text: "The preference is committed with source (conversation id), timestamp and a review date.",
        },
        {
          nodes: ["mm", "epi"],
          edges: [["mm", "epi"]],
          text: "A short episode summary of the run is logged for future similarity lookups.",
          tone: "success",
        },
      ],
    },
  ],
};

/** Context pressure at step 25 */
export const M6_CONTEXT_PRESSURE_AT_STEP_25: BudgetVisual = {
  kind: "budget",
  unit: "tokens",
  min: 3000,
  max: 60000,
  initial: 20000,
  items: [
    {
      label: "Instructions",
      cost: 1500,
      priority: 10,
      required: true,
      note: "Rules and output format.",
    },
    {
      label: "Pinned facts",
      cost: 300,
      priority: 10,
      required: true,
      note: "Customer id, plan, the original complaint.",
    },
    {
      label: "Latest observation",
      cost: 1200,
      priority: 9,
      note: "The evidence for the current decision.",
    },
    {
      label: "Retrieved policy (top 3)",
      cost: 2400,
      priority: 8,
      note: "Refund policy passages.",
    },
    {
      label: "Rolling summary of turns 1–20",
      cost: 900,
      priority: 7,
      note: "Compact continuity.",
    },
    {
      label: "Last 5 turns verbatim",
      cost: 4000,
      priority: 6,
      note: "Recent nuance and tone.",
    },
    {
      label: "Episodic: similar past cases",
      cost: 1800,
      priority: 4,
      note: "How comparable complaints were resolved.",
    },
    {
      label: "Raw transcript turns 1–20",
      cost: 38000,
      priority: 1,
      note: "Everything, verbatim. Rarely worth its cost.",
    },
  ],
};

/** Memory read and write in one conversation */
export const M6_MEMORY_READ_AND_WRITE_IN_ONE_CONVERSATION: SequenceVisual = {
  kind: "sequence",
  actors: [
    { id: "user", label: "User" },
    { id: "agent", label: "Agent" },
    { id: "mm", label: "Memory manager" },
    { id: "store", label: "Memory store" },
  ],
  scenarios: [
    {
      name: "Read, use, write",
      messages: [
        { from: "user", to: "agent", label: '"Plan my week"' },
        { from: "agent", to: "mm", label: "recall(user, task=planning)" },
        { from: "mm", to: "store", label: "query by key + similarity" },
        {
          from: "store",
          to: "mm",
          label: "45-min blocks; exam 12 Nov",
          style: "return",
        },
        {
          from: "mm",
          to: "agent",
          label: "2 memories + provenance",
          style: "return",
          note: "Returned with dates so the agent can judge freshness.",
        },
        {
          from: "agent",
          to: "user",
          label: "plan using 45-min blocks",
          style: "return",
        },
        {
          from: "user",
          to: "agent",
          label: '"Actually 30 minutes works better now"',
        },
        { from: "agent", to: "mm", label: "propose: session_length=30m" },
        {
          from: "mm",
          to: "store",
          label: "supersede 45m → 30m",
          note: "An update, not an append, the old value is archived, not deleted from history.",
        },
      ],
    },
    {
      name: "Stale memory",
      messages: [
        { from: "user", to: "agent", label: '"Book my usual slot"' },
        { from: "agent", to: "mm", label: "recall(user, 'usual slot')" },
        {
          from: "mm",
          to: "agent",
          label: "Tue 6pm (from March)",
          style: "return",
          note: "Seven months old.",
        },
        {
          from: "agent",
          to: "user",
          label: '"Tue 6pm as usual, still right?"',
          style: "return",
          note: "Old or low-confidence memories are *confirmed*, not silently acted on.",
        },
        {
          from: "user",
          to: "agent",
          label: '"No, Thursdays now"',
          style: "error",
        },
        { from: "agent", to: "mm", label: "propose: usual_slot=Thu 6pm" },
        {
          from: "mm",
          to: "store",
          label: "supersede",
          note: "The correction flows back, so the mistake is not repeated.",
        },
      ],
    },
  ],
};

/** Retrieval design choices */
export const M6_RETRIEVAL_DESIGN_CHOICES: CompareVisual = {
  kind: "compare",
  options: [
    {
      id: "vec",
      label: "Vector search",
      summary: "Nearest neighbours in embedding space.",
    },
    {
      id: "kw",
      label: "Keyword search",
      summary: "Term matching with ranking (e.g. BM25).",
    },
    {
      id: "hyb",
      label: "Hybrid + rerank",
      summary: "Both, merged, then a reranker picks the best few.",
    },
  ],
  dimensions: [
    {
      label: "Strong at",
      values: {
        vec: "Paraphrases, concepts",
        kw: "Exact terms, codes, names",
        hyb: "Both",
      },
    },
    {
      label: "Weak at",
      values: {
        vec: "Exact identifiers, negation",
        kw: "Synonyms, phrasing differences",
        hyb: "Cost and latency",
      },
    },
    {
      label: "Cost",
      values: { vec: "Low per query", kw: "Lowest", hyb: "Highest (reranker)" },
    },
  ],
  situations: [
    {
      label: '"Error E-4012 on checkout"',
      best: "kw",
      why: "The identifier is the whole signal. Embeddings may blur E-4012 with other codes.",
    },
    {
      label: '"Can I get my money back if I cancel late?"',
      best: "vec",
      why: 'Meaning-based match to the refund-policy passage, which never uses the word "money back".',
    },
    {
      label: "Support assistant over mixed docs and tickets",
      best: "hyb",
      why: "Queries mix concepts and identifiers; reranking keeps only passages that truly answer.",
    },
  ],
};
