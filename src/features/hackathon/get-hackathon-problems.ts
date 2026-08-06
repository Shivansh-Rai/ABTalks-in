import "server-only";
import { prisma } from "@/lib/db";

export type HackathonBrief = {
  id: string;
  number: number;
  title: string;
  tagline: string;
  body: string[];
};

function parseStatement(statement: string): Pick<HackathonBrief, "tagline" | "body"> {
  const trimmed = statement.trim();
  if (!trimmed) {
    return { tagline: "", body: [] };
  }

  const [firstLine = "", ...rest] = trimmed.split("\n");
  const remainder = rest.join("\n").trim();

  return {
    tagline: firstLine.trim(),
    body: remainder
      ? remainder
          .split(/\n\s*\n/)
          .map((part) => part.trim())
          .filter(Boolean)
      : [],
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
      body: parsed.body,
    };
  });
}
