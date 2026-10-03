/**
 * Plan 171 — claim-and-complete emails for imported résumés.
 *
 * Offline: no database, no network. Pure modules are imported directly; the
 * wiring is checked against the source, the same way `import.test.ts` checks
 * guards.
 *
 * O1 token round-trip, tamper, expiry, wrong version, short secret
 * O2 completeness: percent and priority order of missing items
 * O3 sequence: INVITE day 0 / 6 / 7 / 8, claim → onboard, ONBOARD 0 / 4 / 5 / 6
 * O4 never more than 4 emails; complete stops; deleted import stops
 * O5 invite template: approved design + only the agreed changes
 * O6 the other three templates
 * O7 wiring: enrolment, both claim doors, cron isolation, public routes
 *
 * Run: npx tsx src/features/resume/import/outreach.test.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

process.env.IMPORT_CLAIM_SECRET = "test-secret-test-secret-test-secret-0123456789";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function suite(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  }
}

const ROOT = process.cwd();
const src = (p: string) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const token = await import("@/features/resume/import/outreach-token");
  const steps = await import("@/features/resume/import/outreach-steps");
  const templates = await import("@/features/resume/import/outreach-templates");

  const T0 = new Date("2026-10-01T03:30:00Z");
  const complete = { percent: 100, missing: [] as const };
  const partial = steps.profileCompleteness({
    phoneVerified: false,
    educationCount: 1,
    experienceCount: 0,
    hasNoWorkExperience: false,
    skillCount: 7,
    githubUsername: null,
    linkedinUrl: null,
  });

  console.log("\nO1 — signed claim links");
  await suite("round-trips import and user", () => {
    const t = token.signClaimToken("imp_1", "usr_1", T0);
    const v = token.verifyClaimToken(t, T0);
    assert(v.ok && v.importId === "imp_1" && v.userId === "usr_1", JSON.stringify(v));
  });
  await suite("tampered payload or signature is rejected", () => {
    const t = token.signClaimToken("imp_1", "usr_1", T0);
    const [p, s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ i: "imp_2", u: "usr_1", e: 9e9, v: 1 })).toString("base64url");
    assert(!token.verifyClaimToken(`${forged}.${s}`, T0).ok, "forged payload accepted");
    assert(!token.verifyClaimToken(`${p}.${s!.slice(0, -2)}xx`, T0).ok, "bad signature accepted");
    assert(!token.verifyClaimToken("nonsense", T0).ok, "garbage accepted");
  });
  await suite("expires after 45 days", () => {
    const t = token.signClaimToken("imp_1", "usr_1", T0);
    assert(token.verifyClaimToken(t, new Date(T0.getTime() + 44 * DAY)).ok, "valid on day 44");
    assert(!token.verifyClaimToken(t, new Date(T0.getTime() + 45 * DAY)).ok, "valid on day 45");
  });
  await suite("a short secret refuses to sign", () => {
    const saved = process.env.IMPORT_CLAIM_SECRET;
    process.env.IMPORT_CLAIM_SECRET = "short";
    let threw = false;
    try {
      token.signClaimToken("a", "b", T0);
    } catch {
      threw = true;
    }
    process.env.IMPORT_CLAIM_SECRET = saved;
    assert(threw, "signed with a short secret");
  });

  console.log("\nO2 — completeness");
  await suite("five checks, 20% each, in priority order", () => {
    assert(partial.percent === 40, `percent ${partial.percent}`);
    assert(partial.missing.join(",") === "phone,experience,links", partial.missing.join(","));
    const none = steps.profileCompleteness({
      phoneVerified: true,
      educationCount: 2,
      experienceCount: 0,
      hasNoWorkExperience: true,
      skillCount: 5,
      githubUsername: "x",
      linkedinUrl: null,
    });
    assert(none.percent === 100 && none.missing.length === 0, JSON.stringify(none));
  });

  console.log("\nO3 — the sequence");
  const reg = { importStatus: "REGISTERED" as const, registeredAt: T0, claimedAt: null, completeness: partial };
  await suite("INVITE: invite now, reminder only from day 7, then NO_RESPONSE", () => {
    const a0 = steps.nextOutreachAction({ stage: "INVITE", step: 0, sentCount: 0 }, reg, T0);
    assert(a0.kind === "send" && a0.template === "invite" && a0.step === 1, JSON.stringify(a0));
    assert(a0.kind === "send" && a0.nextAt?.getTime() === T0.getTime() + 7 * DAY, "reminder due day 7");
    const a6 = steps.nextOutreachAction({ stage: "INVITE", step: 1, sentCount: 1 }, reg, new Date(T0.getTime() + 6 * DAY));
    assert(a6.kind === "wait", `day 6: ${a6.kind}`);
    const a7 = steps.nextOutreachAction({ stage: "INVITE", step: 1, sentCount: 1 }, reg, new Date(T0.getTime() + 7 * DAY));
    assert(a7.kind === "send" && a7.template === "invite_reminder" && a7.stopAfter === "NO_RESPONSE", JSON.stringify(a7));
    const a8 = steps.nextOutreachAction({ stage: "INVITE", step: 2, sentCount: 2 }, reg, new Date(T0.getTime() + 8 * DAY));
    assert(a8.kind === "stop" && a8.reason === "NO_RESPONSE", JSON.stringify(a8));
  });
  await suite("a claim during INVITE moves to onboarding", () => {
    const a = steps.nextOutreachAction(
      { stage: "INVITE", step: 1, sentCount: 1 },
      { ...reg, importStatus: "CLAIMED", claimedAt: T0 },
      T0,
    );
    assert(a.kind === "move_to_onboard", JSON.stringify(a));
  });
  const claimed = { importStatus: "CLAIMED" as const, registeredAt: T0, claimedAt: T0, completeness: partial };
  await suite("ONBOARD: welcome now, reminder only from claim + 5 days, then stop", () => {
    const b0 = steps.nextOutreachAction({ stage: "ONBOARD", step: 0, sentCount: 1 }, claimed, T0);
    assert(b0.kind === "send" && b0.template === "onboard_welcome", JSON.stringify(b0));
    const b4 = steps.nextOutreachAction({ stage: "ONBOARD", step: 1, sentCount: 2 }, claimed, new Date(T0.getTime() + 4 * DAY));
    assert(b4.kind === "wait", `claim+4: ${b4.kind}`);
    const b5 = steps.nextOutreachAction({ stage: "ONBOARD", step: 1, sentCount: 2 }, claimed, new Date(T0.getTime() + 5 * DAY));
    assert(b5.kind === "send" && b5.template === "onboard_reminder" && b5.stopAfter === "FINISHED_SEQUENCE", JSON.stringify(b5));
    const b6 = steps.nextOutreachAction({ stage: "ONBOARD", step: 2, sentCount: 3 }, claimed, new Date(T0.getTime() + 6 * DAY));
    assert(b6.kind === "stop" && b6.reason === "FINISHED_SEQUENCE", JSON.stringify(b6));
  });

  console.log("\nO4 — limits");
  await suite("never more than 4 emails", () => {
    const a = steps.nextOutreachAction({ stage: "ONBOARD", step: 1, sentCount: 4 }, claimed, new Date(T0.getTime() + 9 * DAY));
    assert(a.kind === "stop", JSON.stringify(a));
    // The longest path: 2 invites + 2 onboarding = 4.
    assert(steps.MAX_OUTREACH_EMAILS === 4, "cap is 4");
  });
  await suite("a complete profile stops onboarding", () => {
    const a = steps.nextOutreachAction(
      { stage: "ONBOARD", step: 0, sentCount: 1 },
      { ...claimed, completeness: { percent: 100, missing: [] } },
      T0,
    );
    assert(a.kind === "stop" && a.reason === "COMPLETE", JSON.stringify(a));
    void complete;
  });
  await suite("a deleted import stops the sequence", () => {
    const a = steps.nextOutreachAction({ stage: "INVITE", step: 0, sentCount: 0 }, { ...reg, importStatus: null }, T0);
    assert(a.kind === "stop" && a.reason === "ADMIN", JSON.stringify(a));
  });

  console.log("\nO5 — the invite (approved design, agreed changes only)");
  const data = {
    firstName: "Asha",
    email: "asha.menon@example.com",
    claimUrl: "https://abtalks.in/claim/abc.def",
    profileUrl: "https://abtalks.in/profile",
    completeness: partial,
  };
  const invite = templates.renderOutreachEmail("invite", data);
  await suite("keeps the approved headline, copy and subject", () => {
    assert(invite.html.includes("<title>Someone looking at your profile would miss this.</title>"), "title kept");
    assert(invite.html.includes("Someone looking at your profile<br>"), "hero line 1");
    assert(invite.html.includes("Your AB TALKS profile is already taking shape."), "body copy");
    assert(invite.html.includes("You're closer than you think."), "card title");
    assert(invite.html.includes("Don't let an incomplete profile speak for you."), "closing title");
    assert(invite.html.includes("Your profile. Your skills. Your next opportunity."), "strip");
    assert(invite.html.includes(">Preferences</a>"), "preferences link kept");
  });
  await suite("change 6: greets by first name", () => {
    assert(invite.html.includes("Hi Asha,"), "greeting");
  });
  await suite("change 3: button is the personal claim link", () => {
    assert(invite.html.includes(`href="${data.claimUrl}" class="button">Claim my profile →</a>`), "claim button");
    assert(!invite.html.includes(">See What's Missing →<"), "old button gone");
  });
  await suite("change 4: names the email to sign in with", () => {
    assert(invite.html.includes("Sign in with <strong>asha.menon@example.com</strong> to claim it."), "sign-in line");
    assert(invite.html.includes("Takes only a few minutes."), "existing note kept");
  });
  await suite("change 5: real missing items and %, no ticks", () => {
    assert(invite.html.includes("Your profile is <strong>40%</strong> complete."), "percent");
    assert(invite.html.includes("<strong>Phone number</strong>"), "phone");
    assert(invite.html.includes("<strong>GitHub or LinkedIn</strong>"), "links");
    assert(!invite.html.includes("<strong>Skills &amp; expertise</strong>"), "skills not missing → not listed");
    assert(!invite.html.includes("✓"), "no ticks");
  });
  await suite("no unsubscribe link", () => {
    assert(!/unsubscribe/i.test(invite.html), "unsubscribe present");
  });
  await suite("résumé values are escaped", () => {
    const evil = templates.renderOutreachEmail("invite", { ...data, firstName: "<script>x</script>" });
    assert(!evil.html.includes("<script>x</script>") && evil.html.includes("&lt;script&gt;"), "not escaped");
  });

  await suite("subjects read as personal account notices", () => {
    const subjects = (["invite", "invite_reminder", "onboard_welcome", "onboard_reminder"] as const).map(
      (t) => templates.renderOutreachEmail(t, data).subject,
    );
    assert(subjects[0] === "Asha, update your profile on ABTalks", subjects[0]!);
    assert(subjects[3] === "Asha, one detail left on your ABTalks profile: phone number", subjects[3]!);
    for (const s of subjects) {
      assert(s.startsWith("Asha, "), `no name: ${s}`);
      assert(!/[!🎉🔥]|free|offer|now\b|urgent|limited/i.test(s), `promo words: ${s}`);
      assert(s.length <= 70, `too long: ${s}`);
    }
    const noName = templates.renderOutreachEmail("invite", { ...data, firstName: "" }).subject;
    assert(noName === "Update your profile on ABTalks", noName);
  });

  console.log("\nO6 — the other emails");
  await suite("reminder and onboarding use the right button and copy", () => {
    const r = templates.renderOutreachEmail("invite_reminder", data);
    assert(r.html.includes(data.claimUrl) && r.html.includes("Sign in with"), "reminder → claim link");
    const w = templates.renderOutreachEmail("onboard_welcome", data);
    assert(w.html.includes(`href="${data.profileUrl}"`) && !w.html.includes(data.claimUrl), "welcome → profile");
    const o = templates.renderOutreachEmail("onboard_reminder", data);
    assert(o.html.includes("The most useful thing to add next: Phone number."), "names the top gap");
    for (const e of [r, w, o]) {
      assert(e.text.length > 0 && !/unsubscribe/i.test(e.html), "text part, no unsubscribe");
    }
  });

  console.log("\nO7 — wiring");
  await suite("both REGISTERED outcomes enrol; CLAIMED does not", () => {
    const s = src("src/features/resume/import/register.ts");
    assert(s.includes('if (status === "REGISTERED") await enrollOutreach(imp.id, user.id);'), "existing account");
    assert(s.includes("await enrollOutreach(imp.id, userId);\n  return \"REGISTERED\";"), "new account");
  });
  await suite("Google and emailed-code sign-in share one claim; email path never blocks", () => {
    const c = src("src/features/resume/import/claim.ts");
    assert(c.includes('return claimImportOnSignIn(userId, "oauth_claim", db);'), "google delegates");
    const e = src("src/lib/email-auth.ts");
    const at = e.indexOf('claimImportOnSignIn(user.id, "email_code_claim")');
    assert(at > 0 && e.lastIndexOf("try {", at) > e.lastIndexOf("return toSessionUser(user);", at), "wrapped in try");
  });
  await suite("cron: outreach in its own try, after the drain", () => {
    const r = src("src/app/api/cron/resume-imports/route.ts");
    assert(r.indexOf("drainAndContinue()") < r.indexOf("runImportOutreach()"), "order");
    assert(/try \{\n\s+outreach = await runImportOutreach\(\);/.test(r), "isolated");
  });
  await suite("public routes carry no session guard; the token is the gate", () => {
    for (const f of [
      "src/app/claim/[token]/page.tsx",
      "src/app/claim/[token]/remove/page.tsx",
      "src/app/actions/import-claim-actions.ts",
      "src/app/api/webhooks/brevo/route.ts",
    ]) {
      const s = src(f);
      assert(!/requireAdmin|requireRole|getAdminContext/.test(s), `${f} has a guard`);
    }
    assert(src("src/app/api/webhooks/brevo/route.ts").includes("timingSafeEqual"), "webhook secret");
  });
  await suite("the invite goes out at registration; no daily cap", () => {
    const s = src("src/features/resume/import/outreach.ts");
    const enroll = s.slice(s.indexOf("export async function enrollOutreach"));
    assert(/row\.stage === "INVITE" && row\.step === 0\) \{\n\s+await processOutreachRow\(/.test(enroll), "sends a fresh row now");
    assert(!/DAILY_CAP|dailyCap/.test(s), "no daily cap");
    assert(s.includes("RUN_BUDGET_MS"), "the run is bounded by time, not count");
    const a = src("src/app/actions/admin-resume-import-actions.ts");
    assert(a.includes("enrollOutreach(p.id, p.userId, { sendNow: false })"), "backfill queues");
    assert(a.includes("await runImportOutreach();"), "backfill sends in the background");
  });
  await suite("admin label shows when the next email is due", () => {
    const s = src("src/features/resume/import/status.ts");
    assert(s.includes('" · next email due"') && s.includes("` · next email ${NEXT_EMAIL_DATE.format(o.nextSendAt)}`"), "next-email text");
    assert(s.includes('timeZone: "Asia/Kolkata"'), "IST date");
    assert(/if \(o\.stage === "STOPPED" \|\| !o\.nextSendAt\) return "";/.test(s), "nothing once stopped");
    assert(src("src/app/actions/admin-resume-import-actions.ts").includes("nextEmail:"), "CSV column");
  });
  await suite("remove never deletes an account that existed before the import", () => {
    const s = src("src/features/resume/import/outreach.ts");
    assert(/if \(!facts\.linkedExisting\) \{\n\s+await tx\.user\.update/.test(s), "linkedExisting guard");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
