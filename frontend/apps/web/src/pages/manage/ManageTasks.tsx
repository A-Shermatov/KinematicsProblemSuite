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
  t,
  Pagination,
  usePaged,
} from "@kps/shared";

export function ManageTasks() {
  useDocumentTitle(t("Мои задачи"));
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const { data, error, loading, setData } = useAsync(
    () => api.tasks.list(isAdmin ? { limit: 1000 } : { author_id: user?.id, limit: 1000 }),
    [user?.id, isAdmin],
  );

  const tasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? []).filter((task) => !query || `${task.title} ${task.theme_title}`.toLowerCase().includes(query));
  }, [data, search]);
  const paged = usePaged(tasks, 25, search);

  const remove = async (id: number, title: string) => {
    if (!window.confirm(t("Удалить задачу «{0}»? Решения учеников сохранятся в истории.", [title]))) return;
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
        title={isAdmin ? t("Все задачи") : t("Мои задачи")}
        subtitle={t("Создавайте задачи с формулами и автопроверкой ответа")}
        actions={
          <>
            <ButtonLink to="/manage/collections" variant="secondary">
              🗂 {t("Подборки")}
            </ButtonLink>
            <ButtonLink to="/manage/tasks/import" variant="secondary">
              📥 {t("Импорт")}
            </ButtonLink>
            <ButtonLink to="/manage/tasks/new">{t("+ Новая задача")}</ButtonLink>
          </>
        }
      />
      <div className="mb-4 w-full sm:w-80">
        <Input placeholder={t("Поиск по названию или теме…")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("Поиск")} />
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && tasks.length === 0 && (
        <EmptyState title={data.length === 0 ? t("Вы ещё не создали ни одной задачи") : t("Ничего не найдено")}>
          {data.length === 0 && (
            <Link to="/manage/tasks/new" className="text-primary hover:underline">
              {t("Создать первую задачу")}
            </Link>
          )}
        </EmptyState>
      )}
      {tasks.length > 0 && (
        <>
          <Card className="divide-y divide-border overflow-hidden">
            {paged.pageItems.map((task) => (
              <div key={task.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Link to={`/tasks/${task.id}`} className="font-medium text-fg hover:text-primary">
                    {task.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {task.subject_title} → {task.theme_title}
                    {isAdmin && ` · ${task.author_name}`}  {t("· изменена")} {formatDateTime(task.updated_at)}
                  </p>
                </div>
                <Badge tone={task.check_mode === "auto" ? "primary" : "warning"}>{task.check_mode === "auto" ? t("Автопроверка") : t("Вручную")}</Badge>
                <Difficulty value={task.difficulty} />
                <div className="flex gap-2">
                  <ButtonLink to={`/manage/tasks/${task.id}/edit`} variant="secondary" size="sm">
                    {t("Изменить")}
                  </ButtonLink>
                  <Button variant="danger" size="sm" onClick={() => remove(task.id, task.title)}>
                    {t("Удалить")}
                  </Button>
                </div>
              </div>
            ))}
          </Card>
          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} total={paged.total} />
        </>
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
      listLabel={t("Мои задачи")}
      onSaved={(task) => navigate(`/tasks/${task.id}`)}
    />
  );
}
