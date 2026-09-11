import { cn } from "@/lib/utils";

/**
 * One outreach conversation, rendered for whichever side is reading (T-232).
 *
 * Server Component: a pure render from plain props. Bodies are rendered as
 * text, never as HTML: both sides wrote them.
 *
 * The delivery line is recruiter-only. It is how "send failures are logged
 * with a readable reason" becomes something a recruiter can actually see.
 */

export type ThreadViewMessage = {
  id: string;
  author: "RECRUITER" | "CANDIDATE";
  body: string;
  /** ISO string. */
  createdAt: string;
  emailStatus?: "PENDING" | "SENT" | "FAILED" | "SKIPPED" | "NONE";
  emailFailureReason?: string | null;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function deliveryLine(m: ThreadViewMessage): string | null {
  switch (m.emailStatus) {
    case "SENT":
      return "Emailed";
    case "PENDING":
      return "Sending email…";
    case "FAILED":
    case "SKIPPED":
      return `Not emailed: ${(m.emailFailureReason ?? "unknown reason").replace(/\.+$/, "")}. Visible to them in their ABTalks messages.`;
    default:
      return null;
  }
}

export function OutreachThread({
  messages,
  viewer,
  counterpartName,
}: {
  messages: ThreadViewMessage[];
  viewer: "RECRUITER" | "CANDIDATE";
  counterpartName: string;
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const mine = m.author === viewer;
        const delivery = viewer === "RECRUITER" && mine ? deliveryLine(m) : null;
        return (
          <li
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
              mine ? "ml-auto bg-primary/10" : "bg-muted",
            )}
          >
            <p className="mb-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {mine ? "You" : counterpartName} · {formatWhen(m.createdAt)}
            </p>
            <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
            {delivery && (
              <p
                className={cn(
                  "mt-1 text-[11px]",
                  m.emailStatus === "FAILED" || m.emailStatus === "SKIPPED"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {delivery}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
