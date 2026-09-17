"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  "",
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
  "INVALID",
] as const;

export type MockInterviewFiltersInitial = {
  userId: string;
  domain: string;
  status: string;
  from: string;
  to: string;
};

/**
 * T-276 mock-interview list filters. Server-side filtering — the form
 * submits back to /admin/mock-interview with new searchParams, and
 * the Server Component re-renders with the filtered rows.
 */
export function MockInterviewFilters({
  initial,
}: {
  initial: MockInterviewFiltersInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<MockInterviewFiltersInitial>(initial);

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (values.userId) params.set("userId", values.userId);
    if (values.domain) params.set("domain", values.domain);
    if (values.status) params.set("status", values.status);
    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);
    startTransition(() => {
      router.replace(`/admin/mock-interview?${params.toString()}`);
    });
  }

  function reset() {
    setValues({ userId: "", domain: "", status: "", from: "", to: "" });
    startTransition(() => {
      router.replace("/admin/mock-interview");
    });
  }

  const inputClass =
    "rounded-md border border-border/60 bg-background px-2 py-1 text-xs";

  return (
    <form
      onSubmit={apply}
      className="grid grid-cols-2 gap-2 rounded-md border border-border/50 bg-muted/20 p-3 md:grid-cols-6"
      data-pending={pending || undefined}
    >
      <input
        placeholder="User id"
        value={values.userId}
        onChange={(e) => setValues({ ...values, userId: e.target.value })}
        className={inputClass}
      />
      <input
        placeholder="Domain slug"
        value={values.domain}
        onChange={(e) => setValues({ ...values, domain: e.target.value })}
        className={inputClass}
      />
      <select
        value={values.status}
        onChange={(e) => setValues({ ...values, status: e.target.value })}
        className={inputClass}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s || "Any status"}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={values.from}
        onChange={(e) => setValues({ ...values, from: e.target.value })}
        className={inputClass}
      />
      <input
        type="date"
        value={values.to}
        onChange={(e) => setValues({ ...values, to: e.target.value })}
        className={inputClass}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-md bg-foreground px-2 py-1 text-xs text-background disabled:opacity-60"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border/60 px-2 py-1 text-xs"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
