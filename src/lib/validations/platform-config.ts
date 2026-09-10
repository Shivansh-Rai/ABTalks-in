import { z } from "zod";

/**
 * Zod at the `PlatformConfig` boundary.
 *
 * A row in that table is typed by hand, by a human, against a live database, at
 * the moment somebody decides credits should be $100 instead of $200. That is a
 * boundary in every sense that matters, so it is validated like one — the value
 * that comes back is checked against the bounds the key declares before any
 * code is allowed to spend it.
 *
 * Pure: no DB, no `server-only`. The schemas are built by
 * `src/lib/platform-config.ts` from its key registry.
 */

/** An integer setting, bounded by whatever the registry declares for the key. */
export function intConfigSchema(min: number, max: number) {
  return z.number().int().min(min).max(max);
}

/** A non-empty string setting, trimmed. */
export const stringConfigSchema = z.string().trim().min(1).max(200);

/**
 * What a write to `PlatformConfig` must look like. Used by the seed and by any
 * future admin surface; the key itself is validated against the registry by the
 * caller, which is what makes an unknown key impossible rather than merely
 * discouraged.
 */
export const platformConfigWriteSchema = z.object({
  key: z.string().trim().min(1).max(120),
  intValue: z.number().int().nullable().optional(),
  stringValue: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(400).nullable().optional(),
  updatedByUserId: z.string().trim().min(1).nullable().optional(),
});

export type PlatformConfigWrite = z.infer<typeof platformConfigWriteSchema>;
