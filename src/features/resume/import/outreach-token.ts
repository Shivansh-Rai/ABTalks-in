import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed links for the claim-and-complete emails (plan 171). Pure.
 *
 * A token names one import and the user it registered, and expires. It
 * authorises exactly two things: viewing the public `/claim/[token]` preview
 * and "Remove my data" while that import is still REGISTERED. It never signs
 * anyone in — Google or an emailed code does that — so a forwarded email
 * cannot hand the profile to someone else.
 *
 * Format: `base64url(JSON payload)` + "." + `base64url(HMAC-SHA256(payload))`.
 */

const VERSION = 1;
const TTL_SECONDS = 45 * 24 * 60 * 60;
const MIN_SECRET_BYTES = 32;

type Payload = { i: string; u: string; e: number; v: number };

export type VerifiedClaimToken =
  | { ok: true; importId: string; userId: string }
  | { ok: false };

function secret(): Buffer {
  const raw = process.env.IMPORT_CLAIM_SECRET ?? "";
  const bytes = Buffer.from(raw, "utf8");
  if (bytes.length < MIN_SECRET_BYTES) {
    throw new Error("IMPORT_CLAIM_SECRET is missing or shorter than 32 bytes.");
  }
  return bytes;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signClaimToken(importId: string, userId: string, now: Date = new Date()): string {
  const body: Payload = {
    i: importId,
    u: userId,
    e: Math.floor(now.getTime() / 1000) + TTL_SECONDS,
    v: VERSION,
  };
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyClaimToken(token: string, now: Date = new Date()): VerifiedClaimToken {
  if (typeof token !== "string" || token.length > 1024) return { ok: false };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return { ok: false };
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = Buffer.from(sign(payload), "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false };

  let body: unknown;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false };
  }
  if (!body || typeof body !== "object") return { ok: false };
  const { i, u, e, v } = body as Partial<Payload>;
  if (v !== VERSION || typeof i !== "string" || typeof u !== "string" || typeof e !== "number") {
    return { ok: false };
  }
  if (!i || !u || Math.floor(now.getTime() / 1000) >= e) return { ok: false };
  return { ok: true, importId: i, userId: u };
}
