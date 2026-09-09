import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import {
  HACKATHON,
  isHackathonRegistrationOpen,
} from "@/components/hackathon/hackathon-config";
import { FaqAccordion } from "@/components/hackathon-v2/faq-accordion";
import { HackathonShell } from "@/components/hackathon-v2/hackathon-shell";
import { Hero } from "@/components/hackathon-v2/hero";
import { LockedSections } from "@/components/hackathon-v2/locked-sections";
import { RegistrationDialogTrigger } from "@/components/hackathon-v2/registration-dialog-trigger";
import { UnlockProvider } from "@/components/hackathon-v2/unlock-provider";
import { getMyRegistration } from "@/features/hackathon/get-my-registration";
import {
  getRegistrationPrefill,
  type RegistrationPrefill,
} from "@/features/hackathon/registration-identity";
import "./_styles/hackathon-v2.css";

export const metadata: Metadata = {
  title: `Hackathon · ${HACKATHON.name}`,
  description:
    "The next ABTalks hackathon — pre-register, see how it works, the timeline and the rules.",
};

const HIW_STEPS = [
  {
    title: "Register",
    body: "Sign up solo or create a team of up to 3. It takes under two minutes and it’s free.",
  },
  {
    title: "Join the Discord",
    body: "Every participant is required to join our Discord. Kickoff updates and the problem statement land there first.",
  },
  {
    title: "Build for 48 hours",
    body: "From Friday kickoff to Sunday deadline, describe what you want, let AI write the code, ship something real.",
  },
  {
    title: "Submit before the deadline",
    body: "Public GitHub repo, live deployed URL, and your AI-usage log. Late submissions don’t count.",
  },
];

const TIMELINE = [
  {
    title: "Kickoff",
    body: "The challenge drops. The clock starts. Jump in, think fast, and build something great before time runs out.",
    art: "/hackathon-v2/documents.png",
    artW: "45.7%",
    w: 162,
    h: 141,
  },
  {
    title: "Midpoint check-in",
    body: "Optional pulse check in the Discord. Share progress, unblock teammates, keep shipping.",
    art: "/hackathon-v2/chat.png",
    artW: "31.9%",
    w: 112,
    h: 98,
  },
  {
    title: "Deadline",
    body: "Repos locked. Repo public, deploy live, PROMPTS.md (or chat exports) in place.",
    art: "/hackathon-v2/calendar.png",
    artW: "35.1%",
    w: 124,
    h: 101,
  },
  {
    title: "Results",
    body: "Winners announced. Criteria: originality, polish, and how well you steered the AI.",
    art: "/hackathon-v2/trophy.png",
    artW: "39.1%",
    w: 137,
    h: 133,
  },
];

const FAQ_ITEMS = [
  {
    q: "Who can participate in ViCodathon 2.0 2026?",
    a: "ViCodathon 2.0 is open to college students from any branch or year. You can participate solo or in a team of up to 3 members.",
  },
  {
    q: "Is ViCodathon 2.0 online or offline?",
    a: "ViCodathon 2.0 is a 100% online, 48-hour hackathon, allowing participants to build and compete from anywhere.",
  },
  {
    q: "What will I win from ViCodathon 2.0?",
    a: "Participants can compete for a prize pool up to ₹30,000, receive a certificate for every valid submission, and may get internship & hiring opportunities.",
  },
  {
    q: "Can we use AI tools during the hackathon?",
    a: "Yes! You can use any AI tools including ChatGPT, Claude, Gemini, Cursor, Windsurf, Bolt, Lovable, Replit, GitHub Copilot, and more.",
  },
];

const RULES = [
  {
    n: "01.",
    title: "Solo or teams of up to 3",
    body: "Enter alone or create a team. One shareable 6-character code joins teammates. Max three people total.",
    variant: "rule--1",
  },
  {
    n: "02.",
    title: "Open to Indian college students",
    body: "1st year through recent grads. One entry per person, enforced by email.",
    variant: "rule--2",
  },
  {
    n: "03.",
    title: "Build starts at kickoff",
    body: "No head starts. Anything pre-built must be disclosed in your submission notes.",
    variant: "rule--3",
  },
  {
    n: "04.",
    title: "Fair play",
    body: "Use any AI coding tool. Don’t submit someone else’s work as yours. Be kind in the community chat.",
    variant: "rule--4",
  },
];

