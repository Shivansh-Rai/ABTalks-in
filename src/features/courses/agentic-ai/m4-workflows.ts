import type { CourseModule } from "../types";
import {
  h2,
  p,
  ul,
  note,
  tip,
  warn,
  table,
  code,
  visual,
  quiz,
  takeaways,
  refs,
  exercise,
} from "../blocks";
import { R } from "../references";
import {
  M4_SEQUENTIAL_CHAIN_WITH_GATES,
  M4_FAN_OUT_AND_FAN_IN,
  M4_CONDITIONAL_ROUTING,
  M4_RECOVERY_LADDER_FOR_ONE_STEP,
  M4_APPROVAL_GATE,
  M4_COMPLETE_APPLICATION_WORKFLOW,
  M4_THREE_DESIGNS_COMPARED,
} from "../assets/visuals/m4";

export const m4: CourseModule = {
  slug: "workflows",
  number: 4,
  title: "Agentic Workflows",
  summary:
    "Sequential, parallel, routed, looping and human-approved workflows, how to compose them, pass state through them, and decide how much autonomy each step deserves.",
  minutes: 28,
  blocks: [
    h2("what", "What is a workflow?"),
    p(
      "A **workflow** is a directed graph of steps whose structure is defined in code. Each step takes some state, does work, and produces new state. Edges say what runs next, always, in parallel, or depending on a condition. Some steps are plain functions; some call a model; occasionally one step is a bounded agent.",
    ),
    p(
      "The defining property is that **the graph is yours**. The model may decide *within* a step (how to summarise, which category a ticket belongs to), and may even choose *between* edges you drew (a routing decision), but it cannot invent new steps or skip ones you made mandatory. That constraint is the source of every workflow advantage: predictable cost, bounded latency, step-level tests, clear audit trails.",
    ),
    p(
      'Workflows are not the "lesser" option to agents. In production, most successful AI features are workflows, and many "agents" turn out on inspection to be workflows with one agentic step. This module teaches the patterns so you can compose them deliberately.',
    ),

    h2("spectrum", "Deterministic, model-assisted, agent-driven"),
    table(
      [
        "",
        "Deterministic workflow",
        "Workflow with model steps",
        "Agent-driven",
      ],
      [
        ["Graph", "Fixed", "Fixed", "Emergent, model chooses the next step"],
        [
          "Steps",
          "Code only",
          "Code + model calls",
          "Tool calls chosen at runtime",
        ],
        [
          "Cost / latency",
          "Minimal, constant",
          "Bounded; sum of steps",
          "Variable; grows with iterations",
        ],
        [
          "Testing",
          "Unit tests",
          "Unit tests + per-step evals",
          "Outcome evals over many runs",
        ],
        [
          "Example",
          "Nightly export",
          "Ticket triage and draft reply",
          "Open-ended incident investigation",
        ],
      ],
    ),
    p(
      "The rest of the module is a toolkit of shapes, sequence, fan-out, route, loop, approval gate, that you combine into one graph. Before the shapes, the thing that flows along the edges: state.",
    ),

    h2("state", "State passing"),
    p(
      "Every workflow needs a clear answer to *what does each step receive and return?* Two common designs:",
    ),
    ul(
      "**Pipeline style**: each step returns output that becomes the next step's input. Simple, but later steps cannot see earlier context unless it is threaded through.",
      "**Shared state object**: a typed record (e.g. `ApplicationState`) that every step reads from and writes to specific fields. Easier to extend, checkpoint and inspect; the pattern most graph frameworks use.",
    ),
    code(
      "python",
      "Python, educational; a typed workflow state",
      `
from dataclasses import dataclass, field
from typing import Literal

@dataclass
class ApplicationState:
    application_id: str
    resume_text: str = ""
    parsed: dict | None = None             # written by: parse
    screening: dict | None = None          # written by: screen
    checks: dict = field(default_factory=dict)   # written by: parallel checks
    route: Literal["reject", "review", "fast_track"] | None = None
    human_decision: Literal["approve", "reject"] | None = None
    errors: list[str] = field(default_factory=list)
`,
      "Each field has exactly one writer. That discipline makes it obvious which step produced a bad value and lets you persist (checkpoint) the object between steps.",
    ),
    tip(
      "Checkpoint state after every step. If step 5 fails, you resume from step 5, not from the start, re-paying for four model calls and possibly repeating side effects.",
    ),

    h2("sequential", "Sequential workflows (prompt chaining)"),
    p(
      "The simplest shape: A → B → C. Its power comes from **decomposition**: several focused model calls usually beat one giant prompt, and from **gates**: deterministic checks between steps that stop bad intermediate output from propagating.",
    ),
    visual(
      "Sequential chain with gates",
      "Step through a job-application workflow. Gates (checks in code) sit between model steps.",
      M4_SEQUENTIAL_CHAIN_WITH_GATES,
      "Gates are cheap, deterministic and catch errors where they start. Without them, a parsing mistake in step 1 silently becomes a confident, wrong recommendation in step 5.",
    ),

    h2("parallel", "Parallel workflows (fan-out / fan-in)"),
    p(
      "When steps do not depend on each other, run them concurrently. Two flavours:",
    ),
    ul(
      "**Sectioning**: split a task into independent parts (check references, verify certifications, scan a portfolio) and run them at once.",
      '**Voting**: run the *same* task several times or with different prompts and aggregate (majority vote, or "flag if any run says yes" for safety checks).',
    ),
    visual(
      "Fan-out and fan-in",
      "Start the scenario to see branches run concurrently, then switch to the failure case.",
      M4_FAN_OUT_AND_FAN_IN,
      "Parallelism is almost free latency, but every join needs an explicit policy for partial failure: fail all, continue with gaps, or wait for a quorum.",
    ),

    h2("routing", "Branching and conditional routing"),
    p(
      "A **router** classifies the input and sends it down one of several paths, each specialised. The classifier can be a rule, a small model or a large one. Routing works because specialised paths, with their own prompts, tools and even models, outperform one path that tries to handle everything.",
    ),
    visual(
      "Conditional routing",
      "Pick an input and trace which path it takes. Note the fallback for low-confidence classifications.",
      M4_CONDITIONAL_ROUTING,
      "The model classifies; code decides. Keeping the threshold and the sensitive-topic rules in code makes routing auditable and tunable without prompt edits.",
    ),

    h2("loops", "Loops: evaluator–optimizer and reflection"),
    p(
      "Some outputs can be checked: code against tests, a summary against a rubric, a SQL query against a sample database. In an **evaluator–optimizer loop**, one step generates, another evaluates, and the feedback drives a revision, until the check passes or an iteration cap is hit.",
    ),
    ul(
      "Prefer **objective evaluators** (tests, schema checks, execution results) over a model judging its own work; self-critique helps but tends to be lenient.",
      "Always cap iterations. Improvements usually flatten after two or three rounds, while cost keeps rising linearly.",
      "Return the best attempt so far, with its evaluation, when the cap is reached, rather than failing outright.",
    ),

    h2("retry", "Retries and fallbacks inside workflows"),
    p(
      "Each step in a workflow can fail. A **recovery ladder** makes the response to failure explicit and ordered from cheapest to most expensive.",
    ),
    visual(
      "Recovery ladder for one step",
      "Step through what happens when the *parse résumé* step fails.",
      M4_RECOVERY_LADDER_FOR_ONE_STEP,
      "Each rung is cheaper to try than the next. Deciding the ladder in advance, per step, is what separates a resilient workflow from one that fails on the first odd input.",
    ),

    h2("hitl", "Human-in-the-loop"),
    p(
      "Some decisions should not be automated: they are consequential, irreversible, legally sensitive, or simply ones where a person must be accountable. An **approval gate** pauses the workflow, presents a decision with evidence, and resumes when a human responds.",
    ),
    visual(
      "Approval gate",
      "Step through an approval; switch scenario to see a rejection with feedback.",
      M4_APPROVAL_GATE,
      "An approval gate is a pause, not a loop: checkpoint, ask with evidence, resume from the checkpoint. Recording the human's reason turns every decision into evaluation data.",
    ),
    warn(
      "Approval fatigue is real. If humans approve 99% of requests without reading them, the gate has become theatre. Gate only consequential actions, show the evidence concisely, and measure how often reviewers change the outcome.",
      "Make approvals meaningful",
    ),

    h2("graph", "Putting it together: the workflow graph"),
    p(
      "Real workflows combine all of these shapes. Here is the complete job-application pipeline: a sequence with gates, a parallel fan-out, a router and an approval gate. Only two nodes are model calls with any freedom; the rest is code.",
    ),
    visual(
      "Complete application workflow",
      "Click nodes to inspect them. Trace a strong candidate and a borderline one.",
      M4_COMPLETE_APPLICATION_WORKFLOW,
      "This is the typical shape of a production AI system: a deterministic skeleton, a few model steps with gates, and humans at the consequential edges.",
    ),

    h2("code", "Code: a small workflow engine"),
    code(
      "python",
      "Python, educational; asyncio, no framework",
      `
import asyncio

async def with_retry(fn, *args, attempts=3, base=0.5):
    for i in range(attempts):
        try:
            return await fn(*args)
        except TransientError:
            if i == attempts - 1:
                raise
            await asyncio.sleep(base * 2 ** i)       # exponential backoff

async def process(state: ApplicationState, store, llm):
    state.parsed = await with_retry(parse_resume, state.resume_text, llm)
    if not valid_parse(state.parsed):
        return await escalate(state, store, "parse_failed")
    store.checkpoint(state)

    results = await asyncio.gather(                  # fan-out
        verify_degree(state.parsed),
        assess_portfolio(state.parsed, llm),
        check_references(state.parsed),
        return_exceptions=True,                      # one failure != all fail
    )
    for name, r in zip(("degree", "portfolio", "references"), results):
        state.checks[name] = {"ok": False, "error": str(r)} if isinstance(r, Exception) else r
    store.checkpoint(state)

    state.screening = await screen(state, llm)
    score = state.screening["score"]
    state.route = "reject" if score < 40 else "fast_track" if score > 75 else "review"
    store.checkpoint(state)

    if state.route == "fast_track":
        return await request_approval(state, store)   # pauses; resumed by webhook
    return await dispatch(state)
`,
      "Routing thresholds, retries, checkpointing and the join policy (`return_exceptions=True`) are all explicit code. Only `parse_resume`, `assess_portfolio` and `screen` involve a model.",
    ),
    note(
      "Graph frameworks (for example LangGraph) and durable-execution engines provide checkpointing, resumption and visualisation for this pattern. They are worth adopting once you have several workflows, but understand the shape first, so the framework serves your design rather than defining it.",
    ),

    h2("choose", "Workflow or agent? A sharper test"),
    p(
      "Module 1 introduced the core question, *can the steps be known in advance?* With the patterns above you can refine it. Prefer a workflow when:",
    ),
    ul(
      "You can enumerate the paths, even if there are several (routing covers that).",
      "Latency or cost must be predictable, for example a user is waiting, or you process millions of items.",
      "Auditors, regulators or users need to know exactly what happened and why.",
      "Individual steps can be evaluated in isolation.",
    ),
    p(
      "Prefer an agent (or an agentic step inside a workflow) when the number and kind of steps genuinely depend on intermediate discoveries, *and* the environment tolerates exploration.",
    ),
    visual(
      "Three designs compared",
      "Pick a situation to see which design fits best.",
      M4_THREE_DESIGNS_COMPARED,
      "The hybrid is the design most teams converge on: autonomy only where it pays for itself.",
    ),

    h2("durable", "Durable execution and idempotency"),
    p(
      "Workflows that include human approvals or slow external checks can run for hours or days. Processes restart, deployments happen, machines fail. A workflow is **durable** if it survives all of that and resumes exactly where it stopped. Three ingredients make that possible:",
    ),
    ul(
      "**Checkpointed state** after every step, in a database rather than in memory.",
      "**Deterministic orchestration code**: given the same checkpointed state, the orchestrator makes the same routing decisions. Model outputs are recorded in state, so replaying a step reads the stored result instead of calling the model again.",
      "**Idempotent side effects**: every external action carries a key derived from the workflow run and step (`app-7731:schedule-interview`), so a replay after a crash cannot double-book an interview or double-send an email.",
    ),
    p(
      "Trace the state object through the complete application workflow to see what a checkpoint holds at each point:",
    ),
    table(
      ["After step", "Fields written", "If the process crashes here…"],
      [
        [
          "parse",
          "`parsed`",
          "Resume at checks; the résumé is not re-parsed (no repeated model cost)",
        ],
        [
          "checks",
          "`checks.degree`, `checks.portfolio`, `checks.references`",
          "Resume at screen; failed branches are recorded as gaps, not retried forever",
        ],
        [
          "screen",
          "`screening`",
          "Resume at route; the score is not recomputed, so the decision cannot silently change",
        ],
        ["route", "`route`", "Resume at the chosen path"],
        [
          "approval requested",
          "`status = awaiting_approval`",
          "Nothing to resume, the workflow is *meant* to be idle until the webhook arrives",
        ],
        [
          "approved",
          "`human_decision`",
          "Resume at schedule; the idempotency key prevents a duplicate booking",
        ],
      ],
    ),
    note(
      "Not recomputing a model step on resume is a correctness property, not just a cost saving. A second model call might score the candidate 74 instead of 76 and route them differently, the same application would get two different outcomes depending on when a server restarted.",
    ),

    h2("testing", "Testing workflows"),
    p(
      "Workflows are easier to test than agents, which is one of their biggest advantages. Use it:",
    ),
    ul(
      "**Step tests**: each node is a function from state to state. Deterministic nodes get ordinary unit tests; model nodes get small evaluation sets with pass criteria (e.g. extraction accuracy on 50 labelled résumés).",
      "**Gate tests**: feed each gate known-bad inputs (missing fields, invented qualifications) and assert it rejects them.",
      "**Routing tests**: table-driven tests over scores and flags, asserting the route chosen. Boundary values (39, 40, 75, 76) catch off-by-one thresholds.",
      "**Failure-injection tests**: make a branch raise, time out or return garbage and assert the join policy and recovery ladder behave as designed.",
      "**Replay tests**: load a checkpoint from a real (anonymised) run and resume it, asserting no side effect is repeated.",
    ),
    code(
      "python",
      "Python, pytest; routing is a pure function, so it is trivially testable",
      `
import pytest

def route(score: int, flags: set[str]) -> str:
    if "legal" in flags or "sensitive" in flags:
        return "review"
    return "reject" if score < 40 else "fast_track" if score > 75 else "review"

@pytest.mark.parametrize("score,flags,expected", [
    (39, set(), "reject"), (40, set(), "review"),
    (75, set(), "review"), (76, set(), "fast_track"),
    (95, {"legal"}, "review"),                 # flags override scores
])
def test_route(score, flags, expected):
    assert route(score, flags) == expected
`,
      "Because the routing decision lives in code rather than a prompt, its behaviour at every boundary is pinned down by five lines of tests.",
    ),

    h2("mistakes", "Common mistakes"),
    ul(
      "**One mega-prompt instead of steps.** Decomposition improves quality and makes failures locatable.",
      "**No gates between model steps.** Errors compound silently.",
      "**Joins without a partial-failure policy.** One slow branch hangs everything, or one failure discards good results.",
      "**Routing decisions hidden in prompts.** Thresholds belong in code where they can be tuned and audited.",
      "**No checkpoints.** A crash at step 7 repays for steps 1–6 and may repeat side effects.",
      "**Approval gates everywhere.** Humans rubber-stamp; the gate stops protecting anyone.",
    ),

    h2("takeaways", "Key takeaways"),
    takeaways(
      "A workflow is a graph you define; models work inside nodes and may choose between edges you drew.",
      "Use typed shared state with one writer per field, and checkpoint after each step.",
      "Compose five shapes: sequence with gates, parallel fan-out/in, routing, bounded loops, approval gates.",
      "Decide each step's recovery ladder in advance: retry → alternate → degrade → escalate.",
      "Workflows are often the better engineering choice; add agentic steps only where exploration pays.",
    ),

    h2("exercise", "Exercise: design a workflow"),
    exercise({
      title: "Scholarship application pipeline",
      brief:
        "A foundation receives 20,000 scholarship applications (form data, essay, income certificate PDF, marksheets) and must shortlist 500 for interviews within two weeks.",
      tasks: [
        "Draw the graph: label each node as code, model step or agentic step, and justify every model or agentic node.",
        "Define the state object with one writer per field.",
        "Identify which checks can run in parallel and write the join's partial-failure policy.",
        "Specify routing thresholds and where borderline cases go.",
        "Place approval gates. Estimate how many decisions per day reviewers must make, and adjust if that is unrealistic.",
        "Write the recovery ladder for the income-certificate verification step.",
      ],
      hints: [
        "Essays are where language understanding adds value; income thresholds are arithmetic.",
        "Fairness matters: how will you check that the screening step is not biased by writing style or region?",
      ],
      model: [
        "Deterministic eligibility filters first (cheap, explainable), model steps only on eligible applications.",
        "Document verification in parallel with essay assessment.",
        "Borderline scores → human review; all rejections auditable with reasons.",
        "Sample-based human audit of automated decisions, stratified by region and language.",
      ],
    }),

    h2("quiz", "Knowledge check"),
    quiz(
      {
        q: "A pipeline extracts invoice fields with a model and then posts them to accounting. Occasionally a malformed extraction reaches accounting. What is the most direct fix?",
        options: [
          "Use a bigger model for extraction",
          "Add a deterministic validation gate between extraction and posting, with retry and escalation on failure",
          "Replace the pipeline with an autonomous agent",
          "Ask the model to double-check its work in the same prompt",
        ],
        answer: 1,
        why: "Gates stop errors where they start. A stronger model reduces but never eliminates malformed output; a gate guarantees it cannot propagate.",
      },
      {
        q: "Three independent checks take 2 s, 3 s and 8 s. Run in parallel, what is the approximate total latency, and what must you define?",
        options: [
          "13 s; nothing extra",
          "8 s; a policy for what happens when one branch fails or times out",
          "2 s; a caching layer",
          "8 s; a router",
        ],
        answer: 1,
        why: "Fan-out latency is the slowest branch. Every join needs an explicit partial-failure policy.",
      },
      {
        q: 'Your router is a model that returns a label. Where should the "send to human if confidence < 0.7" rule live?',
        options: [
          "In the router's prompt",
          "In code that consumes the router's structured output",
          "In each downstream path's prompt",
          "Nowhere; trust the label",
        ],
        answer: 1,
        why: "The model classifies; code decides. Thresholds in code are auditable and tunable without changing prompts.",
      },
      {
        q: "A workflow crashes at step 6 of 8 after an external email was sent at step 4. Rerunning from the start would send the email again. What design prevents this?",
        options: [
          "Checkpointing state after each step (and idempotent side effects), then resuming from step 6",
          "Longer timeouts",
          "Parallelising steps 1–5",
          "Removing the email step",
        ],
        answer: 0,
        why: "Checkpoints let you resume; idempotency protects against the step being replayed anyway.",
      },
      {
        q: "An evaluator–optimizer loop on code generation keeps revising for 12 rounds with tiny changes. What should you change first?",
        options: [
          "Add more evaluators",
          "Cap iterations (e.g. 3) and return the best-scoring attempt with its evaluation",
          "Remove the tests so it stops failing",
          "Let the model decide when to stop",
        ],
        answer: 1,
        why: "Gains flatten quickly while cost rises linearly. Cap the loop and return the best attempt.",
      },
      {
        q: "Reviewers approve 99.5% of requests from an approval gate, usually within 5 seconds. What does this most likely indicate?",
        options: [
          "The automation is perfect; remove all reviews",
          "The gate has become a rubber stamp, gate fewer, more consequential actions and present evidence better",
          "Reviewers need more requests",
          "The approval inbox is too slow",
        ],
        answer: 1,
        why: "Approval fatigue turns gates into theatre. Reserve them for decisions where a human genuinely adds judgement.",
      },
    ),

    h2("references", "References and further reading"),
    refs(
      R.anthropicAgents,
      R.selfRefine,
      R.reflexion,
      R.langgraph,
      R.backoff,
      R.huyen,
    ),
  ],
};
