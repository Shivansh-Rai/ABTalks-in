"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  requestEmailCodeAction,
  resetPasswordAction,
} from "@/app/actions/email-auth-actions";
import { PasswordInput } from "@/components/auth/password-input";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PASSWORD_MIN_LENGTH,
  SIGN_IN_ERROR,
  signInErrorMessage,
  type AuthAudience,
} from "@/lib/validations/email-auth";

/** Where a failure is shown: under one input, or above the submit button. */
type ErrorField = "email" | "password" | "code" | "newPassword" | "form";

type FormError = {
  field: ErrorField;
  message: string;
  /** Set for a refused sign-in, which is offered a way out beside the message. */
  refused?: { code: string | undefined };
};

/**
 * A refused credentials sign-in, placed at the input it is about. Too many
 * attempts is about no one field; a recruiter on the candidate door (or the
 * reverse) is about the address; everything else is the secret just typed.
 */
export function signInRefusal(
  code: string | undefined,
  method: "password" | "code",
): {
  field: "email" | "password" | "code" | "form";
  message: string;
  refused: { code: string | undefined };
} {
  const field =
    code === SIGN_IN_ERROR.rateLimited
      ? "form"
      : code === SIGN_IN_ERROR.recruiterAccount ||
          code === SIGN_IN_ERROR.notRecruiter
        ? "email"
        : method;
  return { field, message: signInErrorMessage(code, method), refused: { code } };
}

/**
 * The way out that follows a refused sign-in's message. A recruiter who typed
 * their details on the candidate door gets a link to the right one; everyone
 * else gets `onUseEmailCode`, when the caller has one.
 */
export function SignInErrorWayOut({
  code,
  email,
  onUseEmailCode,
}: {
  code: string | undefined;
  email: string;
  onUseEmailCode?: (() => void) | undefined;
}) {
  if (code === SIGN_IN_ERROR.recruiterAccount) {
    return (
      <a
        href={`/talent/login?email=${encodeURIComponent(email.trim())}`}
        className="font-medium underline underline-offset-2"
      >
        Go to Hire
      </a>
    );
  }
  // "Email or password is incorrect." is also what an account that has never
  // set a password gets, and what an address with no account gets. Which one
  // it is cannot be said out loud without telling a stranger who has an
  // account here, so the way out is offered to all three alike.
  if (onUseEmailCode) {
    return (
      <button
        type="button"
        onClick={onUseEmailCode}
        className="font-medium underline underline-offset-2"
      >
        Email me a code
      </button>
    );
  }
  return null;
}

/**
 * Sign in with the `password` provider, then leave by full navigation to a
 * same-origin path: the session cookie is new and every guard downstream reads
 * it server-side, and `result.url` points at AUTH_URL's host, which breaks
 * LAN / phone testing. A refusal comes back with its `code` for the caller to
 * show.
 */
export async function signInWithPassword(input: {
  email: string;
  password: string;
  audience: AuthAudience;
  afterSignIn: string;
}): Promise<{ ok: true } | { ok: false; code: string | undefined }> {
  const res = await signIn("password", {
    email: input.email.trim(),
    password: input.password,
    audience: input.audience,
    redirect: false,
  });
  if (!res || res.error) return { ok: false, code: res?.code };
  window.location.assign(input.afterSignIn);
  return { ok: true };
}

type Mode = "password" | "reset-request" | "reset-confirm";

/**
 * Email + password, with "Forgot password?" — an emailed code and a new
 * password, then straight in. The email is owned by the parent so it carries
 * over when someone switches between this and an emailed code.
 */
