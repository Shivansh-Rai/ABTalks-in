import {
  Briefcase,
  Code2,
  Layers,
  LineChart,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const audiences = [
  { icon: Code2, label: "Software Engineers" },
  { icon: LineChart, label: "Data & Analytics" },
  { icon: Briefcase, label: "Product Managers" },
  { icon: Layers, label: "Solution Architects" },
  { icon: Users, label: "Technology Consultants" },
] as const;

type Props = {
  compact?: boolean;
};

export function WhoThisIsFor({ compact = false }: Props) {
  return (
    <section className={cn("px-4", compact ? "py-4 md:py-6" : "py-16")}>
      <div className="container mx-auto max-w-4xl text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Who This Is For
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          U.S.-based working professionals who are committed to advancing their
          careers in applied AI.
        </p>

        <div
          className={cn(
            "mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6",
            compact ? "mt-6" : "mt-10",
          )}
        >
          {audiences.map(({ icon: Icon, label }, index) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left shadow-[var(--shadow-card)] lg:col-span-2",
                index === 3 && "lg:col-start-2",
                index === 4 && "lg:col-start-4",
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-4 text-primary" aria-hidden />
              </div>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>

        <p
          className={cn(
            "mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground",
            compact ? "mt-6" : "mt-8",
          )}
        >
          Whether you are pivoting from software engineering, strengthening your
          machine learning expertise, or leading AI adoption as a product manager
          or architect, this cohort is for professionals ready to commit and ship
          production-grade AI work.
        </p>
      </div>
    </section>
  );
}
