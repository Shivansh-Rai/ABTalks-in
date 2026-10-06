import type { Reference } from "./types";

/**
 * Shared reference library so modules cite the same source the same way.
 * Only primary papers and official documentation; no invented citations.
 */
export const R = {
  react: {
    title: "ReAct: Synergizing Reasoning and Acting in Language Models",
    source: "Yao et al., 2022 (arXiv:2210.03629)",
    url: "https://arxiv.org/abs/2210.03629",
  },
  toolformer: {
    title: "Toolformer: Language Models Can Teach Themselves to Use Tools",
    source: "Schick et al., 2023 (arXiv:2302.04761)",
    url: "https://arxiv.org/abs/2302.04761",
  },
  reflexion: {
    title: "Reflexion: Language Agents with Verbal Reinforcement Learning",
    source: "Shinn et al., 2023 (arXiv:2303.11366)",
    url: "https://arxiv.org/abs/2303.11366",
  },
  selfRefine: {
    title: "Self-Refine: Iterative Refinement with Self-Feedback",
    source: "Madaan et al., 2023 (arXiv:2303.17651)",
    url: "https://arxiv.org/abs/2303.17651",
  },
  cot: {
    title:
      "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models",
    source: "Wei et al., 2022 (arXiv:2201.11903)",
    url: "https://arxiv.org/abs/2201.11903",
  },
  tot: {
    title:
      "Tree of Thoughts: Deliberate Problem Solving with Large Language Models",
    source: "Yao et al., 2023 (arXiv:2305.10601)",
    url: "https://arxiv.org/abs/2305.10601",
  },
  aima: {
    title: "Artificial Intelligence: A Modern Approach (4th ed.)",
    source: "Russell & Norvig",
    url: "https://aima.cs.berkeley.edu/",
    note: "Chapter 2 defines agents, environments and agent types",
  },
  anthropicAgents: {
    title: "Building effective agents",
    source: "Anthropic Engineering, 2024",
    url: "https://www.anthropic.com/engineering/building-effective-agents",
  },
  anthropicMultiAgent: {
    title: "How we built our multi-agent research system",
    source: "Anthropic Engineering, 2025",
    url: "https://www.anthropic.com/engineering/built-multi-agent-research-system",
  },
  anthropicTools: {
    title: "Tool use with Claude",
    source: "Anthropic documentation",
    url: "https://docs.anthropic.com/en/docs/build-with-claude/tool-use",
  },
  openaiTools: {
    title: "Function calling",
    source: "OpenAI platform documentation",
    url: "https://platform.openai.com/docs/guides/function-calling",
  },
  jsonSchema: {
    title: "JSON Schema specification",
    source: "json-schema.org",
    url: "https://json-schema.org/",
  },
  mcp: {
    title: "Model Context Protocol",
    source: "modelcontextprotocol.io",
    url: "https://modelcontextprotocol.io/",
  },
  weng: {
    title: "LLM Powered Autonomous Agents",
    source: "Lilian Weng, 2023",
    url: "https://lilianweng.github.io/posts/2023-06-23-agent/",
  },
  huyen: {
    title: "Agents",
    source: "Chip Huyen, 2025",
    url: "https://huyenchip.com/2025/01/07/agents.html",
  },
  rag: {
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    source: "Lewis et al., 2020 (arXiv:2005.11401)",
    url: "https://arxiv.org/abs/2005.11401",
  },
  dpr: {
    title: "Dense Passage Retrieval for Open-Domain Question Answering",
    source: "Karpukhin et al., 2020 (arXiv:2004.04906)",
    url: "https://arxiv.org/abs/2004.04906",
  },
  lostMiddle: {
    title: "Lost in the Middle: How Language Models Use Long Contexts",
    source: "Liu et al., 2023 (arXiv:2307.03172)",
    url: "https://arxiv.org/abs/2307.03172",
  },
  memgpt: {
    title: "MemGPT: Towards LLMs as Operating Systems",
    source: "Packer et al., 2023 (arXiv:2310.08560)",
    url: "https://arxiv.org/abs/2310.08560",
  },
  genAgents: {
    title: "Generative Agents: Interactive Simulacra of Human Behavior",
    source: "Park et al., 2023 (arXiv:2304.03442)",
    url: "https://arxiv.org/abs/2304.03442",
  },
  autogen: {
    title:
      "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation",
    source: "Wu et al., 2023 (arXiv:2308.08155)",
    url: "https://arxiv.org/abs/2308.08155",
  },
  camel: {
    title:
      'CAMEL: Communicative Agents for "Mind" Exploration of Large Language Model Society',
    source: "Li et al., 2023 (arXiv:2303.17760)",
    url: "https://arxiv.org/abs/2303.17760",
  },
  metagpt: {
    title:
      "MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework",
    source: "Hong et al., 2023 (arXiv:2308.00352)",
    url: "https://arxiv.org/abs/2308.00352",
  },
  masFail: {
    title: "Why Do Multi-Agent LLM Systems Fail?",
    source: "Cemri et al., 2025 (arXiv:2503.13657)",
    url: "https://arxiv.org/abs/2503.13657",
  },
  injection: {
    title:
      "Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection",
    source: "Greshake et al., 2023 (arXiv:2302.12173)",
    url: "https://arxiv.org/abs/2302.12173",
  },
  hierarchy: {
    title:
      "The Instruction Hierarchy: Training LLMs to Prioritize Privileged Instructions",
    source: "Wallace et al., 2024 (arXiv:2404.13208)",
    url: "https://arxiv.org/abs/2404.13208",
  },
  owasp: {
    title: "OWASP Top 10 for Large Language Model Applications",
    source: "OWASP Foundation",
    url: "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
  },
  nist: {
    title: "AI Risk Management Framework",
    source: "NIST",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
  },
  breaker: {
    title: "CircuitBreaker",
    source: "Martin Fowler",
    url: "https://martinfowler.com/bliki/CircuitBreaker.html",
  },
  backoff: {
    title: "Exponential Backoff and Jitter",
    source: "AWS Architecture Blog",
    url: "https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/",
  },
  sre: {
    title: "Site Reliability Engineering",
    source: "Google (Beyer et al.)",
    url: "https://sre.google/sre-book/table-of-contents/",
  },
  otel: {
    title: "Semantic conventions for generative AI systems",
    source: "OpenTelemetry",
    url: "https://opentelemetry.io/docs/specs/semconv/gen-ai/",
  },
  judge: {
    title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena",
    source: "Zheng et al., 2023 (arXiv:2306.05685)",
    url: "https://arxiv.org/abs/2306.05685",
  },
  swebench: {
    title: "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?",
    source: "Jimenez et al., 2023 (arXiv:2310.06770)",
    url: "https://arxiv.org/abs/2310.06770",
  },
  langgraph: {
    title: "LangGraph documentation",
    source: "LangChain",
    url: "https://langchain-ai.github.io/langgraph/",
  },
  hugginggpt: {
    title:
      "HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in Hugging Face",
    source: "Shen et al., 2023 (arXiv:2303.17580)",
    url: "https://arxiv.org/abs/2303.17580",
  },
} satisfies Record<string, Reference>;
