import { useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  useDocumentTitle,
  type Attempt,
  type AttemptStatus,
  Pagination,
  usePaged,
} from "@kps/shared";
import { PUBLIC_URL } from "../config";

const STATUS_FILTERS: (AttemptStatus | null)[] = [null, "pending", "correct", "incorrect", "graded"];

export function Attempts() {
  useDocumentTitle("Решения");
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as AttemptStatus | null) ?? null;
  const [grading, setGrading] = useState<Attempt | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const { data, error, loading, setData } = useAsync(() => api.admin.attempts({ status: status ?? undefined }), [status]);
  const paged = usePaged(data ?? [], 50, String(status));

  const setStatus = (value: AttemptStatus | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set("status", value);
    else next.delete("status");
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title="Все решения" subtitle="Администратор может проверить или переоценить любое решение" />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item ?? "all"}
            onClick={() => setStatus(item)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              status === item ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted hover:text-fg",
            )}
          >
            {item ? statusMeta[item].label : "Все статусы"}
          </button>
        ))}
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState title="Решений нет" />}
      {data && data.length > 0 && (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Задача</th>
                  <th className="px-5 py-3 font-medium">Ученик</th>
                  <th className="px-5 py-3 font-medium">Ответ</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium">Дата</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.pageItems.map((attempt) => (
                  <tr key={attempt.id} className="align-top hover:bg-surface-2/60">
                    <td className="px-5 py-3.5">
                      <a href={`${PUBLIC_URL}/tasks/${attempt.task_id}`} target="_blank" rel="noreferrer" className="font-medium text-fg hover:text-primary">
                        {attempt.task_title}
                      </a>
                      <p className="text-xs text-muted">{attempt.theme_title}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-fg">{attempt.student_name || attempt.student_username}</p>
                      <p className="text-xs text-muted">@{attempt.student_username}</p>
                    </td>
                    <td className="max-w-56 px-5 py-3.5">
                      <p className="truncate font-mono text-fg" title={attempt.answer}>
                        {attempt.answer || "—"}
                      </p>
                      {attempt.correct_answer && <p className="text-xs text-muted">эталон: {attempt.correct_answer}</p>}
                      {attempt.image_url && (
                        <button className="text-xs text-primary hover:underline" onClick={() => setZoom(attempt.image_url)}>
                          📎 фото
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={statusMeta[attempt.status].tone}>{statusMeta[attempt.status].label}</Badge>
                      {attempt.teacher_grade !== null && <p className="mt-1 text-xs text-muted">{attempt.teacher_grade} баллов</p>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted">{formatDateTime(attempt.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Button size="sm" variant={attempt.status === "pending" ? "primary" : "secondary"} onClick={() => setGrading(attempt)}>
                        {attempt.status === "pending" ? "Оценить" : "Изменить"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} total={paged.total} />
        </>
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
