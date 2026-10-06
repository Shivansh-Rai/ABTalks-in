import type {
  ArchitectureVisual,
  CompareVisual,
  DecisionVisual,
  SequenceVisual,
} from "../../types";

/** Diagram data for Agentic AI module 5. Reusable anywhere: pass to `visual()` or `<Visual config>`. */

/** Supervisor with specialist workers */
export const M5_SUPERVISOR_WITH_SPECIALIST_WORKERS: ArchitectureVisual = {
  kind: "architecture",
  width: 780,
  height: 340,
  nodes: [
    {
      id: "user",
      label: "User goal",
      x: 10,
      y: 30,
      w: 130,
      tone: "muted",
      detail:
        '"Compare the three leading open-source vector databases for a 10M-document RAG system."',
    },
    {
      id: "sup",
      label: "Supervisor",
      sub: "plan · delegate · integrate",
      x: 290,
      y: 30,
      w: 200,
      tone: "primary",
      detail:
        "Owns the goal and the stopping decision. Sees only task summaries, never raw research, so its context stays small.",
    },
    {
      id: "r1",
      label: "Researcher A",
      sub: "database 1",
      x: 10,
      y: 170,
      w: 140,
      detail:
        "Own context, own tool budget. Returns ≤ 300 words of claims with sources.",
    },
    {
      id: "r2",
      label: "Researcher B",
      sub: "database 2",
      x: 170,
      y: 170,
      w: 140,
      detail: "Runs in parallel with A and C.",
    },
    {
      id: "r3",
      label: "Researcher C",
      sub: "database 3",
      x: 330,
      y: 170,
      w: 140,
      detail: "Runs in parallel with A and B.",
    },
    {
      id: "an",
      label: "Analyst",
      sub: "compare + benchmarks",
      x: 490,
      y: 170,
      w: 140,
      detail:
        "Receives the three summaries and produces a comparison table with confidence levels.",
    },
    {
      id: "rev",
      label: "Reviewer",
      sub: "verify claims",
      x: 640,
      y: 170,
      w: 130,
      tone: "accent",
      detail:
        "Checks each claim against its cited source. Unsupported claims go back with a reason.",
    },
    {
      id: "out",
      label: "Report",
      x: 330,
      y: 280,
      w: 140,
      tone: "success",
      detail: "Integrated by the supervisor after the reviewer passes it.",
    },
  ],
  edges: [
    { from: "user", to: "sup" },
    { from: "sup", to: "r1" },
    { from: "sup", to: "r2" },
    { from: "sup", to: "r3" },
    { from: "sup", to: "an" },
    { from: "sup", to: "rev" },
    { from: "sup", to: "out", dashed: true },
  ],
  scenarios: [
    {
      name: "Research run",
      steps: [
        {
          nodes: ["user", "sup"],
          edges: [["user", "sup"]],
          text: "The supervisor writes a plan: three parallel research tasks, then analysis, then review.",
        },
        {
          nodes: ["sup", "r1", "r2", "r3"],
          edges: [
            ["sup", "r1"],
            ["sup", "r2"],
            ["sup", "r3"],
          ],
          text: "Three researchers start concurrently, each with a precise brief: scope, sources to prefer, output format, tool budget.",
        },
        {
          nodes: ["r1", "r2", "r3", "sup"],
          text: "Each returns a compact summary. The supervisor's context grows by ~900 words, not by 40 web pages.",
        },
        {
          nodes: ["sup", "an"],
          edges: [["sup", "an"]],
          text: "The analyst compares the summaries and flags that two sources disagree on index build time.",
        },
        {
          nodes: ["sup", "rev"],
          edges: [["sup", "rev"]],
          text: "The reviewer checks claims; one benchmark number is not in its cited source and is removed.",
        },
        {
          nodes: ["sup", "out"],
          edges: [["sup", "out"]],
          text: "The supervisor integrates the reviewed findings into the report.",
          tone: "success",
        },
      ],
    },
    {
      name: "Vague delegation",
      steps: [
        {
          nodes: ["sup", "r1", "r2", "r3"],
          edges: [
            ["sup", "r1"],
            ["sup", "r2"],
            ["sup", "r3"],
          ],
          text: 'The supervisor delegates "research vector databases" to all three, with no scope.',
          tone: "danger",
        },
        {
          nodes: ["r1", "r2", "r3"],
          text: "All three research the *same* popular database. Work is duplicated; the other two are missed.",
          tone: "danger",
        },
        {
          nodes: ["an"],
          edges: [["sup", "an"]],
          text: "The analyst receives three overlapping summaries and produces a lopsided comparison.",
          tone: "danger",
        },
        {
          nodes: ["sup"],
          text: "Fix: every delegation carries objective, scope boundaries, output schema and budget. The failure was in the brief, not in any worker.",
          tone: "accent",
        },
      ],
    },
  ],
};

