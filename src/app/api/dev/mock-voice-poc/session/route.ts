import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Phase 1 POC: Issues short-lived ephemeral client credentials for OpenAI Realtime API.
 *
 * Calls OpenAI GA endpoint: POST https://api.openai.com/v1/realtime/client_secrets
 * Never exposes the master OPENAI_API_KEY to the browser.
 */

const STATIC_INTERVIEW_INSTRUCTIONS = `You are an expert, senior technical engineering interviewer conducting a live technical practice interview with a software engineering candidate.

Candidate: generic test candidate
Current Topic: "Explain how you would design a RAG system."

Key Rules & Behavior:
1. Stay strictly focused on this question/topic (Retrieval-Augmented Generation system design).
2. Do not invent unrelated curriculum topics or drift into unrelated trivia.
3. Sound like a calm, natural, senior interviewer: concise, direct, curious, and unhurried.
4. Keep spoken responses short (1 to 3 conversational sentences). Do not lecture or ramble.
5. Engage substantively with what the candidate says: pick up specific tools, chunking strategies, embeddings, or retrieval bottlenecks they mention.
6. Ask contextual follow-up questions when appropriate to explore trade-offs (e.g., chunk size, latency vs accuracy, vector database scaling).
7. Do not perform deep scoring or grade them out loud in this session.
8. If the candidate interrupts, asks for clarification, or asks you to repeat:
   - Handle it naturally without getting flustered.
   - If they ask "What do you mean by architecture?" or similar, clarify briefly and repeat or return to the question.
   - If they ask "Can you repeat that?", repeat the current question clearly.
   - If they say "Actually, I want to correct something", listen and acknowledge their correction without advancing the question.
`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const payload = {
      session: {
        type: "realtime",
        model: "gpt-realtime",
        output_modalities: ["audio"],
        instructions: STATIC_INTERVIEW_INSTRUCTIONS,
        audio: {
          input: {
            transcription: {
              model: "whisper-1",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500, // Natural ~500ms conversational turn silence
              create_response: true,
              interrupt_response: true, // Native server barge-in: truncates assistant audio
            },
          },
          output: {
            voice: "ash", // Senior engineering voice register
            speed: 1.0,
          },
        },
      },
    };

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { ok: false, message: `OpenAI client_secrets failed: ${errorText}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    // Return ephemeral client secret token (`value`) and expiry
    return NextResponse.json({
      ok: true,
      data: {
        clientSecret: data.value,
        expiresAt: data.expires_at,
        sessionId: data.session?.id,
        model: data.session?.model,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : "Internal server error occurred.",
      },
      { status: 500 },
    );
  }
}
