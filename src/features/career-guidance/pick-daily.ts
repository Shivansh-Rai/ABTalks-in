/**
 * Daily Career Guidance pack (plan 144).
 *
 * Pure. Builds at most DAILY_CAP cards: profile recs first, then at most
 * one check-in and one quote from the catalog. Does not backfill — the
 * caller freezes pack ids for the IST day and only filters dismissals.
 */

import {
  catalogWhenMatches,
  type CatalogItem,
  type GuidanceTargeting,
} from "./catalog";
import { DAILY_CAP, type DailyCard, type GuidanceItem, type GuidanceMemory } from "./types";

export type PickDailyInput = {
  profileItems: GuidanceItem[];
  catalog: CatalogItem[];
  targeting: GuidanceTargeting;
  istWeek: string;
  onceSeen: string[];
  weeklySeen: Record<string, string>;
};

function cadenceOk(
  item: CatalogItem,
  istWeek: string,
  onceSeen: Set<string>,
  weeklySeen: Record<string, string>,
): boolean {
  if (item.cadence === "once") return !onceSeen.has(item.id);
  if (item.cadence === "weekly") return weeklySeen[item.id] !== istWeek;
  return true;
}

function profileToCard(item: GuidanceItem): DailyCard {
  return {
    id: item.id,
    source: "profile",
    kind: item.kind,
    title: item.title,
    body: item.because,
    ctaLabel: item.cta,
    href: item.href,
  };
}

function catalogToCard(item: CatalogItem): DailyCard {
  return {
    id: item.id,
    source: "catalog",
    kind: item.kind,
    title: item.title,
    body: item.body,
    ctaLabel: item.ctaLabel ?? null,
    href: item.href ?? null,
  };
}

export function pickDailyPack(input: PickDailyInput): DailyCard[] {
  const onceSeen = new Set(input.onceSeen);
  const pack: DailyCard[] = [];

  for (const item of input.profileItems) {
    if (pack.length >= DAILY_CAP) break;
    pack.push(profileToCard(item));
  }

  if (pack.length >= DAILY_CAP) return pack;

  const eligible = input.catalog.filter(
    (item) =>
      cadenceOk(item, input.istWeek, onceSeen, input.weeklySeen) &&
      catalogWhenMatches(item.when, input.targeting),
  );

  const checkin = eligible.find((item) => item.kind === "checkin");
  if (checkin && pack.length < DAILY_CAP) {
    pack.push(catalogToCard(checkin));
  }

  if (pack.length >= DAILY_CAP) return pack;

  const quote = eligible.find((item) => item.kind === "quote");
  if (quote) pack.push(catalogToCard(quote));

  return pack;
}

export function emptyGuidanceMemory(istDay: string): GuidanceMemory {
  return {
    istDay,
    packIds: null,
    dismissedIds: [],
    onceSeen: [],
    weeklySeen: {},
  };
}

/** New IST day: drop today's dismissals and frozen pack; keep cadence memory. */
export function rollGuidanceMemory(
  prev: GuidanceMemory,
  istDay: string,
): GuidanceMemory {
  if (prev.istDay === istDay) return prev;
  return {
    istDay,
    packIds: null,
    dismissedIds: [],
    onceSeen: prev.onceSeen,
    weeklySeen: prev.weeklySeen,
  };
}

/** Freeze pack ids and mark once/weekly catalog cards as seen for this week/life. */
export function rememberPack(
  memory: GuidanceMemory,
  pack: DailyCard[],
  catalogById: Map<string, CatalogItem>,
  istWeek: string,
): GuidanceMemory {
  const onceSeen = [...memory.onceSeen];
  const weeklySeen = { ...memory.weeklySeen };
  for (const card of pack) {
    if (card.source !== "catalog") continue;
    const item = catalogById.get(card.id);
    if (!item) continue;
    if (item.cadence === "once" && !onceSeen.includes(item.id)) {
      onceSeen.push(item.id);
    }
    if (item.cadence === "weekly") {
      weeklySeen[item.id] = istWeek;
    }
  }
  return {
    ...memory,
    packIds: pack.map((c) => c.id),
    onceSeen,
    weeklySeen,
  };
}

export function visibleDailyCards(
  pack: DailyCard[],
  dismissedIds: string[],
): DailyCard[] {
  const dismissed = new Set(dismissedIds);
  return pack.filter((card) => !dismissed.has(card.id));
}

export function cardsForFrozenIds(
  packIds: string[],
  profileItems: GuidanceItem[],
  catalog: CatalogItem[],
): DailyCard[] {
  const profileById = new Map(profileItems.map((i) => [i.id, i]));
  const catalogById = new Map(catalog.map((i) => [i.id, i]));
  const cards: DailyCard[] = [];
  for (const id of packIds) {
    const profile = profileById.get(id);
    if (profile) {
      cards.push(profileToCard(profile));
      continue;
    }
    const catalogItem = catalogById.get(id);
    if (catalogItem) cards.push(catalogToCard(catalogItem));
  }
  return cards;
}
