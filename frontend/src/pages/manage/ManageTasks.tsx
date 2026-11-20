import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type AnswerType, type CheckMode, type TaskInput } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { Badge, Button, ButtonLink, Card, Difficulty, EmptyState, ErrorMessage, Input, Loading, PageHeader, Select, cx } from "../../components/ui";
import { difficultyLabel, formatDateTime } from "../../lib/format";
import { errorText, useAsync, useDocumentTitle } from "../../lib/hooks";

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

const EMPTY: TaskInput = {
  theme_id: 0,
  title: "",
  condition: "",
  difficulty: 2,
  check_mode: "auto",
  answer_type: "number",
  answer: "",
  unit: null,
  tolerance: 0.01,
};

export function TaskEditor() {
  const params = useParams();
  const taskId = params.taskId ? Number(params.taskId) : null;
  const navigate = useNavigate();
  useDocumentTitle(taskId ? "Редактирование задачи" : "Новая задача");

  const [form, setForm] = useState<TaskInput | null>(taskId ? null : EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: themes, error, loading } = useAsync(async () => {
    const [themeList, task] = await Promise.all([api.themes.list(), taskId ? api.tasks.getFull(taskId) : Promise.resolve(null)]);
    if (task) {
      setForm({
        theme_id: task.theme_id,
        title: task.title,
        condition: task.condition,
        difficulty: task.difficulty,
        check_mode: task.check_mode,
        answer_type: task.answer_type,
        answer: task.answer,
        unit: task.unit,
        tolerance: task.tolerance,
      });
    } else if (themeList.length > 0) {
      setForm((prev) => (prev && prev.theme_id === 0 ? { ...prev, theme_id: themeList[0].id } : prev));
    }
    return themeList;
  }, [taskId]);

  if (loading || !form) return error ? <ErrorMessage>{error}</ErrorMessage> : <Loading />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setForm({ ...form, [key]: value });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...form, unit: form.answer_type === "number" ? form.unit?.trim() || null : null };
      const saved = taskId ? await api.tasks.update(taskId, payload) : await api.tasks.create(payload);
      navigate(`/tasks/${saved.id}`);
    } catch (err) {
      setSaveError(errorText(err));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const subjects = Array.from(new Map((themes ?? []).map((t) => [t.subject_id, t.subject_title])).entries());

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={taskId ? "Редактирование задачи" : "Новая задача"}
        breadcrumbs={[{ label: "Мои задачи", to: "/manage/tasks" }, { label: taskId ? form.title || "Задача" : "Новая" }]}
      />
      <form onSubmit={submit} className="space-y-6">
        {saveError && <ErrorMessage>{saveError}</ErrorMessage>}
        <Card className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <Input label="Название" value={form.title} onChange={(e) => set("title", e.target.value)} required maxLength={150} placeholder="Например: Свободное падение камня" />
            <Select label="Тема" value={form.theme_id} onChange={(e) => set("theme_id", Number(e.target.value))} required>
              {subjects.map(([subjectId, subjectTitle]) => (
                <optgroup key={subjectId} label={subjectTitle}>
                  {(themes ?? [])
                    .filter((theme) => theme.subject_id === subjectId)
                    .map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.title}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <MarkdownEditor
            label="Условие"
            value={form.condition}
            onChange={(value) => set("condition", value)}
            placeholder={"Камень падает с высоты $h = 20$ м. Найдите время падения.\n\n$$h = \\frac{g t^2}{2}$$"}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-fg">Сложность</p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() => set("difficulty", level)}
                  className={cx(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition",
                    form.difficulty === level ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-fg",
                  )}
                >
                  {level} · {difficultyLabel[level]}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="font-semibold text-fg">Ответ и проверка</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Способ проверки" value={form.check_mode} onChange={(e) => set("check_mode", e.target.value as CheckMode)}>
              <option value="auto">Автоматически — сразу после отправки</option>
              <option value="manual">Вручную — проверяет учитель</option>
            </Select>
            <Select label="Тип ответа" value={form.answer_type} onChange={(e) => set("answer_type", e.target.value as AnswerType)}>
              <option value="number">Число (с единицами и погрешностью)</option>
              <option value="text">Текст</option>
            </Select>
          </div>
          <div className={cx("grid gap-4", form.answer_type === "number" ? "md:grid-cols-[2fr_1fr_1fr]" : "")}>
            <Input
              label={form.check_mode === "manual" ? "Эталонное решение (для учителя)" : "Правильный ответ"}
              value={form.answer}
              onChange={(e) => set("answer", e.target.value)}
              required
              className="font-mono"
              placeholder={form.answer_type === "number" ? "20 или 2e1" : "вверх | up"}
              hint={form.answer_type === "text" ? "Несколько допустимых вариантов — через «|»" : "Можно указать единицы прямо в ответе: «9.8 м/с^2»"}
            />
            {form.answer_type === "number" && (
              <>
                <Input
                  label="Единицы"
                  value={form.unit ?? ""}
                  onChange={(e) => set("unit", e.target.value || null)}
                  placeholder="м/с"
                  hint="м, км, с, ч, кг, Н, Дж…"
                />
                <Input
                  label="Погрешность, %"
                  type="number"
                  min={0}
                  max={50}
                  step={0.1}
                  value={Math.round(form.tolerance * 1000) / 10}
                  onChange={(e) => set("tolerance", Number(e.target.value) / 100)}
                />
              </>
            )}
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <ButtonLink to="/manage/tasks" variant="ghost">
            Отмена
          </ButtonLink>
          <Button type="submit" size="lg" loading={saving}>
            {taskId ? "Сохранить" : "Опубликовать задачу"}
          </Button>
        </div>
      </form>
    </div>
  );
}
