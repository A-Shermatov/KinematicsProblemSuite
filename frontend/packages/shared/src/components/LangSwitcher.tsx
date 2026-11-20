import { useRef, useState } from "react";
import { LANGS, getLang, setLang, t } from "../i18n";
import { useClickOutside } from "../lib/hooks";
import { cx } from "./ui";

/** Переключатель языка интерфейса. Смена языка перезагружает страницу. */
export function LangSwitcher() {
  const current = getLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const active = LANGS.find((item) => item.code === current)!;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center justify-center rounded-xl px-2 text-xs font-semibold tracking-wide text-muted hover:bg-surface-2 hover:text-fg"
        aria-label={t("Язык: {0}. Сменить язык", [active.label])}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        🌐 {active.short}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-40 rounded-xl border border-border bg-surface p-1 shadow-card">
          {LANGS.map((item) => (
            <button
              key={item.code}
              role="menuitemradio"
              aria-checked={current === item.code}
              lang={item.code}
              onClick={() => (item.code === current ? setOpen(false) : setLang(item.code))}
              className={cx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                current === item.code ? "bg-primary-soft text-primary" : "text-fg hover:bg-surface-2",
              )}
            >
              <span className="w-6 text-xs font-semibold text-muted">{item.short}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Плашка «условие пока только на русском», если для языка интерфейса нет перевода. */
export function UntranslatedNote({ lang }: { lang: string }) {
  if (getLang() === "ru" || lang === getLang()) return null;
  return <p className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-muted">🌐 {t("Перевода условия пока нет — показан русский вариант")}</p>;
}