/** Peer-to-peer collaboration */
export const M5_PEER_TO_PEER_COLLABORATION: ArchitectureVisual = {
  kind: "architecture",
  width: 760,
  height: 310,
  nodes: [
    {
      id: "bb",
      label: "Shared blackboard",
      sub: "proposals, critiques, decisions",
      x: 270,
      y: 125,
      w: 220,
      h: 60,
      tone: "primary",
      detail:
        "A structured store every agent reads and appends to. Entries are typed (proposal, critique, decision) with authors and timestamps.",
    },
    {
      id: "arch",
      label: "Architect",
      x: 30,
      y: 30,
      w: 140,
      detail: "Proposes designs.",
    },
    {
      id: "sec",
      label: "Security",
      x: 590,
      y: 30,
      w: 140,
      detail: "Critiques proposals for threats.",
    },
    {
      id: "cost",
      label: "Cost",
      x: 30,
      y: 240,
      w: 140,
      detail: "Estimates run cost of each proposal.",
    },
    {
      id: "ops",
      label: "Operations",
      x: 590,
      y: 240,
      w: 140,
      detail: "Critiques for operability and on-call burden.",
    },
  ],
  edges: [
    { from: "arch", to: "bb" },
    { from: "sec", to: "bb" },
    { from: "cost", to: "bb" },
    { from: "ops", to: "bb" },
  ],
  scenarios: [
    {
      name: "Converging review",
      steps: [
        {
          nodes: ["arch", "bb"],
          edges: [["arch", "bb"]],
          text: "Architect posts proposal P1: a single region with nightly backups.",
        },
        {
          nodes: ["sec", "ops", "bb"],
          edges: [
            ["sec", "bb"],
            ["ops", "bb"],
          ],
          text: "Security and Operations post critiques in parallel: no encryption at rest; RPO of 24 h too high.",
        },
        {
          nodes: ["arch", "bb"],
          edges: [["arch", "bb"]],
          text: "Architect posts P2 addressing both.",
        },
        {
          nodes: ["cost", "bb"],
          edges: [["cost", "bb"]],
          text: "Cost estimates P2 at +18% and posts it.",
        },
        {
          nodes: ["bb"],
          text: "A **termination rule in code**: no open critiques of severity ≥ high, marks P2 accepted.",
          tone: "success",
        },
      ],
    },
    {
      name: "Never converges",
      steps: [
        {
          nodes: ["arch", "bb"],
          edges: [["arch", "bb"]],
          text: "Architect posts P1.",
        },
        {
          nodes: ["sec", "bb"],
          edges: [["sec", "bb"]],
          text: "Security asks for a second region.",
        },
        {
          nodes: ["cost", "bb"],
          edges: [["cost", "bb"]],
          text: "Cost objects to the second region.",
        },
        {
          nodes: ["arch", "bb"],
          edges: [["arch", "bb"]],
          text: "Architect reverts to one region… and the cycle repeats.",
          tone: "danger",
        },
        {
          nodes: ["bb"],
          text: "Without an owner or a tie-breaking rule, peers can oscillate indefinitely. Add a round limit and an arbiter (a human or a designated agent).",
          tone: "accent",
        },
      ],
    },
  ],
};

