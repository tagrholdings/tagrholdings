ALTER TABLE "activities" ADD COLUMN "completed_at" timestamp;
--> statement-breakpoint
-- Tasks already done before this column existed: their last change is the best completion time we have.
UPDATE "activities" SET "completed_at" = "updated_at" WHERE "done" = true AND "completed_at" IS NULL;
