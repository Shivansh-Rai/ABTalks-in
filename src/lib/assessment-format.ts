/**
 * Plan 166 — the light formatting assessment authors can use in question
 * text, help text, options and instructions:
 *
 *   *bold*   _italic_   `code`   and Enter for a new line.
 *
 * Parsed into tokens and rendered as React elements (FormattedText) — never
 * as HTML — so author text can't inject markup. Pure and dependency-free so
 * the server, the builder preview and the candidate screen agree.
 *
 * A marker only counts when it hugs the text (`*bold*`, not `* bold *`) and
 * sits on a word boundary, so `snake_case_names`, `2*3*4` and a lone `*` stay
 * literal. Markers never span a line break. Code is taken literally: nothing
 * inside backticks is formatted.
 */

export type FormatToken =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "bold" | "italic"; children: FormatToken[] };

const CODE = /`([^`\n]+)`/;
const BOLD = /(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/;
const ITALIC = /(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/;

type Found = { start: number; end: number; token: FormatToken };

function find(text: string): Found | null {
  const candidates: Found[] = [];

  const code = CODE.exec(text);
  if (code) {
    candidates.push({
      start: code.index,
      end: code.index + code[0].length,
      token: { kind: "code", text: code[1] },
    });
  }
  for (const [re, kind] of [
    [BOLD, "bold"],
    [ITALIC, "italic"],
  ] as const) {
    const m = re.exec(text);
    if (!m) continue;
    // Group 1 is the boundary character before the marker, not part of it.
    const start = m.index + m[1].length;
    candidates.push({
      start,
      end: m.index + m[0].length,
      token: { kind, children: parseInline(m[2]) },
    });
  }
  if (candidates.length === 0) return null;
  // Earliest wins; on a tie code wins (it was pushed first).
  return candidates.reduce((a, b) => (b.start < a.start ? b : a));
}

/** Inline tokens for text that may contain line breaks (kept as "\n"). */
export function parseInline(text: string): FormatToken[] {
  const out: FormatToken[] = [];
  let rest = text;
  while (rest.length > 0) {
    const hit = find(rest);
    if (!hit) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (hit.start > 0) out.push({ kind: "text", text: rest.slice(0, hit.start) });
    out.push(hit.token);
    rest = rest.slice(hit.end);
  }
  return out;
}
