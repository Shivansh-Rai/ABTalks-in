import Link from "next/link";
import { Suspense } from "react";
import { HackathonMasterFilters } from "@/components/admin/hackathon-master-filters";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getHackathonMasterStudents,
  parseHackathonMasterCohort,
} from "@/features/hackathon/get-master-students";
import { cn } from "@/lib/utils";

export default async function AdminHackathonMasterStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const sp = await searchParams;
  const cohort = parseHackathonMasterCohort(sp.cohort);
  const data = await getHackathonMasterStudents({ cohort });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            Hackathon Master Student Data
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.total} student{data.total !== 1 ? "s" : ""} · Sorted by recently joined
          </p>
        </div>
        <Link
          href="/admin/hackathon"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to Hackathon
        </Link>
      </div>

      <Suspense fallback={null}>
        <HackathonMasterFilters />
      </Suspense>

      {data.students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students found</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>College</TableHead>
                <TableHead>Type (Solo/Team)</TableHead>
                <TableHead>Team Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.students.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.fullName}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>{row.college}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.entryType}</Badge>
                  </TableCell>
                  <TableCell>{row.teamName ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
