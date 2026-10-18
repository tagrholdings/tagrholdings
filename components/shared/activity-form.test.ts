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

  it("fires a reminder at the default hour when a date is set without a time", () => {
    const input = toNewActivity(activityFormDefaults({ subject: "Call", dueDate: "2026-11-02", dueTime: "", notify: true }));
    expect(input.notify).toBe(true);
    expect(input.dueDate?.getHours()).toBe(9);
    expect(input.dueDate?.getMinutes()).toBe(0);
  });

  it("keeps a date-only activity at midnight when no reminder is asked for", () => {
    const input = toNewActivity(activityFormDefaults({ subject: "Call", dueDate: "2026-11-02", dueTime: "", notify: false }));
    expect(input.dueDate?.getHours()).toBe(0);
  });

  it("uses the picked time for the reminder when there is one", () => {
    const input = toNewActivity(activityFormDefaults({ subject: "Call", dueDate: "2026-11-02", dueTime: "14:30", notify: true }));
    expect(input.dueDate?.getHours()).toBe(14);
  });
});
