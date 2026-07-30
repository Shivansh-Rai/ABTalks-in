import "server-only";
import { logger } from "@/lib/logger";

let cached: Uint8Array | null = null;

/**
 * The certificate template now lives in `public/certificates/` and is fetched by URL.
 * An explicit CERTIFICATE_TEMPLATE_URL still overrides the default public path.
 * pdf-lib does not mutate the source bytes, so a module-level cache is safe.
 */
export async function loadCertificateTemplate(): Promise<Uint8Array> {
  if (cached) return cached;

  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const url =
    process.env.CERTIFICATE_TEMPLATE_URL ??
    `${baseUrl}/certificates/claude-certificate-template.pdf`;

  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) {
      throw new Error(`Certificate template fetch failed: ${res.status}`);
    }
    cached = new Uint8Array(await res.arrayBuffer());
    return cached;
  } catch (error) {
    logger.error("Certificate template not configured", {
      url,
      error: String(error),
    });
    throw new Error("Certificate template not configured");
  }
}
