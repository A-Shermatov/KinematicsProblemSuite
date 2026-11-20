import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Difficulty,
  ErrorMessage,
  Input,
  Loading,
  Markdown,
  Modal,
  PageHeader,
  api,
  cx,
  errorText,
  formatDateTime,
  formatSource,
  statusMeta,
  useAsync,
  useAuth,
  useDocumentTitle,
  type Attempt,
} from "@kps/shared";

function AttemptResult({ attempt }: { attempt: Attempt }) {
  const meta = statusMeta[attempt.status];
  const styles = {
    success: "border-success/30 bg-success-soft text-success",
    danger: "border-danger/30 bg-danger-soft text-danger",
    warning: "border-warning/30 bg-warning-soft text-warning",
    primary: "border-primary/30 bg-primary-soft text-primary",
  }[meta.tone];
  return (
    <div className={cx("rounded-xl border px-4 py-3 text-sm", styles)} role="status">
      <p className="font-semibold">
        {meta.label}
        {attempt.teacher_grade !== null && ` · ${attempt.teacher_grade} баллов`}
      </p>
      {attempt.feedback && <p className="mt-0.5 opacity-90">{attempt.feedback}</p>}
      {attempt.correct_answer && attempt.status === "correct" && (
        <p className="mt-1 text-fg">
          Ответ: <span className="font-mono">{attempt.correct_answer}{attempt.task_unit ? ` ${attempt.task_unit}` : ""}</span>
        </p>
      )}
    </div>
  );
}

export function TaskPage() {
  const taskId = Number(useParams().taskId);
  const { user } = useAuth();
  const { data, error, loading, setData } = useAsync(async () => {
    const task = await api.tasks.get(taskId);
    const [siblings, attempts] = await Promise.all([
      api.tasks.list({ theme_id: task.theme_id }),
      user && user.role !== "admin" ? api.attempts.list({ scope: "mine", task_id: taskId }) : Promise.resolve([] as Attempt[]),
    ]);
    return { task, siblings, attempts };
  }, [taskId, user?.id]);
  useDocumentTitle(data?.task.title);

  const [answer, setAnswer] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [last, setLast] = useState<Attempt | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? "Задача не найдена"}</ErrorMessage>;
  const { task, siblings, attempts } = data;

  const index = siblings.findIndex((t) => t.id === task.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  const canSubmit = !!user && user.role !== "admin" && user.id !== task.author_id;
  const solved = task.solved || attempts.some((a) => a.status === "correct");

  const pickImage = (file: File | null) => {
    setImage(file);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const attempt = await api.attempts.submit(task.id, answer, image);
      setLast(attempt);
      setData((prev) => (prev ? { ...prev, attempts: [attempt, ...prev.attempts] } : prev!));
      if (attempt.status === "correct") setAnswer("");
      pickImage(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setSubmitError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const answerHint =
    task.answer_type === "number"
      ? `Число${task.unit ? `, по умолчанию в «${task.unit}»` : ""}. Можно с единицами: «72 км/ч», «2·10^3 м».`
      : "Текстовый ответ, регистр не важен.";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-6">
        <PageHeader
          title={task.title}
          breadcrumbs={[
            { label: "Каталог", to: "/catalog" },
            { label: task.subject_title, to: `/catalog#subject-${task.subject_id}` },
            { label: task.theme_title, to: `/themes/${task.theme_id}` },
          ]}
          actions={
            <div className="flex items-center gap-2">
              {solved && <Badge tone="success">✓ Решено</Badge>}
              <Difficulty value={task.difficulty} />
            </div>
          }
        />

        <Card className="p-6 sm:p-8">
          <Markdown source={task.condition} empty="Условие не указано" className="text-[15px] text-fg" />
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted">
            <span>
              Автор:{" "}
              <Link to={`/teachers/${task.author_id}`} className="text-primary hover:underline">
                {task.author_name}
              </Link>
            </span>
            {formatSource(task) && (
              <span>
                Источник: <span className="text-fg">{formatSource(task)}</span>
              </span>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-fg">Ваш ответ</h2>
          {!user ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              Чтобы отправить ответ, войдите в аккаунт.
              <ButtonLink to="/login" state={{ from: `/tasks/${task.id}` }} size="sm">
                Войти
              </ButtonLink>
            </div>
          ) : !canSubmit ? (
            <p className="text-sm text-muted">
              {user.role === "admin" ? "Администратор не отправляет решения." : "Это ваша задача — решения учеников смотрите в разделе «Решения»."}
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {last && <AttemptResult attempt={last} />}
              {submitError && <ErrorMessage>{submitError}</ErrorMessage>}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={task.answer_type === "number" ? `Например: 12.5${task.unit ? ` ${task.unit}` : ""}` : "Ответ"}
                    hint={answerHint}
                    aria-label="Ответ"
                    className="font-mono"
                  />
                </div>
                <Button type="submit" size="lg" loading={submitting} disabled={!answer.trim() && !image}>
                  Проверить
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  📎 {image ? "Заменить фото" : "Приложить фото решения"}
                </Button>
                {preview && (
                  <div className="flex items-center gap-2">
                    <img src={preview} alt="Фото решения" className="h-12 w-12 cursor-zoom-in rounded-lg object-cover" onClick={() => setZoom(preview)} />
                    <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => pickImage(null)}>
                      Убрать
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}
        </Card>

        {attempts.length > 0 && (
          <Card className="overflow-hidden">
            <h2 className="border-b border-border px-6 py-4 font-semibold text-fg">Мои попытки</h2>
            <ul className="divide-y divide-border">
              {attempts.map((attempt) => (
                <li key={attempt.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                  <Badge tone={statusMeta[attempt.status].tone}>{statusMeta[attempt.status].label}</Badge>
                  <span className="font-mono text-fg">{attempt.answer || "—"}</span>
                  {attempt.image_url && (
                    <button className="text-xs text-primary hover:underline" onClick={() => setZoom(attempt.image_url)}>
                      фото
                    </button>
                  )}
                  {attempt.feedback && attempt.status === "graded" && <span className="text-muted">«{attempt.feedback}»</span>}
                  <span className="ml-auto text-xs text-muted">{formatDateTime(attempt.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="flex justify-between gap-3">
          {prev ? (
            <ButtonLink to={`/tasks/${prev.id}`} variant="secondary">
              ← {prev.title}
            </ButtonLink>
          ) : (
            <span />
          )}
          {next && (
            <ButtonLink to={`/tasks/${next.id}`} variant="secondary">
              {next.title} →
            </ButtonLink>
          )}
        </div>
      </div>

      <aside className="hidden lg:block">
        <Card className="sticky top-24 overflow-hidden">
          <p className="border-b border-border px-4 py-3 text-sm font-semibold text-fg">{task.theme_title}</p>
          <nav className="max-h-[60vh] overflow-y-auto p-1.5">
            {siblings.map((sibling) => (
              <Link
                key={sibling.id}
                to={`/tasks/${sibling.id}`}
                className={cx(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  sibling.id === task.id ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <span className={cx("w-4 text-center", sibling.solved ? "text-success" : "text-border")}>{sibling.solved ? "✓" : "•"}</span>
                <span className="truncate">{sibling.title}</span>
              </Link>
            ))}
          </nav>
        </Card>
      </aside>

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Фото решения">
        {zoom && <img src={zoom} alt="Фото решения" className="max-h-[80vh] rounded-lg object-contain" />}
      </Modal>
    </div>
  );
}
