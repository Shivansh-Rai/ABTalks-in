import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { loadLegalMarkdown } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service · ABTalks",
  description: "ABTalks Terms of Service",
};

export default async function TermsPage() {
  const markdown = await loadLegalMarkdown("terms");
  return (
    <div className="min-h-svh bg-background">
      <div className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="font-display text-sm font-semibold text-foreground">
            ABTalks
          </Link>
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
      <LegalDocument markdown={markdown} />
    </div>
  );
}
