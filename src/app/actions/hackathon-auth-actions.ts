"use server";

import { signIn, signOut } from "@/auth";

// Force Google's account chooser, scoped to THIS call only (no global provider change).
// After re-auth, land on /hackathon; the landing shows Register (modal) for the
// new account, or the dashboard CTA when that account is already registered.
export async function switchHackathonAccountAction() {
  await signIn(
    "google",
    { redirectTo: "/hackathon" },
    { prompt: "select_account" },
  );
}

// Plain logout → back to the public hackathon landing (not /login).
export async function logoutHackathonAction() {
  await signOut({ redirectTo: "/hackathon" });
}
