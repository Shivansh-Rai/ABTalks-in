import type {
  ArchitectureVisual,
  CompareVisual,
  FlowVisual,
  SequenceVisual,
} from "../../types";

/**
 * Canonical visual configs for concepts that recur across courses (agent loop,
 * tool-call round trip, RAG pipeline, workflow-vs-agent…). A System Design or
 * GenAI course imports these directly instead of re-drawing them.
 */

export const AGENT_LOOP: FlowVisual = {
  kind: "flow",
  loop: {
    label:
      "Goal not met and no stop condition hit → go round again with the new observation in context.",
  },
  stateTitle: "What the runtime knows after this step",
  steps: [
    {
      label: "Goal",
      detail:
        "A user asks: *Why did checkout latency double since Tuesday?* The runtime records the goal and starts an empty trace.",
      state: {
        goal: "explain checkout latency regression",
        step: "0 / 8",
        evidence: "none",
        status: "running",
      },
    },
    {
      label: "Build context",
      detail:
        "The runtime assembles instructions, the goal, tool descriptions and anything already learned. This bundle is the only thing the model will see.",
      state: {
        goal: "explain checkout latency regression",
        step: "1 / 8",
        evidence: "none",
        status: "running",
      },
    },
    {
      label: "Decide",
      detail:
        'The model reasons that deploy history is the cheapest first clue and requests `list_deploys(service="checkout", since="Tue")`.',
      state: {
        goal: "explain checkout latency regression",
        step: "1 / 8",
        evidence: "none",
        status: "awaiting tool",
      },
    },
    {
      label: "Act",
      detail:
        "The runtime, not the model, validates the arguments and calls the deploy API.",
      state: {
        goal: "explain checkout latency regression",
        step: "1 / 8",
        evidence: "none",
        status: "tool running",
      },
    },
    {
      label: "Observe",
      detail:
        "Result: one deploy on Tuesday, `v412`, which changed the order-summary query. It is appended to the trace as an observation.",
      state: {
        goal: "explain checkout latency regression",
        step: "1 / 8",
        evidence: "deploy v412 touched order query",
        status: "running",
      },
    },
    {
      label: "Decide again",
      detail:
        'With that evidence in context, the model now requests `explain_query("order_summary")`: a choice it could not have made before the observation.',
      state: {
        goal: "explain checkout latency regression",
        step: "2 / 8",
        evidence: "deploy v412 touched order query",
        status: "awaiting tool",
      },
    },
    {
      label: "Observe",
      detail:
        "The query plan shows a full table scan: the new filter column has no index.",
      state: {
        goal: "explain checkout latency regression",
        step: "2 / 8",
        evidence: "v412 + full scan on orders.region",
        status: "running",
      },
    },
    {
      label: "Finish",
      detail:
        "The model judges the goal met and answers with the cause, the evidence and a suggested index, no tool call, so the loop ends.",
      tone: "success",
      state: {
        goal: "explain checkout latency regression",
        step: "3 / 8",
        evidence: "v412 + full scan on orders.region",
        status: "done",
      },
    },
  ],
};

