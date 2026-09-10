"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ShieldX } from "lucide-react";

export function RulesSlide() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
      className="rounded-3xl border bg-card/80 p-5 shadow-lg backdrop-blur-sm md:p-6"
    >
      <motion.div className="flex items-center gap-3">
        <motion.div className="rounded-lg bg-[#AA821D]/10 p-1.5">
          <AlertTriangle className="h-4 w-4 text-[#AA821D]" />
        </motion.div>
        <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">
          Community Rules
        </h2>
      </motion.div>

      <p className="mt-2 text-sm text-muted-foreground">
        ABTalks is a place to grow with serious learners. Read these carefully.
      </p>

      <motion.div className="mt-4 space-y-2.5">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-xl border border-[#D92D20]/20 bg-[#D92D20]/5 p-3"
        >
          <motion.div className="flex items-start gap-3">
            <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-[#D92D20]" />
            <motion.div>
              <h3 className="font-display text-sm font-semibold">
                Foul Language or Harassment
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Any abusive language, harassment, or harmful messaging will lead
                to <strong className="text-foreground">permanent ban</strong> from
                ABTalks.
              </p>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="rounded-xl border border-[#AA821D]/20 bg-[#AA821D]/5 p-3"
        >
          <motion.div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#AA821D]" />
            <motion.div>
              <h3 className="font-display text-sm font-semibold">
                Cheating or Platform Misuse
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Submitting plagiarized work or misusing the platform will result
                in a{" "}
                <strong className="text-foreground">60-day challenge ban</strong>.
              </p>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-xs text-muted-foreground"
        >
          By continuing, you agree to follow these rules. Be real, be respectful,
          and ship real work.
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
