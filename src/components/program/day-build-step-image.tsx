"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "lucide-react";

/** Per-step screenshots live at public/program/build-steps/day-{dayNumber}/step-{stepNumber}.png */
export function buildStepImagePath(dayNumber: number, stepNumber: number): string {
  return `/program/build-steps/day-${dayNumber}/step-${stepNumber}.png`;
}

export function DayBuildStepImage({
  dayNumber,
  stepNumber,
}: {
  dayNumber: number;
  stepNumber: number;
}) {
  const [missing, setMissing] = useState(false);
  const src = buildStepImagePath(dayNumber, stepNumber);

  return (
    <div className="relative aspect-[4/3] max-h-[140px] w-full overflow-hidden rounded-[12px] border border-[#8365E3]/40 bg-[#110528]">
      {missing ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[#8F8F8F]">
          <ImageIcon className="size-8 text-[#8365E3]/60" aria-hidden />
          <p>Step screenshot</p>
          <p className="text-xs text-[#636363]">
            Add{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 text-[#968BEC]">
              public/program/build-steps/day-{dayNumber}/step-{stepNumber}.png
            </code>
          </p>
        </div>
      ) : (
        <Image
          src={src}
          alt={`Build step ${stepNumber} screenshot`}
          fill
          className="object-cover object-top"
          sizes="(max-width: 768px) 100vw, 340px"
          onError={() => setMissing(true)}
        />
      )}
    </div>
  );
}
