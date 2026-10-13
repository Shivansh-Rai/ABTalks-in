/**
 * Turning a free-typed employer name into something a panel can draw.
 *
 * `CandidateExperience.companyName` is whatever the candidate or their résumé
 * said, and the spread is wide: a census of the live table found 1,127
 * distinct strings across 1,461 rows. EXL alone arrives as "EXL", "Exl",
 * "EXL Service", "EXL Services" and "Exl service" — 111 rows that used to draw
 * three different monograms in three different places. Grouping those is worth
 * more than any logo, because the long tail is most of the data: the top 200
 * normalised names still only reach ~42% of rows.
 *
 * So there are three outcomes, in order:
 *
 *   1. `logo`    — a bundled brand mark (see company-logos.generated.ts).
 *   2. `monogram`— initials on a colour derived from the canonical name, so
 *                  one company looks the same everywhere it appears.
 *   3. `neutral` — the name carries no company at all ("N/A", "-",
 *                  "Freelance", "Confidential"). 4.2% of rows. Drawing a
 *                  confident "FR" tile for "Freelance" invents an employer.
 */

import { BRAND_LOGO_FILES } from "@/lib/company-logos.generated";
import { initialsFor, toneFor, TONE_COUNT, type Tone } from "@/lib/identity-tone";

export type CompanyIdentity =
  | { kind: "logo"; label: string; slug: string; src: string }
  | { kind: "monogram"; label: string; monogram: string; tone: CompanyTone }
  | { kind: "neutral"; label: string };

/** Index into the tile palette in hire-scout.css (`--tone-*`). */
export type CompanyTone = Tone;

export const COMPANY_TONE_COUNT = TONE_COUNT;

/**
 * Strings that name no employer. Compared after `normalise`, so punctuation
 * and case are already gone. Everything here was observed in the live table.
 */
const NOT_A_COMPANY = new Set([
  "na", "n a", "nil", "none", "no", "no company", "not applicable",
  "confidential", "private", "independent", "self", "self employed",
  "freelance", "freelancing", "unemployed", "student", "other", "others",
  "test", "xyz", "abc", "college", "university", "school",
]);

/** Noise that never distinguishes two employers. */
const LEGAL_SUFFIX =
  /\b(pvt|private|ltd|limited|inc|incorporated|llc|llp|plc|corp|corporation|gmbh|srl|bv|nv|ag|sa|co|company|group|holdings)\b/g;

/**
 * Canonical name -> the alias strings that should collapse into it.
 *
 * Only the companies that actually recur are listed. Everything else falls
 * through to `normalise`, which already merges casing, punctuation and legal
 * suffixes — "Infosys Ltd." and "Infosys" need no entry here.
 *
 * `logo` is a slug in `BRAND_LOGO_SLUGS`; omit it when no free mark exists.
 * Most of the big names here have none: Simple Icons dropped the enterprise
 * brands, so Cognizant, Capgemini, EXL, Genpact, Nagarro, Amazon, IBM, Oracle,
 * Deloitte, EY and JPMorgan are all monogram-only until a licensed file is
 * dropped into public/company-logos.
 */