export const TOOL_CALL_SEQUENCE: SequenceVisual = {
  kind: "sequence",
  actors: [
    { id: "user", label: "User" },
    { id: "rt", label: "Runtime (your code)" },
    { id: "llm", label: "Model API" },
    { id: "tool", label: "Tool / API" },
  ],
  scenarios: [
    {
      name: "Happy path",
      messages: [
        {
          from: "user",
          to: "rt",
          label: '"Weather in Pune?"',
          note: "The request enters *your* application, never the model directly.",
        },
        {
          from: "rt",
          to: "llm",
          label: "messages + tool schemas",
          note: "Tool descriptions travel with every request; the model cannot call anything it was not told about.",
        },
        {
          from: "llm",
          to: "rt",
          label: "tool_call get_weather{city}",
          style: "return",
          note: "The model only *proposes* a call as structured data. Nothing has executed yet.",
        },
        {
          from: "rt",
          to: "rt",
          label: "validate + authorise",
          style: "self",
          note: "Schema check, allow-list, permissions. This is where you say no.",
        },
        { from: "rt", to: "tool", label: "GET /weather?city=Pune" },
        { from: "tool", to: "rt", label: "31°C, clear", style: "return" },
        {
          from: "rt",
          to: "llm",
          label: "tool_result appended",
          note: "The observation becomes part of the conversation for the next decision.",
        },
        {
          from: "llm",
          to: "rt",
          label: "final text",
          style: "return",
          note: "No tool call this time, the model considers the goal met.",
        },
        {
          from: "rt",
          to: "user",
          label: '"It\'s 31°C and clear."',
          style: "return",
        },
      ],
    },
    {
      name: "Tool fails",
      messages: [
        { from: "user", to: "rt", label: '"Weather in Pune?"' },
        { from: "rt", to: "llm", label: "messages + tool schemas" },
        {
          from: "llm",
          to: "rt",
          label: "tool_call get_weather{city}",
          style: "return",
        },
        { from: "rt", to: "tool", label: "GET /weather?city=Pune" },
        {
          from: "tool",
          to: "rt",
          label: "503 Service Unavailable",
          style: "error",
          note: "Do not crash and do not hide it.",
        },
        {
          from: "rt",
          to: "llm",
          label: "tool_result: error, retryable",
          style: "error",
          note: "Turn the failure into a *structured observation* the model can reason about.",
        },
        {
          from: "llm",
          to: "rt",
          label: "final text (honest)",
          style: "return",
          note: "A well-instructed model reports the outage instead of inventing a temperature.",
        },
        {
          from: "rt",
          to: "user",
          label: '"Weather service is down."',
          style: "return",
        },
      ],
    },
  ],
};

export const WORKFLOW_VS_AGENT: CompareVisual = {
  kind: "compare",
  options: [
    {
      id: "wf",
      label: "Workflow",
      summary:
        "You write the path. Models may power individual steps, but the order is fixed in code.",
    },
    {
      id: "agent",
      label: "Agent",
      summary:
        "You write the tools and the limits. The model chooses the path at runtime from what it observes.",
    },
  ],
  dimensions: [
    {
      label: "Who decides the next step",
      values: { wf: "Your code", agent: "The model, inside your guardrails" },
    },
    {
      label: "Predictability",
      values: {
        wf: "High, same input, same path",
        agent: "Lower, paths vary run to run",
      },
    },
    {
      label: "Cost & latency",
      values: {
        wf: "Bounded and easy to estimate",
        agent: "Variable; grows with iterations",
      },
    },
    {
      label: "Testing",
      values: {
        wf: "Unit-test each step",
        agent: "Evaluate outcomes over many runs",
      },
    },
    {
      label: "Best when",
      values: {
        wf: "Steps are known in advance",
        agent: "Steps depend on what is discovered",
      },
    },
  ],
  situations: [
    {
      label: "Summarise every sales call and email it",
      best: "wf",
      why: "Transcribe → summarise → send never changes order. An agent would add cost and a chance of skipping the email.",
    },
    {
      label: "Find why last night's deploy broke login",
      best: "agent",
      why: "The next check depends on what the last one revealed. You cannot script the investigation ahead of time.",
    },
    {
      label: "Classify support tickets into 6 queues",
      best: "wf",
      why: "One model call plus a routing table. Deterministic, cheap and trivially testable.",
    },
    {
      label: "Answer open questions across 40 internal docs and 3 APIs",
      best: "agent",
      why: "Which source to consult, and whether to consult another, depends on the question and the partial answers.",
    },
  ],
};