export function PasswordSignIn({
  audience,
  email,
  onEmailChange,
  afterSignIn,
  disabled = false,
  onBeforeSignIn,
  onUseEmailCode,
  idPrefix,
}: {
  audience: AuthAudience;
  email: string;
  onEmailChange: (email: string) => void;
  /** Same-origin path to open after signing in. */
  afterSignIn: string;
  /** e.g. the Terms box on /login is unticked. */
  disabled?: boolean;
  /** Last check before any sign-in; return false to stop. */
  onBeforeSignIn?: () => boolean;
  /**
   * Send the person back to the parent's emailed-code tab, email intact. The
   * only way out for someone who never set a password, or who has no account
   * at all — neither can be named here without leaking who is registered.
   */
  onUseEmailCode?: () => void;
  idPrefix: string;
}) {
  const [mode, setMode] = useState<Mode>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  // Focus goes to the input the error is about, once it is enabled again.
  useEffect(() => {
    if (!error || pending) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [error, pending]);

  function go(next: Mode) {
    setError(null);
    setMode(next);
  }

  function invalid(field: ErrorField) {
    return error?.field === field
      ? { "aria-invalid": true, "aria-describedby": `${idPrefix}-${field}-error` }
      : {};
  }

  function errorFor(field: ErrorField) {
    if (error?.field !== field) return null;
    return (
      <p
        id={`${idPrefix}-${field}-error`}
        role="alert"
        className={
          field === "form"
            ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            : "text-xs text-destructive"
        }
      >
        {error.message}
        {error.refused ? (
          <>
            {" "}
            <SignInErrorWayOut
              code={error.refused.code}
              email={email}
              onUseEmailCode={onUseEmailCode}
            />
          </>
        ) : null}
      </p>
    );
  }

  // `disabled` (the Terms box on /login) holds back the two buttons that sign
  // someone in. Typing is always allowed, and so is asking for a reset code:
  // an account old enough to have a password accepted the Terms at signup.
  const busy = pending || disabled;
  const emailOk = email.trim().length > 3;

  function submitPassword() {
    if (onBeforeSignIn && !onBeforeSignIn()) return;
    setError(null);
    startTransition(async () => {
      const res = await signInWithPassword({
        email,
        password,
        audience,
        afterSignIn,
      });
      if (!res.ok) {
        setPassword("");
        setError(signInRefusal(res.code, "password"));
      }
    });
  }

  function requestReset() {
    setError(null);
    startTransition(async () => {
      const res = await requestEmailCodeAction({
        email,
        purpose: "password-reset",
        audience,
      });
      if (!res.ok) {
        // The email box only exists on the request step; a failed resend from
        // the next step has nowhere to point but the form.
        setError({
          field:
            mode === "reset-request" && res.field === "email" ? "email" : "form",
          message: res.message,
        });
        return;
      }
      setDevCode(res.data.devCode ?? null);
      setCode("");
      setNewPassword("");
      setMode("reset-confirm");
    });
  }

  function confirmReset() {
    if (onBeforeSignIn && !onBeforeSignIn()) return;
    setError(null);
    startTransition(async () => {
      const res = await resetPasswordAction({ email, code, newPassword });
      if (!res.ok) {
        setError({
          field:
            res.field === "code" || res.field === "newPassword"
              ? res.field
              : "form",
          message: res.message,
        });
        return;
      }
      toast.success("Password saved. Signing you in…");
      const signin = await signInWithPassword({
        email,
        password: newPassword,
        audience,
        afterSignIn,
      });
      if (!signin.ok) {
        setMode("password");
        setPassword("");
        setError(signInRefusal(signin.code, "password"));
      }
    });
  }

  const submitClass = cn(
    buttonVariants({ size: "lg" }),
    "h-11 w-full gap-2 disabled:opacity-50",
  );
  const spinner = pending ? (
    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
  ) : null;

  if (mode === "reset-confirm") {
    return (
      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          confirmReset();
        }}
        className="flex flex-col gap-4"
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Set a new password</p>
          <p className="text-xs text-muted-foreground">
            If there&apos;s an account for{" "}
            <span className="font-medium text-foreground">{email.trim()}</span>,
            we&apos;ve emailed it a 6-digit code. It expires in 10 minutes.
          </p>
        </div>

        {devCode ? (
          <p className="rounded-lg border border-[#AA821D]/30 bg-[#AA821D]/10 px-3 py-2 text-xs text-[#6B5212]">
            <strong className="font-semibold">Development only.</strong> No mail
            provider is configured, so the code is shown here:{" "}
            <span className="font-mono text-sm font-bold tracking-widest">
              {devCode}
            </span>
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-reset-code`}>6-digit code</Label>
          <Input
            id={`${idPrefix}-reset-code`}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
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
          {errorFor("code")}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-new-password`}>New password</Label>
          <PasswordInput
            id={`${idPrefix}-new-password`}
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

        {errorFor("form")}
        <button
          type="submit"
          disabled={busy || code.length !== 6 || newPassword.length < PASSWORD_MIN_LENGTH}
          className={submitClass}
        >
          {spinner}
          Save password &amp; sign in
        </button>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => go("password")}
            disabled={pending}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            Back to sign in
          </button>
          <button
            type="button"
            onClick={requestReset}
            disabled={pending}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Send a new code
          </button>
        </div>
        {onUseEmailCode ? (
          // The one screen where a code may never arrive: the address has no
          // account, and saying so is exactly what we refuse to do. The
          // emailed-code tab is the honest way on — it answers the same for
          // every address, and on the candidate door it opens the account.
          <p className="text-center text-xs text-muted-foreground">
            No code?{" "}
            <button
              type="button"
              onClick={onUseEmailCode}
              disabled={pending}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Sign in with an emailed code
            </button>{" "}
            {audience === "candidate"
              ? "— it also creates your account if you're new."
              : "instead."}
          </p>
        ) : null}
      </form>
    );
  }

  if (mode === "reset-request") {
    return (
      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (emailOk) requestReset();
        }}
        className="flex flex-col gap-4"
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Forgot your password?</p>
          <p className="text-xs text-muted-foreground">
            We&apos;ll email you a code to set a new one. This also works if you
            have never set a password.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-reset-email`}>Email</Label>
          <Input
            id={`${idPrefix}-reset-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setError(null);
              onEmailChange(e.target.value);
            }}
            disabled={pending}
            {...invalid("email")}
          />
          {errorFor("email")}
        </div>
        {errorFor("form")}
        <button
          type="submit"
          disabled={pending || !emailOk}
          className={submitClass}
        >
          {spinner}
          Email me a code
        </button>
        <button
          type="button"
          onClick={() => go("password")}
          disabled={pending}
          className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (emailOk && password) submitPassword();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(e) => {
            setError(null);
            onEmailChange(e.target.value);
          }}
          disabled={pending}
          {...invalid("email")}
        />
        {errorFor("email")}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={`${idPrefix}-password`}>Password</Label>
          <button
            type="button"
            onClick={() => go("reset-request")}
            disabled={pending}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <PasswordInput
          id={`${idPrefix}-password`}
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setError(null);
            setPassword(e.target.value);
          }}
          disabled={pending}
          {...invalid("password")}
        />
        {errorFor("password")}
      </div>
      {errorFor("form")}
      <button type="submit" disabled={busy || !emailOk || !password} className={submitClass}>
        {spinner}
        Sign in
      </button>
    </form>
  );
}
