import type { ClassifyVisual, OrbitVisual } from "../../types";

/** Course hero: the agent loop as an orbit around the agent. */
export const AGENTIC_HERO_ORBIT: OrbitVisual = {
  kind: "orbit",
  center: "Agent",
  nodes: [
    { label: "Goal", detail: "A task arrives as an outcome to achieve, not a script of steps." },
    { label: "Plan", detail: "The model reads its context and decides the most useful next action." },
    { label: "Act", detail: "The runtime validates the proposed tool call and executes it against the real world." },
    { label: "Observe", detail: "The result comes back as an observation, success or typed error." },
    { label: "Remember", detail: "State and memory are updated, so the next decision builds on what was learned." },
    { label: "Check", detail: "Limits, guardrails and evaluation decide: go round again, ask a human, or finish." },
  ],
};

export const M1_CODE_WORKFLOW_OR_AGENT: ClassifyVisual = {
  kind: "classify",
  buckets: [
    { id: "code", label: "Plain code" },
    { id: "wf", label: "Workflow" },
    { id: "agent", label: "Agent" },
  ],
  items: [
    { text: "Convert invoice amounts from USD to INR at the daily rate", bucket: "code", why: "Pure arithmetic with a lookup. A model adds cost and risk with no benefit." },
    { text: "Transcribe each lecture recording, summarise it and email the notes", bucket: "wf", why: "The steps never change; model calls live inside fixed steps." },
    { text: "Figure out why last night's deploy broke sign-in and propose a fix", bucket: "agent", why: "Each check depends on what the previous one revealed. The path must be discovered." },
    { text: "Classify support emails into six queues", bucket: "wf", why: "One model step plus a routing table. Predictable and testable." },
    { text: "Validate that a phone number has 10 digits", bucket: "code", why: "A regular expression answers this exactly, every time." },
    { text: "Answer open research questions across internal docs, tickets and two APIs", bucket: "agent", why: "Which source to try next depends on the question and the partial answers found so far." },
  ],
};

export const M2_WHICH_COMPONENT_OWNS_IT: ClassifyVisual = {
  kind: "classify",
  buckets: [
    { id: "orch", label: "Orchestrator" },
    { id: "ctx", label: "Context builder" },
    { id: "policy", label: "Policy" },
    { id: "exec", label: "Tool executor" },
  ],
  items: [
    { text: "Stop the run after 8 steps or ₹20 of spend", bucket: "orch", why: "Limits and termination belong to the loop owner." },
    { text: "Drop raw history and keep a 600-token summary when the budget is tight", bucket: "ctx", why: "Selecting and compressing what the model sees is the context builder's job." },
    { text: "Refuse a refund above ₹5,000 without approval", bucket: "policy", why: "Deterministic permission rules sit between the model and the tools." },
    { text: "Retry a 503 twice with backoff before reporting it", bucket: "exec", why: "Transient infrastructure failures are handled where the call is made." },
    { text: "Pause the run while a manager reviews a proposed action", bucket: "orch", why: "Pausing, persisting and resuming the run is loop control." },
    { text: "Trim a 40 KB API response to the five fields the next decision needs", bucket: "exec", why: "Shaping results into compact observations happens when the tool returns." },
  ],
};

export const M3_WHO_HANDLES_THE_ERROR: ClassifyVisual = {
  kind: "classify",
  buckets: [
    { id: "runtime", label: "Runtime, invisibly" },
    { id: "model", label: "Model, next step" },
    { id: "human", label: "User or human" },
  ],
  items: [
    { text: "The assignments API times out once, then succeeds", bucket: "runtime", why: "A transient failure on an idempotent read: retry in the executor; the model never needs to know." },
    { text: "The model sends `course: \"Databases\"` instead of `course_code: \"CS304\"`", bucket: "model", why: "Return a precise validation error; models fix these reliably on the next step." },
    { text: "The student asks for an extension on a deadline", bucket: "human", why: "A faculty decision. The agent should route it, not decide it." },
    { text: "A search returns zero assignments due this week", bucket: "model", why: "An empty result is information. The model can broaden the search or report that nothing is due." },
    { text: "The student declines the proposed reminder", bucket: "model", why: "Feed the decline back as an observation so the model does not assume the reminder exists." },
    { text: "The timetable service has been down for an hour", bucket: "human", why: "After retries and the breaker, tell the user plainly that timetables are unavailable right now." },
  ],
};