export const RAG_PIPELINE: ArchitectureVisual = {
  kind: "architecture",
  width: 780,
  height: 330,
  nodes: [
    {
      id: "ingest",
      label: "Offline ingest",
      x: 10,
      y: 10,
      w: 760,
      h: 120,
      group: true,
    },
    {
      id: "docs",
      label: "Documents",
      sub: "PDFs, wiki, tickets",
      x: 30,
      y: 50,
      tone: "muted",
      detail:
        "Raw sources. Ingest also records metadata, owner, date, access level, which later drives filtering and permissions.",
    },
    {
      id: "chunk",
      label: "Chunk",
      sub: "split + metadata",
      x: 215,
      y: 50,
      detail:
        "Split documents into passages small enough to retrieve precisely but large enough to stand alone. Chunk boundaries silently decide what can ever be retrieved together.",
    },
    {
      id: "embed",
      label: "Embed",
      sub: "text → vector",
      x: 400,
      y: 50,
      detail:
        "An embedding model maps each chunk to a vector so that passages with similar meaning land close together.",
    },
    {
      id: "index",
      label: "Vector index",
      sub: "+ keyword index",
      x: 600,
      y: 50,
      tone: "primary",
      detail:
        "Stores vectors (and often a keyword index for exact terms like error codes). Must be kept in sync as documents change.",
    },
    {
      id: "q",
      label: "Query",
      sub: "user or agent",
      x: 30,
      y: 200,
      detail:
        "The agent's current information need, often rewritten from the user's words into a sharper search query.",
    },
    {
      id: "retrieve",
      label: "Retrieve",
      sub: "top-k + filters",
      x: 215,
      y: 200,
      detail:
        "Nearest-neighbour search, filtered by metadata (tenant, permission, freshness). Filtering *before* ranking prevents leaks.",
    },
    {
      id: "rerank",
      label: "Rerank",
      sub: "precision pass",
      x: 400,
      y: 200,
      detail:
        "A slower, more accurate model rescores the candidates so only the few best passages reach the context window.",
    },
    {
      id: "gen",
      label: "Model + context",
      sub: "grounded answer",
      x: 600,
      y: 200,
      tone: "primary",
      detail:
        "The model answers using the retrieved passages and cites them. If nothing relevant was found it should say so rather than guess.",
    },
  ],
  edges: [
    { from: "docs", to: "chunk" },
    { from: "chunk", to: "embed" },
    { from: "embed", to: "index" },
    { from: "q", to: "retrieve" },
    { from: "index", to: "retrieve", label: "search", dashed: true },
    { from: "retrieve", to: "rerank", label: "top 30" },
    { from: "rerank", to: "gen", label: "top 5" },
  ],
  scenarios: [
    {
      name: "Answer a question",
      steps: [
        {
          nodes: ["docs", "chunk", "embed", "index"],
          edges: [
            ["docs", "chunk"],
            ["chunk", "embed"],
            ["embed", "index"],
          ],
          text: "**Offline, ahead of time:** documents are chunked, embedded and indexed. This runs on ingest, not per question.",
        },
        {
          nodes: ["q"],
          text: "**At question time:** the agent forms a query, e.g. *refund policy for annual plans cancelled after 30 days*.",
        },
        {
          nodes: ["q", "retrieve", "index"],
          edges: [
            ["q", "retrieve"],
            ["index", "retrieve"],
          ],
          text: "The query is embedded and the index returns the 30 nearest chunks the user is allowed to see.",
        },
        {
          nodes: ["retrieve", "rerank"],
          edges: [["retrieve", "rerank"]],
          text: "A reranker reads query and passage together and keeps the 5 that genuinely answer it.",
        },
        {
          nodes: ["rerank", "gen"],
          edges: [["rerank", "gen"]],
          text: "Only those passages enter the context. The model answers and cites them.",
          tone: "success",
        },
      ],
    },
    {
      name: "Stale index",
      steps: [
        {
          nodes: ["docs"],
          text: "The refund policy was updated yesterday, but the ingest job failed silently.",
          tone: "danger",
        },
        {
          nodes: ["index"],
          text: "The index still holds last month's policy chunks.",
          tone: "danger",
        },
        {
          nodes: ["q", "retrieve", "rerank"],
          edges: [
            ["q", "retrieve"],
            ["index", "retrieve"],
            ["retrieve", "rerank"],
          ],
          text: "Retrieval works perfectly, it confidently returns the *old* policy.",
        },
        {
          nodes: ["gen"],
          edges: [["rerank", "gen"]],
          text: "The model gives a fluent, well-cited, **wrong** answer. Nothing in the query path can detect this; only ingest monitoring and freshness metadata can.",
          tone: "danger",
        },
      ],
    },
  ],
};
