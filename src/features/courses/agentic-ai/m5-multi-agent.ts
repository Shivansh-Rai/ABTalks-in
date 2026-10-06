import type { CourseModule } from "../types";
import {
  h2,
  h3,
  p,
  ul,
  tip,
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
import { R } from "../references";
import { M5_ONE_AGENT_OR_MANY } from "../assets/visuals/interactive";
import {
  M5_SUPERVISOR_WITH_SPECIALIST_WORKERS,
  M5_PEER_TO_PEER_COLLABORATION,
  M5_SUPERVISOR_VS_DECENTRALISED,
  M5_A_GOOD_HANDOFF,
  M5_SHARED_OR_ISOLATED_STATE,
  M5_HOW_ONE_ERROR_CASCADES_AND_WHERE_IT_IS_CAUGHT,
  M5_DO_YOU_NEED_MORE_THAN_ONE_AGENT,
} from "../assets/visuals/m5";

export const m5: CourseModule = {
  slug: "multi-agent",
  number: 5,
  title: "Multi-Agent Systems",
  summary:
    "When splitting work across several agents helps, the coordination topologies that work, and the new failure modes, loops, deadlocks, cascades, you take on in exchange.",
  minutes: 30,
  blocks: [
    h2("why", "Why more than one agent?"),
    p(
      "A single agent with a dozen tools and a long task eventually hits limits: its context fills with unrelated material, its instructions try to cover too many roles, and everything happens sequentially. **Multi-agent systems** split the work across several agents, each with its own instructions, tools and context, coordinated by some protocol.",
    ),
    p("The genuine benefits are specific:"),
    ul(
      "**Context isolation.** A sub-agent explores 50 web pages and returns a two-paragraph summary. The coordinator's context receives the summary, not the 50 pages.",
      "**Parallelism.** Independent sub-tasks, research five competitors, run at the same time.",
      "**Specialisation.** Each agent gets focused instructions and only the tools its role needs, which improves both quality and security.",
      "**Separation of duties.** A reviewer that did not write the draft is more likely to catch its problems, and can hold different permissions.",
    ),
    p(
      "The costs are just as specific: more model calls (often several times the tokens of a single agent), more latency on sequential handoffs, and an entirely new class of failures that come from agents misunderstanding each other. Published analyses of multi-agent failures consistently find that a large share come not from any individual agent being weak but from **specification and coordination** problems: unclear roles, lost information at handoffs, and agents that never agree the task is finished.",
    ),
    warn(
      "Start with one agent. Move to several only when you can name the specific limit, context, parallelism, specialisation or separation of duties, that a single agent is hitting.",
      "The default is one",
    ),

    h2("roles", "Role specialisation"),
    p(
      "A role is a contract: a responsibility, inputs, outputs, tools and limits. Well-designed roles are **narrow** and have **checkable outputs**.",
    ),
    table(
      ["Role", "Responsibility", "Tools", "Output contract"],
      [
        [
          "Supervisor",
          "Decompose the goal, assign tasks, integrate results, decide when done",
          "Delegate, read shared state",
          "Plan, task assignments, final answer",
        ],
        [
          "Researcher",
          "Find and extract evidence for one sub-question",
          "Search, fetch page",
          "Claims with source URLs and quotes",
        ],
        [
          "Analyst",
          "Compare evidence, compute, flag conflicts",
          "Python sandbox",
          "Findings table with confidence",
        ],
        [
          "Writer",
          "Produce the deliverable from findings",
          "None",
          "Draft with inline citations",
        ],
        [
          "Reviewer",
          "Check claims against sources; reject unsupported ones",
          "Fetch page",
          "Pass/fail per claim with reason",
        ],
      ],
    ),
    tip(
      "If you cannot write a role's output contract as a schema, the role is too vague. Vague roles are the root of most coordination failures.",
    ),

    h2("supervisor", "Supervisor (hierarchical) architecture"),
    p(
      "In a **supervisor** or **orchestrator–worker** design, one agent owns the goal. It plans, delegates sub-tasks to workers, receives their results and decides what to do next. Workers do not talk to each other; all coordination flows through the supervisor.",
    ),
    visual(
      "Supervisor with specialist workers",
      "Trace a research request. Click agents to see their contracts. Then try the failure scenario.",
      M5_SUPERVISOR_WITH_SPECIALIST_WORKERS,
      "The supervisor's advantage is control: one place to plan, stop, and integrate. Its risk is that every mistake in its briefs is copied into every worker.",
    ),
    h3("Hierarchies"),
    p(
      "For very large tasks, supervisors can supervise other supervisors, a team lead per workstream reporting to an overall coordinator. Each layer compresses information upward. Each layer also adds latency and another opportunity for the brief to be misunderstood, so depth should be justified by scale, not by analogy to human organisations.",
    ),

    h2("p2p", "Peer-to-peer and decentralised designs"),
    p(
      "In **peer-to-peer** designs, agents communicate directly: a conversation among roles, a shared blackboard that agents read and write, or a chain of handoffs where each agent passes control to the next most appropriate one. There is no single owner of the goal.",
    ),
    visual(
      "Peer-to-peer collaboration",
      "Trace a design review among peers through a shared blackboard.",
      M5_PEER_TO_PEER_COLLABORATION,
      "Peer designs capture genuine multi-perspective debate, but someone, or some rule, must still own termination and tie-breaking.",
    ),
    visual(
      "Supervisor vs decentralised",
      "Pick a situation to see which topology fits.",
      M5_SUPERVISOR_VS_DECENTRALISED,
      "Most production systems are supervisor-based because termination and debugging are easier. Use peer designs where the interaction itself is the point.",
    ),

    h2("handoff", "Handoffs and delegation"),
    p(
      "A **handoff** transfers responsibility for a task, and the relevant context, from one agent to another. It is the most failure-prone moment in any multi-agent system, because whatever is not in the handoff message is lost.",
    ),
    visual(
      "A good handoff",
      "Step through a support conversation handed from triage to billing. Compare the lossy version.",
      M5_A_GOOD_HANDOFF,
      "Treat a handoff like an API call: a typed payload with the goal, what is known, what is open and where the full record lives.",
    ),
    code(
      "json",
      "JSON, a structured handoff / delegation message",
      `
{
  "task_id": "t-4812",
  "from": "supervisor",
  "to": "researcher",
  "objective": "Find published ingestion throughput for Database B at ≥10M documents.",
  "scope": { "include": ["official docs", "benchmarks since 2024"], "exclude": ["vendor marketing claims without numbers"] },
  "output_schema": { "claims": [{ "text": "string", "source_url": "string", "quote": "string" }] },
  "budget": { "max_tool_calls": 8, "max_seconds": 90 },
  "context_ref": "runs/r-77/state#brief"
}
`,
      "Objective, scope, output schema and budget: the four things a worker needs to succeed and the supervisor needs to verify.",
    ),

    h2("state", "Shared vs isolated state"),
    p(
      "Agents need to know things about the task. Where that knowledge lives is a central design decision.",
    ),
    visual(
      "Shared or isolated state?",
      "Pick a situation.",
      M5_SHARED_OR_ISOLATED_STATE,
      "A common hybrid: isolated working contexts for each agent, plus a small shared record of decisions and task status that everyone can read but only owners can write.",
    ),

    h2("coordination", "Coordination, conflicts, loops and deadlocks"),
    h3("Conflicts"),
    p(
      "Agents will disagree: two researchers report different figures; the reviewer rejects what the writer considers settled. Decide conflict resolution in advance, prefer the more authoritative source, escalate to an analyst or judge, or surface the disagreement to the user. Silent averaging is the worst option.",
    ),
    h3("Loops"),
    p(
      "Writer revises, reviewer rejects, writer revises… Revision loops need an iteration cap *and* a rule for what to return when the cap is hit (the best version plus the unresolved objections).",
    ),
    h3("Deadlocks"),
    p(
      "Agent A waits for B's result while B waits for A's clarification. Every wait needs a timeout, and dependencies should form a graph without cycles, something the supervisor can enforce when it plans.",
    ),
    h3("Cost and latency"),
    p(
      "Every agent adds model calls, and every sequential handoff adds latency. Multi-agent research systems can spend many times the tokens of a single agent; that is worth it for high-value tasks where parallel exploration improves quality, and wasteful for simple ones. Set a total budget at the top and let the supervisor allocate it.",
    ),

    h2("communication", "Communication protocols"),
    p(
      "How agents exchange information shapes what can go wrong. Three common mechanisms, often combined:",
    ),
    table(
      ["Mechanism", "How it works", "Good for", "Risk"],
      [
        [
          "Direct messages",
          "Structured request/response between two agents (delegation, handoff)",
          "Supervisor ↔ worker; clear ownership",
          "Anything not in the message is lost",
        ],
        [
          "Shared blackboard",
          "Agents read and append typed entries to a common store",
          "Debate, critique, progressive refinement",
          "Contention; noisy entries flood every agent's context",
        ],
        [
          "Events",
          "Agents publish events (`claim_verified`, `draft_ready`); others subscribe",
          "Loosely coupled pipelines, long-running systems",
          "Harder to trace causality without good tooling",
        ],
      ],
    ),
    p(
      "Whatever the mechanism, prefer **structured messages over free-form chat**. Free-text conversation between agents drifts: politeness, restated context, and slowly mutating task descriptions consume tokens and blur responsibility. A typed message with a `task_id`, a declared `type` and a schema-validated body can be logged, validated, replayed and tested.",
    ),
    code(
      "json",
      "JSON, a structured result message back to the supervisor",
      `
{
  "task_id": "t-4812",
  "from": "researcher",
  "type": "result",
  "status": "partial",
  "claims": [
    { "text": "Ingests ~5k docs/s on 8 vCPUs", "source_url": "https://…/benchmarks", "quote": "…5,000 documents per second…" }
  ],
  "gaps": ["No published figure above 5M documents"],
  "cost": { "tool_calls": 6, "tokens": 18400 }
}
`,
      "`status`, `gaps` and `cost` let the supervisor decide what to do next without re-reading the worker's work: accept, delegate a follow-up, or report the gap.",
    ),

    h2("evaluation", "Evaluating multi-agent systems"),
    p(
      "A multi-agent system can fail even when every agent is individually good, so evaluate at three levels:",
    ),
    ul(
      "**Agent level**: does each role meet its contract on its own evaluation set? (Researcher: claim accuracy and source validity. Reviewer: does it catch planted errors?)",
      "**Interaction level**: are briefs complete, handoffs lossless, conflicts resolved, loops terminated? Inspect traces for duplicated work, dropped tasks and re-asked questions.",
      "**System level**: end-to-end task success, cost and latency, **compared against a single-agent baseline** on the same tasks.",
    ),
    p(
      "The baseline comparison is the one teams skip and most need. If a single agent achieves 90% of the quality at 25% of the cost, the multi-agent system must justify the difference with a requirement, not with enthusiasm.",
    ),
    table(
      [
        "Design",
        "Model calls per task",
        "Relative tokens",
        "Latency",
        "Quality on hard tasks",
      ],
      [
        [
          "Single agent",
          "~8",
          "1×",
          "Sequential: ~40 s",
          "Degrades when context fills",
        ],
        [
          "Supervisor + 4 parallel workers",
          "~25",
          "~3–4×",
          "Parallel: ~25 s",
          "Better on broad research",
        ],
        [
          "5 sequential specialist agents",
          "~20",
          "~3×",
          "Sequential: ~70 s",
          "Often no better; more handoff losses",
        ],
      ],
      "Illustrative figures for a broad research task; measure your own.",
    ),

    h2("failure", "Failure propagation"),
    p(
      "In a single agent, a mistake stays in one context. In a multi-agent system it can **cascade**: a researcher's hallucinated number becomes the analyst's premise, the writer's headline and the reviewer's blind spot. Trace it below.",
    ),
    visual(
      "How one error cascades, and where it is caught",
      "Trace the unguarded cascade, then the same error with containment.",
      M5_HOW_ONE_ERROR_CASCADES_AND_WHERE_IT_IS_CAUGHT,
      "Contain errors at the boundary where they are created. Downstream agents treat upstream outputs as trusted, so validation belongs at each handoff, not only at the end.",
    ),

    h2("code", "Code: a bounded supervisor"),
    pseudo(
      `
def supervise(goal, workers, budget):
    plan = planner.decompose(goal)                  # tasks with dependencies (a DAG)
    results, spent = {}, 0
    for batch in plan.ready_batches():              # tasks whose deps are done
        briefs = [make_brief(t, results) for t in batch]   # objective, scope, schema, budget
        outs = run_parallel(workers, briefs, timeout=90)
        for task, out in zip(batch, outs):
            spent += out.cost
            if not out.ok or not validate(out, task.output_schema):
                out = retry_once_or_mark_gap(task, out)
            results[task.id] = out
        if spent > budget:
            return integrate(goal, results, note="budget reached; partial")
    draft = writer.run(goal, results)
    for _ in range(2):                              # capped review loop
        verdict = reviewer.run(draft, results)
        if verdict.passed:
            break
        draft = writer.revise(draft, verdict.objections)
    return integrate(goal, results, draft=draft, open_issues=verdict.objections)
`,
      "Dependencies form a DAG (no deadlocks), every delegation is a structured brief, outputs are validated at the handoff, spend is capped, and the review loop has a fixed limit with unresolved objections surfaced rather than hidden.",
    ),

    h2("when-not", "When not to use multiple agents"),
    visual(
      "Do you need more than one agent?",
      "Answer honestly for your task.",
      M5_DO_YOU_NEED_MORE_THAN_ONE_AGENT,
      "Multi-agent architecture is a response to a measured limit, not a starting point.",
    ),
    example(
      "A team built five agents, planner, coder, tester, reviewer, documenter, for small bug fixes. Median cost was 9× a single agent, and most failures were planner briefs the coder misread. Replacing it with one coding agent plus a deterministic test step cut cost by 80% and raised the fix rate. The multi-agent version was solving a problem the task did not have.",
      "An illustrative case",
    ),

    visual("Sort it: one agent, a workflow, or a team?", "Choose the simplest design that genuinely fits each task.", M5_ONE_AGENT_OR_MANY, "Multi-agent designs earn their cost on broad, parallel or debate-shaped work. Everything else is simpler with one agent or a fixed reviewer step."),

    h2("takeaways", "Key takeaways"),
    takeaways(
      "Use multiple agents for context isolation, parallelism, specialisation or separation of duties, and only when a single agent measurably hits one of those limits.",
      "Supervisor designs give clear control and termination; peer designs suit debate but need explicit termination and tie-breaking rules.",
      "Handoffs and briefs are APIs: objective, scope, output schema, budget, context reference.",
      "Choose shared vs isolated state deliberately; a small shared decision record plus isolated working contexts is a strong default.",
      "Validate at every handoff so errors are contained where they arise; cap every loop; budget the whole system.",
    ),

    h2("exercise", "Exercise: design (or refuse) a team"),
    exercise({
      title: "Competitive-analysis assistant",
      brief:
        "A startup wants an assistant that produces a weekly report on five competitors: product releases, pricing changes, hiring signals and notable customer reviews.",
      tasks: [
        "Argue first for a single-agent or workflow design. What limit, if any, would it hit?",
        "If you choose multiple agents, define each role with tools and an output schema.",
        "Choose supervisor or peer topology and justify it.",
        "Write one delegation brief in full (objective, scope, schema, budget).",
        "Identify the two most likely cascade failures and where you would validate to contain them.",
        "Estimate relative cost vs a single agent and state whether the weekly value justifies it.",
      ],
      hints: [
        "Five competitors × four signal types is naturally parallel.",
        "Pricing numbers and dates are the claims most worth validating against sources.",
      ],
      model: [
        "A workflow skeleton (weekly schedule) with a supervisor fanning out per-competitor researchers is a strong answer.",
        "Researchers isolated; a shared record only for last week's findings to detect changes.",
        "Source-quote validation at the researcher handoff; reviewer checks the top claims.",
        "Explicit total budget and a partial-report policy if a competitor's research fails.",
      ],
    }),

    h2("quiz", "Knowledge check"),
    quiz(
      {
        q: "A single research agent's context overflows after reading ~30 pages, and its answers degrade. Which multi-agent pattern addresses this most directly?",
        options: [
          "Peer-to-peer debate among three copies of the agent",
          "Sub-agents that explore in their own contexts and return compact summaries to a coordinator",
          "A reviewer agent that reads the final answer",
          "Giving all agents one shared context",
        ],
        answer: 1,
        why: "Context isolation is the key benefit here: raw material stays in workers' contexts; only summaries reach the coordinator.",
      },
      {
        q: "Three researchers all investigated the same topic and missed two others. What is the most likely root cause?",
        options: [
          "The model is too small",
          "Vague delegation briefs without scope boundaries",
          "Too few researchers",
          "The reviewer was disabled",
        ],
        answer: 1,
        why: "Coordination failures usually start in the specification. Briefs need objective, scope, output schema and budget.",
      },
      {
        q: "A writer and reviewer have exchanged 9 revisions without agreement. What should the system do?",
        options: [
          "Continue until they agree",
          "Restart from scratch",
          "Enforce an iteration cap and return the best draft with the unresolved objections surfaced",
          "Delete the reviewer's objections",
        ],
        answer: 2,
        why: "Loops need caps and a defined exit that preserves both the work and the disagreement for a human.",
      },
      {
        q: 'Where should a check that "every numeric claim appears in its cited source" be placed to limit cascading errors?',
        options: [
          "Only at the end, before the user sees the report",
          "At the researcher → analyst handoff, where the claim is created",
          "Inside the writer's prompt",
          "Nowhere; reviewers handle it",
        ],
        answer: 1,
        why: "Containment works best at the boundary where the error originates, before downstream agents build on it.",
      },
      {
        q: "Which situation most clearly favours a peer (decentralised) design over a supervisor?",
        options: [
          "Summarising 20 documents in parallel",
          "A structured critique where security, cost and operations perspectives respond to each other's points",
          "Processing invoices",
          "Answering FAQ questions",
        ],
        answer: 1,
        why: "Peer designs fit when the interaction between perspectives is the value. Parallel summarisation is a supervisor/fan-out case.",
      },
      {
        q: "Agent A waits for B's analysis; B waits for A's clarification. Which design prevents this?",
        options: [
          "Bigger models",
          "Planning tasks as a DAG (no cyclic dependencies) and adding timeouts to every wait",
          "More shared state",
          "Removing the supervisor",
        ],
        answer: 1,
        why: "Deadlocks arise from cyclic dependencies and unbounded waits; a DAG plan plus timeouts eliminates both.",
      },
    ),

    h2("references", "References and further reading"),
    refs(
      R.anthropicMultiAgent,
      R.masFail,
      R.autogen,
      R.camel,
      R.metagpt,
      R.hugginggpt,
      R.anthropicAgents,
    ),
  ],
};
