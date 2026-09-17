"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { dsButtonVariants } from "@/components/design/ds-button";
import { cn } from "@/lib/utils";
import { CLAY_CTA } from "./onboarding-shell";
import {
  PERSPECTIVE_PX,
  stepVariants,
  staggerItem,
  type StepMotion,
} from "./motion";

/*
 * One card in the onboarding stack.
 *
 * Every step renders through this, so every step enters, exits and staggers
 * the same way: eyebrow + heading, then the description, then each field
 * group the step wraps in <StaggerItem>, then the actions. The card is a form,
 * so Enter in any field is the primary action.
 *
 * A card on its way out is `inert` — it cannot be clicked or focused while it
 * fades, so a fast double-click never acts on the step being left.
 */

/** Stacks the entering and leaving cards in one grid cell, in perspective. */
export function OnboardingStage({
  motion: stepMotion,
  children,
}: {
  motion: StepMotion;
  children: ReactNode;
}) {
  return (
    <div
      className="grid [grid-template-areas:'stack']"
      style={stepMotion.mode === "depth" ? { perspective: PERSPECTIVE_PX } : undefined}
    >
      <AnimatePresence initial custom={stepMotion}>
        {children}
      </AnimatePresence>
    </div>
  );
}

// Two plates peeking out below the card (negative-spread shadows, so they
// move with the card for free), then a soft teal-tinted elevation.
const CARD_DEPTH =
  "sm:shadow-[0_9px_0_-4px_#FFFFFF,0_10px_0_-3px_#E9E9E9,0_18px_0_-10px_#FFFFFF,0_19px_0_-9px_#EFEFEF,0_28px_56px_-32px_rgba(16,41,44,0.22)]";

type StepProps = {
  motion: StepMotion;
  eyebrow: string;
  title: string;
  description?: ReactNode;
  /** Field groups, each wrapped in <StaggerItem>. */
  children?: ReactNode;
  actions: ReactNode;
  onSubmit: () => void;
  /** Move focus to the heading on mount — every step change but the first. */
  focusHeading?: boolean;
  /** Quiet line under the actions ("Already have an account?"). */
  footer?: ReactNode;
};

export function OnboardingStep({
  motion: stepMotion,
  eyebrow,
  title,
  description,
  children,
  actions,
  onSubmit,
  focusHeading = false,
  footer,
}: StepProps) {
  const isPresent = useIsPresent();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (focusHeading) headingRef.current?.focus({ preventScroll: true });
    // Mount only: focus follows the step, not every re-render of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.form
      noValidate
      custom={stepMotion}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      inert={!isPresent}
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault();
        if (isPresent) onSubmit();
      }}
      className={cn(
        "relative flex flex-col [grid-area:stack] self-start bg-white",
        "sm:rounded-2xl sm:border sm:border-[#E9E9E9] sm:p-8 lg:p-10",
        CARD_DEPTH,
      )}
    >
      <motion.div variants={staggerItem}>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#0E7F8A]">
          {eyebrow}
        </p>
        <h1
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="mt-3 font-heading text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#10292C] outline-none sm:text-[36px] lg:text-[40px]"
        >
          {title}
        </h1>
      </motion.div>

      {description && (
        <motion.div
          variants={staggerItem}
          className="mt-3 text-[15px] leading-[1.6] text-[#5A5A5A] sm:text-base"
        >
          {description}
        </motion.div>
      )}

      {children && <div className="mt-7 space-y-6">{children}</div>}

      <motion.div
        variants={staggerItem}
        className={cn(
          // Phones and tablets: pinned to the bottom of the screen while a long
          // step scrolls. Phones also keep it clear of the fixed chat bubble in
          // the corner (a tablet's centred card never reaches it).
          "sticky bottom-0 z-10 -mx-5 mt-8 border-t border-[#F0F0F0] bg-white px-5 pb-[max(env(safe-area-inset-bottom),14px)] pr-[84px] pt-3.5",
          "sm:-mx-8 sm:px-8 sm:pb-6 sm:pr-8",
          "lg:static lg:mx-0 lg:border-0 lg:px-0 lg:pb-0 lg:pt-0 lg:pr-0",
        )}
      >
        {actions}
      </motion.div>

      {footer && (
        <motion.div variants={staggerItem} className="mt-5 text-sm text-[#626262]">
          {footer}
        </motion.div>
      )}
    </motion.form>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

export function OnboardingNavigation({
  onBack,
  primaryLabel,
  pending = false,
  secondary,
}: {
  onBack?: () => void;
  primaryLabel: string;
  pending?: boolean;
  /** A quieter action beside the primary one ("Skip for now"). */
  secondary?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="-ml-2 inline-flex h-12 items-center gap-1.5 rounded-[12px] px-3 text-[15px] font-medium text-[#626262] transition-colors duration-200 hover:bg-[#F4F4F4] hover:text-[#161616] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F] disabled:opacity-50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        {secondary}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={cn(dsButtonVariants({ size: "lg" }), "group min-w-[132px] gap-2 sm:min-w-[160px]", CLAY_CTA)}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {primaryLabel}
          {!pending && (
            <ArrowRight
              className="size-4 transition-transform duration-200 ease-[var(--ease-spark)] group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          )}
        </button>
      </div>
    </div>
  );
}

/** Secondary text button for a step's action row. */
export const QUIET_BUTTON =
  "inline-flex h-12 items-center rounded-[12px] px-3 text-[15px] font-medium text-[#626262] transition-colors duration-200 hover:bg-[#F4F4F4] hover:text-[#161616] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F] disabled:opacity-50";

export const TEXT_LINK =
  "font-semibold text-[#03535F] underline-offset-2 transition-colors hover:text-[#076573] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F] rounded-sm";
