import { db } from "@/lib/db/client";
import { projects, targets, users } from "@/lib/db/schema";
import { eq, desc, sql, and, isNull, isNotNull } from "drizzle-orm";
import { requireUser, canAccessAllProjects } from "@/lib/auth/session";
import { purgeExpiredDeletedProjects } from "@/lib/actions/projects";
import { ProjectsGrid } from "./projects-grid";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const me = await requireUser();
  const { scope } = await searchParams;

  await purgeExpiredDeletedProjects(me.userId).catch(() => {});

  // Admins/managers can view everyone's projects; the "Mine" tab scopes back to
  // just their own. Regular users only ever see their own.
  const viewAll = canAccessAllProjects(me);
  const showingAll = viewAll && scope !== "mine";
  const ownerScope = eq(projects.ownerUserId, me.userId);

  const activeProjects = await db
    .select({
      id: projects.id,
      brand: projects.brand,
      campaign: projects.campaign,
      status: projects.status,
      createdAt: projects.createdAt,
      ownerUserId: projects.ownerUserId,
      ownerEmail: users.email,
      total: sql<number>`(select count(*) from ${targets} where ${targets.projectId} = ${projects.id})::int`,
      done:  sql<number>`(select count(*) from ${targets} where ${targets.projectId} = ${projects.id} and ${targets.status} = 'completed')::int`,
    })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.ownerUserId))
    .where(
      and(
        showingAll ? undefined : ownerScope,
        isNull(projects.archivedAt),
        isNull(projects.deletedAt),
      ),
    )
    .orderBy(desc(projects.createdAt));

  // Admins/managers manage all trash too; regular users only their own.
  const deletedProjects = await db
    .select({
      id: projects.id,
      brand: projects.brand,
      campaign: projects.campaign,
      deletedAt: projects.deletedAt,
    })
    .from(projects)
    .where(and(viewAll ? undefined : ownerScope, isNotNull(projects.deletedAt)))
    .orderBy(desc(projects.deletedAt));

  const projectsForGrid = activeProjects.map((p) => ({
    id: p.id,
    brand: p.brand,
    campaign: p.campaign,
    status: p.status,
    createdAt: p.createdAt,
    total: p.total,
    done: p.done,
    isOwner: p.ownerUserId === me.userId,
    ownerEmail: p.ownerEmail,
  }));

  return (
    <ProjectsGrid
      projects={projectsForGrid}
      deleted={deletedProjects as { id: string; brand: string; campaign: string; deletedAt: Date }[]}
      canViewAll={viewAll}
      canManageAny={viewAll}
      scope={showingAll ? "all" : "mine"}
    />
  );
}
