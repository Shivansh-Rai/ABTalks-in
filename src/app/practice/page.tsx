import { redirect } from "next/navigation";
import {
  PRACTICE_BASE,
  PRACTICE_PROGRAM_SLUGS,
} from "@/features/coding-practice/constants";

/** One challenge for now, so /practice goes straight to it. */
export default function PracticeIndexPage() {
  redirect(`${PRACTICE_BASE}/${PRACTICE_PROGRAM_SLUGS[0]}`);
}