const CANONICAL: { label: string; logo?: string; aliases: string[] }[] = [
  // --- Indian IT services and BPM, by volume in the live table -------------
  { label: "EXL", logo: "exl", aliases: ["exl", "exl service", "exl services", "exlservice", "exl analytics"] },
  { label: "Accenture", logo: "accenture", aliases: ["accenture", "accenture solutions", "accenture technology"] },
  { label: "Cognizant", logo: "cognizant", aliases: ["cognizant", "cognizant technology solutions", "cognizant technology services", "cts"] },
  { label: "Tata Consultancy Services", logo: "tcs", aliases: ["tcs", "tata consultancy services", "tata consultancy services tcs", "tata consultancy"] },
  { label: "Infosys", logo: "infosys", aliases: ["infosys", "infosys bpm", "infosys technologies"] },
  { label: "Nagarro", logo: "nagarro", aliases: ["nagarro", "nagarro software"] },
  { label: "Capgemini", logo: "capgemini", aliases: ["capgemini", "capgemini technology services", "capgemini india", "capgemini engineering"] },
  { label: "Genpact", logo: "genpact", aliases: ["genpact"] },
  { label: "Tech Mahindra", logo: "techmahindra", aliases: ["tech mahindra", "techmahindra"] },
  { label: "HCLTech", logo: "hcl", aliases: ["hcl", "hcltech", "hcl technologies"] },
  { label: "Wipro", logo: "wipro", aliases: ["wipro", "wipro technologies"] },
  { label: "LTIMindtree", aliases: ["ltimindtree", "lti mindtree", "ltimindtree ltm", "ltm", "larsen toubro infotech", "mindtree"] },
  { label: "Coforge", logo: "coforge", aliases: ["coforge", "niit technologies"] },
  { label: "Sopra Steria", logo: "soprasteria", aliases: ["sopra steria", "sopra", "steria"] },
  { label: "Virtusa", logo: "virtusa", aliases: ["virtusa", "virtusa consulting services"] },
  { label: "Mphasis", logo: "mphasis", aliases: ["mphasis"] },
  { label: "Birlasoft", logo: "birlasoft", aliases: ["birlasoft"] },
  { label: "Persistent Systems", logo: "persistent", aliases: ["persistent", "persistent systems"] },
  { label: "Zensar", aliases: ["zensar", "zensar technologies"] },
  { label: "Hexaware", logo: "hexaware", aliases: ["hexaware", "hexaware technologies"] },
  { label: "Amdocs", logo: "amdocs", aliases: ["amdocs"] },
  { label: "Atos", logo: "atos", aliases: ["atos", "atos syntel"] },
  { label: "DXC Technology", logo: "dxc", aliases: ["dxc", "dxc technology"] },
  { label: "Fujitsu", logo: "fujitsu", aliases: ["fujitsu", "fujitsu consulting india", "fujitsu india"] },
  { label: "Axtria", aliases: ["axtria", "axtria india"] },
  { label: "Techolution", logo: "techolution", aliases: ["techolution"] },
  { label: "Celebal Technologies", logo: "celebal", aliases: ["celebal", "celebal technologies"] },
  { label: "iEnergizer", aliases: ["ienergizer"] },
  { label: "IKS Health", logo: "ikshealth", aliases: ["iks health"] },

  // --- Global technology ---------------------------------------------------
  { label: "Amazon", logo: "amazon", aliases: ["amazon", "amazon web services", "aws", "amazon development centre"] },
  { label: "IBM", logo: "ibm", aliases: ["ibm", "ibm india"] },
  { label: "Oracle", logo: "oracle", aliases: ["oracle", "oracle india"] },
  { label: "Microsoft", logo: "microsoft", aliases: ["microsoft", "microsoft india"] },
  { label: "Google", logo: "google", aliases: ["google", "alphabet"] },
  { label: "Meta", logo: "meta", aliases: ["meta", "facebook"] },
  { label: "Apple", logo: "apple", aliases: ["apple"] },
  { label: "Netflix", logo: "netflix", aliases: ["netflix"] },
  { label: "NVIDIA", logo: "nvidia", aliases: ["nvidia"] },
  { label: "Intel", logo: "intel", aliases: ["intel"] },
  { label: "Cisco", logo: "cisco", aliases: ["cisco", "cisco systems"] },
  { label: "Dell", logo: "dell", aliases: ["dell", "dell technologies", "dell emc"] },
  { label: "SAP", logo: "sap", aliases: ["sap", "sap labs"] },
  { label: "Red Hat", logo: "redhat", aliases: ["red hat", "redhat"] },
  { label: "VMware", logo: "vmware", aliases: ["vmware"] },
  { label: "Qualcomm", logo: "qualcomm", aliases: ["qualcomm"] },
  { label: "Samsung", logo: "samsung", aliases: ["samsung", "samsung india", "samsung r d"] },
  { label: "Ericsson", logo: "ericsson", aliases: ["ericsson"] },
  { label: "Siemens", logo: "siemens", aliases: ["siemens"] },
  { label: "Adobe", logo: "adobe", aliases: ["adobe", "adobe systems"] },
  { label: "Salesforce", logo: "salesforce", aliases: ["salesforce"] },
  { label: "Atlassian", logo: "atlassian", aliases: ["atlassian"] },
  { label: "Snowflake", logo: "snowflake", aliases: ["snowflake"] },
  { label: "Databricks", logo: "databricks", aliases: ["databricks"] },
  { label: "MongoDB", logo: "mongodb", aliases: ["mongodb"] },
  { label: "Stripe", logo: "stripe", aliases: ["stripe"] },
  { label: "Shopify", logo: "shopify", aliases: ["shopify"] },
  { label: "PayPal", logo: "paypal", aliases: ["paypal"] },
  { label: "Uber", logo: "uber", aliases: ["uber"] },
  { label: "Airbnb", logo: "airbnb", aliases: ["airbnb"] },
  { label: "Tesla", logo: "tesla", aliases: ["tesla"] },
  { label: "GitHub", logo: "github", aliases: ["github"] },
  { label: "GitLab", logo: "gitlab", aliases: ["gitlab"] },
  { label: "Spotify", logo: "spotify", aliases: ["spotify"] },
  { label: "FedEx", logo: "fedex", aliases: ["fedex"] },
  { label: "Nike", logo: "nike", aliases: ["nike"] },
  { label: "ADP", logo: "adp", aliases: ["adp"] },
  { label: "Western Union", logo: "westernunion", aliases: ["western union"] },

  // --- Consulting, finance, healthcare -------------------------------------
  { label: "Deloitte", logo: "deloitte", aliases: ["deloitte", "deloitte usi", "deloitte consulting"] },
  { label: "EY", logo: "ey", aliases: ["ey", "ernst young", "ernst and young", "ey gds"] },
  { label: "KPMG", logo: "kpmg", aliases: ["kpmg"] },
  { label: "PwC", logo: "pwc", aliases: ["pwc", "pricewaterhousecoopers"] },
  { label: "JPMorgan Chase", logo: "jpmorgan", aliases: ["jp morgan", "jp morgan chase", "jpmorgan", "jpmorgan chase", "jp morgan chase and", "j p morgan"] },
  { label: "Goldman Sachs", logo: "goldmansachs", aliases: ["goldman sachs"] },
  { label: "Morgan Stanley", logo: "morganstanley", aliases: ["morgan stanley"] },
  { label: "Barclays", logo: "barclays", aliases: ["barclays"] },
  { label: "NatWest", aliases: ["natwest", "natwest group"] },
  { label: "Société Générale", aliases: ["societe generale"] },
  { label: "Wells Fargo", logo: "wellsfargo", aliases: ["wells fargo"] },
  { label: "HDFC Bank", logo: "hdfcbank", aliases: ["hdfc bank", "hdfc"] },
  { label: "ICICI Bank", logo: "icicibank", aliases: ["icici bank", "icici"] },
  { label: "Axis Bank", logo: "axisbank", aliases: ["axis bank"] },
  { label: "Verizon", aliases: ["verizon"] },
  { label: "CVS Health", logo: "cvshealth", aliases: ["cvs health"] },
  { label: "Shriram Finance", logo: "shriramfinance", aliases: ["shriram finance"] },
  { label: "Citi", logo: "citi", aliases: ["citi", "citi bank", "citibank", "citigroup"] },
  { label: "Honeywell", logo: "honeywell", aliases: ["honeywell"] },
  { label: "Cvent", logo: "cvent", aliases: ["cvent"] },
  { label: "Publicis Sapient", logo: "sapient", aliases: ["sapient", "publicis sapient"] },
  { label: "Keywords Studios", logo: "keywordsstudios", aliases: ["keywords studios"] },
  { label: "Zebronics", logo: "zebronics", aliases: ["zebronics"] },
  { label: "Flipkart", logo: "flipkart", aliases: ["flipkart"] },

  // --- India consumer ------------------------------------------------------
  { label: "Paytm", logo: "paytm", aliases: ["paytm", "one97 communications"] },
  { label: "PhonePe", logo: "phonepe", aliases: ["phonepe"] },
  { label: "Razorpay", logo: "razorpay", aliases: ["razorpay"] },
  { label: "Zoho", logo: "zoho", aliases: ["zoho", "zoho corporation"] },
  { label: "Zomato", logo: "zomato", aliases: ["zomato"] },
  { label: "Swiggy", logo: "swiggy", aliases: ["swiggy"] },
  { label: "Zerodha", logo: "zerodha", aliases: ["zerodha"] },
  { label: "Jio", logo: "jio", aliases: ["jio", "reliance jio"] },
  { label: "Airtel", logo: "airtel", aliases: ["airtel", "bharti airtel"] },
  { label: "Unacademy", logo: "unacademy", aliases: ["unacademy"] },
  { label: "Tata Group", logo: "tata", aliases: ["tata", "tata digital", "tata group"] },
  { label: "Mahindra", logo: "mahindra", aliases: ["mahindra", "mahindra group"] },
];

