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

export type HackathonSubmissionTableRow = {
  id: string;
  teamId: string;
  teamCode: string;
  teamLabel: string;
  entryType: "SOLO" | "TEAM";
  leaderUserId: string | null;
  leaderName: string;
  memberCount: number;
  problemTitle: string | null;
  repoUrl: string;
  liveUrl: string;
  aiLogUrl: string;
  updatedAt: string;
};

function optionalUrl(url: string): string | null {
  const trimmed = url.trim();
  return trimmed ? trimmed : null;
}

function ProofLink({
  href,
  label,
  className,
}: {
  href: string | null;
  label: string;
  className?: string;
}) {
  if (!href) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label}
    </a>
  );
}

function LeaderLink({
  userId,
  name,
}: {
  userId: string | null;
  name: string;
}) {
  if (!userId) {
    return <span>{name}</span>;
  }
  return (
    <Link href={`/admin/students/${userId}`} className="underline">
      {name}
    </Link>
  );
}

export function HackathonSubmissionsTable({
  rows,
}: {
  rows: HackathonSubmissionTableRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        No hackathon submissions yet.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => {
          const liveUrl = optionalUrl(row.liveUrl);
          const aiLogUrl = optionalUrl(row.aiLogUrl);
          return (
            <article
              key={row.id}
              className="rounded-xl border bg-card p-3 text-sm"
            >
              <header className="flex items-center justify-between gap-2">
                <span className="font-medium">{row.teamLabel}</span>
                <Badge variant="outline">{row.entryType}</Badge>
              </header>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.problemTitle ?? "—"} ·{" "}
                {formatDateTimeIST(new Date(row.updatedAt))}
              </p>
              <p className="mt-1 text-xs">
                Leader:{" "}
                <LeaderLink userId={row.leaderUserId} name={row.leaderName} />
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <ProofLink
                  href={row.repoUrl}
                  label="Repo"
                  className="text-primary underline"
                />
                <ProofLink
                  href={liveUrl}
                  label="Live"
                  className="text-primary underline"
                />
                <ProofLink
                  href={aiLogUrl}
                  label="AI log"
                  className="text-primary underline"
                />
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Updated</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Leader</TableHead>
              <TableHead>Brief</TableHead>
              <TableHead>Repo</TableHead>
              <TableHead>Live</TableHead>
              <TableHead>AI Log</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const liveUrl = optionalUrl(row.liveUrl);
              const aiLogUrl = optionalUrl(row.aiLogUrl);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {formatDateTimeIST(new Date(row.updatedAt))}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.teamLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.teamCode} · {row.memberCount}{" "}
                      {row.memberCount === 1 ? "member" : "members"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.entryType}</Badge>
                  </TableCell>
                  <TableCell>
                    <LeaderLink
                      userId={row.leaderUserId}
                      name={row.leaderName}
                    />
                  </TableCell>
                  <TableCell>{row.problemTitle ?? "—"}</TableCell>
                  <TableCell>
                    <a
                      href={row.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline"
                    >
                      Open <ExternalLink className="size-3" />
                    </a>
                  </TableCell>
                  <TableCell>
                    {liveUrl ? (
                      <a
                        href={liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline"
                      >
                        Open <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {aiLogUrl ? (
                      <a
                        href={aiLogUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline"
                      >
                        Open <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
