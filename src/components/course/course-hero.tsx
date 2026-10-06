import Link from "next/link";
import type { OrbitVisual } from "@/features/courses/types";
import { OrbitLoop } from "./visuals/orbit-loop";
import { CourseStartButton } from "./course-start-button";

type Props = {
  course: string;
  modules: string[];
  eyebrow: string;
  title: string;
  tagline: string;
  meta: string;
  orbit: OrbitVisual;
};

/** Green interactive course header. Server component; the orbit is a client island. */
export function CourseHero({ course, modules, eyebrow, title, tagline, meta, orbit }: Props) {
  return (
    <header className="crs-hero">
      <div className="crs-hero-copy">
        <span className="crs-hero-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="crs-hero-tagline">{tagline}</p>
        <p className="crs-hero-meta">{meta}</p>
        <div className="crs-hero-cta">
          <CourseStartButton course={course} modules={modules} />
          <Link href="#modules" className="crs-btn crs-btn-ghost">
            See all modules
          </Link>
        </div>
      </div>
      <div className="crs-hero-visual">
        <OrbitLoop config={orbit} tone="dark" />
      </div>
    </header>
  );
}
