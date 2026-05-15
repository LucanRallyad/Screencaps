import "server-only";
import { cookies, headers } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { redirect } from "next/navigation";

export type SessionData = {
  userId?: string;
  email?: string;
  role?: "admin" | "user";
};

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "dev-only-replace-me-with-a-real-secret-of-32+chars",
  cookieName: "screencaps_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
