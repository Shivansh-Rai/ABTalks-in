import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { captureFailure } from "@/lib/observability/capture";
import { logContact } from "@/lib/observability/domain-log";
import { sendEmail } from "@/lib/email";
import { searchCandidates } from "@/features/hire/search-candidates";
import { jobSpecSchema, type JobSpec } from "@/lib/validations/hire";

export type HireAlertsResult = {
  checked: number;
  alerted: number;
  failures: string[];
};

/**
 * For ACTIVE requests with alertWhenAvailable, re-run search and email recruiter
 * when at least one STRONG/PARTIAL match exists.
 *
 * Deliberately NOT instrumented for GA4 (T-253).
 *
 * This runs on a Vercel cron with no browser and no viewer. ABTalks sends GA4
 * events one way only — `window.gtag`, loaded by the T-252 GA4Loader and gated
 * on the recipient's own consent cookie (src/lib/analytics/use-track.ts). None
 * of that exists here. Reaching GA from this function would mean adding the
 * Measurement Protocol: a second transport, a second credential, and events
 * sent about a recruiter with no consent signal of theirs to attach.
 *
 * A "job alert sent" count is available today from the return value below
 * (`alerted`), which the cron route returns in its JSON response and logs on a
 * partial failure. If it is ever needed in GA, the decision to add the
 * Measurement Protocol is a plan of its own.
 */
export async function runHireAlertsCron(): Promise<HireAlertsResult> {
  const failures: string[] = [];
  let alerted = 0;
  // T-259: this is the outreach path. It runs from cron, so there is no
  // incoming request id - the child logger binds the route instead, and the
  // per-send correlation handle is the `deliveryId` sendEmail returns.
  const log = logger.child({ route: "cron:hire-alerts" });

  const requests = await prisma.talentRequest.findMany({
    where: {
      alertWhenAvailable: true,
      status: { in: ["ACTIVE", "MATCHED"] },
    },
    select: {
      id: true,
      title: true,
      mustHaveStack: true,
      niceToHaveStack: true,
      evidencePriority: true,
      seniority: true,
      openings: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      salaryPeriod: true,
      workMode: true,
      locationCity: true,
      employmentType: true,
      noticePeriodDays: true,
      minExperience: true,
      maxExperience: true,
      requiresDegree: true,
      recruiter: { select: { email: true, name: true } },
    },
    take: 50,
    orderBy: { updatedAt: "asc" },
  });

  for (const req of requests) {
    try {
      const spec: JobSpec = jobSpecSchema.parse({
        title: req.title,
        seniority: req.seniority,
        openings: req.openings,
        mustHaveStack: req.mustHaveStack,
        niceToHaveStack: req.niceToHaveStack,
        evidencePriority: req.evidencePriority,
        salaryMin: req.salaryMin,
        salaryMax: req.salaryMax,
        salaryCurrency: req.salaryCurrency,
        salaryPeriod: req.salaryPeriod === "MONTHLY" ? "MONTHLY" : "ANNUAL",
        workMode: req.workMode,
        locationCity: req.locationCity,
        employmentType: req.employmentType,
        noticePeriodDays: req.noticePeriodDays,
        minExperience: req.minExperience,
        maxExperience: req.maxExperience,
        requiresDegree: req.requiresDegree,
      });

      const search = await searchCandidates(spec, { limit: 5 });
      if (!search.ok) {
        logContact("outreach.send", {
          outcome: "failed",
          talentRequestId: req.id,
          reason: "search_failed",
          log,
        });
        failures.push(`${req.id}: ${search.message}`);
        continue;
      }
      if (search.data.matches.length === 0) continue;

      const to = req.recruiter.email;
      if (!to) {
        logContact("outreach.send", {
          outcome: "failed",
          talentRequestId: req.id,
          reason: "no_recruiter_email",
          log,
        });
        failures.push(`${req.id}: no recruiter email`);
        continue;
      }

      logContact("outreach.send", {
        outcome: "attempt",
        talentRequestId: req.id,
        matchCount: search.data.matches.length,
        log,
      });

      const names = search.data.matches
        .slice(0, 3)
        .map((m) => `${m.fullName} (${m.score})`)
        .join(", ");
      const subject = `Scout found ${search.data.matches.length} match(es) for ${req.title}`;
      const text = `Hi${req.recruiter.name ? ` ${req.recruiter.name}` : ""},

Scout found verified candidates for your requirement "${req.title}".

Top matches: ${names}

Open: ${process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "https://abtalksapp.vercel.app"}/hire/${req.id}

— ABTalks Scout
`;
      const html = `<p>Hi${req.recruiter.name ? ` ${escapeHtml(req.recruiter.name)}` : ""},</p>
<p>Scout found <strong>${search.data.matches.length}</strong> verified candidate(s) for <strong>${escapeHtml(req.title)}</strong>.</p>
<p>Top matches: ${escapeHtml(names)}</p>
<p><a href="${process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "https://abtalksapp.vercel.app"}/hire/${req.id}">Open your Scout search</a></p>
<p>— ABTalks Scout</p>`;

      const sent = await sendEmail({
        to,
        subject,
        html,
        text,
        kind: "hire.alert",
        subjectType: "talentRequest",
        subjectId: req.id,
      });
      if (sent.ok || sent.skipped) {
        // Clear alert flag so we don't spam every night
        await prisma.talentRequest.update({
          where: { id: req.id },
          data: {
            status: "MATCHED",
            alertWhenAvailable: false,
          },
        });
        alerted += 1;
        logContact("outreach.send", {
          outcome: "success",
          talentRequestId: req.id,
          deliveryId: sent.deliveryId,
          skipped: sent.ok !== true,
          log,
        });
      } else {
        // sendEmail has already emitted notification.failed and captured the
        // exception against this deliveryId; this is the outreach-level outcome.
        logContact("outreach.send", {
          outcome: "failed",
          talentRequestId: req.id,
          deliveryId: sent.deliveryId,
          reason: sent.reason,
          log,
        });
        failures.push(`${req.id}: email failed`);
      }
    } catch (e) {
      // `failures` is returned to the admin surface, so it gets the redacted
      // message, not String(e) - a Brevo or Prisma error can carry an address
      // or a connection string.
      const { reason } = await captureFailure(e, {
        event: "outreach.send.failed",
        message: "hire alert request failed",
        log,
        tags: { talentRequestId: req.id, route: "cron:hire-alerts" },
        extra: { area: "contact", op: "outreach.send", outcome: "failed" },
      });
      failures.push(`${req.id}: ${reason}`);
    }
  }

  return { checked: requests.length, alerted, failures };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
