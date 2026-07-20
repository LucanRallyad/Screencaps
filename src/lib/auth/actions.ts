"use server";

import { redirect } from "next/navigation";
import { getSession } from "./session";
import { logActivity } from "@/lib/activity";

// Identity is owned by the Internal Portal. Login, signup/invite, email
// verification, and password reset have been removed — users sign in via the
// SSO hand-off (see src/app/api/auth/sso/route.ts). Only logout remains local.

export async function logoutAction() {
  const session = await getSession();
  if (session.userId) {
    await logActivity({ userId: session.userId, email: session.email, action: "logout" });
  }
  session.destroy();
  // No local login page — the signed-out screen points back to the Portal.
  redirect("/signed-out");
}
