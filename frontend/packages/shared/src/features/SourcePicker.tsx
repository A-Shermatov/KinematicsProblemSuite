import { useEffect, useRef, useState } from "react";
import { api, type Source, type SourceInput, type SourceType } from "../api";
import { Badge, Button, ErrorMessage, Input, Select, cx } from "../components/ui";
import { t } from "../i18n";
import { plural, sourceTypeLabel } from "../lib/format";
import { errorText, useClickOutside } from "../lib/hooks";

/** Источник, выбранный в редакторе задачи (полный объект из каталога или то, что пришло с задачей). */
export type PickedSource = Pick<Source, "id" | "type" | "title" | "author" | "year">;

export function sourceMeta(source: Pick<Source, "type" | "author" | "year">): string {
  return [sourceTypeLabel[source.type], source.author, source.year].filter(Boolean).join(" · ");
}

const EMPTY_SOURCE: SourceInput = { type: "book", title: "", author: "", year: null };

function NewSourceForm({ initialTitle, onCreated, onCancel }: { initialTitle: string; onCreated: (source: Source) => void; onCancel: () => void }) {
  const [form, setForm] = useState<SourceInput>({ ...EMPTY_SOURCE, title: initialTitle });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Не <form>: редактор задачи сам является формой, вложенные формы недопустимы.
  const save = async () => {
    if (!form.title.trim()) {
      setError(t("Укажите название"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onCreated(await api.sources.create(form));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary-soft/30 p-4">
      <p className="font-medium text-fg">{t("Новый источник в общем каталоге")}</p>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <Select label={t("Тип")} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SourceType })}>
          {(Object.keys(sourceTypeLabel) as SourceType[]).map((type) => (
            <option key={type} value={type}>
              {sourceTypeLabel[type]}
            </option>
          ))}
        </Select>
        <Input
          label={t("Название")}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          maxLength={200}
          placeholder={t("Рымкевич. Задачник по физике 10–11")}
          autoFocus
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("Автор (необязательно)")} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} maxLength={120} placeholder={t("А. П. Рымкевич")} />
        <Input
          label={t("Год (необязательно)")}
          type="number"
          min={1800}
          max={2100}
          value={form.year ?? ""}
          onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={save} loading={saving}>
          {t("Добавить и выбрать")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("Отмена")}
        </Button>
      </div>
    </div>
  );
}

/** Поиск источника в каталоге с возможностью добавить новый. */
export function SourcePicker({ value, onChange }: { value: PickedSource | null; onChange: (source: PickedSource | null) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await api.sources.list({ search: query.trim() || undefined, limit: 30 });
        if (!cancelled) setResults(found);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  if (creating) {
    return (
      <NewSourceForm
        initialTitle={query}
        onCancel={() => setCreating(false)}
        onCreated={(source) => {
          setCreating(false);
          onChange(source);
        }}
      />
    );
  }

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-4 py-3">
        <span className="text-2xl" aria-hidden>
          📚
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{value.title}</p>
          <p className="text-sm text-muted">{sourceMeta(value)}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange(null)}>
          {t("Изменить")}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <Input
        label={t("Источник из каталога")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("Начните вводить название книги или олимпиады…")}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-card" role="listbox">
          {results.map((source) => (
            <button
              key={source.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onChange(source);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{source.title}</p>
                <p className="truncate text-sm text-muted">{sourceMeta(source)}</p>
              </div>
              <Badge>
                {source.tasks_count} {plural(source.tasks_count, ["задача", "задачи", "задач"])}
              </Badge>
            </button>
          ))}
          {!loading && results.length === 0 && <p className="px-3 py-2 text-sm text-muted">{t("Ничего не найдено")}</p>}
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setOpen(false);
            }}
            className={cx("mt-1 w-full rounded-lg border-t border-border px-3 py-2.5 text-left font-medium text-primary hover:bg-primary-soft")}
          >
            + {t("Добавить новый источник")}
            {query.trim() && <span className="text-muted"> «{query.trim()}»</span>}
          </button>
        </div>
      )}
    </div>
  );
}
