"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  requestPasswordCodeAction,
  setPasswordAction,
} from "@/app/actions/email-auth-actions";
import { PasswordInput } from "@/components/auth/password-input";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PASSWORD_MIN_LENGTH,
  type AuthAudience,
} from "@/lib/validations/email-auth";

/**
 * Plan 154. Set or change a password.
 *
 * - Changing needs the current password, and signs every other device out;
 *   this one is signed straight back in with the new password.
 * - A first password needs a recent sign-in, or else an emailed code
 *   (`needsCode`, decided on the server from the session's sign-in time).
 * - A failure is shown at the input it is about, or above the button when it
 *   is about none. Success replaces the form with a confirmation and the way
 *   back (`backHref`), so the page is not a dead end.
 */
export function PasswordSettingsForm({
  email,
  audience,
  hasPassword,
  googleOnly,
  needsCode,
  backHref,
  backLabel,
}: {
  email: string;
  audience: AuthAudience;
  hasPassword: boolean;
  googleOnly: boolean;
  needsCode: boolean;
  backHref: string;
  backLabel: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<{
    field: "currentPassword" | "newPassword" | "code" | "form";
    message: string;
  } | null>(null);
  const [done, setDone] = useState<"changed" | "set" | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  // Focus goes to the input the error is about, once it is enabled again.
  useEffect(() => {
    if (!error || pending) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [error, pending]);

  if (googleOnly) {
    return (
      <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        This account signs in with Google only, so it can&apos;t have a
        password.
      </p>
    );
  }

  if (done) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-4 rounded-xl border bg-card p-5"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {done === "changed" ? "Password changed" : "Password set"}
            </p>
            <p className="text-sm text-muted-foreground">
              {done === "changed"
                ? "Your other devices were signed out. This one stays signed in."
                : "You can now sign in with your email and this password."}
            </p>
          </div>
        </div>
        {/* A full navigation, not <Link>: the session cookie may have just
            been replaced, and everything downstream reads it server-side. */}
        <a href={backHref} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
          {backLabel}
        </a>
      </div>
    );
  }

  const codeRequired = !hasPassword && needsCode;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit =
    newPassword.length >= PASSWORD_MIN_LENGTH &&
    confirmPassword === newPassword &&
    (!hasPassword || currentPassword.length > 0) &&
    (!codeRequired || code.length === 6);

  function invalid(field: "currentPassword" | "newPassword" | "code") {
    return error?.field === field
      ? { "aria-invalid": true, "aria-describedby": `settings-${field}-error` }
      : {};
  }

  function errorFor(field: "currentPassword" | "newPassword" | "code" | "form") {
    if (error?.field !== field) return null;
    return (
      <p
        id={`settings-${field}-error`}
        role="alert"
        className={
          field === "form"
            ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            : "text-xs text-destructive"
        }
      >
        {error.message}
      </p>
    );
  }

  function sendCode() {
    setError(null);
    startTransition(async () => {
      const res = await requestPasswordCodeAction();
      if (!res.ok) {
        setError({ field: "code", message: res.message });
        return;
      }
      setDevCode(res.data.devCode ?? null);
      setCodeSent(true);
      toast.success(`Code sent to ${email}.`);
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await setPasswordAction({
        newPassword,
        ...(hasPassword ? { currentPassword } : {}),
        ...(codeRequired ? { code } : {}),
      });
      if (!res.ok) {
        setError({
          field:
            res.field === "currentPassword" ||
            res.field === "newPassword" ||
            res.field === "code"
              ? res.field
              : "form",
          message: res.message,
        });
        return;
      }
      if (res.data.reauthenticate) {
        // Every session was just signed out, this one included. Open a fresh
        // one with the new password before anything reads the old cookie.
        const signin = await signIn("password", {
          email,
          password: newPassword,
          audience,
          redirect: false,
        });
        if (!signin || signin.error) {
          toast.success("Password changed. Sign in again with your new password.");
          window.location.assign(
            audience === "recruiter" ? "/talent/login" : "/login",
          );
          return;
        }
      }
      setDone(hasPassword ? "changed" : "set");
    });
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) submit();
      }}
      className="flex flex-col gap-5 rounded-xl border bg-card p-5"
    >
      <p className="text-sm font-medium text-foreground">
        {hasPassword ? "Change your password" : "Set a password"}
      </p>

      {/* Lets password managers file the new password under the right account. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />

      {hasPassword ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-current-password">Current password</Label>
          <PasswordInput
            id="settings-current-password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => {
              setError(null);
              setCurrentPassword(e.target.value);
            }}
            disabled={pending}
            {...invalid("currentPassword")}
          />
          {errorFor("currentPassword")}
          <p className="text-xs text-muted-foreground">
            Forgot it? Sign out and use &ldquo;Forgot password?&rdquo; on the
            sign-in page.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-new-password">New password</Label>
        <PasswordInput
          id="settings-new-password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => {
            setError(null);
            setNewPassword(e.target.value);
          }}
          disabled={pending}
          {...invalid("newPassword")}
        />
        {errorFor("newPassword") ?? (
          <p className="text-xs text-muted-foreground">
            At least {PASSWORD_MIN_LENGTH} characters.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-confirm-password">Confirm new password</Label>
        <PasswordInput
          id="settings-confirm-password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={pending}
          aria-invalid={mismatch || undefined}
        />
        {mismatch ? (
          <p role="alert" className="text-xs text-destructive">
            The passwords don&apos;t match.
          </p>
        ) : null}
      </div>

      {codeRequired ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm text-foreground">
            You signed in a while ago, so confirm it&apos;s you with a code sent
            to <span className="font-medium">{email}</span>.
          </p>
          {devCode ? (
            <p className="rounded-lg border border-[#AA821D]/30 bg-[#AA821D]/10 px-3 py-2 text-xs text-[#6B5212]">
              <strong className="font-semibold">Development only.</strong> Code:{" "}
              <span className="font-mono text-sm font-bold tracking-widest">
                {devCode}
              </span>
            </p>
          ) : null}
          {codeSent ? (
            <>
              <Label htmlFor="settings-code">6-digit code</Label>
              <Input
                id="settings-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  setError(null);
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                disabled={pending}
                className="text-center font-mono text-lg tracking-[0.5em]"
                {...invalid("code")}
              />
            </>
          ) : null}
          {errorFor("code")}
          <button
            type="button"
            onClick={sendCode}
            disabled={pending}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}
          >
            {codeSent ? "Send a new code" : "Email me a code"}
          </button>
        </div>
      ) : null}

      {errorFor("form")}
      <button
        type="submit"
        disabled={pending || !canSubmit}
        className={cn(buttonVariants({ size: "lg" }), "h-11 w-full gap-2 disabled:opacity-50")}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {hasPassword ? "Change password" : "Set password"}
      </button>
    </form>
  );
}
