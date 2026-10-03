/**
 * Typeahead suggestions for the admin global search box.
 *
 * **Why a GET Route Handler and not a Server Action.** This is a read on a hot
 * typing path. Server Action calls are serialized by the Next.js client router,
 * so a burst of keystrokes would queue behind each other; a GET gives real
 * parallelism and lets a stale request be aborted outright.
 *
 * **Why there is no rate limiter here.** `lib/rate-limit.ts` is DB-backed, so
 * calling it would add a database *write* for every keystroke — strictly more
 * expensive than the read it would be protecting, and on a surface only
 * platform admins can reach. The controls on this path are the admin check
 * below, the three-character floor in `suggestAdminConsole`, and the debounce
 * plus abort in the client. Please do not "fix" this by adding one.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin-auth";
import { suggestAdminConsole } from "@/features/admin/search-admin-console";

export const runtime = "nodejs";

const querySchema = z.string().max(100).trim();

export async function GET(request: Request): Promise<NextResponse> {
  // `getAdminContext` rather than `requireAdmin`: the latter redirects, which
  // would answer a fetch with an HTML login page under a 200 instead of a
  // status the caller can act on.
  const admin = await getAdminContext();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, message: "Not authorised." },
      { status: 403 },
    );
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const parsed = querySchema.safeParse(q);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false as const,
        message: parsed.error.issues[0]?.message ?? "Invalid query",
      },
      { status: 400 },
    );
  }

  const data = await suggestAdminConsole(parsed.data);
  return NextResponse.json(
    { ok: true as const, data },
    // Never `public`: these rows are people.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
