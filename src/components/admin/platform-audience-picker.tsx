"use client";

import { formatInTimeZone } from "date-fns-tz";
import { IST } from "@/lib/date-utils";

/**
 * Plan 166 — who a platform assessment goes to, and until when. Controlled:
 * the builder owns the state and sends it with Create. The section card and
 * the settings fields reuse the builder's `hire-assess*` classes; the group
 * pickers are plain Tailwind.
 */

export type ChallengeDomain = "AI" | "DS" | "SE" | "CLAUDE";

export type PlatformAudienceValue = {
  all: boolean;
  domains: ChallengeDomain[];
  workshopEventIds: string[];
};

export type PlatformAudienceOptions = {
  allCount: number;
  domains: { domain: ChallengeDomain; label: string; count: number }[];
  workshops: { eventId: string; label: string; count: number }[];
};

type Props = {
  options: PlatformAudienceOptions;
  audience: PlatformAudienceValue;
  onAudienceChange: (next: PlatformAudienceValue) => void;
  disabled: boolean;
  /**
   * Editing a sent assessment: the groups that already received it. They show
   * ticked and can't be unticked; more groups can be added.
   */
  lockedAudience?: PlatformAudienceValue;
};

/** A `datetime-local` value (IST wall clock) → ISO instant. */
export function istLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** An ISO instant → the `datetime-local` value for it on the IST wall clock. */
export function isoToIstLocal(iso: string): string {
  return formatInTimeZone(new Date(iso), IST, "yyyy-MM-dd'T'HH:mm");
}

/** The default deadline: 7 days from now, 11:59 PM IST. */
export function defaultDeadlineLocal(now: Date = new Date()): string {
  const day = formatInTimeZone(
    new Date(now.getTime() + 7 * 86_400_000),
    IST,
    "yyyy-MM-dd",
  );
  return `${day}T23:59`;
}

