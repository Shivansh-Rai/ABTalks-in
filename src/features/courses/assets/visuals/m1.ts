import type {
  ArchitectureVisual,
  DecisionVisual,
  SequenceVisual,
} from "../../types";

/** Diagram data for Agentic AI module 1. Reusable anywhere: pass to `visual()` or `<Visual config>`. */

/** Components of a single agent */
export const M1_COMPONENTS_OF_A_SINGLE_AGENT: ArchitectureVisual = {
  kind: "architecture",
  width: 760,
  height: 330,
  nodes: [
    {
      id: "rt",
      label: "Agent runtime",
      x: 170,
      y: 10,
      w: 400,
      h: 310,
      group: true,
    },
    {
      id: "user",
      label: "User / task",
      x: 10,
      y: 140,
      w: 130,
      tone: "muted",
      detail:
        "Supplies the goal and receives the result. May also approve risky actions mid-run.",
    },
    {
      id: "instr",
      label: "Instructions",
      sub: "role, rules, limits",
      x: 190,
      y: 40,
      detail:
        "The system prompt: who the agent is, what it may never do, how to format answers, when to stop or ask for help. Written by you, not the user.",
    },
    {
      id: "mem",
      label: "Memory & state",
      sub: "trace, facts",
      x: 410,
      y: 40,
      detail:
        "The run's trace (goal, steps, observations) plus any longer-term facts. The model forgets everything between calls; memory is how the runtime reminds it.",
    },
    {
      id: "ctx",
      label: "Context builder",
      sub: "what the model sees",
      x: 300,
      y: 140,
      w: 160,
      tone: "primary",
      detail:
        "Assembles instructions, goal, tool descriptions, relevant memory and recent observations into the prompt for this step, within a token budget.",
    },
    {
      id: "model",
      label: "Model",
      sub: "decides next step",
      x: 190,
      y: 250,
      tone: "primary",
      detail:
        "Reads the context and returns either a tool call (structured) or a final answer. It proposes; it never executes.",
    },
    {
      id: "tools",
      label: "Tool layer",
      sub: "validate + execute",
      x: 410,
      y: 250,
      detail:
        "Validates the proposed call against a schema and permissions, executes it, and packages the result (or error) as an observation.",
    },
    {
      id: "env",
      label: "Environment",
      sub: "APIs, files, web, DB",
      x: 610,
      y: 250,
      tone: "muted",
      detail:
        "The world the agent can observe and change. Its properties, trusted or not, reversible or not, shape how cautious the tool layer must be.",
    },
    {
      id: "out",
      label: "Result",
      x: 10,
      y: 250,
      w: 130,
      tone: "success",
      detail:
        "The final answer, plus ideally the evidence and any caveats. Returned when the model stops calling tools or a limit is hit.",
    },
  ],
  edges: [
    { from: "user", to: "ctx", label: "goal" },
    { from: "instr", to: "ctx" },
    { from: "mem", to: "ctx" },
    { from: "ctx", to: "model", label: "prompt" },
    { from: "model", to: "tools", label: "tool call" },
    { from: "tools", to: "env", label: "act" },
    { from: "env", to: "mem", label: "observation", elbow: "vh" },
    { from: "model", to: "out" },
  ],
  scenarios: [
    {
      name: "One iteration",
      steps: [
        {
          nodes: ["user", "ctx"],
          edges: [["user", "ctx"]],
          text: "The task arrives and is recorded as the run's goal.",
        },
        {
          nodes: ["instr", "mem", "ctx"],
          edges: [
            ["instr", "ctx"],
            ["mem", "ctx"],
          ],
          text: "The context builder merges instructions, the goal and what memory already holds, trimmed to fit the budget.",
        },
        {
          nodes: ["ctx", "model"],
          edges: [["ctx", "model"]],
          text: 'The model reads that context, and nothing else, and proposes `search_logs(service="checkout")`.',
        },
        {
          nodes: ["model", "tools"],
          edges: [["model", "tools"]],
          text: "The tool layer checks the call against the schema and the agent's permissions before anything runs.",
        },
        {
          nodes: ["tools", "env"],
          edges: [["tools", "env"]],
          text: "Validated, the call executes against the real system.",
        },
        {
          nodes: ["env", "mem"],
          edges: [["env", "mem"]],
          text: "The result is written to the trace as an observation.",
        },
        {
          nodes: ["mem", "ctx", "model"],
          edges: [
            ["mem", "ctx"],
            ["ctx", "model"],
          ],
          text: "Next iteration: the new observation is in context, so the model's next decision can depend on it.",
        },
        {
          nodes: ["model", "out"],
          edges: [["model", "out"]],
          text: "Eventually the model answers without a tool call and the loop ends.",
          tone: "success",
        },
      ],
    },
  ],
};

