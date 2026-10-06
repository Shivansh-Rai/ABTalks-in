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
import { AGENT_LOOP, WORKFLOW_VS_AGENT } from "../assets/visuals/shared";
import { R } from "../references";
import { M1_CODE_WORKFLOW_OR_AGENT } from "../assets/visuals/interactive";
import {
  M1_COMPONENTS_OF_A_SINGLE_AGENT,
  M1_SHOULD_THIS_BE_AN_AGENT,
  M1_RESEARCH_AGENT_MESSAGE_SEQUENCE,
} from "../assets/visuals/m1";

export const m1: CourseModule = {
  slug: "introduction",
  number: 1,
  title: "Introduction to AI Agents",
  summary:
    "What an agent actually is, how its loop works, and, just as important, when you should not build one.",
  minutes: 22,
  blocks: [
    h2("why", "Why this course starts with a definition"),
    p(
      "The word *agent* is currently stretched over almost everything that touches a language model: a chat widget, a prompt template with a button, a scheduled script that calls an API. That looseness is expensive. Teams build loops where a single call would do, or ship a fixed pipeline and wonder why it cannot cope with an unexpected input. Every later module in this course, architecture, workflows, memory, reliability, depends on having a sharp answer to one question: **where does control live?**",
    ),
    p(
      "By the end of this module you should be able to look at any AI feature and say whether it is a model call, an application, a workflow or an agent; draw its loop; name its components; and argue, with trade-offs, whether an agent is the right design at all.",
    ),

    h2("what", "What is an AI agent?"),
    p(
      "An **AI agent** is a system that pursues a goal by repeatedly deciding on an action, carrying it out through tools, observing the result, and using that observation to decide what to do next, until the goal is met or a stop condition is reached.",
    ),
    p("Three phrases in that definition do the work:"),
    ul(
      '**Pursues a goal.** The input is an outcome ("find why checkout is slow"), not a script of steps. The agent owns the *how*.',
      "**Decides on an action … through tools.** The agent can change or query the world beyond its own text: run a search, read a file, call an API. Without actions there is nothing to observe and no loop.",
      "**Uses that observation to decide what to do next.** This feedback edge is the defining feature. If the second step cannot depend on the result of the first, you have a pipeline, not an agent.",
    ),
    p(
      'Classic AI textbooks describe an agent as anything that *perceives its environment through sensors and acts on it through actuators*. The LLM era keeps that framing but changes the implementation: the "sensors" are tool results and user messages, the "actuators" are tool calls, and the policy that maps one to the other is a language model reading a carefully assembled context.',
    ),
    example(
      "You ask: *Why did checkout latency double since Tuesday?* An agent lists recent deploys, notices one touched the order query, asks the database for that query's plan, sees a full table scan, and proposes an index. Nobody wrote that sequence down. The second and third steps were chosen *because of* what the first returned.",
      "A concrete run",
    ),

    h2("spectrum", "Model, application, workflow, agent"),
    p(
      "It helps to place systems on a spectrum by asking who decides what happens next.",
    ),
    table(
      ["", "LLM (model)", "AI application", "Workflow", "Agent"],
      [
        [
          "What it is",
          "A function from text in to text out",
          "Software that uses a model for a feature",
          "A fixed sequence of steps, some powered by models",
          "A loop in which the model chooses the next action",
        ],
        [
          "Who decides the next step",
          "Nobody, there is no next step",
          "Your code, once",
          "Your code, every time",
          "The model, inside limits your code enforces",
        ],
        [
          "Tools",
          "None",
          "Optional, hard-wired",
          "Hard-wired per step",
          "Selected dynamically",
        ],
        [
          "Example",
          "A hosted model endpoint",
          '"Summarise this thread" button',
          "Transcribe → summarise → email",
          "Investigate and fix a failing deploy",
        ],
      ],
    ),
    p(
      "Two observations follow. First, calling an LLM API does not make something an agent; a summarise button is an application, and a good one. Second, the categories are not a ranking. Moving right buys flexibility and costs predictability, latency and money. Mature teams deliberately stay as far left as the problem allows.",
    ),

    h2("loop", "The agent loop"),
    p(
      "Strip away frameworks and every agent runs the same loop. The runtime builds a context, the model decides, the runtime acts, the result is observed, and the loop repeats. Step through a real run below and watch the right-hand state change after each observation.",
    ),
    visual(
      "The agent loop, one real run",
      "Press **Start** or click any step. The panel under the steps shows what the runtime knows at that moment; highlighted values changed on this step.",
      AGENT_LOOP,
      "The decisive arrow is the one that returns: the query-plan check at step 6 only exists because of the deploy found at step 5. That dependency on intermediate results is what makes this an agent rather than a script.",
    ),
    p(
      "Notice what is *not* in the loop. The model never executes anything. It emits a structured request; ordinary code validates and runs it. This split, **model proposes, runtime disposes**: is the single most important architectural idea in the course, and we return to it in every module.",
    ),
    h3("Perception, reasoning, action"),
    ul(
      "**Perception** is whatever reaches the model: the user's message, tool results, retrieved documents, error messages. An agent can only be as good as what it perceives, which is why context construction (Module 6) matters so much.",
      "**Reasoning** is the model interpreting that context and choosing: call a tool, ask a clarifying question, or answer. In practice, planning and reasoning are frequently the same model call.",
      "**Action** is the runtime executing the chosen tool call against the environment. Actions have side effects, cost and latency; they are where agents become useful and where they become dangerous.",
    ),
    h3("Environment and state"),
    p(
      "The **environment** is everything outside the agent that it can observe or change: a codebase, a database, the web, a calendar. Environments differ in ways that shape the design. A read-only document store is *safe* to explore freely; a payments API is *consequential*; a web page is *untrusted* and may contain text designed to manipulate the model. A production agent is designed around its environment's properties, not in spite of them.",
    ),
    p(
      "**State** is what the runtime tracks across iterations: the goal, steps taken, evidence gathered, budget used, and whether it is waiting on a tool or a human. The model itself is stateless between calls; any continuity exists only because the runtime stores it and puts the relevant parts back into context.",
    ),

    h2("anatomy", "Anatomy of an agent"),
    p(
      "Every production agent, whatever framework built it, contains the same parts. Click each component to see its responsibility, or trace one iteration through the system.",
    ),
    visual(
      "Components of a single agent",
      "Click a box (or use Tab + Enter) to inspect it. Press **Start** to trace one full iteration.",
      M1_COMPONENTS_OF_A_SINGLE_AGENT,
      "Only two boxes involve a model call; everything else is ordinary, testable software. That ratio is typical, building agents is mostly software engineering around a small, powerful, unpredictable core.",
    ),

    h2("types", "Types of agents"),
    p(
      '"Agent" is a family, not a single design. The categories below combine freely; most useful systems are tool-using agents that plan a little and occasionally pause for a human.',
    ),
    table(
      ["Type", "Behaviour", "Example", "Fits when"],
      [
        [
          "Reactive",
          "Maps the current input to an action with little memory",
          "Routing a ticket to a queue",
          "Decisions are local and fast",
        ],
        [
          "Tool-using",
          "Chooses among tools to satisfy a request",
          "Assistant picking calendar vs email vs search",
          "Answers need fresh data or real actions",
        ],
        [
          "Planning",
          "Decomposes a goal into steps, executes, revises",
          "Implementing a feature across several files",
          "Work has dependencies and ordering",
        ],
        [
          "Memory-augmented",
          "Stores and recalls facts across runs",
          "A tutor that remembers what you struggled with",
          "Continuity or personalisation matters",
        ],
        [
          "Multi-agent",
          "Specialised agents coordinate",
          "Researcher, writer and reviewer",
          "Roles or contexts genuinely need separating",
        ],
        [
          "Human-in-the-loop",
          "Pauses for approval at consequential steps",
          "Drafts refunds that a manager approves",
          "Actions are high-stakes or irreversible",
        ],
      ],
    ),
    h3("What LLMs changed"),
    p(
      "Rule-based agents have existed for decades, but each new situation required a human to write a new rule. Language models removed that bottleneck in four ways: they interpret messy, unanticipated inputs; they accept goals in natural language; they can choose a tool from a written description of it; and they can emit **structured output**: a JSON tool call that ordinary code can validate and execute. The ReAct pattern, which interleaves reasoning with tool actions and observations, showed that this combination makes models markedly better at multi-step tasks than reasoning or acting alone.",
    ),
    warn(
      "The same flexibility that lets a model handle surprises lets it pick the wrong tool, misread a result, or loop. Guardrails, step limits and validation are not polish for later, they are part of the minimum viable design.",
      "The price of flexibility",
    ),

    h2("compare", "Chatbots, automation, workflows and agents"),
    p(
      "A **chatbot** is defined by conversation. It may be excellent without ever acting on anything. Many agents have chat interfaces, but the interface is not what makes them agents, acting and adapting is.",
    ),
    p(
      "**Deterministic automation** follows rules: *when an invoice arrives, copy its fields into the ledger.* **Workflow automation** chains steps, some of which may call a model: *classify the email, draft a reply, send for approval.* In both, the path is decided before the input arrives. An **agent** decides its path after seeing the input and each intermediate result.",
    ),
    p(
      "Use the comparison below with realistic situations. Try to predict the answer before you click.",
    ),
    visual(
      "Workflow or agent?",
      "Pick a situation. The better-suited column is highlighted with the reasoning.",
      WORKFLOW_VS_AGENT,
      "The question is never *which is more advanced*. It is: **can the steps be known in advance?** If yes, a workflow is cheaper, faster and easier to trust.",
    ),

    h2("when", "When an agent is the right tool, and when it is not"),
    p(
      "Agents earn their cost when several of these are true: the number of steps is not known in advance; later steps depend on earlier results; tools must be chosen based on what is discovered; the environment changes; and occasional imperfection is acceptable or can be caught by review.",
    ),
    p(
      "They are the wrong tool when a plain function will do (currency conversion), when correctness must be exact and auditable (computing a payout), when the path is fixed (a nightly report), or when latency budgets are tight (each loop iteration is another model round trip, often seconds). Work through the tree below for a task you actually care about.",
    ),
    visual(
      "Should this be an agent?",
      "Answer each question for a real task. Use **Back** to explore the other branches.",
      M1_SHOULD_THIS_BE_AN_AGENT,
      "Most branches end somewhere other than *agent*. That is the point: an agent is the answer to a specific kind of problem, not a default architecture.",
    ),
    tip(
      "Start with code. Add a model call where language is needed. Promote to a workflow when there are several model steps. Reach for an agent only when the path itself must be discovered at runtime.",
      "The escalation rule",
    ),

    h2("myths", "Common misconceptions"),
    ul(
      '**"Every LLM app is an agent."** Without a goal-directed loop whose next step depends on observations, it is an application that uses a model.',
      '**"Agents are autonomous like people."** They are programs operating inside permissions and limits that engineers set. They have no goals of their own beyond the one they are given.',
      '**"Agents need several models."** One model in a well-designed loop is a complete agent. Multi-agent designs are a specialised tool (Module 5).',
      '**"More autonomy is better."** Autonomy is a cost you pay for flexibility. Good systems grant the minimum that the task requires.',
      '**"The model does the work."** The model makes decisions. Tools, validation, state, retries, permissions and evaluation, the bulk of the engineering, are ordinary software.',
      '**"Agents replace software engineering."** They raise the bar for it: you must now engineer around a component whose output is probabilistic.',
    ),

    h2("research", "Worked example: a research agent"),
    p(
      "A user asks: *Summarise what changed in India's data-protection rules this year and what it means for a small SaaS company.* Consider what the agent must do. It cannot know in advance which sources exist, whether the first search is good enough, or whether two sources disagree. That uncertainty is exactly why this is agent territory.",
    ),
    visual(
      "Research agent, message sequence",
      "Press **Start** and step through. Switch scenarios to see the agent recover from a weak first search.",
      M1_RESEARCH_AGENT_MESSAGE_SEQUENCE,
      "The agent's value appears in the second scenario: it noticed its evidence was weak and changed strategy. A good agent is defined less by its happy path than by how it responds when observations disappoint.",
    ),
    note(
      'An honest agent reports uncertainty. "Two sources disagree on the compliance deadline" is a better answer than a confident wrong date, and you get that behaviour by asking for it in the instructions and checking for it in evaluation.',
    ),

    h2("code", "A minimal tool loop"),
    p(
      "The loop fits in a screenful of code. This is intentionally stripped down so the shape is visible; Module 3 builds it out properly.",
    ),
    code(
      "python",
      "Python, runnable with a stub model; not tied to any SDK",
      `
from typing import Callable

def get_weather(city: str) -> str:
    return {"Pune": "31°C, clear"}.get(city, "unknown city")

TOOLS: dict[str, Callable[..., str]] = {"get_weather": get_weather}

def run_agent(goal: str, call_model, max_steps: int = 5) -> str:
    """call_model(messages, tool_names) -> {"text": str} or {"tool": str, "args": dict}"""
    messages = [{"role": "user", "content": goal}]
    for _ in range(max_steps):                      # 1. hard stop condition
        decision = call_model(messages, list(TOOLS))  # 2. model proposes
        if "tool" not in decision:
            return decision["text"]                 # 3. no tool call => done
        fn = TOOLS.get(decision["tool"])
        if fn is None:                              # 4. never trust the name
            result = f"error: unknown tool {decision['tool']!r}"
        else:
            result = fn(**decision["args"])         # 5. runtime executes
        messages.append({"role": "tool", "content": result})  # 6. observe
    return "Stopped: step limit reached without an answer."
`,
      "Everything important is in the comments: a hard step limit, the model only *proposing*, an explicit termination rule, refusing unknown tools, and feeding the observation back. Production code adds schema validation, timeouts, error typing and tracing, but not a different shape.",
    ),

    visual("Sort it: code, workflow or agent?", "Pick a bucket for each task. You get feedback and the reasoning immediately.", M1_CODE_WORKFLOW_OR_AGENT, "If you sorted most tasks away from *Agent*, you have absorbed the main lesson: autonomy is a tool for a specific kind of problem."),

    h2("takeaways", "Key takeaways"),
    takeaways(
      "An agent pursues a goal through a loop in which each next action can depend on the previous observation.",
      "The model proposes actions; ordinary code validates and executes them. Keep that boundary sharp.",
      "Core parts: instructions, model, context builder, tools, memory/state, environment, and limits.",
      "Workflows fix the path in code; agents discover it at runtime. Choose by asking whether the steps can be known in advance.",
      "Autonomy costs predictability, latency and money. Use the least that solves the problem.",
    ),

    h2("exercise", "Exercise: dissect a task"),
    exercise({
      title: "Decide, then design",
      brief:
        "Choose a real task from your studies or work (for example *prepare a study plan from my syllabus and past papers*, or *triage incoming bug reports*).",
      tasks: [
        "Run it through the decision tree above. Record each answer and the outcome.",
        'If the outcome is **not** "agent", write two sentences on what would have to change about the task for an agent to become justified.',
        "If it **is** an agent: name the goal, 3–5 tools (name + one-line purpose), the state the runtime must track, and one action that must require human approval.",
        "Sketch the first three iterations of its loop, showing how iteration 2 depends on the observation from iteration 1.",
        "Write the stop conditions: at least one success condition and two limits.",
      ],
      hints: [
        "If you cannot make iteration 2 depend on iteration 1, you have probably designed a workflow, which may be the right answer.",
        'Limits are usually steps, wall-clock time and spend; a good success condition is observable, not "when it\'s done".',
      ],
      model: [
        "A decision-tree trace that is honest about predictability and risk.",
        "Tools that are narrow and named for what they do (`list_open_bugs`, not `database`).",
        "At least one explicit dependency between iterations.",
        "A consequential action (closing a bug, emailing a user) gated behind approval.",
      ],
    }),

    h2("quiz", "Knowledge check"),
    quiz(
      {
        q: "A product team adds a button that sends a document to an LLM and shows a bullet summary. Is this an agent?",
        options: [
          "Yes, any feature built on an LLM is an agent",
          "No, there is no goal-directed loop; the output of one step never informs a next action",
          "Yes, if the model is large enough to reason",
          "No, agents must use more than one model",
        ],
        answer: 1,
        why: "It is a single call with a fixed shape: an AI application. Agency comes from a loop whose next action depends on observations, not from model size or model count.",
      },
      {
        q: "Your agent calls `delete_file(path)`. Where should the decision to actually delete be enforced?",
        options: [
          "In the system prompt, by telling the model to be careful",
          "Inside the model's reasoning, since it chose the call",
          "In the runtime/tool layer, which validates permissions and can require approval before executing",
          "Nowhere, the model's decision is final",
        ],
        answer: 2,
        why: "The model only proposes. Code that executes tools is the only place where enforcement is reliable. Prompts help behaviour but are not a security boundary.",
      },
      {
        q: "Each night you must export yesterday's orders, compute totals by region and email a PDF to finance. Best design?",
        options: [
          "A planning agent with export, compute and email tools",
          "A multi-agent team: exporter, analyst and mailer",
          "A deterministic scheduled job, perhaps with a model call to write a short commentary",
          "A chatbot that finance can ask each morning",
        ],
        answer: 2,
        why: "The steps are fixed and correctness must be exact. Any autonomy adds cost and variance. If prose commentary is wanted, that is one model *step* inside a workflow.",
      },
      {
        q: "An agent investigating an outage searches logs, finds nothing and then decides to check the deploy history instead. Which property of agents does this illustrate?",
        options: [
          "Determinism",
          "Choosing the next action based on an intermediate observation",
          "Long-term memory",
          "Multi-agent delegation",
        ],
        answer: 1,
        why: "The switch to deploy history happened *because* the log search came back empty. That feedback edge is the defining trait of an agent.",
      },
      {
        q: "Which statement about the model inside an agent is most accurate?",
        options: [
          "It remembers previous runs automatically",
          "It sees only the context the runtime assembles for that call",
          "It executes tool calls directly against APIs",
          "It can access any tool installed on the server",
        ],
        answer: 1,
        why: "Models are stateless between calls and act only through the runtime. Continuity, tool access and execution all come from your code and what it puts in context.",
      },
      {
        q: "A support agent must look up orders, check refund eligibility and issue refunds up to ₹50,000. Which design choice is the most important safety measure?",
        options: [
          "A longer, more detailed system prompt",
          "Using the most capable model available",
          "Requiring human approval (or a hard coded policy check) before the refund tool executes",
          "Letting the model retry failed refunds automatically",
        ],
        answer: 2,
        why: "Refunds are consequential and hard to reverse. An enforced gate in code or a human check bounds the damage of any model mistake; prompt quality and model choice do not.",
      },
    ),

    h2("references", "References and further reading"),
    refs(R.aima, R.react, R.toolformer, R.anthropicAgents, R.weng, R.huyen),
  ],
};
