import { useState, type FormEvent } from "react";
import { api, type AnswerType, type CheckMode, type SourceType, type TaskFull, type TaskInput } from "../api";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { Button, ButtonLink, Card, ErrorMessage, Input, Loading, PageHeader, Select, cx } from "../components/ui";
import { difficultyLabel, formatSource, sourceTypeLabel } from "../lib/format";
import { errorText, useAsync, useDocumentTitle } from "../lib/hooks";

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
  source_type: null,
  source_title: null,
  source_year: null,
  source_number: null,
};

interface TaskEditorProps {
  /** null — создание новой задачи. */
  taskId: number | null;
  /** Куда ведёт «Отмена» и хлебные крошки. */
  listPath: string;
  listLabel: string;
  onSaved: (task: TaskFull) => void;
}

/** Форма создания и редактирования задачи — общая для кабинета учителя и админ-панели. */
export function TaskEditor({ taskId, listPath, listLabel, onSaved }: TaskEditorProps) {
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
        source_type: task.source_type,
        source_title: task.source_title,
        source_year: task.source_year,
        source_number: task.source_number,
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
      onSaved(saved);
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
        breadcrumbs={[{ label: listLabel, to: listPath }, { label: taskId ? form.title || "Задача" : "Новая" }]}
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
          <div>
            <h2 className="font-semibold text-fg">Источник</h2>
            <p className="text-sm text-muted">Необязательно. Ученики увидят, откуда взята задача.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <Select
              label="Тип"
              value={form.source_type ?? ""}
              onChange={(e) => set("source_type", (e.target.value || null) as SourceType | null)}
            >
              <option value="">Не указан</option>
              {(Object.keys(sourceTypeLabel) as SourceType[]).map((type) => (
                <option key={type} value={type}>
                  {sourceTypeLabel[type]}
                </option>
              ))}
            </Select>
            {form.source_type && (
              <Input
                label={form.source_type === "own" ? "Название (необязательно)" : "Название"}
                value={form.source_title ?? ""}
                onChange={(e) => set("source_title", e.target.value || null)}
                required={form.source_type !== "own"}
                maxLength={200}
                placeholder={
                  form.source_type === "book"
                    ? "Рымкевич. Задачник по физике 10–11"
                    : form.source_type === "olympiad"
                      ? "Республиканская олимпиада, финал"
                      : form.source_type === "exam"
                        ? "Вступительный тест ЦТТ"
                        : "Мой сборник"
                }
              />
            )}
          </div>
          {form.source_type && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Год"
                type="number"
                min={1800}
                max={2100}
                value={form.source_year ?? ""}
                onChange={(e) => set("source_year", e.target.value ? Number(e.target.value) : null)}
              />
              <Input
                label="Номер задачи"
                value={form.source_number ?? ""}
                onChange={(e) => set("source_number", e.target.value || null)}
                maxLength={30}
                placeholder="123 или 5.14"
              />
            </div>
          )}
          {formatSource(form) && <p className="text-sm text-muted">Будет показано: «Источник: {formatSource(form)}»</p>}
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
          <ButtonLink to={listPath} variant="ghost">
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
