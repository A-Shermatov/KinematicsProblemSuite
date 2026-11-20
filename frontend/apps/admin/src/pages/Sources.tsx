import { useState, type FormEvent } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  api,
  errorText,
  sourceMeta,
  sourceTypeLabel,
  useAsync,
  useDocumentTitle,
  type Source,
  type SourceInput,
  type SourceType,
} from "@kps/shared";
import { PUBLIC_URL } from "../config";

function SourceForm({ source, onSaved, onCancel }: { source: Source | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<SourceInput>(
    source ? { type: source.type, title: source.title, author: source.author, year: source.year } : { type: "book", title: "", author: "", year: null },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (source) await api.sources.update(source.id, form);
      else await api.sources.create(form);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="w-[min(36rem,85vw)] space-y-4 p-2">
      <h2 className="text-lg font-semibold text-fg">{source ? "Изменить источник" : "Новый источник"}</h2>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Select label="Тип" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SourceType })}>
        {(Object.keys(sourceTypeLabel) as SourceType[]).map((type) => (
          <option key={type} value={type}>
            {sourceTypeLabel[type]}
          </option>
        ))}
      </Select>
      <Input label="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Автор" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} maxLength={120} />
        <Input
          label="Год"
          type="number"
          min={1800}
          max={2100}
          value={form.year ?? ""}
          onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          Сохранить
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function MergeForm({ source, all, onDone, onCancel }: { source: Source; all: Source[]; onDone: () => void; onCancel: () => void }) {
  const others = all.filter((item) => item.id !== source.id);
  const [into, setInto] = useState<number>(others[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.sources.merge(source.id, into);
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <form onSubmit={submit} className="w-[min(36rem,85vw)] space-y-4 p-2">
      <h2 className="text-lg font-semibold text-fg">Слить дубликат</h2>
      <p className="text-sm text-muted">
        Все задачи из «{source.title}» ({source.tasks_count}) перейдут в выбранный источник, а «{source.title}» будет удалён.
      </p>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Select label="Куда перенести задачи" value={into} onChange={(e) => setInto(Number(e.target.value))}>
        {others.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
            {item.year ? `, ${item.year}` : ""} ({item.tasks_count})
          </option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Button type="submit" disabled={!into}>
          Слить
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

export function Sources() {
  useDocumentTitle("Источники");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Source | "new" | null>(null);
  const [merging, setMerging] = useState<Source | null>(null);
  const { data, error, loading, reload } = useAsync(() => api.sources.list({ limit: 500 }), []);
  const query = search.trim().toLowerCase();
  const sources = (data ?? []).filter((source) => !query || `${source.title} ${source.author}`.toLowerCase().includes(query));

  const remove = async (source: Source) => {
    const note = source.tasks_count ? ` У ${source.tasks_count} задач источник станет «не указан».` : "";
    if (!window.confirm(`Удалить «${source.title}»?${note}`)) return;
    try {
      await api.sources.remove(source.id);
      reload();
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Источники"
        subtitle="Общий каталог книг, сборников, олимпиад и экзаменов. Учителя выбирают источник из него и указывают номер задачи."
        actions={<Button onClick={() => setEditing("new")}>+ Источник</Button>}
      />
      <div className="mb-5 w-full sm:w-96">
        <Input placeholder="Поиск по названию или автору" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск" />
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && sources.length === 0 && <EmptyState icon="📚" title="Источников нет" />}
      {sources.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Тип · автор · год</th>
                <th className="px-4 py-3 text-right font-medium">Задач</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sources.map((source) => (
                <tr key={source.id}>
                  <td className="px-4 py-3 font-medium text-fg">
                    <a href={`${PUBLIC_URL}/sources/${source.id}`} target="_blank" rel="noreferrer" className="hover:text-primary">
                      {source.title}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted">{sourceMeta(source)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg">{source.tasks_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(source)}>
                        Изменить
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setMerging(source)} disabled={(data ?? []).length < 2}>
                        Слить
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove(source)}>
                        Удалить
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)}>
        {editing !== null && (
          <SourceForm
            source={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>
      <Modal open={merging !== null} onClose={() => setMerging(null)}>
        {merging && (
          <MergeForm
            source={merging}
            all={data ?? []}
            onCancel={() => setMerging(null)}
            onDone={() => {
              setMerging(null);
              reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}
