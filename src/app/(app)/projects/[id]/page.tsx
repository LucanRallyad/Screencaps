import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { projects, ads, targets, screenshots } from "@/lib/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { requireUser, canAccessAllProjects } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Download } from "lucide-react";
import { AdsPanel } from "./ads-panel";
import { TargetsPanel } from "./targets-panel";
import { RunControls } from "./run-controls";
import { ResultsPanel } from "./results-panel";
import { ProjectStatusPolling } from "./status-poll";
import { EtaDisplay } from "./eta-display";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "muted"> = {
  draft: "muted",
  queued: "warning",
  processing: "warning",
  completed: "success",
  failed: "destructive",
  stopped: "muted",
};

const SETTLED = ["completed", "no_ad_slots", "unreachable", "failed"] as const;

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();

  // Owners always; admins/managers have full access to any project.
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) notFound();
  const isOwner = project.ownerUserId === me.userId;
  const canManage = isOwner || canAccessAllProjects(me);
  if (!canManage) notFound();
  // Only a plain (non-privileged) non-owner would be read-only — which can't
  // happen today since only admins/managers besides the owner reach this page.
  const readOnly = !canManage;

  const adRows = await db.select().from(ads).where(eq(ads.projectId, id)).orderBy(asc(ads.createdAt));
  const targetRows = await db.select().from(targets).where(eq(targets.projectId, id)).orderBy(asc(targets.createdAt));

  const targetIds = targetRows.map((t) => t.id);
  const allShots = targetIds.length
    ? await db
        .select()
        .from(screenshots)
        .where(targetIds.length === 1 ? eq(screenshots.targetId, targetIds[0]) : inArray(screenshots.targetId, targetIds))
    : [];

  const isRunning = project.status === "processing" || project.status === "queued";

  // ETA data
  const settledCount = targetRows.filter((t) => (SETTLED as readonly string[]).includes(t.status)).length;
  const processStartedAt =
    targetRows
      .map((t) => t.startedAt)
      .filter(Boolean)
      .sort()[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 w-fit">
        <ChevronLeft className="size-3.5" />
        All projects
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{project.brand}</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{project.campaign}</h1>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant={STATUS_VARIANT[project.status] ?? "muted"}>{project.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {targetRows.length} URL{targetRows.length === 1 ? "" : "s"} · {adRows.length} creative{adRows.length === 1 ? "" : "s"}
            </span>
            <EtaDisplay
              total={targetRows.length}
              settled={settledCount}
              startedAt={processStartedAt?.toISOString() ?? null}
              isRunning={isRunning}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {readOnly && (
            <Badge variant="muted" title="You can view this project but not edit it">
              Read-only
            </Badge>
          )}
          <Button asChild variant="secondary">
            <a href={`/api/projects/${project.id}/download`}>
              <Download /> Download ZIP
            </a>
          </Button>
          {/* Running a capture mutates the project — owner only. */}
          {!readOnly && <RunControls projectId={project.id} isRunning={isRunning} />}
        </div>
      </div>

      <ProjectStatusPolling projectId={project.id} initialStatus={project.status} />

      <Separator />

      <Tabs defaultValue="setup">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="results">
            Results
            <span className="ml-1.5 text-[10px] text-muted-foreground">{allShots.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AdsPanel projectId={project.id} ads={adRows} readOnly={readOnly} />
            <TargetsPanel projectId={project.id} targets={targetRows} readOnly={readOnly} />
          </div>
        </TabsContent>

        <TabsContent value="results">
          <ResultsPanel projectId={project.id} targets={targetRows} screenshots={allShots} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
