import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as tenancySchema from "@/modules/tenancy/tenancy.schema";
import * as organizationsSchema from "@/modules/organizations/organizations.schema";
import * as contactsSchema from "@/modules/contacts/contacts.schema";
import * as pipelineSchema from "@/modules/pipeline/pipeline.schema";
import * as activitiesSchema from "@/modules/activities/activities.schema";

const schema = {
  ...tenancySchema,
  ...organizationsSchema,
  ...contactsSchema,
  ...pipelineSchema,
  ...activitiesSchema,
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = drizzle(pool, { schema });
