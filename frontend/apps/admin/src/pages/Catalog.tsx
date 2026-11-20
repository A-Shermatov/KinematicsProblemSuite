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
  Textarea,
  api,
  errorText,
  plural,
  useAsync,
  useDocumentTitle,
  type Subject,
  type Theme,
} from "@kps/shared";

type Editing =
  | { kind: "subject"; item: Subject | null }
  | { kind: "theme"; item: Theme | null; subjectId: number };

function EditDialog({ editing, subjects, onClose, onSaved }: { editing: Editing; subjects: Subject[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(editing.item?.title ?? "");
  const [description, setDescription] = useState(editing.item?.description ?? "");
  const [position, setPosition] = useState(String(editing.item?.position ?? 0));
  const [subjectId, setSubjectId] = useState(editing.kind === "theme" ? (editing.item?.subject_id ?? editing.subjectId) : 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const data = { title, description, position: Number(position) || 0 };
    try {
      if (editing.kind === "subject") {
        if (editing.item) await api.admin.updateSubject(editing.item.id, data);
        else await api.admin.createSubject(data);
      } else if (editing.item) {
        await api.admin.updateTheme(editing.item.id, { ...data, subject_id: subjectId });
      } else {
        await api.admin.createTheme({ ...data, subject_id: subjectId });
      }
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const noun = editing.kind === "subject" ? "предмет" : "тему";
  return (
    <Modal open onClose={onClose} title={editing.item ? `Изменить ${noun}` : `Новый ${noun}`}>
      <form onSubmit={submit} className="w-[min(32rem,85vw)] space-y-4 p-2">
        <h2 className="text-lg font-semibold text-fg">{editing.item ? `Изменить ${noun}` : editing.kind === "subject" ? "Новый предмет" : "Новая тема"}</h2>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {editing.kind === "theme" && (
          <Select label="Предмет" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))}>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.title}
              </option>
            ))}
          </Select>
        )}
        <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={150} autoFocus />
        <Textarea label="Описание" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        <Input label="Порядок в списке" type="number" min={0} value={position} onChange={(e) => setPosition(e.target.value)} hint="Меньше — выше" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={saving}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Catalog() {
  useDocumentTitle("Каталог");
  const [editing, setEditing] = useState<Editing | null>(null);
  const { data, error, loading, reload } = useAsync(async () => {
    const [subjects, themes] = await Promise.all([api.subjects.list(), api.themes.list()]);
    return { subjects, themes };
  }, []);

  const remove = async (kind: "subject" | "theme", id: number, title: string) => {
    if (!window.confirm(`Удалить «${title}»?`)) return;
    try {
      if (kind === "subject") await api.admin.removeSubject(id);
      else await api.admin.removeTheme(id);
      reload();
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Предметы и темы"
        subtitle="Структура каталога, которую видят ученики"
        actions={<Button onClick={() => setEditing({ kind: "subject", item: null })}>+ Предмет</Button>}
      />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.subjects.length === 0 && <EmptyState title="Добавьте первый предмет" />}
      <div className="space-y-6">
        {data?.subjects.map((subject) => {
          const themes = data.themes.filter((theme) => theme.subject_id === subject.id);
          return (
            <Card key={subject.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-5 py-4">
                <div className="flex-1">
                  <p className="font-semibold text-fg">{subject.title}</p>
                  <p className="text-xs text-muted">
                    {subject.themes_count} {plural(subject.themes_count, ["тема", "темы", "тем"])}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "theme", item: null, subjectId: subject.id })}>
                  + Тема
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: "subject", item: subject })}>
                  Изменить
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove("subject", subject.id, subject.title)}>
                  Удалить
                </Button>
              </div>
              {themes.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Тем пока нет</p>
              ) : (
                <ul className="divide-y divide-border">
                  {themes.map((theme) => (
                    <li key={theme.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg">{theme.title}</p>
                        <p className="truncate text-xs text-muted">
                          {theme.tasks_count} {plural(theme.tasks_count, ["задача", "задачи", "задач"])}
                          {theme.description && ` · ${theme.description}`}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: "theme", item: theme, subjectId: subject.id })}>
                        Изменить
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove("theme", theme.id, theme.title)}>
                        Удалить
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
      {editing && data && (
        <EditDialog
          editing={editing}
          subjects={data.subjects}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
