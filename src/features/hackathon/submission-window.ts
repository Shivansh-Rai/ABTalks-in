import "server-only";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { isHackathonPreviewEnabled } from "@/lib/feature-flags";

export type SubmissionWindow = {
  unlocked: boolean;
  closed: boolean;
  editable: boolean;
  previewing: boolean;
};

export function getSubmissionWindow(now: number = Date.now()): SubmissionWindow {
  const kickoff = new Date(HACKATHON.kickoffUtc).getTime();
  const deadline = new Date(HACKATHON.deadlineUtc).getTime();
  const preview = isHackathonPreviewEnabled();
  const unlocked = now >= kickoff || preview;
  const closed = now >= deadline;
  const editable = unlocked && !closed;
  const previewing = preview && now < kickoff;

  return {
    unlocked,
    closed,
    editable,
    previewing,
  };
}
