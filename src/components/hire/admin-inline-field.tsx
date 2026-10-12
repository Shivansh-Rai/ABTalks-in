"use client";

import { useState, type ReactNode } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One field of a candidate's record, edited where it is shown.
 *
 * Platform Admin only: View Details renders these in place of plain text when
 * the viewer is an admin, and nothing else imports this file. A pencil opens
 * that one field; the rest of the section stays as it was. Hiding the pencil
 * from recruiters is presentation. The actions behind `onSave` check
 * `requireAdmin()` themselves.
 *
 * Enter saves, Escape puts the old value back. A single text box also saves
 * when focus leaves it. An editor with several controls (dates, a score with
 * its scale) saves from its own tick instead, because focus moving from one of
 * its controls to the next is not the admin finishing.
 */

type EditorTools<T> = {
  busy: boolean;
  /** Saves `value`, or the current draft when called with nothing. */
  commit: (value?: T) => void;
};

export function AdminInlineEdit<T>({
  label,
  initial,
  display,
  render,
  onSave,
  compound = false,
  trigger,
  className,
}: {
  /** Names the field for assistive tech: "Edit job title". */
  label: string;
  initial: T;
  /** What the field shows when it is not being edited. */
  display?: ReactNode;
  render: (
    draft: T,
    setDraft: (next: T) => void,
    tools: EditorTools<T>,
  ) => ReactNode;
  /** Resolves true once stored. False keeps the editor open on the draft. */
  onSave: (next: T) => Promise<boolean>;
  /** Several controls: save from the tick, not when focus leaves one of them. */
  compound?: boolean;
  /** Replaces the value-and-pencil with a control of the caller's own. */
  trigger?: (open: () => void) => ReactNode;
  className?: string;
}) {
  const [draft, setDraft] = useState<T | null>(null);
  // Set before the first await, inside the key or change event that started
  // the save, so React has re-rendered with it by the time a blur can follow.
  const [busy, setBusy] = useState(false);

  const open = () => setDraft(initial);

  async function commit(value?: T) {
    const next = value === undefined ? draft : value;
    if (next === null || busy) return;
    if (JSON.stringify(next) === JSON.stringify(initial)) {
      setDraft(null);
      return;
    }
    setBusy(true);
    const saved = await onSave(next);
    setBusy(false);
    if (saved) setDraft(null);
  }

  if (draft === null) {
    if (trigger) return <>{trigger(open)}</>;
    return (
      <span className={cn("hire-edit", className)}>
        <span className="hire-edit__value">{display}</span>
        <button
          type="button"
          className="hire-edit__btn"
          aria-label={`Edit ${label}`}
          title={`Edit ${label}`}
          onClick={open}
        >
          <Pencil size={13} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={cn("hire-edit hire-edit--on", className)}
      aria-busy={busy}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) setDraft(null);
          return;
        }
        // Enter is a new line in a description; Ctrl or Cmd with it saves.
        const inTextarea = event.target instanceof HTMLTextAreaElement;
        if (
          event.key === "Enter" &&
          (!inTextarea || event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          void commit();
        }
      }}
      onBlur={(event) => {
        if (compound || event.currentTarget.contains(event.relatedTarget)) return;
        void commit();
      }}
    >
      {render(draft, setDraft, {
        busy,
        commit: (value) => {
          void commit(value);
        },
      })}
      {compound ? (
        <>
          <button
            type="button"
            className="hire-edit__btn hire-edit__btn--on"
            aria-label={`Save ${label}`}
            title="Save"
            disabled={busy}
            onClick={() => {
              void commit();
            }}
          >
            <Check size={14} strokeWidth={2} absoluteStrokeWidth aria-hidden="true" />
          </button>
          <button
            type="button"
            className="hire-edit__btn hire-edit__btn--on"
            aria-label={`Cancel editing ${label}`}
            title="Cancel"
            disabled={busy}
            onClick={() => setDraft(null)}
          >
            <X size={14} strokeWidth={2} absoluteStrokeWidth aria-hidden="true" />
          </button>
        </>
      ) : null}
    </span>
  );
}

/**
 * A single text value. `options` turns it into a pick-one list, which saves as
 * soon as a choice is made; `multiline` gives it a text area.
 */
export function AdminInlineText({
  label,
  value,
  emptyLabel,
  multiline = false,
  options,
  onSave,
  className,
}: {
  label: string;
  value: string;
  /** Shown, muted, where a field has nothing in it, so it can still be opened. */
  emptyLabel: string;
  multiline?: boolean;
  options?: readonly string[];
  onSave: (next: string) => Promise<boolean>;
  className?: string;
}) {
  return (
    <AdminInlineEdit<string>
      label={label}
      initial={value}
      className={cn(multiline && "hire-edit--block", className)}
      display={
        value ? value : <span className="hire-edit__empty">{emptyLabel}</span>
      }
      onSave={onSave}
      render={(draft, setDraft, { busy, commit }) =>
        options ? (
          <select
            className="hire-edit__input"
            aria-label={label}
            autoFocus
            disabled={busy}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              commit(event.target.value);
            }}
          >
            <option value="">None</option>
            {/* A stored value outside the list stays selectable. */}
            {draft && !options.includes(draft) ? (
              <option value={draft}>{draft}</option>
            ) : null}
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : multiline ? (
          <textarea
            className="hire-edit__input hire-edit__input--area"
            aria-label={label}
            autoFocus
            rows={5}
            disabled={busy}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : (
          <input
            className="hire-edit__input"
            aria-label={label}
            autoFocus
            disabled={busy}
            value={draft}
            // Sized to what is typed, so the field sits where the text was.
            size={Math.max(8, Math.min(draft.length + 2, 40))}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
          />
        )
      }
    />
  );
}

/** Removing a whole entry asks once, in place, before it does anything. */
export function AdminRemoveButton({
  label,
  onRemove,
}: {
  /** "this experience entry", for the button's accessible name. */
  label: string;
  /** Resolves true once removed. False puts the bin back. */
  onRemove: () => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="hire-edit__btn hire-edit__btn--on"
        aria-label={`Remove ${label}`}
        title={`Remove ${label}`}
        onClick={() => setConfirming(true)}
      >
        <Trash2 size={13} strokeWidth={1.75} absoluteStrokeWidth aria-hidden="true" />
      </button>
    );
  }

  return (
    <span className="hire-edit__confirm" role="group" aria-label={`Remove ${label}?`}>
      <span>Remove?</span>
      <button
        type="button"
        className="hire-edit__choice hire-edit__choice--yes"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const removed = await onRemove();
          if (!removed) {
            setBusy(false);
            setConfirming(false);
          }
        }}
      >
        Yes
      </button>
      <button
        type="button"
        className="hire-edit__choice"
        disabled={busy}
        onClick={() => setConfirming(false)}
      >
        No
      </button>
    </span>
  );
}
