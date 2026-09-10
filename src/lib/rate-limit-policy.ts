/**
 * Rate-limit windows for money and personal-data paths (T-258).
 * Zero imports so tests and the server helper share one decision.
 */

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const RATE_LIMIT_MAX = {
  UNLOCK: 20,
  OUTREACH: 30,
  SEARCH: 60,
  EXPORT: 10,
} as const;

export type RateLimitBucketName = keyof typeof RATE_LIMIT_MAX;

/** Wave-1 actions that must call `assertRateLimit` when they exist. */
export const REQUIRED_RATE_LIMIT_SITES: {
  bucket: RateLimitBucketName;
  files: string[];
}[] = [
  {
    bucket: "SEARCH",
    files: [
      "src/app/actions/hire-actions.ts",
      "src/app/actions/hire-guest-actions.ts",
    ],
  },
  {
    bucket: "EXPORT",
    files: [
      "src/app/actions/admin-export-actions.ts",
      "src/app/actions/admin-program-export-actions.ts",
    ],
  },
  // Unlock / outreach are Zainab's Demo 1 actions. When those files exist
  // they must import assertRateLimit; the test only requires the helper.
  { bucket: "UNLOCK", files: [] },
  { bucket: "OUTREACH", files: [] },
];

export function isRateLimited(
  timestamps: number[],
  now: number,
  max: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): boolean {
  const recent = timestamps.filter((t) => now - t < windowMs);
  return recent.length >= max;
}

export function rateLimitMessage(bucket: RateLimitBucketName): string {
  switch (bucket) {
    case "UNLOCK":
      return "Too many unlock attempts. Wait a few minutes and try again.";
    case "OUTREACH":
      return "Too many messages. Wait a few minutes and try again.";
    case "SEARCH":
      return "Too many searches. Wait a few minutes and try again.";
    case "EXPORT":
      return "Too many exports. Wait a few minutes and try again.";
  }
}
