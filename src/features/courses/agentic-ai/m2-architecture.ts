import type { CourseModule } from "../types";
import {
  h2,
  h3,
  p,
  ul,
  ol,
  note,
  warn,
  example,
  table,
  code,
  pseudo,
  visual,
  quiz,
  takeaways,
  refs,
  exercise,
} from "../blocks";
import { TOOL_CALL_SEQUENCE } from "../assets/visuals/shared";
import { R } from "../references";
import { M2_WHICH_COMPONENT_OWNS_IT } from "../assets/visuals/interactive";
import {
  M2_REFERENCE_AGENT_ARCHITECTURE,
  M2_CONTEXT_BUDGET_PACKER,
  M2_AGENT_STATE_ACROSS_ITERATIONS,
  M2_REACTIVE_OR_PLAN_FIRST,
} from "../assets/visuals/m2";

export const m2: CourseModule = {
  slug: "architecture",
  number: 2,
  title: "Agent Architecture",
  summary:
    "The parts of an agent runtime, how they fit together, and the design decisions, and failure modes, hiding in each one.",
  minutes: 28,
  blocks: [
    h2("why", "Why architecture, not prompts"),
    p(
      "Early agent demos were mostly prompt engineering: a clever system prompt, a list of tools, and a `while` loop. They worked in the demo and failed in production for reasons no prompt could fix, the context overflowed on long tasks, a tool returned 40 KB of HTML, a timeout left the run in an unknown state, a user pasted text that rewrote the agent's instructions.",
    ),
    p(
      "Those are architecture problems. They are solved by deciding which component owns which responsibility, what crosses each boundary, and what happens when a component misbehaves. This module takes the agent from Module 1 and opens every box.",
    ),

    h2("overview", "The complete runtime"),
    p(
      "Below is a reference architecture. Names differ between frameworks, but these responsibilities exist in every serious agent, if a framework does not provide one, you end up writing it.",
    ),
    visual(
      "Reference agent architecture",
      "Click any component for its responsibility. Use the scenarios to trace a normal iteration and a blocked, manipulated action.",
      M2_REFERENCE_AGENT_ARCHITECTURE,
      "The policy layer sits **between** the model and the tools. Anything the model can be talked into must still pass code that cannot be talked into anything.",
    ),

    h2("model", "The model"),
    p(
      "The model is the decision-maker, and choosing it is an engineering trade-off, not a leaderboard lookup. What matters for agents is narrower than general benchmark performance:",
    ),
    ul(
      "**Tool-calling reliability**: does it emit well-formed calls with correct arguments, and refrain from calling tools when none is needed?",
      "**Instruction adherence over long contexts**: does it still respect the system prompt after 30 tool results?",
      '**Calibration**: does it say "I couldn\'t find that" instead of inventing it?',
      "**Latency and cost per step**: a 10-step task multiplies both by ten.",
    ),
    p(
      "A common, effective pattern is **model routing**: a capable model for planning and hard decisions, a faster, cheaper one for routine steps such as extracting fields from a tool result. Routing is only safe once you have an evaluation set that tells you the cheap model is good enough for those steps.",
    ),

    h2("instructions", "Instructions"),
    p(
      "The system prompt is the agent's job description. Good instructions for agents differ from good chat prompts; they read more like an operating manual:",
    ),
    ul(
      "**Role and objective**: who the agent is and what success looks like.",
      "**Tool guidance**: when to prefer one tool over another, and when not to use tools at all.",
      "**Hard rules**: actions it must never take, data it must never reveal. (Also enforce these in code; the prompt is the first line of defence, not the last.)",
      "**Stopping and escalation**: when to finish, when to ask a clarifying question, when to hand off to a human.",
      "**Output contract**: the format of the final answer, including evidence and uncertainty.",
    ),
    warn(
      "Instructions compete with everything else in context. A 4,000-word system prompt followed by 60,000 tokens of tool output does not guarantee the rules are honoured. Keep instructions short and specific, and move anything enforceable into code.",
      "Prompts are not policy",
    ),

    h2("tools", "Tools and tool schemas"),
    p(
      "A tool is a function the runtime exposes to the model, described by three things: a **name**, a **description** that explains when to use it, and a **parameter schema**: usually JSON Schema, that defines valid arguments. The model reads all three every step; they are part of your prompt, and they deserve the same care.",
    ),
    code(
      "json",
      "JSON, a tool definition in the common JSON Schema style",
      `
{
  "name": "search_orders",
  "description": "Find a customer's orders. Use when the user refers to a purchase. Returns at most 10 orders, newest first. Does NOT return payment details.",
  "input_schema": {
    "type": "object",
    "properties": {
      "customer_id": { "type": "string", "pattern": "^cus_[a-zA-Z0-9]{8,}$" },
      "status": { "type": "string", "enum": ["placed", "shipped", "delivered", "returned"] },
      "since": { "type": "string", "format": "date", "description": "ISO date; omit for all time" }
    },
    "required": ["customer_id"],
    "additionalProperties": false
  }
}
`,
      "Every constraint here does work: the description tells the model *when* to use the tool and what it will *not* get; the `enum` and `pattern` make wrong values fail validation; `additionalProperties: false` rejects invented arguments.",
    ),
    h3("Tool design principles"),
    ul(
      "**Narrow beats general.** `search_orders` is safer and easier for the model to use correctly than `run_sql`. General tools push reasoning about correctness onto the model.",
      "**Name tools for intent.** The model picks tools by reading names and descriptions; ambiguous overlaps (`find_user` vs `lookup_customer`) cause wrong choices.",
      "**Return what the next decision needs.** Trim responses. A 200-field JSON blob wastes context and buries the one field that matters.",
      '**Make errors informative.** `"customer_id not found; did you mean cus_8Kd…?"` lets the model recover. `"error"` does not.',
      "**Separate reads from writes.** Read tools can usually run freely; write tools need stricter validation, idempotency keys and often approval.",
    ),

    h2("lifecycle", "The tool-call lifecycle"),
    p(
      "A tool call is a round trip through your code, not a function call inside the model. Stepping through it makes clear where each responsibility sits, and what happens when the tool fails.",
    ),
    visual(
      "Tool call round trip",
      "Press **Start** and step through. Switch to **Tool fails** to see how an error becomes an observation instead of a crash.",
      TOOL_CALL_SEQUENCE,
      "The model appears twice: once to decide, once to interpret the result. Validation, execution and error translation all happen in the runtime, which is why they can be tested like any other code.",
    ),
    ol(
      "**Request**: the model returns a structured call: tool name plus arguments.",
      "**Validation**: the runtime checks the name exists, arguments match the schema, and the caller is permitted.",
      "**Execution**: the tool runs with a timeout, ideally idempotently.",
      "**Result shaping**: the output is trimmed, redacted and labelled (`ok`, `error`, `partial`).",
      "**Observation**: the shaped result is appended to the trace and to the next context.",
      "**Next decision**: the model reads it and decides whether to call another tool or finish.",
    ),

    h2("context", "Context construction"),
    p(
      "The model knows nothing except what is in its context window for this call. **Context construction**: choosing and ordering what goes in, is therefore one of the highest-leverage pieces of the runtime. Typical ingredients, in rough priority order:",
    ),
    table(
      ["Ingredient", "Why it is there", "Typical failure"],
      [
        [
          "System instructions",
          "Role, rules, output contract",
          "Too long; drowned out by tool output",
        ],
        [
          "Goal / current task",
          "What success means right now",
          "Lost after many turns in a long run",
        ],
        [
          "Tool schemas",
          "What actions are possible",
          "Too many similar tools → wrong choices",
        ],
        [
          "Plan and progress",
          "What's done, what's next",
          "Missing, so the agent repeats work",
        ],
        [
          "Recent observations",
          "Evidence for the next decision",
          "Raw, untrimmed payloads eat the budget",
        ],
        [
          "Retrieved knowledge",
          "Facts not in the model's training",
          "Irrelevant passages distract the model",
        ],
        [
          "Older history (summarised)",
          "Continuity",
          "Kept verbatim until the window overflows",
        ],
      ],
    ),
    p(
      "Try it yourself: the budget below is the context window. Squeeze it and watch which ingredients the builder drops first.",
    ),
    visual(
      "Context budget packer",
      "Drag the budget slider down, or untick ingredients. Required items are always kept; the rest are packed by priority.",
      M2_CONTEXT_BUDGET_PACKER,
      "Tight budgets force the question every runtime must answer: *what does the model need for this decision?* Dropping raw history is fine if a summary survives; dropping the latest tool result is not.",
    ),
    note(
      "Bigger context windows reduce pressure but do not remove it. Research on long contexts has found that models use information at the start and end of a long prompt more reliably than information buried in the middle, and every token is paid for on every call. Curate even when you do not strictly need to.",
    ),

    h2("state", "State and memory"),
    p(
      "**State** is the runtime's structured record of the current run. **Memory** is knowledge that persists beyond it. Keeping them distinct avoids a common mess where everything is stuffed into a growing message list.",
    ),
    visual(
      "Agent state across iterations",
      "Step through a billing-dispute run. Highlighted values changed on that step.",
      M2_AGENT_STATE_ACROSS_ITERATIONS,
      "Explicit, persisted state is what lets an agent pause for a human, survive a crash, stay within budget, and be debugged afterwards. A message list alone gives you none of these.",
    ),

    h2("planning", "Planning vs reactive behaviour"),
    p(
      "A **reactive** agent decides one step at a time from the latest observation (the ReAct style). A **planning** agent first drafts a multi-step plan, then executes and revises it. Neither is universally better.",
    ),
    visual(
      "Reactive or plan-first?",
      "Pick a situation to see which strategy fits better.",
      M2_REACTIVE_OR_PLAN_FIRST,
      "In practice many runtimes blend them: a lightweight plan persisted in state, executed reactively, and revised when an observation invalidates it.",
    ),

    h2("environment", "Environment and observations"),
    p(
      "The environment determines how cautious the rest of the architecture must be. Before designing tools, classify the environment the agent will act in:",
    ),
    table(
      ["Property", "Question", "Design consequence"],
      [
        [
          "Trust",
          "Could content in it be written by an adversary?",
          "Web pages, emails, user uploads → treat as data; minimise tools available while reading them",
        ],
        [
          "Reversibility",
          "Can actions be undone?",
          "Irreversible actions (payments, emails, deletes) → approval tiers and idempotency",
        ],
        [
          "Observability",
          "Can the agent see the effect of its actions?",
          "If not (fire-and-forget APIs), add read-back tools to verify outcomes",
        ],
        [
          "Stability",
          "Does it change while the agent works?",
          "Fast-changing data → timestamps on observations; re-check before acting",
        ],
        [
          "Latency / rate limits",
          "How fast and how often can it be called?",
          "Timeouts, backoff, batching, caching",
        ],
      ],
    ),
    p(
      "**Observations** are the agent's only window onto that environment, so shape them deliberately. A good observation is *small* (only what the next decision needs), *labelled* (`ok`, `error`, `partial`, with a timestamp and source), and *honest* (a truncated list says it was truncated). Poor observations are the most common hidden cause of poor decisions: the model reasons impeccably from an incomplete picture.",
    ),

    h2("orchestration", "Orchestration and termination"),
    p(
      "The orchestrator is ordinary code that runs the loop. Its most important job is deciding **when to stop**. An agent needs several stop conditions, checked every iteration:",
    ),
    ul(
      "**Success**: the model returns a final answer (no tool call), ideally validated against an output schema.",
      "**Step limit**: a maximum number of iterations.",
      "**Deadline**: wall-clock time, especially for user-facing runs.",
      "**Budget**: tokens or money spent.",
      "**No progress**: the same tool called with the same arguments twice, or the same error repeated.",
      "**Escalation**: the model or a policy asks for a human.",
    ),
    pseudo(
      `
def run(goal, limits):
    state = State.new(goal)                      # persisted record
    while True:
        if reason := limits.exceeded(state):     # steps, time, spend
            return state.finish("stopped", reason)
        ctx = build_context(state)               # select + trim
        decision = model.decide(ctx)
        if decision.is_final:
            return state.finish("done", decision.answer)
        verdict = policy.check(decision.call, state)
        if verdict == "needs_approval":
            return state.pause("awaiting_approval", decision.call)
        if verdict == "deny":
            state.observe(error("not permitted", decision.call))
            continue
        if state.is_repeat(decision.call):       # no-progress guard
            return state.finish("stuck", decision.call)
        state.observe(execute(decision.call, timeout=10))
`,
      "Every exit path is explicit and recorded. A denied call is fed back as an observation, the model deserves to know its action did not happen.",
    ),

    h2("patterns", "Architecture patterns at a glance"),
    table(
      ["Pattern", "Shape", "Use when", "Watch out for"],
      [
        [
          "Single tool loop",
          "One model, N tools, one loop",
          "Most tasks; start here",
          "Long runs overflowing context",
        ],
        [
          "Router + specialists",
          "Classifier picks a sub-agent or workflow",
          "Distinct request types",
          "Misrouting; ambiguous inputs",
        ],
        [
          "Plan-and-execute",
          "Planner drafts, executor runs steps",
          "Long, structured tasks",
          "Stale plans not revised",
        ],
        [
          "Evaluator–optimizer",
          "Generator drafts, critic scores, loop",
          "Quality is checkable (tests, rubric)",
          "Endless polishing, cap iterations",
        ],
        [
          "Supervisor multi-agent",
          "Coordinator delegates to workers",
          "Separable subtasks, parallelism",
          "Coordination cost (Module 5)",
        ],
      ],
    ),

    h2("failures", "Failure modes by component"),
    table(
      ["Component", "Failure", "Mitigation"],
      [
        [
          "Model",
          "Wrong tool, invented arguments, false confidence",
          "Schemas, validation, evaluation sets, calibrated instructions",
        ],
        [
          "Context builder",
          "Critical fact dropped or buried",
          "Priority-based packing, summaries, tests on long runs",
        ],
        [
          "Tools",
          "Timeouts, huge payloads, partial failures",
          "Timeouts, response shaping, typed errors, idempotency",
        ],
        [
          "Policy",
          "Missing check on a write path",
          "Deny-by-default allow-lists, tests for every write tool",
        ],
        [
          "Orchestrator",
          "Infinite loops, runaway cost",
          "Multiple stop conditions, repeat detection",
        ],
        [
          "State",
          "Lost on crash; unbounded growth",
          "Persist per step; summarise and archive",
        ],
      ],
    ),
    example(
      "A coding agent was given a single `shell(command)` tool. It worked well, until it ran a clean-up command in the wrong working directory and deleted source files. Replacing `shell` with `read_file`, `write_file`, `run_tests` and `run_build` (each pinned to the project directory) removes that whole class of error. **Tool design is safety design.**",
      "A typical pattern",
    ),

    visual("Sort it: which component owns this?", "Assign each responsibility to the runtime component that should own it.", M2_WHICH_COMPONENT_OWNS_IT, "Clear ownership is what makes an agent debuggable: when something goes wrong, you know which box to open."),

    h2("takeaways", "Key takeaways"),
    takeaways(
      "An agent runtime is mostly deterministic code, orchestrator, context builder, tool executor, policy, state, around one probabilistic component.",
      "Tool names, descriptions and schemas are prompts. Design them narrowly and precisely.",
      "Context is a budget. Decide explicitly what the model needs for each decision.",
      "Persist structured state; it enables pausing, resuming, budgets and debugging.",
      "Put policy between the model and the tools so manipulation changes intent, not outcomes.",
      "Every loop needs several stop conditions, including a no-progress detector.",
    ),

    h2("exercise", "Exercise: architect an agent"),
    exercise({
      title: "Design the runtime for an expense-report assistant",
      brief:
        "Employees upload receipts; the agent extracts line items, checks them against company policy, flags problems, and submits the report to the finance system.",
      tasks: [
        "List 4–6 tools with name, one-line description and key parameters. Mark each as read or write.",
        "Define the state record: which fields, and which change every step?",
        "Write the context ingredients for the *check against policy* step, in priority order, with approximate token costs.",
        "Specify which actions the policy layer allows, which need approval, and which are denied outright.",
        "List all stop conditions and what the user sees for each.",
        "Name the two failure modes you consider most likely and your mitigation for each.",
      ],
      hints: [
        "Submitting to finance is a write action that is hard to undo, who approves it?",
        "What happens if the receipt image is unreadable? That is a tool result, not an exception.",
      ],
      model: [
        "Separate `extract_receipt`, `get_policy`, `check_line_item` (reads) from `submit_report` (write, requires employee confirmation).",
        "State includes: goal, receipts processed, flagged items with reasons, status, spend.",
        "Policy text retrieved for the relevant category only, not the whole handbook.",
        "Stop on success, on unreadable receipts needing re-upload, on budget, and on repeated extraction failure.",
      ],
    }),

    h2("quiz", "Knowledge check"),
    quiz(
      {
        q: 'Your agent\'s system prompt says "never issue refunds over ₹10,000", yet in testing it occasionally does. What is the most robust fix?',
        options: [
          "Repeat the rule three times in the prompt",
          "Move the rule into the policy layer so the refund tool rejects amounts over ₹10,000 regardless of what the model requests",
          "Switch to a larger model",
          "Add the rule to the tool description",
        ],
        answer: 1,
        why: "Prompts influence behaviour; code enforces it. The policy/tool layer is the only place the rule is guaranteed. Prompt and description changes may help but do not guarantee compliance.",
      },
      {
        q: "A support agent works well for short chats but in long sessions starts ignoring its output-format rules. What is the most likely architectural cause?",
        options: [
          "The model's temperature is too low",
          "Too few tools",
          "Context grows with verbatim history and tool output, diluting the instructions",
          "The state store is not persisted",
        ],
        answer: 2,
        why: "Long, unmanaged context competes with the instructions. Summarising history and trimming tool results restores their influence.",
      },
      {
        q: "Which tool design is best for an agent that answers questions about a customer's orders?",
        options: [
          "`run_sql(query: string)` against the production database",
          "`search_orders(customer_id, status?, since?)` returning a trimmed list, scoped to the authenticated customer",
          "`http_get(url: string)` so it can call any internal API",
          "One `do_anything(action: string)` tool with a long description",
        ],
        answer: 1,
        why: "Narrow, intent-named, schema-constrained, scoped tools are easier for the model to use correctly and far safer. General tools shift correctness and security onto the model.",
      },
      {
        q: "An agent calls `get_status(job=42)` five times in a row with identical results. Which orchestrator feature was missing?",
        options: [
          "A no-progress / repeat detector",
          "A bigger context window",
          "Long-term memory",
          "A reranker",
        ],
        answer: 0,
        why: "Step limits eventually stop it, but a repeat detector stops it at the second identical call, saving cost and giving a clearer failure reason.",
      },
      {
        q: "Why should a denied tool call be returned to the model as an observation rather than silently dropped?",
        options: [
          "So the model can try again with the same call",
          "Because the model otherwise assumes the action succeeded and reasons from a false premise",
          "It is required by JSON Schema",
          "To increase token usage for logging",
        ],
        answer: 1,
        why: "If the model is not told, its next decision builds on an action that never happened. Explicit denial lets it choose an alternative or escalate.",
      },
      {
        q: "You must migrate 40 services to a new logging library, with engineers reviewing the approach before changes are made. Which strategy fits best?",
        options: [
          "Purely reactive, one step at a time",
          "A single model call with all 40 services in context",
          "A chatbot the engineers talk to",
          "Plan-then-execute with the plan approved before execution",
        ],
        answer: 3,
        why: "The task is large and structured, and humans want to review the approach. An explicit, persisted plan provides both coherence and a review point.",
      },
    ),

    h2("references", "References and further reading"),
    refs(
      R.anthropicTools,
      R.openaiTools,
      R.jsonSchema,
      R.react,
      R.lostMiddle,
      R.anthropicAgents,
      R.mcp,
    ),
  ],
};
