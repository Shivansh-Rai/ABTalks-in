import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StudentsFilters } from "@/components/admin/students-filters";
import { StudentsSortSelect } from "@/components/admin/students-sort-select";
import { formatDateIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { getStudentDomainCounts, getStudents } from "@/features/admin/get-students";

function isSortBy(
  value: string | undefined,
): value is "recent" | "days" | "streak" | "referrals" {
  return (
    value === "recent" ||
    value === "days" ||
    value === "streak" ||
    value === "referrals"
  );
}

function domainBadgeClass(domain: string): string {
  if (domain === "AI") return "border-domains-ai/50 bg-domains-ai-bg text-domains-ai";
  if (domain === "DS") return "border-domains-ds/50 bg-domains-ds-bg text-domains-ds";
  if (domain === "CLAUDE")
    return "border-orange-500/40 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200";
  return "border-domains-se/50 bg-domains-se-bg text-domains-se";
}

function statusBadgeClass(status: string): string {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "COMPLETED") return "bg-violet-100 text-violet-700";
  return "bg-muted text-muted-foreground";
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    domain?: "AI" | "DS" | "SE" | "CLAUDE" | "ALL";
    status?: "ALL" | "ACTIVE" | "COMPLETED";
    sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const sortBy = isSortBy(sp.sort) ? sp.sort : "recent";
  const [students, domainCounts] = await Promise.all([
    getStudents({
      search: sp.q,
      domain: sp.domain ?? "ALL",
      status: sp.status ?? "ALL",
      sortBy,
    }),
    getStudentDomainCounts(sp.status ?? "ALL"),
  ]);

  const filteredCount =
    sp.domain && sp.domain !== "ALL"
      ? domainCounts[sp.domain]
      : domainCounts.ALL;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Students</h1>
        <p className="text-sm text-muted-foreground">
          Showing {Math.min(students.length, 100)} of {filteredCount} matching enrollments
          {students.length >= 100 ? " (max 100)" : ""}
        </p>
      </div>

      <StudentsFilters domainCounts={domainCounts} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StudentsSortSelect />
        {sortBy === "referrals" ? (
          <Badge variant="secondary" className="text-xs">
            Ranked by referrals
          </Badge>
        ) : null}
      </div>

      <div className="space-y-2 md:hidden">
        {students.map((student) => (
          <article
            key={student.enrollmentId}
            className="rounded-xl border bg-card p-3 text-sm"
          >
            <header className="flex items-start justify-between gap-2">
              <Link
                href={`/admin/students/${student.userId}`}
                className="font-medium underline"
              >
                {student.fullName}
              </Link>
              <Badge variant="outline" className={domainBadgeClass(student.domain)}>
                {student.domain}
              </Badge>
            </header>
            <p className="mt-1 text-xs text-muted-foreground">{student.email}</p>
            <p className="mt-2 text-xs">
              Days {student.daysCompleted}/60 · {student.currentStreak}d streak
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {student.affiliation}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{student.userType}</Badge>
              <Badge className={cn("border-0", statusBadgeClass(student.status))}>
                {student.status}
              </Badge>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" aria-hidden />
                {student.referralCount} referrals
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Affiliation</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Streak</TableHead>
              <TableHead>Referrals</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.enrollmentId}>
                <TableCell>
                  <Link href={`/admin/students/${student.userId}`} className="font-medium underline">
                    {student.fullName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{student.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{student.userType}</Badge>
                </TableCell>
                <TableCell className="max-w-[12rem] truncate text-sm">
                  {student.affiliation}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={domainBadgeClass(student.domain)}>
                    {student.domain}
                  </Badge>
                </TableCell>
                <TableCell>{student.daysCompleted}</TableCell>
                <TableCell>{student.currentStreak}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden />
                    {student.referralCount}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={cn("border-0", statusBadgeClass(student.status))}>
                    {student.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateIST(student.joinedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
