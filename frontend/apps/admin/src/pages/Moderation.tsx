import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Loading,
  Modal,
  PageHeader,
  Stars,
  Textarea,
  api,
  certificateStatusMeta,
  cx,
  errorText,
  formatDate,
  formatDateTime,
  useAsync,
  useDocumentTitle,
  type Certificate,
  type CertificateStatus,
} from "@kps/shared";
import { PUBLIC_URL } from "../config";

const CERT_FILTERS: (CertificateStatus | null)[] = ["pending", "verified", "rejected", null];

function FilterChips<T extends string>({ items, value, onChange, label }: { items: (T | null)[]; value: T | null; onChange: (v: T | null) => void; label: (v: T | null) => string }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item ?? "all"}
          onClick={() => onChange(item)}
          className={cx(
            "rounded-full border px-3 py-1.5 text-xs font-medium",
            value === item ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted hover:text-fg",
          )}
        >
          {label(item)}
        </button>
      ))}
    </div>
  );
}

export function Certificates() {
  useDocumentTitle("Сертификаты");
  const [status, setStatus] = useState<CertificateStatus | null>("pending");
  const [opened, setOpened] = useState<Certificate | null>(null);
  const [rejecting, setRejecting] = useState<Certificate | null>(null);
  const [reason, setReason] = useState("");
  const { data, error, loading, setData } = useAsync(() => api.admin.certificates(status ?? undefined), [status]);

  const decide = async (certificate: Certificate, decision: "verified" | "rejected", why = "") => {
    try {
      const updated = await api.admin.reviewCertificate(certificate.id, decision, why);
      setData((prev) => (prev ?? []).map((item) => (item.id === updated.id ? updated : item)).filter((item) => !status || item.status === status));
      setRejecting(null);
      setReason("");
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  return (
    <>
      <PageHeader title="Сертификаты учителей" subtitle="Проверьте документ и подтвердите его — в профиле учителя появится значок «Проверено»" />
      <FilterChips items={CERT_FILTERS} value={status} onChange={setStatus} label={(v) => (v ? certificateStatusMeta[v].label : "Все")} />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState icon="📄" title={status === "pending" ? "Нет документов на проверке" : "Документов нет"} />}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((certificate) => {
          const meta = certificateStatusMeta[certificate.status];
          return (
            <Card key={certificate.id} className="flex gap-4 p-4">
              <button
                onClick={() => setOpened(certificate)}
                className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-sm font-bold text-muted"
                aria-label="Открыть документ"
              >
                {certificate.is_pdf ? "PDF" : <img src={certificate.file_url} alt="" className="h-full w-full object-cover" />}
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-fg">{certificate.title}</p>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                <p className="text-xs text-muted">{[certificate.issuer, certificate.year].filter(Boolean).join(", ") || "Без данных о выдаче"}</p>
                <p className="text-xs text-muted">
                  <a href={`${PUBLIC_URL}/teachers/${certificate.teacher_id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {certificate.teacher_name}
                  </a>{" "}
                  · загружен {formatDateTime(certificate.created_at)}
                </p>
                {certificate.reject_reason && <p className="text-xs text-danger">Причина: {certificate.reject_reason}</p>}
                <div className="flex gap-2 pt-2">
                  {certificate.status !== "verified" && (
                    <Button size="sm" onClick={() => decide(certificate, "verified")}>
                      Подтвердить
                    </Button>
                  )}
                  {certificate.status !== "rejected" && (
                    <Button size="sm" variant="danger" onClick={() => setRejecting(certificate)}>
                      Отклонить
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!opened} onClose={() => setOpened(null)} title={opened?.title}>
        {opened &&
          (opened.is_pdf ? (
            <iframe src={opened.file_url} title={opened.title} className="h-[80vh] w-[min(56rem,85vw)] rounded-lg" />
          ) : (
            <img src={opened.file_url} alt={opened.title} className="max-h-[80vh] rounded-lg object-contain" />
          ))}
      </Modal>
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Отклонить документ">
        {rejecting && (
          <form
            className="w-[min(28rem,85vw)] space-y-4 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void decide(rejecting, "rejected", reason);
            }}
          >
            <h2 className="text-lg font-semibold text-fg">Отклонить «{rejecting.title}»</h2>
            <Textarea label="Причина (увидит учитель)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                Отмена
              </Button>
              <Button type="submit" variant="danger">
                Отклонить
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function Reviews() {
  useDocumentTitle("Отзывы");
  const [hidden, setHidden] = useState<"visible" | "hidden" | null>(null);
  const { data, error, loading, setData } = useAsync(
    () => api.admin.reviews(hidden === null ? undefined : hidden === "hidden"),
    [hidden],
  );

  const toggle = async (id: number, isHidden: boolean) => {
    try {
      const updated = await api.admin.setReviewHidden(id, isHidden);
      setData((prev) => (prev ?? []).map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  return (
    <>
      <PageHeader title="Отзывы об учителях" subtitle="Скрытые отзывы не видны на сайте и не учитываются в рейтинге" />
      <FilterChips
        items={[null, "visible", "hidden"]}
        value={hidden}
        onChange={setHidden}
        label={(v) => (v === "visible" ? "Опубликованные" : v === "hidden" ? "Скрытые" : "Все")}
      />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState icon="💬" title="Отзывов нет" />}
      {data && data.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.map((review) => (
            <div key={review.id} className={cx("flex gap-4 px-5 py-4", review.is_hidden && "opacity-60")}>
              <Avatar src={review.student_avatar_url} name={review.student_name || review.student_username} size={36} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-fg">{review.student_name || review.student_username}</span>
                  <span className="text-muted">→</span>
                  <a href={`${PUBLIC_URL}/teachers/${review.teacher_id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {review.teacher_name}
                  </a>
                  <Stars value={review.rating} size="sm" />
                  <span className="text-xs text-muted">{formatDate(review.created_at)}</span>
                  {review.is_hidden && <Badge tone="danger">Скрыт</Badge>}
                </div>
                {review.text && <p className="whitespace-pre-line text-sm text-fg">{review.text}</p>}
                {review.reply && <p className="text-xs text-muted">Ответ учителя: {review.reply}</p>}
              </div>
              <div>
                <Button size="sm" variant={review.is_hidden ? "secondary" : "danger"} onClick={() => toggle(review.id, !review.is_hidden)}>
                  {review.is_hidden ? "Показать" : "Скрыть"}
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
