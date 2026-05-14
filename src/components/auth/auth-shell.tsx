import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen app-glow flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="size-7 rounded-md bg-gradient-to-br from-violet-400 via-fuchsia-400 to-rose-400 shadow-[0_0_30px_-8px_hsl(280_80%_60%/0.6)]" />
          <span className="text-base font-semibold tracking-tight">Screencaps</span>
        </Link>
        <div className="glass rounded-2xl p-7 shadow-2xl">
          <div className="flex flex-col gap-6">{children}</div>
        </div>
        <p className="text-[11px] text-muted-foreground/70 text-center mt-6">
          Rally Ad · Screencaps · Invite-only
        </p>
      </div>
    </main>
  );
}
