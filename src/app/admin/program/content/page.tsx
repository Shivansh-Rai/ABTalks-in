import { getProgramContentTree } from "@/features/program/admin";

export default async function AdminProgramContentPage() {
  const { modules, exercises } = await getProgramContentTree();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Program content
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only seed viewer — edit JSON under prisma/content/program/.
        </p>
      </header>

      <div className="space-y-6">
        {modules.map((mod) => (
          <section key={mod.number} className="rounded-xl border p-4">
            <h2 className="font-semibold">
              Module {mod.number}: {mod.title}
            </h2>
            <p className="text-sm text-muted-foreground">{mod.subtitle}</p>
            <ul className="mt-4 space-y-2">
              {mod.days.map((day) => (
                <li
                  key={day.dayNumber}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    Day {day.dayNumber}: {day.title}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {day.missionType} · {day.missionPoints} pts ·{" "}
                    {day._count.conceptQuestions} concept Qs ·{" "}
                    {day._count.videos} videos
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">Arena exercises</h2>
        <ul className="space-y-1 text-sm">
          {exercises.map((ex) => (
            <li key={ex.slug}>
              M{ex.moduleNumber} · {ex.title} ({ex.language}) — {ex.slug}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
