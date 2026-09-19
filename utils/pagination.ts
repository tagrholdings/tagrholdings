export interface PageSlice<T> {
  /** The items on the current page. */
  items: T[];
  /** The page actually shown, 1-based — `page` clamped into range (a list that shrank never leaves you on an empty page). */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based position of the first / last item shown (0 / 0 for an empty list) — "Showing 11–20 of 34". */
  from: number;
  to: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): PageSlice<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}
