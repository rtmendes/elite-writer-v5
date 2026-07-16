-- Admin UX foundation: saved_views + media altText/contentHash.
-- Also reconciles ZimmWriter (PR #81) article columns misfiled into the retired
-- drizzle/ (MySQL) dir, never applied to Postgres. All statements idempotent.

CREATE TABLE IF NOT EXISTS "saved_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"page" varchar(60) NOT NULL,
	"name" varchar(120) NOT NULL,
	"config" jsonb NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "source" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "source_id" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "body_markdown" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "body_html" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "excerpt" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "category" varchar(200);--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "tags" jsonb;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "featured_image_url" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "featured_image_b64" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "needs_scoring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "compliance_flag" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "neuron_score" integer;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "neuron_share_url" text;--> statement-breakpoint
ALTER TABLE "generated_images" ADD COLUMN IF NOT EXISTS "altText" varchar(500);--> statement-breakpoint
ALTER TABLE "image_library" ADD COLUMN IF NOT EXISTS "altText" varchar(500);--> statement-breakpoint
ALTER TABLE "image_library" ADD COLUMN IF NOT EXISTS "contentHash" varchar(64);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_views_user_page_idx" ON "saved_views" USING btree ("userId","page");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "articles_source_source_id_uidx" ON "articles" USING btree ("source","source_id");