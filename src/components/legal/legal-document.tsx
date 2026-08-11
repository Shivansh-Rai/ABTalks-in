import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 scroll-mt-20 border-b border-border/60 pb-2 text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 text-lg font-semibold text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50 text-foreground">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-border/70 px-3 py-2 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/40 px-3 py-2 align-top text-muted-foreground">
      {children}
    </td>
  ),
  hr: () => <hr className="my-8 border-border/60" />,
};

type Props = {
  markdown: string;
  className?: string;
};

export function LegalDocument({ markdown, className }: Props) {
  return (
    <article className={cn("mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16", className)}>
      {/* remark-gfm is required for pipe tables in content/legal/*.md —
          without it, tables render as raw | | | text (see /terms, /cookies). */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
