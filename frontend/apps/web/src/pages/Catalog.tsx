import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  Badge,
  ButtonLink,
  Card,
  Difficulty,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  PageHeader,
  api,
  cx,
  formatSource,
  plural,
  sourceTypeLabel,
  useAsync,
  useDocumentTitle,
  type SourceType,
  type Task,
  type Theme,
  t,
} from "@kps/shared";

export function Catalog() {
  useDocumentTitle(t("Задачи"));
  const location = useLocation();
  const { data, error, loading } = useAsync(async () => {
    const [subjects, themes] = await Promise.all([api.subjects.list(), api.themes.list()]);
    return { subjects, themes };
  }, []);

  useEffect(() => {
    if (data && location.hash) document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth" });
  }, [data, location.hash]);

  const themesBySubject = useMemo(() => {
    const map = new Map<number, Theme[]>();
    for (const theme of data?.themes ?? []) map.set(theme.subject_id, [...(map.get(theme.subject_id) ?? []), theme]);
    return map;
  }, [data]);

  return (
    <>
      <PageHeader
        title={t("Каталог задач")}
        subtitle={t("Выберите предмет и тему, чтобы начать решать")}
        actions={
          <ButtonLink to="/sources" variant="secondary">
            📚 {t("Задачники и олимпиады")}
          </ButtonLink>
        }
      />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.subjects.length === 0 && <EmptyState title={t("Пока нет ни одного предмета")} />}
      <div className="space-y-10">
        {data?.subjects.map((subject) => {
          const themes = themesBySubject.get(subject.id) ?? [];
          return (
            <section key={subject.id} id={`subject-${subject.id}`} className="scroll-mt-24 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-fg">{subject.title}</h2>
                {subject.description && <p className="text-sm text-muted">{subject.description}</p>}
              </div>
              {themes.length === 0 ? (
                <p className="text-sm text-muted">{t("Темы скоро появятся.")}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {themes.map((theme) => (
                    <Link key={theme.id} to={`/themes/${theme.id}`} className="group">
                      <Card className="flex h-full flex-col p-5 transition group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-lg">
                        <p className="font-semibold text-fg group-hover:text-primary">{theme.title}</p>
                        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted">{theme.description || t("Без описания")}</p>
                        <p className="mt-4 text-xs font-medium text-muted">
                          {theme.tasks_count} {plural(theme.tasks_count, ["задача", "задачи", "задач"])}
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

export function TaskRow({ task, to }: { task: Task; to: string }) {
  return (
    <Link to={to} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-surface-2">
      <span
        className={cx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          task.solved ? "bg-success-soft text-success" : "bg-surface-2 text-muted",
        )}
        aria-label={task.solved ? t("Решено") : t("Не решено")}
      >
        {task.solved ? "✓" : "•"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-fg group-hover:text-primary">{task.title}</p>
        <p className="truncate text-xs text-muted">
          {task.author_name}
          {formatSource(task) && ` · ${formatSource(task)}`}
        </p>
      </div>
      {task.check_mode === "manual" && <Badge tone="warning">{t("Проверка учителем")}</Badge>}
      <div className="hidden w-16 flex-col items-end sm:flex">
        <Difficulty value={task.difficulty} />
      </div>
    </Link>
  );
}

export function ThemeTasks() {
  const themeId = Number(useParams().themeId);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  /** "" — любой, "own" — авторские, иначе id источника. */
  const [source, setSource] = useState("");
  const { data, error, loading } = useAsync(async () => {
    const [theme, tasks] = await Promise.all([api.themes.get(themeId), api.tasks.list({ theme_id: themeId })]);
    return { theme, tasks };
  }, [themeId]);
  useDocumentTitle(data?.theme.title);

  const tasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.tasks ?? []).filter(
      (task) =>
        (difficulty === null || task.difficulty === difficulty) &&
        (!source || (source === "own" ? task.is_original : String(task.source_id) === source)) &&
        (!query || `${task.title} ${task.source_title ?? ""}`.toLowerCase().includes(query)),
    );
  }, [data, difficulty, search, source]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? t("Тема не найдена")}</ErrorMessage>;

  const solved = data.tasks.filter((task) => task.solved).length;
  const levels = [...new Set(data.tasks.map((task) => task.difficulty))].sort((a, b) => a - b);
  const sources = [...new Map(data.tasks.filter((task) => task.source_id).map((task) => [task.source_id!, task])).values()].sort((a, b) =>
    (a.source_title ?? "").localeCompare(b.source_title ?? ""),
  );
  const hasOwn = data.tasks.some((task) => task.is_original);
  return (
    <>
      <PageHeader
        title={data.theme.title}
        subtitle={data.theme.description}
        breadcrumbs={[{ label: t("Каталог"), to: "/catalog" }, { label: data.theme.subject_title, to: `/catalog#subject-${data.theme.subject_id}` }, { label: data.theme.title }]}
        actions={
          data.tasks.length > 0 && (
            <Badge tone={solved === data.tasks.length ? "success" : "neutral"} className="px-3 py-1 text-sm">
              {t("Решено")} {solved}  {t("из")} {data.tasks.length}
            </Badge>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input placeholder={t("Поиск по названию или источнику…")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("Поиск задач")} />
        </div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-11 max-w-xs rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          aria-label={t("Источник")}
        >
          <option value="">{t("Любой источник")}</option>
          {hasOwn && <option value="own">{t("Авторские задачи")}</option>}
          {sources.map((task) => (
            <option key={task.source_id} value={String(task.source_id)}>
              {task.source_title}
              {task.source_year ? `, ${task.source_year}` : ""}
            </option>
          ))}
        </select>
        <select
          value={difficulty ?? ""}
          onChange={(e) => setDifficulty(e.target.value ? Number(e.target.value) : null)}
          className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          aria-label={t("Сложность")}
        >
          <option value="">{t("Любая сложность")}</option>
          {levels.map((level) => (
            <option key={level} value={level}>
              {t("Сложность")} {level}
            </option>
          ))}
        </select>
      </div>
      {tasks.length === 0 ? (
        <EmptyState title={data.tasks.length === 0 ? t("В этой теме пока нет задач") : t("Ничего не найдено")} />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} to={`/tasks/${task.id}`} />
          ))}
        </Card>
      )}
    </>
  );
}


const SOURCE_ICON: Record<SourceType, string> = { book: "📘", olympiad: "🏆", exam: "📝", own: "✍️" };

/** Каталог источников: книги, сборники, олимпиады и экзамены, из которых взяты задачи. */
export function SourcesPage() {
  useDocumentTitle(t("Задачники и олимпиады"));
  const [search, setSearch] = useState("");
  const [type, setType] = useState<SourceType | "">("");
  const { data, error, loading } = useAsync(() => api.sources.list({ type: type || undefined, limit: 500 }), [type]);
  const query = search.trim().toLowerCase();
  const sources = (data ?? []).filter(
    (source) => source.tasks_count > 0 && (!query || `${source.title} ${source.author}`.toLowerCase().includes(query)),
  );

  return (
    <>
      <PageHeader
        title={t("Задачники и олимпиады")}
        subtitle={t("Решайте задачи из конкретной книги, сборника или олимпиады")}
        breadcrumbs={[{ label: t("Каталог"), to: "/catalog" }, { label: t("Источники") }]}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80">
          <Input placeholder={t("Название или автор…")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("Поиск источников")} />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SourceType | "")}
          className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          aria-label={t("Тип")}
        >
          <option value="">{t("Все типы")}</option>
          {(Object.keys(sourceTypeLabel) as SourceType[]).map((key) => (
            <option key={key} value={key}>
              {sourceTypeLabel[key]}
            </option>
          ))}
        </select>
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && sources.length === 0 && <EmptyState icon="📚" title={t("Ничего не найдено")} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {sources.map((source) => (
          <Link key={source.id} to={`/sources/${source.id}`} className="group">
            <Card className="flex h-full gap-4 p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40">
              <span className="text-3xl" aria-hidden>
                {SOURCE_ICON[source.type]}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-fg group-hover:text-primary">{source.title}</p>
                <p className="text-sm text-muted">{[sourceTypeLabel[source.type], source.author, source.year].filter(Boolean).join(" · ")}</p>
                <p className="text-sm font-medium text-fg">
                  {source.tasks_count} {plural(source.tasks_count, ["задача", "задачи", "задач"])}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

export function SourceTasksPage() {
  const sourceId = Number(useParams().sourceId);
  const { data, error, loading } = useAsync(async () => {
    const [source, tasks] = await Promise.all([api.sources.get(sourceId), api.tasks.list({ source_id: sourceId })]);
    // Порядок как в книге: по номеру задачи, затем без номера.
    tasks.sort((a, b) => (a.source_number ?? "~").localeCompare(b.source_number ?? "~", undefined, { numeric: true }));
    return { source, tasks };
  }, [sourceId]);
  useDocumentTitle(data?.source.title);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? t("Источник не найден")}</ErrorMessage>;
  const { source, tasks } = data;
  const solved = tasks.filter((task) => task.solved).length;
  return (
    <>
      <PageHeader
        title={`${SOURCE_ICON[source.type]} ${source.title}`}
        subtitle={[sourceTypeLabel[source.type], source.author, source.year].filter(Boolean).join(" · ")}
        breadcrumbs={[{ label: t("Каталог"), to: "/catalog" }, { label: t("Источники"), to: "/sources" }, { label: source.title }]}
        actions={
          tasks.length > 0 && (
            <Badge tone={solved === tasks.length ? "success" : "neutral"} className="px-3 py-1 text-sm">
              {t("Решено")} {solved} {t("из")} {tasks.length}
            </Badge>
          )
        }
      />
      {tasks.length === 0 ? (
        <EmptyState title={t("Задач из этого источника пока нет")} />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} to={`/tasks/${task.id}`} />
          ))}
        </Card>
      )}
    </>
  );
}
