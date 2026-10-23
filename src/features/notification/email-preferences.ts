import { prisma } from "@/lib/db";
import { EVENT_TYPE_REGISTRY, EVENT_TYPES } from "./event-types";

export type EmailNotificationPreference = {
  eventType: string;
  label: string;
  channel: "email";
  enabled: boolean;
  canDisable: boolean;
};

/**
 * The user's email switches for every "important" event type, with the
 * registry default filling any type they have never touched. Shared by
 * /settings/notifications and the Account Settings page (/settings).
 */
export async function getEmailNotificationPreferences(
  userId: string,
): Promise<EmailNotificationPreference[]> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId },
    select: { eventType: true, channel: true, enabled: true },
  });

  const prefMap = new Map(
    rows.map((r) => [`${r.eventType}:${r.channel}`, r.enabled]),
  );

  return EVENT_TYPES.filter(
    (et) => EVENT_TYPE_REGISTRY[et].priority === "important",
  ).map((et) => {
    const config = EVENT_TYPE_REGISTRY[et];
    return {
      eventType: et,
      label: config.label,
      channel: "email" as const,
      enabled: prefMap.get(`${et}:email`) ?? config.defaultEmailEnabled,
      canDisable: !config.emailExempt,
    };
  });
}
