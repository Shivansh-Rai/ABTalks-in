"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type View = "profile" | "diagnosis";

/**
 * Avatar row + Profile/Diagnosis switch. Career and diagnosis stay Server
 * Components and arrive as children; this file only toggles which is shown.
 */
export function CandidateDetailViewSwitch({
  avatar,
  badges,
  profile,
  diagnosis,
}: {
  avatar: ReactNode;
  badges: ReactNode;
  profile: ReactNode;
  diagnosis: ReactNode;
}) {
  const [view, setView] = useState<View>("profile");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {avatar}
        <div
          role="tablist"
          aria-label="Candidate view"
          className="inline-flex h-11 min-h-11 shrink-0 items-stretch rounded-lg border border-[#E9E9E9] bg-white p-0.5"
        >
          <ViewTab
            selected={view === "profile"}
            onSelect={() => setView("profile")}
          >
            Profile
          </ViewTab>
          <ViewTab
            selected={view === "diagnosis"}
            onSelect={() => setView("diagnosis")}
          >
            Diagnosis
          </ViewTab>
        </div>
        {badges}
      </div>

      {view === "profile" ? profile : diagnosis}
    </div>
  );
}

function ViewTab({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "min-h-10 min-w-[5.5rem] rounded-md px-3 text-sm font-medium transition-colors",
        selected
          ? "bg-[#03535F] text-white"
          : "text-[#787878] hover:text-[#353535]",
      )}
    >
      {children}
    </button>
  );
}
