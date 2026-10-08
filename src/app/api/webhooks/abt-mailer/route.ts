import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAbtMailerSignature } from "@/lib/abt-mailer";
import { normalizeEmail } from "@/features/resume/import/email";
import {
  findLatestImportIdByEmail,
  stopOutreachForImport,
} from "@/repositories/resume-import";

/**
 * ABT-Mailer bounce / complaint webhook (plan 187). PUBLIC by design —
 * ABT-Mailer calls it, not a signed-in user — so the only authorisation is
 * the HMAC signature made with ABT_MAILER_HMAC_SECRET.
 *
 * The SES-era twin of /api/webhooks/brevo, with the same effect: acts ONLY
 * on mail whose kind is `resume_import.outreach.*`. A permanent bounce stops
 * that person's sequence as BOUNCED, a spam complaint as UNSUBSCRIBED.
 * Temporary bounces and everything else are acknowledged and ignored.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTREACH_KIND = "resume_import.outreach.";

const eventSchema = z.object({
  type: z.enum(["bounce", "complaint"]),
  bounceType: z.enum(["Permanent", "Transient", "Undetermined"]).optional(),
  kind: z.string().max(128),
  eventId: z.string().max(128),
  email: z.string().max(320),
  occurredAt: z.string().max(64),
});

export async function POST(request: Request) {
  const raw = await request.text();
  const valid = verifyAbtMailerSignature({
    body: raw,
    timestamp: request.headers.get("x-abtalks-timestamp"),
    signature: request.headers.get("x-abtalks-signature"),
    secret: process.env.ABT_MAILER_HMAC_SECRET,
  });
  if (!valid) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, data: { handled: 0 } });
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: true, data: { handled: 0 } });
  const ev = parsed.data;

  const reason =
    ev.type === "complaint" ? "UNSUBSCRIBED" : ev.bounceType === "Permanent" ? "BOUNCED" : null;
  if (!reason || !ev.kind.startsWith(OUTREACH_KIND)) {
    return NextResponse.json({ ok: true, data: { handled: 0 } });
  }
  const email = normalizeEmail(ev.email);
  if (!email) return NextResponse.json({ ok: true, data: { handled: 0 } });

  try {
    const importId = await findLatestImportIdByEmail(email);
    const handled = importId ? await stopOutreachForImport(importId, reason, new Date()) : 0;
    return NextResponse.json({ ok: true, data: { handled } });
  } catch (error) {
    logger.error("[webhooks/abt-mailer] outreach stop failed", { type: ev.type, error: String(error) });
    // 5xx so a retry can land once the database is reachable again.
    return NextResponse.json({ ok: false, message: "Could not record the event." }, { status: 500 });
  }
}
