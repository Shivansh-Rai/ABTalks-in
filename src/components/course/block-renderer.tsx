import { Info, Lightbulb, TriangleAlert, FlaskConical } from "lucide-react";
import type { Block } from "@/features/courses/types";
import { Inline } from "./inline";
import { CodeBlock } from "./code-block";
import { Quiz } from "./quiz";
import { Visual } from "./visuals/visual";

const CALLOUT_ICON = { note: Info, tip: Lightbulb, warn: TriangleAlert, example: FlaskConical } as const;
const CALLOUT_TITLE = { note: "Note", tip: "Tip", warn: "Watch out", example: "Example" } as const;

/** Server component: turns content blocks into markup, mounting client islands where needed. */
export function BlockRenderer({
  blocks,
  course,
  module,
  moduleNumber,
}: {
  blocks: Block[];
  course: string;
  module: string;
  moduleNumber: number;
}) {
  let section = 0;
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} id={b.id} className="crs-h2">
                <span className="crs-h2-num">
                  {moduleNumber}.{++section}
                </span>
                {b.text}
              </h2>
            );
          case "h3":
            return <h3 key={i}>{b.text}</h3>;
          case "p":
            return (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            );
          case "list": {
            const items = b.items.map((t, j) => (
              <li key={j}>
                <Inline text={t} />
              </li>
            ));
            return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
          }
          case "callout": {
            const Icon = CALLOUT_ICON[b.tone];
            return (
              <aside key={i} className="crs-callout" data-tone={b.tone}>
                <span className="crs-callout-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon className="size-4" aria-hidden="true" />
                  {b.title ?? CALLOUT_TITLE[b.tone]}
                </span>
                <p>
                  <Inline text={b.text} />
                </p>
              </aside>
            );
          }
          case "table":
            return (
              <div key={i} className="crs-table">
                <table>
                  {b.caption ? <caption>{b.caption}</caption> : null}
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} scope="col">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k}>
                            <Inline text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            return (
              <div key={i}>
                <CodeBlock lang={b.lang} label={b.label} code={b.code} />
                {b.caption ? (
                  <p className="crs-code-caption">
                    <Inline text={b.caption} />
                  </p>
                ) : null}
              </div>
            );
          case "visual":
            return (
              <figure key={i} className="crs-frame">
                <div className="crs-frame-title">{b.title}</div>
                <p className="crs-frame-how">
                  <Inline text={b.howTo} />
                </p>
                <Visual config={b.visual} />
                <figcaption className="crs-frame-cap">
                  <Inline text={b.caption} />
                </figcaption>
              </figure>
            );
          case "quiz":
            return <Quiz key={i} course={course} module={module} questions={b.questions} />;
          case "exercise":
            return (
              <section key={i} className="crs-ex" aria-label={b.title}>
                <div className="crs-frame-title" style={{ fontSize: "1.05rem" }}>
                  {b.title}
                </div>
                <p>
                  <Inline text={b.brief} />
                </p>
                <ol>
                  {b.tasks.map((t, j) => (
                    <li key={j}>
                      <Inline text={t} />
                    </li>
                  ))}
                </ol>
                {b.hints?.length ? (
                  <details>
                    <summary>Hints</summary>
                    <ul>
                      {b.hints.map((t, j) => (
                        <li key={j}>
                          <Inline text={t} />
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {b.model?.length ? (
                  <details>
                    <summary>A strong answer would include</summary>
                    <ul>
                      {b.model.map((t, j) => (
                        <li key={j}>
                          <Inline text={t} />
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>
            );
          case "takeaways":
            return (
              <div key={i} className="crs-callout" data-tone="tip">
                <ul style={{ margin: 0 }}>
                  {b.items.map((t, j) => (
                    <li key={j}>
                      <Inline text={t} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          case "references":
            return (
              <ol key={i} className="crs-refs">
                {b.items.map((r, j) => (
                  <li key={j}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.title}
                    </a>{" "}
                    <span className="src">{r.source}</span>
                    {r.note ? <span className="src">. {r.note}</span> : null}
                  </li>
                ))}
              </ol>
            );
        }
      })}
    </>
  );
}
