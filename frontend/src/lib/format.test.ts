import { describe, expect, it } from "vitest";
import { plural } from "./format";

describe("plural", () => {
  it.each([
    [1, "задача"],
    [2, "задачи"],
    [4, "задачи"],
    [5, "задач"],
    [11, "задач"],
    [12, "задач"],
    [21, "задача"],
    [22, "задачи"],
    [111, "задач"],
  ])("%i → %s", (n, expected) => {
    expect(plural(n, ["задача", "задачи", "задач"])).toBe(expected);
  });
});
