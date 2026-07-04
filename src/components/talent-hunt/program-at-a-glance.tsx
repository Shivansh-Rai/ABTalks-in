import {
  Briefcase,
  Clock,
  Layers,
  Rocket,
  Target,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

import { cn } from "@/lib/utils";

const stats = [
  {
    icon: Layers,
    value: "4",
    label: "Core Modules",
  },
  {
    icon: Rocket,
    value: "30",
    label: "Days Intensive",
  },
  {
    icon: Briefcase,
    value: "4",
    label: "Live Projects",
  },
  {
    icon: Users,
    value: "50",
    label: "Seats (USA only)",
  },
  {
    icon: Clock,
    value: "2 hrs/day",
    label: "Time Commitment",
  },
  {
    icon: Target,
    value: "1-on-1",
    label: "Mentorship",
  },
] as const;

type Props = {
  compact?: boolean;
};

export function ProgramAtAGlance({ compact = false }: Props) {
  return (
    <section className={cn("px-4", compact ? "py-4 md:py-6" : "py-16")}>
      <div className="container mx-auto max-w-5xl">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Program at a Glance
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Everything you need to go from AI-curious to AI-capable in one focused
          month.
        </p>

        <div
          className={cn(
            "grid grid-cols-2 gap-4 sm:grid-cols-3",
            compact ? "mt-6 lg:grid-cols-3" : "mt-10 lg:grid-cols-6",
          )}
        >
          {stats.map(({ icon: Icon, value, label }) => (
            <Card
              key={label}
              className="border-border/60 bg-card text-center shadow-[var(--shadow-card)]"
            >
              <CardContent className="flex flex-col items-center gap-2 pt-6 pb-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="size-5 text-primary" aria-hidden />
                </div>
                <div className="font-display text-xl font-bold text-foreground">
                  {value}
                </div>
                <div className="text-xs text-muted-foreground sm:text-sm">
                  {label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
