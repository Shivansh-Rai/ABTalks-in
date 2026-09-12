export type NavIconKey =
  | "grid"
  | "presentation"
  | "store"
  | "briefcase"
  | "award"
  | "zap"
  | "user"
  | "clipboard";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconKey;
};

export const HUB_PRIMARY = "#03535F";
export const HUB_BG = "#F4F4F4";
export const HUB_CONTENT = "#4B4B4B";

export const HUB_HEADING_CLASS =
  "lg:ml-4 font-heading text-xl font-semibold uppercase text-[#03535F]";
export const HUB_CONTENT_CLASS = "text-[#4B4B4B]";
export const HUB_TAB_HOVER_CLASS = "hover:text-[#03535F]";
/** Primary sidebar tiles — the clay treatment lives in globals.css (.abt-nav-*). */
export const HUB_NAV_ACTIVE_CLASS = "abt-nav-active";
export const HUB_NAV_IDLE_CLASS = "abt-nav-idle";

/** Card hover — peach tint and soft shadow (no border change, no lift). */
export const HUB_CARD_HOVER_CLASS =
  "transition-[box-shadow,background-color] duration-[180ms] ease-in-out hover:bg-[#FFFFFF] hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)]";

export const HUB_TEXT_LINK_CLASS =
  "group inline-flex items-center gap-1 text-sm font-medium text-black transition-colors duration-200 ease-[var(--ease-spark)] hover:text-[#03535F]";

/** Outline CTA — orange border, no fill, black text → orange on hover. */
export const HUB_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg border border-[#03535F] bg-transparent px-4 text-sm font-semibold text-black shadow-none transition-colors duration-200 ease-[var(--ease-spark)] hover:bg-transparent hover:text-[#03535F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F] disabled:opacity-60";

export const HUB_ARROW_HOVER_CLASS =
  "size-4 transition-transform duration-200 ease-[var(--ease-spark)] motion-safe:group-hover:translate-x-0.5";

/** Design System v2 §7: 250px desktop sidebar; the brand row lines up with the 55px header. */
export const SIDEBAR_WIDTH_CLASS = "w-[250px]";
export const SIDEBAR_BRAND_ROW_CLASS =
  "flex h-[55px] shrink-0 items-center border-b border-[#E9E9E9] px-5";
export const SIDEBAR_FOOTER_ROW_CLASS =
  "flex h-[148px] shrink-0 flex-col justify-center border-t border-[#E9E9E9] p-4";

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Events And Workshops", href: "/workshop", icon: "presentation" },
  { label: "Marketplace", href: "/marketplace", icon: "store" },
  { label: "Jobs", href: "/jobs", icon: "briefcase" },
  { label: "Assessments", href: "/assessments", icon: "clipboard" },
  { label: "Achievements", href: "/achievements", icon: "award" },
  { label: "Hackathon", href: "/hackathon", icon: "zap" },
  { label: "Profile", href: "/profile", icon: "user" },
];
