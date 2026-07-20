import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  varchar,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const projectStatus = pgEnum("project_status", [
  "draft",
  "queued",
  "processing",
  "completed",
  "failed",
  "stopped",
]);
export const targetStatus = pgEnum("target_status", [
  "pending",
  "processing",
  "completed",
  "no_ad_slots",
  "unreachable",
  "failed",
]);
export const viewport = pgEnum("viewport", ["desktop", "mobile"]);

// ─── Users / Auth ────────────────────────────────────────────────────────────
//
// Identity is owned by the Internal Portal. Users arrive via an SSO ticket
// (see src/lib/auth/sso.ts); there are no local passwords, invites, or email
// verification. Each row links to a Portal user by `portalUserId` and carries
// the roles asserted by the Portal on each hand-off.

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Portal user ID this local profile is linked to (set on first SSO login).
    portalUserId: text("portal_user_id").unique(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    // Roles asserted by the Portal, e.g. ["admin","manager"]. Overwritten on
    // each SSO login — never edited locally.
    roles: jsonb("roles").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_unique").on(t.email),
    // Case-insensitive uniqueness — the SSO upsert matches by lower(email).
    emailLowerIdx: uniqueIndex("users_email_lower_unique").on(sql`lower(${t.email})`),
  }),
);

// Spent SSO ticket IDs (jti), tracked to enforce single use. A ticket's jti is
// inserted before the session is created; a duplicate insert means replay.
export const ssoTicketsUsed = pgTable("sso_tickets_used", {
  jti: text("jti").primaryKey(),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ─── Projects / Ads / Targets ────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  campaign: text("campaign").notNull(),
  status: projectStatus("status").notNull().default("draft"),
  followInternalLinks: boolean("follow_internal_links").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ads = pgTable(
  "ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index("ads_project_idx").on(t.projectId),
    sizeIdx: index("ads_size_idx").on(t.width, t.height),
  }),
);

export const targets = pgTable(
  "targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    status: targetStatus("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    adSlotsFound: integer("ad_slots_found"),
    adsReplaced: integer("ads_replaced"),
    metadata: jsonb("metadata").$type<TargetMetadata | null>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index("targets_project_idx").on(t.projectId),
    statusIdx: index("targets_status_idx").on(t.status),
  }),
);

export const screenshots = pgTable(
  "screenshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => targets.id, { onDelete: "cascade" }),
    viewport: viewport("viewport").notNull(),
    pageUrl: text("page_url").notNull(),
    storagePath: text("storage_path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    adsOnPage: integer("ads_on_page").notNull().default(0),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    targetIdx: index("screenshots_target_idx").on(t.targetId),
  }),
);

// ─── Activity logs ───────────────────────────────────────────────────────────

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userEmail: text("user_email"),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 32 }),
    targetId: text("target_id"),
    details: jsonb("details").$type<Record<string, unknown> | null>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("activity_logs_user_idx").on(t.userId),
    actionIdx: index("activity_logs_action_idx").on(t.action),
    createdIdx: index("activity_logs_created_idx").on(t.createdAt),
  }),
);

// ─── Ad Domain Blocklist ─────────────────────────────────────────────────────

export const adDomains = pgTable(
  "ad_domains",
  {
    domain: text("domain").primaryKey(),
    source: varchar("source", { length: 16 }).notNull().default("github"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  activityLogs: many(activityLogs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerUserId], references: [users.id] }),
  ads: many(ads),
  targets: many(targets),
}));

export const adsRelations = relations(ads, ({ one }) => ({
  project: one(projects, { fields: [ads.projectId], references: [projects.id] }),
}));

export const targetsRelations = relations(targets, ({ one, many }) => ({
  project: one(projects, { fields: [targets.projectId], references: [projects.id] }),
  screenshots: many(screenshots),
}));

export const screenshotsRelations = relations(screenshots, ({ one }) => ({
  target: one(targets, { fields: [screenshots.targetId], references: [targets.id] }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Ad = typeof ads.$inferSelect;
export type Target = typeof targets.$inferSelect;
export type Screenshot = typeof screenshots.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type TargetMetadata = {
  internalLinksVisited?: string[];
  popupsDismissed?: number;
  uniqueAdSizes?: string[];
  durationMs?: number;
};
