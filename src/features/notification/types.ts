export type NotificationCategoryKey =
  | "GENERAL"
  | "WORKSHOP"
  | "HACKATHON"
  | "COHORT"
  | "CHALLENGE";

export type AppNotification = {
  /**
   * Stable, unique, never reused. Admin rows use "admin:<id>"; derived event
   * notifications use their own namespace ("workshop:<eventId>",
   * "hackathon:kickoff", "cohort:<id>:enrolling"). This is what
   * `NotificationRead.notificationKey` stores, which is why it must never
   * change for an item that has already been shown.
   */
  key: string;
  title: string;
  body: string | null;
  href: string | null;
  category: NotificationCategoryKey;
  /** ISO string — already serialised so the feed crosses the Server→Client boundary as-is. */
  publishedAt: string;
  isRead: boolean;
  /**
   * True for `user:` items — addressed to this person, not broadcast.
   * RESERVED: always undefined until the per-user read path lands
   * (docs/plans/114-unified-notify-helper.md).
   */
  isPersonal?: boolean;
};

export type NotificationFeed = {
  signedIn: boolean;
  items: AppNotification[];
  unreadCount: number;
};

export const EMPTY_FEED: NotificationFeed = {
  signedIn: false,
  items: [],
  unreadCount: 0,
};

// ─── notifyUser contract ────────────────────────────────────────────────────
//
// Frozen public API for the shared notification helper. Other developers code
// against these names; renames and removals are breaking. Additions are fine.
//
// This file is imported by a Client Component (notification-provider.tsx), so
// it must stay free of `server-only`, `@prisma/client` and `@/lib/*` runtime
// imports. notify.test.ts enforces that.
//
// Implementation plan: docs/plans/114-unified-notify-helper.md

/**
 * What happened, as a stable machine key. `NotificationCategoryKey` is icons;
 * this is meaning.
 *
 * Format: `<domain>.<past-tense-event>`, lowercase, one dot.
 *
 * FROZEN: a value that has shipped is never renamed — it is stored on the row.
 * Adding a value is non-breaking and needs no migration: this is a TypeScript
 * union persisted as a `String` column, deliberately not a Prisma enum.
 */
export type NotificationEventKey =
  | "submission.approved"
  | "submission.rejected"
  | "certificate.issued"
  | "recruiter.approved"
  | "admin.direct";

/** The two delivery channels. */
export type NotifyChannel = "inApp" | "email";

/** Per-channel outcome. `skipped` is a success — it means "correctly not sent". */
export type NotifyDelivery = "delivered" | "skipped" | "failed";

/**
 * Why a channel was skipped.
 *
 * `not_implemented` is permanent, not temporary scaffolding: removing a union
 * member would break any exhaustive `switch` a caller has written against it.
 */
export type NotifySkipReason =
  | "not_implemented"
  | "channel_disabled"
  | "preference_off"
  | "no_email_address"
  | "test_address"
  | "provider_unconfigured";

export type NotifyInput = {
  userId: string;
  eventKey: NotificationEventKey;
  /** Max 120 chars. Becomes the email subject verbatim — write it as one. */
  title: string;
  /** Max 500 chars. */
  body?: string | null;
  /** Internal path ("/dashboard") or absolute https:// URL. Max 300 chars. */
  href?: string | null;
  /** Icon only — nothing branches on it. Defaults to "GENERAL". */
  category?: NotificationCategoryKey;
  /** Both default to true. `false` skips that channel outright. */
  channels?: { inApp?: boolean; email?: boolean };
};

export type NotifyResult = {
  /**
   * The persisted row id, or null when nothing was persisted. Null is a
   * permanent possibility, not a stub artefact: a caller that skips the in-app
   * channel legitimately has no id.
   */
  notificationId: string | null;
  inApp: NotifyDelivery;
  email: NotifyDelivery;
  /** Populated only for channels whose delivery is "skipped". */
  skipReasons: Partial<Record<NotifyChannel, NotifySkipReason>>;
};

/**
 * The project's standard result envelope.
 *
 * Named `NotifyResponse` rather than `Result` on purpose: every action file
 * already declares its own local `type Result<T>`, and an exported `Result`
 * would collide on import in exactly the files most likely to call this.
 */
export type NotifyResponse =
  | { ok: true; data: NotifyResult }
  | { ok: false; message: string };

/**
 * Personal feed items are keyed `user:<UserNotification.id>`, extending the
 * existing `AppNotification.key` namespace ("admin:", "workshop:", …).
 */
export const PERSONAL_KEY_PREFIX = "user:";
