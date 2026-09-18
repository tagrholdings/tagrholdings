ALTER TABLE "activities" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "assigned_to_user_id" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "assigned_to_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_assigned_to_contact_id_contacts_id_fk" FOREIGN KEY ("assigned_to_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;