import type { BoardColumn } from "@/modules/pipeline/pipeline.schema";

export interface PipelineItemRow {
  id: string;
  boardId: string;
  title: string;
  stage: string;
  notes: string | null;
  contactId: string | null;
  contactName: string | null;
  organizationId: string | null;
  organizationName: string | null;
}

/**
 * A tenant-wide pipeline item (see `pipelineService.listAllForTenant`) —
 * every `PipelineItemRow` field plus which board it's on. A superset, so it
 * satisfies `PipelineItemRow` wherever that's expected (`PipelineItemDetail`,
 * `ActivityLookups.pipelineItems`, a contact's or organization's linked
 * leads/projects) without conversion.
 */
export interface PipelineItemSummary extends PipelineItemRow {
  boardName: string;
  boardIsSystem: boolean;
}

export interface PipelineBoardRow {
  id: string;
  name: string;
  columns: BoardColumn[];
  isSystem: boolean;
  archivedAt: string | Date | null;
}

/** Linked activities for one item — rendered as "done/total" on cards and list rows. */
export interface ActivityProgress {
  done: number;
  total: number;
}

export type { BoardColumn };
