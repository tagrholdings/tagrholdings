import { UserFacingError } from "@/lib/errors";
import { leadsRepository } from "./leads.repository";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { organizationsService } from "@/modules/organizations/organizations.service";
import { contactsService } from "@/modules/contacts/contacts.service";
import { evaluateFit } from "@/modules/search-profiles/fit";
import type { ExtractedFields } from "./leads.schema";
import type { RawLeadSummary } from "./leads.types";

/** Scraped values are untrusted — only http(s) URLs may reach an <a href> (see createOrganizationSchema). */
function safeWebsite(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function clean(value: string | null | undefined, max: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** A readable summary of what the engine knew, kept on the new lead's notes so nothing is lost on promotion. */
function buildNotes(fields: ExtractedFields, sourceUrl: string | null) {
  const lines: string[] = [];
  if (fields.summary) lines.push(fields.summary);
  const facts: [string, string | null | undefined][] = [
    ["Asking price", fields.askingPrice],
    ["Est. revenue", fields.estimatedRevenue],
    ["Reason for selling", fields.reasonForSelling],
    ["Employees", fields.employees],
    ["Years in business", fields.yearsInBusiness],
    ["Phone", fields.contact?.phone],
    ["Email", fields.contact?.email],
    ["Address", fields.location?.address],
  ];
  for (const [label, value] of facts) if (value) lines.push(`${label}: ${value}`);
  if (fields.signals?.length) lines.push(`Signals: ${fields.signals.join(", ")}`);
  if (fields.note) lines.push(`Note: ${fields.note}`);
  if (sourceUrl) lines.push(`Source: ${sourceUrl}`);
  return lines.join("\n").slice(0, 10_000) || undefined;
}

export const leadsService = {
  /** The inbox list, each lead annotated with how it fits its profile's criteria (computed here, so editing criteria re-scores everything). */
  async listForTenant(tenantId: string): Promise<RawLeadSummary[]> {
    const rows = await leadsRepository.findAllForTenant(tenantId);
    return rows.map(({ searchProfileCriteria, ...row }) => ({ ...row, fit: evaluateFit(searchProfileCriteria, row.extractedFields) }));
  },

  async getById(tenantId: string, id: string) {
    const lead = await leadsRepository.findById(tenantId, id);
    if (!lead) {
      throw new UserFacingError("Lead not found.");
    }
    return lead;
  },

  /** Unreviewed leads — the Leads Inbox badge. */
  async countNew(tenantId: string) {
    return leadsRepository.countByStatus(tenantId, "new");
  },

  /** Dismiss only archives: the row stays as history and the engine's dedupe key keeps it from coming back. */
  async dismiss(tenantId: string, id: string) {
    const moved = await leadsRepository.transition(tenantId, id, "new", "dismissed");
    if (!moved) {
      throw new UserFacingError("This lead was already handled.");
    }
  },

  async restore(tenantId: string, id: string) {
    const moved = await leadsRepository.transition(tenantId, id, "dismissed", "new");
    if (!moved) {
      throw new UserFacingError("Only dismissed leads can be restored.");
    }
  },

  /**
   * "Add to pipeline": turns a raw lead into a card on the system Leads board
   * (+ its organization and, when the engine found one, a contact). Goes
   * through the other modules' Services — creation logic isn't duplicated here.
   *
   * The status flip happens FIRST, as a conditional update, so two clicks (or
   * two tabs) can't both promote the same lead; if anything after it fails
   * the lead goes back to "new" so the user can retry.
   */
  async promote(tenantId: string, id: string, overrides: { title?: string } = {}) {
    const lead = await this.getById(tenantId, id);

    const claimed = await leadsRepository.transition(tenantId, id, "new", "processed");
    if (!claimed) {
      throw new UserFacingError("This lead was already handled.");
    }

    try {
      const fields = lead.extractedFields ?? {};
      const businessName = clean(fields.businessName, 200) ?? clean(lead.businessName, 200) ?? "Unnamed business";

      const board = await pipelineService.ensureDefaultBoard(tenantId);
      const organization = await organizationsService.create(tenantId, {
        name: businessName,
        website: safeWebsite(fields.website),
      });

      const contactInfo = fields.contact;
      const contact =
        contactInfo && (contactInfo.name || contactInfo.email || contactInfo.phone)
          ? await contactsService.create(tenantId, {
              name: clean(contactInfo.name, 200) ?? `${businessName} — main contact`.slice(0, 200),
              email: clean(contactInfo.email, 254),
              phone: clean(contactInfo.phone, 50),
              organizationId: organization.id,
            })
          : null;

      const item = await pipelineService.create(tenantId, {
        boardId: board.id,
        title: overrides.title ?? businessName,
        stage: board.columns[0]?.id ?? "sourced",
        organizationId: organization.id,
        contactId: contact?.id,
        notes: buildNotes(fields, lead.sourceUrl),
      });

      await leadsRepository.linkPipelineItem(tenantId, id, item.id);
      return item;
    } catch (error) {
      await leadsRepository.transition(tenantId, id, "processed", "new").catch(() => undefined);
      throw error;
    }
  },
};
