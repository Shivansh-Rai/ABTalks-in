import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { prepareInterviewStart } from "@/features/program/interview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientSecretResponse = {
  value?: string;
  expires_at?: number;
  client_secret?: { value?: string; expires_at?: number };
};

async function requireMemberId(): Promise<
  { ok: true; memberId: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 },
      ),
    };
  }

  const cohort = await prisma.programCohort.findFirst({
    where: { status: { in: ["ENROLLING", "ACTIVE", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!cohort) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Program unavailable." },
        { status: 404 },
      ),
    };
  }

  const member = await prisma.programMember.findUnique({
    where: {
      userId_cohortId: { userId: session.user.id, cohortId: cohort.id },
    },
    select: { id: true, status: true },
  });

  if (!member || (member.status !== "ENROLLED" && member.status !== "COMPLETED")) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Enrollment required." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, memberId: member.id };
}

export async function POST() {
  const authResult = await requireMemberId();
  if (!authResult.ok) return authResult.response;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "Voice interview is not configured." },
      { status: 503 },
    );
  }

  const prepared = await prepareInterviewStart(authResult.memberId);
  if (!prepared.ok) {
    return NextResponse.json(
      { ok: false, message: prepared.message },
      { status: 403 },
    );
  }

  const sessionBody = {
    session: {
      type: "realtime",
      model: "gpt-realtime",
      instructions: prepared.instructions,
      audio: {
        output: { voice: "marin" },
        input: {
          transcription: { model: "gpt-4o-mini-transcribe" },
        },
      },
    },
  };

  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": prepared.safetyIdentifier,
      },
      body: JSON.stringify(sessionBody),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.error("[interview/session] OpenAI client_secrets failed", {
        status: res.status,
        body: errText.slice(0, 500),
      });
      return NextResponse.json(
        { ok: false, message: "Failed to start interview session." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as ClientSecretResponse;
    const secret =
      data.client_secret?.value ?? data.value ?? null;
    const expiresAt =
      data.client_secret?.expires_at ?? data.expires_at ?? null;

    if (!secret) {
      logger.error("[interview/session] missing client secret in response");
      return NextResponse.json(
        { ok: false, message: "Unexpected session response." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        clientSecret: secret,
        expiresAt,
      },
    });
  } catch (e) {
    logger.error("[interview/session] request errored", { error: String(e) });
    return NextResponse.json(
      { ok: false, message: "Failed to start interview session." },
      { status: 500 },
    );
  }
}
