import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { WelcomeContinue } from "@/components/candidate-welcome/welcome-continue";
import { WelcomeScreen } from "@/components/candidate-welcome/welcome-screen";

export const metadata: Metadata = {
  title: "Welcome back | ABTalks",
};

// Only same-origin dashboard paths: this screen exists to lead into the
// dashboard, and accepting anything else would turn ?next= into an open redirect.
const nextSchema = z.string().regex(/^\/dashboard(?:[/?#]|$)/);

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

// Candidate sign-in lands here (see app/login/login-client.tsx), then continues
// to the dashboard once it has been preloaded.
export default async function WelcomePage({ searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const parsed = nextSchema.safeParse(rawNext);
  const next = parsed.success ? parsed.data : "/dashboard";

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?from=${encodeURIComponent(next)}`);
  }

  return (
    <>
      <WelcomeScreen />
      <WelcomeContinue href={next} />
    </>
  );
}
