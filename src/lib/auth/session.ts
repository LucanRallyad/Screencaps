import "server-only";
import { cookies, headers } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { redirect } from "next/navigation";

export type SessionData = {
  userId?: string;
  email?: string;
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

async function currentPath() {
  const h = await headers();
  return h.get("x-invoke-path") ?? h.get("x-pathname") ?? "/";
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) {
    const path = await currentPath();
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return { userId: session.userId, email: session.email!, role: session.role! };
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.userId) {
    const path = await currentPath();
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (session.role !== "admin") redirect("/projects");
  return { userId: session.userId!, email: session.email!, role: session.role as "admin" };
}
