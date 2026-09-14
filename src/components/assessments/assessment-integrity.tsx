"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createIntegrityRecorder, type IntegrityRecorder } from "./integrity-recorder";
import "@/components/hire/assessment/candidate-assessment-screen.css";

export const PHONE_SHORT_SIDE_PX = 600;
type NavigatorWithUAData = Navigator & { userAgentData?: { mobile?: boolean } };
type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FullscreenCapableElement = HTMLElement & { webkitRequestFullscreen?: () => void };

export type StrictSupport = {
  phone: boolean;
  fullscreenSupported: boolean;
  cameraSupported: boolean;
};

export function detectStrictSupport(): StrictSupport {
  const nav: NavigatorWithUAData = navigator;
  const doc: FullscreenDocument = document;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return {
    // Phones in either orientation; tablets (short side ≥ 600) and desktops pass.
    phone: nav.userAgentData?.mobile === true || shortSide < PHONE_SHORT_SIDE_PX,
    fullscreenSupported:
      document.fullscreenEnabled === true || doc.webkitFullscreenEnabled === true,
    cameraSupported:
      window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function",
  };
}

export function isPageFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const doc: FullscreenDocument = document;
  return (document.fullscreenElement ?? doc.webkitFullscreenElement ?? null) !== null;
}

/** MUST be called synchronously inside a click handler (user activation). */
export function requestPageFullscreen(): Promise<boolean> {
  const el: FullscreenCapableElement = document.documentElement;
  try {
    if (typeof el.requestFullscreen === "function") {
      return el.requestFullscreen({ navigationUI: "hide" }).then(
        () => true,
        () => false,
      );
    }
    if (typeof el.webkitRequestFullscreen === "function") {
      el.webkitRequestFullscreen();
      return Promise.resolve(true);
    }
  } catch {
    /* fall through */
  }
  return Promise.resolve(false);
}

export async function exitPageFullscreen(): Promise<void> {
  if (!isPageFullscreen()) return;
  const doc: FullscreenDocument = document;
  try {
    if (typeof document.exitFullscreen === "function") {
      await document.exitFullscreen();
      return;
    }
    if (typeof doc.webkitExitFullscreen === "function") {
      doc.webkitExitFullscreen();
    }
  } catch {
    /* swallowed */
  }
}

export async function acquireCamera(): Promise<
  { ok: true; stream: MediaStream } | { ok: false; reason: "denied" | "unavailable" | "unsupported" }
> {
  if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
    return { ok: false, reason: "unsupported" };
  }
  try {
    return {
      ok: true,
      stream: await navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
    };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    return {
      ok: false,
      reason: name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable",
    };
  }
}

export function isCameraLive(stream: MediaStream | null): boolean {
  return !!stream && stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled && !t.muted);
}

const PHONE_LINE =
  "Assessments can't be taken on a phone. Open this page on a laptop or desktop computer.";
const FULLSCREEN_LINE =
  "This browser can't show the assessment in fullscreen. Open it in Chrome, Edge, Firefox or Safari on a laptop or desktop.";

export type CameraError = "denied" | "unavailable" | "unsupported";

export function cameraErrorCopy(reason: CameraError): string {
  if (reason === "denied") {
    return "Camera access is blocked. Allow it for this site in your browser's address bar, then try again.";
  }
  if (reason === "unavailable") {
    return "No camera was found. Connect a camera, then try again.";
  }
  return "This browser can't use a camera. Open it in Chrome, Edge, Firefox or Safari.";
}

type ChecklistProps = {
  support: StrictSupport | null;
  cameraRequired: boolean;
  camera: MediaStream | null;
  cameraError: CameraError | null;
  onAllowCamera: () => void;
  busy: boolean;
};

