import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  consumeTicketJti,
  purgeExpiredTickets,
  primaryRole,
  safeNextPath,
  upsertUserFromTicket,
  verifyTicket,
} from "@/lib/auth/sso";
import { logActivity } from "@/lib/activity";

const SSO_SECRET = process.env.SSO_SECRET_SCREENCAPS || "";

// Runs in the Node.js runtime (needs crypto + pg). Do not switch to edge.
export const runtime = "nodejs";

/**
 * Single sign-on hand-off from the Internal Portal. The Portal POSTs a
 * short-lived, single-use HS256 ticket here; we verify it, upsert the local
 * profile, establish the iron-session, and redirect into the app. There is no
 * local password login.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const ticket = typeof form?.get("ticket") === "string" ? (form!.get("ticket") as string) : "";
  const next = safeNextPath(form?.get("next"));
  if (!ticket) {
    return new NextResponse("Missing SSO ticket.", { status: 400 });
  }

  let claims;
  try {
    claims = verifyTicket(ticket, SSO_SECRET);
  } catch (e) {
    console.error("[sso] ticket verification failed:", (e as Error)?.message);
    return new NextResponse(
      "Invalid or expired sign-in link. Please reopen from the Internal Portal.",
      { status: 401 },
    );
  }

  // Enforce single use before establishing a session (replay protection).
  const fresh = await consumeTicketJti(claims.jti, claims.exp);
  if (!fresh) {
    return new NextResponse(
      "This sign-in link has already been used. Please reopen from the Internal Portal.",
      { status: 401 },
    );
  }
  void purgeExpiredTickets().catch(() => undefined);

  const user = await upsertUserFromTicket(claims);

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.roles = user.roles ?? [];
  session.role = primaryRole(user.roles);
  await session.save();

  await logActivity({ userId: user.id, email: user.email, action: "login" });

  return NextResponse.redirect(new URL(next, req.url), { status: 303 });
}