/** Supervisor vs decentralised */
export const M5_SUPERVISOR_VS_DECENTRALISED: CompareVisual = {
  kind: "compare",
  options: [
    {
      id: "sup",
      label: "Supervisor",
      summary: "One agent owns the goal; workers report to it.",
    },
    {
      id: "peer",
      label: "Decentralised / peer",
      summary:
        "Agents coordinate directly or via shared state; no single owner.",
    },
  ],
  dimensions: [
    {
      label: "Control & termination",
      values: {
        sup: "Clear, the supervisor decides",
        peer: "Needs explicit rules; risk of oscillation",
      },
    },
    {
      label: "Bottleneck",
      values: {
        sup: "Supervisor context and latency",
        peer: "Shared state contention",
      },
    },
    {
      label: "Resilience",
      values: {
        sup: "Supervisor is a single point of failure",
        peer: "No single point, but harder to reason about",
      },
    },
    {
      label: "Debuggability",
      values: {
        sup: "One trace tree",
        peer: "Interleaved messages; needs good tracing",
      },
    },
  ],
  situations: [
    {
      label: "Research report from many sources",
      best: "sup",
      why: "Clear decomposition into parallel sub-tasks with one integrator, the canonical supervisor case.",
    },
    {
      label: "Multi-perspective design critique",
      best: "peer",
      why: "Value comes from agents responding to each other's points, not from a manager splitting work.",
    },
    {
      label: "Customer support across billing, tech and sales",
      best: "peer",
      why: "A handoff chain, each specialist passes the conversation on, often beats routing everything through a manager.",
    },
  ],
};

/** A good handoff */
export const M5_A_GOOD_HANDOFF: SequenceVisual = {
  kind: "sequence",
  actors: [
    { id: "user", label: "Customer" },
    { id: "triage", label: "Triage agent" },
    { id: "billing", label: "Billing agent" },
    { id: "state", label: "Case record" },
  ],
  scenarios: [
    {
      name: "Structured handoff",
      messages: [
        { from: "user", to: "triage", label: '"Charged twice for March"' },
        {
          from: "triage",
          to: "state",
          label: "write: intent, account, evidence",
          note: "The case record, not the chat transcript, is the source of truth.",
        },
        {
          from: "triage",
          to: "billing",
          label: "handoff{case_id, goal, known, open}",
          note: "Goal: resolve duplicate charge. Known: account, invoice ids. Open: which charge to refund.",
        },
        { from: "billing", to: "state", label: "read case", style: "return" },
        {
          from: "billing",
          to: "user",
          label: '"I see both charges on 3 Mar…"',
          note: "The customer does not repeat themselves, the test of a good handoff.",
        },
      ],
    },
    {
      name: "Lossy handoff",
      messages: [
        { from: "user", to: "triage", label: '"Charged twice for March"' },
        {
          from: "triage",
          to: "billing",
          label: '"billing issue"',
          style: "error",
          note: "Free-text summary; account and invoices not passed.",
        },
        {
          from: "billing",
          to: "user",
          label: '"How can I help with billing?"',
          style: "error",
          note: "The customer must start over, or worse, billing guesses the account.",
        },
      ],
    },
  ],
};

/** Shared or isolated state? */
export const M5_SHARED_OR_ISOLATED_STATE: CompareVisual = {
  kind: "compare",
  options: [
    {
      id: "shared",
      label: "Shared state",
      summary:
        "All agents read and write a common store (blackboard, case record, shared memory).",
    },
    {
      id: "isolated",
      label: "Isolated state",
      summary:
        "Each agent has private context; information moves only through explicit messages.",
    },
  ],
  dimensions: [
    {
      label: "Pros",
      values: {
        shared: "No information lost at handoffs; one source of truth",
        isolated:
          "Small, focused contexts; clear ownership; easy to parallelise",
      },
    },
    {
      label: "Cons",
      values: {
        shared:
          "Contention, overwrites, contexts bloat, errors spread to everyone",
        isolated: "Anything not in a message is lost; duplicate discovery",
      },
    },
    {
      label: "Needs",
      values: {
        shared: "Typed fields, one writer per field, versioning",
        isolated: "Well-designed message schemas",
      },
    },
  ],
  situations: [
    {
      label: "Parallel researchers on independent topics",
      best: "isolated",
      why: "They should not see each other's raw material; only summaries flow back to the supervisor.",
    },
    {
      label: "Long-running support case passed between specialists",
      best: "shared",
      why: "A persistent case record prevents customers repeating themselves and survives many handoffs.",
    },
    {
      label: "Several agents editing one document",
      best: "shared",
      why: "They must see the same current version, but give each agent ownership of distinct sections to avoid overwrites.",
    },
  ],
};

