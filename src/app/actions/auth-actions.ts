"use server";

import { signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/** "Change email" on /register: the address is the account, so start over at sign-in. */
export async function signOutToLoginAction() {
  await signOut({ redirectTo: "/login" });
}
