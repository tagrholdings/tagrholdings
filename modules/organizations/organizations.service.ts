import { UserFacingError } from "@/lib/errors";
import { formatNoteEntry } from "@/utils/notes";
import { organizationsRepository } from "./organizations.repository";
import type { NewOrganization } from "./organizations.types";

export const organizationsService = {
  async listForTenant(tenantId: string) {
    return organizationsRepository.findAllForTenant(tenantId);
  },

  /** Created from a picker's "Create …" option — reuses a same-named org instead of duplicating it. */
  async create(tenantId: string, data: NewOrganization) {
    const existing = await organizationsRepository.findByName(tenantId, data.name);
    if (existing) return existing;
    return organizationsRepository.create(tenantId, data);
  },

  /** Adds a dated line to a company's notes without touching what is there. */
  async appendNote(tenantId: string, id: string, text: string, author: string | null, date: string) {
    const entry = formatNoteEntry(text, author, date);
    const updated = await organizationsRepository.appendNote(tenantId, id, entry);
    if (updated) return updated;
    // Nothing written: the company isn't here, or its notes are full.
    if (!(await organizationsRepository.findAllForTenant(tenantId)).some((o) => o.id === id)) throw new UserFacingError("Organization not found.");
    throw new UserFacingError("This company's notes are full (10,000 characters). Shorten them in the CRM first.");
  },

  async update(tenantId: string, id: string, data: Partial<NewOrganization>) {
    const updated = await organizationsRepository.update(tenantId, id, data);
    if (!updated) {
      throw new UserFacingError("Organization not found.");
    }
    return updated;
  },
};
