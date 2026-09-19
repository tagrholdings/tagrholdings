import { describe, expect, it } from "vitest";
import { paginate } from "./pagination";

const list = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginate", () => {
  it("slices the requested page and reports the range shown", () => {
    const p = paginate(list(34), 2, 10);
    expect(p.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(p).toMatchObject({ page: 2, pageCount: 4, total: 34, from: 11, to: 20 });
  });

  it("the last page is partial", () => {
    const p = paginate(list(34), 4, 10);
    expect(p.items).toEqual([31, 32, 33, 34]);
    expect(p).toMatchObject({ from: 31, to: 34 });
  });

  it("a list that fits on one page is a single page", () => {
    expect(paginate(list(8), 1, 10)).toMatchObject({ page: 1, pageCount: 1, from: 1, to: 8 });
    expect(paginate(list(10), 1, 10)).toMatchObject({ pageCount: 1 }); // exactly one full page, not two
    expect(paginate(list(11), 1, 10)).toMatchObject({ pageCount: 2 });
  });

  it("an empty list is one empty page (0–0 of 0)", () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
  });

  it("clamps an out-of-range page — e.g. after dismissing the only lead on the last page", () => {
    expect(paginate(list(10), 2, 10)).toMatchObject({ page: 1, items: list(10) });
    expect(paginate(list(34), 99, 10)).toMatchObject({ page: 4 });
    expect(paginate(list(34), 0, 10)).toMatchObject({ page: 1 });
    expect(paginate(list(34), -3, 10)).toMatchObject({ page: 1 });
    expect(paginate(list(34), Number.NaN, 10)).toMatchObject({ page: 1 });
  });

  it("does not mutate its input", () => {
    const input = list(25);
    paginate(input, 2, 10);
    expect(input).toEqual(list(25));
  });
});
