import type {
  ArchitectureVisual,
  DecisionVisual,
  FlowVisual,
} from "../../types";

/** Diagram data for Agentic AI module 3. Reusable anywhere: pass to `visual()` or `<Visual config>`. */

/** Tool registry and selection */
export const M3_TOOL_REGISTRY_AND_SELECTION: ArchitectureVisual = {
  kind: "architecture",
  width: 780,
  height: 360,
  nodes: [
    {
      id: "q",
      label: "Student question",
      x: 10,
      y: 150,
      w: 140,
      tone: "muted",
      detail:
        "Natural language. The model must map it to zero, one or several tool calls.",
    },
    {
      id: "model",
      label: "Model",
      sub: "chooses tool + args",
      x: 190,
      y: 150,
      w: 140,
      tone: "primary",
      detail:
        "Reads the tool list (names, descriptions, schemas) and proposes a call. It can only choose tools the registry advertised.",
    },
    {
      id: "reg",
      label: "Registry",
      x: 370,
      y: 10,
      w: 190,
      h: 340,
      group: true,
    },
    {
      id: "t1",
      label: "get_timetable",
      sub: "read · auto",
      x: 390,
      y: 40,
      w: 150,
      detail:
        "Schema: `{ week?: ISO week }`. Student id injected from session. Safe to run without approval.",
    },
    {
      id: "t2",
      label: "list_assignments",
      sub: "read · auto",
      x: 390,
      y: 115,
      w: 150,
      detail:
        "Schema: `{ course_code?: /^[A-Z]{2,4}\\d{3}$/, due_before?: date }`. Returns ≤ 10 rows with title, due, brief.",
    },
    {
      id: "t3",
      label: "search_course_docs",
      sub: "read · auto",
      x: 390,
      y: 190,
      w: 150,
      detail:
        "Schema: `{ course_code, query (≤ 200 chars) }`. Only searches courses the student is enrolled in.",
    },
    {
      id: "t4",
      label: "create_reminder",
      sub: "write · confirm",
      x: 390,
      y: 265,
      w: 150,
      tone: "accent",
      detail:
        "Schema: `{ title ≤ 80 chars, at: future datetime }`. Requires an idempotency key; runtime asks the student to confirm.",
    },
    {
      id: "val",
      label: "Validate",
      sub: "schema + policy",
      x: 600,
      y: 110,
      w: 160,
      detail:
        "Parses arguments against the JSON Schema, applies policy (scope, approval), then executes with a timeout.",
    },
    {
      id: "res",
      label: "Observation",
      sub: "trimmed result",
      x: 600,
      y: 220,
      w: 160,
      tone: "success",
      detail: "What the model sees next: shaped result or typed error.",
    },
  ],
  edges: [
    { from: "q", to: "model" },
    { from: "model", to: "t1", dashed: true },
    { from: "model", to: "t2", dashed: true },
    { from: "model", to: "t3", dashed: true },
    { from: "model", to: "t4", dashed: true },
    { from: "t2", to: "val" },
    { from: "t4", to: "val" },
    { from: "val", to: "res" },
  ],
  scenarios: [
    {
      name: '"When is DBMS due?"',
      steps: [
        {
          nodes: ["q", "model"],
          edges: [["q", "model"]],
          text: "The model reads the question and the four tool descriptions.",
        },
        {
          nodes: ["model", "t2"],
          edges: [["model", "t2"]],
          text: 'It selects `list_assignments(course_code="CS304")`: the most specific tool, as instructed.',
        },
        {
          nodes: ["t2", "val"],
          edges: [["t2", "val"]],
          text: "`CS304` matches the course-code pattern; the student is enrolled; read tool → no approval needed.",
        },
        {
          nodes: ["val", "res"],
          edges: [["val", "res"]],
          text: "Result: *ER modelling assignment, due Fri 3 Oct 23:59*. The model answers and cites the assignment.",
          tone: "success",
        },
      ],
    },
    {
      name: '"Remind me tomorrow 8am"',
      steps: [
        {
          nodes: ["q", "model"],
          edges: [["q", "model"]],
          text: "The student explicitly asks for a reminder.",
        },
        {
          nodes: ["model", "t4"],
          edges: [["model", "t4"]],
          text: 'The model proposes `create_reminder(title="DBMS assignment", at="2026-10-01T08:00+05:30")`.',
        },
        {
          nodes: ["t4", "val"],
          edges: [["t4", "val"]],
          text: "Schema passes. Policy marks it a write action → the runtime asks the student to confirm.",
          tone: "accent",
        },
        {
          nodes: ["val", "res"],
          edges: [["val", "res"]],
          text: "Confirmed; the reminder is created once, even if the call is retried, thanks to the idempotency key.",
          tone: "success",
        },
      ],
    },
    {
      name: "Invented argument",
      steps: [
        {
          nodes: ["model", "t2"],
          edges: [["model", "t2"]],
          text: 'The model proposes `list_assignments(course="Databases")`: wrong field name, not a code.',
          tone: "danger",
        },
        {
          nodes: ["t2", "val"],
          edges: [["t2", "val"]],
          text: "Validation fails: unknown property `course`; `course_code` must match `^[A-Z]{2,4}\\d{3}$`.",
          tone: "danger",
        },
        {
          nodes: ["val", "res"],
          edges: [["val", "res"]],
          text: "The runtime returns a **typed error observation** listing the valid field. The model corrects itself on the next step, no crash, no guesswork.",
          tone: "accent",
        },
      ],
    },
  ],
};

