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
  MarkdownEditor,
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
} from "@kps/shared";

export function ManageOlympiads() {
  useDocumentTitle("Мои олимпиады");
  const { data, error, loading } = useAsync(() => api.olympiads.mine(), []);
  return (
    <>
      <PageHeader
        title="Мои олимпиады"
        subtitle="Создайте олимпиаду, добавьте задачи и отправьте на проверку администратору"
        actions={<ButtonLink to="/manage/olympiads/new">+ Новая олимпиада</ButtonLink>}
      />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState icon="🏁" title="Вы ещё не проводили олимпиад" />}
      {data && data.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.map((olympiad) => {
            const status = olympiadStatusMeta[olympiad.status];
            return (
              <Link key={olympiad.id} to={`/manage/olympiads/${olympiad.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{olympiad.title}</p>
                  <p className="text-xs text-muted">
                    {formatRange(olympiad.starts_at, olympiad.ends_at)} · {olympiad.tasks_count} задач · {olympiad.participants_count} участников
                  </p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
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
};

function TaskForm({ olympiadId, task, nextPosition, onSaved, onCancel }: { olympiadId: number; task: OlympiadTask | null; nextPosition: number; onSaved: () => void; onCancel: () => void }) {
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
      const payload = { ...form, unit: form.answer_type === "number" ? form.unit?.trim() || null : null };
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
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Input label="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={150} />
        <Input label="Баллы" type="number" min={1} max={100} value={form.max_points} onChange={(e) => setForm({ ...form, max_points: Number(e.target.value) })} required />
      </div>
      <MarkdownEditor label="Условие" value={form.condition} onChange={(condition) => setForm({ ...form, condition })} rows={8} />
      <div className={cx("grid gap-4", form.answer_type === "number" ? "sm:grid-cols-[160px_1fr_120px_120px]" : "sm:grid-cols-[160px_1fr]")}>
        <Select label="Тип ответа" value={form.answer_type} onChange={(e) => setForm({ ...form, answer_type: e.target.value as AnswerType })}>
          <option value="number">Число</option>
          <option value="text">Текст</option>
        </Select>
        <Input
          label="Ответ (для автопроверки)"
          value={form.answer}
          onChange={(e) => setForm({ ...form, answer: e.target.value })}
          required
          className="font-mono"
          hint="Итоговый балл ставит жюри, автопроверка — подсказка"
        />
        {form.answer_type === "number" && (
          <>
            <Input label="Единицы" value={form.unit ?? ""} onChange={(e) => setForm({ ...form, unit: e.target.value || null })} placeholder="м/с" />
            <Input
              label="Погрешность, %"
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
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" loading={saving}>
          {task ? "Сохранить задачу" : "Добавить задачу"}
        </Button>
      </div>
    </form>
  );
}

export function OlympiadEditor() {
  const params = useParams();
  const olympiadId = params.olympiadId ? Number(params.olympiadId) : null;
  const navigate = useNavigate();
  useDocumentTitle(olympiadId ? "Олимпиада" : "Новая олимпиада");
  const defaultStart = new Date(Date.now() + 7 * 86400_000);
  defaultStart.setHours(10, 0, 0, 0);

  const [info, setInfo] = useState<{ title: string; description: string; subject_id: string; starts: string; ends: string } | null>(
    olympiadId
      ? null
      : {
          title: "",
          description: "",
          subject_id: "",
          starts: toLocalInput(defaultStart.toISOString()),
          ends: toLocalInput(new Date(defaultStart.getTime() + 3 * 3600_000).toISOString()),
        },
  );
  const [editingTask, setEditingTask] = useState<OlympiadTask | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, reload, setData } = useAsync(async () => {
    const [subjects, olympiad] = await Promise.all([api.subjects.list(), olympiadId ? api.olympiads.get(olympiadId) : Promise.resolve(null)]);
    if (olympiad) {
      setInfo({
        title: olympiad.title,
        description: olympiad.description,
        subject_id: olympiad.subject_id ? String(olympiad.subject_id) : "",
        starts: toLocalInput(olympiad.starts_at),
        ends: toLocalInput(olympiad.ends_at),
      });
    }
    return { subjects, olympiad };
  }, [olympiadId]);

  if (loading || !data || !info) return <Loading />;
  const olympiad: OlympiadDetail | null = data.olympiad;
  const editable = !olympiad || olympiad.status === "draft" || olympiad.status === "rejected";

  const saveInfo = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: info.title,
        description: info.description,
        subject_id: info.subject_id ? Number(info.subject_id) : null,
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
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={olympiad ? olympiad.title : "Новая олимпиада"}
        breadcrumbs={[{ label: "Мои олимпиады", to: "/manage/olympiads" }, { label: olympiad ? "Олимпиада" : "Новая" }]}
        actions={
          olympiad && (
            <div className="flex flex-wrap gap-2">
              {status && <Badge tone={status.tone} className="px-3 py-1 text-sm">{status.label}</Badge>}
              {olympiad.status === "published" && (
                <>
                  <ButtonLink to={`/olympiads/${olympiad.id}`} variant="secondary" size="sm">
                    Страница олимпиады
                  </ButtonLink>
                  {olympiad.phase !== "upcoming" && (
                    <ButtonLink to={`/manage/olympiads/${olympiad.id}/jury`} size="sm">
                      Жюри{olympiad.ungraded_count ? ` · ${olympiad.ungraded_count}` : ""}
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
        <Card className="border-danger/30 bg-danger-soft p-4 text-sm text-danger">Администратор вернул олимпиаду: {olympiad.reject_reason}</Card>
      )}
      {olympiad?.status === "pending" && (
        <Card className="border-warning/30 bg-warning-soft p-4 text-sm text-warning">Олимпиада на проверке у администратора. Изменения недоступны.</Card>
      )}

      <Card className="p-6">
        <form onSubmit={saveInfo} className="space-y-4">
          <fieldset disabled={!editable} className="space-y-4">
            <Input label="Название" value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} required minLength={3} maxLength={150} placeholder="Осенняя олимпиада по физике, 9–11 классы" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Предмет" value={info.subject_id} onChange={(e) => setInfo({ ...info, subject_id: e.target.value })}>
                <option value="">Разные предметы</option>
                {data.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.title}
                  </option>
                ))}
              </Select>
              <Input label="Начало" type="datetime-local" value={info.starts} onChange={(e) => setInfo({ ...info, starts: e.target.value })} required />
              <Input label="Окончание" type="datetime-local" value={info.ends} onChange={(e) => setInfo({ ...info, ends: e.target.value })} required />
            </div>
            <Textarea
              label="Описание и правила"
              rows={5}
              value={info.description}
              onChange={(e) => setInfo({ ...info, description: e.target.value })}
              hint="Для кого олимпиада, формат, призы. Поддерживается Markdown."
            />
          </fieldset>
          {editable && (
            <Button type="submit" loading={saving}>
              {olympiad ? "Сохранить" : "Создать и перейти к задачам"}
            </Button>
          )}
        </form>
      </Card>

      {olympiad && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">
              Задачи · {olympiad.tasks.length} · {olympiad.max_score} баллов
            </h2>
            {editable && editingTask === null && (
              <Button size="sm" onClick={() => setEditingTask("new")}>
                + Задача
              </Button>
            )}
          </div>
          {olympiad.tasks.map((task, index) =>
            editingTask !== "new" && editingTask?.id === task.id ? (
              <Card key={task.id} className="p-6">
                <TaskForm olympiadId={olympiad.id} task={task} nextPosition={index} onSaved={() => { setEditingTask(null); reload(); }} onCancel={() => setEditingTask(null)} />
              </Card>
            ) : (
              <Card key={task.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 font-medium text-fg">
                    {index + 1}. {task.title}
                  </p>
                  <Badge>{task.max_points} баллов</Badge>
                  <Badge tone="primary">
                    Ответ: {task.answer}
                    {task.unit ? ` ${task.unit}` : ""}
                  </Badge>
                  {editable && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditingTask(task)}>
                        Изменить
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => window.confirm(`Удалить задачу «${task.title}»?`) && action(() => api.olympiads.removeTask(olympiad.id, task.id))}
                      >
                        Удалить
                      </Button>
                    </>
                  )}
                </div>
                <Markdown source={task.condition} className="text-sm" empty="Без условия" />
              </Card>
            ),
          )}
          {editingTask === "new" && (
            <Card className="p-6">
              <TaskForm olympiadId={olympiad.id} task={null} nextPosition={olympiad.tasks.length} onSaved={() => { setEditingTask(null); reload(); }} onCancel={() => setEditingTask(null)} />
            </Card>
          )}
          {olympiad.tasks.length === 0 && editingTask === null && <EmptyState title="Добавьте задачи олимпиады" />}
        </section>
      )}

      {olympiad && editable && (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <p className="flex-1 text-sm text-muted">Когда всё готово, отправьте олимпиаду администратору. После публикации задачи изменить нельзя.</p>
          <Button variant="ghost" onClick={() => window.confirm("Удалить олимпиаду?") && action(async () => { await api.olympiads.remove(olympiad.id); navigate("/manage/olympiads"); })}>
            Удалить
          </Button>
          <Button onClick={() => action(() => api.olympiads.submitForReview(olympiad.id))} disabled={olympiad.tasks.length === 0}>
            Отправить на проверку
          </Button>
        </Card>
      )}
    </div>
  );
}

function GradeRow({ olympiadId, submission, onSaved, onZoom, locked }: { olympiadId: number; submission: OlympiadSubmission; onSaved: (s: OlympiadSubmission) => void; onZoom: (url: string) => void; locked: boolean }) {
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
      <button type="button" onClick={() => onZoom(submission.image_url)} className="h-24 w-24 overflow-hidden rounded-lg bg-surface-2" aria-label="Открыть фото решения">
        <img src={submission.image_url} alt="" className="h-full w-full object-cover" />
      </button>
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium text-fg">
          {submission.user_name || submission.username}
          <span className="font-normal text-muted"> · {[submission.school, submission.city].filter(Boolean).join(", ") || `@${submission.username}`}</span>
        </p>
        <p className="text-muted">
          Задача {submission.task_position + 1}. {submission.task_title} · отправлено {formatDateTime(submission.submitted_at)}
        </p>
        <p>
          Ответ: <span className="font-mono text-fg">{submission.answer || "—"}</span> · эталон{" "}
          <span className="font-mono text-fg">{submission.correct_answer}</span>{" "}
          <Badge tone={submission.auto_correct ? "success" : "danger"}>{submission.auto_correct ? "авто: верно" : "авто: неверно"}</Badge>
        </p>
        <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий участнику" disabled={locked} aria-label="Комментарий" />
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
          aria-label="Баллы"
        />
        <span className="pt-3 text-sm text-muted">/ {submission.max_points}</span>
        {!locked && (
          <Button type="submit" size="sm" className="mt-1.5" loading={saving} variant={submission.jury_points === null ? "primary" : "secondary"}>
            {submission.jury_points === null ? "Оценить" : "✓"}
          </Button>
        )}
      </div>
    </form>
  );
}

export function OlympiadJury() {
  const olympiadId = Number(useParams().olympiadId);
  useDocumentTitle("Жюри");
  const [taskId, setTaskId] = useState<number | null>(null);
  const [ungraded, setUngraded] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, loading, setData, reload } = useAsync(async () => {
    const [olympiad, submissions] = await Promise.all([
      api.olympiads.get(olympiadId),
      api.olympiads.jury(olympiadId, { task_id: taskId ?? undefined, ungraded: ungraded || undefined }),
    ]);
    return { olympiad, submissions };
  }, [olympiadId, taskId, ungraded]);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorMessage>Олимпиада не найдена</ErrorMessage>;
  const { olympiad, submissions } = data;
  const locked = olympiad.phase === "finished";
  const left = submissions.filter((s) => s.jury_points === null).length;

  const publish = async () => {
    setError(null);
    const force = (olympiad.ungraded_count ?? 0) > 0;
    if (force && !window.confirm(`Не проверено ${olympiad.ungraded_count} решений — для них останется балл автопроверки. Опубликовать?`)) return;
    try {
      await api.olympiads.publishResults(olympiad.id, force);
      reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Жюри: ${olympiad.title}`}
        subtitle="Балл жюри заменяет автопроверку. Можно снизить за списанное или неполное решение и дать частичный балл."
        breadcrumbs={[{ label: "Мои олимпиады", to: "/manage/olympiads" }, { label: olympiad.title, to: `/manage/olympiads/${olympiad.id}` }, { label: "Жюри" }]}
        actions={
          olympiad.phase === "checking" ? (
            <Button onClick={publish}>Опубликовать итоги</Button>
          ) : locked ? (
            <ButtonLink to={`/olympiads/${olympiad.id}`} variant="secondary">
              Итоги опубликованы
            </ButtonLink>
          ) : (
            <Badge tone="success">Олимпиада идёт — проверять можно уже сейчас</Badge>
          )
        }
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={taskId ?? ""}
          onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          aria-label="Задача"
        >
          <option value="">Все задачи</option>
          {olympiad.tasks.map((task, index) => (
            <option key={task.id} value={task.id}>
              {index + 1}. {task.title}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={ungraded} onChange={(e) => setUngraded(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Только непроверенные
        </label>
        <span className="text-sm text-muted">
          Не проверено в списке: {left} из {submissions.length}
        </span>
      </div>
      {submissions.length === 0 ? (
        <EmptyState icon="📭" title="Решений нет" />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {submissions.map((submission) => (
            <GradeRow
              key={submission.id}
              olympiadId={olympiad.id}
              submission={submission}
              locked={locked}
              onZoom={setZoom}
              onSaved={(saved) => setData((prev) => ({ ...prev!, submissions: prev!.submissions.map((s) => (s.id === saved.id ? saved : s)) }))}
            />
          ))}
        </Card>
      )}
      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Фото решения">
        {zoom && <img src={zoom} alt="Фото решения" className="max-h-[85vh] rounded-lg object-contain" />}
      </Modal>
    </div>
  );
}
