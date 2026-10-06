import type { Block, QuizQuestion, Reference, VisualConfig } from "./types";

/** Terse builders so module files read like prose, not object literals. */
export const h2 = (id: string, text: string): Block => ({
  type: "h2",
  id,
  text,
});
export const h3 = (text: string): Block => ({ type: "h3", text });
export const p = (text: string): Block => ({ type: "p", text });
export const ul = (...items: string[]): Block => ({ type: "list", items });
export const ol = (...items: string[]): Block => ({
  type: "list",
  ordered: true,
  items,
});
export const note = (text: string, title?: string): Block => ({
  type: "callout",
  tone: "note",
  text,
  title,
});
export const tip = (text: string, title?: string): Block => ({
  type: "callout",
  tone: "tip",
  text,
  title,
});
export const warn = (text: string, title?: string): Block => ({
  type: "callout",
  tone: "warn",
  text,
  title,
});
export const example = (text: string, title?: string): Block => ({
  type: "callout",
  tone: "example",
  text,
  title,
});
export const table = (
  head: string[],
  rows: string[][],
  caption?: string,
): Block => ({ type: "table", head, rows, caption });
export const code = (
  lang: string,
  label: string,
  src: string,
  caption?: string,
): Block => ({
  type: "code",
  lang,
  label,
  code: src.replace(/^\n/, "").replace(/\s+$/, ""),
  caption,
});
export const pseudo = (src: string, caption?: string): Block =>
  code("python", "Pseudocode, illustrative", src, caption);
export const visual = (
  title: string,
  howTo: string,
  v: VisualConfig,
  caption: string,
): Block => ({
  type: "visual",
  title,
  howTo,
  caption,
  visual: v,
});
/**
 * Authors write the correct option wherever it reads naturally; the builder
 * then rotates it to a position that cycles through A–D across the quiz
 * (seeded by the first question), so no quiz favours one letter.
 */
function moveAnswer(q: QuizQuestion, target: number): QuizQuestion {
  if (target === q.answer) return q;
  const options = [...q.options];
  [options[target], options[q.answer]] = [options[q.answer], options[target]];
  return { ...q, options, answer: target };
}
export const quiz = (...questions: QuizQuestion[]): Block => {
  let seed = 0;
  for (const ch of questions[0]?.q ?? "")
    seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    type: "quiz",
    questions: questions.map((q, i) =>
      moveAnswer(q, (seed + i * 3) % q.options.length),
    ),
  };
};
export const takeaways = (...items: string[]): Block => ({
  type: "takeaways",
  items,
});
export const refs = (...items: Reference[]): Block => ({
  type: "references",
  items,
});
export const exercise = (e: {
  title: string;
  brief: string;
  tasks: string[];
  hints?: string[];
  model?: string[];
}): Block => ({
  type: "exercise",
  ...e,
});
