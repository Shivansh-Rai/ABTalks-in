"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecruiterRegisterForm } from "@/components/talent/recruiter-register-form";
import { RecruiterLoginForm } from "@/components/talent/recruiter-login-form";
import { RecruiterAuthClosed } from "@/components/talent/recruiter-auth-closed";
import type { HireAuthPanel, HireAuthReason } from "@/components/hire/hire-auth-types";

export function RecruiterAuthDialog({
  open,
  reason,
  authEnabled,
  passwordEnabled = false,
  signupEnabled = true,
  onOpenChange,
}: {
  open: boolean;
  reason: HireAuthReason;
  authEnabled: boolean;
  /** Plan 154's password tab. Without it the form offers a code and nothing else. */
  passwordEnabled?: boolean;
  /** When false the desk takes no new registrations; only sign-in is offered. */
  signupEnabled?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Checkout opens register. Nav "Sign in" opens sign-in. Never both forms.
  const [panel, setPanel] = useState<HireAuthPanel>(
    reason === "nav" || !signupEnabled ? "signin" : "register",
  );

  useEffect(() => {
    if (open) setPanel(reason === "nav" || !signupEnabled ? "signin" : "register");
  }, [open, reason, signupEnabled]);

  const isRegister = panel === "register";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="hire-app hire-auth max-h-[90vh] overflow-y-auto sm:max-w-md"
        showCloseButton
      >
        <DialogHeader>
          <p className="hire-auth__kicker">Klymb AI Hire</p>
          <DialogTitle>
            {!authEnabled
              ? "Not open yet"
              : isRegister
                ? "Register to send the request"
                : "Sign in to hire"}
          </DialogTitle>
          <DialogDescription>
            {!authEnabled
              ? "Recruiter accounts are not taking new sign-ins or registrations yet."
              : isRegister
                ? "Your cart stays on this page. Create an account to send it to our team."
                : passwordEnabled
                  ? "Use the password we sent you, or we'll email a code to your work address."
                  : "We'll email a code to your work address. No password."}
          </DialogDescription>
        </DialogHeader>

        {!authEnabled ? (
          <RecruiterAuthClosed compact />
        ) : isRegister ? (
          <>
            <RecruiterRegisterForm />
            <p className="hire-auth__switch">
              Already registered?{" "}
              <button type="button" onClick={() => setPanel("signin")}>
                Sign in
              </button>
            </p>
          </>
        ) : (
          <>
            <RecruiterLoginForm
              passwordEnabled={passwordEnabled}
              signupEnabled={signupEnabled}
            />
            {signupEnabled ? (
              <p className="hire-auth__switch">
                New here?{" "}
                <button type="button" onClick={() => setPanel("register")}>
                  Register
                </button>
              </p>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
