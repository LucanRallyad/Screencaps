import Link from "next/link";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") ? next : undefined;
  return (
    <AuthShell>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Screencaps is invite-only. Use the credentials you set after accepting your invite.
        </p>
      </div>
      <LoginForm next={safeNext} />
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <Link href="/forgot-password" className="hover:text-foreground underline-offset-4 hover:underline">
          Forgot password?
        </Link>
        <span>No account? Ask the admin for an invite.</span>
      </div>
    </AuthShell>
  );
}
