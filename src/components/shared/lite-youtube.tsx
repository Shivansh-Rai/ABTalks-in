"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCookieConsent } from "@/components/legal/cookie-consent-provider";

// Lite embed: show the thumbnail until the user clicks, then mount the iframe.
// Avoids loading the heavy YouTube player on every day page.
//
// The thumbnail is served by i.ytimg.com, so rendering it contacts Google
// before the user has asked for the video. It therefore loads only when the
// visitor chose "Allow all"; otherwise we draw a local placeholder and nothing
// leaves the browser until they press play.
export function LiteYoutube({
  youtubeId,
  title,
  className,
  compact = false,
}: {
  youtubeId: string;
  title: string;
  className?: string;
  compact?: boolean;
}) {
  const [active, setActive] = useState(false);
  const { choice } = useCookieConsent();
  const allowThumbnail = choice === "all";

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-black", className)}>
      <div className={cn("relative w-full", compact ? "aspect-video max-h-[160px]" : "aspect-video")}>
        {active ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setActive(true)}
            className="group absolute inset-0 h-full w-full"
            aria-label={`Play ${title}`}
          >
            {allowThumbnail ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
                alt=""
                className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
              />
            ) : (
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-br from-zinc-800 to-zinc-950"
              />
            )}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <PlayCircle className={cn("text-white drop-shadow-lg", compact ? "size-10" : "size-14")} />
              {!allowThumbnail && !compact && (
                <span className="px-4 text-center text-[11px] leading-snug text-white/60">
                  Click to load from YouTube
                </span>
              )}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
