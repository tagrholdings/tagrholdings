import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { portalAccessRequestsTable } from "./portal-access.schema";

// Unscoped `db`: portal access requests are anonymous lead captures, not
// tenant data (see portal-access.schema.ts).
export const portalAccessRepository = {
  async create(token: string, email: string, name: string | undefined) {
    await db.insert(portalAccessRequestsTable).values({ token, email, name });
  },

  async findByToken(token: string) {
    return db.query.portalAccessRequestsTable.findFirst({
      where: eq(portalAccessRequestsTable.token, token),
    });
  },

  async touchLastAccessed(token: string) {
    await db
      .update(portalAccessRequestsTable)
      .set({ lastAccessedAt: new Date() })
      .where(eq(portalAccessRequestsTable.token, token));
  },
};
