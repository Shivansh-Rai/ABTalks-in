"use client";

import { useEffect, useMemo, useState } from "react";
import {
  resolveSkillAction,
  saveSkillsAction,
} from "@/app/actions/candidate-profile-actions";
import {
  CANONICAL_SKILLS,
  PROFILE_QUICK_SKILLS,
  canonicalSkillName,
} from "@/lib/skill-catalog";
import { ANALYTICS_EVENTS, skillCountBucket } from "@/lib/analytics/events";
import { useTrack } from "@/lib/analytics/use-track";
import { SkillCombobox, type SkillOption } from "./skill-combobox";
import { useSectionSave } from "./use-section-save";
import { useProfileWizard } from "./wizard-context";
import { PwField, PwInput, PwRow } from "./wizard-fields";

export type SkillRow = {
  skillId: string;
  name: string;
  categoryName: string | null;
};

/** Platform-derived; rendered read-only and never posted back. */
export type VerifiedSkillView = {
  skillId: string;
  name: string;
  sources: string[];
};

/**
 * The offerable list: every catalog entry, carrying a `Skill` row id where the
 * database already has one.
 *
 * Entries without an id are not a problem — `addOrResolve` sends the name to
 * `resolveSkillAction`, which folds it onto the canonical row or creates it.
 * That is why the page only pre-resolves the quick-add handful rather than
 * every name in a four-hundred-entry catalog.
 */
function mergeCatalog(resolved: readonly SkillOption[]): SkillOption[] {
  const byName = new Map(
    resolved.map((s) => [s.name.toLowerCase(), s] as const),
  );
  return CANONICAL_SKILLS.map((entry) => {
    const known = byName.get(entry.name.toLowerCase());
    return known
      ? { ...known, categoryName: known.categoryName ?? entry.group }
      : { id: "", name: entry.name, slug: "", categoryName: entry.group };
  });
}

