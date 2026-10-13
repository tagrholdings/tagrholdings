import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";

/**
 * The workspace's team: the people who own Rocks, measurables, issues and To-Dos, and who sit in the Accountability
 * Chart's seats. A person does NOT need a login — Grounded's techs can own work before (or without) ever signing in.
 * `user_id` links a person to their Neon Auth account once they have one; teamService links it automatically when a
 * workspace member's email matches (see `syncMembers`), or an admin links it by hand.
 */
export const teamPeopleTable = pgTable(
  "team_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    name: text("name").notNull(),
    email: text("email"),
    /** Job title, free text ("Lead tech"). Their EOS seat lives in traction_seats, not here. */
    title: text("title"),
    /** Neon Auth user id, once linked. No FK possible (another schema) — teamService checks it is a member. */
    userId: text("user_id"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("team_people_tenant_id_id_unique").on(t.tenantId, t.id),
    unique("team_people_tenant_user_unique").on(t.tenantId, t.userId),
    tenantIsolationPolicy("team_people"),
  ]
);
