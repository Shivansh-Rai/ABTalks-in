"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useCourseProgress } from "./use-course-progress";

export type TocItem = { id: string; text: string };
export type FrameModule = { slug: string; number: number; title: string; minutes: number; sections: TocItem[] };

type Props = {
  courseSlug: string;
  courseTitle: string;
  modules: FrameModule[];
  current?: string;
  children: ReactNode;
};

/** The dashboard shell scrolls an inner pane, not the window: find the one that contains us. */
function getScroller(from: HTMLElement | null): HTMLElement | null {
  return from?.closest<HTMLElement>(".abt-content-scroll") ?? null;
}

/**
 * Course chrome inside the ABTalks shell: one course sidebar listing modules,
 * each expandable to its sub-topics, with progress and the reading position.
 */
export function CourseFrame({ courseSlug, courseTitle, modules, current, children }: Props) {
  const { progress } = useCourseProgress(courseSlug);
  const [read, setRead] = useState(0);
  const [viewH, setViewH] = useState<number | null>(null);
  const [headH, setHeadH] = useState(55);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(current ? [current] : []));
  const currentSections = useMemo(() => modules.find((m) => m.slug === current)?.sections ?? [], [modules, current]);
  const sectionsRef = useRef(currentSections);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sectionsRef.current = currentSections;
  }, [currentSections]);

  useEffect(() => {
    // Resolved on every event: in dev the tree can mount inside a hidden
    // streaming container before moving, so a scroller captured once is stale.
    const scroller = () => getScroller(rootRef.current);
    const head = () => scroller()?.querySelector<HTMLElement>(".abt-header")?.offsetHeight ?? 0;
    const onScroll = () => {
      const el = scroller() ?? document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setRead(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
      // Current section = last heading whose top has passed the sticky line.
      const line = head() + 24;
      let cur: string | null = null;
      for (const t of sectionsRef.current) {
        const h = rootRef.current?.querySelector<HTMLElement>(`[id="${t.id}"]`);
        if (h && h.getBoundingClientRect().top - line <= 1) cur = t.id;
      }
      setActive(cur ?? sectionsRef.current[0]?.id ?? null);
    };
    const onResize = () => {
      const el = scroller() ?? document.documentElement;
      const hh = head();
      setHeadH(hh);
      setViewH(el.clientHeight - hh);
    };
    onScroll();
    onResize();
    const raf = requestAnimationFrame(onResize);
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const doneCount = modules.filter((m) => progress.done.includes(m.slug)).length;
  const pct = Math.round((doneCount / modules.length) * 100);

  function toggle(slug: string) {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });
  }

  const moduleList = (
    <nav aria-label="Course contents">
      <ol className="crs-nav">
        {modules.map((m) => {
          const isCur = m.slug === current;
          const isDone = progress.done.includes(m.slug);
          const isOpen = open.has(m.slug);
          const listId = `crs-sec-${m.slug}`;
          return (
            <li key={m.slug}>
              <div className="crs-nav-mod" data-current={isCur}>
                <Link href={`/learn/${courseSlug}/${m.slug}`} aria-current={isCur ? "page" : undefined} className="crs-nav-link">
                  <span className="crs-nav-num" data-done={isDone} aria-hidden="true">
                    {isDone ? <Check className="size-3.5" /> : m.number}
                  </span>
                  <span>
                    {m.title}
                    <span className="crs-nav-meta">
                      ~{m.minutes} min{isDone ? " · completed" : ""}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="crs-nav-toggle"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  aria-label={`${isOpen ? "Hide" : "Show"} topics in ${m.title}`}
                  onClick={() => toggle(m.slug)}
                >
                  <ChevronDown className="size-4" style={{ transform: isOpen ? "rotate(180deg)" : undefined }} />
                </button>
              </div>
              {isOpen ? (
                <ul id={listId} className="crs-nav-secs">
                  {m.sections.map((t) => {
                    const on = isCur && active === t.id;
                    return (
                      <li key={t.id}>
                        <Link
                          href={isCur ? `#${t.id}` : `/learn/${courseSlug}/${m.slug}#${t.id}`}
                          aria-current={on ? "location" : undefined}
                          data-on={on}
                        >
                          {t.text}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const header = (
    <>
      <Link href={`/learn/${courseSlug}`} className="crs-nav-title">
        {courseTitle}
      </Link>
      <div style={{ margin: "8px 0 12px" }}>
        <div className="crs-meter" aria-hidden="true">
          <span style={{ width: `${pct}%`, background: "var(--c-ok)" }} />
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--c-mu)", marginTop: 4 }}>
          {doneCount} of {modules.length} modules complete
        </div>
      </div>
    </>
  );

  return (
    <div ref={rootRef} className="crs min-h-full" style={{ ["--crs-top" as string]: `${headH}px` }}>
      <div aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, height: 3, width: `${read}%`, background: "var(--c-pri)", zIndex: 60 }} />
      <div className="crs-shell" style={viewH ? { minHeight: viewH } : undefined}>
        <aside className="crs-side hidden lg:block" aria-label="Course navigation" style={viewH ? { height: viewH, top: headH } : undefined}>
          {header}
          {moduleList}
        </aside>
        <div className="min-w-0 flex-1">
          <details className="crs-mobile-nav lg:hidden">
            <summary>
              Course contents · {doneCount}/{modules.length} done
            </summary>
            <div style={{ marginTop: 10 }}>{moduleList}</div>
          </details>
          <div className="mx-auto max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
