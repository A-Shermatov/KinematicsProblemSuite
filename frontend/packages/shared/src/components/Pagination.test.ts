import { describe, expect, it } from "vitest";
import { pageNumbers } from "./Pagination";

describe("pageNumbers", () => {
  it("shows all pages when few", () => {
    expect(pageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("collapses the middle", () => {
    expect(pageNumbers(6, 20)).toEqual([1, "…", 5, 6, 7, "…", 20]);
    expect(pageNumbers(1, 20)).toEqual([1, 2, "…", 20]);
    expect(pageNumbers(20, 20)).toEqual([1, "…", 19, 20]);
  });
});
