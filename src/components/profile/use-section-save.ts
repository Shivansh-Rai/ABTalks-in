"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/app/actions/candidate-profile-actions";
import type { IssueSink } from "./field-issues";
import { ANALYTICS_EVENTS, type ProfileSection } from "@/lib/analytics/events";
import { useTrack } from "@/lib/analytics/use-track";
import { useProfileWizard } from "./wizard-context";

/**
 * Saves one section and refreshes the server tree so profile strength and every
 * other section's derived state recompute from the database rather than from an
 * optimistic guess made here.
 *
 * Every profile section save goes through here, which makes it the one place
 * `site_profile_updated` needs to be emitted from — once per save that the
 * server confirmed, never on a validation failure and never on a thrown call.
 *
 * `section` is a separate argument from `label` on purpose: `label` is user
 * facing copy that can be reworded at any time, and an analytics dimension that
 * changes when somebody edits a toast message is not a dimension.
 */
export function useSectionSave(
  action: (payload: unknown) => Promise<ActionResult>,
  label: string,
  section: ProfileSection,
) {
  const router = useRouter();
  const { setSaving: setWizardSaving } = useProfileWizard();
  const track = useTrack();
  const [saving, setSaving] = useState(false);

  /**
   * `placeIssues` takes the server's field-level failures and returns how many
   * it managed to put under an actual input. Anything it placed is already on
   * screen beside the thing to fix, so a toast would only repeat it in the
   * corner — the toast is the fallback for failures with no field to blame
   * (not signed in, write failed, a rule about the section as a whole).
   */
  const save = useCallback(
    async (payload: unknown, placeIssues?: IssueSink): Promise<boolean> => {
      setSaving(true);
      setWizardSaving(true);
      try {
        const result = await action(payload);
        if (!result.ok) {
          const placed = placeIssues?.(result.issues ?? []) ?? 0;
          if (placed === 0) toast.error(result.message);
          return false;
        }
        track(ANALYTICS_EVENTS.siteProfileUpdated, { section });
        toast.success(`${label} saved`);
        router.refresh();
        return true;
      } catch {
        toast.error("Could not save. Please try again.");
        return false;
      } finally {
        setSaving(false);
        setWizardSaving(false);
      }
    },
    [action, label, section, router, setWizardSaving, track],
  );

  return { saving, save };
}
