import type { Metadata } from "next";
import Link from "next/link";
import { requireRecruiter } from "@/lib/program-auth";
import { listRecruiterThreads } from "@/features/hire/outreach";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Messages | ABTalks Hire",
};

/**
 * The recruiter's outreach conversations (T-232). Every row is theirs alone:
 * `listRecruiterThreads` filters on the session user, so a colleague on the
 * same company domain sees an empty list, not this one.
 */
export default async function HireMessagesPage() {
  const { userId } = await requireRecruiter();
  const threads = await listRecruiterThreads(userId);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-heading text-[13px] leading-[18px] font-semibold text-primary">
          Outreach
        </p>
        <h1 className="font-heading text-[40px] leading-[48px] font-bold tracking-normal max-md:text-[32px] max-md:leading-[36px]">
          Messages
        </h1>
        <p className="max-w-xl text-[17px] leading-7 text-muted-foreground max-md:text-base max-md:leading-[25px]">
          Candidates you email from ABTalks reply here. Replies reach you alone,
          and you&apos;re notified by email when one arrives.
        </p>
      </div>

      {threads.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No conversations yet. Unlock a candidate&apos;s contact details, then
            choose Email candidate.
          </p>
          <Link href="/hire" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
            Find candidates
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                href={`/hire/messages/${t.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    t.unread ? "bg-primary" : "bg-transparent",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", t.unread && "font-semibold")}>
                      {t.counterpartName}
                      <span className="text-muted-foreground"> · {t.subject}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t.lastMessageAt.slice(0, 10)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.unread && <span className="sr-only">Unread. </span>}
                    {t.lastMessagePreview}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
