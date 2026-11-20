import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function Probe() {
  const { mode, resolved, toggle, setMode } = useTheme();
  return (
    <div>
      <span data-testid="state">
        {mode}/{resolved}
      </span>
      <button onClick={toggle}>toggle</button>
      <button onClick={() => setMode("system")}>system</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("defaults to the system theme", () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("state")).toHaveTextContent("system/light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("toggles dark mode and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByText("toggle"));
    expect(screen.getByTestId("state")).toHaveTextContent("dark/dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("kps.theme")).toBe("dark");

    await user.click(screen.getByText("system"));
    expect(localStorage.getItem("kps.theme")).toBeNull();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("restores the saved theme", () => {
    localStorage.setItem("kps.theme", "dark");
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("state")).toHaveTextContent("dark/dark");
  });
});
