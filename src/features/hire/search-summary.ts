import "server-only";

/**
 * Scout's search summary: the message posted after a first search, before the
 * recruiter opens the pool.
 *
 * The facts are computed in code (`computeSearchFacts`); Gemini only words
 * them. Its reply is kept only if it passes `summaryIsGrounded`: every number
 * in it must be one of the facts and it must state the matching count.
 * Anything else (no key, timeout, an invented figure) shows the template,
 * which says the same thing in set sentences. The recruiter always gets a
 * summary, and it is never wrong.
 *
 * Nothing about a candidate is sent: only counts, the role title, skill names
 * and filter labels from the recruiter's own brief.
 */
import { logger, safeErrorMessage } from "@/lib/logger";
import { HIRE_BRIEF_DEFAULT_MODEL } from "@/features/hire/gemini-brief";
import {
  summaryIsGrounded,
  templateSearchSummary,
  type SearchFacts,
  type SummaryTop,
} from "@/features/hire/search-facts";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** One attempt: the recruiter is waiting on this search. */
const TIMEOUT_MS = 6000;

const SYSTEM_PROMPT = `You are Scout, the recruiting assistant on Klymb AI, an Indian tech hiring platform.
Write the short summary Scout shows a recruiter right after a candidate search, before they open the results.

Rules:
- 2 to 4 short sentences of plain prose, first person ("I looked through...", "I have ranked..."). Warm, clear, professional.
- Use ONLY the facts given. Every number you write must appear in the facts exactly as given. Never round, add, subtract or estimate.
- Say how many candidates match ("matching"). Mention the role, each filter and each skill with its count when they are present.
- Never invent skills, cities, filters or candidates. Never use the words "all" or "every" about candidates except "have all of them" for the skills.
- No markdown, no lists, no line breaks, no em dashes, no quotation marks.
- A draft is supplied. Improve its flow; keep its facts.`;

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

/** The summary to post. Never throws; falls back to the template. */
export async function writeSearchSummary(
  facts: SearchFacts,
  top: SummaryTop,
  opts: { fetchImpl?: typeof fetch; apiKey?: string | null } = {},
): Promise<string> {
  const draft = templateSearchSummary(facts, top);
  const apiKey =
    opts.apiKey === undefined ? process.env.GEMINI_API_KEY?.trim() || null : opts.apiKey;
  if (!apiKey) return draft;

  const model = process.env.HIRE_BRIEF_GEMINI_MODEL?.trim() || HIRE_BRIEF_DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Facts:\n${JSON.stringify({ ...facts, topShown: top.shown, strongInTop: top.strong })}\n\nDraft:\n${draft}`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn("[hire-summary] search summary request failed", {
        status: res.status,
        model,
      });
      return draft;
    }
    const json = (await res.json()) as GeminiResponse;
    const text = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!summaryIsGrounded(text, facts, top)) {
      logger.warn("[hire-summary] search summary failed its checks", { model });
      return draft;
    }
    return text;
  } catch (error) {
    logger.warn("[hire-summary] search summary request threw", {
      model,
      reason: controller.signal.aborted ? "timeout" : "network",
      error: controller.signal.aborted ? null : safeErrorMessage(error),
    });
    return draft;
  } finally {
    clearTimeout(timer);
  }
}
