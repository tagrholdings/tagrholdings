import { z } from "zod";
import { AGGREGATIONS, CADENCES, GOAL_OPERATORS, UNITS, type StandardMeasurable } from "@/modules/traction/traction.types";

export interface TemplateRow extends StandardMeasurable {
  id: string;
  sortOrder: number;
}

const goalIsComplete = (m: { goalOperator?: string | null; goalValue?: number | null; goalValueMax?: number | null }) =>
  m.goalOperator == null ? m.goalValue == null : m.goalValue != null && (m.goalOperator !== "between" || (m.goalValueMax != null && m.goalValueMax >= m.goalValue));

const templateFields = z.object({
  name: z.string().trim().min(1, "Name the measurable.").max(120),
  cadence: z.enum(CADENCES),
  unit: z.enum(UNITS),
  aggregation: z.enum(AGGREGATIONS),
  goalOperator: z.enum(GOAL_OPERATORS).nullish(),
  goalValue: z.number().finite().nullish(),
  goalValueMax: z.number().finite().nullish(),
});
const goalMessage = { message: "Set the comparison and its number, or no suggested goal at all.", path: ["goalValue"] };

export const createTemplateItemSchema = templateFields.refine(goalIsComplete, goalMessage);
export const updateTemplateItemSchema = templateFields.extend({ id: z.uuid() }).refine(goalIsComplete, goalMessage);
export const templateItemIdSchema = z.object({ id: z.uuid() });
export type NewTemplateItem = z.infer<typeof createTemplateItemSchema>;
export type TemplateItemUpdate = z.infer<typeof updateTemplateItemSchema>;
