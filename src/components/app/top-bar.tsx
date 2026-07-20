"use client";
import { logoutAction } from "@/lib/auth/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, LogOut, ArrowLeft } from "lucide-react";

// Internal Portal URL (injected at build time). When set, a "Back to Portal"
// link is shown so users can hop back to the hub they launched Screencaps from.
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL?.replace(/\/$/, "");

export function TopBar({ email, role }: { email: string; role: "admin" | "user" }) {
  return (
    <div className="h-16 border-b border-border flex items-center justify-between px-8">
      {PORTAL_URL ? (
        <a
          href={PORTAL_URL}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Portal
        </a>
      ) : (
        <div />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 h-9 -mr-2 text-muted-foreground hover:text-foreground">
            <span className="text-xs text-muted-foreground">Signed in as</span>
            <span className="text-sm text-foreground">{email}</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span className="text-foreground">{email}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={logoutAction}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full text-left flex items-center gap-2 text-destructive">
                <LogOut className="size-4" />
                Sign out
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