/** The runtime loop, step by step */
export const M3_THE_RUNTIME_LOOP_STEP_BY_STEP: FlowVisual = {
  kind: "flow",
  loop: {
    label: "Observation appended → back to the limits check for the next step.",
  },
  steps: [
    {
      label: "Limits",
      detail:
        "Deadline and step budget checked *before* spending on another model call.",
    },
    {
      label: "Decide",
      detail:
        "`call_model` receives instructions, messages and tool specs generated from the registry.",
    },
    {
      label: "Final?",
      detail:
        "No tool call means the model considers the question answered → finish with status `done`.",
      tone: "success",
    },
    {
      label: "Repeat?",
      detail:
        "An identical call seen before means no progress → finish with status `stuck`.",
    },
    {
      label: "Validate",
      detail:
        "Unknown tool or invalid arguments → typed error observation, not an exception.",
    },
    {
      label: "Confirm",
      detail: "Write tools ask the human. A decline is also an observation.",
      tone: "accent",
    },
    {
      label: "Execute",
      detail:
        "The implementation runs with the injected context (student id, connections).",
    },
    {
      label: "Observe",
      detail: "Result or error is traced, truncated and appended to messages.",
    },
  ],
};

/** Who handles this error? */
export const M3_WHO_HANDLES_THIS_ERROR: DecisionVisual = {
  kind: "decision",
  start: "kind",
  nodes: {
    kind: {
      question: "What went wrong?",
      options: [
        { label: "Network blip / 503 / rate limit", next: "transient" },
        { label: "Invalid or missing arguments", next: "args" },
        { label: "Not found / empty result", next: "empty" },
        { label: "Permission denied / declined", next: "denied" },
      ],
    },
    transient: {
      question: "Is the call idempotent (safe to repeat)?",
      options: [
        { label: "Yes", next: "retry" },
        { label: "No (a write without idempotency key)", next: "noretry" },
      ],
    },
    retry: {
      outcome: "Runtime retries, invisibly",
      text: 'Retry 2–3 times with exponential backoff and jitter *inside the tool executor*. Only if all retries fail, return `{ok:false, error:"unavailable", retryable:false}` so the model can tell the user honestly.',
      tone: "success",
    },
    noretry: {
      outcome: "Do not blindly retry",
      text: "Repeating a non-idempotent write can double-charge or double-send. Add an idempotency key to the tool, or surface the failure and let a human decide.",
      tone: "danger",
    },
    args: {
      outcome: "Model corrects itself",
      text: "Return a precise, typed validation error naming the bad field and the expected format. Models fix these reliably on the next step, as long as the message is specific.",
      tone: "success",
    },
    empty: {
      outcome: "Model decides what's next",
      text: 'An empty result is *information*, not failure. Return `ok:true, data:[]` with a hint ("no assignments due before 1 Oct"). The model may broaden the search or answer that nothing was found.',
      tone: "success",
    },
    denied: {
      outcome: "Model adapts or escalates",
      text: "Return the refusal as an observation so the model does not assume success. It should offer an alternative or explain what the user can do instead.",
      tone: "accent",
    },
  },
};
