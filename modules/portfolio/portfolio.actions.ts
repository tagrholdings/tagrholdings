"use server";

import { revalidatePath } from "next/cache";
import { platformAction } from "@/lib/safe-action";
import { portfolioService } from "./portfolio.service";
import { createTemplateItemSchema, templateItemIdSchema, updateTemplateItemSchema } from "./portfolio.types";
import { z } from "zod";

// The template lives on /admin/portfolio (outside any workspace), so the plain path is right here.
const revalidatePortfolio = () => revalidatePath("/admin/portfolio");

/** The standard Scorecard is the super admin's — platformAction, like creating workspaces. */
export const addTemplateItemAction = platformAction.schema(createTemplateItemSchema).action(async ({ parsedInput }) => {
  const item = await portfolioService.addItem(parsedInput);
  revalidatePortfolio();
  return { item };
});

export const updateTemplateItemAction = platformAction.schema(updateTemplateItemSchema).action(async ({ parsedInput }) => {
  await portfolioService.updateItem(parsedInput);
  revalidatePortfolio();
  return { success: true };
});

export const deleteTemplateItemAction = platformAction.schema(templateItemIdSchema).action(async ({ parsedInput }) => {
  await portfolioService.deleteItem(parsedInput.id);
  revalidatePortfolio();
  return { success: true };
});

export const applyTemplateToAllAction = platformAction.schema(z.object({})).action(async () => {
  const results = await portfolioService.applyToAllWorkspaces();
  revalidatePortfolio();
  return { results };
});