/** Upper bound on recipients; groups can overlap, so the real number may be lower. */
export function audienceEstimate(
  options: PlatformAudienceOptions,
  audience: PlatformAudienceValue,
): number {
  const workshops = options.workshops
    .filter((w) => audience.workshopEventIds.includes(w.eventId))
    .reduce((n, w) => n + w.count, 0);
  if (audience.all) return options.allCount + workshops;
  const domains = options.domains
    .filter((d) => audience.domains.includes(d.domain))
    .reduce((n, d) => n + d.count, 0);
  return domains + workshops;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/** Heading row above a builder setting: the label, then its checkbox if any. */
export const SETTING_HEAD_CLASS =
  "mb-1.5 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1";
export const SETTING_LABEL_CLASS = "text-[13px] font-semibold text-[#626262]";

const GROUP_TITLE =
  "mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8F8F8F]";

/**
 * One selectable group: a compact pill with its size. Tailwind only — none of
 * the hire-assess-assign classes, whose card layout made this section crowded.
 */
function GroupPill({
  label,
  count,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  count: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={[
        "inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
        checked
          ? "border-[#03535F] bg-[#EEF6F6] text-[#03535F]"
          : "border-[#E2E2E2] bg-white text-[#353535] hover:border-[#9CC5C9]",
        disabled ? "cursor-not-allowed opacity-70" : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        className="size-3.5 accent-[#03535F]"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="font-medium">{label}</span>
      <span className="tabular-nums text-[#8F8F8F]">{count}</span>
    </label>
  );
}

export function PlatformAudiencePicker({
  options,
  audience,
  onAudienceChange,
  disabled,
  lockedAudience,
}: Props) {
  const locked = lockedAudience ?? null;
  const n = (v: number) => v.toLocaleString("en-IN");
  const estimate = audienceEstimate(options, audience);

  return (
    <section
      className="hire-assess__send"
      aria-labelledby="assess-audience-heading"
    >
      <div className="hire-assess__send-head">
        <h2 id="assess-audience-heading">Who gets this assessment</h2>
      </div>
      <p className="hire-assess-hint">
        {locked
          ? "Ticked groups already have it and can't be removed."
          : "Sent to everyone in these groups right now; people who join later won't get it."}
      </p>

      <fieldset disabled={disabled} className="mt-5 space-y-5 border-0 p-0">
        <legend className="sr-only">Audience</legend>

        <label
          className={[
            "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
            audience.all
              ? "border-[#03535F] bg-[#EEF6F6]"
              : "border-[#E2E2E2] bg-white hover:border-[#9CC5C9]",
            locked?.all ? "cursor-not-allowed opacity-70" : "",
          ].join(" ")}
        >
          <input
            type="checkbox"
            className="size-4 accent-[#03535F]"
            checked={audience.all}
            disabled={locked?.all}
            onChange={(e) =>
              onAudienceChange({
                ...audience,
                all: e.target.checked,
                // Domains a sent assessment already went to must stay.
                domains: e.target.checked
                  ? (locked?.domains ?? [])
                  : audience.domains,
              })
            }
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#1C1C1C]">
              All candidates
            </span>
            <span className="block text-xs text-[#787878]">
              Everyone with a candidate profile · {n(options.allCount)}
            </span>
          </span>
        </label>

        <div>
          <p className={GROUP_TITLE}>60-Day Challenge domain</p>
          {audience.all ? (
            <p className="text-[13px] text-[#787878]">
              Included in All candidates.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.domains.map((d) => (
                <GroupPill
                  key={d.domain}
                  label={d.label}
                  count={n(d.count)}
                  checked={audience.domains.includes(d.domain)}
                  disabled={locked?.domains.includes(d.domain)}
                  onChange={() =>
                    onAudienceChange({
                      ...audience,
                      domains: toggle(audience.domains, d.domain),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className={GROUP_TITLE}>Workshop registrants</p>
          {options.workshops.length === 0 ? (
            <p className="text-[13px] text-[#787878]">
              No workshop registrations yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.workshops.map((w) => (
                <GroupPill
                  key={w.eventId}
                  label={w.label}
                  count={n(w.count)}
                  checked={audience.workshopEventIds.includes(w.eventId)}
                  disabled={locked?.workshopEventIds.includes(w.eventId)}
                  onChange={() =>
                    onAudienceChange({
                      ...audience,
                      workshopEventIds: toggle(
                        audience.workshopEventIds,
                        w.eventId,
                      ),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <p className="mt-5 border-t border-[#EFEFEF] pt-4 text-[13px] text-[#4B4B4B]">
        {estimate > 0 ? (
          <>
            Reaches up to{" "}
            <strong className="text-[#1C1C1C]">{n(estimate)}</strong>{" "}
            candidate{estimate === 1 ? "" : "s"}
            <span className="text-[#8F8F8F]"> · groups can overlap</span>
          </>
        ) : (
          <span className="text-[#8F8F8F]">No groups picked yet.</span>
        )}
      </p>
    </section>
  );
}

/**
 * The deadline setting, rendered in the builder's Settings card: heading row
 * with "No deadline", then the IST date-time input.
 */
export function PlatformDeadlineField({
  value,
  onChange,
  noDeadline,
  onNoDeadlineChange,
  disabled,
  sent,
}: {
  /** `YYYY-MM-DDTHH:mm`, read as IST. */
  value: string;
  onChange: (next: string) => void;
  noDeadline: boolean;
  onNoDeadlineChange: (next: boolean) => void;
  disabled: boolean;
  sent: boolean;
}) {
  const minLocal = formatInTimeZone(new Date(), IST, "yyyy-MM-dd'T'HH:mm");
  return (
    <>
      <div className={SETTING_HEAD_CLASS}>
        <label htmlFor="assess-deadline" className={SETTING_LABEL_CLASS}>
          Deadline (IST)
        </label>
        <label className="hire-assess-check">
          <input
            type="checkbox"
            checked={noDeadline}
            disabled={disabled}
            onChange={(e) => onNoDeadlineChange(e.target.checked)}
          />
          <span>No deadline</span>
        </label>
      </div>
      <div className="hire-assess-field">
        <input
          id="assess-deadline"
          type="datetime-local"
          value={noDeadline ? "" : value}
          min={minLocal}
          disabled={disabled || noDeadline}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="hire-assess-hint">
          {noDeadline
            ? "Stays open with no closing date. Candidates can take it any time."
            : "After this, submissions close."}
          {sent && !noDeadline
            ? " Moving it later reopens it for anyone who hasn't submitted."
            : null}
        </span>
      </div>
    </>
  );
}
