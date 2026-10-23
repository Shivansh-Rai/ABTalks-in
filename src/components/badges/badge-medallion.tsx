"use client";

import { useId, type ReactNode } from "react";
import {
  BarChart3,
  Braces,
  BrainCircuit,
  Code2,
  DraftingCompass,
  Flame,
  Link2,
  Sparkles,
} from "lucide-react";
import type { BadgeMark, EarnedBadge } from "@/features/badges/types";
import { cn } from "@/lib/utils";

/**
 * Badge artwork, one SVG per badge. Three shapes keep the families apart at a
 * glance:
 *   challenge   → faceted hexagon, accent per track, "60 DAYS" tab
 *   cohort      → polished round medal with the cohort's logo and a day ribbon
 *   consistency → shield with a flame; bronze 30 → silver 60 → gold 100,
 *                 each tier adding rings, rays and stars
 *
 * Gradient and clip ids come from `useId`, so they are unique per rendered
 * medallion. They must be: the same badge renders in several places (Quick
 * Links, the profile card, the detail dialog), and when ids were shared, a
 * copy inside a hidden container (Quick Links is display:none below 1024px)
 * owned the definition. Browsers do not paint gradients defined inside a
 * display:none SVG, so every other copy rendered with no fill.
 */

type Accent = { light: string; mid: string; deep: string; ink: string };

const CHALLENGE_ACCENT: Record<"claude" | "ai" | "ds" | "se", Accent> = {
  claude: { light: "#F6B48F", mid: "#D97757", deep: "#7A2E14", ink: "#FFF4EC" },
  ai: { light: "#5EE0D2", mid: "#0B8A93", deep: "#033F48", ink: "#E9FFFC" },
  ds: { light: "#A5B4FC", mid: "#5B5FD6", deep: "#23246B", ink: "#EEF0FF" },
  se: { light: "#6EE7B7", mid: "#13906A", deep: "#064532", ink: "#EAFFF6" },
};

const COHORT_BRAND: Record<string, { color: string; text: string }> = {
  "ai-cohort": { color: "#03535F", text: "#FFFFFF" },
  databricks: { color: "#FF3621", text: "#FFFFFF" },
  snowflake: { color: "#29B5E8", text: "#FFFFFF" },
  langchain: { color: "#1C3C3C", text: "#FFFFFF" },
  powerbi: { color: "#F2C811", text: "#2B2300" },
  "ds-architect": { color: "#4F46E5", text: "#FFFFFF" },
  "coding-practice": { color: "#0F766E", text: "#FFFFFF" },
};

const STREAK_TIER: Record<1 | 2 | 3, Accent & { glow: string }> = {
  1: { light: "#F3C29A", mid: "#C47A43", deep: "#5B3014", ink: "#FFF3E8", glow: "#E9A36A" },
  2: { light: "#F4F7FB", mid: "#9AA9BE", deep: "#2B3647", ink: "#F5F8FC", glow: "#B9C7DA" },
  3: { light: "#FFE9A3", mid: "#E2A72E", deep: "#5A3A00", ink: "#FFF8E1", glow: "#FFD25E" },
};

const HEX_OUTER = "50,3 90.7,26.5 90.7,73.5 50,97 9.3,73.5 9.3,26.5";
const HEX_INNER = "50,12 82.9,31 82.9,69 50,88 17.1,69 17.1,31";
const SHIELD =
  "M50 3 L89 15 V47 C89 72 71 88 50 97 C29 88 11 72 11 47 V15 Z";
const SHIELD_INNER =
  "M50 12 L81 21.5 V47 C81 67 67 80 50 88 C33 80 19 67 19 47 V21.5 Z";

type ArtProps = {
  badge: EarnedBadge;
  uid: string;
  /**
   * Below COMPACT_BELOW px the small print (the "DAYS" labels) is noise, not
   * information: it is dropped and the main mark is enlarged instead. Shape,
   * colour, logo, ribbon and the consistency number stay.
   */
  compact: boolean;
};

/** Rendered size under which a medallion switches to its compact drawing. */
const COMPACT_BELOW = 48;

function gid(uid: string, part: string) {
  return `bdg-${uid}-${part}`;
}