export function StrictModeChecklist({
  support,
  cameraRequired,
  camera,
  cameraError,
  onAllowCamera,
  busy,
}: ChecklistProps) {
  const cameraLive = isCameraLive(camera);
  return (
    <div className="hire-cand-assess-rules">
      <h2>Before you start</h2>
      {support === null ? (
        <p>Checking your device…</p>
      ) : (
        <ul>
          <Requirement ok={!support.phone} okText="Laptop or desktop computer." badText={PHONE_LINE} />
          <Requirement
            ok={support.fullscreenSupported}
            okText="Fullscreen."
            badText={FULLSCREEN_LINE}
          />
          {cameraRequired ? (
            <li className="hire-cand-assess-rules__row">
              <span
                className={
                  cameraLive
                    ? "hire-cand-assess-rules__status--ok"
                    : "hire-cand-assess-rules__status--bad"
                }
                aria-hidden="true"
              >
                {cameraLive ? "✓" : "✗"}
              </span>
              <div>
                {cameraLive ? (
                  <>
                    <p>Camera on — only you can see this preview.</p>
                    <video
                      className="hire-cand-assess-rules__preview"
                      autoPlay
                      muted
                      playsInline
                      ref={(el) => {
                        if (el) el.srcObject = camera;
                      }}
                    />
                  </>
                ) : cameraError ? (
                  <p>{cameraErrorCopy(cameraError)}</p>
                ) : (
                  <button
                    type="button"
                    className="hire-cand-assess__secondary"
                    disabled={busy}
                    onClick={onAllowCamera}
                  >
                    Allow camera
                  </button>
                )}
              </div>
            </li>
          ) : null}
        </ul>
      )}

      <div className="hire-cand-assess-recorded">
        <h2>What&apos;s recorded</h2>
        <p>While you take this assessment, ABTalks records the time of each of these:</p>
        <ul>
          <li>Leaving and returning to fullscreen</li>
          <li>
            The assessment page being hidden or shown again, and the browser window losing or
            regaining focus
          </li>
          <li>
            Leaving the assessment page ends it — you cannot continue later. Closing the tab or
            navigating away submits what you have answered so far
          </li>
          <li>
            Copy, cut and paste attempts — these are blocked, except pasting a link into a
            file-link field
          </li>
          <li>Opening an upload link</li>
          {cameraRequired ? (
            <li>
              Your camera turning on or off. The video stays on your device — it isn&apos;t
              recorded or sent.
            </li>
          ) : null}
        </ul>
        <p>Nothing outside this page is recorded. The recruiter sees these events with your answers.</p>
      </div>
    </div>
  );
}

function Requirement({
  ok,
  okText,
  badText,
}: {
  ok: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <li className="hire-cand-assess-rules__row">
      <span
        className={ok ? "hire-cand-assess-rules__status--ok" : "hire-cand-assess-rules__status--bad"}
        aria-hidden="true"
      >
        {ok ? "✓" : "✗"}
      </span>
      <p>{ok ? okText : badText}</p>
    </li>
  );
}

export function StrictModeUnavailable() {
  return (
    <div className="hire-cand-assess-block hire-cand-assess-block--static">
      <div className="hire-cand-assess-block__card">
        <h2>Continue on a laptop or desktop</h2>
        <p>
          This assessment can only be taken on a laptop or desktop computer, in a browser that
          can show it in fullscreen. Your answers are saved — open this page there to continue.
        </p>
      </div>
    </div>
  );
}

export function startBlockedReasonFor(
  support: StrictSupport | null,
  cameraRequired: boolean,
  camera: MediaStream | null,
): string | null {
  if (support === null) return "Checking your device…";
  if (support.phone) return PHONE_LINE;
  if (!support.fullscreenSupported) return FULLSCREEN_LINE;
  if (cameraRequired && !isCameraLive(camera)) return "Allow your camera to start.";
  return null;
}

type GuardProps = {
  assignmentId: string;
  cameraRequired: boolean;
  camera: MediaStream | null;
  onRequestCamera: () => Promise<boolean>;
  endingRef: { current: "submitted" | null };
  onStopped: (status: number) => void;
  children: ReactNode;
};

function closestAttr(target: EventTarget | null, selector: string, attr: string): string | undefined {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!el) return undefined;
  const found = el.closest(selector);
  return found?.getAttribute(attr) ?? undefined;
}

