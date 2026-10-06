import type { Course } from "../types";
import { m1 } from "./m1-introduction";
import { m2 } from "./m2-architecture";
import { m3 } from "./m3-first-agent";
import { m4 } from "./m4-workflows";
import { m5 } from "./m5-multi-agent";
import { m6 } from "./m6-memory";
import { m7 } from "./m7-reliability";
import { m8 } from "./m8-capstone";
import { AGENTIC_HERO_ORBIT } from "../assets/visuals/interactive";

export const agenticAiCourse: Course = {
  slug: "agentic-ai",
  title: "Agentic AI Systems",
  tagline: "Design, build and ship AI agents that actually work.",
  description:
    "A deep, text-first course on how agentic systems are designed: the agent loop, architecture, tool calling, workflows, multi-agent coordination, memory and retrieval, and the reliability engineering that makes agents safe to ship. Every concept comes with interactive diagrams, worked examples, exercises and scenario quizzes.",
  level: "Intermediate · assumes basic Python and API familiarity",
  outcomes: [
    "Decide when an agent is the right design, and when a workflow or plain code is better",
    "Architect an agent runtime: context, tools, state, planning and termination",
    "Build a tool-calling agent with validation, error handling and tests",
    "Compose sequential, parallel, routed and human-approved workflows",
    "Design multi-agent systems without drowning in coordination failures",
    "Engineer memory, retrieval and context budgets",
    "Make agents reliable: guardrails, retries, circuit breakers, evaluation and tracing",
  ],
  skills: [
    "Agentic AI",
    "AI Agent Architecture",
    "Tool Calling / Function Calling",
    "LLM Workflow Orchestration",
    "Multi-Agent Systems",
    "Retrieval-Augmented Generation (RAG)",
    "Context & Memory Engineering",
    "AI Guardrails & Reliability",
    "LLM Evaluation & Observability",
  ],
  hero: AGENTIC_HERO_ORBIT,
  modules: [m1, m2, m3, m4, m5, m6, m7, m8],
};
