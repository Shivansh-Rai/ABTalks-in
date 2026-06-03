import { ContentViewer } from "@/components/admin/content-viewer";
import { getContent } from "@/features/admin/get-content";

export default async function AdminContentPage() {
  const data = await getContent();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Content Viewer</h1>
        <p className="text-sm text-muted-foreground">
          Read-only content from seeded challenge problems and quizzes.
        </p>
      </div>

      <ContentViewer problems={data.problems} quizzes={data.quizzes} />
    </div>
  );
}
