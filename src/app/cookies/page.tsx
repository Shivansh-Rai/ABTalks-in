import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { ManageCookiesButton } from "@/components/legal/manage-cookies-button";
import { loadLegalMarkdown } from "@/lib/legal";

import { EcosystemPageHeader } from "@/components/shared/ecosystem-page-header";

export const metadata: Metadata = {
  title: "Cookie Policy · ABTalks",
  description: "How ABTalks uses cookies, and how to change your choice.",
};

export default async function CookiesPage() {
  const markdown = await loadLegalMarkdown("cookies");
  return (
    <div className="min-h-svh bg-background">
      <EcosystemPageHeader />
      <LegalDocument markdown={markdown} />
      <div className="mx-auto max-w-3xl px-5 pb-14 md:px-8">
        <ManageCookiesButton />
      </div>
    </div>
  );
}
