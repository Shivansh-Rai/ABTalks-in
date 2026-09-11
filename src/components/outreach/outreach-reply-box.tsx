"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  candidateReplyAction,
  recruiterReplyAction,
} from "@/app/actions/outreach-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Reply box for an outreach thread (T-232).
 *
 * Picks its action from a string rather than taking a function prop, so
 * nothing but plain data crosses the Server→Client boundary. The server
 * re-derives who is replying from the session either way; `persona` only
 * chooses which door to knock on.
 */
export function OutreachReplyBox({
  threadId,
  persona,
  placeholder,
}: {
  threadId: string;
  persona: "recruiter" | "candidate";
  placeholder: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  // Stable until a reply lands, so a retried click is one message.
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();

  function send() {
    if (!body.trim()) return;
    startTransition(async () => {
      const input = { threadId, body, clientRequestId };
      const result =
        persona === "recruiter"
          ? await recruiterReplyAction(input)
          : await candidateReplyAction(input);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (
        "emailStatus" in result.data &&
        (result.data.emailStatus === "FAILED" || result.data.emailStatus === "SKIPPED")
      ) {
        toast.warning("Saved — but the email didn't send. See the note under your message.");
      }
      setBody("");
      setClientRequestId(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        rows={4}
        placeholder={placeholder}
        aria-label="Your reply"
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
      />
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={send}
          className={cn(buttonVariants({ size: "sm" }), "gap-1.5 disabled:opacity-50")}
        >
          {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          Send reply
        </button>
      </div>
    </div>
  );
}
