import { notFound } from "next/navigation";
import { isProgramEnabled } from "@/lib/feature-flags";
import { TalentShell } from "@/components/talent/talent-shell";

export default function TalentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isProgramEnabled()) notFound();

  return <TalentShell>{children}</TalentShell>;
}
