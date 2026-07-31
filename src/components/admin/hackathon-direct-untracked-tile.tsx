"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LinkUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  team: "solo" | "team";
  college: string;
};

export function HackathonDirectUntrackedTile({
  count,
  users,
}: {
  count: number;
  users: LinkUser[];
}) {
  const [open, setOpen] = useState(false);

  function openModal() {
    setOpen(true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal();
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="View direct / untracked registrations"
        className="group cursor-pointer rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
        onClick={openModal}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">Direct / untracked</p>
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100"
          />
        </div>
        <p className="mt-1 font-display text-2xl font-bold tabular-nums">
          {count}
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Direct / untracked</DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 bg-popover">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>College</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No direct / untracked registrations
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.fullName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone}</TableCell>
                      <TableCell className="capitalize">{user.team}</TableCell>
                      <TableCell>{user.college}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
