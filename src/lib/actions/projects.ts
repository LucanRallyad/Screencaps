"use server";

import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, targets, ads, screenshots } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { saveAdFile } from "@/lib/storage/files";
import { parseUrlsFromFile } from "@/lib/parse/urls";
import { startProjectRun, stopProjectRun, retryTarget } from "@/lib/queue/orchestrator";
import path from "node:path";
import fs from "node:fs/promises";

const createSchema = z.object({
  brand: z.string().min(1).max(80),
  campaign: z.string().min(1).max(120),
});

export async function createProject(formData: FormData) {
  const me = await requireUser();
  const parsed = createSchema.safeParse({
    brand: formData.get("brand"),
    campaign: formData.get("campaign"),
  });
  if (!parsed.success) return { error: "Enter a brand and campaign." };

  const [p] = await db
    .insert(projects)
    .values({ ownerUserId: me.userId, brand: parsed.data.brand, campaign: parsed.data.campaign })
    .returning({ id: projects.id });

  await logActivity({
    userId: me.userId,
    email: me.email,
    action: "project_created",
    targetType: "project",
    targetId: p.id,
    details: parsed.data,
  });

  revalidatePath("/projects");
  return { id: p.id };
}

async function ownedProject(projectId: string, userId: string) {
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, userId)))
    .limit(1);
  if (!p) throw new Error("PROJECT_NOT_FOUND");
  return p;
}

export async function uploadAdsAction(projectId: string, formData: FormData) {
  const me = await requireUser();
  await ownedProject(projectId, me.userId);

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { error: "No files received." };

  const saved: { filename: string; w: number; h: number }[] = [];
  const failed: { filename: string; reason: string }[] = [];

  for (const file of files) {
    try {
      const r = await saveAdFile(projectId, file);
      saved.push({ filename: r.filename, w: r.width, h: r.height });
    } catch (err) {
      failed.push({ filename: file.name, reason: (err as Error).message });
    }
  }

  await logActivity({
    userId: me.userId,
    email: me.email,
    action: "ads_uploaded",
    targetType: "project",
    targetId: projectId,
    details: { saved: saved.length, failed: failed.length },
  });

  revalidatePath(`/projects/${projectId}`);
  return { saved: saved.length, failed };
}

