import { useDeferredValue, useId, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { LatexHelpButton, LatexReference, insertLatexAt } from "./LatexReference";
import { cx } from "./ui";
import { t } from "../i18n";

type Mode = "write" | "preview" | "split";

interface Snippet {
  label: string;
  title: string;
  before: string;
  after?: string;
  placeholder?: string;
}

const SNIPPETS: Snippet[] = [
  { label: "B", title: t("Жирный"), before: "**", after: "**", placeholder: t("текст") },
  { label: "I", title: t("Курсив"), before: "*", after: "*", placeholder: t("текст") },
  { label: "x²", title: t("Формула в строке"), before: "$", after: "$", placeholder: "v = \\frac{s}{t}" },
  { label: "∑", title: t("Формула отдельной строкой"), before: "\n$$\n", after: "\n$$\n", placeholder: "a = \\frac{v - v_0}{t}" },
  { label: "•", title: t("Список"), before: "\n- ", placeholder: t("пункт") },
  { label: "1.", title: t("Нумерованный список"), before: "\n1. ", placeholder: t("пункт") },
  { label: "❝", title: t("Подсказка"), before: "\n> ", placeholder: t("подсказка") },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  /** Загрузка рисунка к условию; возвращает URL. Без неё кнопки «Рисунок» нет. */
  onUploadImage?: (file: File) => Promise<string>;
}

/** Редактор условия задачи: Markdown + LaTeX с живым предпросмотром. */
export function MarkdownEditor({ value, onChange, label, placeholder, rows = 12, onUploadImage }: Props) {
  const [mode, setMode] = useState<Mode>("split");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  // Предпросмотр отстаёт на кадр при быстром наборе — так ввод не тормозит на больших формулах.
  const deferred = useDeferredValue(value);
  const imageRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reference, setReference] = useState(false);

  const uploadImage = async (file: File) => {
    if (!onUploadImage) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await onUploadImage(file);
      insert({ label: "", title: "", before: `\n![${t("рисунок")}](${url})\n`, placeholder: "" });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (imageRef.current) imageRef.current.value = "";
    }
  };

  const insert = (snippet: Snippet) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || snippet.placeholder || "";
    const next = value.slice(0, start) + snippet.before + selected + (snippet.after ?? "") + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const cursor = start + snippet.before.length;
      textarea.setSelectionRange(cursor, cursor + selected.length);
    });
  };

  const tabs: { key: Mode; label: string }[] = [
    { key: "write", label: t("Текст") },
    { key: "preview", label: t("Предпросмотр") },
    { key: "split", label: t("Рядом") },
  ];

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-fg">
          {label}
        </label>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-surface focus-within:border-primary focus-within:ring-4 focus-within:ring-[var(--ring)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-2 py-1.5">
          <div className="flex flex-wrap gap-0.5" role="toolbar" aria-label={t("Форматирование")}>
            {SNIPPETS.map((snippet) => (
              <button
                key={snippet.title}
                type="button"
                title={snippet.title}
                aria-label={snippet.title}
                onClick={() => insert(snippet)}
                disabled={mode === "preview"}
                className="h-8 min-w-8 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface hover:text-fg disabled:opacity-40"
              >
                {snippet.label}
              </button>
            ))}
            {onUploadImage && (
              <>
                <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                <button
                  type="button"
                  title={t("Вставить рисунок (схему, график)")}
                  onClick={() => imageRef.current?.click()}
                  disabled={mode === "preview" || uploading}
                  className="h-8 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface hover:text-fg disabled:opacity-40"
                >
                  {uploading ? "…" : `🖼 ${t("Рисунок")}`}
                </button>
              </>
            )}
            <LatexHelpButton open={reference} onToggle={() => setReference((v) => !v)} className="hover:bg-surface" />
          </div>
          <div className="flex rounded-lg bg-surface p-0.5 text-xs font-medium" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={mode === tab.key}
                onClick={() => setMode(tab.key)}
                className={cx(
                  "inline-flex items-center rounded-md px-3 py-1.5 transition-colors",
                  mode === tab.key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {reference && (
          <LatexReference
            onInsert={(code) => {
              if (mode === "preview") setMode("split");
              insertLatexAt(textareaRef, value, onChange, code);
            }}
            onClose={() => {
              setReference(false);
              textareaRef.current?.focus();
            }}
          />
        )}
        <div className={cx("grid", mode === "split" && "lg:grid-cols-2")}>
          <textarea
            id={id}
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              // Ctrl+/ (⌘+/) — справочник формул.
              if ((event.ctrlKey || event.metaKey) && event.key === "/") {
                event.preventDefault();
                setReference((v) => !v);
              }
            }}
            placeholder={placeholder}
            rows={rows}
            spellCheck
            className={cx(
              "w-full resize-y bg-transparent p-4 font-mono text-sm leading-relaxed text-fg placeholder:text-muted/70 focus:outline-none",
              mode === "preview" && "hidden",
              mode === "split" && "lg:border-r lg:border-border",
            )}
          />
          <div
            data-testid="markdown-preview"
            aria-live="polite"
            className={cx(
              "min-h-40 overflow-auto p-4",
              mode === "write" && "hidden",
              mode === "split" && "border-t border-border lg:border-t-0",
            )}
          >
            <Markdown source={deferred} empty={t("Здесь появится условие задачи в том виде, в каком его увидит ученик.")} />
          </div>
        </div>
      </div>
      {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
      <p className="text-xs text-muted">
        {t("Markdown и формулы LaTeX:")} <code className="rounded bg-surface-2 px-1">$v = s/t$</code>  {t("в строке,")}{" "}
        <code className="rounded bg-surface-2 px-1">$$…$$</code>  {t("отдельным блоком.")} {t("Справочник формул — кнопка ƒx или Ctrl+/.")}
      </p>
    </div>
  );
}
