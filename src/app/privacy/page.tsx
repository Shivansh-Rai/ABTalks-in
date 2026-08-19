import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { loadLegalMarkdown } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy · ABTalks",
  description: "ABTalks Privacy Policy",
};

export default async function PrivacyPage() {
  const markdown = await loadLegalMarkdown("privacy");
  return (
    <div className="min-h-svh bg-background">
      <div className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="font-display text-sm font-semibold text-foreground">
            ABTalks
          </Link>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy/requests" className="hover:text-foreground">
              Data requests
            </Link>
          </div>
        </div>
      </div>
      <LegalDocument markdown={markdown} />
    </div>
  );
}
