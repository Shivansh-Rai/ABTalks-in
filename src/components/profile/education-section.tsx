"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  type FieldPath,
} from "react-hook-form";
import { GradeType } from "@prisma/client";
import { CollegeCombobox } from "@/components/shared/college-combobox";
import { saveEducationAction } from "@/app/actions/candidate-profile-actions";
import {
  COLLEGE_DEGREES,
  DIPLOMA_DEGREE,
  GRADE_TYPE_LABELS,
  OTHER_EDUCATION_DEGREES,
  SCHOOL_SCORE_TYPE_OPTIONS,
  SCORE_TYPE_OPTIONS,
  TENTH_DEGREE,
  TWELFTH_DEGREE,
  assignEducationSlots,
  departmentsForDegree,
  educationLevelOf,
  inferGradeType,
  searchDegrees,
} from "@/lib/candidate-vocab";
import {
  EDUCATION_MAX_SPAN_YEARS,
  EDUCATION_MIN_YEAR,
  READS_AS_TEXT,
  educationTimelineIssues,
  gradeScoreIssue,
  type EducationTimelineIssue,
} from "@/lib/validations/candidate-profile";
import { endBeforeStart, useServerFieldErrors, type IssueSink } from "./field-issues";
import { useSectionSave } from "./use-section-save";
import { useProfileWizard } from "./wizard-context";
import {
  PwAddMore,
  PwCheckbox,
  PwEntryCard,
  PwField,
  PwInput,
  CURRENT_YEAR,
  PwMenuSelect,
  PwMonthYear,
  PwRow,
  PwSuggest,
  PwTextarea,
} from "./wizard-fields";

export type EducationFormRow = {
  institutionName: string;
  collegeId: string;
  degree: string;
  fieldOfStudy: string;
  startMonth: number | null;
  startYear: number | null;
  endMonth: number | null;
  graduationYear: number | null;
  isCurrent: boolean;
  gradeType: GradeType | "";
  grade: string;
  description: string;
};

type FormValues = { rows: EducationFormRow[] };

export const emptyEducationRow: EducationFormRow = {
  institutionName: "",
  collegeId: "",
  degree: "",
  fieldOfStudy: "",
  startMonth: null,
  startYear: null,
  endMonth: null,
  graduationYear: null,
  isCurrent: false,
  gradeType: "",
  grade: "",
  description: "",
};

/**
 * Where each slot lives in the form. The three slots are always present, in
 * this order, and other education follows. The order rows are SAVED in is
 * different — see `toPayload` — and server issues are mapped back here.
 */
const TENTH = 0;
const TWELFTH = 1;
const COLLEGE = 2;
const OTHER_FROM = 3;

type Slot = typeof TENTH | typeof TWELFTH | typeof COLLEGE;

const TABS: { slot: Slot; label: string; title: string }[] = [
  { slot: TENTH, label: "Class X", title: "Class X" },
  { slot: TWELFTH, label: "XII / Diploma", title: "Class XII or Diploma" },
  { slot: COLLEGE, label: "College", title: "College" },
];

const SLOT_DEFAULT: Record<Slot, EducationFormRow> = {
  [TENTH]: { ...emptyEducationRow, degree: TENTH_DEGREE },
  [TWELFTH]: { ...emptyEducationRow, degree: TWELFTH_DEGREE },
  [COLLEGE]: { ...emptyEducationRow },
};

const CURRENT_MONTH = new Date().getMonth() + 1;

/** Board results go back further than the college picker does. */
const PASSING_YEARS: string[] = Array.from(
  { length: CURRENT_YEAR - 1980 + 1 },
  (_, i) => String(CURRENT_YEAR - i),
);

const GRADE_PLACEHOLDER: Record<string, string> = {
  PERCENTAGE: "e.g. 82.5",
  CGPA_10: "e.g. 8.6",
  GPA_4: "e.g. 3.7",
  GRADE: "e.g. A+",
};

