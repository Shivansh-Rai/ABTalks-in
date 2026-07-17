"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Per-step screenshots live at public/program/build-steps/day-{dayNumber}/step-{stepNumber}.png */
export function buildStepImagePath(dayNumber: number, stepNumber: number): string {
  return `/program/build-steps/day-${dayNumber}/step-${stepNumber}.png`;
}

export function DayBuildStepImage({
  dayNumber,
  stepNumber,
  onPresentChange,
}: {
  dayNumber: number;
  stepNumber: number;
  onPresentChange?: (present: boolean) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const [open, setOpen] = useState(false);
  const src = buildStepImagePath(dayNumber, stepNumber);
  const alt = `Build step ${stepNumber} screenshot`;

  useEffect(() => {
    setStatus("loading");
    setOpen(false);
  }, [src]);

  useEffect(() => {
    onPresentChange?.(status === "ready");
  }, [status, onPresentChange]);

  if (status === "missing") return null;

  return (
    <>
      {/* Hidden probe until the asset loads — avoids empty placeholder chrome */}
      {status === "loading" && (
        <Image
          src={src}
          alt=""
          width={1}
          height={1}
          className="pointer-events-none absolute h-px w-px opacity-0"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("missing")}
        />
      )}

      {status === "ready" && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative aspect-[4/3] max-h-[140px] w-full cursor-zoom-in overflow-hidden rounded-[12px] border border-[#8365E3]/40 bg-[#110528] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#968BEC]"
            aria-label={`Enlarge step ${stepNumber} screenshot`}
          >
            <Image
              src={src}
              alt={alt}
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 100vw, 340px"
            />
          </button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
              className="max-h-[90vh] w-[min(96vw,1100px)] max-w-[1100px] overflow-hidden border border-[#8365E3] bg-[#110528] p-3 text-white sm:max-w-[1100px] sm:p-4"
              aria-describedby={undefined}
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Step {stepNumber} screenshot</DialogTitle>
              </DialogHeader>
              <div className="relative mx-auto aspect-[16/9] max-h-[min(80vh,720px)] w-full">
                <Image
                  src={src}
                  alt={alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1100px) 96vw, 1100px"
                  priority
                />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
