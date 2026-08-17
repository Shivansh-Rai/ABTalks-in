"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { IST } from "@/lib/date-utils";
import { EVENTS } from "@/components/workshop/events-data";

function todayIstKey(): string {
  return formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
}

export function EventsSection() {
  const today = todayIstKey();

  const upcoming = EVENTS.filter((e) => e.date >= today).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const past = EVENTS.filter((e) => e.date < today).sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return (
    <section id="events" className="scroll-mt-20 px-4 py-8 sm:px-6">
      <h2 className="font-display text-xl font-semibold text-black">Events</h2>

      {upcoming.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
            Upcoming events
          </h3>
          <ul className="mt-3 space-y-3">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </ul>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
            Past events
          </h3>
          <ul className="mt-3 space-y-3">
            {past.map((event) => (
              <EventCard key={event.id} event={event} past />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function EventCard({
  event,
  past = false,
}: {
  event: (typeof EVENTS)[number];
  past?: boolean;
}) {
  const Icon = event.Icon;
  const href =
    event.href ??
    (event.register ? `/ai-workshop/events#${event.id}` : "/ai-workshop/events");
  const ctaLabel = event.ctaLabel ?? (event.register ? "Register" : "View");

  return (
    <li
      className={
        past
          ? "rounded-2xl border border-neutral-200 bg-neutral-50 p-5 opacity-80"
          : "rounded-2xl border border-neutral-200 bg-white p-5"
      }
    >
      <div className="flex gap-4">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700"
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-black">{event.title}</p>
          <p className="mt-1 text-sm text-neutral-500">
            {event.date} · {event.time}
          </p>
          <p className="mt-2 text-sm text-neutral-600">{event.desc}</p>
          <Link
            href={href}
            {...(event.href
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="mt-3 inline-block text-sm font-medium text-black hover:underline"
          >
            {ctaLabel} →
          </Link>
        </div>
      </div>
    </li>
  );
}
