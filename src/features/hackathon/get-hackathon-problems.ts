import "server-only";
import { prisma } from "@/lib/db";

export type HackathonBrief = {
  id: string;
  number: number;
  title: string;
  tagline: string;
  bodyMd: string;
};

function parseStatement(
  statement: string,
): Pick<HackathonBrief, "tagline" | "bodyMd"> {
  const trimmed = statement.trim();
  if (!trimmed) {
    return { tagline: "", bodyMd: "" };
  }

  const newline = trimmed.indexOf("\n");
  if (newline === -1) {
    return { tagline: trimmed, bodyMd: "" };
  }

  return {
    tagline: trimmed.slice(0, newline).trim(),
    bodyMd: trimmed.slice(newline + 1).trim(),
  };
}

export async function getHackathonProblems(): Promise<HackathonBrief[]> {
  const rows = await prisma.hackathonProblem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      statement: true,
    },
  });

  return rows.map((row, index) => {
    const parsed = parseStatement(row.statement);
    return {
      id: row.id,
      number: index + 1,
      title: row.title,
      tagline: parsed.tagline,
      bodyMd: parsed.bodyMd,
    };
  });
}
