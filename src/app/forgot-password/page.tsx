import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "./forgot-form";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter your email — we&apos;ll send you a link to choose a new password.</p>
      </div>
      <ForgotForm />
      <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
        ← Back to sign in
      </Link>
    </AuthShell>
  );
}
