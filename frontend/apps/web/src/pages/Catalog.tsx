import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  Badge,
  Card,
  Difficulty,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  PageHeader,
  api,
  cx,
  difficultyLabel,
  formatSource,
  plural,
  sourceTypeLabel,
  useAsync,
  useDocumentTitle,
  type SourceType,
  type Task,
  type Theme,
} from "@kps/shared";

export function Catalog() {
  useDocumentTitle("Задачи");
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
      <PageHeader title="Каталог задач" subtitle="Выберите предмет и тему, чтобы начать решать" />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.subjects.length === 0 && <EmptyState title="Пока нет ни одного предмета" />}
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
                <p className="text-sm text-muted">Темы скоро появятся.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {themes.map((theme) => (
                    <Link key={theme.id} to={`/themes/${theme.id}`} className="group">
                      <Card className="flex h-full flex-col p-5 transition group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-lg">
                        <p className="font-semibold text-fg group-hover:text-primary">{theme.title}</p>
                        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted">{theme.description || "Без описания"}</p>
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
        aria-label={task.solved ? "Решено" : "Не решено"}
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
      {task.check_mode === "manual" && <Badge tone="warning">Проверка учителем</Badge>}
      <div className="hidden w-28 flex-col items-end gap-1 sm:flex">
        <Difficulty value={task.difficulty} />
        <span className="text-xs text-muted">{difficultyLabel[task.difficulty]}</span>
      </div>
    </Link>
  );
}

export function ThemeTasks() {
  const themeId = Number(useParams().themeId);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceType | "">("");
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
        (!source || task.source_type === source) &&
        (!query || `${task.title} ${task.source_title ?? ""}`.toLowerCase().includes(query)),
    );
  }, [data, difficulty, search, source]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? "Тема не найдена"}</ErrorMessage>;

  const solved = data.tasks.filter((task) => task.solved).length;
  return (
    <>
      <PageHeader
        title={data.theme.title}
        subtitle={data.theme.description}
        breadcrumbs={[{ label: "Каталог", to: "/catalog" }, { label: data.theme.subject_title, to: `/catalog#subject-${data.theme.subject_id}` }, { label: data.theme.title }]}
        actions={
          data.tasks.length > 0 && (
            <Badge tone={solved === data.tasks.length ? "success" : "neutral"} className="px-3 py-1 text-sm">
              Решено {solved} из {data.tasks.length}
            </Badge>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input placeholder="Поиск по названию или источнику…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск задач" />
        </div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as SourceType | "")}
          className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          aria-label="Источник"
        >
          <option value="">Любой источник</option>
          {(Object.keys(sourceTypeLabel) as SourceType[]).map((type) => (
            <option key={type} value={type}>
              {sourceTypeLabel[type]}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по сложности">
          {[null, 1, 2, 3, 4, 5].map((level) => (
            <button
              key={level ?? "all"}
              onClick={() => setDifficulty(level)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                difficulty === level ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted hover:text-fg",
              )}
            >
              {level === null ? "Все" : difficultyLabel[level]}
            </button>
          ))}
        </div>
      </div>
      {tasks.length === 0 ? (
        <EmptyState title={data.tasks.length === 0 ? "В этой теме пока нет задач" : "Ничего не найдено"} />
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
