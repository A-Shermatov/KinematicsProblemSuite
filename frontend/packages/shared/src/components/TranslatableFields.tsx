import { useState, type ReactNode } from "react";
import { api, type TaskTranslations, type TranslationLang } from "../api";
import { errorText, useAsync } from "../lib/hooks";
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
  onUploadImage?: (file: File) => Promise<string>;
}

const filled = (value?: { title: string; condition: string }) => !!value && (!!value.title.trim() || !!value.condition.trim());

/**
 * Название и условие задачи на нескольких языках. Русский — основной и обязательный;
 * пустой перевод — ученики с этим языком увидят русский вариант.
 */
export function TranslatableFields({ title, condition, translations, onChange, conditionPlaceholder, titlePlaceholder, aside, asideClassName, rows, onUploadImage }: Props) {
  const [lang, setLang] = useState<Lang>("ru");
  const current = lang === "ru" ? null : (translations[lang] ?? { title: "", condition: "" });
  const setTranslation = (patch: Partial<{ title: string; condition: string }>) =>
    onChange({ translations: { ...translations, [lang]: { ...current!, ...patch } } });
  const { data: caps } = useAsync(() => api.imports.capabilities().catch(() => null), []);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  // Откуда переводить: на вкладке перевода — с русского; на русской — с заполненного перевода.
  const sourceLang: Lang | null =
    lang !== "ru" ? (title.trim() || condition.trim() ? "ru" : null) : ((["en", "tg"] as TranslationLang[]).find((code) => filled(translations[code])) ?? null);
  const autoTranslate = async () => {
    if (!sourceLang) return;
    const from = sourceLang === "ru" ? { title, condition } : translations[sourceLang as TranslationLang]!;
    const target = lang === "ru" ? { title, condition } : current!;
    if ((target.title.trim() || target.condition.trim()) && !window.confirm(t("Заменить текущий текст переводом?"))) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const result = await api.imports.translate({ source: sourceLang, target: lang, title: from.title, condition: from.condition });
      if (lang === "ru") onChange({ title: result.title, condition: result.condition });
      else setTranslation({ title: result.title, condition: result.condition });
    } catch (err) {
      setTranslateError(errorText(err));
    } finally {
      setTranslating(false);
    }
  };
  const langLabel = (code: Lang) => LANGS.find((item) => item.code === code)?.label ?? code;

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
        {caps?.ai_enabled && sourceLang && (
          <button
            type="button"
            onClick={autoTranslate}
            disabled={translating}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg hover:border-primary hover:text-primary disabled:opacity-60"
            title={t("ИИ переведёт название и условие, формулы и рисунки останутся как есть")}
          >
            {translating ? "⏳" : "🌐"} {t("Перевести с языка {0}", [langLabel(sourceLang)])}
          </button>
        )}
      </div>
      {translateError && <p className="text-xs text-danger">{translateError}</p>}
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
        <MarkdownEditor key={lang} label={t("Условие")} value={current.condition} onChange={(value) => setTranslation({ condition: value })} placeholder={condition} rows={rows} onUploadImage={onUploadImage} />
      ) : (
        <MarkdownEditor label={t("Условие")} value={condition} onChange={(value) => onChange({ condition: value })} placeholder={conditionPlaceholder} rows={rows} onUploadImage={onUploadImage} />
      )}
    </div>
  );
}

/** Убирает пустые переводы перед отправкой. */
export function cleanTranslations(translations: TaskTranslations): TaskTranslations {
  return Object.fromEntries(Object.entries(translations).filter(([, value]) => filled(value))) as TaskTranslations;
}
