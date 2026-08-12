import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hackathonRedirectForProfilelessUser } from "@/features/hackathon/registration-status";
import { LandingHub } from "@/components/landing/landing-hub";

export default async function HomePage() {
  const session = await auth();

  if (session?.user?.id) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (profile) {
      redirect("/dashboard");
    } else {
      const hx = await hackathonRedirectForProfilelessUser(session.user.id);
      if (hx) redirect(hx);
      redirect("/register");
    }
  }

  return <LandingHub />;
}