/** A lucide glyph placed inside the 100×100 artboard. */
function Glyph({
  icon: Icon,
  x,
  y,
  size,
  color,
}: {
  icon: typeof Flame;
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  return (
    <Icon
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      color={color}
      strokeWidth={1.9}
      aria-hidden
    />
  );
}

/** The Claude mark: a code bracket pair with a spark — AI-assisted building. */
function ClaudeGlyph({ color }: { color: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M38 38 L29 50 L38 62" />
      <path d="M62 38 L71 50 L62 62" />
      <path
        d="M50 37 L52.6 46.4 L62 49 L52.6 51.6 L50 61 L47.4 51.6 L38 49 L47.4 46.4 Z"
        fill={color}
        stroke="none"
      />
    </g>
  );
}

function Shine({ clip }: { clip: string }) {
  return (
    <g clipPath={`url(#${clip})`} className="bdg-shine-wrap" aria-hidden>
      <rect
        className="bdg-shine"
        x="-40"
        y="-10"
        width="26"
        height="130"
        fill="#FFFFFF"
      />
    </g>
  );
}

function ChallengeArt({ badge, uid, compact }: ArtProps) {
  const mark = (["claude", "ai", "ds", "se"] as const).includes(
    badge.mark as "claude",
  )
    ? (badge.mark as "claude" | "ai" | "ds" | "se")
    : "ai";
  const a = CHALLENGE_ACCENT[mark];
  const frame = gid(uid, "frame");
  const face = gid(uid, "face");
  const clip = gid(uid, "clip");
  const icon: Record<"ai" | "ds" | "se", typeof Flame> = {
    ai: BrainCircuit,
    ds: BarChart3,
    se: Code2,
  };
  return (
    <>
      <defs>
        <linearGradient id={frame} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a.light} />
          <stop offset="0.5" stopColor={a.mid} />
          <stop offset="1" stopColor={a.deep} />
        </linearGradient>
        <radialGradient id={face} cx="0.35" cy="0.28" r="0.85">
          <stop offset="0" stopColor={a.mid} />
          <stop offset="1" stopColor={a.deep} />
        </radialGradient>
        <clipPath id={clip}>
          <polygon points={HEX_OUTER} />
        </clipPath>
      </defs>
      <polygon points={HEX_OUTER} fill={`url(#${frame})`} />
      <polygon points={HEX_INNER} fill={`url(#${face})`} />
      <polygon
        points={HEX_INNER}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.35"
        strokeWidth="1.2"
      />
      {/* facet highlight on the upper-left planes */}
      <path d="M50 12 L17.1 31 L17.1 50 L50 50 Z" fill="#FFFFFF" opacity="0.08" />
      {mark === "claude" ? (
        <g
          transform={
            compact ? "translate(50 50) scale(1.25) translate(-50 -50)" : undefined
          }
        >
          <ClaudeGlyph color={a.ink} />
        </g>
      ) : (
        <Glyph
          icon={icon[mark]}
          x={50}
          y={compact ? 50 : 46}
          size={compact ? 38 : 30}
          color={a.ink}
        />
      )}
      <Shine clip={clip} />
      {compact ? null : (
        <g>
          <rect x="26" y="72.5" width="48" height="14" rx="7" fill="#FFFFFF" />
          <text
            x="50"
            y="82.2"
            textAnchor="middle"
            fontSize="7.6"
            fontWeight="800"
            letterSpacing="0.4"
            fill={a.deep}
            fontFamily="var(--font-inter), system-ui, sans-serif"
          >
            {badge.figure} DAYS
          </text>
        </g>
      )}
    </>
  );
}

