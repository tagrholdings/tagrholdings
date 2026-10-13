ALTER TABLE "activities" DROP COLUMN "assigned_to_user_id";--> statement-breakpoint
ALTER TABLE "traction_issues" DROP COLUMN "raised_by_user_id";--> statement-breakpoint
ALTER TABLE "traction_issues" DROP COLUMN "owner_user_id";--> statement-breakpoint
ALTER TABLE "traction_measurables" DROP COLUMN "owner_user_id";--> statement-breakpoint
ALTER TABLE "traction_rocks" DROP COLUMN "owner_user_id";