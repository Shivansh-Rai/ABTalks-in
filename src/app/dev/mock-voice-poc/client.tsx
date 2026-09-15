"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Radio,
  Play,
  Square,
  AlertCircle,
  Volume2,
  Zap,
  Activity,
  CheckCircle2,
  Clock,
} from "lucide-react";

type ConnectionStatus =
  | "disconnected"
  | "requesting_token"
  | "connecting_webrtc"
  | "connected"
  | "error";

interface TranscriptEvent {
  id: string;
  timestamp: string;
  role: "candidate" | "interviewer" | "system";
  text: string;
  interrupted?: boolean;
}

interface LatencyTurnMetrics {
  turnId: string;
  t0_candidateSpeechStart?: number;
  t1_candidateSpeechEnd?: number;
  t2_responseCreated?: number;
  t3_firstAudioPacket?: number;
  t4_firstAudioPlayed?: number;
  t5_responseCompleted?: number;
  // Computed latencies
  vadSpeechEndLatencyMs?: number; // T1 - T0
  turnToFirstAudioMs?: number; // T3 - T1 (Candidate speech end to first audio arrival)
  turnToPlaybackMs?: number; // T4 - T1 (Candidate speech end to audible voice)
  responseGenerationMs?: number; // T5 - T2
}

interface InterruptionMetrics {
  interruptionId: string;
  interruptionSpeechStart: number;
  assistantTruncated: number;
  cancellationLatencyMs: number; // Truncation - SpeechStart
  reason: string;
}

