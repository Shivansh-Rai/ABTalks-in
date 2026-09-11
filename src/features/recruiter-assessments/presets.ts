import type { ContentInput } from "./service";

/**
 * ABTalks-authored assessment templates.
 *
 * These are static blueprints, NOT database rows. A preset only reaches the DB
 * when a recruiter uses it — at that point its `content` is written through the
 * normal `createAssessment` path (see `createAssessmentFromPresetAction` and the
 * `?preset=` branch in `/hire/create-test`). Keep every preset valid against
 * `assessmentDraftSchema`; `presets.test.ts` enforces that at build time.
 *
 * `content` omits `assessmentId` (always a fresh create) and `shortlistRefs`
 * (attached from the recruiter's current shortlist at use time).
 */
export type AssessmentPreset = {
  id: string;
  name: string;
  tagline: string;
  tags: string[];
  content: ContentInput;
};

/** MCQ option helper — keeps preset authoring terse and correct. */
function opt(body: string, isCorrect = false) {
  return { body, isCorrect };
}

const FRONTEND: AssessmentPreset = {
  id: "frontend-fundamentals",
  name: "Frontend fundamentals",
  tagline: "HTML, CSS and JavaScript basics for web roles.",
  tags: ["Frontend", "JavaScript", "CSS"],
  content: {
    title: "Frontend fundamentals",
    subheading: "A short screen covering core web knowledge.",
    instructions:
      "Answer every question. Multiple-choice questions have one correct answer unless stated otherwise.",
    durationMinutes: 25,
    passMarkPercent: 60,
    shortlistRefs: [],
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "Which HTML element is correct for the largest section heading?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("<h1>", true), opt("<head>"), opt("<heading>"), opt("<h6>")],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "In CSS, which property controls the space inside an element's border?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("margin"), opt("padding", true), opt("gap"), opt("border-box")],
      },
      {
        type: "MULTIPLE_CHOICE",
        title:
          "Which of the following are falsy values in JavaScript? (select all that apply)",
        helpText: "There is more than one correct answer.",
        isRequired: true,
        points: 2,
        allowMultipleCorrect: true,
        options: [opt("0", true), opt('""', true), opt("[]"), opt("null", true)],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "What does the CSS `display: flex` establish on an element?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [
          opt("A flex formatting context for its children", true),
          opt("A new browser tab"),
          opt("A grid of fixed columns"),
          opt("An inline image"),
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "Which method converts a JSON string into a JavaScript object?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [
          opt("JSON.stringify()"),
          opt("JSON.parse()", true),
          opt("Object.toJSON()"),
          opt("String.parse()"),
        ],
      },
      {
        type: "PARAGRAPH",
        title:
          "Explain the difference between `let`, `const` and `var` and when you would use each.",
        helpText: "A few sentences is enough.",
        isRequired: true,
        points: 5,
        maxWords: 200,
      },
    ],
  },
};

const REACT: AssessmentPreset = {
  id: "react-screen",
  name: "React screen",
  tagline: "Hooks, state and rendering for React developers.",
  tags: ["React", "Frontend", "Hooks"],
  content: {
    title: "React screen",
    subheading: "Core React knowledge for component work.",
    instructions:
      "Answer every question. Assume a modern React (function components with hooks).",
    durationMinutes: 25,
    passMarkPercent: 60,
    shortlistRefs: [],
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "Which hook is used to store local component state?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [
          opt("useEffect"),
          opt("useState", true),
          opt("useMemo"),
          opt("useContext"),
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "When does the callback passed to `useEffect(fn, [])` run?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [
          opt("After every render"),
          opt("Once, after the first render", true),
          opt("Before the first render"),
          opt("Only when the component unmounts"),
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "Why does React need a stable `key` on items in a list?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [
          opt("To identify which items changed, were added or removed", true),
          opt("To style the list"),
          opt("To sort the list automatically"),
          opt("It is optional and has no effect"),
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "Which of the following are React hooks? (select all that apply)",
        helpText: "There is more than one correct answer.",
        isRequired: true,
        points: 2,
        allowMultipleCorrect: true,
        options: [
          opt("useReducer", true),
          opt("useRef", true),
          opt("useComponent"),
          opt("useCallback", true),
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "What is the correct way to update state based on the previous value?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [
          opt("setCount(count + 1)"),
          opt("setCount((prev) => prev + 1)", true),
          opt("count = count + 1"),
          opt("this.setState(count + 1)"),
        ],
      },
      {
        type: "PARAGRAPH",
        title:
          "A component re-renders too often and feels slow. Describe how you would investigate and fix it.",
        helpText: null,
        isRequired: true,
        points: 5,
        maxWords: 220,
      },
    ],
  },
};

const PYTHON: AssessmentPreset = {
  id: "python-fundamentals",
  name: "Python fundamentals",
  tagline: "Syntax, data structures and idioms for Python roles.",
  tags: ["Python", "Backend", "Data"],
  content: {
    title: "Python fundamentals",
    subheading: "Core Python knowledge.",
    instructions: "Answer every question. Assume Python 3.",
    durationMinutes: 25,
    passMarkPercent: 60,
    shortlistRefs: [],
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "Which data structure is ordered and mutable?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("tuple"), opt("list", true), opt("frozenset"), opt("str")],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "What does a list comprehension `[x*x for x in range(3)]` produce?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [
          opt("[0, 1, 4]", true),
          opt("[1, 4, 9]"),
          opt("[0, 1, 2]"),
          opt("A syntax error"),
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "Which of the following are immutable in Python? (select all that apply)",
        helpText: "There is more than one correct answer.",
        isRequired: true,
        points: 2,
        allowMultipleCorrect: true,
        options: [opt("tuple", true), opt("str", true), opt("list"), opt("int", true)],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "What is the output of `len({'a': 1, 'b': 2, 'a': 3})`?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("2", true), opt("3"), opt("1"), opt("A KeyError")],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "Which keyword defines a function in Python?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("func"), opt("def", true), opt("function"), opt("lambda")],
      },
      {
        type: "PARAGRAPH",
        title:
          "Explain the difference between a list and a dictionary, and give one situation where each is the better choice.",
        helpText: null,
        isRequired: true,
        points: 5,
        maxWords: 200,
      },
    ],
  },
};

