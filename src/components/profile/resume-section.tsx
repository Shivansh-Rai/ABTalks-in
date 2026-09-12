"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  removeResumeAction,
  saveResumeLinkAction,
  uploadResumeAction,
} from "@/app/actions/resume-actions";
import {
  ACCEPTED_MIME_TYPES,
  MAX_RESUME_BYTES,
  type ResumeView,
} from "@/features/resume/types";
import { ResumeStrength } from "./resume-strength";
import { PwField, PwInput, PwRow } from "./wizard-fields";

/**
 * The Resume section of the profile.
 *
 * Replaces what used to be a bare URL text box in Links. Upload is the primary
 * path; the link is kept because it was there first and people already have one
 * saved, and saving a link still writes the same `resumeUrl` every existing
 * reader uses.
 *
 * Styling is the wizard's own `pw-*` clay language, not shadcn — this renders
 * inside the same sheet as every other section, and it used to be the one panel
 * that looked like a different product.
 *
 * Nothing internal is rendered here — no raw JSON, no parser or model names, no
 * status codes. The only text a candidate ever sees on a failure is the message
 * the server chose for them.
 */

type Phase = "idle" | "uploading" | "processing";

const MAX_MB = Math.floor(MAX_RESUME_BYTES / (1024 * 1024));

/** "Education, Projects and Skills" — read as a sentence, not a CSV. */
function formatList(items: string[]): string {
  const lower = items.map((i) => i.toLowerCase());
  if (lower.length <= 1) return lower[0] ?? "";
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function ResumeSection({ resume }: { resume: ResumeView | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [linkDraft, setLinkDraft] = useState(resume?.sourceUrl ?? "");
  const [dragging, setDragging] = useState(false);
  const [removing, startRemoving] = useTransition();

  const busy = phase !== "idle" || removing;

  async function onFileChosen(file: File) {
    // Client-side courtesy check only — the server re-checks the actual bytes,
    // and it is the server's answer that decides.
    if (file.size > MAX_RESUME_BYTES) {
      toast.error(`That file is too large. Please upload a PDF under ${MAX_MB} MB.`);
      return;
    }

    setPhase("uploading");
    // The action does the transfer and the analysis in one call, so the two
    // phases cannot be observed separately from here. The switch is timed so
    // the copy stops saying "uploading" long after the bytes have gone.
    const toProcessing = setTimeout(() => setPhase("processing"), 1500);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadResumeAction(formData);
      if (!result.ok) {
        toast.error(result.message);
      } else {
        toast.success("Resume analysed");
      }
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      clearTimeout(toProcessing);
      setPhase("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSaveLink() {
    const url = linkDraft.trim();
    if (url.length === 0) {
      toast.error("Paste a link to your resume");
      return;
    }
    setPhase("processing");
    try {
      const result = await saveResumeLinkAction({ url });
      if (!result.ok) toast.error(result.message);
      else toast.success("Resume analysed");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPhase("idle");
    }
  }

  function onRemove() {
    startRemoving(async () => {
      const result = await removeResumeAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setLinkDraft("");
      toast.success("Resume removed");
      router.refresh();
    });
  }

  /* ── Busy overlay ─────────────────────────────────────────────────────── */

  if (phase !== "idle") {
    return (
      <div className="pw-resume-busy">
        <span className="pw-resume-spin" aria-hidden />
        <p className="pw-resume-busy-title" aria-live="polite">
          {phase === "uploading"
            ? "Uploading your resume…"
            : "Analysing your resume…"}
        </p>
        <p className="pw-resume-busy-copy">
          This usually takes a few seconds. Please keep this page open.
        </p>
      </div>
    );
  }

  /* ── Source controls: always available, so a resume can be replaced ────── */

  const controls = (
    <div className="pw-resume-controls">
      <div
        className={`pw-file-drop${dragging ? " pw-dragging" : ""}`}
        onClick={() => {
          if (!busy) fileRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !busy) void onFileChosen(file);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          className="pw-file-input"
          accept={ACCEPTED_MIME_TYPES.join(",")}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFileChosen(file);
          }}
        />
        <div className="pw-file-body">
          <span className="pw-file-icon">
            <UploadIcon />
          </span>
          <span className="pw-file-copy">
            <span className="pw-file-title">
              {resume ? "Replace your resume" : "Upload your resume"}
            </span>
            <span className="pw-file-hint">
              PDF only, up to {MAX_MB} MB. Your file stays private — only you and
              ABTalks admins can open it.
            </span>
          </span>
          <button type="button" className="pw-file-browse" disabled={busy}>
            Browse
          </button>
        </div>
      </div>

      {/*
        Not an "or" divider. Both paths run the same parser, but they are not
        equally likely to succeed: a Drive link only fetches when the file is
        shared with anyone who has the link, and most people's are restricted.
        Presenting the two as peers sends candidates down the path that fails.
      */}
      <div className="pw-resume-divider">
        <p className="pw-resume-hint">
          Already have your resume online? You can point us at it instead.
        </p>
      </div>

      <PwRow cols={1}>
        <PwField
          label="Resume link"
          htmlFor="resume-link"
          helper="Must be publicly viewable — in Google Drive, set sharing to “Anyone with the link”. If we cannot open it, upload the PDF instead."
        >
          <PwInput
            id="resume-link"
            type="url"
            inputMode="url"
            placeholder="https://drive.google.com/…"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            disabled={busy}
          />
        </PwField>
      </PwRow>

      <div className="pw-resume-actions">
        <button
          type="button"
          className="pw-btn-action pw-btn-quiet"
          onClick={() => void onSaveLink()}
          disabled={busy || linkDraft.trim().length === 0}
        >
          Save &amp; analyse link
        </button>
        {resume ? (
          <button
            type="button"
            className="pw-btn-action pw-btn-quiet"
            onClick={onRemove}
            disabled={busy}
          >
            {removing ? "Removing…" : "Remove resume"}
          </button>
        ) : null}
      </div>
    </div>
  );

  /* ── EMPTY ────────────────────────────────────────────────────────────── */

  if (!resume) {
    return (
      <div className="pw-resume">
        <p className="pw-note">
          No resume yet. Upload one to see how strong it is and what to improve.
        </p>
        {controls}
      </div>
    );
  }

  /* ── FAILED ───────────────────────────────────────────────────────────── */

  if (resume.status === "FAILED") {
    return (
      <div className="pw-resume">
        <div className="pw-resume-notice pw-is-error">
          <AlertIcon />
          <div>
            <p className="pw-resume-notice-title">
              We could not analyse that resume
            </p>
            <p className="pw-resume-notice-copy">
              {resume.failureReason ??
                "Something went wrong. Please try again or upload the PDF directly."}
            </p>
          </div>
        </div>
        {controls}
      </div>
    );
  }

  /* ── PROCESSING (a previous run left the row mid-flight) ──────────────── */

  if (resume.status === "PROCESSING") {
    return (
      <div className="pw-resume">
        <div className="pw-resume-busy">
          <span className="pw-resume-spin" aria-hidden />
          <p className="pw-resume-busy-title">Analysing your resume…</p>
          <button
            type="button"
            className="pw-btn-action pw-btn-quiet"
            onClick={() => router.refresh()}
          >
            Refresh
          </button>
        </div>
        {controls}
      </div>
    );
  }

  /* ── READY ────────────────────────────────────────────────────────────── */

  return (
    <div className="pw-resume">
      {/* What is attached */}
      <div className="pw-resume-file">
        <span className="pw-file-icon pw-file-icon-doc">
          <FileIcon />
        </span>
        <span className="pw-file-copy">
          <span className="pw-file-title">
            {resume.fileName ?? resume.sourceUrl ?? "Your resume"}
          </span>
          <span className="pw-file-hint">
            Added{" "}
            {new Date(resume.updatedAtIso).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </span>
        <span className="pw-resume-file-links">
          {resume.downloadPath ? (
            <a
              href={resume.downloadPath}
              target="_blank"
              rel="noreferrer"
              className="pw-resume-link"
            >
              <DownloadIcon />
              View file
            </a>
          ) : null}
          {resume.sourceUrl ? (
            <a
              href={resume.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="pw-resume-link"
            >
              <ExternalIcon />
              Open link
            </a>
          ) : null}
        </span>
      </div>

      {/*
        What the resume contributed. The information itself is NOT repeated
        here — it went into the profile's own sections, which are editable and
        sit a few centimetres up this same page. Listing it twice would make
        the resume card a read-only shadow of the profile.
      */}
      {resume.addedToProfile.length > 0 ? (
        <div className="pw-resume-notice">
          <SparkIcon />
          <div>
            <p className="pw-resume-notice-title">
              Your {formatList(resume.addedToProfile)} got more complete
            </p>
            <p className="pw-resume-notice-copy">
              Scroll up to review and edit any of it. Nothing you had already
              written was changed or removed.
            </p>
          </div>
        </div>
      ) : null}

      {resume.strength ? <ResumeStrength strength={resume.strength} /> : null}

      <div className="pw-resume-divider">{controls}</div>
    </div>
  );
}
