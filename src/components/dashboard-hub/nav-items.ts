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
/**
 * Every hub section shares ONE column. Sections used to each invent their own
 * edge (`lg:ml-4`, `lg:ml-5`, a `2xl:max-w-[1600px]`, or nothing at all), which
 * is why headings did not line up with the cards beneath them.
 */
export const HUB_SECTION_CLASS = "scroll-mt-20 px-4 py-8 sm:px-6";
export const HUB_CONTAINER_CLASS =
  "w-full max-w-[1020px] lg:ml-5 2xl:mx-auto 2xl:max-w-[1600px]";

/**
 * Card grids step the column COUNT up with viewport width rather than pinning
 * it at three. A fixed `grid-cols-3` inside a 1600px column makes every card
 * ~500px wide, which is what reads as "huge space between the cards" on a wide
 * Windows display — the gutter never changed, the cards did.
 */
export const HUB_CARD_GRID_CLASS =
  "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/** Primary sidebar tiles — the clay treatment lives in globals.css (.abt-nav-*). */
export const HUB_NAV_ACTIVE_CLASS = "abt-nav-active";
export const HUB_NAV_IDLE_CLASS = "abt-nav-idle";

/** Card hover — peach tint and soft shadow (no border change, no lift). */
export const HUB_CARD_HOVER_CLASS =
  "transition-[box-shadow,background-color] duration-[180ms] ease-in-out hover:bg-[#FFFFFF] hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)]";

export const HUB_TEXT_LINK_CLASS =
  "group inline-flex items-center gap-1 text-sm font-medium text-black transition-colors duration-200 ease-[var(--ease-spark)] hover:text-[#03535F]";

/** Outline CTA — brand border, no fill, black text → brand on hover. */
export const HUB_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg border border-[#03535F] bg-transparent px-4 text-sm font-semibold text-black shadow-none transition-colors duration-200 ease-[var(--ease-spark)] hover:bg-transparent hover:text-[#03535F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F] disabled:opacity-60";

/**
 * Card CTA — the same outline geometry as HUB_BUTTON_CLASS, but it fills with
 * the brand colour on hover and sits at its content width. Kept separate from
 * HUB_BUTTON_CLASS because that one is also worn by /login and /register.
 */
export const HUB_CARD_CTA_CLASS =
  "inline-flex h-10 w-auto items-center justify-center self-end rounded-lg border border-[#03535F] bg-transparent px-4 text-sm font-semibold text-black shadow-none transition-colors duration-200 ease-[var(--ease-spark)] hover:bg-[#03535F] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F] disabled:opacity-60";

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
