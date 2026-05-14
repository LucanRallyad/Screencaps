import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { targets, projects } from "@/lib/db/schema";
import { getBoss, QUEUE_CAPTURE, type CaptureJobData } from "./boss";

export async function startProjectRun(projectId: string) {
  const boss = await getBoss();
  await boss.createQueue(QUEUE_CAPTURE).catch(() => {});

  const rows = await db.select().from(targets).where(eq(targets.projectId, projectId));

  // Enqueue both desktop and mobile per target
  for (const t of rows) {
    for (const device of ["desktop", "mobile"] as const) {
      const data: CaptureJobData = { projectId, targetId: t.id, url: t.url, device };
      await boss.send(QUEUE_CAPTURE, data, {
        singletonKey: `${t.id}:${device}`,
        retryLimit: 1,
        expireInMinutes: 8,
      });
    }
  }
}

export async function stopProjectRun(projectId: string) {
  const boss = await getBoss();
  // pg-boss doesn't have a "cancel by metadata" — easiest is to mark all in-flight target rows
  // back to pending and let the worker check project status before working.
  const queueJobs = await boss.fetch(QUEUE_CAPTURE, { batchSize: 1000, includeMetadata: true }).catch(() => []);
  // Re-publishing is unsafe; instead just rely on the worker checking project status.
  await db
    .update(targets)
    .set({ status: "pending" })
    .where(and(eq(targets.projectId, projectId), eq(targets.status, "processing")));
  void queueJobs; // nothing to do — worker will short-circuit
}

export async function retryTarget(projectId: string, targetId: string) {
  const boss = await getBoss();
  await boss.createQueue(QUEUE_CAPTURE).catch(() => {});

  const [t] = await db
    .select()
    .from(targets)
    .where(and(eq(targets.id, targetId), eq(targets.projectId, projectId)))
    .limit(1);
  if (!t) return;

  await db
    .update(targets)
    .set({ status: "pending", errorMessage: null, startedAt: null, completedAt: null })
    .where(eq(targets.id, targetId));

  // Ensure project is in a runnable state
  await db.update(projects).set({ status: "processing", updatedAt: new Date() }).where(eq(projects.id, projectId));

  for (const device of ["desktop", "mobile"] as const) {
    const data: CaptureJobData = { projectId, targetId, url: t.url, device };
    await boss.send(QUEUE_CAPTURE, data, {
      singletonKey: `${targetId}:${device}:retry:${Date.now()}`,
      retryLimit: 1,
      expireInMinutes: 8,
    });
  }
}
