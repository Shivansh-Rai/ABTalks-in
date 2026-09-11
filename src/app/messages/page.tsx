import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCandidateThreads } from "@/features/hire/outreach";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Messages | ABTalks",
};

/**
 * A candidate's messages from recruiters (T-232). Signed-in only; the list is
 * filtered on the session user. Recruiters appear by name and company, never
 * by email address.
 */
export default async function CandidateMessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/messages");

  const threads = await listCandidateThreads(session.user.id);

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? session.user.email ?? "",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
      }}
      isAdmin={session.user.isAdmin ?? false}
      showSectionNav={false}
    >
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Recruiters who contact you through ABTalks. Your replies go only to
            the recruiter in that conversation.
          </p>
        </div>

        {threads.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/messages/${t.id}`}
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
                        <span className="text-muted-foreground"> · {t.counterpartDetail}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t.lastMessageAt.slice(0, 10)}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.unread && <span className="sr-only">Unread. </span>}
                      {t.subject} — {t.lastMessagePreview}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </DashboardShell>
  );
}
