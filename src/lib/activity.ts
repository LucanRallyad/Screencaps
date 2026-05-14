import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db/client";
import { activityLogs } from "@/lib/db/schema";

export type LogInput = {
  userId?: string | null;
  email?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
};

export async function logActivity(input: LogInput) {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    userAgent = h.get("user-agent") ?? null;
  } catch {
    // Not in a request context (e.g., worker) — leave nulls
  }

  await db.insert(activityLogs).values({
    userId: input.userId ?? null,
    userEmail: input.email ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    details: input.details ?? null,
    ipAddress,
    userAgent,
  });
}
