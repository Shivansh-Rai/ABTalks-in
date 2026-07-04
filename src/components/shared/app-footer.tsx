"use client";

import { Mail } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AppFooter() {
  const pathname = usePathname();
  const isMarketplace =
    pathname === "/marketplace" || pathname.startsWith("/marketplace/");
  const isWorkshop =
    pathname === "/ai-workshop" || pathname.startsWith("/ai-workshop/");
  const isCohortRegister =
    pathname === "/ai-cohort-register" ||
    pathname.startsWith("/ai-cohort-register/");
  const supportEmail = "team@abtalks.in";

  if (isWorkshop || isCohortRegister) return null;

  return (
    <footer
      className={cn(
        "mt-auto border-t pb-16 backdrop-blur-sm md:pb-0",
        isMarketplace
          ? "border-[#030712] bg-[#050C1D] text-white/80"
          : "bg-card/50 text-muted-foreground",
      )}
    >
      <div className="container mx-auto px-6 py-6">
        <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
          <div
            className={cn(
              "font-display font-medium",
              isMarketplace ? "text-white" : "text-foreground",
            )}
          >
            ABTalks
            <span
              className={cn(
                "ml-2 font-normal",
                isMarketplace ? "text-white/60" : "text-muted-foreground/70",
              )}
            >
              60-Day Coding Challenge
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>For any issue or enquiry:</span>
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-primary hover:underline"
            >
              {supportEmail}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
