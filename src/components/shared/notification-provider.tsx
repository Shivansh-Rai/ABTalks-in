"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  Code2,
  GraduationCap,
  Megaphone,
  Presentation,
  Trophy,
  X,
} from "lucide-react";
import {
  getMyNotificationsAction,
  markNotificationsReadAction,
} from "@/app/actions/notification-actions";
import type {
  AppNotification,
  NotificationCategoryKey,
  NotificationFeed,
} from "@/features/notification/types";
import { shouldRefetch } from "@/features/notification/refetch-policy";
import { cn } from "@/lib/utils";
import { NotificationAnalyticsTracker } from "@/components/shared/notification-analytics-tracker";

type Ctx = {
  feed: NotificationFeed | null;
  open: boolean;
  /** Called by a bell trigger on mount — the provider never fetches on its own. */
  ensureLoaded: () => void;
  /** The trigger registers its DOM node so the panel can be anchored under it. */
  setAnchor: (el: HTMLElement | null) => void;
  openPanel: () => void;
  closePanel: () => void;
};

const NotificationContext = createContext<Ctx | null>(null);
const KEY = "abtalks_notifications";
/**
 * The sessionStorage cache is treated as fresh for this long. Older than this,
 * an `ensureLoaded` call or a tab-focus event refetches.
 *
 * Was 60_000 (60s). Reduced to 20s so a notification created while the
 * candidate has the tab in the background lands in the bell within 20s of
 * refocus, instead of up to a full minute.
 */
const TTL_MS = 20_000;
/**
 * How stale the cache must be for a live event (tab focus, panel open) to
 * trigger a background refetch. Smaller than `TTL_MS` so a user who just
 * refocuses a tab does NOT re-query the server needlessly, but a user who
 * has been away long enough for something to have changed does.
 */
const REFETCH_STALE_AFTER_MS = 10_000;

const NOOP_CTX: Ctx = {
  feed: null,
  open: false,
  ensureLoaded: () => {},
  setAnchor: () => {},
  openPanel: () => {},
  closePanel: () => {},
};

/** Where the panel should hang from, measured off the bell. */
type AnchorRect = { bottom: number; right: number };

const VIEWPORT_GUTTER = 8;
/** Extra space from the viewport right edge — the old left-clamp pinned the panel flush right. */
const PANEL_RIGHT_INSET = 40;
/** Extra leftward offset past the bell's right edge. */
const PANEL_LEFT_SHIFT = 28;

function readCache(): { feed: NotificationFeed; t: number } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { feed: NotificationFeed; t: number }) : null;
  } catch {
    return null;
  }
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);
  const anchorRef = useRef<HTMLElement | null>(null);

  const setAnchor = useCallback((el: HTMLElement | null) => {
    anchorRef.current = el;
  }, []);

  const measureAnchor = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    setAnchorRect({ bottom: box.bottom, right: box.right });
  }, []);

  const writeCache = useCallback((next: NotificationFeed) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ feed: next, t: Date.now() }));
    } catch {}
  }, []);

  const fetchFeed = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    void getMyNotificationsAction()
      .then((res) => {
        if (res.ok) {
          setFeed(res.data);
          writeCache(res.data);
        }
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [writeCache]);

  /**
   * Fire-and-forget refetch when the cache is older than
   * `REFETCH_STALE_AFTER_MS`. Used by the tab-focus listener and by
   * `openPanel` — both cases where the user has done something that
   * implies "show me the latest".
   *
   * Never wipes the existing feed while refetching, so the bell doesn't
   * flash empty. The next resolved fetch replaces the state atomically.
   */
  const refetchIfStale = useCallback(() => {
    const cached = readCache();
    if (shouldRefetch(cached?.t, Date.now(), REFETCH_STALE_AFTER_MS)) {
      fetchFeed();
    }
  }, [fetchFeed]);

  /**
   * This provider sits in the root layout, which renders on the public landing
   * page too. Fetching on mount would hit a Server Action for every anonymous
   * visitor, so loading is driven by the bell trigger instead — the feed is
   * only ever fetched where a bell actually renders.
   */
  const ensureLoaded = useCallback(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const cached = readCache();
    if (cached) setFeed(cached.feed);
    if (shouldRefetch(cached?.t, Date.now(), TTL_MS)) fetchFeed();
  }, [fetchFeed]);

  const closePanel = useCallback(() => setOpen(false), []);

  const openPanel = useCallback(() => {
    measureAnchor();
    setOpen(true);

    // A refetch in the background catches notifications created since the
    // last mount (e.g. a recruiter viewed the candidate's profile while the
    // tab was already open). Fire-and-forget so the panel opens instantly;
    // the fresh feed replaces whatever the user briefly saw.
    refetchIfStale();

    // Opening the bell counts as seeing everything in it. Optimistic: the badge
    // clears instantly and the write is fire-and-forget.
    setFeed((prev) => {
      if (!prev) return prev;
      const unreadKeys = prev.items.filter((i) => !i.isRead).map((i) => i.key);
      if (unreadKeys.length === 0) return prev;

      const next: NotificationFeed = {
        ...prev,
        items: prev.items.map((i) => ({ ...i, isRead: true })),
        unreadCount: 0,
      };
      writeCache(next);
      void markNotificationsReadAction(unreadKeys);
      return next;
    });
  }, [writeCache, measureAnchor, refetchIfStale]);

  // Refetch when the tab regains focus. Without this the bell never picks
  // up a notification created while the candidate had the tab in the
  // background — the previous behaviour was "fetch once on mount, then
  // never again in this session", which was the root cause of T-XXX
  // (mail arrives but bell stays quiet).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.visibilityState === "visible" && loadedRef.current) {
        refetchIfStale();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, [refetchIfStale]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", measureAnchor);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", measureAnchor);
    };
  }, [open, measureAnchor]);

  return (
    <NotificationContext.Provider
      value={{ feed, open, ensureLoaded, setAnchor, openPanel, closePanel }}
    >
      {children}
      {feed?.signedIn ? (
        <NotificationAnalyticsTracker items={feed.items} />
      ) : null}
      {open && feed?.signedIn ? (
        <NotificationPanel
          items={feed.items}
          anchorRect={anchorRect}
          onClose={closePanel}
        />
      ) : null}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): Ctx {
  return useContext(NotificationContext) ?? NOOP_CTX;
}