function CohortLogo({ mark, color }: { mark: BadgeMark; color: string }) {
  if (mark === "databricks" || mark === "snowflake") {
    return (
      <image
        href={`/company-logos/${mark}.svg`}
        x="32"
        y="25"
        width="36"
        height="36"
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }
  if (mark === "powerbi") {
    return (
      <g aria-hidden>
        <rect x="35" y="40" width="8" height="18" rx="2" fill="#F2C811" opacity="0.65" />
        <rect x="46" y="33" width="8" height="25" rx="2" fill="#E6B400" opacity="0.85" />
        <rect x="57" y="26" width="8" height="32" rx="2" fill="#C99A00" />
      </g>
    );
  }
  const icon: Record<string, typeof Flame> = {
    "ai-cohort": Sparkles,
    langchain: Link2,
    "ds-architect": DraftingCompass,
    "coding-practice": Braces,
  };
  return <Glyph icon={icon[mark] ?? Sparkles} x={50} y={43} size={30} color={color} />;
}

function CohortArt({ badge, uid, compact }: ArtProps) {
  const brand = COHORT_BRAND[badge.mark] ?? COHORT_BRAND["ai-cohort"]!;
  const ring = gid(uid, "ring");
  const disc = gid(uid, "disc");
  const clip = gid(uid, "clip");
  return (
    <>
      <defs>
        <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.3" stopColor="#C9D9DC" />
          <stop offset="0.55" stopColor="#F4F8F9" />
          <stop offset="0.8" stopColor="#8EA9AE" />
          <stop offset="1" stopColor="#DCE7E9" />
        </linearGradient>
        <radialGradient id={disc} cx="0.5" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor={brand.color} stopOpacity="0.14" />
        </radialGradient>
        <clipPath id={clip}>
          <circle cx="50" cy="48" r="45" />
        </clipPath>
      </defs>
      <circle cx="50" cy="48" r="45" fill={`url(#${ring})`} />
      <circle cx="50" cy="48" r="45" fill="none" stroke="#7E9AA0" strokeOpacity="0.45" strokeWidth="1" />
      <circle cx="50" cy="48" r="37" fill={`url(#${disc})`} />
      <circle cx="50" cy="48" r="37" fill="none" stroke={brand.color} strokeOpacity="0.55" strokeWidth="1.6" />
      {/* tick marks around the rim, like a minted medal */}
      <g stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1.1">
        {Array.from({ length: 24 }, (_, i) => {
          const t = (i / 24) * Math.PI * 2;
          const r1 = 40.5;
          const r2 = 43;
          return (
            <line
              key={i}
              x1={50 + r1 * Math.cos(t)}
              y1={48 + r1 * Math.sin(t)}
              x2={50 + r2 * Math.cos(t)}
              y2={48 + r2 * Math.sin(t)}
            />
          );
        })}
      </g>
      <CohortLogo mark={badge.mark} color={brand.color} />
      <Shine clip={clip} />
      {badge.figure ? (
        <g>
          <path
            d="M20 70 H80 L86 77 L80 84 H20 L14 77 Z"
            fill={brand.color}
          />
          <path d="M14 77 L20 84 V88 Z" fill="#000000" opacity="0.25" />
          <path d="M86 77 L80 84 V88 Z" fill="#000000" opacity="0.25" />
          {compact ? null : (
            <text
              x="50"
              y="80.6"
              textAnchor="middle"
              fontSize="9"
              fontWeight="800"
              letterSpacing="0.6"
              fill={brand.text}
              fontFamily="var(--font-inter), system-ui, sans-serif"
            >
              {badge.figure} DAYS
            </text>
          )}
        </g>
      ) : null}
    </>
  );
}

function ConsistencyArt({ badge, uid, compact }: ArtProps) {
  const tier = badge.tier ?? 1;
  const a = STREAK_TIER[tier];
  const metal = gid(uid, "metal");
  const face = gid(uid, "face");
  const clip = gid(uid, "clip");
  return (
    <>
      <defs>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a.light} />
          <stop offset="0.45" stopColor={a.mid} />
          <stop offset="0.7" stopColor={a.light} />
          <stop offset="1" stopColor={a.mid} />
        </linearGradient>
        <radialGradient id={face} cx="0.5" cy="0.25" r="0.9">
          <stop offset="0" stopColor={a.mid} />
          <stop offset="1" stopColor={a.deep} />
        </radialGradient>
        <clipPath id={clip}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      {tier === 3 ? (
        <g stroke={a.glow} strokeWidth="2.2" strokeLinecap="round" opacity="0.9">
          {Array.from({ length: 12 }, (_, i) => {
            const t = (i / 12) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={50 + 46 * Math.cos(t)}
                y1={50 + 46 * Math.sin(t)}
                x2={50 + 50 * Math.cos(t)}
                y2={50 + 50 * Math.sin(t)}
              />
            );
          })}
        </g>
      ) : null}
      <path d={SHIELD} fill={`url(#${metal})`} />
      <path d={SHIELD_INNER} fill={`url(#${face})`} />
      {tier >= 2 ? (
        <path
          d={SHIELD_INNER}
          fill="none"
          stroke={a.light}
          strokeOpacity="0.7"
          strokeWidth="1.4"
          transform="translate(50 50) scale(0.9) translate(-50 -50)"
        />
      ) : null}
      <Glyph icon={Flame} x={50} y={compact ? 32 : 36} size={compact ? 20 : 22} color={a.ink} />
      <text
        x="50"
        y={compact ? 71 : 66}
        textAnchor="middle"
        fontSize={
          compact
            ? badge.figure.length > 2 ? 27 : 32
            : badge.figure.length > 2 ? 21 : 24
        }
        fontWeight="900"
        fill={a.ink}
        fontFamily="var(--font-outfit), var(--font-inter), system-ui, sans-serif"
      >
        {badge.figure}
      </text>
      {compact ? null : (
        <text
          x="50"
          y="77"
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="800"
          letterSpacing="1.2"
          fill={a.ink}
          opacity="0.85"
          fontFamily="var(--font-inter), system-ui, sans-serif"
        >
          DAYS
        </text>
      )}
      {tier === 3 ? (
        <g fill={a.glow}>
          <path d="M22 22 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6Z" />
          <path d="M78 22 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6Z" />
        </g>
      ) : null}
      <Shine clip={clip} />
    </>
  );
}

export function BadgeMedallion({
  badge,
  size = 72,
  className,
}: {
  badge: EarnedBadge;
  /** Rendered pixel size (square). */
  size?: number;
  className?: string;
}) {
  // ":r1:" style ids are not valid in url(#…) references; keep [A-Za-z0-9_-].
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const props: ArtProps = { badge, uid, compact: size < COMPACT_BELOW };
  let art: ReactNode;
  if (badge.family === "challenge") art = <ChallengeArt {...props} />;
  else if (badge.family === "cohort") art = <CohortArt {...props} />;
  else art = <ConsistencyArt {...props} />;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn(
        "bdg-medallion",
        badge.family === "consistency" && badge.tier === 3 && "bdg-glow-gold",
        className,
      )}
      role="img"
      aria-label={`${badge.title}: ${badge.context}`}
    >
      {art}
    </svg>
  );
}
