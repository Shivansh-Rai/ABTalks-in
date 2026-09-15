"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * T-268 — filter bar for the /admin/deliveries console.
 *
 * Purely URL-driven: "Apply" pushes the new query string; the page reads
 * `searchParams` and re-queries. No local data cache, no client-side fetching.
 * Native <select> is used deliberately — the Base UI Select is overkill for a
 * back-office filter and adds three components per dropdown.
 */
export function DeliveryFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const [recipient, setRecipient] = useState(sp.get("recipient") ?? "");
  const [event, setEvent] = useState(sp.get("event") ?? "");
  const [state, setState] = useState(sp.get("state") ?? "");
  const [channel, setChannel] = useState(sp.get("channel") ?? "");
  const [source, setSource] = useState(sp.get("source") ?? "");
  const [since, setSince] = useState(sp.get("since") ?? "");
  const [until, setUntil] = useState(sp.get("until") ?? "");

  function apply() {
    const params = new URLSearchParams();
    if (recipient) params.set("recipient", recipient.trim());
    if (event) params.set("event", event.trim());
    if (state) params.set("state", state);
    if (channel) params.set("channel", channel);
    if (source) params.set("source", source);
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    const qs = params.toString();
    router.push(qs ? `/admin/deliveries?${qs}` : "/admin/deliveries");
  }

  function reset() {
    setRecipient("");
    setEvent("");
    setState("");
    setChannel("");
    setSource("");
    setSince("");
    setUntil("");
    router.push("/admin/deliveries");
  }

  const selectClass =
    "h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <form
      className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium">
        Recipient (email or userId)
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="jane@example.com"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium">
        Event type
        <Input
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="profile.viewed"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium">
        Source
        <select
          className={selectClass}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">Any source</option>
          <option value="notification">Notification (T-248)</option>
          <option value="outbound">Outbound mail (T-259)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium">
        State
        <select
          className={selectClass}
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">Any state</option>
          <option value="created">created</option>
          <option value="sending">sending</option>
          <option value="sent">sent</option>
          <option value="failed">failed</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium">
        Channel
        <select
          className={selectClass}
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="">Any channel</option>
          <option value="in_app">in_app</option>
          <option value="email">email</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium">
        Since
        <Input
          type="datetime-local"
          value={since}
          onChange={(e) => setSince(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium">
        Until
        <Input
          type="datetime-local"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
      </label>

      <div className="flex items-end gap-2">
        <Button type="submit" size="sm">
          Apply
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={reset}>
          Reset
        </Button>
      </div>
    </form>
  );
}
