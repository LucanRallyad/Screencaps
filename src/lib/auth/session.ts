import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { redirect } from "next/navigation";

export type SessionData = {
  userId?: string;
  email?: string;
  // Roles asserted by the Portal at SSO time. `role` is a derived convenience
  // ("admin" when roles includes "admin") kept so existing checks keep working.
  roles?: string[];
  role?: "admin" | "user";
};

const _sessionSecret = process.env.SESSION_SECRET;
if (!_sessionSecret || _sessionSecret.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  }
  console.warn(
    "[security] SESSION_SECRET is missing or too short — using a dev placeholder. NEVER do this in production!",
  );
}
const sessionSecret =
  _sessionSecret && _sessionSecret.length >= 32
    ? _sessionSecret
    : "dev-only-replace-me-with-a-real-secret-of-32+chars";

const sessionOptions: SessionOptions = {
  password: sessionSecret,
  cookieName: "screencaps_session",
  cookieOptions: {
    httpOnly: true,
    secure: (process.env.BASE_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) {
    // No local login — the signed-out screen points back to the Portal.
    redirect("/signed-out");
  }
  return {
    userId: session.userId,
    email: session.email!,
    role: session.role!,
    roles: session.roles ?? [],
  };
}

/**
 * Admins and managers have full access to EVERY user's projects — view, edit,
 * run, and delete — not just their own. (Only the Users page and Activity log
 * remain admin-only, gated separately by requireAdmin.) Regular users are
 * limited to their own projects. Accepts anything carrying the session's roles.
 */
export function canAccessAllProjects(s: { roles?: string[]; role?: string | null }): boolean {
  const roles = s.roles ?? [];
  return roles.includes("admin") || roles.includes("manager") || s.role === "admin";
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.userId) {
    redirect("/signed-out");
  }
  if (session.role !== "admin") redirect("/projects");
  return { userId: session.userId!, email: session.email!, role: session.role as "admin" };
}