/** How one error cascades, and where it is caught */
export const M5_HOW_ONE_ERROR_CASCADES_AND_WHERE_IT_IS_CAUGHT: ArchitectureVisual =
  {
    kind: "architecture",
    width: 780,
    height: 200,
    nodes: [
      {
        id: "res",
        label: "Researcher",
        x: 10,
        y: 70,
        w: 130,
        detail: "Misreads a benchmark chart: reports 50k docs/s instead of 5k.",
      },
      {
        id: "val",
        label: "Source check",
        sub: "code",
        x: 170,
        y: 70,
        w: 120,
        tone: "accent",
        detail:
          "Deterministic check: does the quoted number appear in the fetched source text?",
      },
      {
        id: "an",
        label: "Analyst",
        x: 320,
        y: 70,
        w: 120,
        detail: "Builds the comparison on received figures.",
      },
      {
        id: "wr",
        label: "Writer",
        x: 470,
        y: 70,
        w: 120,
        detail: "Turns findings into a recommendation.",
      },
      {
        id: "rev",
        label: "Reviewer",
        x: 620,
        y: 70,
        w: 150,
        tone: "accent",
        detail: "Independently re-checks key claims against sources.",
      },
    ],
    edges: [
      { from: "res", to: "val" },
      { from: "val", to: "an" },
      { from: "an", to: "wr" },
      { from: "wr", to: "rev" },
    ],
    scenarios: [
      {
        name: "Unguarded cascade",
        steps: [
          {
            nodes: ["res"],
            text: "The researcher reports 50k docs/s, a 10× error.",
            tone: "danger",
          },
          {
            nodes: ["val", "an"],
            edges: [
              ["res", "val"],
              ["val", "an"],
            ],
            text: "No source check is configured; the figure passes straight through.",
            tone: "danger",
          },
          {
            nodes: ["an", "wr"],
            edges: [["an", "wr"]],
            text: "The analyst ranks Database B first *because of* that number. The writer makes it the headline.",
            tone: "danger",
          },
          {
            nodes: ["rev"],
            edges: [["wr", "rev"]],
            text: "The reviewer checks tone and structure, not numbers. The user receives a confidently wrong recommendation.",
            tone: "danger",
          },
        ],
      },
      {
        name: "Contained",
        steps: [
          { nodes: ["res"], text: "Same misread: 50k docs/s.", tone: "danger" },
          {
            nodes: ["val"],
            edges: [["res", "val"]],
            text: "The source check finds `50,000` nowhere in the fetched page; the claim is returned to the researcher with that reason.",
            tone: "accent",
          },
          {
            nodes: ["res", "val"],
            edges: [["res", "val"]],
            text: "The researcher re-reads and corrects to 5k; the check passes.",
          },
          {
            nodes: ["an", "wr", "rev"],
            edges: [
              ["val", "an"],
              ["an", "wr"],
              ["wr", "rev"],
            ],
            text: "Downstream agents work from verified figures; the reviewer spot-checks the top claims as a second line.",
            tone: "success",
          },
        ],
      },
    ],
  };

/** Do you need more than one agent? */
export const M5_DO_YOU_NEED_MORE_THAN_ONE_AGENT: DecisionVisual = {
  kind: "decision",
  start: "single",
  nodes: {
    single: {
      question:
        "Have you built a single-agent version and measured where it fails?",
      options: [
        { label: "Yes", next: "limit" },
        { label: "Not yet", next: "build" },
      ],
    },
    build: {
      outcome: "Build one agent first",
      text: "You cannot know which limit you are solving for. Most tasks never need a second agent.",
      tone: "accent",
    },
    limit: {
      question: "What is the measured limit?",
      options: [
        { label: "Context overflows with exploration", next: "ctx" },
        { label: "Too slow; sub-tasks are independent", next: "par" },
        { label: "Quality: needs independent checking", next: "rev" },
        { label: "Tools / instructions too broad", next: "route" },
      ],
    },
    ctx: {
      outcome: "Sub-agents for exploration",
      text: "Delegate exploration to workers that return compact summaries. Keep one owner.",
      tone: "success",
    },
    par: {
      outcome: "Parallel workers under a supervisor",
      text: "Fan out independent sub-tasks; measure the token cost against the latency gain.",
      tone: "success",
    },
    rev: {
      outcome: "Consider a workflow first",
      text: "A generator plus a deterministic or model-based reviewer step in a workflow often suffices, no agent-to-agent dialogue needed.",
      tone: "accent",
    },
    route: {
      outcome: "Try a router first",
      text: "Routing to specialised single agents is simpler than a coordinating team.",
      tone: "accent",
    },
  },
};
