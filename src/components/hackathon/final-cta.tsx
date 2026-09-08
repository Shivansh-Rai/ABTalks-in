import { auth } from "@/auth";
import {
  HACKATHON,
  isHackathonRegistrationOpen,
} from "@/components/hackathon/hackathon-config";
import { HeroCta } from "@/components/hackathon/hero-cta";
import { getMyRegistration } from "@/features/hackathon/get-my-registration";

export async function FinalCta() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const name = session?.user?.name ?? "";
  const isAuthed = Boolean(session?.user?.id);
  const registered = session?.user?.id
    ? (await getMyRegistration(session.user.id)) !== null
    : false;
  const registrationOpen = isHackathonRegistrationOpen();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
      <div className="rounded-xl border border-[#403880] bg-gradient-to-br from-[#1a1240] via-[#030712] to-[#030712] px-6 py-12 text-center shadow-sm sm:px-10">
        <h2
          className="bg-gradient-to-r from-white from-[75%] to-[#A2A2A2] bg-clip-text text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-transparent sm:text-3xl"
          style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
        >
          Ready to vibe code?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[#BCBCBC]">
          {HACKATHON.tagline} Free to enter. Solo or teams of{" "}
          {HACKATHON.maxTeamSize}.
        </p>
        <div className="mt-8 flex justify-center">
          <HeroCta
            registered={registered}
            registrationOpen={registrationOpen}
            isAuthed={isAuthed}
            initialEmail={email}
            initialName={name}
          />
        </div>
        <p className="mt-4 text-sm text-[#BCBCBC]">
          {HACKATHON.registrationClosesLabel}
        </p>
      </div>
    </section>
  );
}
