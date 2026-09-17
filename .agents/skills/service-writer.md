# Skill: Service Layer Writer

Use this skill whenever the request involves implementing a business rule or an operation that decides "what's allowed to happen."

## Checklist before writing a Service method

1. Does it take `tenantId` as its first parameter? Every public method of a domain Service does.
2. Does it fetch the record via the Repository (which already filters by tenant) before acting on it? Never assume a received `id` belongs to the right tenant without checking.
3. Are the business rules explicit as `if`/`throw`, not hidden inside a complex Repository query?

## Structure

```ts
// modules/pipeline/pipeline.service.ts
import { pipelineRepository } from "./pipeline.repository";
import { contactsRepository } from "@/modules/contacts/contacts.repository";

const VALID_TRANSITIONS: Record<string, string[]> = {
  defined: ["planned"],
  planned: ["in_progress"],
  in_progress: ["at_risk", "complete"],
  at_risk: ["in_progress", "complete"],
  complete: ["implemented"],
  implemented: [],
};

export const pipelineService = {
  async moveStage(tenantId: string, itemId: string, newStage: string) {
    const item = await pipelineRepository.findById(tenantId, itemId);
    if (!item) throw new Error("Item not found");

    const allowed = VALID_TRANSITIONS[item.stage] ?? [];
    if (!allowed.includes(newStage)) {
      throw new Error(`Can't move from "${item.stage}" to "${newStage}"`);
    }

    await pipelineRepository.updateStage(tenantId, itemId, newStage);
  },

  async createFromLead(tenantId: string, leadId: string, contactId: string) {
    // orchestrates another module when needed — the Service can do this, the Repository cannot
    const contact = await contactsRepository.findById(tenantId, contactId);
    if (!contact) throw new Error("Contact not found");

    return pipelineRepository.create(tenantId, {
      title: `New lead: ${contact.organizationName ?? contact.name}`,
      stage: "defined",
      contactId,
    });
  },
};
```

## Rules

- Error messages (`throw new Error(...)`) should be readable by the end user — they're what the Action eventually surfaces via `safe-action` to the error toast. Avoid technical messages like "constraint violation".
- A Service can call other modules' Repositories (that's orchestration, and it's allowed), but **never** calls another module's Service directly, to avoid circular dependencies — if the orchestration gets complex enough to need another Service's logic, reconsider whether that logic should live one level up (in an Action that calls both Services in sequence).
- Test each Service in isolation (see `test-writer.md`) passing different tenantIds to confirm isolation actually works — not just testing the "happy path" business rule.
