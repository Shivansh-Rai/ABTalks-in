import type { Metadata } from "next";
import WorkshopHeader from "@/components/workshop/Header";
import { DashboardFooter } from "@/components/dashboard-hub/dashboard-footer";
import WorkshopHero from "@/components/workshop/WorkshopHero";
import RegistrationModal from "@/components/workshop/RegistrationModal";
import TopicsSection from "@/components/workshop/TopicsSection";
import CommunityStats from "@/components/workshop/CommunityStats";
import EventsCalendar from "@/components/workshop/EventsCalendar";
import WorkshopThemeStyles from "@/components/workshop/WorkshopThemeStyles";
import { WorkshopShell } from "@/components/workshop/WorkshopShell";
import { auth } from "@/auth";
import { getRegistrableEvent } from "@/components/workshop/events-data";
import { getWorkshopPrefill } from "@/features/workshop/get-prefill";
import { getMyRegistration } from "@/features/workshop/registration-status";
import { getWorkshopConfig } from "@/lib/workshop-supabase";

export const metadata: Metadata = {
  title: "ABTalks | Workshops Every week",
  description:
    "Join ABTalks' FREE 1-Hour Live LinkedIn Workshop on YouTube Live. Build a recruiter-ready profile, post content that actually gets seen, and use AI tools to stay consistent.",
  keywords:
    "LinkedIn, personal branding, LinkedIn profile, headline, About section, content strategy, LinkedIn posts, hooks, AI content creation, ChatGPT, Canva, scheduling, LinkedIn growth, analytics, networking, workshop, ABTalks",
  openGraph: {
    title: "ABTalks | Workshops Every week",
    description:
      "Join the FREE 1-Hour Live LinkedIn & Personal Branding Workshop",
    type: "website",
  },
};

export default async function AIWorkshopPage() {
  // This page stays PUBLIC — the marketing content, countdown and calendar must
  // render for logged-out cold traffic. Only the form overlay is gated.
  const [config, session] = await Promise.all([getWorkshopConfig(), auth()]);

  const event = getRegistrableEvent();
  const userId = session?.user?.id ?? null;

  const [alreadyRegistered, prefill] = userId
    ? await Promise.all([
        event
          ? getMyRegistration(userId, event.id).then((r) => r !== null)
          : Promise.resolve(false),
        getWorkshopPrefill(userId),
      ])
    : [false, null];

  const shellUser = {
    name: session?.user?.name ?? "",
    email: session?.user?.email ?? "",
    image: session?.user?.image ?? null,
  };

  return (
    <WorkshopShell user={shellUser} isAuthed={Boolean(userId)}>
      <div
        className="wk-root relative min-h-screen"
        style={{
          color: "var(--wk-text)",
          overflowX: "clip",
        }}
      >
        <WorkshopThemeStyles />
        <style>{`html { scroll-behavior: smooth; }`}</style>

        <WorkshopHeader isSignedIn={Boolean(userId)} />

        {/* The hero, the topics and the registration form all describe the SAME
          workshop — the one `getRegistrableEvent` resolved above. Passing it
          down as primitives keeps that true and keeps the LucideIcon on the
          event off the Server→Client boundary. */}
        <WorkshopHero
          webinarDate={config.webinarDate}
          webinarTime={config.webinarTime}
          webinarTargetUtc={config.webinarTargetUtc}
          eventTitle={event?.title ?? null}
          eventAccents={event?.titleAccents ?? null}
          eventDesc={event?.desc ?? null}
          eventPoster={event?.posterSrc ?? null}
        />

        <div id="curriculum" className="scroll-mt-16">
          <TopicsSection topics={event?.topics ?? null} />
        </div>

        <CommunityStats />

        {/* `scroll-mt-16` clears the 54px sticky header so the calendar's
          heading is not hidden under it when "Discover events" jumps here. */}
        <div id="events" className="scroll-mt-16">
          <EventsCalendar />
        </div>

        {/* The same footer /marketplace and /dashboard render, rather than the
          charcoal --wk-bar-* one this page used to carry, so the bottom of the
          app is identical wherever you are. */}
        <DashboardFooter />

        {/* Opened by the `#register` hash — see RegistrationModal. Primitives
          only across the Server→Client boundary: never the session object or
          a WorkshopEvent (it carries a LucideIcon). */}
        <RegistrationModal
          whatsappLink={config.whatsappLink}
          isSignedIn={Boolean(userId)}
          sessionEmail={session?.user?.email ?? null}
          sessionName={session?.user?.name ?? null}
          registrationOpen={Boolean(event)}
          alreadyRegistered={alreadyRegistered}
          prefillName={prefill?.name ?? null}
          prefillPhone={prefill?.phone ?? null}
          prefillOrganization={prefill?.organization ?? null}
          prefillGraduationYear={prefill?.graduationYear ?? null}
          prefillRole={prefill?.role ?? null}
          isExistingMember={prefill?.isExistingMember ?? false}
        />
      </div>
    </WorkshopShell>
  );
}
