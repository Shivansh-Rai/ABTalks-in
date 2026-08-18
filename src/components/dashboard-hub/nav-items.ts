export type NavIconKey =
  | "grid"
  | "presentation"
  | "store"
  | "briefcase"
  | "award"
  | "user";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconKey;
};

export const SIDEBAR_WIDTH_CLASS = "w-64";
export const SIDEBAR_BRAND_ROW_CLASS =
  "flex h-[72px] items-center border-b border-neutral-200 px-4";
export const SIDEBAR_FOOTER_ROW_CLASS =
  "flex h-[148px] shrink-0 flex-col justify-center border-t border-neutral-200 p-4";

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Workshops", href: "/ai-workshop/events", icon: "presentation" },
  { label: "Marketplace", href: "/marketplace", icon: "store" },
  { label: "Jobs", href: "/jobs", icon: "briefcase" },
  { label: "Achievements", href: "/achievements", icon: "award" },
  { label: "Profile", href: "/profile", icon: "user" },
];
