"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MatchCardData } from "@/components/hire/match-card";

/**
 * Which workspace is on screen.
 *
 * "saved" is the Save-for-later list — candidates kept on this device that the
 * recruiter has not committed to a request yet. It is a sibling of "pod", not a
 * mode of it: the two hold different lists and only one can be on screen.
 */
export type HireDeskView = "scout" | "pod" | "saved";

export type HireDeskState = {
  step: 1 | 2 | 3;
  matchCount: number | null;
  gap: string | null;
  view: HireDeskView;
  inspect: MatchCardData | null;
  /** Full-bleed Figma search landing on `/hire` before the first query. */
  landing: boolean;
  /** Name of the open talent project, shown in the nav card. Null off-project. */
  projectName: string | null;
  /** Bumped by the nav card's "+ Create New Project"; ScoutChat resets on change. */
  newSearchNonce: number;
};

type HireDeskValue = HireDeskState & {
  setDesk: (next: Partial<HireDeskState>) => void;
  openPod: () => void;
  closePod: () => void;
  openSaved: () => void;
  openInspect: (match: MatchCardData) => void;
  clearInspect: () => void;
  requestNewSearch: () => void;
};

const HireDeskContext = createContext<HireDeskValue | null>(null);

export function HireDeskProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HireDeskState>({
    step: 1,
    matchCount: null,
    gap: null,
    view: "scout",
    inspect: null,
    landing: true,
    projectName: null,
    newSearchNonce: 0,
  });
  const setDesk = useCallback((next: Partial<HireDeskState>) => {
    setState((s) => ({ ...s, ...next }));
  }, []);
  const openPod = useCallback(() => {
    setState((s) => ({ ...s, view: "pod", step: 3 }));
  }, []);
  const openSaved = useCallback(() => {
    // Deliberately does not touch `step`: saving for later is not a step of the
    // hiring workflow, it is a shelf beside it. Moving the rail would tell the
    // recruiter they had progressed when they had not.
    setState((s) => ({ ...s, view: "saved", inspect: null }));
  }, []);
  const closePod = useCallback(() => {
    setState((s) => ({
      ...s,
      view: "scout",
      step: s.matchCount != null ? 2 : 1,
    }));
  }, []);
  const openInspect = useCallback((match: MatchCardData) => {
    setState((s) => ({
      ...s,
      view: "scout",
      inspect: match,
      step: s.matchCount != null ? 2 : 1,
    }));
  }, []);
  const clearInspect = useCallback(() => {
    setState((s) => ({ ...s, inspect: null }));
  }, []);
  const requestNewSearch = useCallback(() => {
    setState((s) => ({
      ...s,
      view: "scout",
      inspect: null,
      newSearchNonce: s.newSearchNonce + 1,
    }));
  }, []);
  const value = useMemo(
    () => ({
      ...state,
      setDesk,
      openPod,
      closePod,
      openSaved,
      openInspect,
      clearInspect,
      requestNewSearch,
    }),
    [
      state,
      setDesk,
      openPod,
      closePod,
      openSaved,
      openInspect,
      clearInspect,
      requestNewSearch,
    ],
  );
  return (
    <HireDeskContext.Provider value={value}>{children}</HireDeskContext.Provider>
  );
}

export function useHireDesk(): HireDeskValue {
  const ctx = useContext(HireDeskContext);
  if (!ctx) {
    return {
      step: 1,
      matchCount: null,
      gap: null,
      view: "scout",
      inspect: null,
      landing: true,
      projectName: null,
      newSearchNonce: 0,
      setDesk: () => {},
      openPod: () => {},
      closePod: () => {},
      openSaved: () => {},
      openInspect: () => {},
      clearInspect: () => {},
      requestNewSearch: () => {},
    };
  }
  return ctx;
}
