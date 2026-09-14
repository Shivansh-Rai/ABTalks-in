import { z } from "zod";
import rawCatalog from "./catalog.json";
import type { ChallengeDomain } from "./types";

const challengeDomainSchema = z.enum(["AI", "DS", "SE", "CLAUDE"]);

const whenSchema = z
  .object({
    always: z.boolean().optional(),
    challengeDomains: z.array(challengeDomainSchema).optional(),
    aiCohortActive: z.boolean().optional(),
    aiCohortCompleted: z.boolean().optional(),
    skillIncludes: z.array(z.string().min(1)).optional(),
    roleIncludes: z.array(z.string().min(1)).optional(),
    skillsEmpty: z.boolean().optional(),
  })
  .strict();

const catalogItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["checkin", "quote"]),
  cadence: z.enum(["once", "daily", "weekly"]),
  title: z.string().min(1),
  body: z.string().min(1),
  ctaLabel: z.string().min(1).optional(),
  href: z.string().min(1).optional(),
  when: whenSchema.optional(),
});

const catalogSchema = z.object({
  version: z.literal(1),
  items: z.array(catalogItemSchema),
});

export type CatalogWhen = z.infer<typeof whenSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type CatalogCadence = CatalogItem["cadence"];
export type CatalogKind = CatalogItem["kind"];

export const GUIDANCE_CATALOG: CatalogItem[] = catalogSchema.parse(rawCatalog).items;

export type GuidanceTargeting = {
  challengeDomains: ChallengeDomain[];
  aiCohortActive: boolean;
  aiCohortCompleted: boolean;
  skillNames: string[];
  preferredRoles: string[];
  skillsEmpty: boolean;
};

function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenHit(hay: string, needle: string): boolean {
  const h = squash(hay);
  const n = squash(needle);
  if (!h || !n) return false;
  if (h === n) return true;
  return h.includes(n);
}

export function catalogWhenMatches(
  when: CatalogWhen | undefined,
  targeting: GuidanceTargeting,
): boolean {
  if (!when) return true;

  if (when.challengeDomains && when.challengeDomains.length > 0) {
    const ok = when.challengeDomains.some((d) =>
      targeting.challengeDomains.includes(d),
    );
    if (!ok) return false;
  }

  if (when.aiCohortActive === true && !targeting.aiCohortActive) return false;
  if (when.aiCohortCompleted === true && !targeting.aiCohortCompleted) {
    return false;
  }
  if (when.skillsEmpty === true && !targeting.skillsEmpty) return false;

  if (when.skillIncludes && when.skillIncludes.length > 0) {
    const hit = targeting.skillNames.some((name) =>
      when.skillIncludes!.some((needle) => tokenHit(name, needle)),
    );
    if (!hit) return false;
  }

  if (when.roleIncludes && when.roleIncludes.length > 0) {
    const hit = targeting.preferredRoles.some((role) =>
      when.roleIncludes!.some((needle) => tokenHit(role, needle)),
    );
    if (!hit) return false;
  }

  return true;
}
