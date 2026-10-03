/**
 * One ResumeImport's stored PDF, for a Platform Admin.
 *
 * A Route Handler rather than a Server Action because the response is a binary
 * stream, which a Server Action cannot return.
 *
 * The only caller-supplied input is the import id. The private blob pathname
 * is resolved server-side from that row — a caller never supplies, and never
 * sees, a path into the private store.
 *
 * Served as `inline` so the admin console can open the PDF in a new tab.
 * Every served download writes one `AdminAction`.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/features/admin/audit";
import { getImportFilePath } from "@/repositories/resume-import";
import { readResumeFile } from "@/features/resume/storage";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

const NOT_FOUND = { ok: false as const, message: "No résumé file stored" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // `getAdminContext` rather than `requireAdmin`: the latter redirects, which
  // would answer a failed download with an HTML page instead of a status.
  const admin = await getAdminContext();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, message: "Not authorised." },
      { status: 403 },
    );
  }

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, message: "Bad request." },
      { status: 400 },
    );
  }
  const { id } = parsed.data;

  const stored = await getImportFilePath(id);
  if (!stored) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const file = await readResumeFile(stored.pathname);
  if (!file) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  // Audited before the bytes leave, so a download that is served is always
  // recorded — but a limiter-style failure here must not deny an admin a
  // document they are authorised to read.
  try {
    await writeAudit(prisma, {
      actorUserId: admin.userId,
      adminUserId: admin.userId,
      entityType: "ResumeImport",
      entityId: id,
      actionType: "DOWNLOAD_RESUME_IMPORT",
      reason: "Admin console résumé-import file open",
    });
  } catch (error) {
    logger.error("[admin-resume-import] audit failed", {
      adminUserId: admin.userId,
      importId: id,
      error: String(error),
    });
  }

  // Quoting and stripping keeps a filename with a comma or a quote in it from
  // splitting the header. The name is already restricted upstream.
  const safeName = (stored.fileName || "resume.pdf").replace(/["\\\r\n]/g, "");

  return new NextResponse(file.stream, {
    headers: {
      "content-type": file.contentType || "application/pdf",
      "content-length": String(file.size),
      "content-disposition": `inline; filename="${safeName}"`,
      // Private to one admin session; never a shared cache, never a CDN copy.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
