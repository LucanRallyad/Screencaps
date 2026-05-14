import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

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

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) throw new Error("UNAUTHENTICATED");
  return { userId: session.userId, email: session.email!, role: session.role! };
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || session.role !== "admin") throw new Error("UNAUTHORIZED");
  return { userId: session.userId, email: session.email!, role: session.role };
}
