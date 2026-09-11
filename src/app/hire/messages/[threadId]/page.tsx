import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/program-auth";
import { getRecruiterThread } from "@/features/hire/outreach";
import { OutreachThread } from "@/components/outreach/outreach-thread";
import { OutreachReplyBox } from "@/components/outreach/outreach-reply-box";

export const metadata: Metadata = {
  title: "Conversation | ABTalks Hire",
};

/**
 * One outreach conversation, recruiter side (T-232). Another recruiter's
 * thread id is a 404: the read is scoped to the session user, so there is no
 * "forbidden" branch to get wrong.
 */
export default async function HireThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const { userId } = await requireRecruiter();
  const thread = await getRecruiterThread(userId, threadId);
  if (!thread) notFound();

  return (
    <div className="space-y-6">
      <Link href="/hire/messages" className="hire-back">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 19 8 12l7-7" />
        </svg>
        All messages
      </Link>

      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold tracking-tight">
          {thread.candidateName}
        </h2>
        <p className="text-sm text-muted-foreground">{thread.subject}</p>
      </div>

      <OutreachThread
        viewer="RECRUITER"
        counterpartName={thread.candidateName}
        messages={thread.messages}
      />

      {thread.canSend ? (
        <OutreachReplyBox
          threadId={thread.id}
          persona="recruiter"
          placeholder={`Write to ${thread.candidateName}…`}
        />
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          You no longer have access to this candidate&apos;s contact details, so
          you can&apos;t send new messages. The history stays here.
        </p>
      )}
    </div>
  );
}
