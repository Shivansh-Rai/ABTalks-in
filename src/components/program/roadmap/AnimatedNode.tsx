"use client";

import { motion } from "framer-motion";
import { useSafeReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function AnimatedNode({
  active,
  accent,
  accentRgb,
}: {
  active: boolean;
  accent: string;
  accentRgb: string;
}) {
  const reduceMotion = useSafeReducedMotion();

  return (
    <motion.div
      className="relative z-10 flex size-12 shrink-0 items-center justify-center md:size-14"
      initial={false}
      animate={{
        scale: active && !reduceMotion ? 1 : reduceMotion && active ? 1 : 0.92,
      }}
      transition={
        reduceMotion
          ? { duration: 0.15 }
          : { duration: 0.18, ease }
      }
      style={
        active
          ? {
              boxShadow: `0 0 24px rgba(${accentRgb}, 0.55), 0 0 8px rgba(${accentRgb}, 0.35)`,
            }
          : undefined
      }
    >
      <motion.div
        className={cn(
          "flex size-full items-center justify-center rounded-full border-[3px] bg-[radial-gradient(circle,rgba(62,34,111,1)_0%,rgba(0,0,0,1)_100%)]",
        )}
        animate={{
          borderColor: active ? accent : "#1E1B37",
        }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease }}
      >
        <motion.span
          className="size-3 rounded-full md:size-3.5"
          animate={{
            backgroundColor: active ? accent : "rgba(255,255,255,0.15)",
            scale: active && !reduceMotion ? [1, 1.2, 1] : 1,
          }}
          transition={
            reduceMotion
              ? { duration: 0.15 }
              : { duration: 0.18, ease }
          }
        />
      </motion.div>
    </motion.div>
  );
}
