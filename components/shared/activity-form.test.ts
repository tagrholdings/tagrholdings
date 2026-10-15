import { describe, expect, it } from "vitest";
import { activityFormDefaults, toNewActivity } from "./activity-form";

describe("toNewActivity", () => {
  it("saves a cleared picker as no link at all (pickers clear to an empty string)", () => {
    const input = toNewActivity(
      activityFormDefaults({ subject: "Call the seller", contactId: "", organizationId: "", pipelineItemId: "", rockId: "", assignedTo: "", priority: "" })
    );
    expect(input).toMatchObject({ subject: "Call the seller", contactId: undefined, organizationId: undefined, pipelineItemId: undefined, rockId: undefined, priority: undefined });
    expect(input.assignedToPersonId).toBeUndefined();
    expect(input.assignedToContactId).toBeUndefined();
  });

  it("keeps a picked contact and priority", () => {
    const input = toNewActivity(activityFormDefaults({ subject: "Call", contactId: "c1", priority: "high" }));
    expect(input).toMatchObject({ contactId: "c1", priority: "high" });
  });
});
