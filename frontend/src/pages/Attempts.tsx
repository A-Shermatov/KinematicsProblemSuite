import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Attempt, type AttemptScope, type AttemptStatus } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, EmptyState, ErrorMessage, Input, Loading, Modal, PageHeader, Textarea, cx } from "../components/ui";
import { formatDateTime, statusMeta } from "../lib/format";
import { errorText, useAsync, useDocumentTitle } from "../lib/hooks";

const STATUS_FILTERS: (AttemptStatus | null)[] = [null, "pending", "correct", "incorrect", "graded"];

function GradeDialog({ attempt, onClose, onSaved }: { attempt: Attempt; onClose: () => void; onSaved: (a: Attempt) => void }) {
  const [grade, setGrade] = useState(String(attempt.teacher_grade ?? attempt.system_grade ?? 100));
  const [feedback, setFeedback] = useState(attempt.status === "graded" ? attempt.feedback : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.attempts.grade(attempt.id, Number(grade), feedback));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Оценка решения">
      <form onSubmit={submit} className="w-[min(36rem,85vw)] space-y-4 p-2">
        <div>
          <h2 className="text-lg font-semibold text-fg">{attempt.task_title}</h2>
          <p className="text-sm text-muted">
            {attempt.student_name || attempt.student_username} · {formatDateTime(attempt.created_at)}
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 p-4 text-sm">
          <p className="text-muted">Ответ ученика</p>
          <p className="mt-1 whitespace-pre-wrap font-mono text-fg">{attempt.answer || "—"}</p>
          {attempt.correct_answer && (
            <p className="mt-3 text-muted">
              Эталон: <span className="font-mono text-fg">{attempt.correct_answer}{attempt.task_unit ? ` ${attempt.task_unit}` : ""}</span>
            </p>
          )}
        </div>
        {attempt.image_url && (
          <a href={attempt.image_url} target="_blank" rel="noreferrer">
            <img src={attempt.image_url} alt="Фото решения" className="max-h-80 w-full rounded-xl object-contain" />
          </a>
        )}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Input label="Баллы (0–100)" type="number" min={0} max={100} value={grade} onChange={(e) => setGrade(e.target.value)} required />
          <Textarea label="Комментарий ученику" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={2000} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={saving}>
            Сохранить оценку
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Attempts() {
  useDocumentTitle("Решения");
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const defaultScope: AttemptScope = user?.role === "admin" ? "all" : user?.role === "teacher" ? "authored" : "mine";
  const scope = (params.get("scope") as AttemptScope | null) ?? defaultScope;
  const status = (params.get("status") as AttemptStatus | null) ?? null;
  const [grading, setGrading] = useState<Attempt | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const { data, error, loading, setData } = useAsync(
    () => api.attempts.list({ scope, status: status ?? undefined }),
    [scope, status],
  );

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const showStudent = scope !== "mine";
  const scopes: { key: AttemptScope; label: string }[] =
    user?.role === "admin"
      ? [
          { key: "all", label: "Все" },
          { key: "authored", label: "По моим задачам" },
        ]
      : user?.role === "teacher"
        ? [
            { key: "authored", label: "По моим задачам" },
            { key: "mine", label: "Мои решения" },
          ]
        : [];

  return (
    <>
      <PageHeader
        title={scope === "mine" ? "Мои решения" : "Решения учеников"}
        subtitle={scope === "authored" ? "Проверяйте решения, ожидающие оценки, и оставляйте комментарии" : undefined}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {scopes.length > 0 && (
          <div className="flex rounded-xl border border-border bg-surface p-1 text-sm">
            {scopes.map((item) => (
              <button
                key={item.key}
                onClick={() => update("scope", item.key)}
                className={cx("rounded-lg px-3 py-1.5 font-medium", scope === item.key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item ?? "all"}
              onClick={() => update("status", item)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                status === item ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted hover:text-fg",
              )}
            >
              {item ? statusMeta[item].label : "Все статусы"}
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && (
        <EmptyState title="Решений пока нет">
          {scope === "mine" ? (
            <Link to="/catalog" className="text-primary hover:underline">
              Перейти к задачам
            </Link>
          ) : (
            "Когда ученики отправят решения, они появятся здесь."
          )}
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Задача</th>
                {showStudent && <th className="px-5 py-3 font-medium">Ученик</th>}
                <th className="px-5 py-3 font-medium">Ответ</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Дата</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((attempt) => {
                const meta = statusMeta[attempt.status];
                const canGrade = user && (user.role === "admin" || attempt.task_author_id === user.id);
                return (
                  <tr key={attempt.id} className="align-top hover:bg-surface-2/60">
                    <td className="px-5 py-3.5">
                      <Link to={`/tasks/${attempt.task_id}`} className="font-medium text-fg hover:text-primary">
                        {attempt.task_title}
                      </Link>
                      <p className="text-xs text-muted">{attempt.theme_title}</p>
                    </td>
                    {showStudent && (
                      <td className="px-5 py-3.5">
                        <Link to={`/users/${attempt.student_id}`} className="text-fg hover:text-primary">
                          {attempt.student_name || attempt.student_username}
                        </Link>
                        <p className="text-xs text-muted">@{attempt.student_username}</p>
                      </td>
                    )}
                    <td className="max-w-56 px-5 py-3.5">
                      <p className="truncate font-mono text-fg" title={attempt.answer}>
                        {attempt.answer || "—"}
                      </p>
                      {attempt.image_url && (
                        <button className="text-xs text-primary hover:underline" onClick={() => setZoom(attempt.image_url)}>
                          📎 фото решения
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {attempt.teacher_grade !== null && <p className="mt-1 text-xs text-muted">{attempt.teacher_grade} баллов</p>}
                      {attempt.status === "graded" && attempt.feedback && (
                        <p className="mt-1 max-w-48 text-xs text-muted" title={attempt.feedback}>
                          «{attempt.feedback}»
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted">{formatDateTime(attempt.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {canGrade && scope !== "mine" && (
                        <Button size="sm" variant={attempt.status === "pending" ? "primary" : "secondary"} onClick={() => setGrading(attempt)}>
                          {attempt.status === "pending" ? "Оценить" : "Изменить"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {grading && (
        <GradeDialog
          attempt={grading}
          onClose={() => setGrading(null)}
          onSaved={(saved) => {
            setData((prev) => (prev ?? []).map((item) => (item.id === saved.id ? saved : item)));
            setGrading(null);
          }}
        />
      )}
      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Фото решения">
        {zoom && <img src={zoom} alt="Фото решения" className="max-h-[80vh] rounded-lg object-contain" />}
      </Modal>
    </>
  );
}