export function MockVoicePocClient() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEvent[]>([]);
  const [micActive, setMicActive] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isCandidateSpeaking, setIsCandidateSpeaking] = useState(false);

  // Telemetry state
  const [webrtcConnectTimeMs, setWebrtcConnectTimeMs] = useState<number | null>(null);
  const [recentTurnMetrics, setRecentTurnMetrics] = useState<LatencyTurnMetrics[]>([]);
  const [recentInterruptions, setRecentInterruptions] = useState<InterruptionMetrics[]>([]);

  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Turn timing tracker ref
  const currentTurnRef = useRef<LatencyTurnMetrics>({
    turnId: "init",
  });
  const pendingInterruptionRef = useRef<{ speechStart: number } | null>(null);

  const addLog = useCallback(
    (role: "candidate" | "interviewer" | "system", text: string, interrupted = false) => {
      setTranscripts((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          role,
          text,
          interrupted,
        },
      ]);
    },
    [],
  );

  // Disconnect & cleanup
  const disconnect = useCallback(() => {
    setStatus("disconnected");
    setIsAiSpeaking(false);
    setIsCandidateSpeaking(false);
    setMicActive(false);

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    addLog("system", "Session disconnected.");
  }, [addLog]);

  // Connect WebRTC session
  const connect = async () => {
    try {
      setErrorMessage(null);
      setStatus("requesting_token");
      addLog("system", "Requesting ephemeral client secret from Next.js server...");

      const connectStart = performance.now();

      // 1. Get ephemeral token from our Next.js backend
      const tokenRes = await fetch("/api/dev/mock-voice-poc/session", {
        method: "POST",
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.ok) {
        throw new Error(tokenData.message || "Failed to get ephemeral token.");
      }

      const clientSecret = tokenData.data.clientSecret;
      addLog(
        "system",
        `Acquired ephemeral token (${clientSecret.slice(0, 8)}...). Initializing WebRTC...`,
      );

      setStatus("connecting_webrtc");

      // 2. Request user microphone with native echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      localStreamRef.current = stream;
      setMicActive(true);

      // 3. Create WebRTC PeerConnection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Ensure remote audio element plays incoming audio
      if (!remoteAudioRef.current) {
        const audio = new Audio();
        audio.autoplay = true;
        remoteAudioRef.current = audio;
      }

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          addLog("system", "Remote audio stream received and bound to player.");
        }
      };

      // Add local audio track
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, stream);
      }

      // 4. Create DataChannel for realtime events
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        addLog("system", "DataChannel opened: ready for realtime interview events.");
        // Send initial conversation trigger to have the interviewer start with the greeting and current question
        dc.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio"],
              instructions:
                "Greet the candidate briefly and ask the first question: 'Explain how you would design a RAG system.'",
            },
          }),
        );
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        } catch (err) {
          console.error("Failed to parse DataChannel event:", err);
        }
      };

      // 5. Generate SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 6. Send SDP Offer to OpenAI GA WebRTC endpoint: /v1/realtime/calls
      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpRes.ok) {
        const errText = await sdpRes.text();
        throw new Error(`OpenAI WebRTC call handshake failed: ${errText}`);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      const connectEnd = performance.now();
      const elapsed = Math.round(connectEnd - connectStart);
      setWebrtcConnectTimeMs(elapsed);
      setStatus("connected");
      addLog("system", `WebRTC Connected! Handshake completed in ${elapsed}ms.`);
    } catch (err) {
      console.error("Connection error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatus("error");
      addLog("system", `Error: ${msg}`);
      disconnect();
    }
  };

  // Handle incoming OpenAI Realtime GA events over the WebRTC DataChannel
  const handleRealtimeEvent = (event: Record<string, unknown>) => {
    const now = performance.now();
    const type = String(event.type);

    switch (type) {
      // Candidate started speaking (Detected by OpenAI Server VAD)
      case "input_audio_buffer.speech_started": {
        setIsCandidateSpeaking(true);
        currentTurnRef.current = {
          turnId: (event.item_id as string) || String(now),
          t0_candidateSpeechStart: now,
        };

        // If the interviewer was speaking, this is an interruption!
        if (isAiSpeaking) {
          pendingInterruptionRef.current = { speechStart: now };
          // Mute local playback immediately for instant local acoustic cut-off
          if (remoteAudioRef.current) {
            remoteAudioRef.current.pause();
          }
        }
        break;
      }

      // Candidate stopped speaking (Server VAD speech silence window elapsed)
      case "input_audio_buffer.speech_stopped": {
        setIsCandidateSpeaking(false);
        const t0 = currentTurnRef.current.t0_candidateSpeechStart;
        currentTurnRef.current.t1_candidateSpeechEnd = now;
        if (t0) {
          currentTurnRef.current.vadSpeechEndLatencyMs = Math.round(now - t0);
        }
        break;
      }

      // User transcript completed
      case "conversation.item.input_audio_transcription.completed": {
        const transcript = String(event.transcript || "").trim();
        if (transcript) {
          addLog("candidate", transcript);
        }
        break;
      }

      // Assistant response begins generation
      case "response.created": {
        currentTurnRef.current.t2_responseCreated = now;
        break;
      }

      // Assistant streaming audio packet arrives
      case "response.audio.delta": {
        if (!isAiSpeaking) {
          setIsAiSpeaking(true);
          // Resume audio player if paused
          if (remoteAudioRef.current && remoteAudioRef.current.paused) {
            void remoteAudioRef.current.play();
          }
        }
        if (!currentTurnRef.current.t3_firstAudioPacket) {
          currentTurnRef.current.t3_firstAudioPacket = now;
          currentTurnRef.current.t4_firstAudioPlayed = now; // WebRTC media engine plays immediately
          const t1 = currentTurnRef.current.t1_candidateSpeechEnd;
          if (t1) {
            const turnToFirstAudio = Math.round(now - t1);
            currentTurnRef.current.turnToFirstAudioMs = turnToFirstAudio;
            currentTurnRef.current.turnToPlaybackMs = turnToFirstAudio;
          }
        }
        break;
      }

      // Assistant audio transcript delta or done
      case "response.audio_transcript.done": {
        const text = String(event.transcript || "").trim();
        if (text) {
          addLog("interviewer", text);
        }
        break;
      }

      // Assistant response completes
      case "response.done": {
        setIsAiSpeaking(false);
        currentTurnRef.current.t5_responseCompleted = now;
        if (currentTurnRef.current.t2_responseCreated) {
          currentTurnRef.current.responseGenerationMs = Math.round(
            now - currentTurnRef.current.t2_responseCreated,
          );
        }

        // Record completed turn metrics
        if (currentTurnRef.current.t1_candidateSpeechEnd) {
          const snapshot = { ...currentTurnRef.current };
          setRecentTurnMetrics((prev) => [snapshot, ...prev].slice(0, 5));
        }
        break;
      }

      // Interruption / Barge-in truncation event
      case "conversation.item.truncated": {
        setIsAiSpeaking(false);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.pause();
        }

        if (pendingInterruptionRef.current) {
          const onset = pendingInterruptionRef.current.speechStart;
          const cancellationLatency = Math.round(now - onset);
          const metric: InterruptionMetrics = {
            interruptionId: String(event.item_id || now),
            interruptionSpeechStart: onset,
            assistantTruncated: now,
            cancellationLatencyMs: cancellationLatency,
            reason: "Candidate speech triggered server barge-in",
          };
          setRecentInterruptions((prev) => [metric, ...prev].slice(0, 5));
          pendingInterruptionRef.current = null;
          addLog("system", `⚡ Barge-in cut off assistant audio in ${cancellationLatency}ms!`, true);
        }
        break;
      }

      default:
        break;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="min-h-screen bg-[#0E131F] text-[#F3F4F6] p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#242D42] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#03535F] text-[#A6E8E6]">
                PHASE 1 POC
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">
                OpenAI Realtime Voice Architecture (Isolated Dev)
              </h1>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Full-duplex WebRTC audio streaming, native server VAD endpointing, and instant barge-in.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {status === "connected" ? (
              <button
                type="button"
                onClick={disconnect}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E11D48] text-white text-xs font-semibold hover:bg-[#BE123C] transition-colors"
              >
                <Square className="size-3.5 fill-current" /> End Session
              </button>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={status === "requesting_token" || status === "connecting_webrtc"}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#03535F] text-white text-xs font-semibold hover:bg-[#076573] disabled:opacity-50 transition-colors"
              >
                <Play className="size-3.5 fill-current" />
                {status === "requesting_token"
                  ? "Getting Token..."
                  : status === "connecting_webrtc"
                    ? "Connecting WebRTC..."
                    : "Start Voice Session"}
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-lg bg-[#7F1D1D]/50 border border-[#EF4444] text-[#FCA5A5] text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Audio & Speaking Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Box */}
          <div className="p-4 rounded-xl bg-[#182032] border border-[#242D42]">
            <div className="text-xs text-[#9CA3AF] font-medium mb-1 flex items-center justify-between">
              <span>CONNECTION STATUS</span>
              <Radio
                className={`size-3.5 ${
                  status === "connected"
                    ? "text-[#10B981] animate-pulse"
                    : status === "connecting_webrtc"
                      ? "text-[#F59E0B] animate-spin"
                      : "text-[#6B7280]"
                }`}
              />
            </div>
            <div className="text-base font-semibold capitalize text-white">
              {status.replace("_", " ")}
            </div>
            {webrtcConnectTimeMs && (
              <div className="text-[11px] text-[#9CA3AF] mt-1 flex items-center gap-1">
                <Clock className="size-3" />
                Handshake: {webrtcConnectTimeMs}ms
              </div>
            )}
          </div>

          {/* Candidate Mic Activity */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              isCandidateSpeaking
                ? "bg-[#03535F]/20 border-[#03535F] shadow-[0_0_15px_rgba(3,83,95,0.3)]"
                : "bg-[#182032] border-[#242D42]"
            }`}
          >
            <div className="text-xs text-[#9CA3AF] font-medium mb-1 flex items-center justify-between">
              <span>CANDIDATE MIC (FULL DUPLEX)</span>
              {micActive ? (
                <Mic className={`size-3.5 ${isCandidateSpeaking ? "text-[#38BDF8]" : "text-[#9CA3AF]"}`} />
              ) : (
                <MicOff className="size-3.5 text-[#EF4444]" />
              )}
            </div>
            <div className="text-base font-semibold text-white flex items-center gap-2">
              {isCandidateSpeaking ? (
                <span className="text-[#38BDF8] flex items-center gap-1">
                  <span className="size-2 rounded-full bg-[#38BDF8] animate-ping" />
                  Speaking (Capturing)...
                </span>
              ) : (
                <span className="text-[#6B7280]">Listening for voice</span>
              )}
            </div>
            <div className="text-[11px] text-[#9CA3AF] mt-1">
              Mic remains hot while AI speaks (Enables Instant Barge-In)
            </div>
          </div>

          {/* Interviewer Audio Activity */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              isAiSpeaking
                ? "bg-[#1E3A8A]/20 border-[#3B82F6] shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                : "bg-[#182032] border-[#242D42]"
            }`}
          >
            <div className="text-xs text-[#9CA3AF] font-medium mb-1 flex items-center justify-between">
              <span>INTERVIEWER OUTPUT (STREAMING)</span>
              <Volume2 className={`size-3.5 ${isAiSpeaking ? "text-[#60A5FA]" : "text-[#9CA3AF]"}`} />
            </div>
            <div className="text-base font-semibold text-white flex items-center gap-2">
              {isAiSpeaking ? (
                <span className="text-[#60A5FA] flex items-center gap-1">
                  <span className="size-2 rounded-full bg-[#60A5FA] animate-ping" />
                  Streaming Audio (Ash)
                </span>
              ) : (
                <span className="text-[#6B7280]">Silent / Ready</span>
              )}
            </div>
            <div className="text-[11px] text-[#9CA3AF] mt-1">
              Direct WebRTC remote audio track playback
            </div>
          </div>
        </div>

        {/* Latency & Telemetry Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Turn Latencies */}
          <div className="p-4 rounded-xl bg-[#182032] border border-[#242D42]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
              <Zap className="size-4 text-[#F59E0B]" />
              Measured Turn Latencies (Candidate Stop → Audible Audio)
            </div>

            {recentTurnMetrics.length === 0 ? (
              <div className="text-xs text-[#6B7280] py-6 text-center italic">
                Speak into the microphone to measure turn response latency.
              </div>
            ) : (
              <div className="space-y-2">
                {recentTurnMetrics.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#0E131F] border border-[#242D42] text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-[#F3F4F6]">
                        Turn Response:{" "}
                        <span
                          className={`font-mono text-sm ${
                            (m.turnToPlaybackMs || 0) < 1000 ? "text-[#10B981]" : "text-[#F59E0B]"
                          }`}
                        >
                          {m.turnToPlaybackMs ?? "—"} ms
                        </span>
                      </div>
                      <div className="text-[10px] text-[#9CA3AF] mt-0.5">
                        VAD Window: {m.vadSpeechEndLatencyMs ?? "—"}ms | Generation:{" "}
                        {m.responseGenerationMs ?? "—"}ms
                      </div>
                    </div>
                    <div className="text-[10px] px-2 py-0.5 rounded bg-[#1F2937] text-[#9CA3AF] font-mono">
                      Target: &lt;1000ms
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Barge-In / Interruption Telemetry */}
          <div className="p-4 rounded-xl bg-[#182032] border border-[#242D42]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
              <Activity className="size-4 text-[#E11D48]" />
              True Barge-In & Cancellation Telemetry
            </div>

            {recentInterruptions.length === 0 ? (
              <div className="text-xs text-[#6B7280] py-6 text-center italic">
                Interrupt the AI while it is speaking to measure cancellation speed.
              </div>
            ) : (
              <div className="space-y-2">
                {recentInterruptions.map((intr, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#0E131F] border border-[#7F1D1D] text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-[#FCA5A5] flex items-center gap-1.5">
                        <span>Cut-off Latency:</span>
                        <span className="font-mono text-sm text-white font-bold">
                          {intr.cancellationLatencyMs} ms
                        </span>
                      </div>
                      <div className="text-[10px] text-[#9CA3AF] mt-0.5">{intr.reason}</div>
                    </div>
                    <div className="text-[10px] px-2 py-0.5 rounded bg-[#991B1B]/40 text-[#FCA5A5] font-mono">
                      Sub-100ms Target
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Conversation Transcript & Event Stream */}
        <div className="p-5 rounded-xl bg-[#182032] border border-[#242D42] space-y-3">
          <div className="flex items-center justify-between border-b border-[#242D42] pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#03535F]" />
              Live Realtime Transcript & Session Log
            </h2>
            <span className="text-[11px] text-[#9CA3AF]">
              Topic: &quot;Explain how you would design a RAG system&quot;
            </span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {transcripts.length === 0 ? (
              <p className="text-xs text-[#6B7280] italic py-8 text-center">
                Click &quot;Start Voice Session&quot; to begin the live conversation test.
              </p>
            ) : (
              transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`text-xs p-3 rounded-lg border leading-relaxed ${
                    t.role === "candidate"
                      ? "bg-[#03535F]/15 border-[#03535F]/40 text-[#E0F2FE]"
                      : t.role === "interviewer"
                        ? "bg-[#1E293B] border-[#334155] text-[#F1F5F9]"
                        : "bg-[#0B0F19] border-[#1E2638] text-[#9CA3AF] font-mono text-[11px]"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-semibold text-[#9CA3AF] mb-1">
                    <span className="uppercase tracking-wider">
                      {t.role === "candidate"
                        ? "Candidate (You)"
                        : t.role === "interviewer"
                          ? "Interviewer (Realtime GPT)"
                          : "System Log"}
                    </span>
                    <span>{t.timestamp}</span>
                  </div>
                  <p className="text-[13px]">{t.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Phase 1 Verification Checklist Info */}
        <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E2638] text-xs text-[#9CA3AF] space-y-1.5">
          <div className="font-semibold text-white">Phase 1 Test Scenarios:</div>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>
              <span className="text-[#F3F4F6] font-medium">Scenario A (Clarification):</span> While AI
              speaks, interrupt with: <em>&quot;Wait, what do you mean by architecture?&quot;</em> → AI
              should cut off instantly and clarify without forgetting the question.
            </li>
            <li>
              <span className="text-[#F3F4F6] font-medium">Scenario B (Repeat):</span> Interrupt with:{" "}
              <em>&quot;Can you repeat that?&quot;</em> → AI cuts off immediately and repeats the
              question.
            </li>
            <li>
              <span className="text-[#F3F4F6] font-medium">Scenario C (Correction):</span> Say:{" "}
              <em>&quot;Actually, I want to correct something...&quot;</em> → AI stops and captures your
              correction.
            </li>
            <li>
              <span className="text-[#F3F4F6] font-medium">Scenario D (Natural Answer):</span> Answer
              with your chunking and vector database design → AI responds within 1 second.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
