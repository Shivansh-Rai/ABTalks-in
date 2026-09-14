import { CareerGuidanceDeck } from "@/components/dashboard-hub/career-guidance-deck";
import type { GuidanceTargeting } from "@/features/career-guidance/catalog";
import type { GuidanceItem } from "@/features/career-guidance/types";

type CareerGuidanceProps = {
  userId: string;
  istDay: string;
  istWeek: string;
  items: GuidanceItem[];
  targeting: GuidanceTargeting;
};

/**
 * Hub Career Guidance. The deck is client-only so dismissals in localStorage
 * can hide the whole section after hydration without flashing dismissed cards.
 */
export function CareerGuidance(props: CareerGuidanceProps) {
  return <CareerGuidanceDeck {...props} />;
}
