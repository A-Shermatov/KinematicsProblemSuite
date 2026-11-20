import { useRef, useState } from "react";
import { useClickOutside } from "../lib/hooks";
import { useTheme, type ThemeMode } from "../theme/ThemeContext";
import { cx } from "./ui";
import { t } from "../i18n";

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "light", label: t("Светлая"), icon: "☀" },
  { mode: "dark", label: t("Тёмная"), icon: "☾" },
  { mode: "system", label: t("Как в системе"), icon: "◐" },
];

/** placement="top" — меню открывается вверх (кнопка внизу экрана, как в сайдбаре админки). */
export function ThemeToggle({ placement = "bottom" }: { placement?: "top" | "bottom" }) {
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
        aria-label={t("Тема: {0}. Сменить тему", [resolved === "dark" ? t("тёмная") : t("светлая")])}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {resolved === "dark" ? "☾" : "☀"}
      </button>
      {open && (
        <div role="menu" className={cx("absolute right-0 z-30 w-48 rounded-xl border border-border bg-surface p-1 shadow-card", placement === "top" ? "bottom-full mb-2" : "top-full mt-2")}>
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
