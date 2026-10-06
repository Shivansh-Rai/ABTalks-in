"use client";

import type { VisualConfig } from "@/features/courses/types";
import { FlowStepper } from "./flow-stepper";
import { ArchitectureDiagram } from "./architecture-diagram";
import { SequenceDiagram } from "./sequence-diagram";
import { Comparison } from "./comparison";
import { DecisionTree } from "./decision-tree";
import { BudgetPacker } from "./budget-packer";
import { ResilienceSim } from "./resilience-sim";
import { OrbitLoop } from "./orbit-loop";
import { ClassifyBoard } from "./classify-board";

/** Maps a visual config to its reusable renderer. */
export function Visual({ config }: { config: VisualConfig }) {
  switch (config.kind) {
    case "flow":
      return <FlowStepper config={config} />;
    case "architecture":
      return <ArchitectureDiagram config={config} />;
    case "sequence":
      return <SequenceDiagram config={config} />;
    case "compare":
      return <Comparison config={config} />;
    case "decision":
      return <DecisionTree config={config} />;
    case "budget":
      return <BudgetPacker config={config} />;
    case "resilience":
      return <ResilienceSim config={config} />;
    case "orbit":
      return <OrbitLoop config={config} />;
    case "classify":
      return <ClassifyBoard config={config} />;
  }
}
