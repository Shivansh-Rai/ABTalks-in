"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { chipVariants } from "./motion";

/*
 * The onboarding's form controls. DS v2 §12 geometry (48px input, 16px
 * padding, 8px radius, 1px #E0E0E0) with the micro-interactions the flow
 * needs: a focus ring that eases in, a check when a field is good, a check
 * that scales in on the chosen chip. All of it is colour, shadow, transform
 * or opacity.
 */

/** Client-side shape check only; the server's Zod schema is the authority. */
export const EMAIL_RE = /^\S+@\S+\.\S+$/;

export const INPUT_CLASS = cn(
  "h-12 w-full rounded-lg border border-[#E0E0E0] bg-white px-4 text-base text-[#161616]",
  "placeholder:text-[#A5A5A5] outline-none",
  "transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-spark)]",
  "hover:border-[#A5A5A5]",
  "focus-visible:border-[#03535F] focus-visible:shadow-[0_0_0_3px_rgba(3,83,95,0.16)]",
  "aria-invalid:border-[#D92D20] aria-invalid:focus-visible:shadow-[0_0_0_3px_rgba(217,45,32,0.14)]",
  "disabled:bg-[#F4F4F4] disabled:text-[#8F8F8F]",
);

type FieldProps = {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  /** Shows the small check once the value is good. */
  valid?: boolean;
  children: ReactNode;
};

export function Field({ id, label, optional, hint, error, valid, children }: FieldProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-[#161616]">
          {label}
        </label>
        {optional && <span className="text-xs text-[#8F8F8F]">Optional</span>}
      </div>
      <div className="relative mt-2">
        {children}
        <AnimatePresence initial={false}>
          {valid && !error && (
            <motion.span
              key="ok"
              aria-hidden
              variants={chipVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="pointer-events-none absolute right-3 top-1/2 -mt-2.5 flex size-5 items-center justify-center rounded-full bg-[#D6F7EC] text-[#03535F]"
            >
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <FieldError id={`${id}-error`} message={error ?? null} />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-[#787878]">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Wiring for an input inside `Field`: its description and invalid state. */
export function fieldA11y(id: string, error: string | null | undefined, hint?: string) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

/** Inline, icon-led error — never colour alone (DS v2 §17). */
export function FieldError({ id, message }: { id?: string; message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          id={id}
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-1.5 flex items-start gap-1.5 text-sm leading-5 text-[#D92D20]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{message}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

type Option = { value: string; label: string };

/**
 * A single-choice set of chips. It is a radio group to assistive tech, with
 * roving focus on the arrow keys; picking the chosen chip again clears it,
 * because every group that uses this is optional.
 */
export function ChipGroup({
  label,
  options,
  value,
  onChange,
  optional = true,
}: {
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next]!.value);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-sm font-medium text-[#161616]">
          {label}
        </span>
        {optional && <span className="text-xs text-[#8F8F8F]">Optional</span>}
      </div>
      <div role="radiogroup" aria-labelledby={labelId} className="mt-2 flex flex-wrap gap-2">
        {options.map((option, i) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={i === focusIndex ? 0 : -1}
              onClick={() => onChange(selected ? "" : option.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(CHIP_CLASS, selected && CHIP_SELECTED_CLASS)}
            >
              <AnimatePresence initial={false}>
                {selected && (
                  <motion.span
                    key="check"
                    aria-hidden
                    variants={chipVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="-ml-0.5 flex"
                  >
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </motion.span>
                )}
              </AnimatePresence>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CHIP_CLASS = cn(
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E0E0E0] bg-white px-3.5 text-sm text-[#353535]",
  "transition-[background-color,border-color,color,box-shadow] duration-200 ease-[var(--ease-spark)]",
  "hover:border-[#03535F]/40 hover:bg-[#EEF6F6]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F]",
);

const CHIP_SELECTED_CLASS =
  "border-[#03535F] bg-[#03535F] text-white hover:border-[#076573] hover:bg-[#076573]";

export function CodeInput({
  id,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <Field id={id} label="6-digit code" error={error}>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        disabled={disabled}
        {...fieldA11y(id, error)}
        className={cn(INPUT_CLASS, "text-center font-mono text-xl tracking-[0.5em]")}
      />
    </Field>
  );
}

export function CheckRow({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#4B4B4B]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 size-4 shrink-0 cursor-pointer accent-[#03535F]"
      />
      <span>{children}</span>
    </label>
  );
}

/** Shown in place of an emailed code when no mail provider is configured. */
export function DevCodeNotice({ code }: { code: string | null }) {
  if (!code) return null;
  return (
    <p className="rounded-lg border border-[#AA821D]/30 bg-[#FFEDB0]/60 px-3 py-2 text-xs text-[#6B5212]">
      <strong className="font-semibold">Development only.</strong> No mail
      provider is configured, so the code is shown here:{" "}
      <span className="font-mono text-sm font-bold tracking-widest">{code}</span>
    </p>
  );
}
