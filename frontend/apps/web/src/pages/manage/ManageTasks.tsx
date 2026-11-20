import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Difficulty,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  PageHeader,
  TaskEditor,
  api,
  errorText,
  formatDateTime,
  useAsync,
  useAuth,
  useDocumentTitle,
} from "@kps/shared";

export function ManageTasks() {
  useDocumentTitle("Мои задачи");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const { data, error, loading, setData } = useAsync(
    () => api.tasks.list(isAdmin ? {} : { author_id: user?.id }),
    [user?.id, isAdmin],
  );

  const tasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? []).filter((task) => !query || `${task.title} ${task.theme_title}`.toLowerCase().includes(query));
  }, [data, search]);

  const remove = async (id: number, title: string) => {
    if (!window.confirm(`Удалить задачу «${title}»? Решения учеников сохранятся в истории.`)) return;
    try {
      await api.tasks.remove(id);
      setData((prev) => (prev ?? []).filter((task) => task.id !== id));
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  return (
    <>
      <PageHeader
        title={isAdmin ? "Все задачи" : "Мои задачи"}
        subtitle="Создавайте задачи с формулами и автопроверкой ответа"
        actions={<ButtonLink to="/manage/tasks/new">+ Новая задача</ButtonLink>}
      />
      <div className="mb-4 w-full sm:w-80">
        <Input placeholder="Поиск по названию или теме…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск" />
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && tasks.length === 0 && (
        <EmptyState title={data.length === 0 ? "Вы ещё не создали ни одной задачи" : "Ничего не найдено"}>
          {data.length === 0 && (
            <Link to="/manage/tasks/new" className="text-primary hover:underline">
              Создать первую задачу
            </Link>
          )}
        </EmptyState>
      )}
      {tasks.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {tasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <Link to={`/tasks/${task.id}`} className="font-medium text-fg hover:text-primary">
                  {task.title}
                </Link>
                <p className="text-xs text-muted">
                  {task.subject_title} → {task.theme_title}
                  {isAdmin && ` · ${task.author_name}`} · изменена {formatDateTime(task.updated_at)}
                </p>
              </div>
              <Badge tone={task.check_mode === "auto" ? "primary" : "warning"}>{task.check_mode === "auto" ? "Автопроверка" : "Вручную"}</Badge>
              <Difficulty value={task.difficulty} />
              <div className="flex gap-2">
                <ButtonLink to={`/manage/tasks/${task.id}/edit`} variant="secondary" size="sm">
                  Изменить
                </ButtonLink>
                <Button variant="danger" size="sm" onClick={() => remove(task.id, task.title)}>
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

export function TaskEditorPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  return (
    <TaskEditor
      taskId={taskId ? Number(taskId) : null}
      listPath="/manage/tasks"
      listLabel="Мои задачи"
      onSaved={(task) => navigate(`/tasks/${task.id}`)}
    />
  );
}
