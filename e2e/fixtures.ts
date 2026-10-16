/**
 * Plan 195 — applying a fixture from inside a browser test.
 *
 * WHY THIS SHELLS OUT INSTEAD OF IMPORTING `scripts/test-env/fixtures`.
 * That module reaches the canonical write boundary in `src/repositories/`, and
 * those files start with `import "server-only"`, which throws unless the
 * `react-server` export condition is set. Every `test:env:*` npm script sets
 * it; the Playwright runner does not, and making it do so would change how
 * every package in the test process resolves.
 *
 * Running the CLI also means the specs drive the exact command a person types,
 * so a fixture that works here works for them — and there is one definition of
 * each fixture rather than one for the CLI and one for the suite. It costs a
 * process start per call, which against a dev-server page load is noise.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type FixtureParams = {
  key?: string;
  day?: number;
  dollars?: number;
};

/**
 * `npm run test:env:fixture -- <name> [--key=…] [--day=…] [--dollars=…]`.
 *
 * Returns the fixture's own one-line summary, which is worth asserting on when
 * the thing the fixture did is not visible on any screen — see the hackathon
 * tests, where the event's window has closed.
 */
export async function applyFixture(
  name: string,
  params: FixtureParams = {},
): Promise<string> {
  const args = ["run", "--silent", "test:env:fixture", "--", name];
  if (params.key !== undefined) args.push(`--key=${params.key}`);
  if (params.day !== undefined) args.push(`--day=${params.day}`);
  if (params.dollars !== undefined) args.push(`--dollars=${params.dollars}`);

  const { stdout, stderr } = await run("npm", args, {
    cwd: process.cwd(),
    // The seeds and repositories this reaches are chatty, and a fixture that
    // fails prints a stack; neither should be truncated into uselessness.
    maxBuffer: 10 * 1024 * 1024,
  });

  // `apply-fixture.ts` prints "   ✓ <name> — <summary>" on success and exits
  // non-zero on failure, so a rejected promise is already the failure path.
  const line = stdout
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("✓"));
  if (!line) {
    throw new Error(
      `Fixture "${name}" printed no result.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
  return line.replace(/^✓\s*/, "");
}
