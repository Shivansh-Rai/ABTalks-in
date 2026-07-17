import { NextResponse } from "next/server";
import { runProgramCommitsCron } from "@/features/program/commits";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runProgramCommitsCron();
    if (result.failures.length > 0) {
      logger.error("[cron/program-commits] partial failures", {
        processed: result.processed,
        failureCount: result.failures.length,
      });
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    logger.error("[cron/program-commits] failed", { error: String(e) });
    return NextResponse.json(
      { ok: false, message: "Cron job failed." },
      { status: 500 },
    );
  }
}
