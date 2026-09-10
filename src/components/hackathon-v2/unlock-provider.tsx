"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  HACKATHON_UNLOCK_CODE,
  HACKATHON_UNLOCK_STORAGE_KEY,
} from "@/lib/hackathon-unlock";

type UnlockContextValue = {
  unlocked: boolean;
  registered: boolean;
  tryCode: (input: string) => boolean;
};

const UnlockContext = createContext<UnlockContextValue | null>(null);

type Props = {
  registered: boolean;
  children: ReactNode;
};

export function UnlockProvider({ registered, children }: Props) {
  // Registered users are auto-unlocked at SSR time so there is no locked flash.
  // Anonymous visitors start locked and useEffect promotes them to unlocked
  // if a prior VC20 entry left the localStorage flag set.
  const [unlocked, setUnlocked] = useState(registered);

  useEffect(() => {
    if (registered) {
      setUnlocked(true);
      return;
    }
    try {
      if (window.localStorage.getItem(HACKATHON_UNLOCK_STORAGE_KEY) === "true") {
        setUnlocked(true);
      }
    } catch {
      // localStorage unavailable (private window, blocked) — stay locked.
    }
  }, [registered]);

  const tryCode = useCallback((input: string): boolean => {
    const normalized = input.trim().toUpperCase();
    if (normalized !== HACKATHON_UNLOCK_CODE) return false;
    setUnlocked(true);
    try {
      window.localStorage.setItem(HACKATHON_UNLOCK_STORAGE_KEY, "true");
    } catch {
      // no-op: unlock still applies for this session
    }
    return true;
  }, []);

  return (
    <UnlockContext.Provider value={{ unlocked, registered, tryCode }}>
      {children}
    </UnlockContext.Provider>
  );
}

export function useUnlock(): UnlockContextValue {
  const ctx = useContext(UnlockContext);
  if (!ctx) {
    throw new Error("useUnlock must be used inside <UnlockProvider>");
  }
  return ctx;
}
