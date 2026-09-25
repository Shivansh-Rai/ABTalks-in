import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import {
  VIDEOTHON,
  isVideothonRegistrationOpen,
} from "@/features/hackathon-video/config";
import { getMyVideoRegistration } from "@/features/hackathon-video/get-my-registration";
import { HackathonShell } from "@/components/hackathon-v2/hackathon-shell";
import { VideothonCountdown } from "@/components/hackathon-video/countdown";
import { VideothonRegisterCTA } from "@/components/hackathon-video/register-cta";
import { ReelTimeline } from "@/components/hackathon-video/reel-timeline";
import { FaqTape } from "@/components/hackathon-video/faq-tape";
import "@/components/hackathon-video/landing.css";

export const metadata: Metadata = {
  title: `${VIDEOTHON.name} · ABTalks`,
  description:
    "A 48-hour hackathon for video editors. Solo. One brief. Ship one cut.",
};

const TIMELINE = [
  {
    label: "01",
    title: "Kickoff",
    body: "The brief drops in the WhatsApp group. The clock starts. Open your project.",
    atPct: 0,
  },
  {
    label: "02",
    title: "Halfway",
    body: "Optional pulse check. Share rough cuts, get notes, keep cutting.",
    atPct: 0.5,
  },
  {
    label: "03",
    title: "Deadline",
    body: "Submit your Drive / Behance / YouTube link before the timer hits zero.",
    atPct: 1,
  },
  {
    label: "04",
    title: "Results",
    body: "Winners announced with a public reel. Feedback for every entry.",
    atPct: 1,
  },
];

const RULES = [
  {
    scene: "01",
    take: "SOLO",
    title: "You cut it alone",
    body: "Individual entries only. No credited collaborators — one editor, one cut.",
  },
  {
    scene: "02",
    take: "FOOTAGE",
    title: "Sources allowed, credited",
    body: "Stock is fine. Client work is not. If a shot isn't yours, name where it came from.",
  },
  {
    scene: "03",
    take: "WINDOW",
    title: "Everything inside 48 hours",
    body: "The cut, the grade, the sound, the export — all after kickoff. Pre-built templates disclosed in notes.",
  },
  {
    scene: "04",
    take: "SUBMIT",
    title: "One link, before the timer",
    body: "Drive, Behance, YouTube, Vimeo — any public link a judge can open. Late is not counted.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Who's it for?",
    a: "Anyone who edits video — students, self-taught cutters, in-house editors, freelancers. All skill levels, worldwide.",
  },
  {
    q: "Do I need to be in India?",
    a: "No. It's a 48-hour online hackathon. Register with any phone number from the country-code list; submit from anywhere.",
  },
  {
    q: "What software can I use?",
    a: "Anything. Premiere, DaVinci, Final Cut, CapCut, After Effects, whatever ships your best cut. Your call.",
  },
  {
    q: "What's the brief?",
    a: "It lands in the WhatsApp group at kickoff. One prompt everyone edits to — the constraint is what makes it interesting.",
  },
  {
    q: "Do I get feedback if I don't win?",
    a: "Yes. Every entry gets a short note from the judges. That's the point.",
  },
];