/** alias -> index into CANONICAL. Built once. */
const ALIAS_INDEX = new Map<string, number>();
for (const [i, entry] of CANONICAL.entries()) {
  for (const alias of entry.aliases) ALIAS_INDEX.set(alias, i);
}

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `normalise` plus legal-suffix removal, for alias lookup. */
function lookupKey(normalised: string): string {
  const stripped = normalised.replace(LEGAL_SUFFIX, " ").replace(/\s+/g, " ").trim();
  return stripped.length >= 2 ? stripped : normalised;
}


/**
 * Resolve an employer name to what the tile should draw.
 *
 * `logoUrl` wins when present — it is the employer's own uploaded mark from
 * `Organization.logoUrl`, reached through `CandidateExperience.organizationId`,
 * and is more authoritative than anything matched on a string.
 */
export function resolveCompany(
  rawName: string | null | undefined,
  logoUrl?: string | null,
): CompanyIdentity {
  const trimmed = (rawName ?? "").trim();
  if (trimmed.length === 0) return { kind: "neutral", label: "" };

  const normalised = normalise(trimmed);
  if (normalised.length === 0 || NOT_A_COMPANY.has(normalised)) {
    return { kind: "neutral", label: trimmed };
  }

  const canonical = ALIAS_INDEX.get(lookupKey(normalised));
  const entry = canonical === undefined ? null : CANONICAL[canonical]!;
  const label = entry?.label ?? trimmed;

  if (logoUrl) {
    return { kind: "logo", label, slug: "organization", src: logoUrl };
  }
  const file = entry?.logo ? BRAND_LOGO_FILES[entry.logo] : undefined;
  if (entry?.logo && file) {
    return {
      kind: "logo",
      label,
      slug: entry.logo,
      // .svg for the Simple Icons marks, .png for the vendored favicons —
      // the generator decides which, so an alias never has to know.
      src: `/company-logos/${file}`,
    };
  }

  // Keyed on the canonical label, not the raw string, so every EXL variant
  // lands on one colour.
  return {
    kind: "monogram",
    label,
    monogram: initialsFor(label),
    tone: toneFor(entry?.label ?? lookupKey(normalised)),
  };
}
