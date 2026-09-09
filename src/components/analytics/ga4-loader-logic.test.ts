/**
 * GA4Loader gate + downgrade-detection tests — run with:
 *   npm run test:analytics-loader
 * or:
 *   npx tsx src/components/analytics/ga4-loader-logic.test.ts
 *
 * Covers the two pure helpers that decide (a) whether the loader mounts the
 * <Script> tags at all, and (b) whether a consent change is a downgrade that
 * must trigger window.location.reload(). The useEffect wiring that actually
 * invokes reload() is verified by the manual browser recording listed in
 * docs/plans/115-t252-ga4-consent-loader.md §10 (evidence to attach to PR).
 */
import {
  computeGa4State,
  shouldReloadOnDowngrade,
} from "@/components/analytics/ga4-loader-gate";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log("  ✓", name);
}

const ID = "G-TEST0000";

console.log("ga4-loader gate + downgrade tests");

// ── Gate: computeGa4State ─────────────────────────────────────────────────

{
  // ready=false represents "cookie not yet read on the client" (SSR + first
  // paint). Rendering scripts before we know the choice would race the
  // downgrade-reload useEffect.
  const s = computeGa4State({
    ready: false,
    choice: "all",
    isProd: true,
    measurementId: ID,
  });
  assert(s.render === "null", "ready=false must render null");
  ok("gate: !ready → null even with choice=all + prod + id");
}

{
  // Vercel previews run with NODE_ENV=production but NEXT_PUBLIC_APP_ENV
  // unset — this branch is what keeps GA off preview deploys.
  const s = computeGa4State({
    ready: true,
    choice: "all",
    isProd: false,
    measurementId: ID,
  });
  assert(s.render === "null", "isProd=false must render null");
  ok("gate: non-production → null (regardless of consent)");
}

{
  const s = computeGa4State({
    ready: true,
    choice: "all",
    isProd: true,
    measurementId: undefined,
  });
  assert(s.render === "null", "missing measurementId must render null");
  ok("gate: measurementId undefined → null (no-op if env is missing)");
}

{
  const s = computeGa4State({
    ready: true,
    choice: null,
    isProd: true,
    measurementId: ID,
  });
  assert(s.render === "null", "undecided choice must render null");
  ok("gate: undecided (choice=null) → null");
}

{
  const s = computeGa4State({
    ready: true,
    choice: "essential",
    isProd: true,
    measurementId: ID,
  });
  assert(
    s.render === "null",
    "essential must render null — no request to any Google endpoint",
  );
  ok("gate: essential → null (strict; no cookieless pings)");
}

{
  const s = computeGa4State({
    ready: true,
    choice: "limited",
    isProd: true,
    measurementId: ID,
  });
  assert(s.render === "scripts", "limited must render scripts");
  if (s.render === "scripts") {
    assert(
      s.measurementId === ID,
      "limited must pass measurementId through unchanged",
    );
    assert(
      s.defaults.analytics_storage === "granted",
      "limited must grant analytics_storage",
    );
    assert(
      s.defaults.ad_storage === "denied",
      "limited must deny ad_storage",
    );
    assert(
      s.defaults.ad_user_data === "denied",
      "limited must deny ad_user_data",
    );
    assert(
      s.defaults.ad_personalization === "denied",
      "limited must deny ad_personalization",
    );
  }
  ok("gate: limited → scripts with analytics granted, all ad signals denied");
}

{
  const s = computeGa4State({
    ready: true,
    choice: "all",
    isProd: true,
    measurementId: ID,
  });
  assert(s.render === "scripts", "all must render scripts");
  if (s.render === "scripts") {
    assert(
      s.defaults.analytics_storage === "granted" &&
        s.defaults.ad_storage === "granted" &&
        s.defaults.ad_user_data === "granted" &&
        s.defaults.ad_personalization === "granted",
      "all must grant every signal",
    );
  }
  ok("gate: all → scripts with every Consent Mode signal granted");
}

// ── Downgrade detection: shouldReloadOnDowngrade ─────────────────────────

{
  // First observation (prev=undefined) is the initial mount — the ref hasn't
  // captured a real choice yet. Reloading here would infinite-loop.
  assert(
    shouldReloadOnDowngrade(undefined, "all") === false,
    "undefined → all must not reload",
  );
  assert(
    shouldReloadOnDowngrade(undefined, "limited") === false,
    "undefined → limited must not reload",
  );
  assert(
    shouldReloadOnDowngrade(undefined, "essential") === false,
    "undefined → essential must not reload",
  );
  assert(
    shouldReloadOnDowngrade(undefined, null) === false,
    "undefined → null must not reload",
  );
  ok("downgrade: first mount (prev=undefined) never triggers reload");
}

{
  assert(
    shouldReloadOnDowngrade("limited", "limited") === false,
    "unchanged limited must not reload",
  );
  assert(
    shouldReloadOnDowngrade("all", "all") === false,
    "unchanged all must not reload",
  );
  assert(
    shouldReloadOnDowngrade("essential", "essential") === false,
    "unchanged essential must not reload",
  );
  ok("downgrade: unchanged choice never triggers reload");
}

{
  assert(
    shouldReloadOnDowngrade("limited", "essential") === true,
    "limited → essential is a downgrade",
  );
  assert(
    shouldReloadOnDowngrade("all", "essential") === true,
    "all → essential is a downgrade",
  );
  assert(
    shouldReloadOnDowngrade("limited", null) === true,
    "limited → null is a downgrade",
  );
  assert(
    shouldReloadOnDowngrade("all", null) === true,
    "all → null is a downgrade",
  );
  ok(
    "downgrade: {limited|all} → {essential|null} triggers reload (plan §11)",
  );
}

{
  assert(
    shouldReloadOnDowngrade("essential", "limited") === false,
    "essential → limited is an upgrade, not a downgrade",
  );
  assert(
    shouldReloadOnDowngrade("essential", "all") === false,
    "essential → all is an upgrade, not a downgrade",
  );
  assert(
    shouldReloadOnDowngrade(null, "limited") === false,
    "null → limited is an upgrade",
  );
  assert(
    shouldReloadOnDowngrade(null, "all") === false,
    "null → all is an upgrade",
  );
  ok(
    "downgrade: {essential|null} → {limited|all} never triggers reload (upgrade)",
  );
}

{
  // Lateral changes within loaded states — scripts stay mounted. A Consent
  // Mode v2 update would technically be correct but is out of T-252 scope
  // (documented in the loader's shouldReloadOnDowngrade doc-comment).
  assert(
    shouldReloadOnDowngrade("limited", "all") === false,
    "limited → all is a lateral upgrade, not a reload",
  );
  assert(
    shouldReloadOnDowngrade("all", "limited") === false,
    "all → limited is a lateral downgrade WITHIN loaded state, not a reload",
  );
  ok("downgrade: limited ↔ all is lateral (no reload)");
}

console.log(`\n${passed} assertions passed`);
