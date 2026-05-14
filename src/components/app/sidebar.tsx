"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Shield, Activity, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/projects", label: "Projects", icon: FolderKanban, role: "any" as const },
  { href: "/admin/users", label: "Users", icon: Users, role: "admin" as const },
  { href: "/admin/activity", label: "Activity", icon: Activity, role: "admin" as const },
];

export function Sidebar({ role }: { role: "admin" | "user" }) {
  const path = usePathname();
  return (
    <aside className="w-[220px] shrink-0 hidden md:flex flex-col border-r border-border bg-card/30 backdrop-blur-sm">
      <Link href="/projects" className="flex items-center gap-2 px-5 h-16 border-b border-border">
        <div className="size-6 rounded-md bg-gradient-to-br from-violet-400 via-fuchsia-400 to-rose-400 shadow-[0_0_24px_-6px_hsl(280_80%_60%/0.6)]" />
        <span className="text-sm font-semibold tracking-tight">Screencaps</span>
      </Link>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.filter((n) => n.role === "any" || n.role === role).map((n) => {
          const active = path === n.href || path.startsWith(n.href + "/");
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              <Icon className="size-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      {role === "admin" && (
        <div className="px-3 pb-4">
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground/80 border border-border rounded-md">
            <Shield className="size-3.5 text-warning" /> Admin access
          </div>
        </div>
      )}
    </aside>
  );
}
