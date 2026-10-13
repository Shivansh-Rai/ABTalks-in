/**
 * Progressive playback of one synthesized interviewer line.
 *
 * Extracted from `interview-room.tsx` so the room and the developer latency
 * probe at `/dev/interview-latency` exercise the SAME code. A second copy would
 * defeat the point of the probe: it would measure the copy, not the room.
 *
 * Browser-only. Every entry point is called from a Client Component and touches
 * `window` lazily, inside the function body, so importing this module on the
 * server is harmless.
 */

/**
 * The container the speech route sends.
 *
 * Chromium and Firefox accept raw MP3 into a `SourceBuffer`; Safari does not
 * (`isTypeSupported("audio/mpeg")` is false there), which is exactly why
 * callers must keep a whole-blob fallback rather than assuming this works.
 */
export const STREAMING_MIME = "audio/mpeg";

/**
 * How fast the interviewer voice actually speaks, in characters per second.
 *
 * Measured on `gpt-4o-mini-tts` / `ash` with the delivery instruction this
 * project sends, across four real interviewer lines:
 *
 *    34 chars →  3.22s  (10.6 c/s)
 *   115 chars →  8.45s  (13.6 c/s)
 *   120 chars →  8.95s  (13.4 c/s)
 *   136 chars → 10.70s  (12.7 c/s)
 *
 * 13 sits in the middle of the range for lines of the length that matter. Short
 * lines come out slower per character because of the fixed silence at either
 * end, which only ever makes the estimate conservative — a reveal runs slightly
 * behind and then corrects, rather than finishing before the voice.
 *
 * Used ONLY until the media element reports a real duration, which for a
 * streamed body does not happen until `endOfStream()` lands.
 */
export const SPEECH_CHARS_PER_SECOND = 13;

export function canStreamAudio(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaSource !== "undefined" &&
    window.MediaSource.isTypeSupported(STREAMING_MIME)
  );
}

/** One `appendBuffer`, as a promise. A SourceBuffer rejects a second append while `updating`. */
function appendChunk(buffer: SourceBuffer, chunk: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      buffer.removeEventListener("updateend", done);
      buffer.removeEventListener("error", failed);
      resolve();
    };
    const failed = () => {
      buffer.removeEventListener("updateend", done);
      buffer.removeEventListener("error", failed);
      reject(new Error("appendBuffer failed"));
    };
    buffer.addEventListener("updateend", done);
    buffer.addEventListener("error", failed);
    try {
      buffer.appendBuffer(chunk as BufferSource);
    } catch {
      failed();
    }
  });
}

export type StreamedLine = {
  audio: HTMLAudioElement;
  /** Resolves once enough audio is buffered to begin playing. */
  playable: Promise<void>;
  release: () => void;
};

/**
 * Plays a speech response AS IT ARRIVES.
 *
 * Why this exists. The room used to do `URL.createObjectURL(await res.blob())`,
 * which cannot start the audio until the last byte of the MP3 has arrived — and
 * the route, in turn, used to wait for the vendor's last byte before sending
 * its first. Both ends buffered the same file, so a question the vendor had
 * begun producing after ~1.1s did not reach the candidate's ears until ~3.2s.
 * The route now streams; this consumes that stream and starts playing at the
 * first chunk. Measured in Chromium against a chunked endpoint: playable at
 * 1114ms streamed against 2282ms buffered.
 *
 * Returns the element plus a promise that resolves once enough audio is
 * buffered to begin, or null when this browser cannot stream MP3 — in which
 * case the caller falls back to the blob it already knows how to play. Both
 * paths end up at the same `HTMLAudioElement`, so a caller's existing guards
 * (generation, barge-in, cancellation) keep working unchanged.
 *
 * `shouldStop` is checked between chunks so a superseded line stops pumping
 * instead of downloading audio nobody will hear.
 */
export function streamLineAudio(
  body: ReadableStream<Uint8Array>,
  shouldStop: () => boolean,
): StreamedLine | null {
  if (!canStreamAudio()) return null;

  let mediaSource: MediaSource;
  try {
    mediaSource = new MediaSource();
  } catch {
    return null;
  }

  const url = URL.createObjectURL(mediaSource);
  const audio = new Audio(url);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    URL.revokeObjectURL(url);
  };

  const playable = new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      let buffer: SourceBuffer;
      try {
        buffer = mediaSource.addSourceBuffer(STREAMING_MIME);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("addSourceBuffer failed"));
        return;
      }

      const reader = body.getReader();
      let announced = false;

      const pump = async (): Promise<void> => {
        for (;;) {
          if (shouldStop()) {
            await reader.cancel().catch(() => {});
            return;
          }
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.byteLength === 0) continue;
          await appendChunk(buffer, value);
          if (!announced) {
            announced = true;
            // One chunk is enough to start. The rest keeps appending behind the
            // playhead, which is the entire point.
            resolve();
          }
        }
        if (mediaSource.readyState === "open") {
          // Ends the stream, which is also what gives the element a real
          // `duration` — see SPEECH_CHARS_PER_SECOND above.
          mediaSource.endOfStream();
        }
      };

      pump().catch((error) => {
        if (!announced) reject(error instanceof Error ? error : new Error("stream failed"));
      });
    };

    mediaSource.addEventListener("sourceopen", onOpen, { once: true });
    mediaSource.addEventListener(
      "sourceclose",
      () => {
        if (!released) reject(new Error("MediaSource closed before playback"));
      },
      { once: true },
    );
  });

  return { audio, playable, release };
}
