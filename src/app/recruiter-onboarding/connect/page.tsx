import type { Metadata } from "next";
import { ConnectScreen } from "@/components/recruiter-onboarding/connect-screen";

export const metadata: Metadata = {
  title: "Connect with candidates | Hire with ABTalks",
  description:
    "Shortlist the right people, reach out with confidence and start hiring.",
};

// Public, step 3 (final) of the pre-signup recruiter onboarding (see ../page.tsx).
export default function RecruiterOnboardingConnectPage() {
  return <ConnectScreen />;
}
