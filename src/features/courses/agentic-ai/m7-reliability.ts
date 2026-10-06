import type { CourseModule } from "../types";
import {
  h2,
  h3,
  p,
  ul,
  note,
  tip,
  warn,
  example,
  table,
  code,
  visual,
  quiz,
  takeaways,
  refs,
  exercise,
} from "../blocks";
import { R } from "../references";
import { M7_APPROVAL_TIER } from "../assets/visuals/interactive";
import {
  M7_DETERMINISTIC_VS_PROBABILISTIC_COMPONENTS,
  M7_DEFENCE_IN_DEPTH_FOR_AN_AGENT,
  M7_VALIDATION_PIPELINE_FOR_A_PROPOSED_ACTION,
  M7_RESILIENCE_LAB,
  M7_CIRCUIT_BREAKER_STATES,
  M7_WHICH_APPROVAL_TIER,
  M7_TRUST_BOUNDARIES,
  M7_ANATOMY_OF_A_TRACE,
} from "../assets/visuals/m7";

export const m7: CourseModule = {
  slug: "reliability",
  number: 7,
  title: "Reliable & Trustworthy Agents",
  summary:
    "Engineering agents you can ship: validation, guardrails, retries, timeouts, circuit breakers, permissions, prompt-injection defence, evaluation and observability.",
  minutes: 32,
  blocks: [
    h2("why", "Reliability is a system property"),
    p(
      "A model that is right 95% of the time sounds good until it runs ten steps: if errors were independent, the chance that all ten are right is about 60%. Real agents also depend on flaky networks, rate-limited APIs, stale data and inputs written by people who may be trying to manipulate them.",
    ),
    p(
      "You cannot make the model perfect. You can make the **system** reliable, in the same way distributed systems are made reliable out of unreliable machines: by assuming components fail, detecting failure quickly, containing it, recovering where possible, and making the rest visible. This module is that toolkit, applied to agents.",
    ),

    h2("determinism", "Probabilistic components in a deterministic shell"),
    p("Agents combine two kinds of component. Treat them differently."),
    visual(
      "Deterministic vs probabilistic components",
      "Pick a responsibility to see where it belongs.",
      M7_DETERMINISTIC_VS_PROBABILISTIC_COMPONENTS,
      "Push every decision that *can* be made deterministically into code. Reserve the model for the decisions only it can make, and wrap those in checks.",
    ),

    h2("architecture", "A reliability architecture"),
    p(
      "Defences are layered so that any single failure is caught by at least one other layer. Explore the layers and trace three different failures through them.",
    ),
    visual(
      "Defence in depth for an agent",
      "Click layers to see what each catches. Trace each scenario to see which layer stops it.",
      M7_DEFENCE_IN_DEPTH_FOR_AN_AGENT,
      "No single layer is perfect. Reliability comes from independent layers whose failure modes differ, so the same failure rarely passes all of them.",
    ),

    h2("validation", "Validation and structured outputs"),
    p(
      "Wherever a model's output is consumed by code, tool arguments, routing decisions, extracted fields, final answers, require **structured output** that conforms to a schema, and validate it. Many model APIs can constrain output to a JSON Schema; validate anyway, because business rules go beyond types.",
    ),
    visual(
      "Validation pipeline for a proposed action",
      "Step through the checks a proposed `issue_refund` call passes before execution.",
      M7_VALIDATION_PIPELINE_FOR_A_PROPOSED_ACTION,
      "Each check is cheap, deterministic and independently testable. Together they turn a model's suggestion into an action you can defend.",
    ),

    h2("guardrails", "Guardrails"),
    p(
      '"Guardrail" covers any check that keeps an agent within acceptable behaviour. They sit at three points:',
    ),
    table(
      ["Where", "Examples", "Implementation"],
      [
        [
          "Input",
          "Off-topic or abusive requests, personal data in prompts, injection markers",
          "Classifiers, rules, a small model call",
        ],
        [
          "Action",
          "Permission, limits, destructive operations, rate limits",
          "Deterministic policy code",
        ],
        [
          "Output",
          "Unsupported claims, leaked secrets or personal data, unsafe content, format",
          "Validators, grounding checks, classifiers",
        ],
      ],
    ),
    tip(
      "Model-based guardrails (a classifier model judging input or output) are useful but probabilistic. Use them to *reduce* bad cases; use deterministic action guardrails to *prevent* the ones that matter.",
    ),

    h2("resilience", "Retries, timeouts, circuit breakers and fallbacks"),
    p(
      "These four patterns come from distributed systems engineering and apply directly to agent tool calls:",
    ),
    ul(
      "**Timeout**: bound how long any call may take. Without one, a hung dependency hangs the agent and the user.",
      "**Retry with exponential backoff and jitter**: repeat transient failures after growing, slightly randomised delays, so retries do not arrive in synchronised waves. Only retry idempotent operations.",
      '**Circuit breaker**: after repeated failures, stop calling the dependency for a cooldown period and fail fast; then let one trial call through ("half-open") to test recovery.',
      '**Fallback**: a degraded but useful alternative: a cached value, a simpler model, a different provider, or an honest "not available right now".',
    ),
    p(
      "The lab below sends 20 requests to an unreliable dependency. Try each failure mode with no defences, then add them one at a time and watch success rate, load on the dependency and latency change.",
    ),
    visual(
      "Resilience lab",
      "Choose how the dependency misbehaves, toggle defences, then **Send 20 requests**. Run it several times, failures are random.",
      M7_RESILIENCE_LAB,
      "Things to notice: retries raise success on *flaky* dependencies but multiply calls during an *outage*; timeouts matter enormously when the dependency *hangs*; the breaker cuts load and latency during outages; fallbacks turn failures into degraded answers.",
    ),
    visual(
      "Circuit breaker states",
      "Step through the breaker's state machine.",
      M7_CIRCUIT_BREAKER_STATES,
      'A breaker converts a slow, repeated failure into a fast, explicit one, which the agent can reason about ("pricing is unavailable") instead of waiting on.',
    ),
    code(
      "python",
      "Python, educational resilient tool call",
      `
import random, time

class Breaker:
    def __init__(self, threshold=3, cooldown=30):
        self.threshold, self.cooldown = threshold, cooldown
        self.failures, self.opened_at = 0, None

    def allow(self) -> bool:
        if self.opened_at is None:
            return True
        return time.monotonic() - self.opened_at >= self.cooldown   # half-open trial

    def record(self, ok: bool):
        if ok:
            self.failures, self.opened_at = 0, None
        else:
            self.failures += 1
            if self.failures >= self.threshold:
                self.opened_at = time.monotonic()

def call_tool(fn, args, breaker, retries=2, timeout=3.0, fallback=None):
    if not breaker.allow():
        return fallback() if fallback else {"ok": False, "error": "unavailable", "retryable": False}
    for attempt in range(retries + 1):
        try:
            result = fn(**args, timeout=timeout)
            breaker.record(True)
            return {"ok": True, "data": result}
        except TransientError:
            breaker.record(False)
            if attempt < retries and breaker.allow():
                time.sleep((0.25 * 2 ** attempt) * random.uniform(0.5, 1.5))   # backoff + jitter
    return fallback() if fallback else {"ok": False, "error": "unavailable", "retryable": False}
`,
      "All of this lives in the tool executor. The model only ever sees a clean result or a typed `unavailable` observation.",
    ),

    h2("approval", "Human approval and tool permissions"),
    p(
      "Not every action needs a human, and gating everything produces approval fatigue. Tier actions by **reversibility** and **impact**.",
    ),
    visual(
      "Which approval tier?",
      "Classify an action your agent might take.",
      M7_WHICH_APPROVAL_TIER,
      "Permissions and tiers are configuration in code, reviewed like any security change, not sentences in a prompt.",
    ),
    ul(
      "**Least privilege**: each agent (and each role in a multi-agent system) gets only the tools and scopes its task needs.",
      "**Credentials stay in tools**, never in context. The model sees results, not keys.",
      "**Separate identities**: actions are taken as the user (delegated) or as a narrowly scoped service identity, and logged as such.",
    ),

    h2("security", "Security boundaries and prompt injection"),
    p(
      "**Prompt injection** is the attack where text in the model's input, typed by a user (direct) or embedded in content the agent reads, like a web page, email or document (indirect), is phrased as instructions and changes the model's behaviour. Because instructions and data share one channel (text), no known prompting technique prevents it completely. Model providers train models to prioritise system instructions over content, which helps, but the robust defence is architectural.",
    ),
    visual(
      "Trust boundaries",
      "Trace an indirect injection from an email the agent summarises.",
      M7_TRUST_BOUNDARIES,
      "Assume anything the model reads may control what it *proposes*. Design so that the most damaging proposal an attacker can cause is still acceptable.",
    ),
    h3("Practical defences"),
    ul(
      "**Capability minimisation per task**: a summarisation step should not have send, delete or payment tools available at all.",
      "**Separate reading from acting**: use one model call (no tools) to extract structured facts from untrusted content, and give only those facts to the step that can act.",
      "**Confirm side effects that cross trust boundaries**: sending externally, sharing data, spending money.",
      "**Output handling**: never pass model output into shells, SQL or HTML without escaping or parameterisation.",
      "**Limit exfiltration channels**: watch for URLs, images or links built from private data in outputs.",
      "**Test adversarially**: keep a suite of injection attempts and run it on every prompt or model change.",
    ),

    h2("hallucination", "Hallucinations and tool misuse"),
    p(
      "In agents, hallucination takes several forms: inventing facts, misreading tool results, claiming an action succeeded when it failed, or fabricating tool arguments (an order id that was never seen). Mitigations that work in practice:",
    ),
    ul(
      "**Ground in observations**: require cited facts to appear in tool results; check it in code.",
      "**Referential validation**: every id in a tool call must have appeared in a previous observation or the user's input.",
      "**Verify actions**: after a write, read back the state rather than trusting the model's claim of success.",
      '**Permit uncertainty**: instruct and evaluate for "I couldn\'t find that" as a correct answer.',
    ),

    h2("evaluation", "Evaluation"),
    p(
      "You cannot improve what you do not measure, and agents are too variable to judge from a few demos. Build an **evaluation set** of realistic tasks with success criteria and run it on every change to prompts, tools, models or retrieval.",
    ),
    table(
      ["What to measure", "How"],
      [
        [
          "Task success",
          "Deterministic checks where possible (tests pass, correct record updated); rubric-based model grading otherwise, spot-checked by humans",
        ],
        [
          "Tool correctness",
          "Right tool, valid arguments, no forbidden calls, from traces",
        ],
        ["Groundedness", "Claims supported by observations or sources"],
        [
          "Safety",
          "Adversarial set: injection, out-of-scope, data-leak attempts must be refused",
        ],
        ["Efficiency", "Steps, tokens, latency, cost per task"],
        ["Consistency", "Pass rate across repeated runs of the same task"],
      ],
    ),
    note(
      'Model-graded evaluation ("LLM-as-a-judge") scales well and correlates reasonably with human judgement on many tasks, but graders have biases, for example towards longer answers or their own style. Calibrate graders against human labels on a sample, and prefer deterministic checks whenever the outcome can be checked by code.',
    ),

    h2("observability", "Observability: tracing and monitoring"),
    p(
      "When something goes wrong in production you need to reconstruct the run: what the model saw, what it proposed, what was allowed, what the tools returned, how long each step took. That is **tracing**: a tree of spans per run, each with timing and attributes.",
    ),
    visual(
      "Anatomy of a trace",
      "Step through the spans recorded for one run. The panel shows attributes captured on each span.",
      M7_ANATOMY_OF_A_TRACE,
      'With traces like this, "the agent gave a wrong answer" becomes "step 2 ran on a stale search result", a fixable bug.',
    ),
    ul(
      "**Metrics**: task success rate, escalation rate, tool error rates, breaker state, p50/p95 latency, tokens and cost per task.",
      "**Alerts**: error-rate spikes, cost anomalies, surges in policy denials (often an attack or a regression).",
      "**Feedback loops**: sample production traces for review; turn failures into new evaluation cases.",
      "**Standards**: OpenTelemetry has published semantic conventions for generative-AI spans, which helps traces work across tools.",
    ),
    warn(
      "Traces contain prompts, user data and tool outputs. Redact, restrict access and set retention. Your observability store must meet the same privacy bar as your database.",
      "Traces are sensitive",
    ),

    h2("propagation", "Failure propagation"),
    p(
      "Failures compound across steps: a timeout becomes a missing observation, which becomes a guessed value, which becomes a wrong action. The discipline that stops this is simple to state: **every step must either produce a verified result or an explicit, typed failure**: never a silent gap the next step fills with a guess.",
    ),
    example(
      'A travel agent\'s fare API times out. Without typed failures, the model sees an empty result, assumes "no flights", and books a train the user did not want. With a typed `unavailable` observation, it tells the user fares could not be checked and offers to retry, a worse experience than success, but far better than a wrong booking.',
      "Silent gaps become wrong actions",
    ),

    visual("Sort it: which approval tier?", "Assign each action the lightest control that is still safe.", M7_APPROVAL_TIER, "Tiering by reversibility and impact keeps humans focused on the decisions that need them, and removes capabilities nobody should have."),

    h2("takeaways", "Key takeaways"),
    takeaways(
      "Reliability comes from the system around the model: deterministic checks, layered defences, visibility.",
      "Validate every model output that code consumes: schema, references, business rules, policy.",
      "Apply timeouts, retries with backoff and jitter (idempotent calls only), circuit breakers and fallbacks in the tool executor.",
      "Tier actions by reversibility and impact; enforce permissions and approvals in code.",
      "Assume prompt injection will sometimes succeed at the model level; minimise capabilities so the worst outcome is acceptable.",
      "Evaluate continuously and trace every run; turn production failures into test cases.",
    ),

    h2("exercise", "Exercise: a reliability review"),
    exercise({
      title: "Harden a travel-booking agent",
      brief:
        "The agent searches flights and hotels, holds bookings, charges the user's saved card, and emails the itinerary. It reads airline pages and user emails for context.",
      tasks: [
        "Assign each tool to an approval tier and justify it.",
        "Identify two prompt-injection paths (direct and indirect) and the architectural control that limits each.",
        "Specify timeout, retry, breaker and fallback settings for the fare-search API, and what the user sees when the breaker is open.",
        "Write three validation rules for `charge_card` that are independent of the model.",
        "Define five evaluation cases (one adversarial) with pass criteria, and three production metrics with alert thresholds.",
        "Trace one failure scenario end to end and show where it is contained.",
      ],
      hints: [
        "Charging a card is irreversible for the user in practice, who confirms, and with what summary?",
        "Airline pages are third-party content; what tools should be available while reading them?",
      ],
      model: [
        "Search = tier 0; hold = tier 1 (auto-expiring); charge = tier 2 user confirmation with total and refund policy; external email = confirmation.",
        "Reading steps run without payment or email tools; only extracted fields reach the booking step.",
        "`charge_card`: amount equals the held fare total; currency matches; idempotency key per booking.",
        "Alerts on payment-denial spikes, breaker open duration and cost per booking.",
      ],
    }),

    h2("quiz", "Knowledge check"),
    quiz(
      {
        q: "An agent reads supplier invoices from email and can pay them. A malicious invoice contains instructions to pay a different bank account. What is the strongest control?",
        options: [
          "A system prompt telling the model to ignore instructions in emails",
          "An input classifier for suspicious text",
          "Payment code that only pays bank accounts already on the verified supplier record, with approval for any change",
          "A larger, more capable model",
        ],
        answer: 2,
        why: "The prompt and classifier reduce risk but can be bypassed. A deterministic rule on payee accounts makes the attack ineffective regardless of what the model is persuaded to propose.",
      },
      {
        q: "A dependency is completely down. Your agent retries 3 times with backoff on every request. What happens, and what fixes it?",
        options: [
          "Success improves; nothing to fix",
          "Each request is slow and the dead service gets 4× the traffic; a circuit breaker should fail fast after repeated failures",
          "Requests succeed from cache automatically",
          "The model learns to stop calling it",
        ],
        answer: 1,
        why: "Retries help transient blips but amplify load and latency during outages. Breakers detect sustained failure and short-circuit.",
      },
      {
        q: "The model's final answer includes a delivery date that appears in no tool result. Which mechanism catches this deterministically?",
        options: [
          "A grounding check that verifies cited facts appear in observations",
          "Temperature 0",
          "A longer system prompt",
          "Retrying the model call",
        ],
        answer: 0,
        why: "Checking specifics against observations is cheap and deterministic. Temperature 0 reduces variance but does not prevent invention.",
      },
      {
        q: "Which is the best approval design for an agent that can (a) look up orders, (b) draft replies, (c) refund up to ₹2,000, (d) refund any amount?",
        options: [
          "Approve everything",
          "(a) automatic; (b) automatic with human send or undo; (c) user confirmation within the policy limit; (d) not available to the agent, or designated approver only",
          "Approve nothing; trust the model",
          "Only approve (a)",
        ],
        answer: 1,
        why: "Tiering by reversibility and impact keeps humans focused on consequential actions and prevents approval fatigue.",
      },
      {
        q: "After a prompt change, customer complaints rise but you cannot tell which runs went wrong or why. What was missing?",
        options: [
          "A bigger evaluation set only",
          "Per-run tracing with prompt version, decisions, tool results and outcomes, plus a regression evaluation before release",
          "More tools",
          "A circuit breaker",
        ],
        answer: 1,
        why: "Tracing makes failures diagnosable; running evaluations before release would likely have caught the regression.",
      },
      {
        q: "You use a model to grade answers in your evaluation suite. What is the most important safeguard?",
        options: [
          "Use the same model that generates answers",
          "Calibrate the grader against human labels on a sample and prefer deterministic checks where possible",
          "Grade only the longest answers",
          "Never look at failing cases",
        ],
        answer: 1,
        why: "Model graders have biases; calibration against human judgement tells you how far to trust them.",
      },
      {
        q: "A summarisation step reads untrusted web pages. Which configuration best limits injection impact?",
        options: [
          "Give it all tools so it can verify claims",
          "Give it no side-effecting tools; pass only its structured output to later steps that can act",
          "Let it email summaries directly to users",
          "Disable logging for privacy",
        ],
        answer: 1,
        why: "Capability minimisation plus separating reading from acting means a successful injection can at worst distort a summary.",
      },
    ),

    h2("references", "References and further reading"),
    refs(
      R.injection,
      R.hierarchy,
      R.owasp,
      R.nist,
      R.breaker,
      R.backoff,
      R.sre,
      R.otel,
      R.judge,
    ),
  ],
};