export function SkillsSection({
  initial,
  catalog,
  verified,
}: {
  initial: SkillRow[];
  catalog: SkillOption[];
  verified: VerifiedSkillView[];
}) {
  const { formId, onSaved, setDirty } = useProfileWizard();
  const { save } = useSectionSave(saveSkillsAction, "Skills", "skills");
  const track = useTrack();
  const [rows, setRows] = useState<SkillRow[]>(initial);
  /* Derived, not mirrored: `initial` is the server's list, and a save calls
     router.refresh(), so the saved tick follows the database rather than a
     second copy of it that could drift. */
  const persistedIds = useMemo(
    () => new Set(initial.map((r) => r.skillId)),
    [initial],
  );
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherDraft, setOtherDraft] = useState("");
  const [otherError, setOtherError] = useState<string | null>(null);
  const [otherBusy, setOtherBusy] = useState(false);

  const options = useMemo(() => mergeCatalog(catalog), [catalog]);
  const selectedIds = rows.map((r) => r.skillId).filter((id) => id.length > 0);
  const selectedNames = rows.map((r) => r.name);
  const selectedNameSet = new Set(selectedNames.map((n) => n.toLowerCase()));
  const quickAdds = options
    .filter((s) => PROFILE_QUICK_SKILLS.includes(s.name))
    .filter(
    (s) =>
      !(s.id && selectedIds.includes(s.id)) &&
      !selectedNameSet.has(s.name.toLowerCase()),
  );

  useEffect(() => {
    setDirty(JSON.stringify(rows) !== JSON.stringify(initial));
  }, [rows, initial, setDirty]);

  function add(skill: SkillOption) {
    if (!skill.id) return;
    setRows((prev) =>
      prev.some((r) => r.skillId === skill.id)
        ? prev
        : [
            ...prev,
            {
              skillId: skill.id,
              name: skill.name,
              categoryName: skill.categoryName,
            },
          ],
    );
  }

  async function addOrResolve(skill: SkillOption) {
    if (skill.id) {
      add(skill);
      return;
    }
    setOtherBusy(true);
    setOtherError(null);
    try {
      const result = await resolveSkillAction({
        name: canonicalSkillName(skill.name),
      });
      if (!result.ok) {
        setOtherError(result.message);
        return;
      }
      add(result.data);
    } finally {
      setOtherBusy(false);
    }
  }

  async function submitOther() {
    const name = canonicalSkillName(otherDraft);
    if (!name) return;
    if (selectedNameSet.has(name.toLowerCase())) {
      setOtherDraft("");
      setOtherError(null);
      return;
    }
    const fromCatalog = options.find(
      (s) => s.name.toLowerCase() === name.toLowerCase() && s.id,
    );
    if (fromCatalog) {
      add(fromCatalog);
      setOtherDraft("");
      setOtherError(null);
      return;
    }
    setOtherBusy(true);
    setOtherError(null);
    try {
      const result = await resolveSkillAction({ name });
      if (!result.ok) {
        setOtherError(result.message);
        return;
      }
      add(result.data);
      setOtherDraft("");
    } finally {
      setOtherBusy(false);
    }
  }

  function remove(skillId: string) {
    setRows((prev) => prev.filter((r) => r.skillId !== skillId));
  }

  return (
    <form
      id={formId}
      onSubmit={async (e) => {
        e.preventDefault();
        // Read against the ids the server already has, before the save moves
        // that line. A save that only re-rated or removed skills added nothing.
        const submittedIds = rows.map((r) => r.skillId);
        const addedCount = submittedIds.filter(
          (id) => !persistedIds.has(id),
        ).length;
        const ok = await save({
          claims: rows.map((r) => ({ skillId: r.skillId })),
        });
        if (ok) {
          if (addedCount > 0) {
            track(ANALYTICS_EVENTS.siteSkillAdded, {
              skill_count_bucket: skillCountBucket(submittedIds.length),
            });
          }
          onSaved();
        }
      }}
    >
      <PwRow cols={1}>
        <PwField label="Add your skills" htmlFor="skill-search">
          <div className="pw-tag-input-row">
            <SkillCombobox
              id="skill-search"
              catalog={options}
              excludeIds={selectedIds}
              excludeNames={selectedNames}
              onSelect={(skill) => void addOrResolve(skill)}
              onEnterFreeText={(name) =>
                void addOrResolve({
                  id: "",
                  name,
                  slug: "",
                  categoryName: null,
                })
              }
              onOther={() => {
                setOtherOpen(true);
                setOtherError(null);
              }}
            />
          </div>
          <div className="pw-quick-adds">
            <div className="pw-quick-label">Quick adds</div>
            <div className="pw-quick-row">
              {quickAdds.map((s) => (
                <button
                  key={s.id || s.name}
                  type="button"
                  className="pw-quick-chip"
                  disabled={otherBusy}
                  onClick={() => void addOrResolve(s)}
                >
                  {s.name}
                </button>
              ))}
              <button
                type="button"
                className={`pw-quick-chip pw-quick-other${otherOpen ? " pw-open" : ""}`}
                onClick={() => {
                  setOtherOpen((open) => !open);
                  setOtherError(null);
                }}
              >
                Other
              </button>
            </div>
          </div>
          {otherOpen ? (
            <div className="pw-skill-other">
              <div className="pw-tag-input-row">
                <PwInput
                  id="skill-other"
                  placeholder="Type a skill name"
                  value={otherDraft}
                  disabled={otherBusy}
                  onChange={(e) => setOtherDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitOther();
                    }
                  }}
                />
                <button
                  type="button"
                  className="pw-tag-add"
                  aria-label="Add skill"
                  disabled={otherBusy || otherDraft.trim().length === 0}
                  onClick={() => void submitOther()}
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
              {otherError ? (
                <div className="pw-skill-other-error" role="alert">
                  {otherError}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="pw-tag-list pw-tag-list-boxed">
            {rows.length === 0 ? (
              <div className="pw-tag-empty">
                No skills yet. Add at least one.
              </div>
            ) : (
              rows.map((row) => (
                <span key={row.skillId} className="pw-skill-chip">
                  {persistedIds.has(row.skillId) ? (
                    <svg
                      className="pw-skill-saved-tick"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                  <span className="pw-skill-chip-name">{row.name}</span>
                  <button
                    type="button"
                    className="pw-tag-remove"
                    aria-label={`Remove ${row.name}`}
                    onClick={() => remove(row.skillId)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
              ))
            )}
          </div>
        </PwField>
      </PwRow>

      {/* ---- Derived from curriculum + completion. Not editable. ---- */}
      <h3 className="pw-sub-title pw-sub-spaced">ABTalks Verified Skills</h3>
      <p className="pw-sub-text">
        These skills are added based on your enrollment and performance in
        Cohorts and Challenges.
      </p>

      {verified.length > 0 ? (
        <div className="pw-tag-list pw-skill-verified-list">
          {verified.map((skill) => (
            <span
              key={skill.skillId}
              className="pw-skill-chip pw-skill-chip-verified"
              title={`Earned from ${skill.sources.join(", ")}`}
            >
              <span className="pw-skill-verified-tick" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="pw-skill-chip-name">{skill.name}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="pw-verified-empty">
          No verified skills yet.
        </p>
      )}
    </form>
  );
}
