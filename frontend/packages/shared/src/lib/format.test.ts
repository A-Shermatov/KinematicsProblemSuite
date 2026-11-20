import { describe, expect, it } from "vitest";
import { formatSource, plural } from "./format";

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

describe("formatSource", () => {
  const empty = { source_type: null, source_title: null, source_year: null, source_number: null };

  it("returns null without source", () => {
    expect(formatSource(empty)).toBeNull();
  });

  it("joins title, year and number", () => {
    expect(
      formatSource({ source_type: "book", source_title: "Рымкевич", source_year: 2019, source_number: "123" }),
    ).toBe("Рымкевич, 2019, №123");
  });

  it("describes own tasks without a title", () => {
    expect(formatSource({ ...empty, source_type: "own" })).toBe("Авторская задача");
  });
});
