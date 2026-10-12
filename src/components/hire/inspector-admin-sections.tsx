"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import type {
  AdminEducationRow,
  AdminInspectorProfile,
} from "@/app/actions/admin-hire-profile-actions";
import type { InspectorWorkHistory } from "@/app/actions/hire-view-actions";
import {
  AdminInlineEdit,
  AdminInlineText,
  AdminRemoveButton,
} from "@/components/hire/admin-inline-field";
import type {
  EducationDates,
  EducationEdit,
  EducationScore,
  ExperienceDates,
  ExperienceEdit,
  SkillRef,
} from "@/features/hire/admin-profile-edit";
import { cn } from "@/lib/utils";

/**
 * The Platform Admin versions of View Details' Experience, Education and
 * self-declared Skills. Same layout and classes as the recruiter's read-only
 * markup in `candidate-inspector.tsx`, with a pencil beside each field.
 *
 * Only `CandidateInspector` renders these, and only for an admin. Types are
 * imported from the edit module, never values: the Zod schemas and the profile
 * vocabulary stay on the server, and the picker options arrive in `vocab`.
 */

type Vocab = AdminInspectorProfile["vocab"];
type Job = InspectorWorkHistory["rows"][number];

/** The inspector's own month names and "Jan 2024" formatter, passed down. */
export type DateFormat = {
  months: readonly string[];
  monthYear: (month: number | null, year: number | null) => string;
};

function MonthSelect({
  label,
  value,
  months,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  months: readonly string[];
  disabled: boolean;
  onChange: (next: number | null) => void;
}) {
  return (
    <select
      className="hire-edit__input"
      aria-label={label}
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : Number(event.target.value))
      }
    >
      <option value="">Month</option>
      {months.map((name, i) => (
        <option key={name} value={i + 1}>
          {name}
        </option>
      ))}
    </select>
  );
}

function YearInput({
  label,
  value,
  disabled,
  autoFocus = false,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  autoFocus?: boolean;
  onChange: (next: number | null) => void;
}) {
  return (
    <input
      className="hire-edit__input hire-edit__input--year"
      aria-label={label}
      type="number"
      inputMode="numeric"
      placeholder="Year"
      min={1950}
      max={2040}
      autoFocus={autoFocus}
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : Number(event.target.value))
      }
    />
  );
}

/* ─── Experience ─────────────────────────────────────────────────────────── */