/* ─── Load and save ──────────────────────────────────────────────────────── */

/** A résumé writes "92%" or "8.7/10" with no scale; split it so it validates. */
function withScale(row: EducationFormRow): EducationFormRow {
  if (row.gradeType !== "" || !row.grade.trim()) return row;
  const inferred = inferGradeType(row.grade);
  return inferred ? { ...row, ...inferred } : row;
}

function toFormRows(initial: EducationFormRow[]): EducationFormRow[] {
  const slots = assignEducationSlots(initial);
  return [
    slots.tenth ?? SLOT_DEFAULT[TENTH],
    slots.twelfth ?? SLOT_DEFAULT[TWELFTH],
    slots.college ?? SLOT_DEFAULT[COLLEGE],
    ...slots.others,
  ].map(withScale);
}

/** The slot's degree is set by its tab, not typed, so it alone is not an entry. */
function slotHasContent(row: EducationFormRow): boolean {
  return (
    [row.institutionName, row.fieldOfStudy, row.grade, row.gradeType].some(
      (v) => v.trim() !== "",
    ) ||
    row.graduationYear !== null ||
    row.isCurrent
  );
}

/**
 * A slot sends only the fields its tab shows, so an older row's hidden start
 * date or description cannot fail a rule the candidate has no way to see.
 */
function slotRow(index: number, row: EducationFormRow): EducationFormRow {
  if (index >= COLLEGE) return row;
  if (!slotHasContent(row)) return { ...emptyEducationRow };
  const base: EducationFormRow = {
    ...emptyEducationRow,
    institutionName: row.institutionName,
    gradeType: row.gradeType,
    grade: row.grade,
  };
  if (index === TENTH) {
    return { ...base, degree: TENTH_DEGREE, graduationYear: row.graduationYear };
  }
  const diploma = educationLevelOf(row.degree) === "DIPLOMA";
  return {
    ...base,
    collegeId: diploma ? row.collegeId : "",
    // A diploma keeps its own wording ("Diploma in Civil", "ITI").
    degree: diploma ? row.degree : TWELFTH_DEGREE,
    fieldOfStudy: row.fieldOfStudy,
    isCurrent: row.isCurrent,
    graduationYear: row.isCurrent ? null : row.graduationYear,
  };
}

/**
 * Saved order: college first, then other degrees, then XII / Diploma, then
 * Class X, then any further diplomas. College first keeps it the row every
 * "first education" reader picks, and `assignEducationSlots` reads this order
 * back into exactly the same slots.
 */
function toPayload(rows: EducationFormRow[]): {
  payload: FormValues;
  order: number[];
} {
  const others = rows.slice(OTHER_FROM).map((_, k) => OTHER_FROM + k);
  const degrees = others.filter((i) => educationLevelOf(rows[i]!.degree) === "HIGHER");
  const diplomas = others.filter((i) => !degrees.includes(i));
  const order = [COLLEGE, ...degrees, TWELFTH, TENTH, ...diplomas];
  return {
    payload: { rows: order.map((i) => slotRow(i, rows[i]!)) },
    order,
  };
}

/** Server issues name saved positions; put each back on the form row it came from. */
function remapIssues(
  order: number[],
  reveal: (index: number) => void,
  sink: IssueSink,
): IssueSink {
  return (issues) => {
    const mapped = issues.map((issue) => {
      const m = /^rows\.(\d+)\.(.+)$/.exec(issue.path);
      const to = m ? order[Number(m[1])] : undefined;
      return to === undefined ? issue : { ...issue, path: `rows.${to}.${m![2]}` };
    });
    const first = mapped
      .map((issue) => /^rows\.(\d+)\./.exec(issue.path))
      .find((m) => m !== null);
    if (first) reveal(Number(first[1]));
    return sink(mapped);
  };
}

/* ─── Shared rules ───────────────────────────────────────────────────────── */

