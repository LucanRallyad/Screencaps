"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2, RotateCcw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { restoreProjectAction, permanentlyDeleteProjectAction } from "@/lib/actions/projects";
import { toast } from "sonner";

type DeletedProject = {
  id: string;
  brand: string;
  campaign: string;
  deletedAt: Date;
};

function daysLeft(deletedAt: Date) {
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(30 - elapsed));
}

export function TrashSection({ projects }: { projects: DeletedProject[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div>
      <Separator className="mb-6" />
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 w-full text-left"
      >
        <Trash2 className="size-4" />
        <span className="font-medium">Recently deleted</span>
        <Badge variant="muted" className="ml-1">{projects.length}</Badge>
        <span className="text-xs ml-1">— permanently removed after 30 days</span>
        <span className="ml-auto">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {projects.map((p) => {
            const days = daysLeft(p.deletedAt);
            return (
              <Card key={p.id} className="p-4 opacity-70 hover:opacity-100 transition-opacity border-dashed">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.brand}</p>
                    <h3 className="text-sm font-medium mt-0.5 truncate">{p.campaign}</h3>
                  </div>
                  <Badge variant={days <= 3 ? "destructive" : "muted"} className="shrink-0 ml-2">
                    {days}d left
                  </Badge>
                </div>
                {days <= 3 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-warning mb-3">
                    <AlertTriangle className="size-3.5" />
                    Deleted permanently in {days} day{days === 1 ? "" : "s"}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await restoreProjectAction(p.id);
                        if ("error" in res) toast.error(res.error);
                        else { toast.success("Project restored"); router.refresh(); }
                      })
                    }
                  >
                    <RotateCcw /> Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() =>
                      start(async () => {
                        if (!confirm(`Permanently delete "${p.brand} — ${p.campaign}"? This cannot be undone.`)) return;
                        const res = await permanentlyDeleteProjectAction(p.id);
                        if ("error" in res) toast.error(res.error);
                        else { toast.success("Permanently deleted"); router.refresh(); }
                      })
                    }
                  >
                    <Trash2 /> Delete forever
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
