/**
 * T-259 Part 11 — the standing secret scan.
 *   npm run test:observability:scan
 *
 * A one-off grep proves the tree was clean on the day someone ran it. This is
 * the same scan wired to an exit code, so the next person to write
 * `logger.info("sent", { email })` finds out from a failing check rather than
 * from a log drain.
 *
 * It flags a *literal value* being handed to a logger under a protected name:
 * `{ email }`, `{ email: user.email }`, `{ contactPhone: x }`. It deliberately
 * does not flag prose — `logger.error("welcome email failed")` names no value
 * and leaks nothing.
 *
 * Scope is `src/` only. `scripts/` and `prisma/scripts/` are operator CLIs that
 * print to a terminal on purpose ("processing priya@…"); they are not the
 * application's logs and are excluded, not overlooked.
 *
 * Two escape hatches, both deliberate:
 *  - `hashRecipient(...)` and other `*Hash` fields are the sanctioned way to
 *    identify a person, and are allowed;
 *  - a line may carry `// t259-allow: <reason>` on it or the line above. Every
 *    use of that comment should be arguable in review.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build"]);

/** The observability implementation itself names these keys to redact them. */
const SKIP_FILES = [
  "src/lib/observability/redact.ts",
  "src/lib/observability/sentry-scrub.ts",
  "src/lib/observability/capture.ts",
  "src/lib/observability/notification-delivery.ts",
  "src/lib/logger.ts",
];

/**
 * Field names that must never be given a value in a log call. `code` is here
 * because in this codebase it means an OTP; error codes are logged as
 * `errorCode` / inside `reason`.
 */
const FORBIDDEN = [
  "password",
  "passwd",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "sessionToken",
  "apiKey",
  "api_key",
  "secret",
  "clientSecret",
  "authorization",
  "cookie",
  "cookies",
  "otp",
  "otpCode",
  "email",
  "emailAddress",
  "userEmail",
  "workEmail",
  "contactEmail",
  "recipientEmail",
  "candidateEmail",
  "recruiterEmail",
  "phone",
  "phoneNumber",
  "mobile",
  "contactPhone",
  "recipientPhone",
  "shippingAddress",
  "addressLine1",
  "pincode",
  "fullName",
  "recipientName",
  "resumeUrl",
  "resumeText",
];

const LOG_CALL = /(logger|log)\s*(?:\.[A-Za-z]+)?\.(?:info|warn|error|debug|fatal|trace)\s*\(/;
const CONSOLE_CALL = /console\.(?:log|info|warn|error|debug)\s*\(/;

/** `email,` / `email:` inside an object literal — a value, not prose. */
const FIELD_RE = new RegExp(
  `(?<![A-Za-z0-9_$."'\`])(${FORBIDDEN.join("|")})\\s*(?::(?!:)|,|\\})`,
  "i",
);

type Finding = { file: string; line: number; text: string; key: string };

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

function scanFile(file: string): Finding[] {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (SKIP_FILES.includes(rel)) return [];
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) return [];

  const lines = readFileSync(file, "utf8").split("\n");
  const findings: Finding[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!LOG_CALL.test(lines[i]) && !CONSOLE_CALL.test(lines[i])) continue;

    // A log call's object argument can span several lines; read to the end of
    // the call, capped so a runaway never scans the whole file.
    const window = lines.slice(i, Math.min(i + 25, lines.length));
    let depth = 0;
    const body: string[] = [];
    for (const line of window) {
      body.push(line);
      for (const ch of line) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      if (depth <= 0 && body.length > 0) break;
    }

    for (let j = 0; j < body.length; j++) {
      const line = body[j];
      // Strip string literals: prose inside them names no value.
      const code = line
        .replace(/`[^`]*`/g, "``")
        .replace(/"[^"]*"/g, '""')
        .replace(/'[^']*'/g, "''");
      if (/\/\/\s*t259-allow/.test(line)) continue;
      if (j > 0 && /\/\/\s*t259-allow/.test(body[j - 1])) continue;
      // Hashes are the sanctioned identifier.
      if (/Hash\b/.test(line) || /hashRecipient\s*\(/.test(line)) continue;

      const hit = FIELD_RE.exec(code);
      if (hit) {
        findings.push({
          file: rel,
          line: i + j + 1,
          text: line.trim().slice(0, 160),
          key: hit[1],
        });
      }
    }
    i += body.length - 1;
  }

  return findings;
}

const files: string[] = [];
for (const dir of SCAN_DIRS) walk(join(ROOT, dir), files);

const findings = files.flatMap(scanFile);

console.log("\nT-259 log leak scan");
console.log(`  scanned ${files.length} files under ${SCAN_DIRS.join(", ")}`);

if (findings.length === 0) {
  console.log("  ✓ no protected value is passed to a logger\n");
  process.exit(0);
}

console.log(`\n  ✗ ${findings.length} suspicious log call(s):\n`);
for (const f of findings) {
  console.log(`    ${f.file}:${f.line}  [${f.key}]`);
  console.log(`      ${f.text}`);
}
console.log(
  "\n  Log an id or a hash instead (see hashRecipient), or annotate the line\n" +
    "  with `// t259-allow: <reason>` if it genuinely carries no protected value.\n",
);
process.exit(1);
