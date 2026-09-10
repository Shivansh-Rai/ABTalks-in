"use client";

/**
 * Root error boundary — T-259.
 *
 * Next.js renders this instead of the whole document when a render throws at
 * the root, which is the one client-side failure the SDK's automatic handlers
 * do not see. Styling is inline because the boundary replaces `<html>`, so the
 * app's stylesheet may not have loaded.
 *
 * The Sentry event id is shown on purpose: it is the string that ties what the
 * person saw to the log line and the Sentry issue.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect, useRef } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const referenceRef = useRef<HTMLParagraphElement>(null);

  // Reporting is a side effect on an external system, and so is showing its
  // id: writing it through the ref rather than through state keeps this a
  // single render instead of a cascading one (react-hooks/set-state-in-effect).
  useEffect(() => {
    const eventId = Sentry.captureException(error);
    const reference = eventId ?? error.digest;
    if (reference && referenceRef.current) {
      referenceRef.current.textContent = `Reference: ${reference}`;
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Something broke on our side
          </h1>
          <p style={{ opacity: 0.7, marginBottom: "1.5rem" }}>
            The team has been notified. Reloading usually works.
          </p>
          {/*
            A plain anchor, not next/link, and deliberately so: this boundary
            replaces the whole document after the React tree has already failed,
            and a client-side navigation re-enters that same broken tree. A real
            document load is the only reliable way out.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "0.6rem 1.2rem",
              border: "1px solid currentColor",
              borderRadius: "0.5rem",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Back to safety
          </a>
          {/* Filled in by the effect above, once the event has an id. */}
          <p
            ref={referenceRef}
            style={{ marginTop: "1.5rem", fontSize: "0.75rem", opacity: 0.5 }}
          />
        </div>
      </body>
    </html>
  );
}
