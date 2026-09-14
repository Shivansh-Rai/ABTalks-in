"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  HUB_CARD_CTA_CLASS,
  HUB_CARD_HOVER_CLASS,
  HUB_HEADER_ACTION_CLASS,
} from "@/components/dashboard-hub/nav-items";
import { GUIDANCE_CATALOG } from "@/features/career-guidance/catalog";
import type { GuidanceTargeting } from "@/features/career-guidance/catalog";
import {
  cardsForFrozenIds,
  emptyGuidanceMemory,
  pickDailyPack,
  rememberPack,
  rollGuidanceMemory,
  visibleDailyCards,
} from "@/features/career-guidance/pick-daily";
import type {
  DailyCard,
  DailyCardKind,
  GuidanceItem,
  GuidanceMemory,
} from "@/features/career-guidance/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<DailyCardKind, string> = {
  cohort: "Cohort",
  hackathon: "Hackathon",
  challenge: "Challenge",
  opportunity: "Opportunity",
  mock: "Mock",
  checkin: "Check-in",
  quote: "Quote",
};

function storageKey(userId: string): string {
  return `abtalks-guidance:${userId}`;
}

function readMemory(userId: string, istDay: string): GuidanceMemory {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return emptyGuidanceMemory(istDay);
    const parsed = JSON.parse(raw) as Partial<GuidanceMemory>;
    if (typeof parsed.istDay !== "string") return emptyGuidanceMemory(istDay);
    return rollGuidanceMemory(
      {
        istDay: parsed.istDay,
        packIds: Array.isArray(parsed.packIds) ? parsed.packIds : null,
        dismissedIds: Array.isArray(parsed.dismissedIds)
          ? parsed.dismissedIds.filter((id): id is string => typeof id === "string")
          : [],
        onceSeen: Array.isArray(parsed.onceSeen)
          ? parsed.onceSeen.filter((id): id is string => typeof id === "string")
          : [],
        weeklySeen:
          parsed.weeklySeen &&
          typeof parsed.weeklySeen === "object" &&
          !Array.isArray(parsed.weeklySeen)
            ? Object.fromEntries(
                Object.entries(parsed.weeklySeen).filter(
                  (entry): entry is [string, string] => typeof entry[1] === "string",
                ),
              )
            : {},
      },
      istDay,
    );
  } catch {
    return emptyGuidanceMemory(istDay);
  }
}

function writeMemory(userId: string, memory: GuidanceMemory): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(memory));
  } catch {
    // Quota / private mode — dismissals last for this mount only.
  }
}

type CareerGuidanceDeckProps = {
  userId: string;
  istDay: string;
  istWeek: string;
  items: GuidanceItem[];
  targeting: GuidanceTargeting;
};

export function CareerGuidanceDeck({
  userId,
  istDay,
  istWeek,
  items,
  targeting,
}: CareerGuidanceDeckProps) {
  const [memory, setMemory] = useState<GuidanceMemory | null>(null);

  useEffect(() => {
    const loaded = readMemory(userId, istDay);
    const catalogById = new Map(GUIDANCE_CATALOG.map((c) => [c.id, c]));
    if (loaded.packIds !== null) {
      setMemory(loaded);
      return;
    }
    const pack = pickDailyPack({
      profileItems: items,
      catalog: GUIDANCE_CATALOG,
      targeting,
      istWeek,
      onceSeen: loaded.onceSeen,
      weeklySeen: loaded.weeklySeen,
    });
    const next = rememberPack(loaded, pack, catalogById, istWeek);
    writeMemory(userId, next);
    setMemory(next);
  }, [userId, istDay, istWeek, items, targeting]);

  const pack = useMemo(() => {
    if (!memory?.packIds) return [];
    return cardsForFrozenIds(memory.packIds, items, GUIDANCE_CATALOG);
  }, [memory, items]);

  const visible = useMemo(() => {
    if (!memory) return [];
    return visibleDailyCards(pack, memory.dismissedIds);
  }, [memory, pack]);

  const dismiss = useCallback(
    (id: string) => {
      setMemory((current) => {
        if (!current) return current;
        if (current.dismissedIds.includes(id)) return current;
        const next: GuidanceMemory = {
          ...current,
          dismissedIds: [...current.dismissedIds, id],
        };
        writeMemory(userId, next);
        return next;
      });
    },
    [userId],
  );

  if (!memory) return null;
  if (visible.length === 0) return null;

  return (
    <section
      id="career-guidance"
      className="scroll-mt-20 px-4 py-8 sm:px-6 lg:ml-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold uppercase text-[#03535F]">
          Career Guidance
        </h2>
        <Link
          href="/dashboard/career-guidance"
          className={HUB_HEADER_ACTION_CLASS}
        >
          View all guidance
        </Link>
      </div>
      <ul className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory 2xl:grid 2xl:grid-cols-3 2xl:overflow-visible 2xl:pb-0 2xl:snap-none">
        {visible.map((card) => (
          <DailyCardView key={card.id} card={card} onDismiss={dismiss} />
        ))}
      </ul>
    </section>
  );
}

function DailyCardView({
  card,
  onDismiss,
}: {
  card: DailyCard;
  onDismiss: (id: string) => void;
}) {
  return (
    <li
      className={cn(
        "relative flex w-[min(100%,320px)] shrink-0 snap-start flex-col justify-between rounded-2xl border border-[#E0E0E0] bg-white p-5 sm:w-[300px] 2xl:w-full 2xl:max-w-none 2xl:shrink",
        HUB_CARD_HOVER_CLASS,
      )}
    >
      <button
        type="button"
        aria-label={`Dismiss ${card.title}`}
        onClick={() => onDismiss(card.id)}
        className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-lg text-[#8F8F8F] transition-colors hover:bg-[#EEF6F6] hover:text-[#03535F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F]"
      >
        <X className="size-4" strokeWidth={2} aria-hidden />
      </button>
      <div className="min-h-0 pr-8">
        <span className="inline-flex rounded-[4px] border border-[#03535F]/40 bg-[#EEF6F6] px-2 py-0.5 text-[11px] font-semibold text-[#03535F]">
          {KIND_LABEL[card.kind]}
        </span>
        <p className="mt-2 font-inter font-bold text-black">{card.title}</p>
        <p className="mt-1 text-sm text-[#4B4B4B]">{card.body}</p>
      </div>
      {card.ctaLabel ? (
        card.href ? (
          <Link
            href={card.href}
            className={cn(HUB_CARD_CTA_CLASS, "mt-2 self-end")}
          >
            {card.ctaLabel}
          </Link>
        ) : (
          <button
            type="button"
            className={cn(HUB_CARD_CTA_CLASS, "mt-2 self-end")}
            onClick={() => onDismiss(card.id)}
          >
            {card.ctaLabel}
          </button>
        )
      ) : null}
    </li>
  );
}
