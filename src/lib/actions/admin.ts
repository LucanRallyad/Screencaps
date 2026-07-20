"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";

// Account locking has moved to the Internal Portal (deactivate the Portal
// account); there is no local lock here anymore.

export async function deleteUser(userId: string) {
  const me = await requireAdmin();
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return { error: "User not found." };
  if ((u.roles ?? []).includes("admin")) return { error: "Cannot delete another admin." };
  if (u.id === me.userId) return { error: "Cannot delete yourself." };

  await db.delete(users).where(eq(users.id, userId));
  await logActivity({
    userId: me.userId,
    email: me.email,
    action: "user_deleted",
    targetType: "user",
    targetId: userId,
    details: { email: u.email },
  });
  revalidatePath("/admin/users");
  return { ok: true as const };
}
