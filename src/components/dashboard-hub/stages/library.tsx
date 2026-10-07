"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Blocks, Bot, ChevronLeft, ChevronRight, Code2, Network, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/* Netflix-style library: two rows on a dark stage, each a horizontally
   scrolling strip of tiles with edge arrows. Data is plain so it can cross
   the server → client boundary; icons and art are picked here. */

export type LibraryArt = "snowflake" | "databricks" | "ai" | "se" | "ds" | "claude" | "hackathon" | "cohort";

export type LibraryItem = {
  key: string;
  kicker: string;
  title: string;
  blurb: string;
  href: string;
  cta: string;
  art: LibraryArt;
  days: number | null;
  daysLabel: string;
  modules: number | null;
  /** Small callout pinned to the art, e.g. "2 options available". */
  badge?: string;
  /** When set, clicking the tile opens a chooser of these instead of `href`. */
  options?: { label: string; href: string }[];
};

/** Tile artwork: 16:9 covers (1280×720 WebP) that fill the tile. `light`
 *  covers get a white fade + dark title; dark ones a dark fade + white title. */
const ART: Partial<Record<LibraryArt, { src: string; light: boolean }>> = {
  snowflake: { src: "/dashboard/cover-snowflake.webp", light: true },
  databricks: { src: "/dashboard/cover-databricks.webp", light: true },
  cohort: { src: "/dashboard/cover-ai.webp", light: true },
  ai: { src: "/dashboard/cover-ai.webp", light: true },
  se: { src: "/dashboard/cover-se.webp", light: true },
  ds: { src: "/dashboard/cover-ds.webp", light: true },
  claude: { src: "/dashboard/cover-claude.webp", light: true },
};

const ICON: Record<LibraryArt, typeof Code2> = {
  snowflake: Blocks,
  databricks: Blocks,
  ai: Network,
  se: Code2,
  ds: BarChart3,
  claude: Sparkles,
  hackathon: Zap,
  cohort: Bot,
};

const ROWS = {
  job: {
    title: "Get job-ready, fast",
    sub: "Mentor-led cohorts on the tools employers hire for — finish with a project recruiters can see.",
  },
  personal: {
    title: "Level up, one day at a time",
    sub: "Self-paced challenges and hackathons that build the habit of shipping.",
  },
} as const;

export function Library({ cohorts, challenges }: { cohorts: LibraryItem[]; challenges: LibraryItem[] }) {
  return (
    <section id="events" className="scroll-mt-24 pt-2">
      <Row id="prep-kit" row={ROWS.job} items={cohorts} />
      <Row id="domains-library" row={ROWS.personal} items={challenges} />
    </section>
  );
}

/* A Netflix-style row. The strip is clipped horizontally but not
   vertically (overflow-x: clip), so a hovered tile can grow past the row
   and drop its details over whatever is below. Paging moves the strip
   with a transform; on touch screens it falls back to native scrolling. */
function Row({ id, row, items }: { id: string; row: (typeof ROWS)[keyof typeof ROWS]; items: LibraryItem[] }) {
  const frame = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLUListElement>(null);
  const [offset, setOffset] = useState(0);

  const page = (dir: 1 | -1) => {
    const f = frame.current;
    const st = strip.current;
    if (!f || !st) return;
    const max = Math.max(0, st.scrollWidth - f.clientWidth);
    setOffset((o) => Math.min(max, Math.max(0, o + dir * f.clientWidth * 0.85)));
  };

  if (items.length === 0) return null;
  return (
    <div id={id} className="lib-row group/row mt-8 scroll-mt-24 first:mt-0">
      <h4 className="font-heading text-xl font-bold text-black sm:text-2xl">{row.title}</h4>
      <p className="mt-0.5 text-sm text-[#6B7280]">{row.sub}</p>
      <div ref={frame} className="lib-frame relative -mx-3 mt-4 sm:-mx-5 lg:-mx-8">
        <ul
          ref={strip}
          className="lib-strip flex gap-4 px-3 py-3 transition-transform duration-500 ease-out sm:px-5 lg:px-8"
          style={{ ["--lib-offset" as string]: `-${offset}px` }}
        >
          {items.map((it) => (
            <Tile key={it.key} item={it} />
          ))}
        </ul>
        {offset > 0 ? <EdgeButton side="left" onClick={() => page(-1)} /> : null}
        <EdgeButton side="right" onClick={() => page(1)} />
      </div>
    </div>
  );
}

function EdgeButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        "lib-edge absolute inset-y-3 z-40 hidden w-12 items-center justify-center text-[#03535F] opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100",
        side === "left"
          ? "left-0 bg-[linear-gradient(90deg,#F4F4F4_35%,rgba(244,244,244,0))]"
          : "right-0 bg-[linear-gradient(270deg,#F4F4F4_35%,rgba(244,244,244,0))]",
      )}
    >
      <Icon className="size-8" aria-hidden="true" />
    </button>
  );
}

const TILE_CLASS = "lib-tile relative w-[240px] shrink-0 sm:w-[270px]";
const CARD_CLASS =
  "lib-tile__card block rounded-xl bg-white shadow-[0_10px_24px_-16px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03535F]";
const CTA_CLASS =
  "inline-flex h-7 items-center gap-1 rounded-full bg-[#03535F] px-3 text-[11px] font-bold text-white shadow-[inset_0_-3px_8px_rgba(0,0,0,0.22)]";

/* At rest: artwork only. On hover/focus the tile grows (1.3x) and its
   details drop in beneath the image. */
function Tile({ item }: { item: LibraryItem }) {
  if (item.options?.length) return <ChooserTile item={item} options={item.options} />;
  return (
    <li className={TILE_CLASS}>
      <Link href={item.href} aria-label={item.title} className={CARD_CLASS}>
        <TileFace
          item={item}
          cta={
            <span className={cn(CTA_CLASS, "mt-2.5")}>
              {item.cta} <ArrowRight className="size-3" aria-hidden="true" />
            </span>
          }
        />
      </Link>
    </li>
  );
}

/* A tile that stands for more than one program: clicking it opens a small
   box above its button listing them, and each entry opens that program.
   The card takes focus on click so the tile stays grown while the box is
   open (the hover rules also match :focus-within). */
