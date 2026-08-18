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

export const HUB_ORANGE = "#e05226";
export const HUB_BG = "#FBF9F7";
export const HUB_CONTENT = "#555555";

export const HUB_HEADING_CLASS =
  "ml-4 font-heading text-xl font-semibold uppercase text-[#e05226]";
export const HUB_CONTENT_CLASS = "text-[#555555]";
export const HUB_TAB_HOVER_CLASS = "hover:text-[#e05226]";
export const HUB_NAV_ACTIVE_CLASS = "bg-[#e05226]/10 text-[#e05226]";
export const HUB_NAV_IDLE_CLASS =
  "text-[#555555] hover:bg-[#e05226]/10 hover:text-[#e05226]";

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
