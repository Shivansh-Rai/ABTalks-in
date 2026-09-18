import "server-only";

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { logger } from "@/lib/logger";

/**
 * Plan 151. Server-only wrapper around the GA4 Data API client.
 *
 * Fails soft: if any of `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_EMAIL` or
 * `GA_SERVICE_ACCOUNT_PRIVATE_KEY` is unset, `getGaDataClient` returns
 * `{ ok: false, message }`. Callers render the "traffic unavailable" fallback
 * without breaking any Vercel preview build that has no GA creds provisioned.
 *
 * The client itself is memoised — the constructor opens a keepalive gRPC
 * channel, which is expensive to redo on every page render.
 */

type GaClientResult =
  | { ok: true; client: BetaAnalyticsDataClient; propertyId: string }
  | { ok: false; message: string };

let cached: BetaAnalyticsDataClient | null = null;

function readEnv(): { propertyId: string; email: string; key: string } | null {
  const propertyId = process.env.GA_PROPERTY_ID;
  const email = process.env.GA_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GA_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!propertyId || !email || !rawKey) return null;
  // Vercel stores multi-line env vars with literal `\n`, which the JWT signer
  // rejects — restore real newlines before handing the key to the client.
  const key = rawKey.replace(/\\n/g, "\n");
  return { propertyId, email, key };
}

export function getGaDataClient(): GaClientResult {
  const env = readEnv();
  if (!env) {
    return { ok: false, message: "GA_DATA_API_UNAVAILABLE" };
  }
  if (!cached) {
    try {
      cached = new BetaAnalyticsDataClient({
        credentials: {
          client_email: env.email,
          private_key: env.key,
        },
      });
    } catch (error) {
      logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        "[ga-data-client] failed to instantiate BetaAnalyticsDataClient",
      );
      return { ok: false, message: "GA_DATA_API_INIT_FAILED" };
    }
  }
  return { ok: true, client: cached, propertyId: env.propertyId };
}

/** For tests — never call from application code. */
export function __resetGaDataClientForTests() {
  cached = null;
}
