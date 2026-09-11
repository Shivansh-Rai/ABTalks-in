import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * ABTalks UI Design System v2 in the recruiter PDF: Outfit headings, Inter body.
 * Read from disk next to the certificate templates (public/), the same way
 * features/certificate/template-source.ts loads its artwork. WOFF, because
 * react-pdf does not read WOFF2.
 */
const fontFile = (name: string) =>
  path.resolve(process.cwd(), "public/fonts/pdf", name);

Font.register({
  family: "Inter",
  fonts: [
    { src: fontFile("inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: fontFile("inter-latin-600-normal.woff"), fontWeight: 600 },
    { src: fontFile("inter-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

// Headings are always semibold: one weight, so every heading style renders it.
Font.register({
  family: "Outfit",
  src: fontFile("outfit-latin-600-normal.woff"),
  fontWeight: 600,
});

// No automatic hyphenation — names, skills and URLs must never break mid-word.
Font.registerHyphenationCallback((word) => [word]);

export const FONT_BODY = "Inter";
export const FONT_HEADING = "Outfit";
