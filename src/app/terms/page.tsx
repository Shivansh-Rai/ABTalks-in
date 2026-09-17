import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { loadLegalMarkdown } from "@/lib/legal";

import { EcosystemPageHeader } from "@/components/shared/ecosystem-page-header";

export const metadata: Metadata = {
  title: "Terms of Service · ABTalks",
  description: "ABTalks Terms of Service",
};

export default async function TermsPage() {
  const markdown = await loadLegalMarkdown("terms");
  return (
    <div className="min-h-svh bg-background">
      <EcosystemPageHeader />
      <LegalDocument markdown={markdown} />
    </div>
  );
}
