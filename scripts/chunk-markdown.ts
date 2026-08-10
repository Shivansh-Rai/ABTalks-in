/**
 * Pure, network-free markdown chunking for the chatbot's knowledge base.
 * Splits a file into one chunk per "## " section, plus an intro chunk from
 * the top of the file (H1 + any lead-in text) up to the first "## ".
 *
 * Extracted from generate-knowledge-embeddings.ts so chunk quality can be
 * inspected (scripts/inspect-chunks.ts) without spending anything on
 * embeddings — chunking is the retrieval-quality-critical, provider-
 * independent part of RAG and is worth getting right before any embedding
 * provider is chosen.
 */
export type Chunk = { heading: string; text: string };

export function chunkMarkdown(raw: string, fallbackHeading: string): Chunk[] {
  // Normalize CRLF first — some knowledge files (Windows-saved) use \r\n,
  // and a trailing \r on a line otherwise breaks the heading regexes below
  // (`.` doesn't match \r, so `$` never lands where expected).
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const chunks: Chunk[] = [];
  let currentHeading = fallbackHeading;
  let currentLines: string[] = [];

  const flush = () => {
    const text = currentLines.join("\n").trim();
    if (text.length > 0) {
      chunks.push({ heading: currentHeading, text });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const h1Match = /^#\s+(.+)$/.exec(line);
    const h2Match = /^##\s+(.+)$/.exec(line);
    if (h1Match) {
      currentHeading = h1Match[1].trim();
      continue;
    }
    if (h2Match) {
      flush();
      currentHeading = h2Match[1].trim();
      continue;
    }
    currentLines.push(line);
  }
  flush();

  return chunks;
}
