import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, type AnswerType, type CheckMode, type DuplicateHit, type TaskFull, type TaskInput, type TaskParams } from "../api";
import { TranslatableFields, cleanTranslations } from "../components/TranslatableFields";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { LatexField } from "../components/LatexField";
import { Button, ButtonLink, Card, ErrorMessage, Input, Loading, PageHeader, Select, cx } from "../components/ui";
import { formatSource } from "../lib/format";
import { SourcePicker, type PickedSource } from "./SourcePicker";
import { AiModelSelect, aiModelLabel, useAiModel } from "./AiModelSelect";
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
  hints: [],
  explanation: "",
  mistakes: [],
  params: {},
  answer_formula: "",
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
  const parametric = !!form && Object.keys(form.params).length > 0;
  // Условие изменили — предупреждение о похожих задачах больше не актуально.
  useEffect(() => setSimilar(null), [form?.title, form?.condition]);

  const photoRef = useRef<HTMLInputElement>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [photoNote, setPhotoNote] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const { data: capabilities } = useAsync(() => api.imports.capabilities().catch(() => null), []);
  const aiEnabled = !!capabilities?.ai_enabled;
  const [aiModel, setAiModel] = useAiModel(capabilities?.ai_models);

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
        hints: task.hints ?? [],
        explanation: task.explanation ?? "",
        mistakes: task.mistakes ?? [],
        params: task.params ?? {},
        answer_formula: task.answer_formula ?? "",
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
      const { drafts, notes, model } = await api.imports.parse(file, aiModel);
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
      if (model) parts.push(t("Распознала модель: {0}.", [aiModelLabel(capabilities?.ai_models, model)]));
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
        hints: form.hints.map((hint) => hint.trim()).filter(Boolean),
        explanation: form.explanation.trim(),
        mistakes: form.mistakes.filter((m) => m.answer.trim() && m.message.trim()),
        ...(parametric ? { answer_type: "number" as AnswerType, answer: form.answer || "0" } : { params: {}, answer_formula: "" }),
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
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-primary/40 bg-primary-soft/30 px-4 py-3">
              <span className="text-2xl" aria-hidden>
                📷
              </span>
              <p className="min-w-[14rem] flex-1 text-sm text-fg">{t("Сфотографируйте задачу из книги — ИИ заполнит название, условие с формулами и ответ.")}</p>
              <AiModelSelect models={capabilities?.ai_models ?? []} value={aiModel} onChange={setAiModel} className="w-full sm:w-72" />
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
            {parametric ? (
              <Input
                label={t("Формула ответа")}
                value={form.answer_formula}
                onChange={(e) => set("answer_formula", e.target.value)}
                required
                className="font-mono"
                placeholder="v / 3.6"
                hint={t("Параметры по имени, + − * / ^, sqrt, sin, cos (в градусах), ln, pi")}
              />
            ) : (
              <Input
                label={form.check_mode === "manual" ? t("Эталонное решение (для учителя)") : t("Правильный ответ")}
                value={form.answer}
                onChange={(e) => set("answer", e.target.value)}
                required
                className="font-mono"
                placeholder={form.answer_type === "number" ? t("20 или 2e1") : t("вверх | up")}
                hint={form.answer_type === "text" ? t("Несколько допустимых вариантов — через «|»") : t("Можно указать единицы прямо в ответе: «9.8 м/с^2»")}
              />
            )}
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
          <div className="space-y-3 rounded-xl border border-border p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-fg">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--primary)]"
                checked={parametric}
                disabled={form.answer_type !== "number" && !parametric}
                onChange={(e) =>
                  setForm({
                    ...form,
                    answer_type: "number",
                    params: e.target.checked ? { v: { min: 36, max: 108, step: 18 } } : {},
                    answer_formula: e.target.checked ? form.answer_formula || "v / 3.6" : "",
                  })
                }
              />
              🎲 {t("Задача с параметрами — у каждого ученика свои числа")}
            </label>
            {parametric && (
              <>
                <p className="text-xs text-muted">
                  {t("Напишите в условии {v} — там, где должно стоять число. Ученик увидит своё значение из диапазона, ответ посчитается по формуле.")}
                </p>
                {(Object.entries(form.params) as [string, TaskParams[string]][]).map(([name, spec], index) => (
                  <div key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-[8rem_1fr_1fr_1fr_auto] sm:items-end">
                    <Input
                      label={t("Имя")}
                      value={name}
                      className="font-mono"
                      maxLength={16}
                      onChange={(e) => {
                        const entries = Object.entries(form.params).map(([n, s], i) => (i === index ? [e.target.value.replace(/[^A-Za-z0-9_]/g, ""), s] : [n, s]));
                        setForm({ ...form, params: Object.fromEntries(entries) });
                      }}
                    />
                    {(["min", "max", "step"] as const).map((key) => (
                      <Input
                        key={key}
                        label={{ min: t("от"), max: t("до"), step: t("шаг") }[key]}
                        type="number"
                        step="any"
                        value={spec[key]}
                        onChange={(e) => setForm({ ...form, params: { ...form.params, [name]: { ...spec, [key]: Number(e.target.value) } } })}
                      />
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t("Удалить")}
                      onClick={() => setForm({ ...form, params: Object.fromEntries(Object.entries(form.params).filter((_, i) => i !== index)) })}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                {Object.keys(form.params).length < 6 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const name = ["t", "m", "h", "a", "s", "F", "k"].find((n) => !(n in form.params)) ?? `p${Object.keys(form.params).length}`;
                      setForm({ ...form, params: { ...form.params, [name]: { min: 1, max: 10, step: 1 } } });
                    }}
                  >
                    + {t("Параметр")}
                  </Button>
                )}
                <p className="text-xs text-muted">
                  {t("Пример условия для ученика:")}{" "}
                  <span className="text-fg">
                    {form.condition.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, n: string) => (n in form.params ? String(form.params[n].min) : m)).slice(0, 200)}
                  </span>
                </p>
              </>
            )}
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <div>
            <h2 className="font-semibold text-fg">💡 {t("Подсказки и разбор")}</h2>
            <p className="text-sm text-muted">{t("Необязательно. Каждая открытая подсказка снижает очки за задачу на 20%. Разбор ученик увидит после верного ответа или 3 неверных попыток.")}</p>
          </div>
          {form.hints.map((hint, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <LatexField
                  label={t("Подсказка {0}", [index + 1])}
                  rows={2}
                  value={hint}
                  maxLength={2000}
                  onChange={(value) => setForm({ ...form, hints: form.hints.map((h, i) => (i === index ? value : h)) })}
                  placeholder={index === 0 ? t("Например: переведите скорость в м/с") : undefined}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" className="mt-7" onClick={() => setForm({ ...form, hints: form.hints.filter((_, i) => i !== index) })} aria-label={t("Удалить")}>
                ✕
              </Button>
            </div>
          ))}
          {form.hints.length < 3 && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setForm({ ...form, hints: [...form.hints, ""] })}>
              + {t("Подсказка")}
            </Button>
          )}
          <MarkdownEditor
            label={t("Разбор решения")}
            value={form.explanation}
            onChange={(explanation) => setForm({ ...form, explanation })}
            rows={6}
            placeholder={t("Пошаговое решение с формулами")}
            onUploadImage={api.imports.uploadImage}
          />
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-fg">{t("Частые ошибки")}</p>
              <p className="text-xs text-muted">{t("Если ученик ответит так — он увидит ваше пояснение. Типичные промахи (единицы, знак, порядок величины) система подсказывает сама.")}</p>
            </div>
            {form.mistakes.map((mistake, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
                <Input
                  value={mistake.answer}
                  placeholder={t("Ответ, например 72")}
                  aria-label={t("Неверный ответ")}
                  className="font-mono"
                  maxLength={100}
                  onChange={(e) => setForm({ ...form, mistakes: form.mistakes.map((m, i) => (i === index ? { ...m, answer: e.target.value } : m)) })}
                />
                <LatexField
                  single
                  value={mistake.message}
                  placeholder={t("Пояснение: не перевели км/ч в м/с")}
                  ariaLabel={t("Пояснение")}
                  maxLength={300}
                  onChange={(value) => setForm({ ...form, mistakes: form.mistakes.map((m, i) => (i === index ? { ...m, message: value } : m)) })}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, mistakes: form.mistakes.filter((_, i) => i !== index) })} aria-label={t("Удалить")}>
                  ✕
                </Button>
              </div>
            ))}
            {form.mistakes.length < 10 && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setForm({ ...form, mistakes: [...form.mistakes, { answer: "", message: "" }] })}>
                + {t("Частая ошибка")}
              </Button>
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