export default async function HackathonPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isAuthed = Boolean(userId);
  const registration = userId ? await getMyVideoRegistration(userId) : null;
  const registered = registration !== null;
  const registrationOpen = isVideothonRegistrationOpen();
  const prefill =
    session?.user?.name && session.user.email
      ? { fullName: session.user.name, email: session.user.email }
      : null;

  const headerCta = (
    <VideothonRegisterCTA
      isAuthed={isAuthed}
      registered={registered}
      registrationOpen={registrationOpen}
      prefill={prefill}
      variant="pill"
    />
  );

  return (
    <HackathonShell
      headerCta={headerCta}
      isAuthed={isAuthed}
      user={{
        name: session?.user?.name ?? "",
        email: session?.user?.email ?? "",
        image: session?.user?.image ?? null,
      }}
    >
      <a className="ab-skip" href="#vt-hero-title">
        Skip to main content
      </a>

      <div className="vt">
        <span className="vt-sprocket" aria-hidden />
        <span className="vt-sprocket vt-sprocket--right" aria-hidden />

        <div className="vt-inner">
          {/* ============ HERO ============ */}
          <section className="vt-hero" aria-labelledby="vt-hero-title">
            <p className="vt-hero__eyebrow">
              <span className="vt-dot" aria-hidden />
              REC · 48 HOURS · ONE BRIEF
            </p>
            <h1 className="vt-hero__title" id="vt-hero-title">
              {VIDEOTHON.name}
              <br />
              <em>for editors.</em>
            </h1>
            <p className="vt-hero__tagline">{VIDEOTHON.tagline}</p>

            <div className="vt-hero__stack">
              <VideothonCountdown
                kickoffUtc={VIDEOTHON.kickoffUtc}
                deadlineUtc={VIDEOTHON.deadlineUtc}
              />
              <div className="vt-hero__meta">
                <span>
                  <strong>{VIDEOTHON.kickoffLabel}</strong>
                </span>
                <span>→ {VIDEOTHON.deadlineLabel}</span>
                <span>{VIDEOTHON.resultsLabel}</span>
              </div>
            </div>

            <div className="vt-hero__stack">
              <VideothonRegisterCTA
                isAuthed={isAuthed}
                registered={registered}
                registrationOpen={registrationOpen}
                prefill={prefill}
                variant="cta"
              />
              {VIDEOTHON.whatsappLink ? (
                <Link
                  href={VIDEOTHON.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vt-btn vt-btn--ghost vt-btn--lg"
                >
                  WhatsApp group →
                </Link>
              ) : null}
            </div>
          </section>

          {/* ============ TIMELINE ============ */}
          <section className="vt-section" aria-labelledby="vt-timeline-title">
            <p className="vt-section__eyebrow">Timeline</p>
            <h2 className="vt-section__title" id="vt-timeline-title">
              A single <em>continuous cut.</em>
            </h2>
            <ReelTimeline
              kickoffUtc={VIDEOTHON.kickoffUtc}
              deadlineUtc={VIDEOTHON.deadlineUtc}
              marks={TIMELINE}
            />
          </section>

          {/* ============ RULES ============ */}
          <section className="vt-section" aria-labelledby="vt-rules-title">
            <p className="vt-section__eyebrow">Rules · Scene 01 · Take 1</p>
            <h2 className="vt-section__title" id="vt-rules-title">
              Four <em>slates,</em> non-negotiable.
            </h2>
            <ol className="vt-rules">
              {RULES.map((r) => (
                <li key={r.title} className="vt-slate">
                  <p className="vt-slate__meta">
                    <span>Scene {r.scene}</span>
                    <span>{r.take}</span>
                  </p>
                  <h3 className="vt-slate__title">{r.title}</h3>
                  <p className="vt-slate__body">{r.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ============ PRIZES ============ */}
          <section className="vt-section" aria-labelledby="vt-prizes-title">
            <p className="vt-section__eyebrow">Prizes</p>
            <h2 className="vt-section__title" id="vt-prizes-title">
              What you <em>walk with.</em>
            </h2>
            {VIDEOTHON.prizes.length === 0 ? (
              <div className="vt-marquee__soon">
                Prize tiers revealed at kickoff — every finalist gets a public
                spotlight and a written judge note.
              </div>
            ) : (
              <div className="vt-marquee" aria-label="Prize tiers">
                <div className="vt-marquee__track">
                  {[...VIDEOTHON.prizes, ...VIDEOTHON.prizes].map((p, i) => (
                    <span key={`${p.place}-${i}`} className="vt-marquee__item">
                      {p.place} — {p.reward}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ============ FAQ ============ */}
          <section className="vt-section" aria-labelledby="vt-faq-title">
            <p className="vt-section__eyebrow">FAQ</p>
            <h2 className="vt-section__title" id="vt-faq-title">
              Questions we <em>keep hearing.</em>
            </h2>
            <FaqTape items={FAQ_ITEMS} />
          </section>

          {/* ============ WHATSAPP CALLOUT ============ */}
          {VIDEOTHON.whatsappLink ? (
            <section
              className="vt-callout"
              aria-labelledby="vt-whatsapp-title"
            >
              <div>
                <h2 className="vt-callout__title" id="vt-whatsapp-title">
                  The brief lands on WhatsApp.
                </h2>
                <p className="vt-callout__body">
                  Kickoff announcements, the brief, judge Q&amp;A and
                  last-minute updates all happen there first. Being registered
                  isn&apos;t enough — join the group.
                </p>
              </div>
              <Link
                href={VIDEOTHON.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="vt-btn vt-btn--tape vt-btn--lg"
              >
                Join the group →
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </HackathonShell>
  );
}
