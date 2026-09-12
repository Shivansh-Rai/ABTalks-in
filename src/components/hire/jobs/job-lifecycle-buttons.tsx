"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JobStatus } from "@prisma/client";
import {
  publishRecruiterJobAction,
  closeRecruiterJobAction,
  reopenRecruiterJobAction,
} from "@/app/actions/recruiter-job-actions";

type Props = {
  jobId: string;
  status: JobStatus;
};

export function JobLifecycleButtons({ jobId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: (input: { jobId: string }) => Promise<
      | { ok: true; data: { id: string; status: string } }
      | { ok: false; message: string; status?: number }
    >,
    label: string,
  ) {
    startTransition(async () => {
      const res = await action({ jobId });
      if (res.ok) {
        toast.success(`${label}: ${res.data.status}`);
        router.refresh();
        return;
      }
      toast.error(res.message);
    });
  }

  return (
    <div className="hire-jobs-detail__lifecycle-actions">
      {status === "DRAFT" ? (
        <button
          type="button"
          className="hire-jobs__btn"
          disabled={pending}
          onClick={() => run(publishRecruiterJobAction, "Published")}
        >
          Publish
        </button>
      ) : null}
      {status === "PUBLISHED" ? (
        <button
          type="button"
          className="hire-jobs__btn hire-jobs__btn--secondary"
          disabled={pending}
          onClick={() => run(closeRecruiterJobAction, "Closed")}
        >
          Close
        </button>
      ) : null}
      {status === "CLOSED" ? (
        <button
          type="button"
          className="hire-jobs__btn"
          disabled={pending}
          onClick={() => run(reopenRecruiterJobAction, "Reopened")}
        >
          Reopen
        </button>
      ) : null}
    </div>
  );
}
