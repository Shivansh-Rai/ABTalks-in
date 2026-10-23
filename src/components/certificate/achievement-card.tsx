import Link from "next/link";
import { Award, CalendarDays, Download, ExternalLink } from "lucide-react";
import type { AchievementView } from "@/features/certificate/get-achievements";
import { CopyVerifyLinkButton } from "@/components/certificate/copy-verify-link-button";
import { cn } from "@/lib/utils";

type Props = {
  achievement: AchievementView;
  verifyBaseUrl: string;
};

/**
 * One certificate. Compact by design: a tinted header carries the identity,
 * the stats sit in a tight strip, and the actions share one row so the card
 * reads at a glance in a 2–3 column grid.
 */
export function AchievementCard({ achievement, verifyBaseUrl }: Props) {
  const isRevoked = achievement.status === "REVOKED";
  const verifyPath = `/verify/${achievement.certificateId}`;

  return (
    <article
      className={cn(
        "group flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E0E0E0] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]",
        "transition-[box-shadow,border-color] duration-200 hover:border-[#A6D2D5] hover:shadow-[0_10px_28px_rgba(3,83,95,0.10)] motion-reduce:transition-none",
        isRevoked && "opacity-80",
      )}
    >
      {/* ---- header ---- */}
      <div className="relative bg-gradient-to-br from-[#EEF6F6] via-white to-white px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1",
              isRevoked
                ? "bg-[#F4F4F4] text-[#626262] ring-[#E0E0E0]"
                : "bg-[#03535F] text-white ring-[#03535F] shadow-[inset_0_-4px_10px_rgba(0,0,0,0.25)]",
            )}
            aria-hidden
          >
            <Award className="size-5" />
          </span>
          {isRevoked ? (
            <span className="rounded-full bg-[#FDECEA] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#D92D20]">
              Revoked
            </span>
          ) : (
            <span className="rounded-full bg-[#E3F6E6] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#197E23]">
              {achievement.statusLabel}
            </span>
          )}
        </div>
        <h2 className="mt-3 font-display text-lg font-semibold leading-snug tracking-tight text-black">
          {achievement.title}
        </h2>
        <p className="mt-0.5 text-sm text-[#626262]">{achievement.subtitle}</p>
      </div>

      {/* ---- stats ---- */}
      <dl className="mx-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[#E9E9E9] py-3.5 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-[#626262]">Issued on</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-black">
            <CalendarDays className="size-3.5 text-[#03535F]" aria-hidden />
            {achievement.issuedOn}
          </dd>
        </div>
        {achievement.stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-xs text-[#626262]">{stat.label}</dt>
            <dd className="mt-0.5 truncate font-medium text-black" title={stat.value}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* ---- id + actions ---- */}
      <div className="mt-auto flex flex-col gap-3 px-5 pb-5 pt-3.5">
        <p className="flex min-w-0 items-center gap-2 text-xs text-[#626262]">
          <span className="shrink-0">Certificate ID</span>
          <code className="truncate rounded-md bg-[#F4F4F4] px-1.5 py-0.5 font-mono text-[12px] text-[#353535]">
            {achievement.certificateId}
          </code>
        </p>
        <div className="flex items-center gap-2">
          {!isRevoked ? (
            <a
              href={`${verifyPath}/download`}
              download
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#03535F] px-3 text-sm font-semibold text-white shadow-[inset_0_-4px_12px_rgba(0,0,0,0.3)] transition-colors hover:bg-[#076573] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F]"
            >
              <Download className="size-4" aria-hidden />
              Download PDF
            </a>
          ) : null}
          <Link
            href={verifyPath}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E0E0E0] bg-white px-3 text-sm font-semibold text-black transition-colors hover:border-[#A6D2D5] hover:bg-[#EEF6F6] hover:text-[#03535F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F]",
              isRevoked && "flex-1",
            )}
          >
            <ExternalLink className="size-4" aria-hidden />
            View
          </Link>
          {!isRevoked ? (
            <CopyVerifyLinkButton link={`${verifyBaseUrl}${verifyPath}`} />
          ) : null}
        </div>
      </div>
    </article>
  );
}
