import { readFile } from "node:fs/promises";
import path from "node:path";

/** Bump these when `content/legal/*.md` versions change; consent rows store them. */
export const TERMS_VERSION = "2026-08-08";
export const PRIVACY_VERSION = "2026-08-08";

export type LegalDocKind = "terms" | "privacy";

export async function loadLegalMarkdown(kind: LegalDocKind): Promise<string> {
  const file = kind === "terms" ? "terms.md" : "privacy.md";
  const fullPath = path.join(process.cwd(), "content", "legal", file);
  return readFile(fullPath, "utf8");
}
