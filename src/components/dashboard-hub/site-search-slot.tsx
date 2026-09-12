"use client";

import { useEffect } from "react";
import { useSiteSearch } from "@/components/dashboard-hub/site-search-host";
import { DashboardSearch } from "@/components/dashboard-hub/dashboard-search";
import { cn } from "@/lib/utils";

type SiteSearchSlotProps = {
  className?: string;
};

/**
 * In-flow desktop search mount point. Place immediately before the
 * notification bell: [...tabs, search, notif].
 */
export function SiteSearchSlot({ className }: SiteSearchSlotProps) {
  const search = useSiteSearch();
  const enabled = search?.enabled ?? false;
  const registerSlot = search?.registerSlot;
  const unregisterSlot = search?.unregisterSlot;
  const items = search?.items;

  useEffect(() => {
    if (!enabled || !registerSlot || !unregisterSlot) return;
    registerSlot();
    return () => unregisterSlot();
  }, [enabled, registerSlot, unregisterSlot]);

  if (!enabled || !items) return null;

  return (
    <div className={cn("hidden shrink-0 md:block", className)}>
      <DashboardSearch items={items} />
    </div>
  );
}
