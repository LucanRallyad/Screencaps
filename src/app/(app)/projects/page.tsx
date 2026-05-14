import { db } from "@/lib/db/client";
import { projects, targets } from "@/lib/db/schema";
import { eq, desc, sql, and, isNull, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { purgeExpiredDeletedProjects } from "@/lib/actions/projects";
import { ProjectsGrid } from "./projects-grid";

export default async function ProjectsPage() {
  const me = await requireUser();

  await purgeExpiredDeletedProjects(me.userId).catch(() => {});

  const activeProjects = await db
    .select({
      id: projects.id,
      brand: projects.brand,
      campaign: projects.campaign,
      status: projects.status,
      createdAt: projects.createdAt,
      total: sql<number>`(select count(*) from ${targets} where ${targets.projectId} = ${projects.id})::int`,
      done:  sql<number>`(select count(*) from ${targets} where ${targets.projectId} = ${projects.id} and ${targets.status} = 'completed')::int`,
    })
    .from(projects)
    .where(and(eq(projects.ownerUserId, me.userId), isNull(projects.archivedAt), isNull(projects.deletedAt)))
    .orderBy(desc(projects.createdAt));

  const deletedProjects = await db
    .select({
      id: projects.id,
      brand: projects.brand,
      campaign: projects.campaign,
      deletedAt: projects.deletedAt,
    })
    .from(projects)
    .where(and(eq(projects.ownerUserId, me.userId), isNotNull(projects.deletedAt)))
    .orderBy(desc(projects.deletedAt));

  return (
    <ProjectsGrid
      projects={activeProjects}
      deleted={deletedProjects as { id: string; brand: string; campaign: string; deletedAt: Date }[]}
    />
  );
}
