import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AiModelSelect,
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorMessage,
  Input,
  Loading,
  Markdown,
  PageHeader,
  Select,
  SourcePicker,
  Textarea,
  api,
  cx,
  errorText,
  plural,
  t,
  aiModelLabel,
  useAiModel,
  useAsync,
  useDocumentTitle,
  usePlatformSettings,
  type CheckMode,
  type ImportResult,
  type PickedSource,
  type TaskDraft,
} from "@kps/shared";

const TEXT_EXAMPLE = `## Скорость поезда
Поезд едет со скоростью $v = 72$ км/ч. Найдите скорость в м/с.
Ответ: 20 м/с
Сложность: 200
Номер: 12
---
## Свободное падение
Камень падает с высоты $h = 20$ м. Найдите время падения.
Ответ: 2 с`;

const CSV_EXAMPLE = `Название;Условие;Ответ;Сложность;Номер
Скорость поезда;Поезд едет со скоростью 72 км/ч. Найдите скорость в м/с.;20 м/с;200;12`;

type Row = TaskDraft & { include: boolean };
type SourceMode = "none" | "own" | "source";

function Formats({ aiEnabled }: { aiEnabled: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <p className="font-semibold text-fg">📄 {t("Файлы: текст, Markdown, Word")}</p>
        <p className="text-sm text-muted">
          {t("Задачи разделяются строкой «---» или заголовком «## Название» / «Задача 5.». Строки «Ответ:», «Сложность:», «Номер:» — служебные.")}
        </p>
        <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-fg">{TEXT_EXAMPLE}</pre>
      </Card>
      <div className="space-y-4">
        <Card className="space-y-3 p-5">
          <p className="font-semibold text-fg">📊 {t("Таблица CSV (Excel) или JSON")}</p>
          <p className="text-sm text-muted">{t("Первая строка — названия колонок: Название, Условие, Ответ, Единицы, Сложность, Номер.")}</p>
          <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-fg">{CSV_EXAMPLE}</pre>
        </Card>
        <Card className={cx("space-y-2 p-5", !aiEnabled && "opacity-70")}>
          <p className="font-semibold text-fg">📷 {t("Фото или PDF страницы задачника")}</p>
          <p className="text-sm text-muted">
            {aiEnabled
              ? t("ИИ распознает условия и формулы. Если ответов в источнике нет, предложит свой — их нужно проверить.")
              : t("Распознавание фото пока не настроено администратором платформы.")}
          </p>
        </Card>
      </div>
    </div>
  );
}

