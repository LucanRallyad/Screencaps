"use server";

import { z } from "zod";
import { eq, and, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db/client";
import { users, invites, emailVerifications, passwordResets } from "@/lib/db/schema";
import { getSession } from "./session";
import { hashPassword, verifyPassword } from "./password";
import { generateToken, addHours } from "./tokens";
import { sendInviteEmail, sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email/send";
import { logActivity } from "@/lib/activity";

const emailSchema = z.string().email().transform((s) => s.toLowerCase().trim());

// ─── Login ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password required"),
});

export async function loginAction(_prev: unknown, formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.passwordHash) return { error: "Invalid credentials." };
  if (user.locked) return { error: "This account is locked. Contact the admin." };
  if (!user.emailVerifiedAt) return { error: "Please verify your email first. Check your inbox." };

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { error: "Invalid credentials." };

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.role = user.role;
  await session.save();

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await logActivity({ userId: user.id, email: user.email, action: "login" });

  const next = formData.get("next");
  const destination = typeof next === "string" && next.startsWith("/") ? next : "/projects";
  redirect(destination);
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logoutAction() {
  const session = await getSession();
  if (session.userId) {
    await logActivity({ userId: session.userId, email: session.email, action: "logout" });
  }
  session.destroy();
  redirect("/login");
}

// ─── Invite (admin only) ─────────────────────────────────────────────────────

const inviteSchema = z.object({ email: emailSchema });

export async function inviteUserAction(_prev: unknown, formData: FormData) {
  const session = await getSession();
  if (session.role !== "admin") return { error: "Not authorized." };

  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };
  const email = parsed.data.email;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "A user with that email already exists." };

  const token = generateToken();
  const expiresAt = addHours(new Date(), 72);
  await db.insert(invites).values({
    email,
    token,
    invitedByUserId: session.userId!,
    expiresAt,
  });

  await sendInviteEmail(email, token);
  await logActivity({
    userId: session.userId!,
    email: session.email,
    action: "invite_sent",
    targetType: "user",
    targetId: email,
  });

  return { ok: true as const, message: `Invite sent to ${email}.` };
}

// ─── Complete invite (set password + name) ───────────────────────────────────

const completeInviteSchema = z.object({
  token: z.string().min(1),
  firstName: z.string().min(1, "First name required").max(64),
  password: z.string().min(8, "Use at least 8 characters"),
});

export async function completeInviteAction(_prev: unknown, formData: FormData) {
  const parsed = completeInviteSchema.safeParse({
    token: formData.get("token"),
    firstName: formData.get("firstName"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const { token, firstName, password } = parsed.data;

  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.consumedAt), gt(invites.expiresAt, new Date())))
    .limit(1);
  if (!invite) return { error: "This invite is invalid or expired. Ask the admin to send a new one." };

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email: invite.email, firstName, passwordHash, role: "user" })
    .returning();

  await db.update(invites).set({ consumedAt: new Date() }).where(eq(invites.id, invite.id));

  // Issue an email verification
  const verifyToken = generateToken();
  await db.insert(emailVerifications).values({
    userId: user.id,
    token: verifyToken,
    expiresAt: addHours(new Date(), 24),
  });
  await sendVerificationEmail(user.email, verifyToken);

  await logActivity({ userId: user.id, email: user.email, action: "signup_completed" });

  return { ok: true as const, message: "Account created. Check your email to verify, then sign in." };
}

// ─── Verify email ────────────────────────────────────────────────────────────

export async function verifyEmailAction(token: string) {
  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(and(eq(emailVerifications.token, token), isNull(emailVerifications.consumedAt), gt(emailVerifications.expiresAt, new Date())))
    .limit(1);
  if (!row) return { error: "Verification link is invalid or expired." };

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
  await db.update(emailVerifications).set({ consumedAt: new Date() }).where(eq(emailVerifications.id, row.id));

  await logActivity({ userId: row.userId, action: "email_verified" });
  return { ok: true as const };
}

// ─── Request password reset ──────────────────────────────────────────────────

const requestResetSchema = z.object({ email: emailSchema });

export async function requestPasswordResetAction(_prev: unknown, formData: FormData) {
  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  // Always succeed to avoid enumeration
  if (user) {
    const token = generateToken();
    await db.insert(passwordResets).values({
      userId: user.id,
      token,
      expiresAt: addHours(new Date(), 4),
    });
    try {
      await sendPasswordResetEmail(user.email, token);
      console.log(`[password-reset] email sent to ${user.email}`);
    } catch (err) {
      console.error(`[password-reset] failed to send email to ${user.email}:`, err);
    }
    await logActivity({ userId: user.id, email: user.email, action: "password_reset_requested" });
  } else {
    console.log(`[password-reset] no user found for email: ${parsed.data.email}`);
  }

  return { ok: true as const, message: "If that email exists, a reset link has been sent." };
}

// ─── Complete password reset ─────────────────────────────────────────────────

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Use at least 8 characters"),
});

export async function resetPasswordAction(_prev: unknown, formData: FormData) {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const { token, password } = parsed.data;

  const [row] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.token, token), isNull(passwordResets.consumedAt), gt(passwordResets.expiresAt, new Date())))
    .limit(1);
  if (!row) return { error: "Reset link is invalid or expired." };

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, emailVerifiedAt: new Date() })
    .where(eq(users.id, row.userId));
  await db
    .update(passwordResets)
    .set({ consumedAt: new Date() })
    .where(eq(passwordResets.id, row.id));

  await logActivity({ userId: row.userId, action: "password_reset_completed" });
  return { ok: true as const, message: "Password updated. You can sign in now." };
}

// ─── Helpers for ip/agent (used inline by login when needed) ─────────────────

export async function requestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };
}
