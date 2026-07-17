"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Circle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckItem = {
  check: string;
  passed: boolean | null;
  detail?: string;
};

type Props = {
  items: CheckItem[];
  running?: boolean;
  className?: string;
};

function StatusIcon({
  passed,
  running,
}: {
  passed: boolean | null;
  running: boolean;
}) {
  if (running) {
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
  }
  if (passed === true) {
    return <Check className="size-4 shrink-0 text-emerald-500" />;
  }
  if (passed === false) {
    return <X className="size-4 shrink-0 text-rose-500" />;
  }
  return <Circle className="size-3 shrink-0 text-muted-foreground/50" />;
}

function CheckRow({
  item,
  index,
  running,
  reduceMotion,
}: {
  item: CheckItem;
  index: number;
  running: boolean;
  reduceMotion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!item.detail;

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduceMotion ? { duration: 0 } : { delay: index * 0.15, duration: 0.2 }}
      className="rounded-md"
    >
      <button
        type="button"
        onClick={() => hasDetail && setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
          hasDetail ? "hover:bg-muted/60" : "cursor-default",
        )}
        aria-expanded={hasDetail ? open : undefined}
      >
        <StatusIcon passed={item.passed} running={running} />
        <span
          className={cn(
            "flex-1",
            item.passed === false ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {item.check}
        </span>
        {hasDetail && (
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>
      {hasDetail && open && (
        <p className="ml-8 pb-2 pr-2 font-mono text-xs text-muted-foreground">
          {item.detail}
        </p>
      )}
    </motion.li>
  );
}

export function CheckList({ items, running = false, className }: Props) {
  const reduceMotion = useReducedMotion() ?? false;

  if (items.length === 0) {
    return (
      <p className={cn("px-2 py-4 text-sm text-muted-foreground", className)}>
        No checks to show yet.
      </p>
    );
  }

  return (
    <ul className={cn("space-y-0.5", className)}>
      {items.map((item, i) => (
        <CheckRow
          key={`${item.check}-${i}`}
          item={item}
          index={i}
          running={running && item.passed === null}
          reduceMotion={reduceMotion}
        />
      ))}
    </ul>
  );
}
