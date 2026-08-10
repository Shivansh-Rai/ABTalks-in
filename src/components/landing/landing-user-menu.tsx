"use client";

import Link from "next/link";
import { signOutAction } from "@/app/actions/auth-actions";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LandingUser } from "@/features/landing/get-landing-state";
import { cn } from "@/lib/utils";

type Props = {
  user: LandingUser;
};

function displayLabel(user: LandingUser): string {
  return user.name?.trim() || user.email || "User";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function LandingUserMenu({ user }: Props) {
  const label = displayLabel(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label="Open profile menu"
        className={cn(
          "focus-spark inline-flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm outline-none transition-colors sm:gap-3 sm:px-2",
          "hover:bg-muted aria-expanded:bg-muted",
        )}
      >
        <Avatar className="size-8 ring-2 ring-border/80 sm:size-9">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>{initials(label)}</AvatarFallback>
        </Avatar>
        <span className="hidden min-w-0 flex-col items-start text-left md:flex">
          <span className="max-w-[140px] truncate font-medium lg:max-w-[160px]">
            {label}
          </span>
          <span className="max-w-[180px] truncate text-xs text-muted-foreground lg:max-w-[200px]">
            {user.email}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{label}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard" />}>
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/profile" />}>
          Profile
        </DropdownMenuItem>
        {user.isAdmin ? (
          <DropdownMenuItem render={<Link href="/admin" />}>
            Admin
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action={signOutAction} className="p-1">
          <button
            type="submit"
            className="focus-spark flex w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            Logout
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
