import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  GradeDialog,
  Loading,
  Modal,
  PageHeader,
  api,
  cx,
  formatDateTime,
  statusMeta,
  useAsync,
  useAuth,
  useDocumentTitle,
  type Attempt,
  type AttemptScope,
  type AttemptStatus,
  t,
} from "@kps/shared";

const STATUS_FILTERS: (AttemptStatus | null)[] = [null, "pending", "correct", "incorrect", "graded"];

export function Attempts() {
  useDocumentTitle(t("Решения"));
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const defaultScope: AttemptScope = user?.role === "student" ? "mine" : "authored";
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
    user && user.role !== "student"
      ? [
          { key: "authored", label: t("По моим задачам") },
          { key: "mine", label: t("Мои решения") },
        ]
      : [];

  return (
    <>
      <PageHeader
        title={scope === "mine" ? t("Мои решения") : t("Решения учеников")}
        subtitle={scope === "authored" ? t("Проверяйте решения, ожидающие оценки, и оставляйте комментарии") : undefined}
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
              {item ? statusMeta[item].label : t("Все статусы")}
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && (
        <EmptyState title={t("Решений пока нет")}>
          {scope === "mine" ? (
            <Link to="/catalog" className="text-primary hover:underline">
              {t("Перейти к задачам")}
            </Link>
          ) : (
            t("Когда ученики отправят решения, они появятся здесь.")
          )}
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">{t("Задача")}</th>
                {showStudent && <th className="px-5 py-3 font-medium">{t("Ученик")}</th>}
                <th className="px-5 py-3 font-medium">{t("Ответ")}</th>
                <th className="px-5 py-3 font-medium">{t("Статус")}</th>
                <th className="px-5 py-3 font-medium">{t("Дата")}</th>
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
                          {t("📎 фото решения")}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {attempt.teacher_grade !== null && <p className="mt-1 text-xs text-muted">{attempt.teacher_grade}  {t("баллов")}</p>}
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
                          {attempt.status === "pending" ? t("Оценить") : t("Изменить")}
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
      <Modal open={!!zoom} onClose={() => setZoom(null)} title={t("Фото решения")}>
        {zoom && <img src={zoom} alt={t("Фото решения")} className="max-h-[80vh] rounded-lg object-contain" />}
      </Modal>
    </>
  );
}
