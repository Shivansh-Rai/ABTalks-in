import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { COURSES, getCourse } from "@/features/courses/registry";
import { CourseFrame } from "@/components/course/course-frame";
import { BlockRenderer } from "@/components/course/block-renderer";
import { ModuleComplete } from "@/components/course/module-complete";

const Params = z.object({ course: z.string().min(1).max(64), module: z.string().min(1).max(64) });
type RouteParams = { params: Promise<{ course: string; module: string }> };

export function generateStaticParams() {
  return COURSES.flatMap((c) => c.modules.map((m) => ({ course: c.slug, module: m.slug })));
}

async function resolve(params: RouteParams["params"]) {
  const parsed = Params.safeParse(await params);
  if (!parsed.success) return null;
  const course = getCourse(parsed.data.course);
  const idx = course?.modules.findIndex((m) => m.slug === parsed.data.module) ?? -1;
  if (!course || idx < 0) return null;
  return { course, idx, mod: course.modules[idx] };
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const r = await resolve(params);
  return r ? { title: `${r.mod.title}, ${r.course.title} | ABTalks Learn`, description: r.mod.summary } : {};
}

export default async function CourseModulePage({ params }: RouteParams) {
  const r = await resolve(params);
  if (!r) notFound();
  const { course, idx, mod } = r;
  const prev = course.modules[idx - 1];
  const next = course.modules[idx + 1];
  const modules = course.modules.map(({ slug, number, title, minutes, blocks }) => ({
    slug,
    number,
    title,
    minutes,
    sections: blocks
      .flatMap((b) => (b.type === "h2" ? [b] : []))
      .map((b, i) => ({ id: b.id, text: `${number}.${i + 1} ${b.text}` })),
  }));

  return (
    <CourseFrame courseSlug={course.slug} courseTitle={course.title} modules={modules} current={mod.slug}>
      <article className="crs-article">
        <p style={{ fontSize: "0.8rem", color: "var(--c-mu)", textTransform: "uppercase", letterSpacing: ".06em", margin: 0 }}>
          Module {mod.number} of {course.modules.length} · ~{mod.minutes} min read
        </p>
        <h1>{mod.title}</h1>
        <p style={{ fontSize: "1.08rem", color: "var(--c-mu)" }}>{mod.summary}</p>
        <BlockRenderer blocks={mod.blocks} course={course.slug} module={mod.slug} moduleNumber={mod.number} />
        <ModuleComplete course={course.slug} module={mod.slug} />
        <nav aria-label="Module navigation" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
          {prev ? (
            <Link className="crs-btn crs-btn-ghost" style={{ textDecoration: "none" }} href={`/learn/${course.slug}/${prev.slug}`}>
              ← {prev.number}. {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link className="crs-btn" style={{ textDecoration: "none" }} href={`/learn/${course.slug}/${next.slug}`}>
              {next.number}. {next.title} →
            </Link>
          ) : (
            <Link className="crs-btn" style={{ textDecoration: "none" }} href={`/learn/${course.slug}`}>
              Back to course overview
            </Link>
          )}
        </nav>
      </article>
    </CourseFrame>
  );
}
