import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { normalizeEmail } from "@/features/resume/import/email";
import {
  findLatestImportIdByEmail,
  stopOutreachForImport,
} from "@/repositories/resume-import";

/**
 * Brevo transactional webhook (plan 171). PUBLIC by design — Brevo calls it,
 * not a signed-in user — so the only authorisation is the shared secret in
 * the URL (`?secret=`), compared in constant time.
 *
 * Acts ONLY on mail tagged `resume_import.outreach.*` (every outreach send is
 * tagged with its `kind`): a hard bounce, block or invalid address stops that
 * person's sequence as BOUNCED, a spam complaint as UNSUBSCRIBED. Everything
 * else is acknowledged and ignored, so other mail is never affected.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTREACH_TAG = "resume_import.outreach.";

const eventSchema = z
  .object({
    event: z.string().max(64),
    email: z.string().max(320),
    tags: z.array(z.string().max(200)).max(50).optional(),
    tag: z.string().max(200).optional(),
  })
  .passthrough();

const STOP_FOR: Record<string, "BOUNCED" | "UNSUBSCRIBED"> = {
  hard_bounce: "BOUNCED",
  blocked: "BOUNCED",
  invalid_email: "BOUNCED",
  spam: "UNSUBSCRIBED",
};

function secretMatches(given: string | null): boolean {
  const expected = process.env.BREVO_WEBHOOK_SECRET ?? "";
  if (!given || expected.length < 16) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!secretMatches(url.searchParams.get("secret"))) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true, data: { handled: 0 } });
  }

  const events = (Array.isArray(body) ? body : [body]).slice(0, 100);
  let handled = 0;
  for (const raw of events) {
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) continue;
    const ev = parsed.data;
    const reason = STOP_FOR[ev.event];
    const tags = [...(ev.tags ?? []), ...(ev.tag ? [ev.tag] : [])];
    if (!reason || !tags.some((t) => t.startsWith(OUTREACH_TAG))) continue;
    const email = normalizeEmail(ev.email);
    if (!email) continue;
    try {
      const importId = await findLatestImportIdByEmail(email);
      if (!importId) continue;
      handled += await stopOutreachForImport(importId, reason, new Date());
    } catch (error) {
      logger.error("[webhooks/brevo] outreach stop failed", { event: ev.event, error: String(error) });
    }
  }
  return NextResponse.json({ ok: true, data: { handled } });
}
