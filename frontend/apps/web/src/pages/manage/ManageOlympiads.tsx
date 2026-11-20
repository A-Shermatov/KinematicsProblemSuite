import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  Markdown,
  TranslatableFields,
  cleanTranslations,
  Modal,
  PageHeader,
  Select,
  Textarea,
  api,
  cx,
  errorText,
  formatDateTime,
  formatRange,
  fromLocalInput,
  olympiadPhaseMeta,
  olympiadStatusMeta,
  toLocalInput,
  useAsync,
  useDocumentTitle,
  type AnswerType,
  type OlympiadDetail,
  type OlympiadSubmission,
  type OlympiadTask,
  type OlympiadTaskInput,
  t,
  levelRange,
  Avatar,
  useAuth,
  SourcePicker,
  usePlatformSettings,
  type PickedSource,
} from "@kps/shared";

export function ManageOlympiads() {
  useDocumentTitle(t("Мои олимпиады"));
  const { data, error, loading } = useAsync(() => api.olympiads.mine(), []);
  return (
    <>
      <PageHeader
        title={t("Мои олимпиады")}
        subtitle={t("Создайте олимпиаду, добавьте задачи и отправьте на проверку администратору")}
        actions={<ButtonLink to="/manage/olympiads/new">{t("+ Новая олимпиада")}</ButtonLink>}
      />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState icon="🏁" title={t("Вы ещё не проводили олимпиад")} />}
      {data && data.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.map((olympiad) => {
            const status = olympiadStatusMeta[olympiad.status];
            return (
              <Link
                key={olympiad.id}
                to={olympiad.is_jury ? `/olympiads/${olympiad.id}/jury` : `/manage/olympiads/${olympiad.id}`}
                className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{olympiad.title}</p>
                  <p className="text-xs text-muted">
                    {formatRange(olympiad.starts_at, olympiad.ends_at)} · {olympiad.tasks_count}  {t("задач ·")} {olympiad.participants_count}  {t("участников")}
                  </p>
                </div>
                {olympiad.is_jury ? <Badge tone="primary">⚖️ {t("Вы в жюри")}</Badge> : <Badge tone={status.tone}>{status.label}</Badge>}
                {olympiad.status === "published" && <Badge tone={olympiadPhaseMeta[olympiad.phase].tone}>{olympiadPhaseMeta[olympiad.phase].label}</Badge>}
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}

const EMPTY_TASK: OlympiadTaskInput = {
  position: 0,
  title: "",
  condition: "",
  answer_type: "number",
  answer: "",
  unit: null,
  tolerance: 0.01,
  max_points: 10,
  translations: {},
  difficulty: null,
  source_id: null,
  source_number: null,
  is_original: false,
};

type SourceMode = "none" | "own" | "source";

function TaskForm({
  olympiadId,
  task,
  nextPosition,
  onSaved,
  onCancel,
  correction,
}: {
  olympiadId: number;
  task: OlympiadTask | null;
  nextPosition: number;
  onSaved: () => void;
  onCancel: () => void;
  /** Исправление во время олимпиады — участники получат объявление. */
  correction?: boolean;
}) {
  const { settings } = usePlatformSettings();
  const [sourceMode, setSourceMode] = useState<SourceMode>(task?.is_original ? "own" : task?.source_id ? "source" : "none");
  const [picked, setPicked] = useState<PickedSource | null>(
    task?.source_id && task.source_type && task.source_title
      ? { id: task.source_id, type: task.source_type, title: task.source_title, author: task.source_author ?? "", year: task.source_year }
      : null,
  );
  const [form, setForm] = useState<OlympiadTaskInput>(
    task
      ? {
          position: task.position,
          title: task.title,
          condition: task.condition,
          answer_type: task.answer_type,
          answer: task.answer ?? "",
          unit: task.unit,
          tolerance: task.tolerance ?? 0.01,
          max_points: task.max_points,
          translations: task.translations ?? {},
          difficulty: task.difficulty,
          source_id: task.source_id ?? null,
          source_number: task.source_number,
          is_original: !!task.is_original,
        }
      : { ...EMPTY_TASK, position: nextPosition },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        unit: form.answer_type === "number" ? form.unit?.trim() || null : null,
        translations: cleanTranslations(form.translations),
        is_original: sourceMode === "own",
        source_id: sourceMode === "source" ? (picked?.id ?? null) : null,
        source_number: sourceMode === "source" ? form.source_number?.trim() || null : null,
      };
      if (task) await api.olympiads.updateTask(olympiadId, task.id, payload);
      else await api.olympiads.addTask(olympiadId, payload);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <TranslatableFields
        onUploadImage={api.imports.uploadImage}
        title={form.title}
        condition={form.condition}
        translations={form.translations}
        onChange={(patch) => setForm({ ...form, ...patch })}
        rows={8}
        asideClassName="sm:grid-cols-[1fr_120px]"
        aside={<Input label={t("Баллы")} type="number" min={1} max={100} value={form.max_points} onChange={(e) => setForm({ ...form, max_points: Number(e.target.value) })} required />}
      />
      <div className={cx("grid gap-4", form.answer_type === "number" ? "sm:grid-cols-[160px_1fr_120px_120px]" : "sm:grid-cols-[160px_1fr]")}>
        <Select label={t("Тип ответа")} value={form.answer_type} onChange={(e) => setForm({ ...form, answer_type: e.target.value as AnswerType })}>
          <option value="number">{t("Число")}</option>
          <option value="text">{t("Текст")}</option>
        </Select>
        <Input
          label={t("Ответ (для автопроверки)")}
          value={form.answer}
          onChange={(e) => setForm({ ...form, answer: e.target.value })}
          required
          className="font-mono"
          hint={t("Итоговый балл ставит жюри, автопроверка — подсказка")}
        />
        {form.answer_type === "number" && (
          <>
            <Input label={t("Единицы")} value={form.unit ?? ""} onChange={(e) => setForm({ ...form, unit: e.target.value || null })} placeholder={t("м/с")} />
            <Input
              label={t("Погрешность, %")}
              type="number"
              min={0}
              max={50}
              step={0.1}
              value={Math.round(form.tolerance * 1000) / 10}
              onChange={(e) => setForm({ ...form, tolerance: Number(e.target.value) / 100 })}
            />
          </>
        )}
      </div>
      <div className="grid gap-4 rounded-xl border border-border p-4 lg:grid-cols-[180px_1fr]">
        <Select
          label={t("Сложность")}
          value={form.difficulty ?? ""}
          onChange={(e) => setForm({ ...form, difficulty: e.target.value ? Number(e.target.value) : null })}
          hint={t("Для архива олимпиадных задач")}
        >
          <option value="">{t("Не указана")}</option>
          {settings.difficulty_levels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
        <div className="space-y-2">
          <p className="text-sm font-medium text-fg">{t("Источник")}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Источник")}>
            {(
              [
                ["none", t("Не указан")],
                ["own", t("Авторская задача")],
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
                  "rounded-xl border px-3 py-1.5 text-sm font-medium",
                  sourceMode === key ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {sourceMode === "source" && (
            <div className="grid gap-3 sm:grid-cols-[3fr_1fr] sm:items-start">
              <SourcePicker value={picked} onChange={setPicked} />
              <Input
                label={t("Номер задачи")}
                value={form.source_number ?? ""}
                onChange={(e) => setForm({ ...form, source_number: e.target.value || null })}
                maxLength={30}
                placeholder={t("123 или 5.14")}
              />
            </div>
          )}
          <p className="text-xs text-muted">{t("Участникам уровень и источник покажутся только после итогов — по источнику легко найти решение.")}</p>
        </div>
      </div>
      {correction && (
        <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
          {t("Олимпиада идёт: участники получат объявление с тем, что именно исправлено. Если исправите ответ — автопроверка пересчитается.")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t("Отмена")}
        </Button>
        <Button type="submit" loading={saving}>
          {correction ? t("Исправить и объявить") : task ? t("Сохранить задачу") : t("Добавить задачу")}
        </Button>
      </div>
    </form>
  );
}

export function OlympiadEditor() {
  const params = useParams();
  const olympiadId = params.olympiadId ? Number(params.olympiadId) : null;
  const navigate = useNavigate();
  useDocumentTitle(olympiadId ? t("Олимпиада") : t("Новая олимпиада"));
  const defaultStart = new Date(Date.now() + 7 * 86400_000);
  defaultStart.setHours(10, 0, 0, 0);

  const [info, setInfo] = useState<{ title: string; description: string; subject_id: string; level_id: string; starts: string; ends: string } | null>(
    olympiadId
      ? null
      : {
          title: "",
          description: "",
          subject_id: "",
          level_id: "",
          starts: toLocalInput(defaultStart.toISOString()),
          ends: toLocalInput(new Date(defaultStart.getTime() + 3 * 3600_000).toISOString()),
        },
  );
  const [editingTask, setEditingTask] = useState<OlympiadTask | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, reload, setData } = useAsync(async () => {
    const [subjects, levels, olympiad] = await Promise.all([
      api.subjects.list(),
      api.olympiads.levels(),
      olympiadId ? api.olympiads.get(olympiadId) : Promise.resolve(null),
    ]);
    if (olympiad) {
      setInfo({
        title: olympiad.title,
        description: olympiad.description,
        subject_id: olympiad.subject_id ? String(olympiad.subject_id) : "",
        level_id: olympiad.level_id ? String(olympiad.level_id) : "",
        starts: toLocalInput(olympiad.starts_at),
        ends: toLocalInput(olympiad.ends_at),
      });
    }
    return { subjects, levels, olympiad };
  }, [olympiadId]);

  if (loading || !data || !info) return <Loading />;
  const olympiad: OlympiadDetail | null = data.olympiad;
  const editable = !olympiad || olympiad.status === "draft" || olympiad.status === "rejected";
  // Опубликованную олимпиаду можно исправлять до итогов (во время — с объявлением участникам).
  const canCorrect = olympiad?.status === "published" && olympiad.phase !== "finished";

  const saveInfo = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: info.title,
        description: info.description,
        subject_id: info.subject_id ? Number(info.subject_id) : null,
        level_id: info.level_id ? Number(info.level_id) : null,
        starts_at: fromLocalInput(info.starts),
        ends_at: fromLocalInput(info.ends),
      };
      if (olympiad) {
        const updated = await api.olympiads.update(olympiad.id, payload);
        setData((prev) => ({ ...prev!, olympiad: updated }));
      } else {
        const created = await api.olympiads.create(payload);
        navigate(`/manage/olympiads/${created.id}`, { replace: true });
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const action = async (run: () => Promise<unknown>) => {
    setError(null);
    try {
      await run();
      reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const status = olympiad ? olympiadStatusMeta[olympiad.status] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={olympiad ? olympiad.title : t("Новая олимпиада")}
        breadcrumbs={[{ label: t("Мои олимпиады"), to: "/manage/olympiads" }, { label: olympiad ? t("Олимпиада") : t("Новая") }]}
        actions={
          olympiad && (
            <div className="flex flex-wrap gap-2">
              {status && <Badge tone={status.tone} className="px-3 py-1 text-sm">{status.label}</Badge>}
              {olympiad.status === "published" && (
                <>
                  <ButtonLink to={`/olympiads/${olympiad.id}`} variant="secondary" size="sm">
                    {t("Страница олимпиады")}
                  </ButtonLink>
                  {olympiad.phase !== "upcoming" && (
                    <ButtonLink to={`/manage/olympiads/${olympiad.id}/jury`} size="sm">
                      {t("Жюри")}{olympiad.ungraded_count ? ` · ${olympiad.ungraded_count}` : ""}
                    </ButtonLink>
                  )}
                </>
              )}
            </div>
          )
        }
      />

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {olympiad?.status === "rejected" && (
        <Card className="border-danger/30 bg-danger-soft p-4 text-sm text-danger">{t("Администратор вернул олимпиаду:")} {olympiad.reject_reason}</Card>
      )}
      {olympiad?.status === "pending" && (
        <Card className="border-warning/30 bg-warning-soft p-4 text-sm text-warning">{t("Олимпиада на проверке у администратора. Изменения недоступны.")}</Card>
      )}

      <Card className="p-6">
        <form onSubmit={saveInfo} className="space-y-4">
          <fieldset disabled={!editable} className="space-y-4">
            <Input label={t("Название")} value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} required minLength={3} maxLength={150} placeholder={t("Осенняя олимпиада по физике, 9–11 классы")} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label={t("Уровень")}
                value={info.level_id}
                onChange={(e) => setInfo({ ...info, level_id: e.target.value })}
                hint={t("Участники с рейтингом выше уровня решают вне конкурса")}
              >
                <option value="">{t("Для всех")}</option>
                {data.levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.title}
                    {levelRange(level.min_rating, level.max_rating) ? ` (${levelRange(level.min_rating, level.max_rating)})` : ""}
                  </option>
                ))}
              </Select>
              <Select label={t("Предмет")} value={info.subject_id} onChange={(e) => setInfo({ ...info, subject_id: e.target.value })}>
                <option value="">{t("Разные предметы")}</option>
                {data.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.title}
                  </option>
                ))}
              </Select>
              <Input label={t("Начало")} type="datetime-local" value={info.starts} onChange={(e) => setInfo({ ...info, starts: e.target.value })} required />
              <Input label={t("Окончание")} type="datetime-local" value={info.ends} onChange={(e) => setInfo({ ...info, ends: e.target.value })} required />
            </div>
            <Textarea
              label={t("Описание и правила")}
              rows={5}
              value={info.description}
              onChange={(e) => setInfo({ ...info, description: e.target.value })}
              hint={t("Для кого олимпиада, формат, призы. Поддерживается Markdown.")}
            />
          </fieldset>
          {editable && (
            <Button type="submit" loading={saving}>
              {olympiad ? t("Сохранить") : t("Создать и перейти к задачам")}
            </Button>
          )}
        </form>
      </Card>

      {olympiad && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">
              {t("Задачи ·")} {olympiad.tasks.length} · {olympiad.max_score}  {t("баллов")}
            </h2>
            {editable && editingTask === null && (
              <Button size="sm" onClick={() => setEditingTask("new")}>
                {t("+ Задача")}
              </Button>
            )}
          </div>
          {olympiad.tasks.map((task, index) =>
            editingTask !== "new" && editingTask?.id === task.id ? (
              <Card key={task.id} className="p-6">
                <TaskForm
                  olympiadId={olympiad.id}
                  task={task}
                  nextPosition={index}
                  correction={olympiad.status === "published" && (olympiad.phase === "running" || olympiad.phase === "checking")}
                  onSaved={() => {
                    setEditingTask(null);
                    reload();
                  }}
                  onCancel={() => setEditingTask(null)}
                />
              </Card>
            ) : (
              <Card key={task.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 font-medium text-fg">
                    {index + 1}. {task.title}
                  </p>
                  <Badge>{task.max_points}  {t("баллов")}</Badge>
                  <Badge tone="primary">
                    {t("Ответ:")} {task.answer}
                    {task.unit ? ` ${task.unit}` : ""}
                  </Badge>
                  {task.difficulty && <Badge>{task.difficulty}</Badge>}
                  {!editable && canCorrect && (
                    <Button size="sm" variant="ghost" onClick={() => setEditingTask(task)}>
                      {t("Исправить")}
                    </Button>
                  )}
                  {editable && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditingTask(task)}>
                        {t("Изменить")}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => window.confirm(t("Удалить задачу «{0}»?", [task.title])) && action(() => api.olympiads.removeTask(olympiad.id, task.id))}
                      >
                        {t("Удалить")}
                      </Button>
                    </>
                  )}
                </div>
                <Markdown source={task.condition} className="text-sm" empty={t("Без условия")} />
              </Card>
            ),
          )}
          {editingTask === "new" && (
            <Card className="p-6">
              <TaskForm olympiadId={olympiad.id} task={null} nextPosition={olympiad.tasks.length} onSaved={() => { setEditingTask(null); reload(); }} onCancel={() => setEditingTask(null)} />
            </Card>
          )}
          {olympiad.tasks.length === 0 && editingTask === null && <EmptyState title={t("Добавьте задачи олимпиады")} />}
        </section>
      )}

      {olympiad && olympiad.phase !== "finished" && <JuryCard olympiadId={olympiad.id} />}

      {olympiad && editable && (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <p className="flex-1 text-sm text-muted">{t("Когда всё готово, отправьте олимпиаду администратору. После публикации задачи можно только исправлять — участники получат объявление.")}</p>
          <Button variant="ghost" onClick={() => window.confirm(t("Удалить олимпиаду?")) && action(async () => { await api.olympiads.remove(olympiad.id); navigate("/manage/olympiads"); })}>
            {t("Удалить")}
          </Button>
          <Button onClick={() => action(() => api.olympiads.submitForReview(olympiad.id))} disabled={olympiad.tasks.length === 0}>
            {t("Отправить на проверку")}
          </Button>
        </Card>
      )}
    </div>
  );
}

