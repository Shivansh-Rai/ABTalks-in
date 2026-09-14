import { redirect } from "next/navigation";

export default function MyApplicationsPage() {
  redirect("/jobs?tab=applications");
}
