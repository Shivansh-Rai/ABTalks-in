"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RecruiterAuthDialog } from "@/components/hire/recruiter-auth-dialog";
import type { HireAuthReason } from "@/components/hire/hire-auth-types";

export type { HireAuthReason };

type HireAuthContextValue = {
  /** Signed in AND a registered recruiter. There is no third state. */
  approved: boolean;
  signedIn: boolean;
  authEnabled: boolean;
  passwordEnabled?: boolean;
  signupEnabled?: boolean;
  /**
   * Platform Admin. Decides what the desk shows and nothing more: every admin
   * action checks `requireAdmin()` itself.
   */
  isAdmin: boolean;
  openAuth: (reason: HireAuthReason) => void;
};

const HireAuthContext = createContext<HireAuthContextValue | null>(null);

export function useHireAuth(): HireAuthContextValue {
  const ctx = useContext(HireAuthContext);
  if (!ctx) {
    return {
      approved: false,
      signedIn: false,
      authEnabled: false,
      passwordEnabled: false,
      signupEnabled: false,
      isAdmin: false,
      openAuth: () => {
        window.location.href = "/hire";
      },
    };
  }
  return ctx;
}

export function HireAuthProvider({
  approved,
  signedIn,
  authEnabled,
  passwordEnabled = false,
  signupEnabled = true,
  isAdmin = false,
  children,
}: {
  approved: boolean;
  signedIn: boolean;
  authEnabled: boolean;
  /** Plan 154's password tab in the dialog. The page at /talent/login always
   *  passed this; the dialog never did, so a recruiter holding an emailed
   *  password had only a code field to look at. */
  passwordEnabled?: boolean;
  /** When false the desk takes no new registrations — sign-in only. */
  signupEnabled?: boolean;
  isAdmin?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<HireAuthReason>("nav");

  const openAuth = useCallback((next: HireAuthReason) => {
    setReason(next);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ approved, signedIn, authEnabled, isAdmin, openAuth }),
    [approved, signedIn, authEnabled, isAdmin, openAuth],
  );

  return (
    <HireAuthContext.Provider value={value}>
      {children}
      <RecruiterAuthDialog
        open={open}
        reason={reason}
        authEnabled={authEnabled}
        passwordEnabled={passwordEnabled}
        signupEnabled={signupEnabled}
        onOpenChange={setOpen}
      />
    </HireAuthContext.Provider>
  );
}
