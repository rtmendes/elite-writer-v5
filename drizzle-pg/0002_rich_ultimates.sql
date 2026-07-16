CREATE TABLE IF NOT EXISTS "user_nav_layout" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"config" jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_nav_layout_userId_unique" UNIQUE("userId")
);
