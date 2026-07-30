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

export function HackathonUnknownSlugRow({
  slug,
  registrations,
  users,
}: {
  slug: string;
  registrations: number;
  users: LinkUser[];
}) {
  const [open, setOpen] = useState(false);

  function openModal() {
    setOpen(true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal();
    }
  }

  return (
    <>
      <TableRow
        role="button"
        tabIndex={0}
        className="group cursor-pointer hover:bg-muted/50"
        onClick={openModal}
        onKeyDown={onKeyDown}
      >
        <TableCell className="font-mono text-sm">{slug}</TableCell>
        <TableCell className="font-bold tabular-nums">
          {registrations}
        </TableCell>
        <TableCell className="w-10 text-right">
          <ChevronRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Unrecognized ·{" "}
              <span className="font-mono text-muted-foreground">{slug}</span>
            </DialogTitle>
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
                      No users have joined using this link
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
