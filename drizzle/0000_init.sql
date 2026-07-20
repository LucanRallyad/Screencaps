CREATE TYPE "public"."project_status" AS ENUM('draft', 'queued', 'processing', 'completed', 'failed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."target_status" AS ENUM('pending', 'processing', 'completed', 'no_ad_slots', 'unreachable', 'failed');--> statement-breakpoint
CREATE TYPE "public"."viewport" AS ENUM('desktop', 'mobile');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" text,
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32),
	"target_id" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_domains" (
	"domain" text PRIMARY KEY NOT NULL,
	"source" varchar(16) DEFAULT 'github' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"campaign" text NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"follow_internal_links" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"viewport" "viewport" NOT NULL,
	"page_url" text NOT NULL,
	"storage_path" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"ads_on_page" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sso_tickets_used" (
	"jti" text PRIMARY KEY NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status" "target_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"ad_slots_found" integer,
	"ads_replaced" integer,
	"metadata" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_user_id" text,
	"email" text NOT NULL,
	"first_name" text,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_portal_user_id_unique" UNIQUE("portal_user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ads" ADD CONSTRAINT "ads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "targets" ADD CONSTRAINT "targets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_user_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_action_idx" ON "activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_created_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ads_project_idx" ON "ads" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ads_size_idx" ON "ads" USING btree ("width","height");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "screenshots_target_idx" ON "screenshots" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "targets_project_idx" ON "targets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "targets_status_idx" ON "targets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique" ON "users" USING btree (lower("email"));