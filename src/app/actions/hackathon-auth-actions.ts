"use server";

import { signIn, signOut } from "@/auth";

// Force Google's account chooser, scoped to THIS call only (no global provider change).
// After re-auth, land on /hackathon/register; that page forwards already-registered
// users to /hackathon/dashboard (plan 042, step 12) — this is the "smart" destination.
export async function switchHackathonAccountAction() {
  await signIn(
    "google",
    { redirectTo: "/hackathon/register" },
    { prompt: "select_account" },
  );
}

// Plain logout → back to the public hackathon landing (not /login).
export async function logoutHackathonAction() {
  await signOut({ redirectTo: "/hackathon" });
}