/** Should this be an agent? */
export const M1_SHOULD_THIS_BE_AN_AGENT: DecisionVisual = {
  kind: "decision",
  start: "fixed",
  nodes: {
    fixed: {
      question: "Can you write down the exact steps before seeing the input?",
      options: [
        { label: "Yes", next: "judg" },
        { label: "No, they depend on what we find", next: "risk" },
      ],
    },
    judg: {
      question: "Does any step need language understanding or judgement?",
      options: [
        { label: "No", next: "code" },
        { label: "Yes", next: "wf" },
      ],
    },
    code: {
      outcome: "Plain code",
      text: "Deterministic software. Cheaper, faster, exactly testable. A model adds nothing but cost and variance.",
      tone: "success",
    },
    wf: {
      outcome: "Workflow with model steps",
      text: "Keep the path in code and call a model inside individual steps (classify, extract, draft). You get language ability without giving up control of the order.",
      tone: "success",
    },
    risk: {
      question: "Could a wrong action cause real harm or be hard to undo?",
      options: [
        { label: "Yes", next: "hitl" },
        { label: "No / easily reversible", next: "lat" },
      ],
    },
    hitl: {
      outcome: "Agent with human approval",
      text: "Let the agent investigate and propose, but gate consequential actions behind explicit approval and narrow permissions.",
      tone: "accent",
    },
    lat: {
      question:
        "Can users wait several seconds and tolerate occasional imperfect answers?",
      options: [
        { label: "Yes", next: "agent" },
        { label: "No", next: "hybrid" },
      ],
    },
    agent: {
      outcome: "Agent",
      text: "A bounded tool loop is justified. Add step, time and cost limits from day one.",
      tone: "success",
    },
    hybrid: {
      outcome: "Hybrid: workflow with one agentic step",
      text: "Keep the latency-critical path deterministic and allow agentic exploration only where it pays off, perhaps asynchronously.",
      tone: "accent",
    },
  },
};

/** Research agent, message sequence */
export const M1_RESEARCH_AGENT_MESSAGE_SEQUENCE: SequenceVisual = {
  kind: "sequence",
  actors: [
    { id: "user", label: "User" },
    { id: "rt", label: "Agent runtime" },
    { id: "llm", label: "Model" },
    { id: "search", label: "Search tool" },
    { id: "read", label: "Page reader" },
  ],
  scenarios: [
    {
      name: "Straightforward run",
      messages: [
        { from: "user", to: "rt", label: "research question" },
        { from: "rt", to: "llm", label: "goal + tools" },
        {
          from: "llm",
          to: "rt",
          label: "plan: search official + legal analysis",
          style: "return",
          note: "A small explicit plan keeps later steps focused.",
        },
        {
          from: "rt",
          to: "search",
          label: 'search("DPDP rules 2025 notified")',
        },
        { from: "search", to: "rt", label: "8 results", style: "return" },
        { from: "rt", to: "llm", label: "observations" },
        {
          from: "llm",
          to: "rt",
          label: "read 2 primary sources",
          style: "return",
          note: "The model prefers primary sources, because the instructions told it to.",
        },
        { from: "rt", to: "read", label: "fetch(url₁), fetch(url₂)" },
        { from: "read", to: "rt", label: "extracted text", style: "return" },
        { from: "rt", to: "llm", label: "observations" },
        {
          from: "llm",
          to: "rt",
          label: "report with citations",
          style: "return",
        },
        { from: "rt", to: "user", label: "report + caveats", style: "return" },
      ],
    },
    {
      name: "Weak first search",
      messages: [
        { from: "user", to: "rt", label: "research question" },
        { from: "rt", to: "llm", label: "goal + tools" },
        {
          from: "llm",
          to: "rt",
          label: 'search("privacy law India")',
          style: "return",
        },
        { from: "rt", to: "search", label: "search" },
        {
          from: "search",
          to: "rt",
          label: "mostly 2019 articles",
          style: "error",
          note: "Results are stale, the observation says so via dates.",
        },
        { from: "rt", to: "llm", label: "observations" },
        {
          from: "llm",
          to: "rt",
          label: 'refine: add year + "rules notified"',
          style: "return",
          note: "This replanning is the agent's value. A fixed pipeline would summarise stale articles.",
        },
        { from: "rt", to: "search", label: "search(refined)" },
        { from: "search", to: "rt", label: "current results", style: "return" },
        { from: "rt", to: "llm", label: "observations" },
        {
          from: "llm",
          to: "rt",
          label: "report, flags uncertainty",
          style: "return",
        },
        { from: "rt", to: "user", label: "report + caveats", style: "return" },
      ],
    },
  ],
};
