"use client";

import { TESTIMONIALS } from "@/components/landing/testimonials-data";
import { useSafeReducedMotion } from "@/lib/motion";
import { Reveal } from "./motion/reveal";
import { QUOTE_TINTS } from "./landing-content";

/**
 * The placeholder WhatsApp shows when an account has no photo: a plain person
 * glyph on a grey disc. Decorative — the name it belongs to is read out of the
 * <strong> beside it.
 */
function AvatarGlyph() {
  return (
    <span className="avatar" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="8.2" r="3.9" />
        <path d="M12 13.7c-4.2 0-7.6 2.6-7.6 5.8V21h15.2v-1.5c0-3.2-3.4-5.8-7.6-5.8Z" />
      </svg>
    </span>
  );
}

function QuoteCard({
  name,
  org,
  quote,
  tint,
  hidden,
}: {
  name: string;
  org: string | null;
  quote: string;
  tint: (typeof QUOTE_TINTS)[number];
  hidden?: boolean;
}) {
  return (
    <article className={`quote quote--${tint}`} aria-hidden={hidden || undefined}>
      <p>“{quote}”</p>
      <footer>
        <AvatarGlyph />
        <span>
          <strong>{name}</strong>
          {org ? <small>{org}</small> : null}
        </span>
      </footer>
    </article>
  );
}

export function TestimonialsSection() {
  const reduce = useSafeReducedMotion();
  const cards = TESTIMONIALS.map((item, i) => (
    <QuoteCard
      key={item.name + i}
      name={item.name}
      org={item.org}
      quote={item.quote}
      tint={QUOTE_TINTS[i % QUOTE_TINTS.length]!}
    />
  ));

  return (
    <section className="section testimonials">
      <div className="container testimonials__head">
        <Reveal as="h2" className="h2">
          What people are saying?
        </Reveal>
        <Reveal as="p" className="p">
          Don&apos;t just take our word for it. See what our members have to
          say about their experience.
        </Reveal>
      </div>

      <div className="marquee" id="marquee">
        <div className="marquee__track" id="marqueeTrack">
          {cards}
          {reduce
            ? null
            : TESTIMONIALS.map((item, i) => (
                <QuoteCard
                  key={`dup-${item.name}-${i}`}
                  name={item.name}
                  org={item.org}
                  quote={item.quote}
                  tint={QUOTE_TINTS[i % QUOTE_TINTS.length]!}
                  hidden
                />
              ))}
        </div>
      </div>
    </section>
  );
}
