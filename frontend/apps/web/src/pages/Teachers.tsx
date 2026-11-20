import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  Markdown,
  Modal,
  PageHeader,
  ProgressBar,
  StarInput,
  Stars,
  Textarea,
  api,
  certificateStatusMeta,
  cx,
  errorText,
  formatDate,
  formatRating,
  plural,
  useAsync,
  useAuth,
  useDocumentTitle,
  type Certificate,
  type Review,
  type TeacherProfile,
  t,
} from "@kps/shared";
import { TaskRow } from "./Catalog";

export function Teachers() {
  useDocumentTitle(t("Учителя"));
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [sort, setSort] = useState<"rating" | "tasks" | "new">("rating");
  const { data: subjects } = useAsync(() => api.subjects.list(), []);
  const { data, error, loading } = useAsync(
    () => api.teachers.list({ subject_id: subjectId ?? undefined, search: query || undefined, sort }),
    [subjectId, query, sort],
  );

  return (
    <>
      <PageHeader title={t("Учителя")} subtitle={t("Авторы задач платформы: опыт, подтверждённые достижения и отзывы учеников")} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form
          className="w-full sm:w-72"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Input placeholder={t("Имя или школа, Enter")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("Поиск учителей")} />
        </form>
        <select
          value={subjectId ?? ""}
          onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : null)}
          className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          aria-label={t("Предмет")}
        >
          <option value="">{t("Все предметы")}</option>
          {subjects?.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.title}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          aria-label={t("Сортировка")}
        >
          <option value="rating">{t("По рейтингу")}</option>
          <option value="tasks">{t("По числу задач")}</option>
          <option value="new">{t("Сначала новые")}</option>
        </select>
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState icon="🎓" title={t("Учителя не найдены")} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((teacher) => (
          <Link key={teacher.id} to={`/teachers/${teacher.id}`} className="group">
            <Card className="flex h-full flex-col gap-4 p-5 transition group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-lg">
              <div className="flex items-center gap-3">
                <Avatar src={teacher.avatar_url} name={teacher.name} size={52} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-fg group-hover:text-primary">
                    {teacher.name}
                    {teacher.verified_certificates > 0 && (
                      <span className="text-success" title={t("Есть подтверждённые достижения")}>
                        ✓
                      </span>
                    )}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted">{teacher.headline || t("Учитель")}</p>
                </div>
              </div>
              {teacher.subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {teacher.subjects.map((subject) => (
                    <Badge key={subject} tone="primary">
                      {subject}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-auto flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Stars value={teacher.rating} size="sm" />
                  <span className="font-medium text-fg">{formatRating(teacher.rating)}</span>
                  <span className="text-xs text-muted">({teacher.reviews_count})</span>
                </span>
                <span className="text-xs text-muted">
                  {teacher.tasks_count} {plural(teacher.tasks_count, ["задача", "задачи", "задач"])}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

function CertificateCard({ certificate, showStatus, onOpen }: { certificate: Certificate; showStatus?: boolean; onOpen: () => void }) {
  const meta = certificateStatusMeta[certificate.status];
  return (
    <Card className="flex items-center gap-4 p-4">
      <button
        onClick={onOpen}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-xs font-bold text-muted"
        aria-label={t("Открыть «{0}»", [certificate.title])}
      >
        {certificate.is_pdf ? "PDF" : <img src={certificate.file_url} alt="" className="h-full w-full object-cover" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{certificate.title}</p>
        <p className="text-xs text-muted">{[certificate.issuer, certificate.year].filter(Boolean).join(", ") || "—"}</p>
        {showStatus && certificate.status === "rejected" && certificate.reject_reason && (
          <p className="mt-1 text-xs text-danger">{t("Причина:")} {certificate.reject_reason}</p>
        )}
        <div className="mt-1.5">
          {showStatus ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge tone="success">{t("✓ Проверено")}</Badge>}
        </div>
      </div>
    </Card>
  );
}

function ReviewItem({ review, canReply, onReplied }: { review: Review; canReply: boolean; onReplied: (review: Review) => void }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState(review.reply);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      onReplied(await api.teachers.reply(review.id, text));
      setReplying(false);
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="space-y-2 px-6 py-5">
      <div className="flex items-center gap-3">
        <Avatar src={review.student_avatar_url} name={review.student_name || review.student_username} size={36} />
        <div className="flex-1">
          <p className="text-sm font-medium text-fg">{review.student_name || review.student_username}</p>
          <p className="text-xs text-muted">{formatDate(review.created_at)}</p>
        </div>
        <Stars value={review.rating} size="sm" />
      </div>
      {review.text && <p className="whitespace-pre-line text-sm text-fg">{review.text}</p>}
      {review.reply && !replying && (
        <div className="ml-6 rounded-xl border-l-2 border-primary bg-primary-soft/60 px-4 py-2.5 text-sm">
          <p className="mb-0.5 text-xs font-medium text-primary">{t("Ответ учителя")}</p>
          <p className="whitespace-pre-line text-fg">{review.reply}</p>
        </div>
      )}
      {canReply && !replying && (
        <button className="text-xs font-medium text-primary hover:underline" onClick={() => setReplying(true)}>
          {review.reply ? t("Изменить ответ") : t("Ответить")}
        </button>
      )}
      {replying && (
        <form onSubmit={save} className="ml-6 space-y-2">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t("Ваш ответ ученику")} aria-label={t("Ответ на отзыв")} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={saving}>
              {t("Сохранить")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
              {t("Отмена")}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function ReviewForm({ profile, onSaved }: { profile: TeacherProfile; onSaved: () => void }) {
  const [rating, setRating] = useState(profile.my_review?.rating ?? 0);
  const [text, setText] = useState(profile.my_review?.text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating) {
      setError(t("Поставьте оценку от 1 до 5"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.teachers.writeReview(profile.id, rating, text);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("Удалить ваш отзыв?"))) return;
    await api.teachers.deleteReview(profile.id).catch((err) => window.alert(errorText(err)));
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-b border-border px-6 py-5">
      <p className="text-sm font-medium text-fg">{profile.my_review ? t("Ваш отзыв") : t("Оставьте отзыв")}</p>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <StarInput value={rating} onChange={setRating} />
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t("Что понравилось, что можно улучшить?")} aria-label={t("Текст отзыва")} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={saving}>
          {profile.my_review ? t("Обновить отзыв") : t("Отправить")}
        </Button>
        {profile.my_review && (
          <Button size="sm" variant="ghost" onClick={remove}>
            {t("Удалить")}
          </Button>
        )}
      </div>
    </form>
  );
}

export function TeacherPage() {
  const teacherId = Number(useParams().teacherId);
  const { user } = useAuth();
  const [opened, setOpened] = useState<Certificate | null>(null);
  const { data, error, loading, reload, setData } = useAsync(async () => {
    const [profile, reviews, tasks] = await Promise.all([
      api.teachers.get(teacherId),
      api.teachers.reviews(teacherId),
      api.tasks.list({ author_id: teacherId }),
    ]);
    return { profile, reviews, tasks };
  }, [teacherId, user?.id]);
  useDocumentTitle(data?.profile.name);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? t("Учитель не найден")}</ErrorMessage>;
  const { profile, reviews, tasks } = data;
  const isOwner = user?.id === profile.id;
  const total = profile.reviews_count;

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-indigo-500/15 to-violet-500/15" aria-hidden />
        <div className="relative flex flex-wrap items-end gap-6">
          <Avatar src={profile.avatar_url} name={profile.name} size={104} />
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-fg sm:text-3xl">
              {profile.name}
              {profile.verified_certificates > 0 && <Badge tone="success">{t("✓ Достижения подтверждены")}</Badge>}
            </h1>
            {profile.headline && <p className="text-muted">{profile.headline}</p>}
            <div className="flex flex-wrap gap-1.5">
              {profile.subjects.map((subject) => (
                <Badge key={subject} tone="primary">
                  {subject}
                </Badge>
              ))}
              {profile.experience_years !== null && (
                <Badge>
                  {t("Стаж")} {profile.experience_years} {plural(profile.experience_years, ["год", "года", "лет"])}
                </Badge>
              )}
            </div>
          </div>
          {isOwner && (
            <ButtonLink to="/profile/teacher" variant="secondary" size="sm">
              {t("Редактировать профиль")}
            </ButtonLink>
          )}
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
          {[
            { label: t("Рейтинг"), value: formatRating(profile.rating), extra: <Stars value={profile.rating} size="sm" /> },
            { label: t("Отзывов"), value: profile.reviews_count },
            { label: t("Задач"), value: profile.tasks_count },
            { label: t("Учеников"), value: profile.students_count },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-xs text-muted">{stat.label}</p>
              <p className="flex items-center gap-2 text-2xl font-bold text-fg">
                {stat.value} {stat.extra}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          {profile.bio && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">{t("О себе")}</h2>
              <Card className="p-6">
                <Markdown source={profile.bio} />
              </Card>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-fg">
              {t("Задачи")} <span className="text-muted">{tasks.length}</span>
            </h2>
            {tasks.length === 0 ? (
              <EmptyState title={t("Пока нет задач")} />
            ) : (
              <Card className="divide-y divide-border overflow-hidden">
                {tasks.slice(0, 10).map((task) => (
                  <TaskRow key={task.id} task={task} to={`/tasks/${task.id}`} />
                ))}
              </Card>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-fg">
              {t("Отзывы учеников")} <span className="text-muted">{reviews.length}</span>
            </h2>
            <Card className="overflow-hidden">
              {profile.can_review && <ReviewForm profile={profile} onSaved={reload} />}
              {user?.role === "student" && !profile.can_review && (
                <p className="border-b border-border px-6 py-4 text-sm text-muted">
                  {t("Оставить отзыв можно после того, как вы порешаете задачи этого учителя.")}
                </p>
              )}
              {reviews.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted">{t("Отзывов пока нет")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {reviews.map((review) => (
                    <ReviewItem
                      key={review.id}
                      review={review}
                      canReply={isOwner}
                      onReplied={(updated) =>
                        setData((prev) => ({ ...prev!, reviews: prev!.reviews.map((r) => (r.id === updated.id ? updated : r)) }))
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-fg">{t("Оценки")}</h2>
            <Card className="space-y-2 p-5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = profile.rating_distribution[String(star)] ?? 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-muted">{star}★</span>
                    <div className="flex-1">
                      <ProgressBar value={count} max={total} />
                    </div>
                    <span className="w-6 text-right text-muted">{count}</span>
                  </div>
                );
              })}
            </Card>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-fg">{t("Достижения и сертификаты")}</h2>
            {profile.certificates.length === 0 ? (
              <p className="text-sm text-muted">{t("Пока нет подтверждённых документов.")}</p>
            ) : (
              <div className="space-y-3">
                {profile.certificates.map((certificate) => (
                  <CertificateCard key={certificate.id} certificate={certificate} showStatus={isOwner} onOpen={() => setOpened(certificate)} />
                ))}
              </div>
            )}
          </section>
          <p className="text-xs text-muted">{t("На платформе с")} {formatDate(profile.created_at)}</p>
        </aside>
      </div>

      <Modal open={!!opened} onClose={() => setOpened(null)} title={opened?.title}>
        {opened &&
          (opened.is_pdf ? (
            <iframe src={opened.file_url} title={opened.title} className="h-[80vh] w-[min(56rem,85vw)] rounded-lg" />
          ) : (
            <img src={opened.file_url} alt={opened.title} className="max-h-[80vh] rounded-lg object-contain" />
          ))}
      </Modal>
    </div>
  );
}

export function TeacherSettings() {
  useDocumentTitle(t("Профиль учителя"));
  const { user } = useAuth();
  const [form, setForm] = useState<{ headline: string; bio: string; experience: string; subjectIds: number[] } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cert, setCert] = useState<{ title: string; issuer: string; year: string; file: File | null }>({ title: "", issuer: "", year: "", file: null });
  const [certError, setCertError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, loading, reload, setData } = useAsync(async () => {
    const [profile, subjects] = await Promise.all([api.teachers.me(), api.subjects.list()]);
    setForm({
      headline: profile.headline,
      bio: profile.bio,
      experience: profile.experience_years === null ? "" : String(profile.experience_years),
      subjectIds: profile.subject_ids,
    });
    return { profile, subjects };
  }, [user?.id]);

  if (loading || !data || !form) return <Loading />;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const profile = await api.teachers.updateMe({
        headline: form.headline,
        bio: form.bio,
        experience_years: form.experience === "" ? null : Number(form.experience),
        subject_ids: form.subjectIds,
      });
      setData((prev) => ({ ...prev!, profile }));
      setStatus(t("Профиль сохранён"));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!cert.file) {
      setCertError(t("Выберите файл: PDF или фото"));
      return;
    }
    setUploading(true);
    setCertError(null);
    try {
      await api.teachers.addCertificate({ title: cert.title, issuer: cert.issuer, year: cert.year ? Number(cert.year) : null, file: cert.file });
      setCert({ title: "", issuer: "", year: "", file: null });
      (event.target as HTMLFormElement).reset();
      reload();
    } catch (err) {
      setCertError(errorText(err));
    } finally {
      setUploading(false);
    }
  };

  const removeCertificate = async (certificate: Certificate) => {
    if (!window.confirm(t("Удалить «{0}»?", [certificate.title]))) return;
    await api.teachers.deleteCertificate(certificate.id).catch((err) => window.alert(errorText(err)));
    reload();
  };

  const toggleSubject = (id: number) =>
    setForm({ ...form, subjectIds: form.subjectIds.includes(id) ? form.subjectIds.filter((s) => s !== id) : [...form.subjectIds, id] });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("Профиль учителя")}
        subtitle={t("Так вас видят ученики на странице учителя")}
        actions={
          <ButtonLink to={`/teachers/${data.profile.id}`} variant="secondary" size="sm">
            {t("Открыть мой профиль")}
          </ButtonLink>
        }
      />
      <div className="space-y-6">
        <Card className="p-6">
          <form onSubmit={save} className="space-y-5">
            {status && <div className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{status}</div>}
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <Input
              label={t("Кратко о себе")}
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              maxLength={150}
              placeholder={t("Учитель физики, лицей №1 г. Худжанда")}
            />
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <Input
                label={t("Стаж, лет")}
                type="number"
                min={0}
                max={70}
                value={form.experience}
                onChange={(e) => setForm({ ...form, experience: e.target.value })}
              />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-fg">{t("Предметы")}</p>
                <div className="flex flex-wrap gap-2">
                  {data.subjects.map((subject) => (
                    <button
                      type="button"
                      key={subject.id}
                      onClick={() => toggleSubject(subject.id)}
                      className={cx(
                        "rounded-xl border px-3 py-2 text-sm font-medium transition",
                        form.subjectIds.includes(subject.id) ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-fg",
                      )}
                    >
                      {subject.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Textarea
              label={t("О себе")}
              rows={6}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              maxLength={10000}
              hint={t("Опыт, достижения учеников, подход к обучению. Поддерживается Markdown.")}
            />
            <Button type="submit" loading={saving}>
              {t("Сохранить")}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-fg">{t("Достижения и сертификаты")}</h2>
          <p className="mb-4 text-sm text-muted">
            {t("Загрузите дипломы, сертификаты и грамоты. После проверки администратором они появятся в профиле со значком «Проверено».")}
          </p>
          <div className="mb-6 space-y-3">
            {data.profile.certificates.map((certificate) => (
              <div key={certificate.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <CertificateCard certificate={certificate} showStatus onOpen={() => window.open(certificate.file_url, "_blank")} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeCertificate(certificate)} aria-label={t("Удалить {0}", [certificate.title])}>
                  ✕
                </Button>
              </div>
            ))}
          </div>
          <form onSubmit={upload} className="space-y-4 rounded-xl border border-dashed border-border p-4">
            {certError && <ErrorMessage>{certError}</ErrorMessage>}
            <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
              <Input label={t("Название")} value={cert.title} onChange={(e) => setCert({ ...cert, title: e.target.value })} required minLength={2} placeholder={t("Победитель конкурса «Учитель года»")} />
              <Input label={t("Кем выдан")} value={cert.issuer} onChange={(e) => setCert({ ...cert, issuer: e.target.value })} placeholder={t("Министерство образования")} />
              <Input label={t("Год")} type="number" min={1950} max={2100} value={cert.year} onChange={(e) => setCert({ ...cert, year: e.target.value })} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setCert({ ...cert, file: e.target.files?.[0] ?? null })}
                className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg"
                aria-label={t("Файл документа")}
              />
              <Button type="submit" variant="secondary" loading={uploading}>
                {t("Загрузить на проверку")}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
