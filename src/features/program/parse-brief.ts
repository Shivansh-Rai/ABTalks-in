export type ParsedBrief = {
  missionTitle: string | null;
  missionBodyMd: string;
  repoLayoutMd: string | null;
  buildSteps: string[];
  submitIntroMd: string | null;
  submitQuestions: string[];
};

function extractSection(
  md: string,
  headingPattern: RegExp,
): string | null {
  const match = headingPattern.exec(md);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  const rest = md.slice(start);
  const nextHeading = rest.search(/^#{2,3}\s+/m);
  const body = (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();
  return body.length > 0 ? body : null;
}

/** Split a markdown block into top-level numbered list items (1. 2. 3. …). */
function splitNumberedItems(block: string): string[] {
  const parts = block.split(/^\d+\.\s+/m);
  const items: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) items.push(trimmed);
  }
  return items;
}

/**
 * Parse program day `briefMd` into Figma day-shell sections.
 * Days without structured headings fall back to full brief as mission body.
 */
export function parseBriefMd(briefMd: string): ParsedBrief {
  const missionHeading = /^##\s+Mission:\s*(.+)$/m.exec(briefMd);

  let missionTitle: string | null = null;
  let missionBodyMd: string;

  if (missionHeading) {
    missionTitle = missionHeading[1].trim();
    const afterHeading =
      briefMd.slice(missionHeading.index! + missionHeading[0].length);
    const nextH3 = afterHeading.search(/^###\s+/m);
    missionBodyMd = (
      nextH3 === -1 ? afterHeading : afterHeading.slice(0, nextH3)
    ).trim();
  } else {
    missionBodyMd = briefMd.trim();
  }

  const repoLayoutMd = extractSection(
    briefMd,
    /^###\s+Your repo layout[^\n]*$/im,
  );

  const buildStepsBlock = extractSection(
    briefMd,
    /^###\s+Build steps\s*$/im,
  );
  const buildSteps = buildStepsBlock ? splitNumberedItems(buildStepsBlock) : [];

  const submitBlock = extractSection(
    briefMd,
    /^###\s+Submit your answers\s*$/im,
  );

  let submitIntroMd: string | null = null;
  let submitQuestions: string[] = [];

  if (submitBlock) {
    const firstNumbered = submitBlock.search(/^\d+\.\s+/m);
    if (firstNumbered === -1) {
      submitIntroMd = submitBlock;
    } else {
      const intro = submitBlock.slice(0, firstNumbered).trim();
      submitIntroMd = intro.length > 0 ? intro : null;
      submitQuestions = splitNumberedItems(submitBlock.slice(firstNumbered));
    }
  }

  return {
    missionTitle,
    missionBodyMd,
    repoLayoutMd,
    buildSteps,
    submitIntroMd,
    submitQuestions,
  };
}
