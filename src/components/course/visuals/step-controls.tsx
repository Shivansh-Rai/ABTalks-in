"use client";

type Props = {
  index: number;
  count: number;
  playing: boolean;
  canNext: boolean;
  reduced: boolean;
  onBack: () => void;
  onNext: () => void;
  onToggle: () => void;
  onReset: () => void;
};

/** Back / Play / Next / Reset row shared by stepped visuals. */
export function StepControls({ index, count, playing, canNext, reduced, onBack, onNext, onToggle, onReset }: Props) {
  return (
    <div className="crs-controls">
      <button type="button" className="crs-btn crs-btn-ghost" onClick={onBack} disabled={index < 0}>
        ← Back
      </button>
      <button type="button" className="crs-btn" onClick={onNext} disabled={!canNext}>
        {index < 0 ? "Start" : "Next →"}
      </button>
      {!reduced ? (
        <button type="button" className="crs-btn crs-btn-ghost" onClick={onToggle} aria-pressed={playing}>
          {playing ? "Pause" : "Autoplay"}
        </button>
      ) : null}
      <button type="button" className="crs-btn crs-btn-ghost" onClick={onReset}>
        Reset
      </button>
      <span style={{ fontSize: "0.8rem", color: "var(--c-mu)" }}>
        {index < 0 ? "Not started" : `Step ${index + 1} of ${count}`}
      </span>
    </div>
  );
}
