/** Where a pipeline item lives: leads on /leads, everything else on its project tab. */
export function pipelineItemHref(item: { id: string; boardId: string; boardIsSystem: boolean }) {
  return item.boardIsSystem ? `/leads?item=${item.id}` : `/pipeline?board=${item.boardId}&item=${item.id}`;
}
