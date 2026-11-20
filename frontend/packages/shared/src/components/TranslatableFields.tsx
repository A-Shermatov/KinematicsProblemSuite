import { useState, type ReactNode } from "react";
import type { TaskTranslations, TranslationLang } from "../api";
import { LANGS, t, type Lang } from "../i18n";
import { MarkdownEditor } from "./MarkdownEditor";
import { Input, cx } from "./ui";

interface Props {
  title: string;
  condition: string;
  translations: TaskTranslations;
  onChange: (patch: { title?: string; condition?: string; translations?: TaskTranslations }) => void;
  conditionPlaceholder?: string;
  titlePlaceholder?: string;
  /** Поле рядом с названием (тема, баллы). */
  aside?: ReactNode;
  asideClassName?: string;
  rows?: number;
}

const filled = (value?: { title: string; condition: string }) => !!value && (!!value.title.trim() || !!value.condition.trim());

/**
 * Название и условие задачи на нескольких языках. Русский — основной и обязательный;
 * пустой перевод — ученики с этим языком увидят русский вариант.
 */
export function TranslatableFields({ title, condition, translations, onChange, conditionPlaceholder, titlePlaceholder, aside, asideClassName, rows }: Props) {
  const [lang, setLang] = useState<Lang>("ru");
  const current = lang === "ru" ? null : (translations[lang] ?? { title: "", condition: "" });
  const setTranslation = (patch: Partial<{ title: string; condition: string }>) =>
    onChange({ translations: { ...translations, [lang]: { ...current!, ...patch } } });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t("Язык условия")} className="flex rounded-xl border border-border bg-surface p-1 text-sm">
          {LANGS.map((item) => (
            <button
              key={item.code}
              type="button"
              role="tab"
              aria-selected={lang === item.code}
              onClick={() => setLang(item.code)}
              className={cx("flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium", lang === item.code ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
            >
              {item.label}
              {item.code !== "ru" && filled(translations[item.code as TranslationLang]) && <span aria-label={t("есть перевод")}>✓</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {lang === "ru" ? t("Русский — основной язык, обязателен") : t("Необязательно: без перевода ученики увидят русский вариант")}
        </p>
      </div>
      <div className={cx("grid gap-4", aside ? (asideClassName ?? "md:grid-cols-[2fr_1fr]") : null)}>
        {current ? (
          <Input
            key={lang}
            label={t("Название")}
            value={current.title}
            onChange={(e) => setTranslation({ title: e.target.value })}
            maxLength={150}
            placeholder={title}
          />
        ) : (
          <Input label={t("Название")} value={title} onChange={(e) => onChange({ title: e.target.value })} required maxLength={150} placeholder={titlePlaceholder} />
        )}
        {aside}
      </div>
      {current ? (
        <MarkdownEditor key={lang} label={t("Условие")} value={current.condition} onChange={(value) => setTranslation({ condition: value })} placeholder={condition} rows={rows} />
      ) : (
        <MarkdownEditor label={t("Условие")} value={condition} onChange={(value) => onChange({ condition: value })} placeholder={conditionPlaceholder} rows={rows} />
      )}
    </div>
  );
}

/** Убирает пустые переводы перед отправкой. */
export function cleanTranslations(translations: TaskTranslations): TaskTranslations {
  return Object.fromEntries(Object.entries(translations).filter(([, value]) => filled(value))) as TaskTranslations;
}
