import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

type Args = {
  email?: string | null;
  userId?: string | null;
  /** Which funnel the opt-in came from — mirrors ConsentSource values. */
  source: string;
  optIn: boolean;
};

/**
 * Records a marketing opt-in or opt-out.
 *
 * Opting in upserts a subscribed row. Opting out never creates one — it only
 * flips an existing row to unsubscribed, so declining at signup leaves no
 * marketing record at all.
 *
 * Never throws: the signup that triggered this has already succeeded, so a
 * failure here must not surface to the user.
 */
export async function recordNewsletterOptIn(
  args: Args,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const email = args.email?.trim().toLowerCase();
  if (!email) return;

  const db = tx ?? prisma;

  try {
    if (args.optIn) {
      await db.newsletterSubscription.upsert({
        where: { email },
        create: {
          email,
          userId: args.userId || null,
          source: args.source,
          subscribed: true,
        },
        update: {
          subscribed: true,
          unsubscribedAt: null,
          // Backfill the link if the address subscribed before signing in.
          ...(args.userId ? { userId: args.userId } : {}),
        },
        select: { id: true },
      });
      return;
    }

    await db.newsletterSubscription.updateMany({
      where: { email, subscribed: true },
      data: { subscribed: false, unsubscribedAt: new Date() },
    });
  } catch (error) {
    logger.error("[legal] newsletter opt-in not recorded", {
      email,
      source: args.source,
      error: String(error),
    });
  }
}
