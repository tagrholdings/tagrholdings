CREATE TABLE "slack_sent_claims" (
	"key" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slack_user_links" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "slack_user_links" ADD COLUMN "remind_dm" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "slack_user_links" ADD COLUMN "l10_dm" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "slack_user_links" ADD COLUMN "digest_dm" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "slack_user_links" ADD COLUMN "weekly_dm" boolean DEFAULT true NOT NULL;