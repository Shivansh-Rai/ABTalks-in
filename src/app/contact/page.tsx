import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact · ABTalks",
  description:
    "ABTalks entity details, Grievance Officer, and how to reach us about your data.",
};

type Row = { label: string; value: string; href?: string };

const entityRows: Row[] = [
  { label: "Registered entity", value: LEGAL_ENTITY.name },
  { label: "Trading name", value: LEGAL_ENTITY.tradingName },
  { label: "Registered address", value: LEGAL_ENTITY.address },
  { label: "Registration number", value: LEGAL_ENTITY.registrationNumber },
  {
    label: "Email",
    value: LEGAL_ENTITY.email,
    href: `mailto:${LEGAL_ENTITY.email}`,
  },
];

const officerRows: Row[] = [
  { label: "Name", value: LEGAL_ENTITY.grievanceOfficer.name },
  { label: "Designation", value: LEGAL_ENTITY.grievanceOfficer.designation },
  {
    label: "Email",
    value: LEGAL_ENTITY.grievanceOfficer.email,
    href: `mailto:${LEGAL_ENTITY.grievanceOfficer.email}`,
  },
  { label: "Address", value: LEGAL_ENTITY.address },
];

function DetailTable({ rows }: { rows: Row[] }) {
  return (
    <dl className="mt-4 divide-y divide-border/60 rounded-lg border border-border/60">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4"
        >
          <dt className="text-sm font-medium text-foreground">{row.label}</dt>
          <dd className="text-sm break-words text-muted-foreground">
            {row.href ? (
              <a
                href={row.href}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {row.value}
              </a>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ContactPage() {
  return (
    <div className="min-h-svh bg-background">
      <div className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 md:px-8">
          <Link
            href="/"
            className="font-display text-sm font-semibold text-foreground"
          >
            ABTalks
          </Link>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Contact
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
          Entity details and grievance contacts, published in accordance with
          India&apos;s Digital Personal Data Protection Act, 2023, the
          Information Technology Rules, 2021, and the Consumer Protection
          (E-Commerce) Rules, 2020.
        </p>

        <h2 className="mt-10 border-b border-border/60 pb-2 text-xl font-semibold tracking-tight text-foreground">
          Entity details
        </h2>
        <DetailTable rows={entityRows} />

        <h2 className="mt-10 border-b border-border/60 pb-2 text-xl font-semibold tracking-tight text-foreground">
          Grievance Officer
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
          For complaints about the Service, your content, or how we handle your
          personal data. We acknowledge grievances within{" "}
          <strong className="font-medium text-foreground">
            {LEGAL_ENTITY.grievanceOfficer.acknowledgeWithin}
          </strong>{" "}
          and aim to resolve them within{" "}
          <strong className="font-medium text-foreground">
            {LEGAL_ENTITY.grievanceOfficer.resolveWithin}
          </strong>
          . If you are not satisfied with our response, you may escalate to the
          Data Protection Board of India.
        </p>
        <DetailTable rows={officerRows} />

        <h2 className="mt-10 border-b border-border/60 pb-2 text-xl font-semibold tracking-tight text-foreground">
          Data rights requests
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
          To request access, correction, erasure, withdrawal of consent, or to
          nominate someone to exercise your rights, use the in-product form at{" "}
          <Link
            href="/privacy/requests"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            /privacy/requests
          </Link>
          . You can also email us. We aim to respond within 30 days.
        </p>

        <div className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/cookies" className="hover:text-foreground">
            Cookie Policy
          </Link>
          <Link href="/privacy/requests" className="hover:text-foreground">
            Data requests
          </Link>
        </div>
      </div>
    </div>
  );
}
