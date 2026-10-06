"use client";

import Link from "next/link";
import { useCourseProgress } from "./use-course-progress";

/** "Start" on first visit, "Continue with Module N" once progress exists. */
export function CourseStartButton({ course, modules }: { course: string; modules: string[] }) {
  const { progress } = useCourseProgress(course);
  const next = modules.find((m) => !progress.done.includes(m));
  const started = progress.done.length > 0;
  const target = next ?? modules[0];
  const label = !started ? "Start Module 1" : next ? `Continue with Module ${modules.indexOf(next) + 1}` : "Review from Module 1";
  return (
    <Link href={`/learn/${course}/${target}`} className="crs-btn">
      {label} →
    </Link>
  );
}
