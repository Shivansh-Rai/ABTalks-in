import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { inspectTalentProject } from "@/features/admin/inspect-talent-project";
import { TalentProjectInspector } from "@/components/admin/talent-project-inspector";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Talent project | ABTalks Admin" };

type Props = { params: Promise<{ requestId: string }> };

/**
 * Read-only admin inspection of one recruiter's talent project (T-278 / TC-A-016).
 *
 * Server Component. It renders no control that can reach a writer: there is no
 * server action imported here or in `TalentProjectInspector`, and no server
 * action is created for this surface at all.
 *
 * `requireAdmin()` is called even though `src/app/admin/layout.tsx` already
 * gates the whole subtree — a privileged read states its own gate rather than
 * inheriting one silently (R2, plan 115 §10).
 *
 * The id comes from `params` only. Nothing about scope is read from the query
 * string; `isolation.test.ts` pins that rule for every detail page in this
 * track.
 *
 * A missing or unknown id is `notFound()`, never a 403 — a 403 would confirm
 * that an id exists.
 */
export default async function AdminTalentProjectPage({ params }: Props) {
  await requireAdmin();
  const { requestId } = await params;

  const project = await inspectTalentProject(requestId);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/hire/projects"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All talent projects
      </Link>

      <header>
        <h1 className="font-display text-2xl font-semibold">{project.label}</h1>
        <p className="text-sm text-muted-foreground">
          {project.owner.email ?? project.owner.userId} · {project.status}
        </p>
      </header>

      <TalentProjectInspector project={project} />
    </div>
  );
}