function DraftCard({ row, index, levels, onChange }: { row: Row; index: number; levels: number[]; onChange: (row: Row) => void }) {
  const set = (patch: Partial<Row>) => onChange({ ...row, ...patch });
  const blocked = !!row.duplicate;
  return (
    <Card className={cx("space-y-4 p-5", !row.include && "opacity-60", blocked && "border-danger/40")}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-fg">
          <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={row.include} disabled={blocked} onChange={(e) => set({ include: e.target.checked })} />
          {t("Задача {0}", [index + 1])}
        </label>
        {row.duplicate && (
          <Badge tone="danger">
            {t("Уже есть на платформе")}: <Link to={`/tasks/${row.duplicate.id}`} target="_blank" className="underline">№{row.duplicate.id}</Link>
          </Badge>
        )}
        {row.similar.map((hit) => (
          <Badge key={hit.id} tone="warning">
            {t("Похожа на")}{" "}
            <Link to={`/tasks/${hit.id}`} target="_blank" className="underline">
              №{hit.id}
            </Link>{" "}
            ({Math.round(hit.similarity * 100)}%)
          </Badge>
        ))}
        {row.answer_is_guess && <Badge tone="warning">🤖 {t("Ответ предложен ИИ — проверьте")}</Badge>}
      </div>
      {blocked && <p className="text-sm text-danger">{t("Такая задача уже есть ({0}, автор {1}) — её нельзя добавить повторно.", [row.duplicate!.title, row.duplicate!.author_name])}</p>}
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <Input label={t("Название")} value={row.title} onChange={(e) => set({ title: e.target.value })} maxLength={150} />
        <Input label={t("Ответ")} value={row.answer} onChange={(e) => set({ answer: e.target.value, answer_is_guess: false })} className="font-mono" />
        <Select label={t("Сложность")} value={row.difficulty ?? 100} onChange={(e) => set({ difficulty: Number(e.target.value) })}>
          {levels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
        <Input label={t("Номер задачи")} value={row.source_number ?? ""} onChange={(e) => set({ source_number: e.target.value || null })} maxLength={30} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea label={t("Условие")} rows={6} value={row.condition} onChange={(e) => set({ condition: e.target.value })} className="font-mono text-[13px]" />
        <div>
          <p className="mb-1.5 text-sm font-medium text-fg">{t("Предпросмотр")}</p>
          <div className="min-h-[9rem] rounded-xl border border-border bg-surface-2/40 p-3">
            <Markdown source={row.condition} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ImportTasks() {
  useDocumentTitle(t("Импорт задач"));
  const { settings } = usePlatformSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<"file" | "ai">("file");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [themeId, setThemeId] = useState(0);
  const [checkMode, setCheckMode] = useState<CheckMode>("auto");
  const [sourceMode, setSourceMode] = useState<SourceMode>("none");
  const [source, setSource] = useState<PickedSource | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { data } = useAsync(async () => {
    const [capabilities, themes] = await Promise.all([api.imports.capabilities(), api.themes.list()]);
    if (themes.length) setThemeId((prev) => prev || themes[0].id);
    return { capabilities, themes };
  }, []);
  const [aiModel, setAiModel] = useAiModel(data?.capabilities.ai_models);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const parsed = await api.imports.parse(file, aiModel);
      setUsedModel(parsed.model);
      setMethod(parsed.method);
      setNotes(parsed.notes);
      setRows(parsed.drafts.map((draft) => ({ ...draft, include: !draft.duplicate })));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const selected = (rows ?? []).filter((row) => row.include && !row.duplicate);
  const commit = async () => {
    if (sourceMode === "source" && !source) {
      setError(t("Выберите источник из каталога или добавьте новый"));
      return;
    }
    const missing = selected.filter((row) => !row.answer.trim());
    if (missing.length) {
      setError(t("Укажите ответ у задач: {0}", [missing.map((row) => `«${row.title}»`).join(", ")]));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const outcome = await api.imports.commit({
        theme_id: themeId,
        check_mode: checkMode,
        source_id: sourceMode === "source" ? (source?.id ?? null) : null,
        is_original: sourceMode === "own",
        tasks: selected.map((row) => ({
          title: row.title,
          condition: row.condition,
          answer: row.answer,
          unit: row.unit,
          answer_type: row.answer_type,
          difficulty: row.difficulty ?? 100,
          source_number: row.source_number,
        })),
      });
      setResult(outcome);
      // Неудачные остаются в списке для исправления, удачные убираем.
      const failedRows = new Set(outcome.failed.map((item) => selected[item.index]));
      setRows((prev) => (prev ?? []).filter((row) => !row.include || row.duplicate || failedRows.has(row)));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Loading />;
  const themes = data.themes;
  const subjects = [...new Map(themes.map((theme) => [theme.subject_id, theme.subject_title])).entries()];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Импорт задач")}
        subtitle={t("Загрузите файл или фото — проверьте распознанные задачи и подтвердите импорт")}
        breadcrumbs={[{ label: t("Мои задачи"), to: "/manage/tasks" }, { label: t("Импорт") }]}
      />

      {result && (
        <Card className="space-y-2 border-success/40 bg-success-soft/40 p-5">
          <p className="font-semibold text-fg">
            ✓ {t("Импортировано")}: {result.created.length} {plural(result.created.length, ["задача", "задачи", "задач"])}
          </p>
          {result.failed.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
              {result.failed.map((item) => (
                <li key={item.index}>
                  «{item.title}»: {item.error}
                </li>
              ))}
            </ul>
          )}
          <ButtonLink to="/manage/tasks" variant="secondary" size="sm">
            {t("К моим задачам")}
          </ButtonLink>
        </Card>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      <Card className="flex flex-wrap items-end gap-4 border-dashed p-6">
        <span className="text-4xl" aria-hidden>
          📥
        </span>
        <div className="min-w-[16rem] flex-1">
          <p className="font-semibold text-fg">{t("Выберите файл с задачами")}</p>
          <p className="text-sm text-muted">
            TXT, Markdown, Word (.docx), CSV, JSON{data.capabilities.ai_enabled ? t(", фото (JPG, PNG) и PDF") : ""} · {t("до 10 МБ")}
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={[...data.capabilities.file_formats, ...(data.capabilities.ai_enabled ? data.capabilities.ai_formats : [])].join(",")}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        {data.capabilities.ai_enabled && data.capabilities.ai_models.length > 0 && (
          <AiModelSelect models={data.capabilities.ai_models} value={aiModel} onChange={setAiModel} className="w-full sm:w-80" />
        )}
        <Button size="lg" loading={busy && !rows} onClick={() => fileRef.current?.click()}>
          {rows ? t("Загрузить другой файл") : t("Выбрать файл")}
        </Button>
      </Card>
      {busy && !rows && <p className="text-sm text-muted">{t("Распознаём задачи… С фото это может занять до минуты.")}</p>}

      {!rows && <Formats aiEnabled={data.capabilities.ai_enabled} />}

      {rows && (
        <>
          {method === "ai" && (
            <Card className="border-warning/40 bg-warning-soft/40 p-4 text-sm text-fg">
              🤖 {t("Задачи распознаны ИИ. Сверьте условия, формулы и ответы с оригиналом перед импортом.")}
              {usedModel && <p className="mt-1 text-muted">{t("Распознала модель: {0}.", [aiModelLabel(data.capabilities.ai_models, usedModel)])}</p>}
              {notes && <p className="mt-1 text-muted">{notes}</p>}
            </Card>
          )}
          <Card className="space-y-4 p-5">
            <p className="font-semibold text-fg">{t("Общие настройки для всех задач")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label={t("Тема")} value={themeId} onChange={(e) => setThemeId(Number(e.target.value))}>
                {subjects.map(([subjectId, subjectTitle]) => (
                  <optgroup key={subjectId} label={subjectTitle}>
                    {themes
                      .filter((theme) => theme.subject_id === subjectId)
                      .map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
              <Select label={t("Способ проверки")} value={checkMode} onChange={(e) => setCheckMode(e.target.value as CheckMode)}>
                <option value="auto">{t("Автоматически — сразу после отправки")}</option>
                <option value="manual">{t("Вручную — проверяет учитель")}</option>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Источник")}>
              {(
                [
                  ["none", t("Источник не указан")],
                  ["own", t("Авторские задачи")],
                  ["source", t("Из книги, олимпиады, экзамена")],
                ] as [SourceMode, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={sourceMode === key}
                  onClick={() => setSourceMode(key)}
                  className={cx(
                    "rounded-xl border px-4 py-2 text-sm font-medium",
                    sourceMode === key ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {sourceMode === "source" && <SourcePicker value={source} onChange={setSource} />}
          </Card>

          <div className="space-y-4">
            {rows.map((row, index) => (
              <DraftCard key={index} row={row} index={index} levels={settings.difficulty_levels} onChange={(next) => setRows(rows.map((item, i) => (i === index ? next : item)))} />
            ))}
          </div>

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur">
            <p className="mr-auto text-sm text-muted">
              {t("Выбрано {0} из {1}", [selected.length, rows.length])}
            </p>
            <Button size="lg" onClick={commit} loading={busy} disabled={selected.length === 0 || !themeId}>
              {t("Импортировать")} ({selected.length})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
