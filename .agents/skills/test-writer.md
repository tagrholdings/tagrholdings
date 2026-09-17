# Skill: Testing Writer

Use this skill whenever the request involves generating unit tests for Services or Actions.

## Coverage priority

1. **Service** — where business logic lives, so it's the main unit-testing target.
2. **Repository** — specifically test tenant isolation: a query with `tenantId` A should never return data from `tenantId` B.
3. **Action** — lighter testing, focused on confirming Zod validation rejects malformed input and that the result matches the expected standardized shape; the business rule itself was already tested at the Service level.

## Structure (example: pipeline.service)

```ts
// modules/pipeline/pipeline.service.test.ts
import { describe, it, expect, vi } from "vitest";
import { pipelineService } from "./pipeline.service";
import { pipelineRepository } from "./pipeline.repository";

vi.mock("./pipeline.repository");

describe("pipelineService.moveStage", () => {
  it("allows a valid transition", async () => {
    vi.mocked(pipelineRepository.findById).mockResolvedValue({ id: "1", stage: "planned" } as any);
    await pipelineService.moveStage("tenant-a", "1", "in_progress");
    expect(pipelineRepository.updateStage).toHaveBeenCalledWith("tenant-a", "1", "in_progress");
  });

  it("rejects an invalid transition", async () => {
    vi.mocked(pipelineRepository.findById).mockResolvedValue({ id: "1", stage: "complete" } as any);
    await expect(pipelineService.moveStage("tenant-a", "1", "defined")).rejects.toThrow();
  });

  it("never returns another tenant's item", async () => {
    vi.mocked(pipelineRepository.findById).mockResolvedValue(undefined); // simulates the tenant filter working
    await expect(pipelineService.moveStage("tenant-b", "1", "planned")).rejects.toThrow("not found");
  });
});
```

## Rules

- Every Service test that involves a record `id` has at least one case testing tenant isolation (passing a `tenantId` different from the record's owner and confirming it fails as "not found", not as a permission error that reveals the record exists).
- The Repository is mocked in Service tests — Service tests never touch a real database.
- Repository tests (when they exist, for more complex queries) run against a real test database or an ephemeral Postgres — don't mock Drizzle at that level, or the test won't catch a real `where`-clause bug.