export function StrictModeGuard({
  assignmentId,
  cameraRequired,
  camera,
  onRequestCamera,
  endingRef,
  onStopped,
  children,
}: GuardProps) {
  const recorderRef = useRef<IntegrityRecorder | null>(null);
  const leaveBeaconedRef = useRef(false);
  const [outsideFullscreen, setOutsideFullscreen] = useState(() => !isPageFullscreen());
  const [exitedThisSession, setExitedThisSession] = useState(false);
  const [deadCameraId, setDeadCameraId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const cameraLive =
    isCameraLive(camera) && (camera === null || camera.id !== deadCameraId);
  const blocked = outsideFullscreen || (cameraRequired && !cameraLive);

  useEffect(() => {
    const url = `/api/assessments/${assignmentId}/events`;
    const leaveUrl = `/api/assessments/${assignmentId}/leave`;
    const beaconLeaveClose = () => {
      if (leaveBeaconedRef.current) return;
      if (endingRef.current === "submitted") return;
      leaveBeaconedRef.current = true;
      const body = JSON.stringify({ reason: "leave" });
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (!navigator.sendBeacon(leaveUrl, blob)) {
        void fetch(leaveUrl, {
          method: "POST",
          body,
          keepalive: true,
          headers: { "content-type": "text/plain;charset=UTF-8" },
        });
      }
    };
    const recorder = createIntegrityRecorder({
      assignmentId,
      send: (body) =>
        fetch(url, {
          method: "POST",
          body,
          keepalive: true,
          headers: { "content-type": "text/plain;charset=UTF-8" },
        }).then((r) => ({ status: r.status })),
      beacon: (body) =>
        navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=UTF-8" })),
      now: () => Date.now(),
      uuid: () => crypto.randomUUID(),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (id) => window.clearTimeout(id),
      onStopped: (status) => onStopped(status),
    });
    recorderRef.current = recorder;
    recorder.startSession();
    if (isPageFullscreen()) recorder.record("FULLSCREEN_ENTERED");
    if (document.visibilityState === "hidden") recorder.record("VISIBILITY_HIDDEN");
    if (!document.hasFocus()) recorder.record("WINDOW_BLURRED");
    if (cameraRequired && isCameraLive(camera)) recorder.record("CAMERA_ON");

    const onFullscreen = () => {
      const on = isPageFullscreen();
      setOutsideFullscreen(!on);
      if (on) recorder.record("FULLSCREEN_ENTERED");
      else {
        setExitedThisSession(true);
        recorder.record("FULLSCREEN_EXITED");
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        recorder.record("VISIBILITY_HIDDEN");
        recorder.flushWithBeacon();
      } else {
        recorder.record("VISIBILITY_VISIBLE");
      }
    };
    const onBlur = () => recorder.record("WINDOW_BLURRED");
    const onFocus = () => recorder.record("WINDOW_FOCUSED");
    const onPageHide = () => {
      recorder.leave();
      beaconLeaveClose();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      // bfcache restore after leave-close: do not reopen a closed attempt's session.
      leaveBeaconedRef.current = false;
      setExitedThisSession(false);
      recorder.startSession();
      if (isPageFullscreen()) recorder.record("FULLSCREEN_ENTERED");
      if (document.visibilityState === "hidden") recorder.record("VISIBILITY_HIDDEN");
      if (!document.hasFocus()) recorder.record("WINDOW_BLURRED");
      if (cameraRequired && isCameraLive(camera)) recorder.record("CAMERA_ON");
      setOutsideFullscreen(!isPageFullscreen());
    };

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      recorder.record("COPY_BLOCKED", closestAttr(e.target, "[data-question-id]", "data-question-id"));
    };
    const onCut = (e: ClipboardEvent) => {
      e.preventDefault();
      recorder.record("CUT_BLOCKED", closestAttr(e.target, "[data-question-id]", "data-question-id"));
    };
    const onPaste = (e: ClipboardEvent) => {
      const linkQ = closestAttr(e.target, "[data-link-input-question]", "data-link-input-question");
      if (linkQ) {
        recorder.record("LINK_PASTED", linkQ);
        return;
      }
      e.preventDefault();
      recorder.record("PASTE_BLOCKED", closestAttr(e.target, "[data-question-id]", "data-question-id"));
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      recorder.record("DROP_BLOCKED", closestAttr(e.target, "[data-question-id]", "data-question-id"));
    };
    const onBeforeInput = (e: InputEvent) => {
      if (
        e.inputType === "insertFromPaste" ||
        e.inputType === "insertFromPasteAsQuotation" ||
        e.inputType === "insertFromDrop"
      ) {
        if (closestAttr(e.target, "[data-link-input-question]", "data-link-input-question")) return;
        e.preventDefault();
      }
    };
    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const id = closestAttr(e.target, "[data-upload-link-question]", "data-upload-link-question");
      if (id) recorder.record("UPLOAD_LINK_OPENED", id);
    };

    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("webkitfullscreenchange", onFullscreen);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCut, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("webkitfullscreenchange", onFullscreen);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCut, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("beforeinput", onBeforeInput, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("click", onClick, true);
      // Read at unmount: submitted vs leave. Intentionally not captured at mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- endingRef is a mutable flag
      if (endingRef.current === "submitted") recorder.finish();
      else {
        recorder.leave();
        beaconLeaveClose();
      }
    };
    // Mount-only: listeners capture the stream via the camera argument at start;
    // later camera changes are handled in the track effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  useEffect(() => {
    if (!cameraRequired || !camera) return;
    const rec = recorderRef.current;
    if (isCameraLive(camera)) rec?.record("CAMERA_ON");
    const onEnded = () => {
      rec?.record("CAMERA_OFF");
      setDeadCameraId(camera.id);
    };
    const onMute = () => {
      rec?.record("CAMERA_OFF");
      setDeadCameraId(camera.id);
    };
    const onUnmute = () => {
      rec?.record("CAMERA_ON");
      setDeadCameraId((id) => (id === camera.id ? null : id));
    };
    const tracks = camera.getVideoTracks();
    for (const t of tracks) {
      t.addEventListener("ended", onEnded);
      t.addEventListener("mute", onMute);
      t.addEventListener("unmute", onUnmute);
    }
    return () => {
      for (const t of tracks) {
        t.removeEventListener("ended", onEnded);
        t.removeEventListener("mute", onMute);
        t.removeEventListener("unmute", onUnmute);
      }
    };
  }, [camera, cameraRequired]);

  useEffect(() => {
    if (blocked) {
      const el = document.activeElement;
      if (el instanceof HTMLElement) restoreFocusRef.current = el;
    } else {
      const el = restoreFocusRef.current;
      if (el && el.isConnected) el.focus();
    }
  }, [blocked]);

  return (
    <div className="hire-cand-assess-guard" data-blocked={blocked ? "true" : "false"}>
      <div className="hire-cand-assess-guard__content" inert={blocked}>
        {children}
      </div>
      {blocked ? (
        <BlockingModal
          fullscreenUnmet={outsideFullscreen}
          exitedThisSession={exitedThisSession}
          cameraUnmet={cameraRequired && !cameraLive}
          error={modalError}
          onAction={async () => {
            setModalError(null);
            if (outsideFullscreen) {
              const ok = await requestPageFullscreen();
              if (!ok) {
                setModalError("Fullscreen couldn't be opened. Try again.");
                return;
              }
            }
            if (cameraRequired && !isCameraLive(camera)) {
              const ok = await onRequestCamera();
              if (!ok) return;
            }
          }}
        />
      ) : null}
      {cameraRequired && cameraLive && camera ? <SelfView stream={camera} /> : null}
    </div>
  );
}

