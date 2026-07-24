"use client";

import { usePathname } from "next/navigation";
import {
  logoutHackathonAction,
  switchHackathonAccountAction,
} from "@/app/actions/hackathon-auth-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountMenu({ email }: { email: string }) {
  const pathname = usePathname();
  const showSwitchAccount = !pathname.startsWith("/hackathon/dashboard");
  const initial = (email.trim().charAt(0) || "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex h-8 max-w-[200px] items-center gap-2 rounded-[8px] bg-[#403880] px-3 text-white transition-opacity hover:opacity-90 sm:h-[47px] sm:max-w-[280px] sm:rounded-[10px] sm:px-4"
        aria-label={`Signed in as ${email}`}
      >
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold leading-none sm:size-8 sm:text-[14px]"
          aria-hidden
        >
          {initial}
        </span>
        <span className="hidden min-w-0 truncate text-[11px] font-bold leading-none sm:inline sm:text-[14px]">
          {email}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="text-xs text-muted-foreground">Signed in as</div>
            <div className="truncate text-sm font-medium text-foreground">
              {email}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {showSwitchAccount ? (
          <form action={switchHackathonAccountAction}>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center rounded-md px-1.5 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              Switch account
            </button>
          </form>
        ) : null}
        <form action={logoutHackathonAction}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center rounded-md px-1.5 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          >
            Log out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
