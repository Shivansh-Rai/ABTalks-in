"use client";

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { getMyJobApplicantCardAction } from "@/app/actions/recruiter-job-actions";
import { CandidateInspector } from "@/components/hire/candidate-inspector";
import type { MatchCardData } from "@/components/hire/match-card";
import type { ApplicantListRow } from "@/components/hire/jobs/job-applicants-list";
import { cn } from "@/lib/utils";

type InspectCtx = {
  selectedRef: string | null;
  onSelect: (candidateRef: string) => void;
};

const ApplicantInspectContext = createContext<InspectCtx | null>(null);

export function useApplicantInspect(): InspectCtx | null {
  return useContext(ApplicantInspectContext);
}

type Props = {
  jobId: string;
  applicants: ApplicantListRow[];
  children: ReactNode;
};

export function JobApplicantsDesk({ jobId, applicants, children }: Props) {
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchCardData | null>(null);
  const [pending, startTransition] = useTransition();

  const refs = applicants.map((row) => row.candidateRef);
  const openIndex = openRef ? refs.indexOf(openRef) : -1;
  const showPanel = Boolean(openRef);
  const ready = match !== null && match.candidateRef === openRef;

  function open(candidateRef: string) {
    setOpenRef(candidateRef);
    startTransition(async () => {
      const result = await getMyJobApplicantCardAction({
        jobId,
        candidateRef,
      });
      if (!result.ok) {
        setMatch(null);
        toast.error(result.message);
        return;
      }
      setMatch(result.data.match);
    });
  }

  function close() {
    setOpenRef(null);
    setMatch(null);
  }

  return (
    <ApplicantInspectContext.Provider
      value={{ selectedRef: openRef, onSelect: open }}
    >
      <div className={cn("hire-jobs-inspect", showPanel && "is-open")}>
        <div className="hire-jobs-inspect__main">{children}</div>
        {showPanel ? (
          <div className="hire-jobs-inspect__panel">
            {ready && match ? (
              <CandidateInspector
                key={match.candidateRef}
                match={match}
                onClose={close}
                onPrev={
                  openIndex > 0 ? () => open(refs[openIndex - 1]!) : undefined
                }
                onNext={
                  openIndex >= 0 && openIndex < refs.length - 1
                    ? () => open(refs[openIndex + 1]!)
                    : undefined
                }
              />
            ) : (
              <aside
                className="hire-detail hire-profile"
                aria-busy={pending}
                aria-label="Candidate details"
              >
                <p className="hire-profile__meta px-5 py-8 text-sm text-[#4B4B4B]">
                  {pending
                    ? "Loading profile…"
                    : "Could not load this applicant."}
                </p>
              </aside>
            )}
          </div>
        ) : null}
      </div>
    </ApplicantInspectContext.Provider>
  );
}
