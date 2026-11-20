import { useRef, useState } from "react";
import { useClickOutside } from "../lib/hooks";
import { useTheme, type ThemeMode } from "../theme/ThemeContext";
import { cx } from "./ui";

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "light", label: "Светлая", icon: "☀" },
  { mode: "dark", label: "Тёмная", icon: "☾" },
  { mode: "system", label: "Как в системе", icon: "◐" },
];

export function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-muted hover:bg-surface-2 hover:text-fg"
        aria-label={`Тема: ${resolved === "dark" ? "тёмная" : "светлая"}. Сменить тему`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {resolved === "dark" ? "☾" : "☀"}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-border bg-surface p-1 shadow-card">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.mode}
              role="menuitemradio"
              aria-checked={mode === option.mode}
              onClick={() => {
                setMode(option.mode);
                setOpen(false);
              }}
              className={cx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                mode === option.mode ? "bg-primary-soft text-primary" : "text-fg hover:bg-surface-2",
              )}
            >
              <span className="w-4 text-center" aria-hidden>
                {option.icon}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
