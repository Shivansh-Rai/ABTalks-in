import {
  BriefcaseBusiness,
  CalendarClock,
  Clapperboard,
  Code2,
  GitBranch,
  GraduationCap,
  Palette,
  Rocket,
  Trophy,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/**
 * Events carry an icon KEY, not a component.
 *
 * Two hard constraints force this. A `LucideIcon` is a React component
 * reference: it cannot be stored in a database column, and it cannot cross the
 * Server→Client boundary as a prop. Workshop events now come from the DB and
 * are read on the server, so the icon has to survive both trips as a string
 * and be resolved back to a component inside the client component that draws
 * it.
 *
 * The keys are the Lucide component names, lowercased — no invented taxonomy
 * to keep in sync, and an admin picking one from a dropdown sees a name that
 * matches the icon.
 */
export const ICON_MAP = {
  briefcase: BriefcaseBusiness,
  calendar: CalendarClock,
  clapperboard: Clapperboard,
  code: Code2,
  git: GitBranch,
  graduation: GraduationCap,
  palette: Palette,
  rocket: Rocket,
  trophy: Trophy,
  users: Users,
  workflow: Workflow,
} satisfies Record<string, LucideIcon>;

export type WorkshopIconKey = keyof typeof ICON_MAP;

/** Every key, for the admin editor's picker. */
export const ICON_KEYS = Object.keys(ICON_MAP) as WorkshopIconKey[];

/** The icon a stored key names, falling back rather than crashing a render. */
export const resolveIcon = (key: string): LucideIcon =>
  ICON_MAP[key as WorkshopIconKey] ?? CalendarClock;

export const isIconKey = (key: string): key is WorkshopIconKey =>
  Object.prototype.hasOwnProperty.call(ICON_MAP, key);
