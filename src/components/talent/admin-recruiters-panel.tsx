import { Badge } from "@/components/ui/badge";

type RecruiterRow = {
  id: string;
  fullName: string;
  company: string;
  phone: string | null;
  createdAt: string;
  email: string;
  hasWorkspace: boolean;
  openCandidateAsks: number;
};

/**
 * The recruiter directory.
 *
 * This used to be the approval queue: two buttons that flipped
 * `RecruiterProfile.approved` and mailed the applicant. Registering now
 * provisions the workspace outright, so there is nothing here to decide — the
 * panel reports who has signed up and whether their workspace rows landed.
 * A Server Component for the same reason: no state, no actions.
 */
export function AdminRecruitersPanel({
  recruiters,
}: {
  recruiters: RecruiterRow[];
}) {
  if (recruiters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recruiters have registered yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {recruiters.map((row) => (
        <li key={row.id} className="rounded-xl border p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{row.fullName}</p>
              <p className="text-muted-foreground">{row.company}</p>
              <p className="mt-1 break-all text-muted-foreground">{row.email}</p>
              {row.phone && (
                <p className="text-xs text-muted-foreground">
                  Phone: {row.phone}
                </p>
              )}
              {row.openCandidateAsks > 0 && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#AA821D]/10 px-2.5 py-1 text-xs font-medium text-[#AA821D] dark:text-[#FFEDB0]">
                  {row.openCandidateAsks} open introduction request
                  {row.openCandidateAsks === 1 ? "" : "s"} — see Hire
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Registered{" "}
                {new Date(row.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <Badge variant={row.hasWorkspace ? "default" : "secondary"}>
              {row.hasWorkspace ? "Workspace ready" : "No workspace yet"}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
