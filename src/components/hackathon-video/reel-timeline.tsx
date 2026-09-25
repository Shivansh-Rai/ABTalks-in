"use client";

import { useEffect, useState } from "react";

type Mark = {
  label: string;
  title: string;
  body: string;
  /** Timestamp position on the track, 0..1. */
  atPct: number;
};

type Props = {
  kickoffUtc: string;
  deadlineUtc: string;
  marks: Mark[];
};

/**
 * Event schedule drawn as a video editing timeline — a horizontal track with
 * a scrubber head that moves in real time. Before kickoff the scrubber sits
 * at 0%; during the event it advances proportionally; after the deadline
 * it pins at 100%.
 *
 * The four labeled marks (Kickoff / Midpoint / Deadline / Results) live
 * below the track and never depend on the scrubber's animation frame.
 */
export function ReelTimeline({ kickoffUtc, deadlineUtc, marks }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    // The scrubber moves imperceptibly per second — a slower tick keeps the
    // battery kind. 30s is plenty; the CSS transition smooths the jump.
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const kickoff = new Date(kickoffUtc).getTime();
  const deadline = new Date(deadlineUtc).getTime();
  const total = Math.max(1, deadline - kickoff);
  const rawProgress = now == null ? 0 : (now - kickoff) / total;
  const progress = Math.min(1, Math.max(0, rawProgress));
  const scrubberLeft = `${(progress * 100).toFixed(2)}%`;

  return (
    <div className="vt-timeline">
      <div className="vt-timeline__track" aria-hidden>
        <div className="vt-timeline__strip" />
        <div className="vt-timeline__scrubber" style={{ left: scrubberLeft }} />
      </div>
      <ol className="vt-timeline__marks">
        {marks.map((m) => (
          <li key={m.title} className="vt-mark">
            <span className="vt-mark__label">{m.label}</span>
            <span className="vt-mark__title">{m.title}</span>
            <span className="vt-mark__body">{m.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
