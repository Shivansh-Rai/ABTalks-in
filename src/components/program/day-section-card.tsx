import {
  BookOpen,
  ClipboardCheck,
  FolderGit2,
  Hammer,
  ListChecks,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DaySectionIconName =
  | "mission"
  | "repo"
  | "objectives"
  | "build"
  | "resources"
  | "verify";

const SECTION_ICONS: Record<DaySectionIconName, LucideIcon> = {
  mission: Target,
  repo: FolderGit2,
  objectives: ListChecks,
  build: Hammer,
  resources: BookOpen,
  verify: ClipboardCheck,
};

export function DaySectionIcon({
  name,
  className,
}: {
  name: DaySectionIconName;
  className?: string;
}) {
  const Icon = SECTION_ICONS[name];
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md bg-[#E7F2F3]",
        className,
      )}
      aria-hidden
    >
      <Icon className="size-4 text-[#03535F]" strokeWidth={2} />
    </span>
  );
}

export function DaySectionCard({
  title,
  icon,
  iconPlaceholder,
  className,
  children,
}: {
  title: string;
  icon?: DaySectionIconName;
  iconPlaceholder?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const showIcon = iconPlaceholder !== false;

  return (
    <section
      className={cn(
        "rounded-[12px] border border-[#E0E0E0] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] md:p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2.5">
        {showIcon &&
          (icon ? (
            <DaySectionIcon name={icon} />
          ) : (
            <span
              className="size-9 shrink-0 rounded-md bg-[#E7F2F3]"
              aria-hidden
            />
          ))}
        <h2 className="font-heading text-base font-semibold text-[#000000] md:text-lg">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function ToolChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-[4px] bg-[#E7F2F3] px-2 py-0.5 text-[12px] font-semibold text-[#03535F]">
      {label}
    </span>
  );
}

export const dayMdClassName =
  "text-sm leading-6 text-[#4B4B4B] [&_a]:text-[#03535F] [&_a]:underline [&_code]:rounded [&_code]:bg-[#E7F2F3] [&_code]:px-1 [&_code]:text-xs [&_code]:text-[#076573] [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_p]:last:mb-0 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[#E0E0E0] [&_pre]:bg-[#F4F4F4] [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-[#4B4B4B] [&_strong]:font-semibold [&_strong]:text-[#000000]";