const categoryIcon: Record<NotificationCategoryKey, typeof Bell> = {
  GENERAL: Megaphone,
  WORKSHOP: Presentation,
  HACKATHON: Trophy,
  COHORT: GraduationCap,
  CHALLENGE: Code2,
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 0) return "soon";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function NotificationPanel({
  items,
  anchorRect,
  onClose,
}: {
  items: AppNotification[];
  anchorRect: AnchorRect | null;
  onClose: () => void;
}) {
  // Below md the panel is a full-width sheet, so the anchor is ignored. From md
  // up it hangs directly under the bell, wherever the header happens to put it.
  //
  // Read the breakpoint during the first render, not in an effect: the panel
  // remounts on every open, and an effect-only read paints one frame with no
  // anchor, which parks the fixed, body-portaled box at the viewport's left
  // edge. Safe to touch `window` here — the panel never renders on the server
  // or during hydration, only after a click flips `open`.
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (typeof document === "undefined") return null;

  // Hang from the bell's right edge, then pull left so it is not flush with
  // the viewport. `right` (not a left clamp) is what actually moves it inward.
  const anchored =
    isDesktop && anchorRect
      ? {
          top: anchorRect.bottom + VIEWPORT_GUTTER,
          left: "auto",
          right: Math.max(
            PANEL_RIGHT_INSET,
            window.innerWidth - anchorRect.right + PANEL_LEFT_SHIFT,
          ),
        }
      : undefined;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close notifications"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/20 animate-in fade-in-0 duration-150"
      />
      <div
        role="dialog"
        aria-label="Notifications"
        style={anchored}
        className={cn(
          "fixed z-[70] flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-150",
          // Mobile: drops from under the sticky header, full width.
          "inset-x-3 top-16 max-h-[70vh]",
          // Desktop: width + a safe right inset so `right` never computes to
          // `auto` — `anchored` overrides it inline once the bell is measured.
          "md:left-auto md:right-10 md:w-96",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="font-heading text-22px leading-7 font-semibold">
            Notifications
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            You&rsquo;re all caught up.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
            {items.map((item) => {
              const Icon = categoryIcon[item.category] ?? Megaphone;
              const inner = (
                <div className="flex gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                      item.isRead
                        ? "border-border/60 text-muted-foreground"
                        : "border-[#03535F]/30 bg-[#03535F]/10 text-[#03535F]",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-content text-sm font-bold leading-snug">
                      {item.title}
                    </p>
                    {item.body ? (
                      <p className="mt-0.5 font-content text-xs font-light text-muted-foreground">
                        {item.body}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {relativeTime(item.publishedAt)}
                    </p>
                  </div>
                </div>
              );

              const linkClass =
                "focus-spark block transition-colors hover:bg-muted/60";

              return (
                <li key={item.key}>
                  {item.href?.startsWith("https://") ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onClose}
                      className={linkClass}
                    >
                      {inner}
                    </a>
                  ) : item.href ? (
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={linkClass}
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>,
    document.body,
  );
}
