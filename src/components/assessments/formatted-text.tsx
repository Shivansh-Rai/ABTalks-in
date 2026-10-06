import type { ReactNode } from "react";
import { parseInline, type FormatToken } from "@/lib/assessment-format";

/**
 * Plan 166 — renders assessment text with *bold*, _italic_, `code` and line
 * breaks. React elements only (no HTML injection). No hooks, so it works in
 * Server and Client Components alike.
 *
 * `pre-wrap` keeps the author's line breaks and indentation; it is inline so
 * no stylesheet (hire-scout.css is unlayered) can override it.
 */
function render(tokens: FormatToken[], keyPrefix: string): ReactNode[] {
  return tokens.map((t, i) => {
    const key = `${keyPrefix}${i}`;
    switch (t.kind) {
      case "text":
        return t.text;
      case "code":
        return (
          <code
            key={key}
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
              fontSize: "0.9em",
              padding: "0.1em 0.35em",
              borderRadius: "4px",
              background: "rgba(3, 83, 95, 0.08)",
            }}
          >
            {t.text}
          </code>
        );
      case "bold":
        return <strong key={key}>{render(t.children, `${key}.`)}</strong>;
      case "italic":
        return <em key={key}>{render(t.children, `${key}.`)}</em>;
    }
  });
}

export function FormattedText({ text }: { text: string }) {
  return (
    <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {render(parseInline(text), "f")}
    </span>
  );
}
