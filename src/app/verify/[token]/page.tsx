import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { verifyEmailAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyEmailAction(token);

  return (
    <AuthShell>
      {result.error ? (
        <>
          <div className="flex items-center gap-3">
            <XCircle className="text-destructive size-7" />
            <h1 className="text-2xl font-semibold tracking-tight">Verification failed</h1>
          </div>
          <p className="text-sm text-muted-foreground">{result.error}</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-success size-7" />
            <h1 className="text-2xl font-semibold tracking-tight">Email verified</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            You can sign in now and start running screen captures.
          </p>
        </>
      )}
      <Button asChild className="w-full mt-2">
        <Link href="/login">Continue to sign in</Link>
      </Button>
    </AuthShell>
  );
}
