import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserRowActions } from "./user-actions";
import { relativeTime } from "@/lib/utils";

export default async function AdminUsersPage() {
  await requireAdmin();
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Accounts are provisioned by the Internal Portal. Roles are managed
          there and shown read-only here; you can remove a tool-side profile.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Email</th>
                <th className="text-left font-medium px-4 py-2.5">Name</th>
                <th className="text-left font-medium px-4 py-2.5">Role</th>
                <th className="text-left font-medium px-4 py-2.5">Last login</th>
                <th className="text-right font-medium px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((u) => {
                const role = (u.roles ?? []).includes("admin") ? "admin" : "user";
                return (
                  <tr key={u.id} className="hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-mono text-[12px]">{u.email}</td>
                    <td className="px-4 py-2.5">{u.firstName ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={role === "admin" ? "warning" : "muted"}>{role}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <UserRowActions userId={u.id} email={u.email} role={role} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
