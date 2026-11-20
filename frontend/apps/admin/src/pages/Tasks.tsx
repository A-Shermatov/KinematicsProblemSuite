import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  formatSource,
  useAsync,
  useDocumentTitle,
} from "@kps/shared";
import { PUBLIC_URL } from "../config";

export function Tasks() {
  useDocumentTitle("Задачи");
  const [search, setSearch] = useState("");
  const { data, error, loading, setData } = useAsync(() => api.tasks.list(), []);

  const tasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? []).filter(
      (task) => !query || `${task.title} ${task.theme_title} ${task.author_name}`.toLowerCase().includes(query),
    );
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
      <PageHeader title="Задачи" subtitle={data ? `${data.length} задач на платформе` : undefined} />
      <div className="mb-4 w-full sm:w-96">
        <Input placeholder="Поиск по названию, теме или автору…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск" />
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && tasks.length === 0 && <EmptyState title="Задач не найдено" />}
      {tasks.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Задача</th>
                <th className="px-5 py-3 font-medium">Автор</th>
                <th className="px-5 py-3 font-medium">Проверка</th>
                <th className="px-5 py-3 font-medium">Изменена</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-surface-2/60">
                  <td className="px-5 py-3.5">
                    <a href={`${PUBLIC_URL}/tasks/${task.id}`} target="_blank" rel="noreferrer" className="font-medium text-fg hover:text-primary">
                      {task.title}
                    </a>
                    <p className="text-xs text-muted">
                      {task.subject_title} → {task.theme_title}
                      {formatSource(task) && ` · ${formatSource(task)}`}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-fg">{task.author_name}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={task.check_mode === "auto" ? "primary" : "warning"}>{task.check_mode === "auto" ? "Авто" : "Вручную"}</Badge>
                      <Difficulty value={task.difficulty} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-muted">{formatDateTime(task.updated_at)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2">
                      <ButtonLink to={`/tasks/${task.id}/edit`} variant="secondary" size="sm">
                        Изменить
                      </ButtonLink>
                      <Button variant="danger" size="sm" onClick={() => remove(task.id, task.title)}>
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
    </>
  );
}

export function TaskEdit() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  return <TaskEditor taskId={Number(taskId)} listPath="/tasks" listLabel="Задачи" onSaved={() => navigate("/tasks")} />;
}
