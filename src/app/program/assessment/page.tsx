import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EntryAssessment } from "@/components/program/entry-assessment";
import { getActiveAssessment } from "@/features/program/entry";

export default async function ProgramAssessmentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?from=/program/assessment");

  const assessment = await getActiveAssessment(session.user.id);
  if (!assessment) redirect("/program/apply");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <EntryAssessment
        attemptId={assessment.attemptId}
        deadlineIso={assessment.deadlineIso}
        questions={assessment.questions}
      />
    </main>
  );
}
