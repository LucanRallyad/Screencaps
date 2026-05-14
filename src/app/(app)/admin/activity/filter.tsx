"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useState, useTransition } from "react";

export function ActivityFilter({ active, emails }: { active: string; emails: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(active);
  const [pending, start] = useTransition();

  function apply(v: string) {
    setValue(v);
    start(() => {
      const params = new URLSearchParams();
      if (v.trim()) params.set("email", v.trim());
      router.push(`/admin/activity${params.size ? `?${params.toString()}` : ""}`);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") apply(value); }}
        placeholder="Filter by email…"
        list="known-emails"
        className="max-w-xs"
      />
      <datalist id="known-emails">
        {emails.map((e) => <option key={e} value={e} />)}
      </datalist>
      <button
        onClick={() => apply("")}
        className={`text-xs ${active ? "text-muted-foreground hover:text-foreground" : "opacity-0 pointer-events-none"}`}
      >
        Clear
      </button>
      {pending && <span className="text-xs text-muted-foreground">Loading…</span>}
    </div>
  );
}
