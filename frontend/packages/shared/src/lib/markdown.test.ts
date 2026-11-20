import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders basic markdown", () => {
    const html = renderMarkdown("**жирный** и *курсив*");
    expect(html).toContain("<strong>жирный</strong>");
    expect(html).toContain("<em>курсив</em>");
  });

  it("renders inline and block formulas with KaTeX", () => {
    const html = renderMarkdown("Скорость $v = s/t$\n\n$$a = \\frac{v}{t}$$");
    expect(html).toContain('class="katex"');
    expect(html).toContain("katex-display");
  });

  it("does not treat prices as formulas", () => {
    const html = renderMarkdown("Стоит $5 и $6");
    expect(html).not.toContain("katex");
    expect(html).toContain("$5 и $6");
  });

  it("shows invalid formulas as an error instead of crashing", () => {
    const html = renderMarkdown("Ошибка $\\frac{1}{$ тут");
    expect(html).toContain("math-error");
  });

  it("removes dangerous html", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"><script>alert(1)</script>текст');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<script");
    expect(html).toContain("текст");
  });

  it("returns empty string for blank input", () => {
    expect(renderMarkdown("   ")).toBe("");
  });
});
