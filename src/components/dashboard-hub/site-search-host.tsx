"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { DashboardSearch } from "@/components/dashboard-hub/dashboard-search";
import type { HubSearchItem } from "@/features/dashboard/hub-search-index";

function isHirePath(pathname: string): boolean {
  return pathname === "/hire" || pathname.startsWith("/hire/");
}

type SiteSearchContextValue = {
  items: HubSearchItem[];
  enabled: boolean;
  registerSlot: () => void;
  unregisterSlot: () => void;
};

const SiteSearchContext = createContext<SiteSearchContextValue | null>(null);

export function useSiteSearch(): SiteSearchContextValue | null {
  return useContext(SiteSearchContext);
}

type SiteSearchProviderProps = {
  items: HubSearchItem[];
  children: ReactNode;
};

/**
 * Supplies the search catalog to header slots (in-flow, no portal).
 * Desktop-only fallback when a page has no header slot (login, etc.).
 * Hidden on `/hire` and below `md`.
 */
export function SiteSearchProvider({ items, children }: SiteSearchProviderProps) {
  const pathname = usePathname();
  const enabled = !isHirePath(pathname);
  const [slotCount, setSlotCount] = useState(0);
  const [slotsChecked, setSlotsChecked] = useState(false);

  const registerSlot = useCallback(() => {
    setSlotCount((n) => n + 1);
  }, []);
  const unregisterSlot = useCallback(() => {
    setSlotCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({ items, enabled, registerSlot, unregisterSlot }),
    [items, enabled, registerSlot, unregisterSlot],
  );

  useEffect(() => {
    setSlotsChecked(false);
    const id = window.requestAnimationFrame(() => setSlotsChecked(true));
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [enabled, pathname]);

  return (
    <SiteSearchContext.Provider value={value}>
      {children}
      {enabled && slotsChecked && slotCount === 0 ? (
        <div className="pointer-events-none fixed top-0 right-0 z-[60] hidden h-[55px] items-center pr-5 md:flex md:pr-10">
          <div className="pointer-events-auto">
            <DashboardSearch items={items} />
          </div>
        </div>
      ) : null}
    </SiteSearchContext.Provider>
  );
}
