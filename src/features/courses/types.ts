/**
 * Course content model. A course is plain, serialisable data: modules are
 * ordered lists of blocks, and every interactive visual is a `VisualConfig`
 * that names a reusable renderer (`kind`) plus the data it needs. Nothing in
 * here may hold a function, so blocks can cross the Server → Client boundary.
 *
 * Inline text in any `string` field supports a tiny markup:
 * **bold**, *emphasis*, `code`, [label](https://url).
 */

export type Tone =
  "primary" | "neutral" | "accent" | "danger" | "success" | "muted";

// ── Visuals ──────────────────────────────────────────────────────────────────

export type FlowStep = {
  label: string;
  detail: string;
  /** Optional key/value snapshot shown beside the step (agent state, context …). */
  state?: Record<string, string>;
  tone?: Tone;
};

export type FlowVisual = {
  kind: "flow";
  steps: FlowStep[];
  /** Draw a return arrow and keep cycling when played. */
  loop?: { label: string };
  /** Title for the state panel when steps carry `state`. */
  stateTitle?: string;
};

export type DiagramNode = {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  tone?: Tone;
  /** Containers are drawn behind other nodes and are not edge endpoints. */
  group?: boolean;
  /** Shown in the inspector when the node is selected. */
  detail?: string;
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  /** Draw as a right-angle path instead of a straight line. */
  elbow?: "hv" | "vh";
};

export type DiagramScenario = {
  name: string;
  steps: {
    nodes: string[];
    edges?: [string, string][];
    text: string;
    tone?: Tone;
  }[];
};

export type ArchitectureVisual = {
  kind: "architecture";
  width: number;
  height: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  scenarios?: DiagramScenario[];
};

export type SequenceMessage = {
  from: string;
  to: string;
  label: string;
  note?: string;
  style?: "call" | "return" | "error" | "self";
};

export type SequenceVisual = {
  kind: "sequence";
  actors: { id: string; label: string }[];
  scenarios: { name: string; messages: SequenceMessage[] }[];
};

export type CompareVisual = {
  kind: "compare";
  options: { id: string; label: string; summary: string }[];
  dimensions: { label: string; values: Record<string, string> }[];
  /** Situations the learner can pick; each names the better option and why. */
  situations?: { label: string; best: string; why: string }[];
};

export type DecisionNode =
  | { question: string; options: { label: string; next: string }[] }
  | { outcome: string; text: string; tone?: Tone };

export type DecisionVisual = {
  kind: "decision";
  start: string;
  nodes: Record<string, DecisionNode>;
};

export type BudgetVisual = {
  kind: "budget";
  unit: string;
  min: number;
  max: number;
  initial: number;
  items: {
    label: string;
    cost: number;
    priority: number;
    required?: boolean;
    note: string;
  }[];
};

export type ResilienceVisual = {
  kind: "resilience";
  dependency: string;
  /** Initial failure probability 0–1. */
  failureRate: number;
};

export type OrbitVisual = {
  kind: "orbit";
  center: string;
  nodes: { label: string; detail: string }[];
};

/** Sort items into buckets; each item has one correct bucket and a reason. */
export type ClassifyVisual = {
  kind: "classify";
  buckets: { id: string; label: string }[];
  items: { text: string; bucket: string; why: string }[];
};

export type VisualConfig =
  | FlowVisual
  | ArchitectureVisual
  | SequenceVisual
  | CompareVisual
  | DecisionVisual
  | BudgetVisual
  | ResilienceVisual
  | OrbitVisual
  | ClassifyVisual;

// ── Blocks ───────────────────────────────────────────────────────────────────

export type QuizQuestion = {
  q: string;
  options: string[];
  answer: number;
  why: string;
};

export type Reference = {
  title: string;
  source: string;
  url: string;
  note?: string;
};

export type Block =
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | {
      type: "callout";
      tone: "note" | "tip" | "warn" | "example";
      title?: string;
      text: string;
    }
  | { type: "table"; head: string[]; rows: string[][]; caption?: string }
  | {
      type: "code";
      lang: string;
      label: string;
      code: string;
      caption?: string;
    }
  | {
      type: "visual";
      title: string;
      /** What can the learner do with it, shown above the visual. */
      howTo: string;
      /** What the learner should take away, shown below. */
      caption: string;
      visual: VisualConfig;
    }
  | { type: "quiz"; questions: QuizQuestion[] }
  | {
      type: "exercise";
      title: string;
      brief: string;
      tasks: string[];
      hints?: string[];
      model?: string[];
    }
  | { type: "takeaways"; items: string[] }
  | { type: "references"; items: Reference[] };

export type CourseModule = {
  slug: string;
  number: number;
  title: string;
  summary: string;
  minutes: number;
  blocks: Block[];
};

export type Course = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  level: string;
  outcomes: string[];
  /** Skills a candidate earns on completing every module (shown in the hero). */
  skills: string[];
  /** Interactive loop shown in the course hero. */
  hero: OrbitVisual;
  modules: CourseModule[];
};
