import { describe, expect, it } from "vitest";
import { insideMath, latexInsertion } from "./LatexReference";

describe("latex insertion", () => {
  it("wraps outside formulas", () => {
    expect(latexInsertion("Скорость ", 9, "\\frac{a}{b}")).toBe("$\\frac{a}{b}$");
  });

  it("inserts raw inside $…$", () => {
    const text = "Найдите $v = ";
    expect(insideMath(text, text.length)).toBe(true);
    expect(latexInsertion(text, text.length, "\\sqrt{x}")).toBe("\\sqrt{x}");
  });

  it("ignores escaped dollars and previous paragraphs", () => {
    expect(insideMath("Цена \\$5 и ", 11)).toBe(false);
    expect(insideMath("$a\n\nновый абзац ", 15)).toBe(false);
  });
});
