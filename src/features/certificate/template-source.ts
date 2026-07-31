import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";

const DEFAULT_PUBLIC_TEMPLATE =
  "public/certificates/claude-certificate-template.pdf";

let cached: { bytes: Uint8Array; mtimeMs: number | null } | null = null;

/**
 * Template lives in `public/certificates/` and is read from disk by default so
 * local/file updates are picked up (mtime-checked). CERTIFICATE_TEMPLATE_URL
 * still overrides for a remote host when set.
 */
export async function loadCertificateTemplate(): Promise<Uint8Array> {
  const url = process.env.CERTIFICATE_TEMPLATE_URL;
  if (url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Certificate template fetch failed: ${res.status}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      cached = { bytes, mtimeMs: null };
      return bytes;
    } catch (error) {
      logger.error("Certificate template not configured", {
        url,
        error: String(error),
      });
      throw new Error("Certificate template not configured");
    }
  }

  const absolutePath = path.resolve(
    process.cwd(),
    process.env.CERTIFICATE_TEMPLATE_PATH ?? DEFAULT_PUBLIC_TEMPLATE,
  );

  try {
    const { mtimeMs } = await stat(absolutePath);
    if (cached && cached.mtimeMs === mtimeMs) {
      return cached.bytes;
    }
    const bytes = new Uint8Array(await readFile(absolutePath));
    cached = { bytes, mtimeMs };
    return bytes;
  } catch (error) {
    logger.error("Certificate template not configured", {
      path: absolutePath,
      error: String(error),
    });
    throw new Error("Certificate template not configured");
  }
}