function BlockingModal({
  fullscreenUnmet,
  exitedThisSession,
  cameraUnmet,
  error,
  onAction,
}: {
  fullscreenUnmet: boolean;
  exitedThisSession: boolean;
  cameraUnmet: boolean;
  error: string | null;
  onAction: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  let title = "Camera Required";
  let body = "Please turn your camera back on to continue your assessment.";
  let action = "Turn camera on";
  if (fullscreenUnmet && exitedThisSession) {
    title = "Fullscreen Required";
    body = "Please return to fullscreen mode to continue your assessment.";
    action = "Return to fullscreen";
  } else if (fullscreenUnmet) {
    title = "Fullscreen Required";
    body = "Please enter fullscreen mode to continue your assessment.";
    action = "Enter fullscreen";
  } else if (cameraUnmet) {
    title = "Camera Required";
    body = "Please turn your camera back on to continue your assessment.";
    action = "Turn camera on";
  }

  return (
    <div
      className="hire-cand-assess-block"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="hire-cand-assess-block__card">
        <h2 id={titleId}>{title}</h2>
        <p id={descId}>{body}</p>
        <p>Your answers are saved.</p>
        {error ? <p className="hire-cand-assess__error">{error}</p> : null}
        <button
          ref={buttonRef}
          type="button"
          className="hire-cand-assess__primary"
          onClick={() => {
            // Fullscreen must be requested synchronously inside this click.
            void onAction();
          }}
        >
          {action}
        </button>
      </div>
    </div>
  );
}

function SelfView({ stream }: { stream: MediaStream }) {
  return (
    <div className="hire-cand-assess-selfview">
      <video
        autoPlay
        muted
        playsInline
        ref={(el) => {
          if (el) el.srcObject = stream;
        }}
      />
      <p>Camera on — only you can see this</p>
    </div>
  );
}
