import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Loading,
  Markdown,
  Modal,
  PageHeader,
  Textarea,
  api,
  cx,
  errorText,
  formatRange,
  olympiadPhaseMeta,
  olympiadStatusMeta,
  useAsync,
  useDocumentTitle,
  type Olympiad,
  type OlympiadStatus,
} from "@kps/shared";
import { PUBLIC_URL } from "../config";

const FILTERS: (OlympiadStatus | null)[] = ["pending", "published", "rejected", "draft", null];

function Preview({ olympiad, onClose, onDecided }: { olympiad: Olympiad; onClose: () => void; onDecided: (o: Olympiad) => void }) {
  const { data, error, loading } = useAsync(() => api.olympiads.get(olympiad.id), [olympiad.id]);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const decide = async (status: "published" | "rejected") => {
    try {
      onDecided(await api.admin.reviewOlympiad(olympiad.id, status, reason));
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  return (
    <Modal open onClose={onClose} title={olympiad.title}>
      <div className="w-[min(52rem,88vw)] space-y-4 p-2">
        <div>
          <h2 className="text-xl font-semibold text-fg">{olympiad.title}</h2>
          <p className="text-sm text-muted">
            {olympiad.organizer_name} · {formatRange(olympiad.starts_at, olympiad.ends_at)} · {olympiad.subject_title ?? "разные предметы"}
          </p>
        </div>
        {olympiad.description && (
          <Card className="p-4">
            <Markdown source={olympiad.description} className="text-sm" />
          </Card>
        )}
        {loading && <Loading />}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {data?.tasks.map((task, index) => (
          <Card key={task.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 font-medium text-fg">
                {index + 1}. {task.title}
              </p>
              <Badge>{task.max_points} баллов</Badge>
              <Badge tone="primary">
                Ответ: {task.answer}
                {task.unit ? ` ${task.unit}` : ""}
              </Badge>
            </div>
            <Markdown source={task.condition} className="text-sm" empty="Без условия" />
          </Card>
        ))}
        {olympiad.status === "pending" && (
          <div className="space-y-3 border-t border-border pt-4">
            {rejecting && (
              <Textarea label="Что исправить (увидит учитель)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus maxLength={500} />
            )}
            <div className="flex justify-end gap-2">
              {rejecting ? (
                <>
                  <Button variant="ghost" onClick={() => setRejecting(false)}>
                    Назад
                  </Button>
                  <Button variant="danger" disabled={!reason.trim()} onClick={() => decide("rejected")}>
                    Вернуть на доработку
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="danger" onClick={() => setRejecting(true)}>
                    Вернуть на доработку
                  </Button>
                  <Button onClick={() => decide("published")}>Опубликовать</Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function Olympiads() {
  useDocumentTitle("Олимпиады");
  const [status, setStatus] = useState<OlympiadStatus | null>("pending");
  const [opened, setOpened] = useState<Olympiad | null>(null);
  const { data, error, loading, setData } = useAsync(() => api.admin.olympiads(status ?? undefined), [status]);

  return (
    <>
      <PageHeader title="Олимпиады" subtitle="Проверьте задачи и правила перед публикацией. Ответы видны только вам и организатору." />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item ?? "all"}
            onClick={() => setStatus(item)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              status === item ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted hover:text-fg",
            )}
          >
            {item ? olympiadStatusMeta[item].label : "Все"}
          </button>
        ))}
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState icon="🏁" title={status === "pending" ? "Нет олимпиад на проверке" : "Олимпиад нет"} />}
      {data && data.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.map((olympiad) => (
            <div key={olympiad.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{olympiad.title}</p>
                <p className="text-xs text-muted">
                  {olympiad.organizer_name} · {formatRange(olympiad.starts_at, olympiad.ends_at)} · {olympiad.tasks_count} задач ·{" "}
                  {olympiad.participants_count} участников
                </p>
              </div>
              <Badge tone={olympiadStatusMeta[olympiad.status].tone}>{olympiadStatusMeta[olympiad.status].label}</Badge>
              {olympiad.status === "published" && <Badge tone={olympiadPhaseMeta[olympiad.phase].tone}>{olympiadPhaseMeta[olympiad.phase].label}</Badge>}
              <div className="flex gap-2">
                <Button size="sm" variant={olympiad.status === "pending" ? "primary" : "secondary"} onClick={() => setOpened(olympiad)}>
                  {olympiad.status === "pending" ? "Проверить" : "Открыть"}
                </Button>
                {olympiad.status === "published" && olympiad.phase !== "upcoming" && (
                  <a href={`${PUBLIC_URL}/manage/olympiads/${olympiad.id}/jury`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-xl border border-border px-3 text-sm text-fg hover:bg-surface-2">
                    Жюри ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
      {opened && (
        <Preview
          olympiad={opened}
          onClose={() => setOpened(null)}
          onDecided={(updated) => {
            setData((prev) => (prev ?? []).map((item) => (item.id === updated.id ? updated : item)).filter((item) => !status || item.status === status));
            setOpened(null);
          }}
        />
      )}
    </>
  );
}