export default async function HackathonPage() {
  const session = await auth();
  const name = session?.user?.name ?? "";
  const userId = session?.user?.id ?? null;
  const isAuthed = Boolean(userId);
  const registered = userId
    ? (await getMyRegistration(userId)) !== null
    : false;
  // Everything the popup no longer asks for comes from here. Computed for any
  // signed-in visitor, registered or not: the refresh that follows a successful
  // registration re-runs this while the dialog is still open on its success
  // panel, and returning null there would unmount the panel mid-read.
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
      labelWhenClosed="Closed"
    />
  );

  return (
    <UnlockProvider registered={registered}>
      <HackathonShell
        headerCta={headerCta}
        isAuthed={isAuthed}
        user={{
          name,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      >
        <a className="ab-skip" href="#hk-hero-title">
          Skip to main content
        </a>

        <Hero
          registrationOpen={registrationOpen}
          isAuthed={isAuthed}
          prefill={prefill}
        />

        <LockedSections>
          {/* 2 · Discover How It Works */}
          <section className="hk-how" id="hk-how" aria-labelledby="hk-how-title">
        <h2 className="hk-h2" id="hk-how-title">
          Discover How it works
        </h2>

        <ol className="hk-how__grid">
          {HIW_STEPS.map((step, i) => (
            <li key={step.title} className="hiw">
              <span className="hiw__tab" aria-hidden>
                {i + 1}
              </span>
              <div className="hiw__body">
                <h3 className="hiw__title">{step.title}</h3>
                <p className="hiw__text">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 2.5 · Discord callout — required by product */}
      <section
        className="hk-discord"
        id="hk-discord"
        aria-labelledby="hk-discord-title"
      >
        <div className="hk-discord__card">
          <div className="hk-discord__body">
            <span className="hk-discord__eyebrow">Community · Required</span>
            <h2 className="hk-discord__title" id="hk-discord-title">
              Every participant joins the Discord
            </h2>
            <p className="hk-discord__text">
              Kickoff announcements, the problem statement, judge Q&amp;A,
              teammate matching and last-minute updates all happen on our
              Discord server first. If you&rsquo;re not in the server, you
              will miss it.
            </p>
          </div>
          <div className="hk-discord__cta">
            <Link
              href={HACKATHON.discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ab-btn ab-btn--primary hk-discord__btn"
            >
              Join the Discord →
            </Link>
            <p className="hk-discord__note">
              Opens {HACKATHON.discordLink.replace(/^https?:\/\//, "")} in a
              new tab.
            </p>
          </div>
        </div>
      </section>

      {/* 3 · Timeline */}
      <section
        className="hk-timeline"
        data-timeline
        aria-labelledby="hk-timeline-title"
      >
        <div className="tl">
          <h2 className="hk-h2 tl__title" id="hk-timeline-title">
            Timeline
          </h2>

          <ol className="tl__cards">
            {TIMELINE.map((t, i) => (
              <li
                key={t.title}
                className="tl-card"
                style={{ ["--i" as string]: String(i) } as React.CSSProperties}
              >
                <h3 className="tl-card__title">{t.title}</h3>
                <p className="tl-card__text">{t.body}</p>
                <Image
                  className="tl-card__art"
                  style={
                    {
                      ["--art-w" as string]: t.artW,
                    } as React.CSSProperties
                  }
                  src={t.art}
                  alt=""
                  aria-hidden
                  width={t.w}
                  height={t.h}
                  unoptimized
                  loading="lazy"
                />
              </li>
            ))}
          </ol>

          <div className="tl__rail" aria-hidden>
            <span className="tl__line" />
            {["14.77%", "38.26%", "61.74%", "85.23%"].map((x, i) => (
              <span
                key={x}
                className="tl-tab"
                style={
                  {
                    ["--x" as string]: x,
                    ["--i" as string]: String(i),
                  } as React.CSSProperties
                }
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · FAQ */}
      <section className="hk-faq" aria-labelledby="hk-faq-title">
        <div className="hk-faq__intro">
          <h2 className="hk-h2 hk-faq__title" id="hk-faq-title">
            Frequently asked
            <br />
            <em>questions</em>
          </h2>
          <p className="hk-faq__sub">Common questions before you register.</p>
        </div>
        <FaqAccordion items={FAQ_ITEMS} />
      </section>

      {/* 5 · Rules */}
      <section className="hk-rules" aria-labelledby="hk-rules-title">
        <h2 className="ab-sr" id="hk-rules-title">
          Rules
        </h2>
        <div className="rules">
          <span className="rules__word" aria-hidden>
            RULES
          </span>
            {RULES.map((r) => (
              <article key={r.n} className={`rule ${r.variant}`} tabIndex={0}>
                <Image
                  className="rule__pin"
                  src="/hackathon-v2/pin.png"
                  alt=""
                  aria-hidden
                  width={267}
                  height={288}
                  unoptimized
                  loading="lazy"
                />
                <div className="rule__note">
                  <h3 className="rule__title">
                    <b>{r.n}</b> {r.title}
                  </h3>
                  <p className="rule__text">{r.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        </LockedSections>
      </HackathonShell>
    </UnlockProvider>
  );
}
