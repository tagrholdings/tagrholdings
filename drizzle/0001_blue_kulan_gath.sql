CREATE TABLE "pipeline_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"columns" jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline_items" ADD COLUMN "board_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline_boards" ADD CONSTRAINT "pipeline_boards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_items" ADD CONSTRAINT "pipeline_items_board_id_pipeline_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."pipeline_boards"("id") ON DELETE no action ON UPDATE no action;