function GradeRow({
  olympiadId,
  submission,
  onSaved,
  onZoom,
  onAttempts,
  locked,
}: {
  olympiadId: number;
  submission: OlympiadSubmission;
  onSaved: (s: OlympiadSubmission) => void;
  onZoom: (url: string) => void;
  onAttempts?: (s: OlympiadSubmission) => void;
  locked: boolean;
}) {
  const [points, setPoints] = useState(String(submission.jury_points ?? submission.auto_points));
  const [comment, setComment] = useState(submission.jury_comment);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      onSaved(await api.olympiads.grade(olympiadId, submission.id, Number(points), comment));
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className={cx("grid gap-4 px-5 py-4 md:grid-cols-[96px_1fr_auto]", submission.jury_points === null && "bg-warning-soft/40")}>
      <button type="button" onClick={() => onZoom(submission.image_url)} className="h-24 w-24 overflow-hidden rounded-lg bg-surface-2" aria-label={t("Открыть фото решения")}>
        <img src={submission.image_url} alt="" className="h-full w-full object-cover" />
      </button>
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium text-fg">
          {submission.user_name || submission.username}
          <span className="font-normal text-muted"> · {[submission.school, submission.city].filter(Boolean).join(", ") || `@${submission.username}`}</span>
        </p>
        <p className="text-muted">
          {t("Задача")} {submission.task_position + 1}. {submission.task_title}  {t("· отправлено")} {formatDateTime(submission.submitted_at)}
        </p>
        <p>
          {t("Ответ:")} <span className="font-mono text-fg">{submission.answer || "—"}</span>  {t("· эталон")}{" "}
          <span className="font-mono text-fg">{submission.correct_answer}</span>{" "}
          <Badge tone={submission.auto_correct ? "success" : "danger"}>{submission.auto_correct ? t("авто: верно") : t("авто: неверно")}</Badge>
          {onAttempts && (
            <button type="button" onClick={() => onAttempts(submission)} className="ml-2 text-xs text-primary hover:underline">
              {t("все попытки")}
            </button>
          )}
        </p>
        <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("Комментарий участнику")} disabled={locked} aria-label={t("Комментарий")} />
      </div>
      <div className="flex items-start gap-2">
        <Input
          type="number"
          min={0}
          max={submission.max_points}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className="w-20 text-center"
          disabled={locked}
          aria-label={t("Баллы")}
        />
        <span className="pt-3 text-sm text-muted">/ {submission.max_points}</span>
        {!locked && (
          <Button type="submit" size="sm" className="mt-1.5" loading={saving} variant={submission.jury_points === null ? "primary" : "secondary"}>
            {submission.jury_points === null ? t("Оценить") : "✓"}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Проверка решений жюри. embedded — вкладка «Проверка» на странице олимпиады (без своей шапки). */
export function OlympiadJury({ embedded = false }: { embedded?: boolean }) {
  const olympiadId = Number(useParams().olympiadId);
  useDocumentTitle(embedded ? undefined : t("Жюри"));
  const [taskId, setTaskId] = useState<number | null>(null);
  const [ungraded, setUngraded] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [attemptsOf, setAttemptsOf] = useState<OlympiadSubmission | null>(null);
  const { data, loading, setData, reload } = useAsync(async () => {
    const [olympiad, submissions] = await Promise.all([
      api.olympiads.get(olympiadId),
      api.olympiads.jury(olympiadId, { task_id: taskId ?? undefined, ungraded: ungraded || undefined }),
    ]);
    return { olympiad, submissions };
  }, [olympiadId, taskId, ungraded]);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorMessage>{t("Олимпиада не найдена")}</ErrorMessage>;
  const { olympiad, submissions } = data;
  const locked = olympiad.phase === "finished";
  const left = submissions.filter((s) => s.jury_points === null).length;

  const publish = async () => {
    setError(null);
    const force = (olympiad.ungraded_count ?? 0) > 0;
    if (force && !window.confirm(t("Не проверено {0} решений — для них останется балл автопроверки. Опубликовать?", [olympiad.ungraded_count]))) return;
    try {
      await api.olympiads.publishResults(olympiad.id, force);
      reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const juryActions =
    olympiad.phase === "checking" && !olympiad.can_manage ? (
      <Badge tone="warning">{t("Итоги опубликует организатор")}</Badge>
    ) : olympiad.phase === "checking" ? (
      <Button onClick={publish}>{t("Опубликовать итоги")}</Button>
    ) : locked ? (
      <ButtonLink to={`/olympiads/${olympiad.id}`} variant="secondary">
        {t("Итоги опубликованы")}
      </ButtonLink>
    ) : (
      <Badge tone="success">{t("Олимпиада идёт — проверять можно уже сейчас")}</Badge>
    );

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted">{t("Балл жюри заменяет автопроверку. Можно снизить за списанное или неполное решение и дать частичный балл.")}</p>
          {juryActions}
        </div>
      ) : (
        <PageHeader
          title={t("Жюри: {0}", [olympiad.title])}
          subtitle={t("Балл жюри заменяет автопроверку. Можно снизить за списанное или неполное решение и дать частичный балл.")}
          breadcrumbs={[{ label: t("Мои олимпиады"), to: "/manage/olympiads" }, { label: olympiad.title, to: `/manage/olympiads/${olympiad.id}` }, { label: t("Жюри") }]}
          actions={juryActions}
        />
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={taskId ?? ""}
          onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          aria-label={t("Задача")}
        >
          <option value="">{t("Все задачи")}</option>
          {olympiad.tasks.map((task, index) => (
            <option key={task.id} value={task.id}>
              {index + 1}. {task.title}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={ungraded} onChange={(e) => setUngraded(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          {t("Только непроверенные")}
        </label>
        <span className="text-sm text-muted">
          {t("Не проверено в списке:")} {left}  {t("из")} {submissions.length}
        </span>
      </div>
      <PlagiarismPanel olympiadId={olympiad.id} onZoom={setZoom} />
      {(olympiad.phase === "running" || olympiad.phase === "checking") && <AnnounceForm olympiadId={olympiad.id} tasks={olympiad.tasks} />}
      {submissions.length === 0 ? (
        <EmptyState icon="📭" title={t("Решений нет")} />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {submissions.map((submission) => (
            <GradeRow
              key={submission.id}
              olympiadId={olympiad.id}
              submission={submission}
              locked={locked}
              onZoom={setZoom}
              onAttempts={user?.role === "admin" ? setAttemptsOf : undefined}
              onSaved={(saved) => setData((prev) => ({ ...prev!, submissions: prev!.submissions.map((s) => (s.id === saved.id ? saved : s)) }))}
            />
          ))}
        </Card>
      )}
      <Modal open={!!attemptsOf} onClose={() => setAttemptsOf(null)} title={t("Все попытки: {0}", [attemptsOf?.user_name || attemptsOf?.username || ""])}>
        {attemptsOf && <AttemptsList olympiadId={olympiad.id} userId={attemptsOf.user_id} taskId={attemptsOf.task_id} onZoom={setZoom} />}
      </Modal>
      <Modal open={!!zoom} onClose={() => setZoom(null)} title={t("Фото решения")}>
        {zoom && <img src={zoom} alt={t("Фото решения")} className="max-h-[85vh] rounded-lg object-contain" />}
      </Modal>
    </div>
  );
}

/** Подозрения на списывание: попытки, у которых фото совпало с фото другого участника (они не засчитаны). */
function PlagiarismPanel({ olympiadId, onZoom }: { olympiadId: number; onZoom: (url: string) => void }) {
  const { data } = useAsync(() => api.olympiads.attempts(olympiadId, { rejected: true }), [olympiadId]);
  if (!data || data.length === 0) return null;
  return (
    <Card className="space-y-2 border-danger/40 p-4">
      <p className="text-sm font-semibold text-danger">
        ⚠ {t("Подозрения на списывание")} · {data.length}
      </p>
      <p className="text-xs text-muted">{t("Фото совпало с фото другого участника — такие попытки не засчитаны и жюри их не проверяет.")}</p>
      <div className="divide-y divide-border">
        {data.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            {item.image_url && (
              <button onClick={() => onZoom(item.image_url!)} className="h-12 w-12 overflow-hidden rounded-lg bg-surface-2" aria-label={t("Открыть фото решения")}>
                <img src={item.image_url} alt="" className="h-full w-full object-cover" />
              </button>
            )}
            <span className="flex-1 text-fg">
              <b>{item.user_name || item.username}</b> {t("прислал фото, как у")} <b>{item.matched_name || item.matched_username}</b>
            </span>
            <span className="text-xs text-muted">{formatDateTime(item.submitted_at)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Объявление участникам — придёт на страницу олимпиады и в Telegram. */
function AnnounceForm({ olympiadId, tasks }: { olympiadId: number; tasks: OlympiadTask[] }) {
  const [text, setText] = useState("");
  const [taskId, setTaskId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const send = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.olympiads.announce(olympiadId, text, taskId ? Number(taskId) : null);
      setText("");
      setMessage(t("Отправлено участникам"));
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-4">
      <form onSubmit={send} className="flex flex-wrap items-end gap-3">
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-fg" aria-label={t("Задача")}>
          <option value="">{t("Ко всей олимпиаде")}</option>
          {tasks.map((task, index) => (
            <option key={task.id} value={task.id}>
              {String.fromCharCode(65 + index)}. {task.title}
            </option>
          ))}
        </select>
        <div className="min-w-64 flex-1">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Объявление участникам: уточнение, ответ на вопрос…")} minLength={3} maxLength={2000} required aria-label={t("Объявление")} />
        </div>
        <Button type="submit" variant="secondary" loading={busy}>
          📢 {t("Объявить")}
        </Button>
        {message && <span className="text-sm text-muted">{message}</span>}
      </form>
    </Card>
  );
}

/** Все попытки участника по задаче — только для админа. */
function AttemptsList({ olympiadId, userId, taskId, onZoom }: { olympiadId: number; userId: number; taskId: number; onZoom: (url: string) => void }) {
  const { data, loading, error } = useAsync(() => api.olympiads.attempts(olympiadId, { user_id: userId, task_id: taskId }), [olympiadId, userId, taskId]);
  if (loading) return <Loading />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  return (
    <div className="w-[min(90vw,640px)] divide-y divide-border">
      {data?.map((item) => (
        <div key={item.id} className="flex items-center gap-3 py-2 text-sm">
          {item.image_url && (
            <button onClick={() => onZoom(item.image_url!)} className="h-14 w-14 overflow-hidden rounded-lg bg-surface-2" aria-label={t("Открыть фото решения")}>
              <img src={item.image_url} alt="" className="h-full w-full object-cover" />
            </button>
          )}
          <span className="font-mono text-fg">{item.answer || "—"}</span>
          {item.current && <Badge tone="primary">{t("засчитывается")}</Badge>}
          {item.rejected && <Badge tone="danger">{t("списано у {0}", [item.matched_username ?? ""])}</Badge>}
          {item.auto_correct !== null && !item.rejected && <Badge tone={item.auto_correct ? "success" : "danger"}>{item.auto_correct ? t("авто: верно") : t("авто: неверно")}</Badge>}
          <span className="ml-auto text-xs text-muted">{formatDateTime(item.submitted_at)}</span>
        </div>
      ))}
    </div>
  );
}

/** Жюри олимпиады: организатор приглашает учителей по логину. Жюри проверяет решения, но не участвует. */
function JuryCard({ olympiadId }: { olympiadId: number }) {
  const { data, setData, error } = useAsync(() => api.olympiads.juryMembers(olympiadId), [olympiadId]);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const add = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      setData(await api.olympiads.addJury(olympiadId, username));
      setUsername("");
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (userId: number) => {
    try {
      await api.olympiads.removeJury(olympiadId, userId);
      setData((prev) => prev!.filter((member) => member.user_id !== userId));
    } catch (err) {
      setMessage(errorText(err));
    }
  };
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="font-semibold text-fg">⚖️ {t("Жюри")}</h2>
        <p className="text-sm text-muted">{t("Учителя из жюри проверяют решения и делают объявления. Участвовать в этой олимпиаде они не могут — как и вы, автор.")}</p>
      </div>
      {(error || message) && <ErrorMessage>{error ?? message}</ErrorMessage>}
      {data && data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.map((member) => (
            <span key={member.user_id} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-2 text-sm">
              <Avatar src={member.avatar_url} name={member.name || member.username} size={24} />
              <span className="text-fg">{member.name || member.username}</span>
              <span className="text-xs text-muted">@{member.username}</span>
              <button onClick={() => remove(member.user_id)} className="text-muted hover:text-danger" aria-label={t("Убрать из жюри")}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="w-64">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("Логин учителя")} required aria-label={t("Логин учителя")} />
        </div>
        <Button type="submit" variant="secondary" loading={busy}>
          {t("+ В жюри")}
        </Button>
      </form>
    </Card>
  );
}
