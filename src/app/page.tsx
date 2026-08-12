import { getLandingState } from "@/features/landing/get-landing-state";
import { isClaudeEnabled } from "@/lib/feature-flags";
import { LandingHub } from "@/components/landing/landing-hub";

export default async function HomePage() {
  const state = await getLandingState();
  return <LandingHub claudeEnabled={isClaudeEnabled()} state={state} />;
}
