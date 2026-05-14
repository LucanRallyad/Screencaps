import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/auth/session";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
];
const PUBLIC_PREFIXES = ["/invite/", "/verify/", "/reset/", "/_next/", "/api/auth/"];

const sessionPassword = process.env.SESSION_SECRET ?? "dev-only-replace-me-with-a-real-secret-of-32+chars";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/favicon.ico" ||
    pathname.startsWith("/screenshots/") || // public-served static screenshots (signed-link could replace this)
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  // iron-session 8 accepts a CookieStore-like object; bridge Next's RequestCookies
  // into a minimal one that exposes the get/set/delete API it expects.
  const cookieBridge = {
    get: (name: string) => req.cookies.get(name),
    set: (name: string, value: string, opts?: { httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none"; path?: string; maxAge?: number; expires?: Date }) =>
      res.cookies.set({ name, value, ...opts }),
    delete: (name: string) => res.cookies.delete(name),
  };
  const session = await getIronSession<SessionData>(cookieBridge as never, {
    password: sessionPassword,
    cookieName: "screencaps_session",
  });

  if (!session.userId) {
    if (pathname === "/") return NextResponse.redirect(new URL("/login", req.url));
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Admin gate
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/projects", req.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/projects", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!api/screenshots|_next/static|_next/image|favicon.ico).*)"],
};
