import type { Metadata } from "next";
import { GuestMatchesPage } from "@/components/hire/guest-matches-page";

export const metadata: Metadata = {
  title: "Matched candidates | Klymb AI Hire",
};

export default function HireGuestMatchesRoute() {
  return <GuestMatchesPage />;
}
