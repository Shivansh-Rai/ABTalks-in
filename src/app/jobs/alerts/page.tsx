import { redirect } from "next/navigation";

/**
 * Job alerts live in the "Job alerts" tab on /jobs. This route stays so old
 * links — notably the "change or turn off alerts" line in job-alert emails —
 * still land in the right place. /jobs itself sends signed-out visitors to
 * /login.
 */
export default function JobAlertsPage() {
  redirect("/jobs?tab=alerts");
}
