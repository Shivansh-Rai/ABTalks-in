import { redirect } from "next/navigation";

/** Entry assessment quiz removed — send anyone here back to apply. */
export default function ProgramAssessmentPage() {
  redirect("/program/apply");
}
