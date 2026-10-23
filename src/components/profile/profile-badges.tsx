"use client";

import Link from "next/link";
import type { BadgesState } from "@/features/badges/types";
import { BadgeTrigger } from "@/components/badges/badge-trigger";

/** How many medallions the Quick Links preview shows before "+N". */
const PREVIEW_LIMIT = 5;

const EARN_HINT =
  "Finish a challenge or cohort, or submit work 30 days in a row.";

function AwardIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

/**
 * Quick Links box: a compact preview of earned badges, the count, and the way
 * to the full collection on /achievements#badges. Lives where Profile
 * performance used to be.
 */
export function QuickLinksBadges({ badges }: { badges: BadgesState }) {
  const list = badges.ok ? badges.badges : [];
  const extra = list.length - PREVIEW_LIMIT;

  return (
    <section className="pw-badges-box" aria-labelledby="pw-badges-box-title">
      <div className="pw-badges-box-head">
        <span id="pw-badges-box-title" className="pw-badges-box-title">
          Earned Badges
        </span>
        <Link href="/achievements#badges" className="pw-badges-box-link">
          View all
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </Link>
      </div>

      {!badges.ok ? (
        <p className="pw-badges-box-note">
          Badges couldn&apos;t load right now. Refresh to try again.
        </p>
      ) : list.length === 0 ? (
        <p className="pw-badges-box-note">No badges yet. {EARN_HINT}</p>
      ) : (
        <ul className="pw-badges-box-row">
          {list.slice(0, PREVIEW_LIMIT).map((badge) => (
            <li key={badge.key}>
              <BadgeTrigger badge={badge} variant="icon" size={42} />
            </li>
          ))}
          {extra > 0 ? (
            <li>
              <Link
                href="/achievements#badges"
                className="pw-badges-box-more"
                aria-label={`${extra} more badges`}
              >
                +{extra}
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

/**
 * Profile "Achievements & Badges" card, under the section cards. Earned
 * badges only; each one opens its detail (description, criteria, date).
 */
export function ProfileBadgesCard({ badges }: { badges: BadgesState }) {
  const list = badges.ok ? badges.badges : [];

  return (
    <section
      id="profile-badges"
      className="pw-badges-card"
      aria-labelledby="pw-badges-card-title"
    >
      <div className="pw-rv-card-head">
        <span className="pw-rv-ico" aria-hidden>
          <AwardIcon />
        </span>
        <div className="pw-rv-card-copy">
          <h3 id="pw-badges-card-title">Earned Badges</h3>
        </div>
        {list.length > 0 ? <span className="pw-rv-count">{list.length}</span> : null}
        <Link href="/achievements#badges" className="pw-badges-card-link">
          View all
        </Link>
      </div>

      {!badges.ok ? (
        <p className="pw-rv-empty">
          Badges couldn&apos;t load right now. Refresh the page to try again.
        </p>
      ) : list.length === 0 ? (
        <div className="pw-badges-empty">
          <span className="pw-badges-empty-ico" aria-hidden>
            <AwardIcon />
          </span>
          <div>
            <p className="pw-badges-empty-title">No badges yet</p>
            <p className="pw-badges-empty-sub">{EARN_HINT}</p>
          </div>
        </div>
      ) : (
        <ul className="pw-badges-grid">
          {list.map((badge) => (
            <li key={badge.key}>
              <BadgeTrigger badge={badge} variant="tile" size={72} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
