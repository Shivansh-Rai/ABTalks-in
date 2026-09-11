import Link from "next/link";
import { Circle } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function SubmissionChecklist({
  submissionOpen,
}: {
  submissionOpen: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[#E0E0E0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-6">
      <h2 className="font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.16em] text-[#03535F]">
        Submission checklist
      </h2>
      <ul className="mt-4 space-y-4">
        {HACKATHON.deliverables.map((item) => (
          <li key={item.title} className="flex gap-3">
            <Circle
              className="mt-0.5 size-4 shrink-0 text-[#787878]"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium text-black">{item.title}</p>
              <p className="mt-0.5 text-sm text-[#626262]">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
      {submissionOpen ? (
        <Link
          href="/hackathon/submission"
          className="mt-4 inline-block text-xs text-[#03535F] underline-offset-2 hover:underline"
        >
          Submit these on the submission page →
        </Link>
      ) : (
        <p className="mt-4 text-xs text-[#787878]">
          Submission opens near the deadline. You&apos;ll submit these here.
        </p>
      )}
    </section>
  );
}
