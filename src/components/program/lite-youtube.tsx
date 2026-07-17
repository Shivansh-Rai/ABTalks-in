"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Lite embed: show the thumbnail until the user clicks, then mount the iframe.
// Avoids loading the heavy YouTube player on every day page.
export function LiteYoutube({
  youtubeId,
  title,
  className,
}: {
  youtubeId: string;
  title: string;
  className?: string;
}) {
  const [active, setActive] = useState(false);

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-black", className)}>
      <div className="relative aspect-video">
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <PlayCircle className="size-14 text-white drop-shadow-lg" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
