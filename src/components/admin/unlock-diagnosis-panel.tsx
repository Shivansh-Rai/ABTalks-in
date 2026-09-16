import Link from "next/link";
import {
  UNLOCK_GROUP_LABEL,
  UNLOCK_GROUP_ORDER,
  type UnlockCheck,
  type UnlockCheckStatus,
  type UnlockDiagnosis,
} from "@/features/admin/unlock-diagnosis";

/**
 * T-267 — "why can't this recruiter unlock this candidate?", answered on the
 * admin recruiter page.
 *
 * Server Component. Read-only: no `"use client"`, no `@/app/actions/*`. The
 * candidate is chosen with a link, so there is no client state to hold.
 *
 * Deliberately the same shape as `candidate-discoverability-panel.tsx` — same
 * pills, same verdict box, same group headings — because it answers the mirror
 * question and support should not have to learn two layouts. Every row is a
 * condition that really runs in the unlock path; the one marked as the blocker
 * is the one the live path would stop at.
 */

const STATUS_STYLE: Record<UnlockCheckStatus, string> = {
  OK: "border-[#A7E8D2] bg-[#D6F7EC] text-[#197E23]",
  BLOCKING: "border-[#FFCDC4] bg-[#FFF2F0] text-[#D92D20]",
  INFO: "border-[#E9E9E9] bg-[#F6F6F6] text-[#5C5C5C]",
};

const STATUS_LABEL: Record<UnlockCheckStatus, string> = {
  OK: "Clear",
  BLOCKING: "Blocker",
  INFO: "Context",
};

function StatusPill({ status }: { status: UnlockCheckStatus }) {
  return (
    <span
      className={`mt-0.5 w-16 shrink-0 self-start rounded-full border px-2 py-0.5 text-center text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function CheckRow({
  check,
  isBlocker,
}: {
  check: UnlockCheck;
  isBlocker: boolean;
}) {
  return (
    <li className="flex gap-3 border-b border-[#E9E9E9] py-3 last:border-0">
      <StatusPill status={check.status} />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-[#353535]">{check.label}</p>
          {isBlocker ? (
            <span className="whitespace-nowrap rounded-full bg-[#D92D20] px-2 py-0.5 text-xs font-medium text-white">
              This is the blocker
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[#5C5C5C]">{check.detail}</p>
        {check.action ? (
          <p className="text-sm text-[#787878]">
            <span className="text-[#8F8F8F]">What to do:</span> {check.action}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export type UnlockCandidateOption = {
  userId: string;
  publicId: string;
  name: string;
  relations: string[];
};

export function UnlockDiagnosisPanel({
  basePath,
  candidates,
  selectedUserId,
  diagnosis,
}: {
  /** The recruiter page this panel lives on; the picker links back to it. */
  basePath: string;
  candidates: UnlockCandidateOption[];
  selectedUserId: string | null;
  /** Null until a candidate is chosen, or when the pair could not be resolved. */
  diagnosis: UnlockDiagnosis | null;
}) {
  const groups = diagnosis
    ? UNLOCK_GROUP_ORDER.map((group) => ({
        group,
        rows: diagnosis.checks.filter((c) => c.group === group),
      })).filter((g) => g.rows.length > 0)
    : [];

  return (
    <section className="rounded-xl border border-[#E9E9E9] bg-white p-5">
      <h2 className="font-display text-base font-semibold text-[#353535]">
        Unlock diagnosis
      </h2>
      <p className="mt-1 text-sm text-[#787878]">
        Every condition the contact-unlock path actually applies, checked against
        this recruiter and one candidate, in the order the live path asks them.
      </p>

      {candidates.length === 0 ? (
        <p className="mt-4 text-sm text-[#5C5C5C]">
          This recruiter has no engagement, outreach or application history yet,
          so there is no candidate to diagnose against.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {candidates.map((c) => {
            const active = c.userId === selectedUserId;
            return (
              <Link
                key={c.userId}
                href={`${basePath}?candidate=${c.userId}`}
                scroll={false}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-[#03535F] bg-[#03535F] text-white"
                    : "border-[#E9E9E9] bg-white text-[#5C5C5C] hover:bg-[#F6F6F6]"
                }`}
                title={c.relations.join(" · ")}
              >
                {c.publicId} · {c.name}
              </Link>
            );
          })}
        </div>
      )}

      {selectedUserId && !diagnosis ? (
        <p className="mt-4 text-sm text-[#D92D20]">
          That candidate could not be resolved. The user row may have been
          deleted outright rather than soft-deleted.
        </p>
      ) : null}

      {diagnosis ? (
        <>
          <div
            className={`mt-4 rounded-lg border p-4 ${
              diagnosis.canUnlock
                ? "border-[#A7E8D2] bg-[#D6F7EC]"
                : "border-[#FFCDC4] bg-[#FFF2F0]"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                diagnosis.canUnlock ? "text-[#197E23]" : "text-[#D92D20]"
              }`}
            >
              {diagnosis.verdict}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.06em] text-[#8F8F8F]">
              {diagnosis.outcome}
            </p>
          </div>

          <div className="mt-4 space-y-4">
            {groups.map(({ group, rows }) => (
              <div key={group}>
                <h3 className="text-xs font-medium uppercase tracking-[0.06em] text-[#8F8F8F]">
                  {UNLOCK_GROUP_LABEL[group]}
                </h3>
                <ul className="mt-1">
                  {rows.map((check) => (
                    <CheckRow
                      key={check.id}
                      check={check}
                      isBlocker={diagnosis.blocker?.id === check.id}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
