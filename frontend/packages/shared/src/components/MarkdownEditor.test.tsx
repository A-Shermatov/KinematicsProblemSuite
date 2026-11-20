import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MarkdownEditor } from "./MarkdownEditor";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <MarkdownEditor label="Условие" value={value} onChange={setValue} />;
}

describe("MarkdownEditor", () => {
  it("shows live preview while typing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Условие"), "Привет, **мир**");
    await waitFor(() => expect(screen.getByTestId("markdown-preview").querySelector("strong")?.textContent).toBe("мир"));
  });

  it("renders formulas in preview", async () => {
    render(<Harness initial={"$$v = \\frac{s}{t}$$"} />);
    await waitFor(() => expect(screen.getByTestId("markdown-preview").querySelector(".katex-display")).not.toBeNull());
  });

  it("inserts a formula snippet from the toolbar", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Скорость " />);
    const textarea = screen.getByLabelText<HTMLTextAreaElement>("Условие");
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await user.click(screen.getByRole("button", { name: "Формула в строке" }));
    expect(screen.getByLabelText("Условие")).toHaveValue("Скорость $v = \\frac{s}{t}$");
  });

  it("switches between text and preview modes", async () => {
    const user = userEvent.setup();
    render(<Harness initial="текст" />);
    // В тестах CSS не подключён, поэтому проверяем классы, а не реальную видимость.
    await user.click(screen.getByRole("tab", { name: "Предпросмотр" }));
    expect(screen.getByLabelText("Условие")).toHaveClass("hidden");
    expect(screen.getByTestId("markdown-preview")).not.toHaveClass("hidden");
    await user.click(screen.getByRole("tab", { name: "Текст" }));
    expect(screen.getByLabelText("Условие")).not.toHaveClass("hidden");
    expect(screen.getByTestId("markdown-preview")).toHaveClass("hidden");
  });
});
