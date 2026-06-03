"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

export type SubmissionTableRow = {
  id: string;
  userId: string;
  studentName: string;
  domain: string;
  dayNumber: number;
  status: string;
  githubUrl: string;
  linkedinUrl: string;
  submittedAt: string;
};

function domainBadgeClass(domain: string): string {
  if (domain === "AI") return "border-domains-ai/50 bg-domains-ai-bg text-domains-ai";
  if (domain === "DS") return "border-domains-ds/50 bg-domains-ds-bg text-domains-ds";
  if (domain === "CLAUDE")
    return "border-orange-500/40 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200";
  return "border-domains-se/50 bg-domains-se-bg text-domains-se";
}

export function SubmissionsTable({ rows }: { rows: SubmissionTableRow[] }) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border bg-card p-3 text-sm">
            <header className="flex items-center justify-between">
              <Link
                href={`/admin/students/${row.userId}`}
                className="font-medium underline"
              >
                {row.studentName}
              </Link>
              <Badge variant="outline" className={domainBadgeClass(row.domain)}>
                {row.domain}
              </Badge>
            </header>
            <p className="mt-1 text-xs text-muted-foreground">
              Day {row.dayNumber} · {row.status} ·{" "}
              {formatDateTimeIST(new Date(row.submittedAt))}
            </p>
            <div className="mt-2 flex gap-3 text-xs">
              <a
                href={row.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                GitHub
              </a>
              <a
                href={row.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                LinkedIn
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>GitHub</TableHead>
              <TableHead>LinkedIn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDateTimeIST(new Date(row.submittedAt))}</TableCell>
                <TableCell>
                  <Link href={`/admin/students/${row.userId}`} className="underline">
                    {row.studentName}
                  </Link>
                </TableCell>
                <TableCell>{row.dayNumber}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={domainBadgeClass(row.domain)}>
                    {row.domain}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      "border-0",
                      row.status === "ON_TIME" || row.status === "LATE"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {row.status === "LATE" ? "ON_TIME" : row.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <a
                    href={row.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    Open <ExternalLink className="size-3" />
                  </a>
                </TableCell>
                <TableCell>
                  <a
                    href={row.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    Open <ExternalLink className="size-3" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
