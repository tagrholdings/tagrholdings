# Skill: Model & Schema Writer

Use this skill whenever the request involves creating or altering a table, or adjusting a module's data validation.

## Checklist before creating a new table

1. **Does it store data that belongs to a company?** If so (almost always), it has `tenantId: uuid("tenant_id").notNull().references(() => tenants.id)`. See `.agents/docs/TENANCY.md`.
2. Does it have `id` (uuid, primary key), `createdAt`, `updatedAt`? Standard on every domain table, even if the request doesn't explicitly mention it.
3. Relationships (foreign keys) point to the right table, whether within the same module or another module — Drizzle allows this even with the `modules/` separation, since schemas can reference each other across files.

## `[domain].schema.ts` file structure

```ts
// modules/pipeline/pipeline.schema.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { tenants } from "@/modules/tenancy/tenancy.schema";

export const pipelineItemsTable = pgTable("pipeline_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  stage: text("stage").notNull().default("defined"),
  contactId: uuid("contact_id"),
  organizationId: uuid("organization_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Zod generated automatically from the table — don't hand-write a parallel Zod schema
export const insertPipelineItemSchema = createInsertSchema(pipelineItemsTable);
export const selectPipelineItemSchema = createSelectSchema(pipelineItemsTable);

// Action-specific schema, when the input isn't 1:1 with the table
export const moveItemStageSchema = insertPipelineItemSchema.pick({ id: true, stage: true });
```

## Rules

- Always use `drizzle-zod` (`createInsertSchema`/`createSelectSchema`) as the base — don't duplicate field definitions by writing a `z.object({...})` from scratch that needs to be kept manually in sync with the table.
- For exported form types on fields with `.default()`, prefer `z.input<typeof schema>` over `z.infer<typeof schema>`, so the client isn't required to supply fields that have a default.
- Migrations: generate via Drizzle Kit (`drizzle-kit generate`), never hand-write migration SQL unless it's a one-off fix Drizzle Kit couldn't generate on its own.
- Pipeline stages (`stage`) and activity types are stored as free `text`, not as a rigid database enum — the project is designed for stages to be customizable per tenant in the future, so locking this into a Postgres enum would create migration rework every time a stage changes.
