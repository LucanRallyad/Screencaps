/**
 * Background worker process. Run separately from the web server:
 *   npm run worker
 *
 * In production this is a separate container/process.
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { getBoss, QUEUE_CAPTURE, type CaptureJobData } from "@/lib/queue/boss";
import { captureTarget, closeBrowser, type AdAsset } from "@/lib/screenshot/engine";
import { db } from "@/lib/db/client";
import { ads, projects, screenshots, targets, users } from "@/lib/db/schema";
import { sendProjectCompleteEmail } from "@/lib/email/send";

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? "2");

async function main() {
  console.log(`[worker] starting (concurrency=${concurrency})`);
  const boss = await getBoss();
  await boss.createQueue(QUEUE_CAPTURE).catch(() => {});

  await boss.work<CaptureJobData>(QUEUE_CAPTURE, { batchSize: concurrency }, async (jobs) => {
    for (const job of jobs) {
      await processJob(job.data, job.id);
    }
  });

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function shutdown() {
  console.log("[worker] shutting down...");
  await closeBrowser();
  process.exit(0);
}

async function processJob(data: CaptureJobData, jobId: string) {
  const { projectId, targetId, url, device } = data;
  console.log(`[worker] ${jobId} ${device} ${url}`);

  // Verify project not stopped/deleted
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.status === "stopped") {
    console.log(`[worker] ${jobId} skipped (project status=${project?.status ?? "missing"})`);
    return;
  }

  await db.update(targets)
    .set({ status: "processing", startedAt: new Date(), errorMessage: null })
    .where(eq(targets.id, targetId));

  if (project.status === "queued") {
    await db.update(projects).set({ status: "processing", updatedAt: new Date() }).where(eq(projects.id, projectId));
  }

  // Load creatives for this project
  const adRows = await db.select().from(ads).where(eq(ads.projectId, projectId));
  const adAssets: AdAsset[] = adRows.map((a) => ({
    id: a.id, width: a.width, height: a.height, storagePath: a.storagePath, mimeType: a.mimeType,
  }));

  const result = await captureTarget({
    projectId, targetId, url, device, ads: adAssets,
    followInternalLinks: project.followInternalLinks,
  });

  if (result.status === "unreachable" || result.status === "failed") {
    await db.update(targets)
      .set({
        status: result.status === "unreachable" ? "unreachable" : "failed",
        errorMessage: result.error,
        completedAt: new Date(),
      })
      .where(eq(targets.id, targetId));
  } else if (result.status === "no_ad_slots") {
    // Save the reference screenshots (if any) and mark
    for (const s of result.screenshots) {
      await db.insert(screenshots).values({
        targetId, viewport: s.viewport, pageUrl: s.pageUrl,
        storagePath: s.storagePath, width: s.width, height: s.height,
        adsOnPage: 0, order: s.order,
      });
    }
    await db.update(targets)
      .set({
        status: "no_ad_slots",
        adSlotsFound: 0,
        adsReplaced: 0,
        completedAt: new Date(),
        metadata: { popupsDismissed: result.popupsDismissed },
      })
      .where(eq(targets.id, targetId));
  } else {
    for (const s of result.screenshots) {
      await db.insert(screenshots).values({
        targetId, viewport: s.viewport, pageUrl: s.pageUrl,
        storagePath: s.storagePath, width: s.width, height: s.height,
        adsOnPage: s.adsOnPage, order: s.order,
      });
    }
    // Final per-target status: combine both viewports later — but here we mark this device done.
    await db.update(targets)
      .set({
        status: "completed",
        adSlotsFound: result.adSlotsFound,
        adsReplaced: result.adsReplaced,
        completedAt: new Date(),
        metadata: {
          popupsDismissed: result.popupsDismissed,
          internalLinksVisited: result.internalLinksVisited,
          uniqueAdSizes: result.uniqueAdSizes,
        },
      })
      .where(eq(targets.id, targetId));
  }

  // Update project status if all targets completed (or settled)
  await maybeCompleteProject(projectId);
}

async function maybeCompleteProject(projectId: string) {
  const targetRows = await db
    .select({ status: targets.status })
    .from(targets)
    .where(eq(targets.projectId, projectId));

  if (targetRows.length === 0) return;
  const pending = targetRows.some((r) => r.status === "pending" || r.status === "processing");
  if (pending) return;

  const allFailed = targetRows.every((r) => r.status === "failed" || r.status === "unreachable");
  const finalStatus = allFailed ? "failed" : "completed";

  await db
    .update(projects)
    .set({ status: finalStatus, updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  // Send completion email to the project owner
  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return;

    const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, project.ownerUserId)).limit(1);
    if (!owner?.email) return;

    const [{ shotCount }] = await db
      .select({ shotCount: sql<number>`count(*)::int` })
      .from(screenshots)
      .where(sql`${screenshots.targetId} in (select id from targets where project_id = ${projectId})`);

    const counts = {
      completed:  targetRows.filter((r) => r.status === "completed").length,
      noAdSlots:  targetRows.filter((r) => r.status === "no_ad_slots").length,
      unreachable: targetRows.filter((r) => r.status === "unreachable").length,
      failed:     targetRows.filter((r) => r.status === "failed").length,
    };

    await sendProjectCompleteEmail(owner.email, {
      brand: project.brand,
      campaign: project.campaign,
      projectId: project.id,
      total: targetRows.length,
      screenshots: shotCount,
      ...counts,
    });
  } catch (err) {
    // Email failure should never crash the worker
    console.error("[worker] completion email failed:", (err as Error).message);
  }
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
