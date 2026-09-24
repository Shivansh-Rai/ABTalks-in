import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Submissions closed | ABTalks Hackathon",
};

/**
 * Postponed 2026-09-24. The submission surface is offline while the
 * event is on hold — anyone who lands here (bookmark, mistyped URL) is
 * bounced back to `/hackathon` where the coming-soon card explains what
 * happened. Restore the previous page from git history when the next
 * event is ready.
 */
export default function HackathonSubmissionPage(): never {
  redirect("/hackathon");
}
