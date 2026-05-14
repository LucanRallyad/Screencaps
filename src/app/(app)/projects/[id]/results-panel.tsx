"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, RefreshCw, ExternalLink, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { retryTargetAction } from "@/lib/actions/projects";
import type { Target, Screenshot } from "@/lib/db/schema";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "muted"> = {
  pending: "muted",
  processing: "warning",
  completed: "success",
  no_ad_slots: "warning",
  unreachable: "destructive",
  failed: "destructive",
};

type SortKey = "default" | "status" | "url" | "ads" | "shots";

const SORT_LABELS: Record<SortKey, string> = {
  default:  "Added order",
  status:   "Status",
  url:      "URL",
  ads:      "Ads found",
  shots:    "Screenshots",
};

function sortTargets(targets: Target[], shots: Screenshot[], key: SortKey): Target[] {
  const arr = [...targets];
  const statusOrder: Record<string, number> = {
    completed: 0, no_ad_slots: 1, processing: 2, pending: 3, unreachable: 4, failed: 5,
  };
  const shotCount = (id: string) => shots.filter((s) => s.targetId === id).length;

  switch (key) {
    case "status":
      return arr.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
    case "url":
      return arr.sort((a, b) => a.url.localeCompare(b.url));
    case "ads":
      return arr.sort((a, b) => (b.adSlotsFound ?? 0) - (a.adSlotsFound ?? 0));
    case "shots":
      return arr.sort((a, b) => shotCount(b.id) - shotCount(a.id));
    default:
      return arr;
  }
}

export function ResultsPanel({
  projectId,
  targets,
  screenshots,
}: {
  projectId: string;
  targets: Target[];
  screenshots: Screenshot[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeTarget, setActiveTarget] = useState<string | null>(targets[0]?.id ?? null);
  const [activeView, setActiveView] = useState<"desktop" | "mobile">("desktop");
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const sorted = useMemo(() => sortTargets(targets, screenshots, sortKey), [targets, screenshots, sortKey]);

  if (targets.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Add URLs and run processing to see captures here.
      </Card>
    );
  }

  const active = targets.find((t) => t.id === activeTarget);
  const shotsForActive = screenshots.filter(
    (s) => s.targetId === activeTarget && s.viewport === activeView,
  ).sort((a, b) => a.order - b.order);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-5">
      {/* Target list */}
      <div className="flex flex-col gap-2">
        {/* Sort control */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">{sorted.length} URL{sorted.length === 1 ? "" : "s"}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground">
                <ArrowUpDown className="size-3" />
                Sort: {SORT_LABELS[sortKey]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <DropdownMenuItem
                  key={k}
                  onClick={() => setSortKey(k)}
                  className={sortKey === k ? "font-medium" : ""}
                >
                  {SORT_LABELS[k]}
                  {sortKey === k && <span className="ml-auto text-foreground">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Card className="p-2 max-h-[640px] overflow-y-auto">
          <ul className="divide-y divide-border">
            {sorted.map((t) => {
              const isActive = t.id === activeTarget;
              const shotCount = screenshots.filter((s) => s.targetId === t.id).length;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setActiveTarget(t.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-md transition-colors flex items-start gap-2 min-w-0 ${
                      isActive ? "bg-accent" : "hover:bg-accent/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-mono">{new URL(t.url).hostname}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t.url}</p>
                      {shotCount > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{shotCount} screenshot{shotCount === 1 ? "" : "s"}</p>
                      )}
                    </div>
                    <Badge variant={STATUS_VARIANT[t.status]} className="shrink-0">{t.status.replace("_", " ")}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Screenshot viewer */}
      <Card className="p-5">
        {active && (
          <>
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="min-w-0">
                <a
                  href={active.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium hover:underline inline-flex items-center gap-1.5 truncate"
                >
                  {new URL(active.url).hostname}
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{active.url}</p>
                {active.errorMessage && (
                  <p className="text-xs text-destructive mt-2 bg-destructive/10 border border-destructive/20 px-2 py-1 rounded">
                    {active.errorMessage}
                  </p>
                )}
                {active.adSlotsFound != null && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {active.adSlotsFound} ad slot{active.adSlotsFound === 1 ? "" : "s"} found
                    {active.adsReplaced != null ? ` · ${active.adsReplaced} replaced` : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="border border-border rounded-md p-0.5 flex bg-muted/30">
                  <button
                    onClick={() => setActiveView("desktop")}
                    className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
                      activeView === "desktop" ? "bg-background text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Monitor className="size-3.5" /> Desktop
                  </button>
                  <button
                    onClick={() => setActiveView("mobile")}
                    className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
                      activeView === "mobile" ? "bg-background text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Smartphone className="size-3.5" /> Mobile
                  </button>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await retryTargetAction(projectId, active.id);
                      router.refresh();
                    })
                  }
                >
                  <RefreshCw /> Retry
                </Button>
              </div>
            </div>

            {shotsForActive.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg py-16 text-center text-sm text-muted-foreground">
                No {activeView} captures yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
                {shotsForActive.map((s, i) => (
                  <a
                    key={s.id}
                    href={`/api/screenshots/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block border border-border rounded-lg overflow-hidden hover:border-foreground/30 transition-colors bg-secondary/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/screenshots/${s.id}`} alt={`Screenshot ${i + 1}`} className="w-full" />
                    <div className="px-3 py-2 text-xs text-muted-foreground flex items-center justify-between border-t border-border">
                      <span className="truncate font-mono">{new URL(s.pageUrl).pathname || "/"}</span>
                      <span>{s.adsOnPage} ad{s.adsOnPage === 1 ? "" : "s"} · shot {s.order + 1}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
