"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Matches Tailwind's `lg` breakpoint — keep the two in sync. */
const DESKTOP_QUERY = "(min-width: 1024px)";

type Props = {
  /** Inline PDF URL, already built by the server. */
  previewSrc: string;
  certificateId: string;
};

export function CertificatePreviewPanel({ previewSrc, certificateId }: Props) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return (
    <Card className="flex min-w-0 flex-col lg:h-full">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="text-base sm:text-lg">Certificate preview</CardTitle>
        <CardDescription>
          The certificate exactly as issued to the recipient.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 p-4 sm:p-6">
        {isDesktop ? (
          <div className="relative aspect-[3/2] w-full flex-1 overflow-hidden rounded-lg border bg-muted lg:aspect-auto lg:min-h-0">
            {!loaded ? (
              <Skeleton className="absolute inset-0 rounded-none" />
            ) : null}
            <iframe
              src={previewSrc}
              title={`Certificate ${certificateId}`}
              onLoad={() => setLoaded(true)}
              className="relative size-full"
            />
          </div>
        ) : null}

        <a
          href={previewSrc}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-auto w-full sm:w-auto",
          )}
        >
          <ExternalLink className="mr-2 size-4" aria-hidden />
          {/* Desktop: escape hatch when the browser's PDF viewer is disabled.
              Mobile: this IS the preview — iframed PDFs are unreliable there. */}
          Open certificate preview
        </a>
      </CardContent>
    </Card>
  );
}
