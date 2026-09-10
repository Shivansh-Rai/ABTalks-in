"use client";

import { useId } from "react";
import { AvatarEditor } from "./avatar-editor";

const RING_R = 48.5;
const RING_C = 2 * Math.PI * RING_R;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

/**
 * The clay progress ring, the avatar in its well, the photo pencil and the
 * completion tick. In the design these live in the report card hero, so this
 * is one component rather than markup inlined into the card.
 */
export function IdentityMedia({
  score,
  fullName,
  imageUrl,
  celebrate,
  avatarUploadEnabled,
}: {
  score: number;
  fullName: string;
  imageUrl: string | null;
  celebrate: boolean;
  avatarUploadEnabled: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const gradId = `pw-clayRingGrad-${uid}`;
  const ringId = `pw-clayRing-${uid}`;
  const trackId = `pw-clayTrack-${uid}`;
  const offset = RING_C * (1 - score / 100);
  const complete = score === 100;

  return (
    <div className="pw-rv-media-slot">
      <div
        className={`pw-ring-wrap${celebrate ? " pw-celebrate" : ""}`}
        style={{
          ["--pw-filter-ring" as string]: `url(#${ringId})`,
          ["--pw-filter-track" as string]: `url(#${trackId})`,
          ["--pw-ring-stroke" as string]: `url(#${gradId})`,
        }}
      >
        <svg className="pw-ring" viewBox="0 0 112 112" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8CEE93" />
              <stop offset="45%" stopColor="#4CD46C" />
              <stop offset="100%" stopColor="#22A94F" />
            </linearGradient>
            <filter id={ringId} x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow
                dx="0.8"
                dy="1.3"
                stdDeviation="1.2"
                floodColor="#199247"
                floodOpacity="0.26"
              />
              <feDropShadow
                dx="-0.7"
                dy="-0.8"
                stdDeviation="0.9"
                floodColor="#FFFFFF"
                floodOpacity="0.5"
              />
            </filter>
            <filter id={trackId} x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="0.9"
                floodColor="#B9BCB6"
                floodOpacity="0.32"
              />
              <feDropShadow
                dx="0"
                dy="-0.8"
                stdDeviation="0.8"
                floodColor="#FFFFFF"
                floodOpacity="0.6"
              />
            </filter>
          </defs>
          <circle className="pw-ring-bg" cx="56" cy="56" r={RING_R} />
          <circle
            className="pw-ring-fg"
            cx="56"
            cy="56"
            r={RING_R}
            style={{ strokeDasharray: RING_C, strokeDashoffset: offset }}
          />
        </svg>

        <div className="pw-avatar pw-lg">
          {imageUrl ? (
            // Avatar URLs are user-supplied remotes; next/image is not
            // configured for arbitrary hosts here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" aria-hidden />
          ) : (
            <span aria-hidden>{initials(fullName)}</span>
          )}
        </div>
        {avatarUploadEnabled ? <AvatarEditor /> : null}

        <div
          className={`pw-ring-check${complete ? " pw-show" : ""}`}
          aria-hidden
        >
          <svg viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
