"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateProjectButton } from "./create-project-button";
import { Camera, ImageOff, Search, X, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { softDeleteProjectAction, restoreProjectAction, permanentlyDeleteProjectAction } from "@/lib/actions/projects";
import { toast } from "sonner";
import { relativeTime } from "@/lib/utils";

type Project = {
  id: string;
  brand: string;
  campaign: string;
  status: string;
  createdAt: Date | null;
  total: number;
  done: number;
};

type DeletedProject = {
  id: string;
  brand: string;
  campaign: string;
  deletedAt: Date;
};

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "muted"> = {
  draft: "muted",
  queued: "warning",
  processing: "warning",
  completed: "success",
  failed: "destructive",
  stopped: "muted",
};

function daysLeft(deletedAt: Date) {
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(30 - elapsed));
}

function TrashDialog({ deleted }: { deleted: DeletedProject[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Recently deleted"
        >
          <Trash2 className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recently deleted</DialogTitle>
        </DialogHeader>
        {deleted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No deleted projects.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1 mt-1">
            {deleted.map((p) => {
              const days = daysLeft(p.deletedAt);
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/60">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.brand}</p>
                    <p className="text-sm font-medium truncate">{p.campaign}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {days <= 3 ? (
                        <span className="flex items-center gap-1 text-[11px] text-destructive">
                          <AlertTriangle className="size-3" /> {days}d left
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">{days} days left</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await restoreProjectAction(p.id);
                          if ("error" in res) toast.error(res.error);
                          else { toast.success("Restored"); router.refresh(); }
                        })
                      }
                    >
                      <RotateCcw /> Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        start(async () => {
                          if (!confirm(`Permanently delete "${p.brand} — ${p.campaign}"?`)) return;
                          const res = await permanentlyDeleteProjectAction(p.id);
                          if ("error" in res) toast.error(res.error);
                          else { toast.success("Permanently deleted"); router.refresh(); }
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground pt-1">
          Projects are permanently removed 30 days after deletion.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsGrid({
  projects,
  deleted = [],
}: {
  projects: Project[];
  deleted?: DeletedProject[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pending, start] = useTransition();

  const filtered = query.trim()
    ? projects.filter((p) =>
        `${p.brand} ${p.campaign}`.toLowerCase().includes(query.toLowerCase()),
      )
    : projects;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each project bundles ad creatives with a list of target URLs.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {searchOpen ? (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="pl-8 pr-8 h-9 w-56 text-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
              <button
                onClick={() => { setSearchOpen(false); setQuery(""); }}
                className="absolute -right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Search projects"
            >
              <Search className="size-4" />
            </button>
          )}
          <TrashDialog deleted={deleted} />
          <CreateProjectButton />
        </div>
      </div>

      {projects.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <div className="size-12 rounded-full border border-border bg-secondary/40 flex items-center justify-center mb-4">
            <ImageOff className="size-5 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium">No projects yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Create your first project — pick a brand and campaign, then upload your ads and target URLs.
          </p>
          <div className="mt-5"><CreateProjectButton /></div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No projects match &ldquo;{query}&rdquo;
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="group">
              <Card className="p-5 transition-all hover:border-foreground/30 hover:shadow-md">
                <div className="flex items-start justify-between mb-3 gap-3">
                  <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.brand}</p>
                    <h3 className="text-base font-medium mt-0.5 group-hover:translate-x-px transition-transform truncate">
                      {p.campaign}
                    </h3>
                  </Link>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "muted"} className="shrink-0 mt-0.5">{p.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Link href={`/projects/${p.id}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Camera className="size-3.5" />
                    {p.done}/{p.total} captured
                  </Link>
                  <div className="flex items-center gap-2">
                    <span>{p.createdAt ? relativeTime(p.createdAt) : ""}</span>
                    <button
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Move "${p.brand} — ${p.campaign}" to trash?`)) return;
                        start(async () => {
                          const res = await softDeleteProjectAction(p.id);
                          if ("error" in res) toast.error((res as { error: string }).error);
                          else { toast.success("Moved to trash"); router.refresh(); }
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity size-6 rounded flex items-center justify-center hover:text-destructive hover:bg-destructive/10 disabled:pointer-events-none"
                      aria-label="Delete project"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
