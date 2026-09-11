"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { sendOutreachAction } from "@/app/actions/outreach-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * "Email candidate" from the desk (T-232).
 *
 * Only mounted where contact is already shared, but that is a courtesy: the
 * server refuses anyone without contact access, whatever this renders.
 *
 * The candidate receives a real email and replies on ABTalks, so the dialog
 * says so. A recruiter who expects replies in their own inbox would otherwise
 * wait for mail that is not coming.
 *
 * Design: no UX-03 screen exists for outreach (plan 130, A-1). This uses the
 * unlock dialog's classes so the two read as one family, and expects a visual
 * pass.
 */

const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none";

export function OutreachComposeDialog({
  candidateRef,
  candidateLabel,
  className,
}: {
  /** A name for the candidate, never a key: the server re-resolves it. */
  candidateRef: string;
  /** For the dialog subtitle only. */
  candidateLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // One id per compose. A retry of the same click reuses it and the server
  // writes one message; a fresh compose gets a fresh one.
  const [clientRequestId, setClientRequestId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ threadId: string; notice: string | null } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setOpen(true);
    setError(null);
    setSent(null);
    setClientRequestId(crypto.randomUUID());
  }

  function send() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await sendOutreachAction({
        candidateRef,
        subject,
        body,
        clientRequestId,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      const { emailStatus, emailFailureReason } = result.data;
      // The reason is already a sentence; drop its full stop so the notice
      // doesn't end up with two.
      const reason = (emailFailureReason ?? "unknown reason").replace(/\.+$/, "");
      const notice =
        emailStatus === "FAILED" || emailStatus === "SKIPPED"
          ? `Saved on ABTalks, but the email didn't send: ${reason}. The candidate will still see it in their ABTalks messages.`
          : null;
      if (notice) toast.warning("Message saved — email not sent");
      else toast.success("Message sent");

      setSent({ threadId: result.data.threadId, notice });
      setSubject("");
      setBody("");
    });
  }

  return (
    <>
      <button
        type="button"
        className={cn("hire-unlock-trigger", className)}
        onClick={openDialog}
      >
        <Mail className="size-3.5" aria-hidden="true" />
        Email candidate
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="hire-app hire-unlock sm:max-w-md" showCloseButton>
          <DialogHeader>
            <p className="hire-auth__kicker">ABTalks Hire</p>
            <DialogTitle>Email {candidateLabel}</DialogTitle>
            <DialogDescription>
              They get this by email and reply on ABTalks. Replies come back to
              you alone, in Messages.
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="space-y-3 text-sm">
              {sent.notice ? (
                <p className="hire-unlock__notice">{sent.notice}</p>
              ) : (
                <p>Sent. You&apos;ll be notified when they reply.</p>
              )}
              <p className="text-muted-foreground">
                Their reply will appear in <strong>Messages</strong> in the left
                menu.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">
                  Subject <span className="text-xs">(for a new conversation)</span>
                </span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={150}
                  placeholder="e.g. Frontend role at our company"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Message</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={5000}
                  rows={7}
                  placeholder="Introduce yourself and the role…"
                  className={cn(inputClass, "resize-y")}
                />
              </label>
              {error && <p className="hire-unlock__notice">{error}</p>}
            </div>
          )}

          <div className="hire-unlock__actions">
            <button
              type="button"
              className="hire-unlock__cancel"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {sent ? "Close" : "Cancel"}
            </button>
            {sent && (
              <Link
                href={`/hire/messages/${sent.threadId}`}
                className="hire-unlock__confirm"
              >
                Open the conversation
              </Link>
            )}
            {!sent && (
              <button
                type="button"
                className="hire-unlock__confirm"
                onClick={send}
                disabled={pending || !body.trim()}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Sending
                  </>
                ) : (
                  "Send email"
                )}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
