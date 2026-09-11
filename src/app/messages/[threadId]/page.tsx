import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCandidateThread } from "@/features/hire/outreach";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { OutreachThread } from "@/components/outreach/outreach-thread";
import { OutreachReplyBox } from "@/components/outreach/outreach-reply-box";

export const metadata: Metadata = {
  title: "Conversation | ABTalks",
};

/**
 * One conversation, candidate side (T-232). This is where the outreach email's
 * link lands. Someone else's thread id is a 404.
 */
export default async function CandidateThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/messages/${threadId}`)}`);
  }

  const thread = await getCandidateThread(session.user.id, threadId);
  if (!thread) notFound();

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
        <Link href="/messages" className="text-sm text-primary hover:underline">
          ← All messages
        </Link>

        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {thread.recruiterName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {thread.company} · {thread.subject}
          </p>
        </div>

        <OutreachThread
          viewer="CANDIDATE"
          counterpartName={thread.recruiterName}
          messages={thread.messages}
        />

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Your reply goes only to {thread.recruiterName} at {thread.company}.
          </p>
          <OutreachReplyBox
            threadId={thread.id}
            persona="candidate"
            placeholder={`Reply to ${thread.recruiterName}…`}
          />
        </div>
      </main>
    </DashboardShell>
  );
}
