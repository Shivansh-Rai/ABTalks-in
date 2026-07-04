"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { COHORT_REGISTER_ONBOARDING_KEY } from "@/components/talent-hunt/constants";

type Props = {
  children: ReactNode;
};

export function ApplyGate({ children }: Props) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(COHORT_REGISTER_ONBOARDING_KEY) === "1") {
      setAllowed(true);
      return;
    }
    router.replace("/ai-cohort-register");
  }, [router]);

  if (!allowed) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading application…</span>
      </div>
    );
  }

  return children;
}
