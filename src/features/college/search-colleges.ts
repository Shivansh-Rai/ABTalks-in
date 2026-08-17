import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type CollegeOption = {
  id: string;
  name: string;
  state: string | null;
  district: string | null;
};

function tokenize(query: string): string[] {
  return query
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 0)
    .slice(0, 6);
}

export async function searchColleges(query: string): Promise<CollegeOption[]> {
  const tokens = tokenize(query);
  const first = tokens[0];
  if (!first || first.length < 2) {
    return [];
  }

  const tokenClauses = tokens.map(
    (token) => Prisma.sql`"searchText" LIKE ${"% " + token + "%"}`,
  );

  try {
    const rows = await prisma.$queryRaw<CollegeOption[]>`
      SELECT id, name, state, district
      FROM "College"
      WHERE "isActive" = true
        AND ${Prisma.join(tokenClauses, " AND ")}
      ORDER BY
        "tier" ASC,
        CASE WHEN "searchText" LIKE ${" " + first + "%"} THEN 0 ELSE 1 END ASC,
        length("name") ASC,
        "name" ASC
      LIMIT 20
    `;
    return rows;
  } catch (error) {
    logger.error("[college] search failed", { error: String(error) });
    return [];
  }
}