export async function deleteAdAction(projectId: string, adId: string) {
  const me = await requireUser();
  await ownedProject(projectId, me.userId);

  const [ad] = await db.select().from(ads).where(eq(ads.id, adId)).limit(1);
  if (ad && ad.projectId === projectId) {
    await fs.unlink(ad.storagePath).catch(() => {});
    await db.delete(ads).where(eq(ads.id, adId));
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function uploadTargetsAction(projectId: string, formData: FormData) {
  const me = await requireUser();
  await ownedProject(projectId, me.userId);

  const text = (formData.get("text") as string | null) ?? "";
  const file = formData.get("file");

  const urls = new Set<string>();
  for (const line of text.split(/[\s,]+/)) {
    const u = line.trim();
    if (u) urls.add(u);
  }
  if (file instanceof File && file.size > 0) {
    try {
      const parsed = await parseUrlsFromFile(file);
      parsed.forEach((u) => urls.add(u));
    } catch (e) {
      return { error: `Couldn't parse file: ${(e as Error).message}` };
    }
  }

  const cleaned: string[] = [];
  for (const u of urls) {
    try {
      const url = new URL(u.startsWith("http") ? u : `https://${u}`);
      cleaned.push(url.toString());
    } catch {
      // ignore garbage
    }
  }
  if (cleaned.length === 0) return { error: "No valid URLs found." };

  await db.insert(targets).values(cleaned.map((url) => ({ projectId, url })));

  await logActivity({
    userId: me.userId,
    email: me.email,
    action: "targets_added",
    targetType: "project",
    targetId: projectId,
    details: { count: cleaned.length },
  });

  revalidatePath(`/projects/${projectId}`);
  return { added: cleaned.length };
}

export async function clearTargetsAction(projectId: string) {
  const me = await requireUser();
  await ownedProject(projectId, me.userId);
  await db.delete(targets).where(eq(targets.projectId, projectId));
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function processProjectAction(projectId: string) {
  const me = await requireUser();
  const p = await ownedProject(projectId, me.userId);

  const [{ adCount }] = await db
    .select({ adCount: sql<number>`count(*)::int` })
    .from(ads)
    .where(eq(ads.projectId, projectId));
  const [{ targetCount }] = await db
    .select({ targetCount: sql<number>`count(*)::int` })
    .from(targets)
    .where(eq(targets.projectId, projectId));
  if (adCount === 0) return { error: "Upload at least one ad asset first." };
  if (targetCount === 0) return { error: "Add at least one target URL first." };
  if (p.status === "processing" || p.status === "queued") return { error: "This project is already running." };

  await db
    .update(projects)
    .set({ status: "queued", updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  await db
    .update(targets)
    .set({ status: "pending", errorMessage: null, startedAt: null, completedAt: null, adSlotsFound: null, adsReplaced: null })
    .where(eq(targets.projectId, projectId));

  // Clear old screenshots from disk
  const oldShots = await db
    .select()
    .from(screenshots)
    .where(inArray(screenshots.targetId, db.select({ id: targets.id }).from(targets).where(eq(targets.projectId, projectId))));
  for (const s of oldShots) await fs.unlink(s.storagePath).catch(() => {});
  if (oldShots.length > 0) {
    await db.delete(screenshots).where(inArray(screenshots.id, oldShots.map((s) => s.id)));
  }

  await startProjectRun(projectId);
  await logActivity({
    userId: me.userId,
    email: me.email,
    action: "project_processing_started",
    targetType: "project",
    targetId: projectId,
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function stopProjectAction(projectId: string) {
  const me = await requireUser();
  await ownedProject(projectId, me.userId);
  await stopProjectRun(projectId);
  await db.update(projects).set({ status: "stopped", updatedAt: new Date() }).where(eq(projects.id, projectId));
  await logActivity({
    userId: me.userId,
    email: me.email,
    action: "project_processing_stopped",
    targetType: "project",
    targetId: projectId,
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function retryTargetAction(projectId: string, targetId: string) {
  const me = await requireUser();
  await ownedProject(projectId, me.userId);
  await retryTarget(projectId, targetId);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function softDeleteProjectAction(projectId: string) {
  const me = await requireUser();
  const p = await ownedProject(projectId, me.userId);
  await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, p.id));
  await logActivity({
    userId: me.userId,
    email: me.email,
    action: "project_soft_deleted",
    targetType: "project",
    targetId: p.id,
  });
  revalidatePath("/projects");
  return { ok: true as const };
}

export async function restoreProjectAction(projectId: string) {
  const me = await requireUser();
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, me.userId)))
    .limit(1);
  if (!p) return { error: "Project not found." };
  await db
    .update(projects)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(projects.id, p.id));
  await logActivity({
    userId: me.userId,
    email: me.email,
    action: "project_restored",
    targetType: "project",
    targetId: p.id,
  });
  revalidatePath("/projects");
  return { ok: true as const };
}

async function hardDeleteProject(projectId: string) {
  const projectUploadDir = path.join(process.env.UPLOAD_DIR ?? "./uploads", "ads", projectId);
  const projectShotDir = path.join(process.env.SCREENSHOT_DIR ?? "./screenshots", projectId);
  await Promise.all([
    fs.rm(projectUploadDir, { recursive: true, force: true }),
    fs.rm(projectShotDir, { recursive: true, force: true }),
  ]);
  await db.delete(projects).where(eq(projects.id, projectId));
}

export async function permanentlyDeleteProjectAction(projectId: string) {
  const me = await requireUser();
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, me.userId)))
    .limit(1);
  if (!p) return { error: "Project not found." };
  await hardDeleteProject(p.id);
  await logActivity({
    userId: me.userId,
    email: me.email,
    action: "project_permanently_deleted",
    targetType: "project",
    targetId: p.id,
  });
  revalidatePath("/projects");
  return { ok: true as const };
}

/** Called server-side on projects page load — purges projects deleted >30 days ago. */
export async function purgeExpiredDeletedProjects(userId: string) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expired = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.ownerUserId, userId),
        sql`${projects.deletedAt} is not null`,
        sql`${projects.deletedAt} < ${cutoff}`,
      ),
    );
  for (const { id } of expired) {
    await hardDeleteProject(id).catch(() => {});
  }
}