export function AdminExperienceEntry({
  job,
  tile,
  span,
  employmentTypes,
  dates,
  open,
  onToggle,
  onEdit,
  onRemove,
}: {
  job: Job;
  /** The logo tile's letters. */
  tile: string;
  /** "Jan 2022 – Present", as the recruiter's view prints it. */
  span: string;
  employmentTypes: readonly string[];
  dates: DateFormat;
  open: boolean;
  onToggle: () => void;
  onEdit: (edit: ExperienceEdit) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}) {
  const detail = job.description?.trim() ?? "";
  const panelId = `hire-job-detail-${job.id}`;
  const initialDates: ExperienceDates = {
    startMonth: job.startMonth,
    startYear: job.startYear,
    endMonth: job.endMonth,
    endYear: job.endYear,
    isCurrent: job.isCurrent,
  };

  const description = (
    <AdminInlineText
      label="description"
      value={detail}
      emptyLabel="No description"
      multiline
      onSave={(value) => onEdit({ field: "description", value })}
    />
  );

  return (
    <div className="hire-profile__org-block">
      <span className="hire-profile__tile" aria-hidden="true">
        {tile}
      </span>
      <div className="hire-profile__org-main">
        {/* Not the recruiter's disclosure button: a field's pencil cannot sit
            inside another button, so the chevron is its own control here. */}
        <div className="hire-profile__job-head hire-profile__job-head--static">
          <span className="hire-profile__job-headings">
            <span className="hire-profile__job-role">
              <AdminInlineText
                label="job title"
                value={job.title}
                emptyLabel="No job title"
                onSave={(value) => onEdit({ field: "title", value })}
              />
            </span>
            <span className="hire-profile__job-at hire-edit-line">
              <AdminInlineText
                label="company"
                value={job.companyName}
                emptyLabel="No company"
                onSave={(value) => onEdit({ field: "companyName", value })}
              />
              <span aria-hidden="true">·</span>
              <AdminInlineText
                label="employment type"
                value={job.employmentType ?? ""}
                emptyLabel="No employment type"
                options={employmentTypes}
                onSave={(value) => onEdit({ field: "employmentType", value })}
              />
              <span aria-hidden="true">·</span>
              <AdminInlineText
                label="location"
                value={job.locationCity ?? ""}
                emptyLabel="No location"
                onSave={(value) => onEdit({ field: "locationCity", value })}
              />
            </span>
            <span className="hire-profile__meta">
              <AdminInlineEdit<ExperienceDates>
                label="dates"
                initial={initialDates}
                display={
                  span || <span className="hire-edit__empty">No dates</span>
                }
                compound
                onSave={(value) => onEdit({ field: "dates", value })}
                render={(draft, setDraft, { busy }) => (
                  <>
                    <MonthSelect
                      label="Start month"
                      value={draft.startMonth}
                      months={dates.months}
                      disabled={busy}
                      onChange={(startMonth) => setDraft({ ...draft, startMonth })}
                    />
                    <YearInput
                      label="Start year"
                      value={draft.startYear}
                      disabled={busy}
                      autoFocus
                      onChange={(startYear) => setDraft({ ...draft, startYear })}
                    />
                    <span aria-hidden="true">to</span>
                    <MonthSelect
                      label="End month"
                      value={draft.endMonth}
                      months={dates.months}
                      disabled={busy || draft.isCurrent}
                      onChange={(endMonth) => setDraft({ ...draft, endMonth })}
                    />
                    <YearInput
                      label="End year"
                      value={draft.endYear}
                      disabled={busy || draft.isCurrent}
                      onChange={(endYear) => setDraft({ ...draft, endYear })}
                    />
                    <label className="hire-edit__check">
                      <input
                        type="checkbox"
                        checked={draft.isCurrent}
                        disabled={busy}
                        onChange={(event) =>
                          setDraft({ ...draft, isCurrent: event.target.checked })
                        }
                      />
                      Present
                    </label>
                  </>
                )}
              />
            </span>
          </span>
          <span className="hire-edit__entry-actions">
            <AdminRemoveButton label="this experience entry" onRemove={onRemove} />
            {detail ? (
              <button
                type="button"
                className="hire-edit__btn hire-edit__btn--on"
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={open ? "Hide description" : "Show description"}
                onClick={onToggle}
              >
                <ChevronDown
                  className={cn("hire-profile__job-chevron", open && "is-open")}
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </span>
        </div>
        {detail ? (
          open ? (
            <p id={panelId} className="hire-profile__text">
              {description}
            </p>
          ) : null
        ) : (
          // Nothing to disclose yet, so the way to add one is always in view.
          <p className="hire-profile__meta">{description}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Education ──────────────────────────────────────────────────────────── */

function educationSpan(row: AdminEducationRow, dates: DateFormat): string {
  if (row.slot !== "higher") {
    if (row.isCurrent) return "Currently studying";
    return row.graduationYear ? `Passed ${row.graduationYear}` : "";
  }
  const from = dates.monthYear(row.startMonth, row.startYear);
  const to = row.isCurrent
    ? "Present"
    : dates.monthYear(row.endMonth, row.graduationYear);
  return from && to ? `${from} – ${to}` : from || to;
}

export function AdminEducationList({
  rows,
  vocab,
  dates,
  onEdit,
  onRemove,
}: {
  rows: AdminEducationRow[];
  vocab: Vocab;
  dates: DateFormat;
  onEdit: (rowId: string, edit: EducationEdit) => Promise<boolean>;
  onRemove: (rowId: string) => Promise<boolean>;
}) {
  if (rows.length === 0) {
    return <p className="hire-profile__meta">No education recorded</p>;
  }

  return (
    <>
      {rows.map((row) => {
        const can = (field: EducationEdit["field"]) =>
          row.editable.includes(field);
        const school = row.slot !== "higher";
        const scoreTypes = school ? vocab.schoolScoreTypes : vocab.scoreTypes;
        const scoreLabel =
          vocab.scoreTypes.find((t) => t.value === row.gradeType)?.label ??
          row.gradeType;
        const span = educationSpan(row, dates);
        const initialDates: EducationDates = {
          startMonth: row.startMonth,
          startYear: row.startYear,
          endMonth: row.endMonth,
          graduationYear: row.graduationYear,
          isCurrent: row.isCurrent,
        };
        const initialScore: EducationScore = {
          gradeType: row.gradeType,
          grade: row.grade ?? "",
        };

        return (
          <div key={row.id} className="hire-profile__org-block">
            <span
              className="hire-profile__tile hire-profile__tile--school"
              aria-hidden="true"
            >
              {(row.institutionName || "?").trim().charAt(0).toUpperCase()}
            </span>
            <div className="hire-profile__org-main">
              <div className="hire-profile__job-head hire-profile__job-head--static">
                <span className="hire-profile__job-headings">
                  <span className="hire-profile__job-role">
                    <AdminInlineText
                      label="institution"
                      value={row.institutionName}
                      emptyLabel="No institution"
                      onSave={(value) =>
                        onEdit(row.id, { field: "institutionName", value })
                      }
                    />
                  </span>
                  <span className="hire-profile__job-at hire-edit-line">
                    {can("degree") ? (
                      <AdminInlineText
                        label="degree"
                        value={row.degree ?? ""}
                        emptyLabel="No degree"
                        onSave={(value) =>
                          onEdit(row.id, { field: "degree", value })
                        }
                      />
                    ) : (
                      // Class X and XII are named by their tab on the
                      // candidate's form, not typed.
                      <span>{row.degree}</span>
                    )}
                    {can("fieldOfStudy") ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <AdminInlineText
                          label="field of study"
                          value={row.fieldOfStudy ?? ""}
                          emptyLabel="No field of study"
                          onSave={(value) =>
                            onEdit(row.id, { field: "fieldOfStudy", value })
                          }
                        />
                      </>
                    ) : null}
                  </span>
                  <span className="hire-profile__meta">
                    <AdminInlineEdit<EducationDates>
                      label={school ? "year of passing" : "dates"}
                      initial={initialDates}
                      display={
                        span || (
                          <span className="hire-edit__empty">
                            {school ? "No year of passing" : "No dates"}
                          </span>
                        )
                      }
                      compound
                      onSave={(value) =>
                        onEdit(row.id, { field: "dates", value })
                      }
                      render={(draft, setDraft, { busy }) => (
                        <>
                          {school ? null : (
                            <>
                              <MonthSelect
                                label="Start month"
                                value={draft.startMonth}
                                months={dates.months}
                                disabled={busy}
                                onChange={(startMonth) =>
                                  setDraft({ ...draft, startMonth })
                                }
                              />
                              <YearInput
                                label="Start year"
                                value={draft.startYear}
                                disabled={busy}
                                autoFocus
                                onChange={(startYear) =>
                                  setDraft({ ...draft, startYear })
                                }
                              />
                              <span aria-hidden="true">to</span>
                              <MonthSelect
                                label="End month"
                                value={draft.endMonth}
                                months={dates.months}
                                disabled={busy || draft.isCurrent}
                                onChange={(endMonth) =>
                                  setDraft({ ...draft, endMonth })
                                }
                              />
                            </>
                          )}
                          <YearInput
                            label={school ? "Year of passing" : "End year"}
                            value={draft.graduationYear}
                            disabled={busy || draft.isCurrent}
                            autoFocus={school}
                            onChange={(graduationYear) =>
                              setDraft({ ...draft, graduationYear })
                            }
                          />
                          {/* Class X is always a year already passed. */}
                          {row.slot === "tenth" ? null : (
                            <label className="hire-edit__check">
                              <input
                                type="checkbox"
                                checked={draft.isCurrent}
                                disabled={busy}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    isCurrent: event.target.checked,
                                  })
                                }
                              />
                              Currently studying
                            </label>
                          )}
                        </>
                      )}
                    />
                  </span>
                  <span className="hire-profile__meta">
                    <AdminInlineEdit<EducationScore>
                      label="score"
                      initial={initialScore}
                      display={
                        row.grade ? (
                          [row.grade, scoreLabel].filter(Boolean).join(" · ")
                        ) : (
                          <span className="hire-edit__empty">No score</span>
                        )
                      }
                      compound
                      onSave={(value) =>
                        onEdit(row.id, { field: "score", value })
                      }
                      render={(draft, setDraft, { busy }) => (
                        <>
                          <select
                            className="hire-edit__input"
                            aria-label="Score type"
                            disabled={busy}
                            value={draft.gradeType ?? ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                gradeType:
                                  event.target.value === ""
                                    ? null
                                    : (event.target
                                        .value as EducationScore["gradeType"]),
                              })
                            }
                          >
                            <option value="">Score type</option>
                            {/* A stored scale this slot no longer offers. */}
                            {draft.gradeType &&
                            !scoreTypes.some(
                              (t) => t.value === draft.gradeType,
                            ) ? (
                              <option value={draft.gradeType}>
                                {scoreLabel ?? draft.gradeType}
                              </option>
                            ) : null}
                            {scoreTypes.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <input
                            className="hire-edit__input hire-edit__input--year"
                            aria-label="Score"
                            placeholder="Score"
                            autoFocus
                            disabled={busy}
                            value={draft.grade}
                            onChange={(event) =>
                              setDraft({ ...draft, grade: event.target.value })
                            }
                          />
                        </>
                      )}
                    />
                  </span>
                </span>
                <span className="hire-edit__entry-actions">
                  <AdminRemoveButton
                    label="this education entry"
                    onRemove={() => onRemove(row.id)}
                  />
                </span>
              </div>
              {can("description") ? (
                <p
                  className={
                    row.description ? "hire-profile__text" : "hire-profile__meta"
                  }
                >
                  <AdminInlineText
                    label="description"
                    value={row.description ?? ""}
                    emptyLabel="No description"
                    multiline
                    onSave={(value) =>
                      onEdit(row.id, { field: "description", value })
                    }
                  />
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ─── Skills ─────────────────────────────────────────────────────────────── */

export type AdminSkillChange =
  | { kind: "add"; name: string }
  | { kind: "remove"; skillId: string }
  | { kind: "replace"; skillId: string; name: string };

type SkillSearch = (query: string, limit?: number) => string[];

/**
 * A skill name with the catalog's own suggestions under it.
 *
 * The catalog is loaded when the first input opens rather than with the desk:
 * it is four hundred entries that only an admin editing a skill ever needs.
 * Whatever is typed is folded onto the catalog on the server either way.
 */
function SkillNameInput({
  label,
  value,
  busy,
  onChange,
}: {
  label: string;
  value: string;
  busy: boolean;
  onChange: (next: string) => void;
}) {
  const listId = useId();
  const [search, setSearch] = useState<SkillSearch | null>(null);

  useEffect(() => {
    let alive = true;
    void import("@/lib/skill-catalog").then((catalog) => {
      if (alive) setSearch(() => catalog.searchCanonicalSkillNames);
    });
    return () => {
      alive = false;
    };
  }, []);

  const suggestions = search && value.trim() ? search(value, 8) : [];

  return (
    <>
      <input
        className="hire-edit__input"
        aria-label={label}
        placeholder="Skill name"
        list={listId}
        autoFocus
        autoComplete="off"
        disabled={busy}
        value={value}
        size={Math.max(10, Math.min(value.length + 2, 28))}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}

/**
 * Self-declared claims only. Evidence-backed skills are rendered by the
 * inspector exactly as a recruiter sees them, with no controls: the server
 * refuses to change them and this never offers to.
 */
export function AdminSelfDeclaredSkills({
  skills,
  isHit,
  onChange,
}: {
  skills: SkillRef[];
  /** Whether a skill answers the recruiter's search, for the highlight tint. */
  isHit: (name: string) => boolean;
  onChange: (change: AdminSkillChange) => Promise<boolean>;
}) {
  // One removal at a time: a second click on the same chip would otherwise
  // ask the server to remove a claim that is already gone.
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(skillId: string) {
    setRemoving(skillId);
    await onChange({ kind: "remove", skillId });
    setRemoving(null);
  }

  return (
    <div className="hire-profile__group">
      <p className="hire-profile__group-h">Self-declared</p>
      <ul className="hire-profile__chips">
        {skills.map((skill) => (
          <li
            key={skill.skillId}
            className={cn(
              "hire-profile__chip hire-edit-chip",
              isHit(skill.name) && "hire-profile__chip--hit",
            )}
          >
            <AdminInlineEdit<string>
              label={`skill ${skill.name}`}
              initial={skill.name}
              display={skill.name}
              onSave={(name) =>
                onChange({ kind: "replace", skillId: skill.skillId, name })
              }
              render={(draft, setDraft, { busy }) => (
                <SkillNameInput
                  label={`Replace ${skill.name} with`}
                  value={draft}
                  busy={busy}
                  onChange={setDraft}
                />
              )}
            />
            <button
              type="button"
              className="hire-edit__btn"
              aria-label={`Remove skill ${skill.name}`}
              title={`Remove ${skill.name}`}
              disabled={removing !== null}
              onClick={() => {
                void remove(skill.skillId);
              }}
            >
              <X size={13} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
            </button>
          </li>
        ))}
        <li>
          <AdminInlineEdit<string>
            label="new skill"
            initial=""
            className="hire-profile__chip hire-edit-chip"
            onSave={(name) => onChange({ kind: "add", name })}
            trigger={(open) => (
              <button
                type="button"
                className="hire-profile__chip hire-edit-chip hire-edit-chip--add"
                onClick={open}
              >
                <Plus size={14} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
                Add skill
              </button>
            )}
            render={(draft, setDraft, { busy }) => (
              <SkillNameInput
                label="Skill to add"
                value={draft}
                busy={busy}
                onChange={setDraft}
              />
            )}
          />
        </li>
      </ul>
    </div>
  );
}
