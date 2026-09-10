/**
 * Countries for the profile's Country picker.
 *
 * The candidate picks a NAME; storage stays `CandidateProfile.countryCode`
 * (ISO-3166-1 alpha-2, char(2)) so nothing downstream — registration, the OTP
 * dialing-code split, `/hire` — has to change or be migrated. The old field was
 * a free-text two-letter box, which is why people typed "IN", "In", "India" and
 * "91" into it.
 *
 * India first because that is who the platform serves; the rest alphabetical.
 */

export type Country = { code: string; name: string };

export const COUNTRIES: readonly Country[] = [
  { code: "IN", name: "India" },
  { code: "AF", name: "Afghanistan" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BD", name: "Bangladesh" },
  { code: "BE", name: "Belgium" },
  { code: "BT", name: "Bhutan" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CN", name: "China" },
  { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" },
  { code: "KE", name: "Kenya" },
  { code: "KW", name: "Kuwait" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "MX", name: "Mexico" },
  { code: "MA", name: "Morocco" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" },
  { code: "KR", name: "South Korea" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TW", name: "Taiwan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Turkey" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "VN", name: "Vietnam" },
];

export const COUNTRY_NAMES: readonly string[] = COUNTRIES.map((c) => c.name);

const NAME_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.name] as const));
const CODE_BY_NAME = new Map(
  COUNTRIES.map((c) => [c.name.toLowerCase(), c.code] as const),
);

/** Stored code → display name. Unknown codes come back as-is, never blank. */
export function countryNameForCode(code: string | null | undefined): string {
  if (!code) return "";
  return NAME_BY_CODE.get(code.trim().toUpperCase()) ?? code.trim().toUpperCase();
}

/**
 * Display name → stored code. Also accepts a raw two-letter code, so a profile
 * saved before this picker existed still round-trips.
 */
export function countryCodeForName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "";
  const byName = CODE_BY_NAME.get(trimmed.toLowerCase());
  if (byName) return byName;
  const upper = trimmed.toUpperCase();
  return NAME_BY_CODE.has(upper) ? upper : "";
}