function ChooserTile({ item, options }: { item: LibraryItem; options: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLLIElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <li ref={root} className={TILE_CLASS}>
      <div tabIndex={-1} onClick={() => setOpen((o) => !o)} className={cn(CARD_CLASS, "cursor-pointer")}>
        <TileFace
          item={item}
          cta={
            <span className="relative mt-2.5 inline-block">
              <button
                type="button"
                aria-label={`${item.title}: choose a program`}
                aria-haspopup="true"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((o) => !o);
                }}
                className={cn(CTA_CLASS, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03535F] focus-visible:ring-offset-1")}
              >
                {item.cta} <ArrowRight className="size-3" aria-hidden="true" />
              </button>
              {open ? (
                <div
                  id={menuId}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full left-0 z-50 mb-2 w-[190px] rounded-lg bg-white p-1 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
                >
                  {options.map((o) => (
                    <Link
                      key={o.href}
                      href={o.href}
                      className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[12px] font-semibold text-[#1F1F1F] hover:bg-[#03535F]/10 focus-visible:bg-[#03535F]/10 focus-visible:outline-none"
                    >
                      {o.label}
                      <ArrowRight className="size-3 shrink-0 text-[#03535F]" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ) : null}
            </span>
          }
        />
      </div>
    </li>
  );
}

function TileFace({ item, cta }: { item: LibraryItem; cta: ReactNode }) {
  const art = ART[item.art];
  const Icon = ICON[item.art];
  const meta = [
    item.days !== null ? `${item.days} days` : null,
    item.modules !== null ? `${item.modules} modules` : null,
    item.kicker,
  ].filter(Boolean);
  return (
    <>
      <div className={cn("lib-tile__img relative aspect-[16/9] overflow-hidden rounded-xl", (art?.light ?? true) ? "bg-white" : "bg-[#0A0F12]")}>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element -- static tile art
          <img
            src={art.src}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <GlossyArt Icon={Icon} tint={TINT[item.art]} />
        )}
        {item.badge ? (
          <span className="absolute right-2.5 top-2.5 z-10 inline-flex items-center rounded-full bg-[#E5E7EB] px-2 py-0.5 text-[10px] font-medium text-black">
            {item.badge}
          </span>
        ) : null}
        {/* Title on the art, bottom-left, over a soft dark fade. */}
        <div
          className={cn(
            "lib-tile__name pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-8",
            (art?.light ?? true)
              ? "bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.95)_75%)]"
              : "bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.72)_100%)]",
          )}
        >
          <p
            className={cn(
              "truncate font-heading text-[15px] font-bold leading-tight",
              (art?.light ?? true) ? "text-[#1F1F1F]" : "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
            )}
          >
            {item.title}
          </p>
        </div>
      </div>
      <div className="lib-tile__details rounded-b-xl bg-white px-3.5 pb-3.5 pt-3 text-black">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#03535F]">{item.kicker}</p>
        <p className="mt-0.5 truncate font-heading text-[15px] font-bold leading-tight">{item.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-[#6B7280]">
          {meta.map((m, i) => (
            <span key={m} className="flex items-center gap-1.5">
              {i > 0 ? <span className="size-1 rounded-full bg-[#C4CACA]" aria-hidden="true" /> : null}
              {m}
            </span>
          ))}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-[#4B4B4B]">{item.blurb}</p>
        {cta}
      </div>
    </>
  );
}

/* Artwork for items without an image, in the same language as the
   Snowflake / Databricks art: a pale wash, soft diagonal bars, and a
   glossy 3D-looking icon with depth and a highlight. */
const TINT: Record<LibraryArt, { from: string; to: string; bar: string; glow: string }> = {
  snowflake: { from: "#7CC8FF", to: "#1E88E5", bar: "rgba(90,170,255,0.18)", glow: "rgba(30,136,229,0.35)" },
  databricks: { from: "#FF8A7A", to: "#E53935", bar: "rgba(255,120,110,0.18)", glow: "rgba(229,57,53,0.35)" },
  ai: { from: "#6FE3D8", to: "#0B8C94", bar: "rgba(30,180,180,0.10)", glow: "rgba(11,140,148,0.35)" },
  cohort: { from: "#6FE3D8", to: "#0B8C94", bar: "rgba(30,180,180,0.10)", glow: "rgba(11,140,148,0.35)" },
  se: { from: "#9FA8FF", to: "#4B55D6", bar: "rgba(110,120,255,0.16)", glow: "rgba(75,85,214,0.35)" },
  ds: { from: "#FFC870", to: "#E08A00", bar: "rgba(255,190,90,0.18)", glow: "rgba(224,138,0,0.35)" },
  claude: { from: "#FFB38A", to: "#D9652B", bar: "rgba(255,160,110,0.18)", glow: "rgba(217,101,43,0.35)" },
  hackathon: { from: "#C89BFF", to: "#7B3FE4", bar: "rgba(170,120,255,0.16)", glow: "rgba(123,63,228,0.35)" },
};

function GlossyArt({ Icon, tint }: { Icon: typeof Code2; tint: (typeof TINT)[LibraryArt] }) {
  const id = `gloss-${tint.to.slice(1)}`;
  return (
    <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(160deg,#FFFFFF_0%,#F3F7F9_100%)]" aria-hidden="true">
      {/* Soft diagonal bars, like the stripes behind the 3D logos */}
      <span className="absolute -left-6 top-6 h-8 w-[160%] -rotate-[38deg]" style={{ background: tint.bar }} />
      <span className="absolute -left-10 bottom-8 h-6 w-[160%] -rotate-[38deg]" style={{ background: tint.bar }} />
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tint.from} />
            <stop offset="1" stopColor={tint.to} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Depth copy underneath, then the lit face with a highlight */}
        <Icon className="absolute size-[92px] translate-x-[3px] translate-y-[5px] opacity-50" style={{ color: tint.to }} strokeWidth={3.2} />
        <Icon
          className="relative size-[92px]"
          style={{ color: `url(#${id})`, stroke: `url(#${id})`, filter: `drop-shadow(0 8px 12px ${tint.glow})` }}
          strokeWidth={3.2}
        />
      </div>
    </div>
  );
}

