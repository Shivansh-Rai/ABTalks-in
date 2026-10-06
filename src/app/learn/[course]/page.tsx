import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { COURSES, getCourse } from "@/features/courses/registry";
import { CourseFrame } from "@/components/course/course-frame";
import { CourseHero } from "@/components/course/course-hero";

const Params = z.object({ course: z.string().min(1).max(64) });

export function generateStaticParams() {
  return COURSES.map((c) => ({ course: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }): Promise<Metadata> {
  const parsed = Params.safeParse(await params);
  const course = parsed.success ? getCourse(parsed.data.course) : null;
  return course ? { title: `${course.title} | ABTalks Learn`, description: course.tagline } : {};
}

export default async function CourseOverviewPage({ params }: { params: Promise<{ course: string }> }) {
  const parsed = Params.safeParse(await params);
  const course = parsed.success ? getCourse(parsed.data.course) : null;
  if (!course) notFound();

  const modules = course.modules.map(({ slug, number, title, minutes, blocks }) => ({
    slug,
    number,
    title,
    minutes,
    sections: blocks
      .flatMap((b) => (b.type === "h2" ? [b] : []))
      .map((b, i) => ({ id: b.id, text: `${number}.${i + 1} ${b.text}` })),
  }));
  const totalMinutes = course.modules.reduce((s, m) => s + m.minutes, 0);

  return (
    <CourseFrame courseSlug={course.slug} courseTitle={course.title} modules={modules}>
      <article className="crs-article">
        <CourseHero
          course={course.slug}
          modules={modules.map((m) => m.slug)}
          eyebrow={`Free course · ${course.modules.length} modules · ~${Math.round(totalMinutes / 60)} hours`}
          title={course.title}
          tagline={course.tagline}
          meta={course.level}
          orbit={course.hero}
        />
        <p>{course.description}</p>

        <h2 id="outcomes">What you will be able to do</h2>
        <ul>
          {course.outcomes.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>

        <h2 id="modules">Modules</h2>
        <ol style={{ listStyle: "none", padding: 0 }}>
          {course.modules.map((m) => (
            <li key={m.slug} className="crs-frame" style={{ margin: "12px 0" }}>
              <Link href={`/learn/${course.slug}/${m.slug}`} style={{ textDecoration: "none" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--c-mu)" }}>
                  Module {m.number} · ~{m.minutes} min
                </span>
                <span style={{ display: "block", fontWeight: 700, fontSize: "1.08rem", color: "var(--c-pri)" }}>{m.title}</span>
                <span style={{ display: "block", fontSize: "0.92rem", color: "var(--c-fg)" }}>{m.summary}</span>
              </Link>
            </li>
          ))}
        </ol>
        <h2 id="skills">Skills you will have by the end</h2>
        <p>Complete all {course.modules.length} modules and these are the skills this course builds, ready to list on your profile:</p>
        <ul className="crs-skills">
          {course.skills.map((sk) => (
            <li key={sk}>{sk}</li>
          ))}
        </ul>
      </article>
    </CourseFrame>
  );
}
