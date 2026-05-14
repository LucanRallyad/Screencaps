import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { activityLogs } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";

export async function GET(req: Request) {
  const session = await getSession();
  if (session.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase().trim();

  const query = db
    .select({
      createdAt: activityLogs.createdAt,
      userEmail: activityLogs.userEmail,
      action: activityLogs.action,
      targetType: activityLogs.targetType,
      targetId: activityLogs.targetId,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      details: activityLogs.details,
    })
    .from(activityLogs);

  const rows = await (email
    ? query.where(sql`lower(${activityLogs.userEmail}) = ${email}`)
    : query
  ).orderBy(desc(activityLogs.createdAt));

  const lines: string[] = [];
  lines.push(`Screencaps activity log${email ? ` — ${email}` : ""}`);
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push(`Total entries: ${rows.length}`);
  lines.push("=".repeat(80));
  lines.push("");
  for (const r of rows) {
    const when = r.createdAt ? new Date(r.createdAt).toISOString() : "";
    const detailStr = r.details ? ` details=${JSON.stringify(r.details)}` : "";
    const targetStr = r.targetType ? ` target=${r.targetType}:${r.targetId}` : "";
    lines.push(`[${when}] ${r.userEmail ?? "?"} ${r.action}${targetStr}${detailStr} ip=${r.ipAddress ?? ""}`);
  }

  await logActivity({
    userId: session.userId,
    email: session.email,
    action: "activity_log_exported",
    details: { filter_email: email ?? null, rows: rows.length },
  });

  const filename = `screencaps-activity-${email ? email.replace(/[^a-z0-9]/g, "-") + "-" : ""}${new Date().toISOString().slice(0, 10)}.txt`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
