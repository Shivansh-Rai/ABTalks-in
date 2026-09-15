/**
 * Career guidance rules — evaluates progression edges (plan 146).
 * No job/opportunity recommendations. No invented statistics.
 */

import { evaluateProgressionEdges } from "./progression";
import type { CandidateFacts, GuidanceItem } from "./types";

export function evaluateRules(facts: CandidateFacts): GuidanceItem[] {
  return evaluateProgressionEdges(facts);
}
