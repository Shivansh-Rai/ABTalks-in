import type { Course } from "./types";
import { agenticAiCourse } from "./agentic-ai/course";

/** All published courses. Add a new course by adding its folder and one line here. */
export const COURSES: Course[] = [agenticAiCourse];

export function getCourse(slug: string): Course | null {
  return COURSES.find((c) => c.slug === slug) ?? null;
}
