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
import { RAG_PIPELINE } from "../assets/visuals/shared";
import { R } from "../references";
import { M6_WHICH_MEMORY } from "../assets/visuals/interactive";
import {
  M6_CONTEXT_LIFECYCLE_FOR_ONE_AGENT_STEP,
  M6_MEMORY_ARCHITECTURE_AROUND_AN_AGENT,
  M6_CONTEXT_PRESSURE_AT_STEP_25,
  M6_MEMORY_READ_AND_WRITE_IN_ONE_CONVERSATION,
  M6_RETRIEVAL_DESIGN_CHOICES,
} from "../assets/visuals/m6";

export const m6: CourseModule = {
  slug: "memory",
  number: 6,
  title: "Memory, Context & Knowledge",
  summary:
    "How agents remember, what they should forget, and how retrieval turns a stateless model into one that can work with your data, without drowning it in tokens.",
  minutes: 30,
  blocks: [
    h2("problem", "The problem memory solves"),
    p(
      "A language model is stateless. Each call starts from nothing but its training and the context you send. Everything that feels like memory, remembering the user's name, recalling what the agent tried three steps ago, knowing your company's refund policy, is the runtime deciding what to put into that context, and where to get it from.",
    ),
    p(
      "That makes memory an **information-management** problem with three questions: *what to keep*, *where to keep it*, and *what to bring back for this decision*. Get it wrong one way and the agent forgets crucial facts; get it wrong the other way and it drowns in irrelevant ones, gets slower, costs more and, surprisingly often, gives worse answers.",
    ),

    h2("window", "The context window"),
    p(
      "The **context window** is the maximum amount of text (measured in tokens) a model can process in one call, instructions, conversation, tool results and retrieved documents together. Windows have grown dramatically, but three constraints remain:",
    ),
    ul(
      "**Cost** scales with input tokens on every call. An agent that sends 80k tokens per step for 10 steps pays for 800k tokens.",
      "**Latency** rises with input size.",
      '**Attention is uneven.** Research on long-context use has shown that models tend to use information at the beginning and end of a long input more reliably than information in the middle. A fact that is "in context" is not guaranteed to be *used*.',
    ),
    p(
      "So even with a huge window, the goal is not to fill it but to put the **right** information in, in the right place.",
    ),

    h2("lifecycle", "The context lifecycle"),
    p(
      "Every step of an agent rebuilds its context. Walk through the lifecycle of one step's context below.",
    ),
    visual(
      "Context lifecycle for one agent step",
      "Step through how context is assembled, used, and what survives into the next step.",
      M6_CONTEXT_LIFECYCLE_FOR_ONE_AGENT_STEP,
      "Context is disposable and rebuilt every step; state and memory are durable. Designing the transformation between them is what memory engineering is.",
    ),

    h2("types", "Kinds of memory"),
    p(
      "Borrowing loosely from cognitive science, it is useful to distinguish four kinds of memory. They differ in lifetime, storage and, most importantly, how they are read.",
    ),
    table(
      ["Kind", "What it holds", "Lifetime", "Typical storage", "Read by"],
      [
        [
          "Working / short-term",
          "The current run: goal, plan, recent turns, observations",
          "One task or session",
          "State object, message list",
          "Always included (trimmed)",
        ],
        [
          "Episodic",
          "Records of past runs: what was tried, what happened, outcomes",
          "Weeks–months",
          "Event log, database",
          "Similarity or recency lookup",
        ],
        [
          "Semantic",
          "Facts and knowledge: preferences, policies, documentation",
          "Long",
          "Key-value store, vector index",
          "Retrieval by relevance",
        ],
        [
          "Procedural",
          "How to do things: instructions, playbooks, few-shot examples",
          "Until changed",
          "Prompts, code, skill libraries",
          "Selected by task type",
        ],
      ],
    ),
    example(
      'A study-planning agent. **Working:** this week\'s plan being drafted. **Episodic:** "last month the student skipped every Sunday session." **Semantic:** "prefers 45-minute blocks; exam on 12 Nov." **Procedural:** the playbook for building spaced-repetition schedules. Each is read differently, the playbook by task type, the preference by key, the skipped-Sundays episode by similarity to the current planning task.',
      "Four memories in one agent",
    ),

    h2("architecture", "A memory architecture"),
    visual(
      "Memory architecture around an agent",
      "Click stores to see what they hold. Trace a read and a write.",
      M6_MEMORY_ARCHITECTURE_AROUND_AN_AGENT,
      "Reads are selective and typed; writes pass through a policy. An agent that writes everything it hears into memory will eventually remember things it should not and believe things that are no longer true.",
    ),

    h2("short", "Short-term memory: managing the working context"),
    p(
      "Within a run, the message list grows with every tool call. Strategies, roughly in order of sophistication:",
    ),
    ul(
      "**Sliding window**: keep the last N turns. Simple; loses early facts such as the original constraints.",
      "**Pin + window**: always keep instructions, the goal and key facts; slide the rest.",
      "**Rolling summary**: periodically summarise older turns into a compact note. Summaries lose detail, so keep the original in state in case it is needed again.",
      '**Observation compaction**: replace old, large tool results with short digests ("fetched invoice INV-22: ₹4,999, paid").',
      "**Structured state over transcript**: keep facts in typed fields and render them into context, rather than relying on the model to re-read a long transcript.",
    ),
    p(
      "Feel the pressure yourself. The budget below is a long-running support session at step 25.",
    ),
    visual(
      "Context pressure at step 25",
      "Reduce the budget and see what is squeezed out. Try unticking the raw transcript and ticking only the summary.",
      M6_CONTEXT_PRESSURE_AT_STEP_25,
      "A 900-token summary preserves most of what 38,000 tokens of transcript provide for the next decision. The skill is knowing which details the summary must keep, usually commitments, constraints and open questions.",
    ),

    h2("long", "Long-term memory: episodic and semantic"),
    h3("Episodic memory"),
    p(
      "Episodic memory records *what happened*. Useful episodes are summaries, not transcripts: the task, the approach, the outcome and what was learned. Reflection-style research agents store short natural-language lessons from failures and retrieve them on similar tasks, improving over repeated attempts without retraining the model.",
    ),
    h3("Semantic memory"),
    p(
      "Semantic memory records *what is true*: preferences, facts about entities, organisational knowledge. Two properties make or break it:",
    ),
    ul(
      '**Provenance**: where the fact came from and when. "Prefers email (said on 2 Sep)" can be weighed against newer evidence; "prefers email" cannot.',
      "**Update semantics**: new facts must *replace* contradicted ones, not sit alongside them. Otherwise retrieval returns both, and the model picks one at random.",
    ),

    h2("rw", "The memory read/write cycle"),
    visual(
      "Memory read and write in one conversation",
      "Step through; switch scenario to see a stale memory corrected.",
      M6_MEMORY_READ_AND_WRITE_IN_ONE_CONVERSATION,
      "Memories carry provenance and age; old ones are confirmed before being acted on; corrections supersede rather than accumulate.",
    ),

    h2("rag", "Retrieval-augmented generation (RAG)"),
    p(
      "**Retrieval-augmented generation** gives the model access to knowledge it was not trained on, your documentation, tickets, policies, by retrieving relevant passages at question time and placing them in context. It has two halves: an **offline** ingest pipeline that prepares documents, and an **online** query pipeline that finds the right passages for each question.",
    ),
    visual(
      "The RAG pipeline",
      "Trace a question through both halves. Then try the stale-index scenario, the failure a retrieval pipeline cannot see.",
      RAG_PIPELINE,
      "Most RAG quality problems are ingest problems, chunking, metadata, freshness, not model problems. Instrument ingest as carefully as the query path.",
    ),
    h3("Embeddings, conceptually"),
    p(
      'An **embedding model** maps a piece of text to a list of numbers, a vector, such that texts with similar meaning produce vectors that are close together. "How do I get my money back?" and "refund process" share no words but land near each other. Retrieval then becomes a nearest-neighbour search: embed the query, find the closest passage vectors.',
    ),
    p(
      "Embeddings are excellent at meaning and weak at exact tokens: product codes, error numbers, names. That is why production systems often combine **vector search** with **keyword search** (hybrid retrieval) and then **rerank** the merged candidates with a more precise model.",
    ),

    h2("quality", "Retrieval quality trade-offs"),
    visual(
      "Retrieval design choices",
      "Pick a situation to see which retrieval approach fits better.",
      M6_RETRIEVAL_DESIGN_CHOICES,
      "There is no single best retriever, measure on your own queries.",
    ),
    table(
      ["Knob", "Too low", "Too high"],
      [
        [
          "Chunk size",
          "Passages lack context to stand alone",
          "Relevant sentence diluted; fewer passages fit",
        ],
        [
          "Top-k passed to model",
          "Answer not among passages (low recall)",
          "Distracting passages; cost; buried facts",
        ],
        [
          "Similarity threshold",
          "Irrelevant passages accepted",
          'Valid answers rejected → "I don\'t know"',
        ],
        [
          "Index refresh interval",
          "Cost of constant re-embedding",
          "Stale answers",
        ],
      ],
    ),
    tip(
      "Measure retrieval separately from generation. For a set of real questions, record which passages *should* be retrieved and check recall@k. If the right passage is not retrieved, no prompt will save the answer.",
    ),

    h2("compress", "Context compression"),
    ul(
      "**Extractive**: keep only sentences from retrieved passages that relate to the query.",
      "**Abstractive**: summarise a long tool output or conversation segment with a model call (cheap model, strict length).",
      "**Structural**: convert verbose JSON to the handful of fields the decision needs.",
      "**Deferred**: store the full content in state and give the model a handle (`doc_17`) plus a short digest, with a tool to expand it if needed.",
    ),

    h2("code", "Code: building a budgeted context"),
    code(
      "python",
      "Python, educational; `count_tokens`, `summarise` and `retrieve` are your adapters",
      `
def build_context(state, user, budget=12_000):
    parts = [
        ("instructions", SYSTEM_PROMPT, 100, True),
        ("goal",         state.goal_and_plan(), 100, True),
        ("latest",       compact(state.last_observation()), 90, False),
    ]
    for p in retrieve(state.current_query(), user=user, k=20, rerank_to=4):
        parts.append((f"doc:{p.id}", f"[{p.source}, {p.date}] {p.text}", 70 + p.score * 10, False))
    for m in memory.recall(user, task=state.task_type, limit=5):
        parts.append((f"mem:{m.key}", f"{m.value} (as of {m.as_of})", 60, False))
    parts.append(("history", summarise(state.older_turns(), max_tokens=800), 50, False))

    chosen, used = [], 0
    for name, text, prio, required in sorted(parts, key=lambda x: (not x[3], -x[2])):
        cost = count_tokens(text)
        if required or used + cost <= budget:
            chosen.append((name, text)); used += cost
    # instructions first; freshest evidence last, where it is used most reliably
    order = ["instructions", "history"] + [n for n, _ in chosen if n.startswith(("mem:", "doc:"))] + ["goal", "latest"]
    by_name = dict(chosen)
    return "\\n\\n".join(by_name[n] for n in order if n in by_name), used
`,
      "Every item carries a priority and a cost; required items are never dropped; retrieved passages and memories include source and date so the model can judge them.",
    ),

    h2("risks", "Stale, wrong and sensitive memory"),
    h3("Stale memory"),
    p(
      "Facts expire: people change jobs, policies are revised, preferences shift. Store `as_of` dates, attach review or expiry dates to volatile facts, prefer the newest source in conflicts, and confirm old memories before acting on them.",
    ),
    h3("Incorrect memory"),
    p(
      'An agent that writes its own inferences into memory can **launder** a hallucination into a "fact" that is then retrieved with apparent authority in every future session. Distinguish *user-stated* from *agent-inferred* memories, require higher confidence for inferred ones, and let users see and correct what is remembered about them.',
    ),
    h3("Privacy"),
    warn(
      "Memory turns a single conversation into a lasting record. Store only what the task needs (data minimisation), never store secrets or credentials, treat health, financial and similar categories as off-limits by default, scope memory strictly per user or tenant, and provide deletion. In India the Digital Personal Data Protection Act, and elsewhere GDPR-style laws, make these obligations, not niceties.",
      "Memory is personal data",
    ),
    note(
      "Retrieval must respect permissions **before** ranking. If a user cannot open a document, its passages must never be candidates, filtering after retrieval risks leaks through summaries and citations.",
    ),

    h2("cost", "Token and cost trade-offs"),
    table(
      ["Decision", "Cheaper", "Better quality (usually)"],
      [
        ["History", "Rolling summary", "Recent turns verbatim + summary"],
        ["Retrieval", "Vector top-3, no rerank", "Hybrid top-30 → rerank to 4"],
        [
          "Tool outputs",
          "Aggressive field trimming",
          "Trimmed + expandable handle",
        ],
        ["Memory recall", "Keyed facts only", "Keyed + episodic similarity"],
      ],
    ),
    p(
      "Make these choices with an evaluation set in hand. It is common to find that a smaller, better-curated context both costs less *and* scores higher than a large one.",
    ),

    visual("Sort it: which kind of memory?", "Place each piece of information in the memory type that should hold it.", M6_WHICH_MEMORY, "Each memory type is written and read differently. Putting information in the right one is most of memory design."),

    h2("takeaways", "Key takeaways"),
    takeaways(
      "Models are stateless; memory is the runtime deciding what to store and what to bring back.",
      "Rebuild context every step from state, ranked and packed within a budget; a big window is not a reason to fill it.",
      "Distinguish working, episodic, semantic and procedural memory, each is read differently.",
      "Writes go through a policy: provenance, supersession, expiry, privacy. Confirm old memories before acting.",
      "RAG quality is mostly ingest and retrieval quality; measure recall separately, use hybrid + rerank where needed, and filter by permission before ranking.",
    ),

    h2("exercise", "Exercise: design memory for a tutor"),
    exercise({
      title: "Memory for a DSA practice tutor",
      brief:
        "An agent helps students practise data-structures problems over months: it picks problems, gives hints, reviews solutions and adapts to weaknesses.",
      tasks: [
        "List what belongs in working, episodic, semantic and procedural memory, with two concrete examples each.",
        "Write the memory write policy: what is stored, what is never stored, and how conflicts and staleness are handled.",
        "Design the context for the *choose next problem* step with a 6,000-token budget; list items with priorities and approximate costs.",
        'Describe how a hallucinated weakness ("struggles with recursion" when they do not) could enter memory, and two defences.',
        "Define one retrieval metric and one end-to-end metric you would track.",
      ],
      hints: [
        'Solved/failed attempts with timestamps are episodic; "weak at graph traversal" is a semantic inference from them, how confident must it be?',
        "Students should be able to see and edit what the tutor believes about them.",
      ],
      model: [
        "Semantic weaknesses are derived from repeated episodic evidence, with counts and dates, not from one conversation.",
        "Inferred facts are labelled as inferred and decay without fresh evidence.",
        "The next-problem context pins goals and recent attempts, retrieves the weakness profile, and excludes full past transcripts.",
        "Metrics such as recall@5 for relevant past attempts, and improvement in solve rate on targeted topics.",
      ],
    }),

    h2("quiz", "Knowledge check"),
    quiz(
      {
        q: "An agent with a 200k-token window includes the entire 150k-token product manual on every call. Answers are slow, costly and sometimes miss facts that are in the manual. Best change?",
        options: [
          "Use a model with a 1M-token window",
          "Retrieve and rerank the few relevant passages per question instead of sending the whole manual",
          "Put the manual at the end of the prompt",
          "Ask the model to read more carefully",
        ],
        answer: 1,
        why: "Retrieval cuts cost and latency and puts relevant facts in focus; facts buried in a huge context are used less reliably.",
      },
      {
        q: "Users report the assistant answering with last quarter's pricing even though the pricing page was updated. Retrieval metrics look healthy. Most likely cause?",
        options: [
          "The embedding model is too small",
          "Top-k is too low",
          "The ingest pipeline did not re-index the updated page (a stale index)",
          "The model's temperature",
        ],
        answer: 2,
        why: "The query path can work perfectly on stale data. Freshness is an ingest concern, needing monitoring and `as_of` metadata.",
      },
      {
        q: 'A query is "What does error E-4012 mean?" Pure vector search returns passages about other errors. What should you add?',
        options: [
          "Longer chunks",
          "Keyword (lexical) search in a hybrid retriever, then rerank",
          "More memories",
          "A higher temperature",
        ],
        answer: 1,
        why: "Embeddings blur exact identifiers; keyword search matches them precisely. Hybrid + rerank gets both.",
      },
      {
        q: "During a chat a user mentions a medical diagnosis while asking for help scheduling study sessions. What should the memory manager do?",
        options: [
          "Store it; more context is always better",
          "Store it but hide it from the user",
          "Not store it, it is sensitive and unnecessary for the task",
          "Store it in episodic memory only",
        ],
        answer: 2,
        why: "Data minimisation: store only what the task needs, and treat sensitive categories as off-limits by default.",
      },
      {
        q: 'Memory holds both "prefers email" (January) and "prefers WhatsApp" (August). Retrieval returns both. What design would have prevented the ambiguity?',
        options: [
          "Storing memories without dates",
          "Supersession: new facts about the same key replace (and archive) older ones, with provenance",
          "Retrieving more memories",
          "Asking the model to pick randomly",
        ],
        answer: 1,
        why: "Semantic memory needs update semantics. Keyed facts with provenance and supersession keep one current value.",
      },
      {
        q: 'In a long session the agent forgets the user\'s original constraint ("budget under ₹20,000"). Which short-term memory strategy fixes this most directly?',
        options: [
          "A sliding window of the last 5 turns",
          "Pinning key facts and constraints so they are always included, with a window or summary for the rest",
          "Removing the system prompt to save space",
          "Episodic memory of past sessions",
        ],
        answer: 1,
        why: "Sliding windows drop early constraints. Pinning guarantees critical facts survive regardless of session length.",
      },
    ),

    h2("references", "References and further reading"),
    refs(
      R.rag,
      R.dpr,
      R.lostMiddle,
      R.memgpt,
      R.genAgents,
      R.reflexion,
      R.weng,
    ),
  ],
};
