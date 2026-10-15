"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { inviteHrAction } from "@/app/actions/admin-hr-invite-actions";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Plan 194 — invite one HR to trial the desk.
 *
 * One at a time and typed by hand on purpose: every invite creates a real
 * recruiter account that can see real candidates, so there is no bulk paste
 * and no CSV here. The form says what it is about to do before it does it.
 */
export function HrInviteForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [lastSent, setLastSent] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const res = await inviteHrAction({ email, name, company });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Sign-in link sent to ${res.data.email}`);
      setLastSent(res.data.email);
      setEmail("");
      setName("");
      setCompany("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <h2 className="font-medium">Invite an HR to trial the desk</h2>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Creates their own recruiter workspace — their projects, their credits,
        their shortlist — and emails them a one-click sign-in link. The link
        works once, expires in seven days, and signs in only to that account, so
        everything they do is attributable to them on this page. Use their work
        address; free consumer domains are refused.
      </p>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
        <Input
          type="email"
          required
          placeholder="Work email"
          aria-label="Work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
        <Input
          required
          placeholder="Full name"
          aria-label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
        />
        <Input
          required
          placeholder="Company"
          aria-label="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={pending}
        />
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className={cn(buttonVariants({ size: "sm" }), "gap-2")}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {pending ? "Sending…" : "Create workspace and send link"}
          </button>
        </div>
      </form>

      {lastSent ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Sent to <span className="font-medium text-foreground">{lastSent}</span>.
          Their activity appears in the recruiter list below once they sign in.
        </p>
      ) : null}
    </section>
  );
}
