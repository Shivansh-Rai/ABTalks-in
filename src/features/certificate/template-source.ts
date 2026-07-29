import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";

let cached: Uint8Array | null = null;

/**
 * The designed template is deliberately NOT in git (public repo). Production reads it
 * from CERTIFICATE_TEMPLATE_URL; local dev falls back to a gitignored file.
 * pdf-lib does not mutate the source bytes, so a module-level cache is safe.
 */
export async function loadCertificateTemplate(): Promise<Uint8Array> {
  if (cached) return cached;

  const url = process.env.CERTIFICATE_TEMPLATE_URL;
  if (url) {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) {
      throw new Error(`Certificate template fetch failed: ${res.status}`);
    }
    cached = new Uint8Array(await res.arrayBuffer());
    return cached;
  }

  const relativePath =
    process.env.CERTIFICATE_TEMPLATE_PATH ??
    "assets/certificates/claude-certificate-template.pdf";
  const absolutePath = path.resolve(process.cwd(), relativePath);

  try {
    const bytes = await readFile(absolutePath);
    cached = new Uint8Array(bytes);
    return cached;
  } catch (error) {
    logger.error("Certificate template not configured", {
      path: absolutePath,
      error: String(error),
    });
    throw new Error("Certificate template not configured");
  }
}
