import { UserFacingError } from "@/lib/errors";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { tractionService } from "@/modules/traction/traction.service";
import { portfolioRepository } from "./portfolio.repository";
import type { NewTemplateItem, TemplateItemUpdate, TemplateRow } from "./portfolio.types";

function values(data: NewTemplateItem): Omit<TemplateRow, "id" | "sortOrder"> {
  return {
    name: data.name.trim(),
    cadence: data.cadence,
    unit: data.unit,
    aggregation: data.aggregation,
    goalOperator: data.goalOperator ?? null,
    goalValue: data.goalValue ?? null,
    goalValueMax: data.goalOperator === "between" ? (data.goalValueMax ?? null) : null,
  };
}

/**
 * The portfolio's standard Scorecard (the super admin's): what every company reports, so they compare side by side.
 * Each workspace keeps its own copies (tractionService.addStandardMeasurables) — editing the template never rewrites
 * a company's numbers or goals.
 */
export const portfolioService = {
  async getTemplate(): Promise<TemplateRow[]> {
    return portfolioRepository.findTemplate();
  },

  async addItem(data: NewTemplateItem) {
    const created = await portfolioRepository.insert(values(data));
    if (!created) throw new UserFacingError("The template already has a measurable with that name.");
    return created;
  },

  async updateItem(data: TemplateItemUpdate) {
    const updated = await portfolioRepository.update(data.id, values(data));
    if (!updated) throw new UserFacingError("Template measurable not found.");
  },

  async deleteItem(id: string) {
    const deleted = await portfolioRepository.delete(id);
    if (!deleted) throw new UserFacingError("Template measurable not found.");
  },

  /** Copies the template's missing measurables into every active workspace. Returns how many each one got. */
  async applyToAllWorkspaces() {
    const template = await this.getTemplate();
    if (template.length === 0) throw new UserFacingError("The standard Scorecard is empty. Add a measurable first.");
    const results = [];
    for (const tenant of await tenancyService.listTenants()) {
      results.push({ name: tenant.name, added: await tractionService.addStandardMeasurables(tenant.id, template) });
    }
    return results;
  },

  /** For the Portfolio page: every active workspace's latest value of each standard measurable. */
  async getStandardComparison(): Promise<{ template: TemplateRow[]; rows: { tenantId: string; slug: string; name: string; numbers: Awaited<ReturnType<typeof tractionService.getStandardNumbers>> }[] }> {
    const template = await this.getTemplate();
    if (template.length === 0) return { template, rows: [] };
    const tenants = await tenancyService.listTenants();
    // One workspace at a time through its own RLS scope (inside getStandardNumbers) — never one query across tenants.
    const rows = await Promise.all(tenants.map(async (t) => ({ tenantId: t.id, slug: t.slug, name: t.name, numbers: await tractionService.getStandardNumbers(t.id, template) })));
    return { template, rows };
  },
};
