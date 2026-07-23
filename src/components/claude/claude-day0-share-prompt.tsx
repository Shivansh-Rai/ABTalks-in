"use client";

import { useEffect, useState } from "react";
import { ClaudeSharePromptDialog } from "@/components/claude/claude-share-prompt-dialog";

export const CLAUDE_DAY0_SHARE_PENDING_KEY = "claude-day0-share-pending";

interface Props {
  /** When true, Day 0 prompt must never show. */
  hasDay1Submission: boolean;
}

/**
 * Shows the Day 0 ChatGPT/Gemini LinkedIn prompt once after Claude registration.
 * Pending flag is set on registration; cleared when the dialog is dismissed.
 * Never shows again after Day 1 is submitted.
 */
export function ClaudeDay0SharePrompt({ hasDay1Submission }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasDay1Submission) {
      try {
        window.localStorage.removeItem(CLAUDE_DAY0_SHARE_PENDING_KEY);
      } catch {
        // ignore
      }
      setOpen(false);
      return;
    }

    try {
      const pending =
        window.localStorage.getItem(CLAUDE_DAY0_SHARE_PENDING_KEY) === "1";
      setOpen(pending);
    } catch {
      setOpen(false);
    }
  }, [hasDay1Submission]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      try {
        window.localStorage.removeItem(CLAUDE_DAY0_SHARE_PENDING_KEY);
      } catch {
        // ignore
      }
    }
  }

  return (
    <ClaudeSharePromptDialog open={open} day={0} onOpenChange={handleOpenChange} />
  );
}
