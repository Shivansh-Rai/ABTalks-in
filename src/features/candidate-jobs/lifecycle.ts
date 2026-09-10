/**
 * Pure helpers for T-246 candidate applications — no IO, no Prisma import,
 * safe to consume from the tests without pulling the Prisma client into the
 * test process.
 */

export type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      message: string;
      code?: "CONFLICT" | "NOT_FOUND" | "INVALID" | "UNAUTHORIZED";
      status?: number;
    };

export const DUPLICATE_APPLICATION_MESSAGE =
  "You have already submitted an application for this position";

/**
 * Duck-type the Prisma unique-constraint violation. Kept as a shape check so
 * this module can stay Prisma-free — the tests use the same helper against an
 * in-memory store that throws `{ code: "P2002" }`.
 */
export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}
