import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { loadLegalMarkdown } from "@/lib/legal";

import { EcosystemPageHeader } from "@/components/shared/ecosystem-page-header";

export const metadata: Metadata = {
  title: "Privacy Policy · ABTalks",
  description: "ABTalks Privacy Policy",
};

export default async function PrivacyPage() {
  const markdown = await loadLegalMarkdown("privacy");
  return (
    <div className="min-h-svh bg-background">
      <EcosystemPageHeader />
      <LegalDocument markdown={markdown} />
    </div>
  );
}
