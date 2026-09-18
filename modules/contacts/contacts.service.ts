import { contactsRepository } from "./contacts.repository";
import type { NewContact } from "./contacts.types";

export const contactsService = {
  async listForTenant(tenantId: string) {
    return contactsRepository.findAllWithOrganization(tenantId);
  },

  async getById(tenantId: string, id: string) {
    const contact = await contactsRepository.findByIdWithOrganization(tenantId, id);
    if (!contact) {
      throw new Error("Contact not found.");
    }
    return contact;
  },

  async create(tenantId: string, data: NewContact) {
    return contactsRepository.create(tenantId, data);
  },

  async update(tenantId: string, id: string, data: Partial<NewContact>) {
    const updated = await contactsRepository.update(tenantId, id, data);
    if (!updated) {
      throw new Error("Contact not found.");
    }
    return updated;
  },
};
