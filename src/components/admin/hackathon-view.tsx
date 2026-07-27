"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { updateHackathonProblemStatementAction } from "@/app/actions/admin-hackathon-actions";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminHackathonData } from "@/features/hackathon/get-admin-data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";

type Props = {
  data: AdminHackathonData;
};

export function HackathonView({ data }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [problemStatement, setProblemStatement] = useState(
    data.problemStatement ?? "",
  );
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExport() {
    const rows: Record<string, unknown>[] = [];
    for (const team of data.teams) {
      for (const m of team.members) {
        rows.push({
          teamCode: team.teamCode,
          teamName: team.teamName ?? "",
          entryType: team.entryType,
          slotIndex: m.slotIndex,
          isLeader: m.isLeader,
          fullName: m.fullName,
          email: m.email,
          phone: m.phone,
          college: m.college,
          graduationYear: m.graduationYear,
          teamCreatedAt: team.createdAt,
        });
      }
    }
    if (rows.length === 0) {
      toast.error("No participants to export");
      return;
    }
    const csv = toCSV(rows);
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(`abtalks-hackathon-${date}.csv`, csv);
    toast.success(`Exported ${rows.length} participants`);
  }

  function handleSaveProblem() {
    startTransition(async () => {
      const result = await updateHackathonProblemStatementAction({
        problemStatement,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Problem statement saved");
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Teams" value={data.totalTeams} />
        <Stat label="Participants" value={data.totalParticipants} />
        <Stat label="Solo" value={data.soloCount} />
        <Stat label="Team entries" value={data.teamCount} />
        <Stat label="Open spots" value={data.teamsWithOpenSpots} />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Teams</h2>
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" aria-hidden />
            Export CSV
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Member(s)</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No registrations yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.teams.map((team) => {
                  const open = expanded.has(team.id);
                  return (
                    <Fragment key={team.id}>
                      <TableRow>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => toggle(team.id)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-expanded={open}
                            aria-label={open ? "Collapse members" : "Expand members"}
                          >
                            {open ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {team.teamCode}
                        </TableCell>
                        <TableCell>
                          {team.entryType === "SOLO"
                            ? (team.members[0]?.fullName ?? "—")
                            : (team.teamName ?? "—")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{team.entryType}</Badge>
                        </TableCell>
                        <TableCell>
                          {team.entryType === "SOLO"
                            ? team.memberCount
                            : `${team.memberCount}/${HACKATHON.maxTeamSize}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(team.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}
                        </TableCell>
                      </TableRow>
                      {open
                        ? team.members.map((m) => (
                            <TableRow
                              key={`${team.id}-${m.slotIndex}`}
                              className="bg-muted/30"
                            >
                              <TableCell />
                              <TableCell colSpan={5}>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                  <span className="font-medium">
                                    {m.fullName}
                                    {m.isLeader ? " (leader)" : ""}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {m.email}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {m.phone}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {m.college}
                                  </span>
                                  <span className="text-muted-foreground">
                                    Grad {m.graduationYear}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        : null}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Problem statement</h2>
        <Textarea
          value={problemStatement}
          onChange={(e) => setProblemStatement(e.target.value)}
          rows={8}
          maxLength={5000}
          placeholder="Paste the live kickoff brief here…"
          className="font-mono text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {problemStatement.length}/5000 — shown on participant dashboards after
            kickoff.
          </p>
          <Button
            type="button"
            onClick={handleSaveProblem}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={cn("rounded-lg border bg-card px-4 py-3")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
