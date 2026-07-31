import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TrackList } from "@/components/explore/track-list";
import { AppHeader } from "@/components/shared/app-header";
import { getUserActiveEnrollments } from "@/features/enrollment/get-user-enrollments";
import { isClaudeEnabled } from "@/lib/feature-flags";

export default async function ExplorePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const enrollments = await getUserActiveEnrollments(session.user.id);
  const claudeEnabled = isClaudeEnabled();
  const headerUser = {
    name: session.user.name ?? null,
    email: session.user.email ?? "",
    image: session.user.image ?? null,
    role: session.user.role ?? "STUDENT",
    isAdmin: session.user.isAdmin ?? false,
  };

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <AppHeader user={headerUser} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Explore
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Keep building in your current tracks or discover something new.
        </p>
        <TrackList
          enrollments={enrollments}
          claudeEnabled={claudeEnabled}
        />
      </main>
    </div>
  );
}
