/**
 * Which declared skills answer the recruiter's own words, and in what order.
 *
 * A card shows a handful of chips out of a list that is often fifteen or
 * twenty long, so "which ones" is the whole question. Stored order is the order
 * the candidate happened to type their stack in — it carries no information for
 * the reader, and cutting it at eight means a recruiter who searched
 * "snowflake" can get a card whose chips do not mention Snowflake at all. That
 * reads as a wrong result, not a truncated one.
 *
 * Pure string work and no React, so the summary line, the chip rows and the
 * inspector can all order the same way instead of each keeping a copy. There
 * were three copies before this file and they had already drifted: two used the
 * word-boundary rule below, the third used a bare `includes` and lit up
 * "JavaScript" on a search for "java".
 */

/**
 * Same word-boundary rule as ranking — "java" must not light up "javascript".
 *
 * Substring rather than equality because the needle is a recruiter's phrase and
 * the skill is a candidate's: "power bi" has to find "Power BI (DAX)". The
 * boundary check on each side is what keeps that from becoming a prefix match.
 */
export function skillHighlighted(skill: string, needles: string[]): boolean {
  const hay = skill.toLowerCase();
  return needles.some((n) => {
    const needle = n.toLowerCase().trim();
    if (!needle) return false;
    const i = hay.indexOf(needle);
    if (i === -1) return false;
    const before = i === 0 ? "" : hay[i - 1]!;
    const after = hay[i + needle.length] ?? "";
    const bound = (c: string) => c === "" || !/[a-z0-9]/.test(c);
    return bound(before) && bound(after);
  });
}

/**
 * Matched skills first, everything else after, each group in its original
 * order.
 *
 * Stable on purpose: with no needles, or when nothing matches, the list comes
 * back exactly as stored. Callers slice this, so the hoist is what decides
 * whether a searched-for skill survives the cut.
 */
export function orderedSkills(skills: string[], needles: string[]): string[] {
  if (!needles.length) return skills;
  const hit: string[] = [];
  const rest: string[] = [];
  for (const s of skills) {
    (skillHighlighted(s, needles) ? hit : rest).push(s);
  }
  return [...hit, ...rest];
}
