import { db } from "@/lib/db/client";
import { activityLogs, users } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ActivityFilter } from "./filter";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const email = sp.email?.trim().toLowerCase() ?? "";

  const baseQuery = db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      details: activityLogs.details,
      userEmail: activityLogs.userEmail,
      ipAddress: activityLogs.ipAddress,
      createdAt: activityLogs.createdAt,
      targetType: activityLogs.targetType,
      targetId: activityLogs.targetId,
    })
    .from(activityLogs);

  const rows = await (email
    ? baseQuery.where(sql`lower(${activityLogs.userEmail}) = ${email}`)
    : baseQuery
  )
    .orderBy(desc(activityLogs.createdAt))
    .limit(500);

  // Unique emails for the filter dropdown
  const allEmails = await db
    .select({ email: activityLogs.userEmail })
    .from(activityLogs)
    .where(sql`${activityLogs.userEmail} is not null`)
    .groupBy(activityLogs.userEmail);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All user actions, filtered by email.
          </p>
        </div>
        <Button asChild variant="secondary">
          <a href={`/api/admin/activity/export${email ? `?email=${encodeURIComponent(email)}` : ""}`}>
            <Download /> Download .txt
          </a>
        </Button>
      </div>

      <ActivityFilter
        active={email}
        emails={allEmails.map((r) => r.email!).filter(Boolean)}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">When</th>
                <th className="text-left font-medium px-4 py-2.5">User</th>
                <th className="text-left font-medium px-4 py-2.5">Action</th>
                <th className="text-left font-medium px-4 py-2.5">Target</th>
                <th className="text-left font-medium px-4 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No activity yet{email ? ` for ${email}` : ""}.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-accent/30">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">{r.userEmail ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="muted" className="font-mono">{r.action}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {r.targetType ? `${r.targetType}:${r.targetId?.slice(0, 8)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-[11px]">
                    {r.ipAddress ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
