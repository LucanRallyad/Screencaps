import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteUserForm } from "./invite-form";
import { UserRowActions } from "./user-actions";
import { relativeTime } from "@/lib/utils";

export default async function AdminUsersPage() {
  await requireAdmin();
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Invite, lock, or remove accounts.</p>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-medium mb-3">Invite a user</h3>
        <InviteUserForm />
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Email</th>
                <th className="text-left font-medium px-4 py-2.5">Name</th>
                <th className="text-left font-medium px-4 py-2.5">Role</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-left font-medium px-4 py-2.5">Last login</th>
                <th className="text-right font-medium px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-accent/30">
                  <td className="px-4 py-2.5 font-mono text-[12px]">{u.email}</td>
                  <td className="px-4 py-2.5">{u.firstName ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={u.role === "admin" ? "warning" : "muted"}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-2.5 flex items-center gap-1.5">
                    {u.locked ? (
                      <Badge variant="destructive">locked</Badge>
                    ) : u.emailVerifiedAt ? (
                      <Badge variant="success">verified</Badge>
                    ) : u.passwordHash ? (
                      <Badge variant="warning">pending verify</Badge>
                    ) : (
                      <Badge variant="muted">invited</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <UserRowActions userId={u.id} locked={u.locked} email={u.email} role={u.role} />
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