function timelineIssue(
  rows: EducationFormRow[],
  index: number,
  field: EducationTimelineIssue["field"],
): string | true {
  const hit = educationTimelineIssues(rows).find(
    (issue) => issue.index === index && issue.field === field,
  );
  return hit?.message ?? true;
}

const textIssue = (message: string) => (value: string) =>
  value.trim() === "" || READS_AS_TEXT.test(value) ? true : message;

/** One year can make another wrong (or right again) in a different tab. */
function useTimelineRecheck() {
  const { trigger, getValues } = useFormContext<FormValues>();
  return useCallback(() => {
    const paths: FieldPath<FormValues>[] = [];
    getValues("rows").forEach((_, i) => {
      paths.push(`rows.${i}.graduationYear`, `rows.${i}.startYear`, `rows.${i}.degree`);
    });
    void trigger(paths);
  }, [trigger, getValues]);
}

/* ─── Section ────────────────────────────────────────────────────────────── */

export function EducationSection({ initial }: { initial: EducationFormRow[] }) {
  const { formId, onSaved, setDirty } = useProfileWizard();
  const { save } = useSectionSave(saveEducationAction, "Education", "education");
  const form = useForm<FormValues>({
    // Live: a wrong date pair says so while it is being picked, and stops
    // saying so the moment it is fixed.
    mode: "onChange",
    defaultValues: { rows: toFormRows(initial) },
  });
  const { control, handleSubmit, formState } = form;
  const { errors } = formState;
  const placeIssues = useServerFieldErrors(form);
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "rows",
  });

  const [active, setActive] = useState<Slot>(() => {
    const rows = form.getValues("rows");
    const firstOpen = TABS.find((t) => !slotDone(t.slot, rows[t.slot]!));
    return firstOpen?.slot ?? TENTH;
  });
  /** Which way the slides move; null until the first switch, so opening does not animate. */
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);

  useEffect(() => {
    setDirty(formState.isDirty);
  }, [formState.isDirty, setDirty]);

  const go = useCallback(
    (slot: Slot) => {
      if (slot === active) return;
      setDirection(slot > active ? "next" : "prev");
      setActive(slot);
    },
    [active],
  );

  /** Shows the tab holding a failed field before the form tries to focus it. */
  const reveal = useCallback(
    (index: number) => {
      if (index < OTHER_FROM) flushSync(() => go(index as Slot));
    },
    [go],
  );

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, at: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = TABS[(at + step + TABS.length) % TABS.length]!.slot;
    go(next);
    document.getElementById(`edu-tab-${next}`)?.focus();
  }

  const rows = useWatch({ control, name: "rows" });
  const others = fields.slice(OTHER_FROM);

  return (
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={handleSubmit(
          async (v) => {
            const { payload, order } = toPayload(v.rows);
            if (await save(payload, remapIssues(order, reveal, placeIssues))) onSaved();
          },
          (errs) => {
            const list = errs.rows as unknown as (object | undefined)[] | undefined;
            const first = Array.isArray(list) ? list.findIndex(Boolean) : -1;
            if (first >= 0) reveal(first);
          },
        )}
      >
        <div className="pw-edu-tabs-wrap">
          <span className="pw-edu-tabs-label" id="edu-tabs-label">
            Add details
          </span>
          <div
            className="pw-edu-tabs"
            role="tablist"
            aria-labelledby="edu-tabs-label"
          >
            {TABS.map((tab, at) => {
              const selected = tab.slot === active;
              const done = slotDone(tab.slot, rows[tab.slot] ?? SLOT_DEFAULT[tab.slot]);
              const failed = Boolean(errors.rows?.[tab.slot]);
              return (
                <button
                  key={tab.slot}
                  id={`edu-tab-${tab.slot}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`edu-slide-${tab.slot}`}
                  tabIndex={selected ? 0 : -1}
                  className={[
                    "pw-edu-tab",
                    selected ? "pw-active" : "",
                    failed ? "pw-has-error" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => go(tab.slot)}
                  onKeyDown={(e) => onTabKey(e, at)}
                >
                  <span className="pw-edu-tab-label">{tab.label}</span>
                  {done ? (
                    <svg className="pw-edu-tab-done" viewBox="0 0 24 24" aria-label="Added">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pw-edu-slides" data-dir={direction ?? undefined}>
          {TABS.map((tab) => (
            <div
              key={tab.slot}
              id={`edu-slide-${tab.slot}`}
              role="tabpanel"
              aria-labelledby={`edu-tab-${tab.slot}`}
              className="pw-edu-slide"
              hidden={tab.slot !== active}
            >
              <div className="pw-entry-head">
                <div className="pw-entry-title">{tab.title}</div>
                {slotTouched(tab.slot, rows[tab.slot] ?? SLOT_DEFAULT[tab.slot]) ? (
                  <button
                    type="button"
                    className="pw-entry-remove"
                    title="Clear this entry"
                    onClick={() => update(tab.slot, { ...SLOT_DEFAULT[tab.slot] })}
                  >
                    <TrashIcon />
                    <span>Clear</span>
                  </button>
                ) : null}
              </div>
              {fields[tab.slot] ? (
                <div key={fields[tab.slot]!.id}>
                  {tab.slot === TENTH ? <TenthFields /> : null}
                  {tab.slot === TWELFTH ? <TwelfthFields /> : null}
                  {tab.slot === COLLEGE ? (
                    <HigherEducationFields index={COLLEGE} degrees={COLLEGE_DEGREES} />
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="pw-edu-other">
          <div className="pw-edu-other-head">
            <h3 className="pw-edu-other-title">Other education</h3>
            <p className="pw-edu-other-text">
              A postgraduate degree, a second diploma, or any other course.
              Optional — it does not change your profile strength.
            </p>
          </div>
          {others.length > 0 ? (
            <div className="pw-entries">
              {others.map((field, k) => (
                <PwEntryCard
                  key={field.id}
                  index={k}
                  title="Other education"
                  onRemove={() => remove(OTHER_FROM + k)}
                >
                  <HigherEducationFields
                    index={OTHER_FROM + k}
                    degrees={OTHER_EDUCATION_DEGREES}
                  />
                </PwEntryCard>
              ))}
            </div>
          ) : null}
          <PwAddMore onClick={() => append({ ...emptyEducationRow })}>
            Add other education
          </PwAddMore>
        </div>
      </form>
    </FormProvider>
  );
}

/** Anything worth a Clear button. College shows more fields than the school slots. */
function slotTouched(slot: Slot, row: EducationFormRow): boolean {
  if (slotHasContent(row)) return true;
  if (slot !== COLLEGE) return false;
  return (
    row.degree.trim() !== "" ||
    row.description.trim() !== "" ||
    row.startYear !== null ||
    row.startMonth !== null
  );
}

/** The same gates `computeCompleteness` scores each slot by. */
function slotDone(slot: Slot, row: EducationFormRow): boolean {
  const name = row.institutionName.trim() !== "";
  if (slot === TENTH) return name && row.graduationYear !== null;
  if (slot === TWELFTH) {
    return (
      name &&
      row.fieldOfStudy.trim() !== "" &&
      (row.isCurrent || row.graduationYear !== null)
    );
  }
  return (
    name &&
    row.degree.trim() !== "" &&
    row.fieldOfStudy.trim() !== "" &&
    row.startYear !== null &&
    (row.isCurrent || row.graduationYear !== null)
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

/* ─── Fields ─────────────────────────────────────────────────────────────── */

function ScoreFields({
  index,
  options,
}: {
  index: number;
  options: readonly string[];
}) {
  const {
    control,
    register,
    watch,
    trigger,
    formState: { errors },
  } = useFormContext<FormValues>();
  const gradeType = watch(`rows.${index}.gradeType`);
  const numericScore =
    gradeType === "PERCENTAGE" || gradeType === "CGPA_10" || gradeType === "GPA_4";
  return (
    <>
      <PwField label="Score type" htmlFor={`edu-grade-type-${index}`}>
        <Controller
          control={control}
          name={`rows.${index}.gradeType`}
          render={({ field: f }) => (
            <PwMenuSelect
              id={`edu-grade-type-${index}`}
              aria-label="Score type"
              placeholder="Select"
              value={f.value}
              options={options}
              labels={GRADE_TYPE_LABELS}
              onChange={(v) => {
                f.onChange(v as GradeType | "");
                void trigger(`rows.${index}.grade`);
              }}
            />
          )}
        />
      </PwField>
      <PwField
        label="Score"
        htmlFor={`edu-grade-${index}`}
        error={errors.rows?.[index]?.grade?.message}
      >
        <PwInput
          id={`edu-grade-${index}`}
          inputMode={numericScore ? "decimal" : undefined}
          placeholder={gradeType ? GRADE_PLACEHOLDER[gradeType] : "e.g. 7.9"}
          aria-invalid={Boolean(errors.rows?.[index]?.grade)}
          {...register(`rows.${index}.grade`, {
            validate: (value, values) => {
              const type = values.rows[index]?.gradeType || null;
              return gradeScoreIssue(type, value) ?? true;
            },
          })}
        />
      </PwField>
    </>
  );
}

/** Year only: a board result is known by the year it was declared. */
function PassingYear({ index, id }: { index: number; id: string }) {
  const { control } = useFormContext<FormValues>();
  const recheck = useTimelineRecheck();
  return (
    <Controller
      control={control}
      name={`rows.${index}.graduationYear`}
      rules={{
        validate: (value, values) => {
          if (value !== null && value > CURRENT_YEAR) {
            return "Year of passing cannot be in the future";
          }
          return timelineIssue(values.rows, index, "graduationYear");
        },
      }}
      render={({ field: f, fieldState }) => (
        <PwMenuSelect
          id={id}
          aria-label="Passing year"
          placeholder="Year"
          value={f.value === null ? "" : String(f.value)}
          options={PASSING_YEARS}
          invalid={Boolean(fieldState.error)}
          onChange={(v) => {
            f.onChange(v === "" ? null : Number(v));
            recheck();
          }}
        />
      )}
    />
  );
}

function TenthFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormValues>();
  const row = errors.rows?.[TENTH];
  return (
    <>
      <PwRow cols={1}>
        <PwField
          label="School name"
          required
          htmlFor="edu-x-school"
          error={row?.institutionName?.message}
        >
          <PwInput
            id="edu-x-school"
            placeholder="e.g. Kendriya Vidyalaya, Sector 8"
            aria-invalid={Boolean(row?.institutionName)}
            {...register(`rows.${TENTH}.institutionName`, {
              validate: textIssue("Enter a real school name"),
            })}
          />
        </PwField>
      </PwRow>
      <PwRow cols={3}>
        <PwField
          label="Year of passing"
          required
          htmlFor="edu-x-year"
          error={row?.graduationYear?.message}
        >
          <PassingYear index={TENTH} id="edu-x-year" />
        </PwField>
        <ScoreFields index={TENTH} options={SCHOOL_SCORE_TYPE_OPTIONS} />
      </PwRow>
    </>
  );
}

function TwelfthFields() {
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<FormValues>();
  const recheck = useTimelineRecheck();
  const i = TWELFTH;
  const row = errors.rows?.[i];
  const degree = watch(`rows.${i}.degree`);
  const isCurrent = watch(`rows.${i}.isCurrent`);
  const diploma = educationLevelOf(degree) === "DIPLOMA";

  function choose(nextDiploma: boolean) {
    if (nextDiploma === diploma) return;
    setValue(`rows.${i}.degree`, nextDiploma ? DIPLOMA_DEGREE : TWELFTH_DEGREE, {
      shouldDirty: true,
    });
    // The college catalog id only means something for an institute.
    if (!nextDiploma) setValue(`rows.${i}.collegeId`, "", { shouldDirty: true });
    recheck();
  }

  return (
    <>
      <div className="pw-edu-kind" role="radiogroup" aria-label="Qualification">
        {[false, true].map((isDiploma) => (
          <button
            key={String(isDiploma)}
            type="button"
            role="radio"
            aria-checked={diploma === isDiploma}
            className={`pw-edu-kind-option${diploma === isDiploma ? " pw-active" : ""}`}
            onClick={() => choose(isDiploma)}
          >
            {isDiploma ? "Diploma" : "Class XII"}
          </button>
        ))}
      </div>

      <PwRow cols={1}>
        <PwField
          label={diploma ? "Institute name" : "School name"}
          required
          htmlFor="edu-xii-school"
          error={row?.institutionName?.message}
        >
          <Controller
            control={control}
            name={`rows.${i}.institutionName`}
            rules={{
              validate: textIssue(
                diploma ? "Enter a real institute name" : "Enter a real school name",
              ),
            }}
            render={({ field: f, fieldState }) =>
              diploma ? (
                <CollegeCombobox
                  id="edu-xii-school"
                  value={f.value}
                  aria-invalid={Boolean(fieldState.error)}
                  onChange={(name, collegeId) => {
                    f.onChange(name);
                    setValue(`rows.${i}.collegeId`, collegeId ?? "");
                  }}
                  placeholder="Enter your polytechnic or institute"
                />
              ) : (
                <PwInput
                  id="edu-xii-school"
                  placeholder="e.g. Delhi Public School, R.K. Puram"
                  aria-invalid={Boolean(fieldState.error)}
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                  onBlur={f.onBlur}
                  ref={f.ref}
                />
              )
            }
          />
        </PwField>
      </PwRow>

      <PwRow cols={1}>
        <PwField
          label={diploma ? "Branch" : "Stream"}
          required
          htmlFor="edu-xii-field"
          error={row?.fieldOfStudy?.message}
        >
          <PwSuggest
            id="edu-xii-field"
            placeholder={diploma ? "e.g. Computer Engineering" : "e.g. Science (PCM)"}
            suggestions={departmentsForDegree(degree)}
            aria-invalid={Boolean(row?.fieldOfStudy)}
            {...register(`rows.${i}.fieldOfStudy`, {
              validate: textIssue(
                diploma ? "Enter a real branch" : "Enter a real stream",
              ),
            })}
          />
        </PwField>
      </PwRow>

      <PwRow cols={1}>
        <Controller
          control={control}
          name={`rows.${i}.isCurrent`}
          render={({ field: f }) => (
            <PwCheckbox
              id="edu-xii-current"
              checked={f.value}
              onChange={(checked) => {
                f.onChange(checked);
                if (checked) setValue(`rows.${i}.graduationYear`, null);
                recheck();
              }}
            >
              {diploma ? "Currently studying here" : "Currently in Class XII"}
            </PwCheckbox>
          )}
        />
      </PwRow>

      <PwRow cols={3}>
        <div
          style={{
            visibility: isCurrent ? "hidden" : undefined,
            pointerEvents: isCurrent ? "none" : undefined,
          }}
        >
          <PwField
            label="Year of passing"
            required
            htmlFor="edu-xii-year"
            error={row?.graduationYear?.message}
          >
            <PassingYear index={i} id="edu-xii-year" />
          </PwField>
        </div>
        <ScoreFields index={i} options={SCHOOL_SCORE_TYPE_OPTIONS} />
      </PwRow>
    </>
  );
}

/**
 * College, and every other-education entry. The College slot refuses a school
 * year or a diploma, which have tabs of their own.
 */
function HigherEducationFields({
  index,
  degrees,
}: {
  index: number;
  degrees: readonly string[];
}) {
  const {
    control,
    register,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useFormContext<FormValues>();
  const recheck = useTimelineRecheck();
  const isCurrent = watch(`rows.${index}.isCurrent`);
  const startYear = watch(`rows.${index}.startYear`);
  const degree = watch(`rows.${index}.degree`);
  const rowErrors = errors.rows?.[index];

  return (
    <>
      <PwRow cols={1}>
        <PwField
          label="College / Institute"
          required
          error={rowErrors?.institutionName?.message}
        >
          <Controller
            control={control}
            name={`rows.${index}.institutionName`}
            rules={{ validate: textIssue("Enter a real college or institute name") }}
            render={({ field: f, fieldState }) => (
              <CollegeCombobox
                id={`edu-college-${index}`}
                value={f.value}
                aria-invalid={Boolean(fieldState.error)}
                onChange={(name, collegeId) => {
                  f.onChange(name);
                  setValue(`rows.${index}.collegeId`, collegeId ?? "");
                }}
                placeholder="Enter your college or university name"
              />
            )}
          />
        </PwField>
      </PwRow>

      <PwRow cols={2}>
        <PwField
          label="Degree"
          required
          htmlFor={`edu-degree-${index}`}
          error={rowErrors?.degree?.message}
        >
          <PwSuggest
            id={`edu-degree-${index}`}
            placeholder="e.g. B.E / B.Tech"
            suggestions={degrees}
            search={searchDegrees}
            aria-invalid={Boolean(rowErrors?.degree)}
            {...register(`rows.${index}.degree`, {
              onChange: () => recheck(),
              validate: (value, values) => {
                if (value.trim() !== "" && !READS_AS_TEXT.test(value)) {
                  return "Enter a real degree name";
                }
                if (index === COLLEGE) {
                  const level = educationLevelOf(value);
                  if (level === "TENTH") return "Class X has its own tab";
                  if (level === "TWELFTH") return "Class XII has its own tab";
                  if (level === "DIPLOMA") return "Add a diploma in the XII / Diploma tab";
                }
                return timelineIssue(values.rows, index, "degree");
              },
            })}
          />
        </PwField>
        <PwField
          label="Department / field"
          required
          htmlFor={`edu-field-${index}`}
          error={rowErrors?.fieldOfStudy?.message}
        >
          {/* Offers the branches that belong to the degree beside it —
              engineering for a B.Tech, commerce for a B.Com — and every
              branch when the degree is blank or unrecognised. */}
          <PwSuggest
            id={`edu-field-${index}`}
            placeholder="Enter your field of study"
            suggestions={departmentsForDegree(degree ?? "")}
            maxSuggestions={80}
            aria-invalid={Boolean(rowErrors?.fieldOfStudy)}
            {...register(`rows.${index}.fieldOfStudy`, {
              validate: textIssue("Enter a real field of study"),
            })}
          />
        </PwField>
      </PwRow>

      <PwRow cols={1}>
        <Controller
          control={control}
          name={`rows.${index}.isCurrent`}
          render={({ field: f }) => (
            <PwCheckbox
              id={`edu-current-${index}`}
              checked={f.value}
              onChange={(checked) => {
                f.onChange(checked);
                if (checked) {
                  setValue(`rows.${index}.endMonth`, null);
                  setValue(`rows.${index}.graduationYear`, null);
                }
                recheck();
              }}
            >
              Currently studying here
            </PwCheckbox>
          )}
        />
      </PwRow>

      <PwRow cols={2}>
        <PwField
          label="Starting from"
          required
          error={rowErrors?.startYear?.message}
        >
          <Controller
            control={control}
            name={`rows.${index}.startMonth`}
            render={({ field: month }) => (
              <Controller
                control={control}
                name={`rows.${index}.startYear`}
                rules={{
                  validate: (value, values) => {
                    const row = values.rows[index];
                    if (
                      row &&
                      value === CURRENT_YEAR &&
                      row.startMonth !== null &&
                      row.startMonth > CURRENT_MONTH
                    ) {
                      return "Start date cannot be in the future";
                    }
                    return timelineIssue(values.rows, index, "startYear");
                  },
                }}
                render={({ field: year, fieldState }) => (
                  <PwMonthYear
                    month={month.value}
                    year={year.value}
                    // Moving the start can invalidate — or fix — the
                    // end, so the rule that lives there is re-run.
                    onMonthChange={(v) => {
                      month.onChange(v);
                      void trigger(`rows.${index}.startYear`);
                      void trigger(`rows.${index}.graduationYear`);
                    }}
                    onYearChange={(v) => {
                      year.onChange(v);
                      void trigger(`rows.${index}.graduationYear`);
                      recheck();
                    }}
                    fromYear={EDUCATION_MIN_YEAR}
                    toYear={CURRENT_YEAR}
                    // This year's later months have not started yet.
                    maxMonth={year.value === CURRENT_YEAR ? CURRENT_MONTH : undefined}
                    invalid={Boolean(fieldState.error)}
                  />
                )}
              />
            )}
          />
        </PwField>
        <div
          style={{
            visibility: isCurrent ? "hidden" : undefined,
            pointerEvents: isCurrent ? "none" : undefined,
          }}
        >
          <PwField
            label="Ending in"
            required
            error={errors.rows?.[index]?.graduationYear?.message}
          >
            <Controller
              control={control}
              name={`rows.${index}.endMonth`}
              render={({ field: month }) => (
                <Controller
                  control={control}
                  name={`rows.${index}.graduationYear`}
                  // Same rules the schema applies, run here so the answer
                  // arrives without a round trip — and on the same path, so
                  // a server issue lands here too.
                  rules={{
                    validate: (value, values) => {
                      const row = values.rows[index];
                      if (!row || row.isCurrent) return true;
                      if (
                        row.startYear !== null &&
                        value !== null &&
                        value > row.startYear + EDUCATION_MAX_SPAN_YEARS
                      ) {
                        return `End year cannot be more than ${EDUCATION_MAX_SPAN_YEARS} years after the start year`;
                      }
                      return (
                        endBeforeStart(
                          { month: row.startMonth, year: row.startYear },
                          { month: row.endMonth, year: value },
                          "End date cannot be before the start date",
                        ) ?? timelineIssue(values.rows, index, "graduationYear")
                      );
                    },
                  }}
                  render={({ field: year }) => (
                    <PwMonthYear
                      month={month.value}
                      year={year.value}
                      onMonthChange={(v) => {
                        month.onChange(v);
                        void trigger(`rows.${index}.graduationYear`);
                      }}
                      onYearChange={(v) => {
                        year.onChange(v);
                        recheck();
                      }}
                      disabled={isCurrent}
                      fromYear={startYear ?? EDUCATION_MIN_YEAR}
                      toYear={(startYear ?? CURRENT_YEAR) + EDUCATION_MAX_SPAN_YEARS}
                      invalid={Boolean(errors.rows?.[index]?.graduationYear)}
                    />
                  )}
                />
              )}
            />
          </PwField>
        </div>
      </PwRow>

      <PwRow cols={2}>
        <ScoreFields index={index} options={SCORE_TYPE_OPTIONS} />
      </PwRow>

      <PwRow cols={1}>
        <PwField label="Description" htmlFor={`edu-desc-${index}`} area>
          <PwTextarea
            id={`edu-desc-${index}`}
            maxLength={4000}
            placeholder="Describe your coursework, thesis, societies, or anything else worth knowing."
            {...register(`rows.${index}.description`)}
          />
        </PwField>
      </PwRow>
    </>
  );
}
