import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  ButtonLink,
  Card,
  Difficulty,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  PageHeader,
  Textarea,
  api,
  errorText,
  plural,
  t,
  useAsync,
  useDocumentTitle,
  type Task,
} from "@kps/shared";

export function ManageCollections() {
  useDocumentTitle(t("Мои подборки"));
  const { data, error, loading } = useAsync(() => api.collections.list({ mine: true }), []);
  return (
    <>
      <PageHeader
        title={t("Мои подборки")}
        subtitle={t("Соберите задачи из разных тем и книг в тренировку для учеников")}
        breadcrumbs={[{ label: t("Мои задачи"), to: "/manage/tasks" }, { label: t("Подборки") }]}
        actions={<ButtonLink to="/manage/collections/new">{t("+ Новая подборка")}</ButtonLink>}
      />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && (
        <EmptyState icon="🗂" title={t("Подборок пока нет")}>
          <ButtonLink to="/manage/collections/new">{t("Создать подборку")}</ButtonLink>
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <Card className="divide-y divide-border">
          {data.map((collection) => (
            <div key={collection.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{collection.title}</p>
                <p className="text-sm text-muted">
                  {collection.tasks_count} {plural(collection.tasks_count, ["задача", "задачи", "задач"])}
                  {!collection.is_public && ` · ${t("скрыта")}`}
                </p>
              </div>
              <ButtonLink to={`/collections/${collection.id}`} variant="ghost" size="sm">
                {t("Открыть")}
              </ButtonLink>
              <ButtonLink to={`/manage/collections/${collection.id}/edit`} variant="secondary" size="sm">
                {t("Изменить")}
              </ButtonLink>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/** Поиск задач для добавления в подборку. */
function TaskSearch({ exclude, onAdd }: { exclude: Set<number>; onAdd: (task: Task) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await api.tasks.list({ search: query.trim(), limit: 20 });
        if (!cancelled) setResults(found);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);
  const shown = results.filter((task) => !exclude.has(task.id));
  return (
    <div className="space-y-2">
      <Input label={t("Добавить задачу")} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Название, условие или источник…")} />
      {loading && <p className="text-sm text-muted">{t("Загрузка…")}</p>}
      {shown.length > 0 && (
        <div className="max-h-72 divide-y divide-border overflow-auto rounded-xl border border-border">
          {shown.map((task) => (
            <button key={task.id} type="button" onClick={() => onAdd(task)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
              <span className="text-primary">+</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{task.title}</span>
                <span className="block truncate text-xs text-muted">
                  {task.theme_title} · {task.author_name}
                </span>
              </span>
              <Difficulty value={task.difficulty} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CollectionEditor() {
  const params = useParams();
  const collectionId = params.collectionId ? Number(params.collectionId) : null;
  const navigate = useNavigate();
  useDocumentTitle(collectionId ? t("Изменить подборку") : t("Новая подборка"));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { loading, error: loadError } = useAsync(async () => {
    if (!collectionId) return null;
    const collection = await api.collections.get(collectionId);
    setTitle(collection.title);
    setDescription(collection.description);
    setIsPublic(collection.is_public);
    setTasks(collection.tasks);
    return collection;
  }, [collectionId]);

  const move = (index: number, delta: number) => {
    const next = [...tasks];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setTasks(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { title, description, is_public: isPublic, task_ids: tasks.map((task) => task.id) };
    try {
      const saved = collectionId ? await api.collections.update(collectionId, payload) : await api.collections.create(payload);
      navigate(`/collections/${saved.id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!collectionId || !window.confirm(t("Удалить подборку? Задачи останутся на платформе."))) return;
    try {
      await api.collections.remove(collectionId);
      navigate("/manage/collections");
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (loading) return <Loading />;
  if (loadError) return <ErrorMessage>{loadError}</ErrorMessage>;
  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={collectionId ? t("Изменить подборку") : t("Новая подборка")}
        breadcrumbs={[{ label: t("Мои подборки"), to: "/manage/collections" }, { label: collectionId ? t("Изменить") : t("Новая") }]}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Card className="space-y-4 p-6">
        <Input label={t("Название")} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={150} placeholder={t("Кинематика: разминка перед олимпиадой")} />
        <Textarea label={t("Описание")} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          {t("Видна всем ученикам")}
        </label>
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="font-semibold text-fg">
          {t("Задачи")} <span className="text-sm font-normal text-muted">{tasks.length}</span>
        </h2>
        <TaskSearch exclude={new Set(tasks.map((task) => task.id))} onAdd={(task) => setTasks([...tasks, task])} />
        {tasks.length === 0 ? (
          <p className="text-sm text-muted">{t("Найдите задачи по названию и добавьте их в подборку.")}</p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border">
            {tasks.map((task, index) => (
              <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-right text-sm text-muted">{index + 1}.</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg">{task.title}</span>
                  <span className="block truncate text-xs text-muted">{task.theme_title}</span>
                </span>
                <Difficulty value={task.difficulty} />
                <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("Выше")}>
                  ↑
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={index === tasks.length - 1} onClick={() => move(index, 1)} aria-label={t("Ниже")}>
                  ↓
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setTasks(tasks.filter((item) => item.id !== task.id))} aria-label={t("Удалить")}>
                  ✕
                </Button>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        {collectionId && (
          <Button type="button" variant="danger" onClick={remove} className="mr-auto">
            {t("Удалить")}
          </Button>
        )}
        <ButtonLink to="/manage/collections" variant="ghost">
          {t("Отмена")}
        </ButtonLink>
        <Button type="submit" loading={saving}>
          {t("Сохранить")}
        </Button>
      </div>
    </form>
  );
}
