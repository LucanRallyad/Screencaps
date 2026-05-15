import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { db } from "@/lib/db/client";
import { screenshots, targets, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const [row] = await db
    .select({ shot: screenshots, project: projects })
    .from(screenshots)
    .innerJoin(targets, eq(targets.id, screenshots.targetId))
    .innerJoin(projects, eq(projects.id, targets.projectId))
    .where(eq(screenshots.id, id))
    .limit(1);

  if (!row) return new NextResponse("Not found", { status: 404 });
  if (row.project.ownerUserId !== session.userId && session.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const buf = await fs.readFile(row.shot.storagePath);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
