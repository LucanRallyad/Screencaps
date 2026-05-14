import Link from "next/link";
import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import type { SessionData } from "@/lib/auth/session";

export function AppShell({ children, session }: { children: ReactNode; session: SessionData }) {
  return (
    <div className="min-h-screen app-glow flex">
      <Sidebar role={session.role ?? "user"} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar email={session.email!} role={session.role!} />
        <main className="flex-1 px-8 py-8 max-w-[1400px] w-full mx-auto">{children}</main>
        <footer className="px-8 py-4 text-[11px] text-muted-foreground/70 flex justify-between">
          <span>Rally Ad · Screencaps</span>
          <Link href="https://github.com" className="hover:text-muted-foreground">v2</Link>
        </footer>
      </div>
    </div>
  );
}