export const M5_ONE_AGENT_OR_MANY: ClassifyVisual = {
  kind: "classify",
  buckets: [
    { id: "single", label: "Single agent" },
    { id: "workflow", label: "Workflow + reviewer step" },
    { id: "multi", label: "Multi-agent" },
  ],
  items: [
    { text: "Fix a small bug and run the tests", bucket: "single", why: "Narrow task, one context. Extra agents add handoff losses and cost." },
    { text: "Compare 12 vendors across pricing, security and reviews in one report", bucket: "multi", why: "Broad, parallel research that would overflow one context: supervisor plus workers." },
    { text: "Draft a blog post and check it against a style guide", bucket: "workflow", why: "Generate then check. A fixed reviewer step does this without agent dialogue." },
    { text: "Answer a customer's order-status question", bucket: "single", why: "One or two tool calls. No coordination needed." },
    { text: "Security, cost and operations critique a design proposal", bucket: "multi", why: "The value is in perspectives responding to each other: a peer design with a termination rule." },
  ],
};

export const M6_WHICH_MEMORY: ClassifyVisual = {
  kind: "classify",
  buckets: [
    { id: "working", label: "Working" },
    { id: "episodic", label: "Episodic" },
    { id: "semantic", label: "Semantic" },
    { id: "procedural", label: "Procedural" },
  ],
  items: [
    { text: "The plan for the current task and the last tool result", bucket: "working", why: "Lives only for this run; always in context, trimmed as it grows." },
    { text: "\"Last month the student skipped every Sunday session\"", bucket: "episodic", why: "A record of what happened in past runs, retrieved by similarity." },
    { text: "\"Prefers 30-minute sessions (stated 2 Oct)\"", bucket: "semantic", why: "A durable fact with provenance, read by key and superseded when it changes." },
    { text: "The playbook for building a spaced-repetition schedule", bucket: "procedural", why: "How to do a task: selected by task type, not by similarity." },
    { text: "The refund policy passages from the company handbook", bucket: "semantic", why: "Organisational knowledge, reached through retrieval." },
    { text: "\"Tried keyword search first last time; it missed synonyms\"", bucket: "episodic", why: "A lesson from a past attempt, useful on similar future tasks." },
  ],
};

export const M7_APPROVAL_TIER: ClassifyVisual = {
  kind: "classify",
  buckets: [
    { id: "auto", label: "Automatic" },
    { id: "confirm", label: "User confirms" },
    { id: "approver", label: "Designated approver" },
    { id: "never", label: "Not available" },
  ],
  items: [
    { text: "Look up the requesting customer's own orders", bucket: "auto", why: "Read-only and scoped to the user's permissions in code." },
    { text: "Send the itinerary email to the user who asked for it", bucket: "confirm", why: "A side effect, but bounded to the requester: show a summary and let them confirm." },
    { text: "Refund ₹48,000 on a disputed enterprise invoice", bucket: "approver", why: "High impact and hard to reverse; someone other than the requester must review the evidence." },
    { text: "Export the full customer database as CSV", bucket: "never", why: "No task justifies it. The safest control is not exposing the capability at all." },
    { text: "Save a draft reply in the support tool", bucket: "auto", why: "Internal, reversible and visible to a human before sending." },
    { text: "Change the bank account on a supplier record", bucket: "approver", why: "A classic fraud target. Always requires verified human approval." },
  ],
};
