"use client";

import { useCallback, useRef, useState } from "react";
import {
  canStreamAudio,
  SPEECH_CHARS_PER_SECOND,
  streamLineAudio,
} from "@/components/interview/cohort/stream-audio";

/**
 * Times the three hops of one interview turn, through the real modules.
 *
 * The audio comparison imports `streamLineAudio` from the room's own module
 * rather than reimplementing it. That is the whole point: a bench with its own
 * copy of the playback code measures the copy.
 */

const PROBE = "/api/mock-interview/latency-probe";

type Row = { label: string; ms: number | null; note?: string };

function Table({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: ".08em", opacity: 0.6 }}>
        {title}
      </h2>
      <table style={{ borderCollapse: "collapse", marginTop: 8, width: "100%" }}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} style={{ borderTop: "1px solid rgba(127,127,127,.25)" }}>
              <td style={{ padding: "6px 12px 6px 0", whiteSpace: "nowrap" }}>{row.label}</td>
              <td
                style={{
                  padding: "6px 12px 6px 0",
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 600,
                }}
              >
                {row.ms === null ? "—" : `${Math.round(row.ms)} ms`}
              </td>
              <td style={{ padding: "6px 0", opacity: 0.65, fontSize: 13 }}>{row.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function InterviewLatencyBench({ probeEnabled }: { probeEnabled: boolean }) {
  const [audioRows, setAudioRows] = useState<Row[]>([]);
  const [llmRows, setLlmRows] = useState<Row[]>([]);
  const [sttRows, setSttRows] = useState<Row[]>([]);
  const [transcript, setTranscript] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  const serverTiming = (res: Response): string => {
    const raw = res.headers.get("Server-Timing") ?? "";
    const synth = /synth;dur=(\d+)/.exec(raw);
    return synth ? `server synth ${synth[1]} ms` : "";
  };

  /** The number that matters: when can the candidate start hearing the line. */
  const runAudio = useCallback(async () => {
    setError(null);
    setBusy("audio");
    setAudioRows([]);
    try {
      const rows: Row[] = [];

      // --- streamed: what the room does now
      let t0 = performance.now();
      const res = await fetch(`${PROBE}?hop=audio&mode=stream`);
      if (!res.ok) throw new Error(`probe ${res.status}: ${(await res.json().catch(() => ({}))).message ?? ""}`);
      rows.push({ label: "streamed — response headers", ms: performance.now() - t0, note: serverTiming(res) });

      const streamed = res.body ? streamLineAudio(res.body, () => false) : null;
      if (!streamed) {
        rows.push({ label: "streamed — playback", ms: null, note: "MediaSource cannot stream MP3 here; the room falls back to blob" });
      } else {
        await streamed.playable;
        const playableAt = performance.now() - t0;
        rows.push({
          label: "streamed — PLAYABLE",
          ms: playableAt,
          note: `duration while streaming = ${streamed.audio.duration}`,
        });
        streamed.audio.volume = 1;
        await streamed.audio.play();
        rows.push({ label: "streamed — play() returned", ms: performance.now() - t0 });
        setAudioRows([...rows]);
        await new Promise<void>((resolve) => {
          streamed.audio.onended = () => resolve();
          streamed.audio.onerror = () => resolve();
        });
        rows.push({
          label: "streamed — finished speaking",
          ms: performance.now() - t0,
          note: `real duration ${streamed.audio.duration.toFixed(2)}s; estimate used while streaming was ${(
            Number(res.headers.get("X-Probe-Chars") ?? 0) / SPEECH_CHARS_PER_SECOND
          ).toFixed(2)}s`,
        });
        streamed.release();
      }
      setAudioRows([...rows]);

      // --- buffered: what it did before
      t0 = performance.now();
      const res2 = await fetch(`${PROBE}?hop=audio&mode=buffer`);
      if (!res2.ok) throw new Error(`probe ${res2.status}`);
      rows.push({ label: "buffered — response headers", ms: performance.now() - t0, note: serverTiming(res2) });
      const url = URL.createObjectURL(await res2.blob());
      const audio = new Audio(url);
      rows.push({
        label: "buffered — PLAYABLE",
        ms: performance.now() - t0,
        note: "whole MP3 had to arrive first",
      });
      URL.revokeObjectURL(url);
      void audio;
      setAudioRows([...rows]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const runLlm = useCallback(async () => {
    setError(null);
    setBusy("llm");
    setLlmRows([]);
    try {
      const t0 = performance.now();
      const res = await fetch(`${PROBE}?hop=llm`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? `probe ${res.status}`);
      setLlmRows([
        { label: "round trip (browser)", ms: performance.now() - t0 },
        {
          label: "analyze call (server)",
          ms: json.data.elapsedMs,
          note: `${json.data.provider}${json.data.degraded ? " — DEGRADED, fell back to heuristics" : ""}, proposed ${json.data.action}`,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setSttRows([]);
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setBusy("stt");
        try {
          const form = new FormData();
          form.append("audio", blob, "answer.webm");
          const t0 = performance.now();
          const res = await fetch(PROBE, { method: "POST", body: form });
          const json = await res.json();
          if (!res.ok || !json.ok) throw new Error(json.message ?? `probe ${res.status}`);
          setSttRows([
            { label: "round trip (browser)", ms: performance.now() - t0, note: `${Math.round(blob.size / 1024)} KB uploaded` },
            {
              label: "transcription (server)",
              ms: json.data.elapsedMs,
              note: `${json.data.vendor}, detected "${json.data.detectedLanguage ?? "none"}", ${json.data.chars} chars`,
            },
          ]);
          setTranscript(json.data.text);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(null);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const button = {
    padding: "8px 14px",
    marginRight: 10,
    borderRadius: 6,
    border: "1px solid rgba(127,127,127,.4)",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
  } as const;

  return (
    <main style={{ padding: 32, maxWidth: 860, margin: "0 auto", font: "14px/1.65 ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Interview voice latency</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>
        Times the three hops that make up the gap between a candidate finishing an answer and hearing
        the next question, through the same modules a real turn uses — no attempt and no interview
        row, so nothing here can touch a candidate&rsquo;s result. Numbers from this page are the ones
        that count: measured from wherever it is deployed, against the real vendors. Your admin
        session is what authorises the calls.
      </p>

      {!probeEnabled && (
        <p style={{ padding: 12, border: "1px solid #c93", borderRadius: 6, background: "rgba(204,153,51,.08)" }}>
          The probe endpoint is switched off. Set <code>ENABLE_INTERVIEW_LATENCY_PROBE=true</code> —
          in <code>.env.local</code> for a local run, or in the Vercel project environment and
          redeploy to measure production. It is a kill switch as much as a toggle: turning it back
          off takes effect immediately, without a deploy.
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        <button style={button} onClick={runAudio} disabled={!probeEnabled || busy !== null}>
          {busy === "audio" ? "playing…" : "2. Synthesis — streamed vs buffered"}
        </button>
        <button style={button} onClick={runLlm} disabled={!probeEnabled || busy !== null}>
          {busy === "llm" ? "thinking…" : "3. Analyze call"}
        </button>
        <button
          style={button}
          onClick={recording ? stopRecording : startRecording}
          disabled={!probeEnabled || (busy !== null && !recording)}
        >
          {recording ? "■ stop and transcribe" : busy === "stt" ? "transcribing…" : "1. Record an answer → transcribe"}
        </button>
      </div>

      <p style={{ opacity: 0.55, fontSize: 13 }}>
        MediaSource can stream MP3 here: <strong>{String(canStreamAudio())}</strong>. Turn your volume
        up — the synthesis test plays the line out loud, which is also how you check it is not choppy.
      </p>

      {error && (
        <p style={{ color: "#c33", border: "1px solid #c33", borderRadius: 6, padding: 12 }}>{error}</p>
      )}

      <Table title="1 · Transcription (your recording)" rows={sttRows} />
      {transcript && (
        <p style={{ marginTop: 8, padding: 12, borderRadius: 6, background: "rgba(127,127,127,.08)" }}>
          {transcript}
        </p>
      )}
      <Table title="2 · Synthesis and playback" rows={audioRows} />
      <Table title="3 · Analyze call" rows={llmRows} />
    </main>
  );
}