const BACKEND: AssessmentPreset = {
  id: "backend-api",
  name: "Backend / API",
  tagline: "HTTP, REST and database basics for backend roles.",
  tags: ["Backend", "API", "Databases"],
  content: {
    title: "Backend / API",
    subheading: "Fundamentals for building and consuming APIs.",
    instructions: "Answer every question.",
    durationMinutes: 30,
    passMarkPercent: 60,
    shortlistRefs: [],
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "Which HTTP status code means 'Not Found'?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("200"), opt("301"), opt("404", true), opt("500")],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "Which HTTP method is idempotent and used to fully replace a resource?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("POST"), opt("PUT", true), opt("PATCH"), opt("CONNECT")],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "In a relational database, what does a foreign key do?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [
          opt("References the primary key of another table", true),
          opt("Encrypts a column"),
          opt("Creates an index automatically on every column"),
          opt("Stores JSON only"),
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        title:
          "Which of the following are safe to send in an HTTP request body rather than the URL? (select all that apply)",
        helpText: "There is more than one correct answer.",
        isRequired: true,
        points: 2,
        allowMultipleCorrect: true,
        options: [
          opt("A password", true),
          opt("A large JSON payload", true),
          opt("A public page number"),
          opt("A file upload", true),
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "What is the main purpose of a database index?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [
          opt("To speed up read queries", true),
          opt("To back up the database"),
          opt("To encrypt rows"),
          opt("To normalise data automatically"),
        ],
      },
      {
        type: "PARAGRAPH",
        title:
          "Design a simple REST API for a to-do list. List the endpoints, their methods, and what each returns.",
        helpText: null,
        isRequired: true,
        points: 6,
        maxWords: 250,
      },
    ],
  },
};

const APTITUDE: AssessmentPreset = {
  id: "general-aptitude",
  name: "General aptitude",
  tagline: "Reasoning and problem-solving — role-agnostic.",
  tags: ["Aptitude", "Reasoning"],
  content: {
    title: "General aptitude",
    subheading: "Logic and problem-solving.",
    instructions: "Answer every question.",
    durationMinutes: 20,
    passMarkPercent: 60,
    shortlistRefs: [],
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "What is the next number in the sequence: 2, 6, 12, 20, 30, ...?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("40"), opt("42", true), opt("36"), opt("44")],
      },
      {
        type: "MULTIPLE_CHOICE",
        title:
          "If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely:",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("Lazzies", true), opt("Not Lazzies"), opt("Only some Lazzies"), opt("Neither")],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "A shirt costs 500 after a 20% discount. What was the original price?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("600"), opt("625", true), opt("650"), opt("580")],
      },
      {
        type: "MULTIPLE_CHOICE",
        title: "Which word does NOT belong: apple, banana, carrot, mango?",
        helpText: null,
        isRequired: true,
        points: 1,
        allowMultipleCorrect: false,
        options: [opt("apple"), opt("banana"), opt("carrot", true), opt("mango")],
      },
      {
        type: "PARAGRAPH",
        title:
          "You have two ropes that each take exactly 60 minutes to burn, but not at a constant rate. How would you measure 45 minutes? Explain your reasoning.",
        helpText: null,
        isRequired: true,
        points: 5,
        maxWords: 220,
      },
    ],
  },
};

const PRESETS: AssessmentPreset[] = [FRONTEND, REACT, PYTHON, BACKEND, APTITUDE];

export function listAssessmentPresets(): AssessmentPreset[] {
  return PRESETS;
}

export function getAssessmentPreset(id: string): AssessmentPreset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * Combine one or more presets into a single assessment draft. Questions are
 * concatenated in the given order; duration is the sum when every chosen preset
 * is timed, otherwise untimed. `shortlistRefs` is left empty — the caller
 * attaches the recruiter's current shortlist. Returns null if no id resolves.
 */
export function buildContentFromPresets(ids: string[]): ContentInput | null {
  const chosen = ids
    .map((id) => getAssessmentPreset(id))
    .filter((p): p is AssessmentPreset => p !== null);
  if (chosen.length === 0) return null;

  const questions = chosen.flatMap((p) => p.content.questions);
  const allTimed = chosen.every((p) => p.content.durationMinutes != null);
  const durationMinutes = allTimed
    ? chosen.reduce((sum, p) => sum + (p.content.durationMinutes ?? 0), 0)
    : null;
  const title =
    chosen.length === 1
      ? chosen[0].content.title
      : chosen.map((p) => p.name).join(" + ");

  return {
    title: title.slice(0, 200),
    subheading:
      chosen.length === 1
        ? chosen[0].content.subheading
        : "Combined from ABTalks templates.",
    instructions: "Answer every question.",
    durationMinutes,
    passMarkPercent: 60,
    shortlistRefs: [],
    questions,
  };
}
