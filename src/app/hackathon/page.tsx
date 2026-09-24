import type { Metadata } from "next";
import { auth } from "@/auth";
import { ComingSoonCard } from "@/components/hackathon/dashboard/coming-soon-card";
import {
  HACKATHON,
  isHackathonRegistrationOpen,
} from "@/components/hackathon/hackathon-config";
import { HackathonShell } from "@/components/hackathon-v2/hackathon-shell";
import { RegistrationDialogTrigger } from "@/components/hackathon-v2/registration-dialog-trigger";
import { TeamPanel } from "@/components/hackathon-v2/team-panel";
import { getMyRegistration } from "@/features/hackathon/get-my-registration";
import {
  getRegistrationPrefill,
  type RegistrationPrefill,
} from "@/features/hackathon/registration-identity";
import "./_styles/hackathon-v2.css";

export const metadata: Metadata = {
  title: `Hackathon · ${HACKATHON.name}`,
  description:
    "The next ABTalks hackathon is being announced — check back soon.",
};

/**
 * Postponed 2026-09-24. The full landing (hero, timeline, rules, FAQ,
 * Discord callout and the locked sections) is intentionally not rendered
 * while the event is on hold — we replace it with a single "Coming soon"
 * card. Registered users still see their team panel so their 6-char code
 * is not lost. Restore the full landing by reverting this file and
 * flipping `HACKATHON.registrationOpen` back to true when the next event
 * is ready.
 */
export default async function HackathonPage() {
  const session = await auth();
  const name = session?.user?.name ?? "";
  const userId = session?.user?.id ?? null;
  const isAuthed = Boolean(userId);
  const registration = userId ? await getMyRegistration(userId) : null;
  const registered = registration !== null;
  const prefill: RegistrationPrefill | null = userId
    ? await getRegistrationPrefill(userId)
    : null;
  const registrationOpen = isHackathonRegistrationOpen();

  const headerCta = (
    <RegistrationDialogTrigger
      registered={registered}
      registrationOpen={registrationOpen}
      isAuthed={isAuthed}
      prefill={prefill}
      className="ab-btn ab-btn--primary ab-header__cta"
      labelWhenRegister="Register"
      labelWhenClosed="Registration closed"
    />
  );

  return (
    <HackathonShell
      headerCta={headerCta}
      isAuthed={isAuthed}
      user={{
        name,
        email: session?.user?.email ?? "",
        image: session?.user?.image ?? null,
      }}
    >
      <a className="ab-skip" href="#hk-coming-soon-title">
        Skip to main content
      </a>

      <div className="mx-auto w-full max-w-3xl px-4 py-10 pb-28 md:pb-10">
        <div className="space-y-6" id="hk-coming-soon-title">
          <ComingSoonCard />

          {registration && registration.team.entryType === "TEAM" ? (
            <TeamPanel
              entryType={registration.team.entryType}
              teamCode={registration.team.code}
              teamName={registration.team.name}
              members={registration.members}
              maxTeamSize={HACKATHON.maxTeamSize}
            />
          ) : null}
        </div>
      </div>
    </HackathonShell>
  );
}
