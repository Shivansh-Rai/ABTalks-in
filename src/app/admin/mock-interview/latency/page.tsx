import { InterviewLatencyBench } from "./client";

/**
 * Latency bench for the voice interview pipeline.
 *
 * Under `/admin` rather than `/dev` on purpose. It needs to run in PRODUCTION,
 * because latency is a property of the deployment — region, cold starts, the
 * real network path to each vendor — and none of that reproduces on a developer
 * machine. A `NODE_ENV` check would have made it useless exactly where it
 * matters, so access is an authorisation question instead, and `admin/layout.tsx`
 * already answers it with `requireAdmin()` for every page beneath it.
 *
 * It lives beside the other mock-interview admin screens because that is the
 * track it measures.
 *
 * The probe endpoint it calls repeats the whole check itself — a page guard does
 * not protect an API route — and additionally requires
 * `ENABLE_INTERVIEW_LATENCY_PROBE`.
 */
export const metadata = {
  title: "Interview voice latency",
};

export default function InterviewLatencyPage() {
  // Surfaced so the page says WHY it is empty rather than looking broken. The
  // flag is read here only for that message; the endpoint enforces it.
  const probeEnabled = process.env.ENABLE_INTERVIEW_LATENCY_PROBE === "true";

  return <InterviewLatencyBench probeEnabled={probeEnabled} />;
}
