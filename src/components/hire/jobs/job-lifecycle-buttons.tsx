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
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() => run(publishRecruiterJobAction, "Published")}
        >
          Publish
        </Button>
      ) : null}
      {status === "PUBLISHED" ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(closeRecruiterJobAction, "Closed")}
        >
          Close
        </Button>
      ) : null}
      {status === "CLOSED" ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() => run(reopenRecruiterJobAction, "Reopened")}
        >
          Reopen
        </Button>
      ) : null}
    </div>
  );
}
