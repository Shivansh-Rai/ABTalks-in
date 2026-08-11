import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { ManageCookiesButton } from "@/components/legal/manage-cookies-button";
import { loadLegalMarkdown } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookie Policy · ABTalks",
  description: "How ABTalks uses cookies, and how to change your choice.",
};

export default async function CookiesPage() {
  const markdown = await loadLegalMarkdown("cookies");
  return (
    <div className="min-h-svh bg-background">
      <div className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 md:px-8">
          <Link
            href="/"
            className="font-display text-sm font-semibold text-foreground"
          >
            ABTalks
          </Link>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </div>
      <LegalDocument markdown={markdown} />
      <div className="mx-auto max-w-3xl px-5 pb-14 md:px-8">
        <ManageCookiesButton />
      </div>
    </div>
  );
}
