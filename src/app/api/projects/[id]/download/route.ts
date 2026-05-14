import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough } from "node:stream";
import fs from "node:fs";
import { db } from "@/lib/db/client";
import { projects, screenshots, targets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerUserId, session.userId)))
    .limit(1);
  if (!project) return new NextResponse("Not found", { status: 404 });

  // Only include screenshots from successfully captured targets
  const rows = await db
    .select({ shot: screenshots, url: targets.url, targetId: targets.id })
    .from(screenshots)
    .innerJoin(targets, eq(targets.id, screenshots.targetId))
    .where(and(eq(targets.projectId, id), eq(targets.status, "completed")))
    .orderBy(targets.createdAt, screenshots.viewport, screenshots.order);

  if (rows.length === 0) {
    return new NextResponse(
      "No successful captures yet — run the project and wait for targets to complete.",
      { status: 404 },
    );
  }

  const zipName = `${slugify(project.brand)}-${slugify(project.campaign)}.zip`;

  const passthrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(passthrough);

  // Track per-target per-viewport screenshot index for clean sequential names
  const counters: Record<string, number> = {};

  for (const { shot, url } of rows) {
    if (!fs.existsSync(shot.storagePath)) continue;

    const host = (() => {
      try {
        const u = new URL(url);
        // Use hostname + first path segment if present, to differentiate subpages
        const seg = u.pathname.split("/").filter(Boolean)[0];
        return seg ? `${u.hostname}/${seg}` : u.hostname;
      } catch {
        return "site";
      }
    })();

    // Clean hostname for use as folder name (no dots cause issues on some OSes)
    const folder = host.replace(/[^a-zA-Z0-9._/-]/g, "_");
    const viewportFolder = shot.viewport; // "desktop" or "mobile"
    const counterKey = `${shot.targetId}:${shot.viewport}`;
    counters[counterKey] = (counters[counterKey] ?? 0) + 1;
    const idx = counters[counterKey];

    // Final path: hostname[/first-path-seg]/desktop|mobile/screenshot-N.png
    const entryName = `${folder}/${viewportFolder}/screenshot-${idx}.png`;
    archive.file(shot.storagePath, { name: entryName });
  }

  archive.finalize().catch((err) => passthrough.destroy(err));

  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      passthrough.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      passthrough.on("end", () => controller.close());
      passthrough.on("error", (err) => controller.error(err));
    },
    cancel() {
      archive.abort();
      passthrough.destroy();
    },
  });

  await logActivity({
    userId: session.userId,
    email: session.email,
    action: "project_downloaded",
    targetType: "project",
    targetId: project.id,
    details: { files: rows.length },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
}
