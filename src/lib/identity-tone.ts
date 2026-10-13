/**
 * One deterministic colour per identity, for the places that draw initials
 * instead of a picture: company tiles on the candidate panel, and the avatar
 * fallback for anyone without an uploaded image.
 *
 * Shared so the two cannot drift. A tone has to be stable across renders,
 * processes and machines — the same person must not be indigo in the header
 * and amber in a menu — so it is a pure hash of a key the caller picks, never
 * a counter, a random seed or an array position.
 */

/** How many tones exist. Palettes keyed `--tone-0` … `--tone-9` must match. */
export const TONE_COUNT = 10;

export type Tone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * FNV-1a, 32-bit. Chosen for being tiny and stable rather than for collision
 * resistance: a collision here means two companies share a colour, which is
 * already true by construction with ten tones.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The tone for a key. Pass the most stable identifier available — a user id
 * rather than a display name, a canonical company label rather than whatever
 * the candidate typed — so the colour survives a rename.
 */
export function toneFor(key: string): Tone {
  return (hash(key) % TONE_COUNT) as Tone;
}

/** Up to two letters: initials of the first two words, else the first two. */
export function initialsFor(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}
