import {
  LibraryRow,
  type LibraryItem,
} from "@/components/dashboard-hub/stages/library";
import {
  PRACTICE_BASE,
  PRACTICE_PROGRAM_SLUGS,
  PRACTICE_QUESTIONS_PER_DAY,
} from "@/features/coding-practice/constants";
import { getPracticeChallenge } from "@/features/coding-practice/content";

/** Dashboard card titles. Falls back to the challenge's own title. */
const CARD_TITLE: Partial<Record<string, string>> = {
  "arrays-strings": "Array & Strings 15 Days Challenge",
};

/**
 * Dashboard "Practice DSA" row: one tile per coding practice challenge, the
 * same tile (and hover) as the challenge library above it. Server component.
 * Reads the content module only, never the database.
 */
export function PracticeDsa() {
  const items = PRACTICE_PROGRAM_SLUGS.flatMap((slug): LibraryItem[] => {
    const challenge = getPracticeChallenge(slug);
    if (!challenge) return [];
    return [
      {
        key: slug,
        kicker: "DSA Practice",
        title: CARD_TITLE[slug] ?? challenge.title,
        blurb: ` Maintain consistency by solving ${PRACTICE_QUESTIONS_PER_DAY} problems a day. Topic: Array & Strings`,
        href: `${PRACTICE_BASE}/${slug}`,
        cta: "Start",
        art: "dsa",
        days: challenge.totalDays,
        daysLabel: "Challenge",
        modules: null,
      },
    ];
  });
  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <LibraryRow
        id="practice-dsa"
        title="Practice DSA"
        sub="Sharpen your problem solving with daily coding problems"
        items={items}
      />
    </section>
  );
}
