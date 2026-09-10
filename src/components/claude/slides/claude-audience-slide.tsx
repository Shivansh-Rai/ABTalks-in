"use client";

import { motion } from "framer-motion";
import {
  Building2,
  ClipboardList,
  Code2,
  Compass,
  FileText,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

const ROLES: {
  icon: LucideIcon;
  title: string;
  desc: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    icon: Code2,
    title: "Developer / Engineer",
    desc: "Code gen, debugging, Claude API, RAG pipelines, VS Code, Claude Code CLI, GitHub",
    iconBg: "bg-[#E7F2F3]",
    iconColor: "text-[#03535F]",
  },
  {
    icon: FileText,
    title: "Business Analyst",
    desc: "BRDs, FRDs, use cases, acceptance criteria, gap analysis, stakeholder simulations",
    iconBg: "bg-[#AA821D]/10",
    iconColor: "text-[#AA821D]",
  },
  {
    icon: Compass,
    title: "Product Manager",
    desc: "PRDs, roadmaps, OKRs, user stories, sprint retros, feedback synthesis",
    iconBg: "bg-[#D92D20]/10",
    iconColor: "text-[#D92D20]",
  },
  {
    icon: ClipboardList,
    title: "Scrum Master",
    desc: "Backlogs, sprint planning, daily standups, retros, velocity reports, burndown charts",
    iconBg: "bg-[#03535F]/10",
    iconColor: "text-[#03535F]",
  },
  {
    icon: Building2,
    title: "Leader / Architect",
    desc: "System design, ADRs, strategic plans, board decks, team benchmarking",
    iconBg: "bg-[#03535F]/10",
    iconColor: "text-[#03535F]",
  },
  {
    icon: GraduationCap,
    title: "Students",
    desc: "B.Tech · BCA · MCA · MBA · Any Graduate. Essays, research, placement prep, projects",
    iconBg: "bg-[#03535F]/10",
    iconColor: "text-[#03535F]",
  },
];

export function ClaudeAudienceSlide() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
      className="rounded-3xl border bg-card/80 p-5 shadow-lg backdrop-blur-sm md:p-6"
    >
      <motion.div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#03535F]/20 bg-[#E7F2F3] px-3 py-1">
        <span className="text-xs">👥</span>
        <span className="text-xs font-semibold text-[#076573]">
          One challenge. Every role.
        </span>
      </motion.div>

      <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">
        Who Is This For?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Zero to Hero: no prior AI experience needed. Day 1 starts from
        scratch.
      </p>

      <motion.div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {ROLES.map((role, i) => {
          const Icon = role.icon;
          return (
            <motion.div
              key={role.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.3 }}
              className="rounded-2xl border bg-background/50 p-3"
            >
              <motion.div
                className={`mb-2 inline-flex rounded-lg p-1.5 ${role.iconBg}`}
              >
                <Icon className={`h-4 w-4 ${role.iconColor}`} />
              </motion.div>
              <h3 className="font-display text-sm font-semibold">
                {role.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {role.desc}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
