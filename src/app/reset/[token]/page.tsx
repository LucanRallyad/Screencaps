import { db } from "@/lib/db/client";
import { passwordResets } from "@/lib/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "./form";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.token, token), isNull(passwordResets.consumedAt), gt(passwordResets.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    return (
      <AuthShell>
        <h1 className="text-2xl font-semibold tracking-tight">Link expired</h1>
        <p className="text-sm text-muted-foreground">
          This reset link is invalid or has been used. Request a new one from the sign-in page.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick something at least 8 characters.</p>
      </div>
      <ResetForm token={token} />
    </AuthShell>
  );
}
