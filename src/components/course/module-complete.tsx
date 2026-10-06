"use client";

import { useCourseProgress } from "./use-course-progress";

export function ModuleComplete({ course, module }: { course: string; module: string }) {
  const { progress, setDone } = useCourseProgress(course);
  const done = progress.done.includes(module);
  const quiz = progress.quiz[module];
  return (
    <div className="crs-frame" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontSize: "0.92rem" }}>
        {done ? <b>Module completed.</b> : <b>Finished reading?</b>}
        {quiz ? (
          <span style={{ color: "var(--c-mu)" }}>
            {" "}
            Quiz: {quiz.score}/{quiz.total}
          </span>
        ) : null}
      </div>
      <button type="button" className={done ? "crs-btn crs-btn-ghost" : "crs-btn"} aria-pressed={done} onClick={() => setDone(module, !done)}>
        {done ? "Mark as not complete" : "Mark module complete"}
      </button>
    </div>
  );
}
