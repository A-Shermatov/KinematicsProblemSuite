import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, type AnswerType, type CheckMode, type DuplicateHit, type TaskFull, type TaskInput } from "../api";
import { TranslatableFields, cleanTranslations } from "../components/TranslatableFields";
import { Button, ButtonLink, Card, ErrorMessage, Input, Loading, PageHeader, Select, cx } from "../components/ui";
import { formatSource } from "../lib/format";
import { SourcePicker, type PickedSource } from "./SourcePicker";
import { usePlatformSettings } from "../settings/SettingsContext";
import { errorText, useAsync, useDocumentTitle } from "../lib/hooks";
import { t } from "../i18n";

type SourceMode = "none" | "own" | "source";
const SOURCE_MODES: { key: SourceMode; label: string }[] = [
  { key: "none", label: t("Не указан") },
  { key: "own", label: t("Авторская задача") },
  { key: "source", label: t("Из книги, олимпиады, экзамена") },
];

const EMPTY: TaskInput = {
  theme_id: 0,
  title: "",
  condition: "",
  difficulty: 100,
  check_mode: "auto",
  answer_type: "number",
  answer: "",
  unit: null,
  tolerance: 0.01,
  source_id: null,
  source_number: null,
  is_original: false,
  translations: {},
};

interface TaskEditorProps {
  /** null — создание новой задачи. */
  taskId: number | null;
  /** Куда ведёт «Отмена» и хлебные крошки. */
  listPath: string;
  listLabel: string;
  onSaved: (task: TaskFull) => void;
  /** Ссылка на страницу задачи (для списка похожих задач). */
  taskUrl?: (id: number) => string;
}

