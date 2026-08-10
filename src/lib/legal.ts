import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LegalDocKind } from "@/lib/legal-constants";

// Re-exported so existing server-side imports of `@/lib/legal` keep working.
// Client Components must import from `@/lib/legal-constants` directly — this
// module reads from disk and cannot be bundled for the browser.
export {
  TERMS_VERSION,
  PRIVACY_VERSION,
  COOKIE_POLICY_VERSION,
  LEGAL_ENTITY,
  type LegalDocKind,
} from "@/lib/legal-constants";

const LEGAL_FILES: Record<LegalDocKind, string> = {
  terms: "terms.md",
  privacy: "privacy.md",
  cookies: "cookies.md",
};

export async function loadLegalMarkdown(kind: LegalDocKind): Promise<string> {
  const fullPath = path.join(process.cwd(), "content", "legal", LEGAL_FILES[kind]);
  return readFile(fullPath, "utf8");
}
