"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  removeImportedProfileAction,
  type RemoveProfileState,
} from "@/app/actions/import-claim-actions";

/** Plan 171. Receives only the token string from the server page. */
export function RemoveForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<RemoveProfileState, FormData>(
    removeImportedProfileAction,
    null,
  );

  if (state?.ok) {
    return (
      <p className="text-center text-sm text-foreground">
        Done. Your profile is hidden from recruiters and you won&apos;t get any more emails about
        it. Our team will delete the rest of your data.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="destructive" className="w-full" disabled={pending}>
        {pending ? "Removing…" : "Remove my data"}
      </Button>
      {state && !state.ok ? (
        <p className="text-center text-sm text-destructive">{state.message}</p>
      ) : null}
    </form>
  );
}
