import { db } from "@/lib/db/client";
import { invites } from "@/lib/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { AuthShell } from "@/components/auth/auth-shell";
import { CompleteInviteForm } from "./form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.consumedAt), gt(invites.expiresAt, new Date())))
    .limit(1);

  if (!invite) {
    return (
      <AuthShell>
        <h1 className="text-2xl font-semibold tracking-tight">Invite expired</h1>
        <p className="text-sm text-muted-foreground">
          This invite link is invalid or already used. Ask the admin to send a new one.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invited as <span className="text-foreground">{invite.email}</span>
        </p>
      </div>
      <CompleteInviteForm token={token} />
    </AuthShell>
  );
}
