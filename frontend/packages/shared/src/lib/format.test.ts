import { describe, expect, it } from "vitest";
import { formatCountdown, formatSource, fromLocalInput, plural, toLocalInput } from "./format";

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

describe("olympiad time helpers", () => {
  it("formats countdown", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(3_723_000)).toBe("01:02:03");
    expect(formatCountdown(90_061_000)).toBe("1 д 01:01:01");
  });

  it("round-trips datetime-local values", () => {
    const iso = fromLocalInput("2030-05-01T10:30");
    expect(toLocalInput(iso)).toBe("2030-05-01T10:30");
  });
});