/** Форма создания и редактирования задачи — общая для кабинета учителя и админ-панели. */
export function TaskEditor({ taskId, listPath, listLabel, onSaved, taskUrl = (id) => `/tasks/${id}` }: TaskEditorProps) {
  useDocumentTitle(taskId ? t("Редактирование задачи") : t("Новая задача"));
  const { settings } = usePlatformSettings();

  const [form, setForm] = useState<TaskInput | null>(taskId ? null : EMPTY);
  const [picked, setPicked] = useState<PickedSource | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>("none");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Похожие задачи, о которых предупредили; после подтверждения сохраняем без повторной проверки. */
  const [similar, setSimilar] = useState<DuplicateHit[] | null>(null);
  // Условие изменили — предупреждение о похожих задачах больше не актуально.
  useEffect(() => setSimilar(null), [form?.title, form?.condition]);

  const photoRef = useRef<HTMLInputElement>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [photoNote, setPhotoNote] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const { data: aiEnabled } = useAsync(() => api.imports.capabilities().then((c) => c.ai_enabled).catch(() => false), []);

  const { data: themes, error, loading } = useAsync(async () => {
    const [themeList, task] = await Promise.all([api.themes.list(), taskId ? api.tasks.getFull(taskId) : Promise.resolve(null)]);
    if (task) {
      if (task.source_id && task.source_type) {
        setPicked({ id: task.source_id!, type: task.source_type!, title: task.source_title ?? "", author: task.source_author ?? "", year: task.source_year });
      }
      setSourceMode(task.source_id ? "source" : task.is_original ? "own" : "none");
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
        source_id: task.source_id ?? null,
        source_number: task.source_number,
        is_original: task.is_original ?? false,
        translations: task.translations ?? {},
      });
    } else if (themeList.length > 0) {
      setForm((prev) => (prev && prev.theme_id === 0 ? { ...prev, theme_id: themeList[0].id } : prev));
    }
    return themeList;
  }, [taskId]);

  if (loading || !form) return error ? <ErrorMessage>{error}</ErrorMessage> : <Loading />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  // Уровень задачи может быть выше текущего предела (админ понизил его позже) — оставляем его в списке.
  const levels = form.difficulty > settings.difficulty_max ? [...settings.difficulty_levels, form.difficulty] : settings.difficulty_levels;
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setForm({ ...form, [key]: value });

  /** Распознать задачу с фото и заполнить форму; учитель проверяет и сохраняет сам. */
  const fillFromPhoto = async (file: File) => {
    if ((form.title || form.condition) && !window.confirm(t("Заменить название, условие и ответ распознанными с фото?"))) return;
    setRecognizing(true);
    setSaveError(null);
    setPhotoNote(null);
    try {
      const { drafts, notes } = await api.imports.parse(file);
      const draft = drafts[0];
      setForm({
        ...form,
        title: draft.title,
        condition: draft.condition,
        answer: draft.answer,
        answer_type: draft.answer_type,
        unit: draft.unit,
        difficulty: draft.difficulty && draft.difficulty <= settings.difficulty_max ? draft.difficulty : form.difficulty,
        source_number: draft.source_number ?? form.source_number,
      });
      const parts = [t("Задача распознана с фото — проверьте условие, формулы и ответ перед сохранением.")];
      if (draft.answer_is_guess) parts.push(t("Ответа на фото не было — его предложил ИИ, обязательно проверьте."));
      if (draft.duplicate) parts.push(t("Такая задача уже есть: «{0}» (№{1}, автор {2}).", [draft.duplicate.title, draft.duplicate.id, draft.duplicate.author_name]));
      if (drafts.length > 1) parts.push(t("На фото задач: {0}. Заполнена первая — чтобы добавить все сразу, воспользуйтесь импортом.", [drafts.length]));
      if (notes) parts.push(notes);
      setPhotoNote({ tone: draft.answer_is_guess || draft.duplicate || drafts.length > 1 ? "warning" : "info", text: parts.join(" ") });
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setRecognizing(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  const preview = formatSource({
    source_type: sourceMode === "own" ? "own" : sourceMode === "source" && picked ? picked.type : null,
    source_title: sourceMode === "source" ? (picked?.title ?? null) : null,
    source_year: sourceMode === "source" ? (picked?.year ?? null) : null,
    source_author: sourceMode === "source" ? picked?.author : undefined,
    source_number: sourceMode === "source" && picked ? form.source_number : null,
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sourceMode === "source" && !form.source_id) {
      setSaveError(t("Выберите источник из каталога или добавьте новый"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (similar === null) {
        const check = await api.tasks.checkDuplicates(form.title, form.condition, taskId);
        if (check.exact) {
          setSaveError(
            t("Такая задача уже есть: «{0}» (№{1}, автор {2}). Одну задачу нельзя добавить дважды.", [check.exact.title, check.exact.id, check.exact.author_name]),
          );
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (check.similar.length > 0) {
          setSimilar(check.similar);
          return;
        }
      }
      const payload = {
        ...form,
        unit: form.answer_type === "number" ? form.unit?.trim() || null : null,
        translations: cleanTranslations(form.translations),
      };
      const saved = taskId ? await api.tasks.update(taskId, payload) : await api.tasks.create(payload);
      setSimilar(null);
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
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={taskId ? t("Редактирование задачи") : t("Новая задача")}
        breadcrumbs={[{ label: listLabel, to: listPath }, { label: taskId ? form.title || t("Задача") : t("Новая") }]}
      />
      <form onSubmit={submit} className="space-y-6">
        {saveError && <ErrorMessage>{saveError}</ErrorMessage>}
        <Card className="space-y-5 p-6">
          {aiEnabled && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary-soft/30 px-4 py-3">
              <span className="text-2xl" aria-hidden>
                📷
              </span>
              <p className="min-w-[14rem] flex-1 text-sm text-fg">{t("Сфотографируйте задачу из книги — ИИ заполнит название, условие с формулами и ответ.")}</p>
              <input ref={photoRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && fillFromPhoto(e.target.files[0])} />
              <Button type="button" variant="secondary" loading={recognizing} onClick={() => photoRef.current?.click()}>
                {recognizing ? t("Распознаём…") : t("Заполнить с фото")}
              </Button>
            </div>
          )}
          {photoNote && (
            <p className={cx("rounded-xl px-4 py-3 text-sm", photoNote.tone === "warning" ? "bg-warning-soft text-fg" : "bg-success-soft text-fg")}>
              {photoNote.tone === "warning" ? "⚠️ " : "✓ "}
              {photoNote.text}
            </p>
          )}
          <TranslatableFields
            onUploadImage={api.imports.uploadImage}
            title={form.title}
            condition={form.condition}
            translations={form.translations}
            onChange={(patch) => setForm({ ...form, ...patch })}
            titlePlaceholder={t("Например: Свободное падение камня")}
            conditionPlaceholder={t("Камень падает с высоты $h = 20$ м. Найдите время падения.\n\n$$h = \\frac{g t^2}{2}$$")}
            aside={
              <Select label={t("Тема")} value={form.theme_id} onChange={(e) => set("theme_id", Number(e.target.value))} required>
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
            }
          />
          <div className="max-w-xs">
            <Select
              label={t("Сложность")}
              value={form.difficulty}
              onChange={(e) => set("difficulty", Number(e.target.value))}
              hint={t("Шкала 100–{0}, задаёт администратор", [settings.difficulty_max])}
            >
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <div>
            <h2 className="font-semibold text-fg">{t("Источник")}</h2>
            <p className="text-sm text-muted">{t("Необязательно. Ученики увидят, откуда взята задача.")}</p>
          </div>
          <div role="radiogroup" aria-label={t("Источник")} className="flex flex-wrap gap-2">
            {SOURCE_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                role="radio"
                aria-checked={sourceMode === mode.key}
                onClick={() => {
                  setSourceMode(mode.key);
                  setForm({ ...form, is_original: mode.key === "own", source_id: mode.key === "source" ? (picked?.id ?? null) : null });
                }}
                className={cx(
                  "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                  sourceMode === mode.key ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-fg",
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {sourceMode === "source" && (
            <div className="grid gap-4 lg:grid-cols-[3fr_1fr] lg:items-start">
              <SourcePicker
                value={picked}
                onChange={(source) => {
                  setPicked(source);
                  setForm({ ...form, source_id: source?.id ?? null });
                }}
              />
              <Input
                label={t("Номер задачи")}
                value={form.source_number ?? ""}
                onChange={(e) => set("source_number", e.target.value || null)}
                maxLength={30}
                placeholder={t("123 или 5.14")}
              />
            </div>
          )}
          {preview && <p className="text-sm text-muted">{t("Будет показано: «Источник:")} {preview}»</p>}
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="font-semibold text-fg">{t("Ответ и проверка")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Select label={t("Способ проверки")} value={form.check_mode} onChange={(e) => set("check_mode", e.target.value as CheckMode)}>
              <option value="auto">{t("Автоматически — сразу после отправки")}</option>
              <option value="manual">{t("Вручную — проверяет учитель")}</option>
            </Select>
            <Select label={t("Тип ответа")} value={form.answer_type} onChange={(e) => set("answer_type", e.target.value as AnswerType)}>
              <option value="number">{t("Число (с единицами и погрешностью)")}</option>
              <option value="text">{t("Текст")}</option>
            </Select>
          </div>
          <div className={cx("grid gap-4", form.answer_type === "number" ? "md:grid-cols-[2fr_1fr_1fr]" : "")}>
            <Input
              label={form.check_mode === "manual" ? t("Эталонное решение (для учителя)") : t("Правильный ответ")}
              value={form.answer}
              onChange={(e) => set("answer", e.target.value)}
              required
              className="font-mono"
              placeholder={form.answer_type === "number" ? t("20 или 2e1") : t("вверх | up")}
              hint={form.answer_type === "text" ? t("Несколько допустимых вариантов — через «|»") : t("Можно указать единицы прямо в ответе: «9.8 м/с^2»")}
            />
            {form.answer_type === "number" && (
              <>
                <Input
                  label={t("Единицы")}
                  value={form.unit ?? ""}
                  onChange={(e) => set("unit", e.target.value || null)}
                  placeholder={t("м/с")}
                  hint={t("м, км, с, ч, кг, Н, Дж…")}
                />
                <Input
                  label={t("Погрешность, %")}
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

        {similar && similar.length > 0 && (
          <Card className="space-y-3 border-warning/50 bg-warning-soft/40 p-5">
            <p className="font-semibold text-fg">⚠️ {t("Похожие задачи уже есть на платформе")}</p>
            <p className="text-sm text-muted">{t("Проверьте, что это не та же задача. Если отличается — сохраните её.")}</p>
            <ul className="space-y-1.5 text-sm">
              {similar.map((hit) => (
                <li key={hit.id} className="flex flex-wrap items-center gap-2">
                  <a href={taskUrl(hit.id)} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                    №{hit.id} «{hit.title}»
                  </a>
                  <span className="text-muted">
                    {hit.author_name} · {hit.theme_title} · {t("совпадение {0}%", [Math.round(hit.similarity * 100)])}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <ButtonLink to={listPath} variant="ghost">
            {t("Отмена")}
          </ButtonLink>
          <Button type="submit" size="lg" loading={saving}>
            {similar && similar.length > 0 ? t("Это другая задача — сохранить") : taskId ? t("Сохранить") : t("Опубликовать задачу")}
          </Button>
        </div>
      </form>
    </div>
  );
}
