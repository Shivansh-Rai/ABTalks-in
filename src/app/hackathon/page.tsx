import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Hackathon | ABTalks",
};

export default function HackathonPage() {
  redirect("/hackathon/dashboard");
}
