import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PracticeShell } from "@/components/coding-practice/practice-shell";
import { isCodingPracticeEnabled } from "@/lib/feature-flags";

/**
 * /practice, coding practice inside the candidate shell (plan 186).
 * Off unless ENABLE_CODING_PRACTICE=true. Each page guards its own session.
 */
export default async function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isCodingPracticeEnabled()) notFound();

  const session = await auth();
  return (
    <PracticeShell
      user={{
        name: session?.user?.name ?? "",
        email: session?.user?.email ?? "",
        image: session?.user?.image ?? null,
      }}
      isAdmin={session?.user?.isAdmin ?? false}
      signedIn={Boolean(session?.user?.id)}
    >
      {children}
    </PracticeShell>
  );
}
