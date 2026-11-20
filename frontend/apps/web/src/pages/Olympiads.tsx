import { useRef, useState, type FormEvent } from "react";
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
  api,
  cx,
  errorText,
  formatCountdown,
  formatDateTime,
  formatRange,
  olympiadPhaseMeta,
  plural,
  useAsync,
  useAuth,
  useDocumentTitle,
  useNow,
  type Olympiad,
  type OlympiadDetail,
  type OlympiadPhase,
  type OlympiadResults,
  type OlympiadSubmission,
  type OlympiadTask,
} from "@kps/shared";

const PHASE_TABS: { key: OlympiadPhase; label: string }[] = [
  { key: "running", label: "Идут сейчас" },
  { key: "upcoming", label: "Скоро" },
  { key: "finished", label: "Завершены" },
];
const DIPLOMA = { 1: "Диплом I степени", 2: "Диплом II степени", 3: "Диплом III степени" } as const;
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;

function Countdown({ to, label }: { to: string; label: string }) {
  const now = useNow();
  const left = new Date(to).getTime() - now;
  if (left <= 0) return null;
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono text-2xl font-bold tabular-nums text-fg">{formatCountdown(left)}</p>
    </div>
  );
}

export function OlympiadCard({ olympiad }: { olympiad: Olympiad }) {
  const phase = olympiadPhaseMeta[olympiad.phase];
  return (
    <Link to={`/olympiads/${olympiad.id}`} className="group">
      <Card className="flex h-full flex-col gap-3 p-5 transition group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={phase.tone}>
            {olympiad.phase === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />}
            {phase.label}
          </Badge>
          {olympiad.is_registered && <Badge tone="primary">✓ Вы участник</Badge>}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-fg group-hover:text-primary">{olympiad.title}</p>
          <p className="mt-1 text-sm text-muted">{olympiad.subject_title ?? "Разные предметы"}</p>
        </div>
        <p className="text-sm text-fg">🗓 {formatRange(olympiad.starts_at, olympiad.ends_at)}</p>
        <p className="text-xs text-muted">
          {olympiad.tasks_count} {plural(olympiad.tasks_count, ["задача", "задачи", "задач"])} · {olympiad.participants_count}{" "}
          {plural(olympiad.participants_count, ["участник", "участника", "участников"])} · {olympiad.organizer_name}
        </p>
      </Card>
    </Link>
  );
}

export function Olympiads() {
  useDocumentTitle("Олимпиады");
  const { user } = useAuth();
  const [phase, setPhase] = useState<OlympiadPhase>("running");
  const { data, error, loading } = useAsync(() => api.olympiads.list(phase), [phase, user?.id]);

  return (
    <>
      <PageHeader
        title="Олимпиады"
        subtitle="Решайте в общее время со всеми, прикладывайте фото решения — жюри проверит и выдаст дипломы призёрам"
        actions={
          user?.role === "teacher" && (
            <ButtonLink to="/manage/olympiads" variant="secondary">
              Мои олимпиады
            </ButtonLink>
          )
        }
      />
      <div className="mb-6 flex rounded-xl border border-border bg-surface p-1 text-sm sm:w-fit">
        {PHASE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPhase(tab.key)}
            className={cx("flex-1 rounded-lg px-4 py-1.5 font-medium", phase === tab.key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && (
        <EmptyState icon="🏁" title={phase === "running" ? "Сейчас олимпиад нет" : phase === "upcoming" ? "Скоро олимпиад нет" : "Пока нет завершённых олимпиад"}>
          {phase === "running" && (
            <button className="text-primary hover:underline" onClick={() => setPhase("upcoming")}>
              Посмотреть ближайшие
            </button>
          )}
        </EmptyState>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((olympiad) => (
          <OlympiadCard key={olympiad.id} olympiad={olympiad} />
        ))}
      </div>
    </>
  );
}

function SubmitForm({ olympiadId, task, submission, onSaved }: { olympiadId: number; task: OlympiadTask; submission?: OlympiadSubmission; onSaved: (s: OlympiadSubmission) => void }) {
  const [answer, setAnswer] = useState(submission?.answer ?? "");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!image) {
      setError("Фото решения обязательно");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.olympiads.submit(olympiadId, task.id, answer, image));
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
      {submission && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-success-soft px-4 py-2.5 text-sm text-success">
          ✓ Решение отправлено в {formatDateTime(submission.submitted_at)}
          {submission.answer && (
            <span className="text-fg">
              · ответ: <span className="font-mono">{submission.answer}</span>
            </span>
          )}
          <a href={submission.image_url} target="_blank" rel="noreferrer" className="ml-auto text-xs underline">
            фото
          </a>
        </div>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-start">
        <Input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={task.answer_type === "number" ? `Ответ${task.unit ? `, ${task.unit}` : ""}` : "Ответ"}
          aria-label={`Ответ к задаче ${task.title}`}
          className="font-mono"
        />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        <Button variant={image ? "secondary" : "primary"} onClick={() => fileRef.current?.click()} className={cx(!image && "bg-warning-soft text-warning hover:bg-warning-soft")}>
          📷 {image ? image.name.slice(0, 18) : "Фото решения *"}
        </Button>
        <Button type="submit" loading={saving}>
          {submission ? "Отправить заново" : "Отправить"}
        </Button>
      </div>
      <p className="text-xs text-muted">Засчитывается последнее отправленное решение. Без фото решения ответ не принимается.</p>
    </form>
  );
}

function ResultsTable({ results, tasks, highlight }: { results: OlympiadResults; tasks: OlympiadTask[]; highlight?: number }) {
  if (results.rows.length === 0) return <EmptyState title="Никто не отправил решений" />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Место</th>
            <th className="px-4 py-3 font-medium">Участник</th>
            {tasks.map((task, index) => (
              <th key={task.id} className="px-2 py-3 text-center font-medium" title={task.title}>
                {index + 1}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium">Сумма</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {results.rows.map((row) => (
            <tr key={row.user_id} className={cx(row.user_id === highlight && "bg-primary-soft/60")}>
              <td className="px-4 py-3 text-lg font-bold text-muted">{row.diploma ? MEDAL[row.diploma] : row.place}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar src={row.avatar_url} name={row.name || row.username} size={32} />
                  <div className="min-w-0">
                    <Link to={`/users/${row.user_id}`} className="font-medium text-fg hover:text-primary">
                      {row.name || row.username}
                    </Link>
                    <p className="truncate text-xs text-muted">{[row.school, row.city].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
              </td>
              {tasks.map((task) => (
                <td key={task.id} className="px-2 py-3 text-center tabular-nums text-fg">
                  {row.task_points[String(task.id)] ?? "—"}
                </td>
              ))}
              <td className="px-4 py-3 text-right text-base font-bold tabular-nums text-primary">
                {row.total}
                <span className="text-xs font-normal text-muted"> / {results.max_score}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function OlympiadPage() {
  const olympiadId = Number(useParams().olympiadId);
  const { user } = useAuth();
  const now = useNow(5000);
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, setData, reload } = useAsync(async () => {
    const olympiad = await api.olympiads.get(olympiadId);
    const [submissions, results] = await Promise.all([
      olympiad.is_registered ? api.olympiads.mySubmissions(olympiadId) : Promise.resolve([] as OlympiadSubmission[]),
      olympiad.phase === "finished" ? api.olympiads.results(olympiadId) : Promise.resolve(null),
    ]);
    return { olympiad, submissions, results };
  }, [olympiadId, user?.id]);
  useDocumentTitle(data?.olympiad.title);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? "Олимпиада не найдена"}</ErrorMessage>;
  const { olympiad, submissions, results } = data;
  const phase = olympiadPhaseMeta[olympiad.phase];
  const byTask = new Map(submissions.map((s) => [s.task_id, s]));
  const myRow = results?.rows.find((row) => row.user_id === user?.id);
  // Этап мог смениться, пока страница открыта.
  const phaseChanged =
    (olympiad.phase === "upcoming" && now >= new Date(olympiad.starts_at).getTime()) ||
    (olympiad.phase === "running" && now >= new Date(olympiad.ends_at).getTime());

  const toggleRegistration = async () => {
    setBusy(true);
    try {
      if (olympiad.is_registered) {
        await api.olympiads.unregister(olympiad.id);
        reload();
      } else {
        const updated: OlympiadDetail = await api.olympiads.register(olympiad.id);
        setData((prev) => ({ ...prev!, olympiad: updated }));
      }
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={phase.tone}>{phase.label}</Badge>
              {olympiad.subject_title && <Badge>{olympiad.subject_title}</Badge>}
              {olympiad.is_registered && <Badge tone="primary">✓ Вы участник</Badge>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{olympiad.title}</h1>
            <p className="text-sm text-muted">
              🗓 {formatRange(olympiad.starts_at, olympiad.ends_at)} · организатор{" "}
              <Link to={`/teachers/${olympiad.organizer_id}`} className="text-primary hover:underline">
                {olympiad.organizer_name}
              </Link>
            </p>
            <p className="text-sm text-muted">
              {olympiad.tasks_count} {plural(olympiad.tasks_count, ["задача", "задачи", "задач"])} · максимум {olympiad.max_score} баллов ·{" "}
              {olympiad.participants_count} {plural(olympiad.participants_count, ["участник", "участника", "участников"])}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            {olympiad.phase === "upcoming" && <Countdown to={olympiad.starts_at} label="До начала" />}
            {olympiad.phase === "running" && <Countdown to={olympiad.ends_at} label="До конца" />}
            {user?.role === "student" && (olympiad.phase === "upcoming" || (olympiad.phase === "running" && !olympiad.is_registered)) && (
              <Button onClick={toggleRegistration} loading={busy} variant={olympiad.is_registered ? "secondary" : "primary"} size="lg">
                {olympiad.is_registered ? "Отменить участие" : "Участвовать"}
              </Button>
            )}
            {!user && olympiad.phase !== "finished" && (
              <ButtonLink to="/login" state={{ from: `/olympiads/${olympiad.id}` }} size="lg">
                Войти, чтобы участвовать
              </ButtonLink>
            )}
            {olympiad.can_manage && (
              <ButtonLink to={`/manage/olympiads/${olympiad.id}`} variant="secondary" size="sm">
                Управление
              </ButtonLink>
            )}
          </div>
        </div>
      </Card>

      {phaseChanged && (
        <Card className="flex flex-wrap items-center gap-4 border-primary/40 bg-primary-soft p-4">
          <p className="flex-1 text-sm text-fg">{olympiad.phase === "upcoming" ? "Олимпиада началась!" : "Время вышло — олимпиада завершена."}</p>
          <Button size="sm" onClick={reload}>
            Обновить
          </Button>
        </Card>
      )}

      {olympiad.description && (
        <Card className="p-6">
          <Markdown source={olympiad.description} />
        </Card>
      )}

      {olympiad.phase === "upcoming" && (
        <EmptyState icon="🔒" title="Условия откроются в момент начала">
          Зарегистрируйтесь заранее — в {formatDateTime(olympiad.starts_at)} задачи появятся на этой странице.
        </EmptyState>
      )}

      {olympiad.phase === "checking" && (
        <EmptyState icon="🧐" title="Олимпиада завершена, жюри проверяет решения">
          Итоги и дипломы появятся здесь после публикации.
        </EmptyState>
      )}

      {myRow && (
        <Card className="flex flex-wrap items-center gap-4 border-primary/30 p-5">
          <span className="text-4xl" aria-hidden>
            {myRow.diploma ? MEDAL[myRow.diploma] : "🎓"}
          </span>
          <div className="flex-1">
            <p className="font-semibold text-fg">
              Ваш результат: {myRow.total} из {results?.max_score} · {myRow.place} место
            </p>
            <p className="text-sm text-muted">{myRow.diploma ? DIPLOMA[myRow.diploma] : "Сертификат участника"}</p>
          </div>
          <ButtonLink to={`/olympiads/${olympiad.id}/diploma`}>{myRow.diploma ? "Открыть диплом" : "Сертификат участника"}</ButtonLink>
        </Card>
      )}

      {results && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">Итоговая таблица</h2>
          <ResultsTable results={results} tasks={olympiad.tasks} highlight={user?.id} />
        </section>
      )}

      {olympiad.tasks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-fg">Задачи</h2>
          {olympiad.tasks.map((task, index) => {
            const submission = byTask.get(task.id);
            return (
              <Card key={task.id} className="space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-fg">
                    {index + 1}. {task.title}
                  </h3>
                  <Badge>{task.max_points} баллов</Badge>
                </div>
                <Markdown source={task.condition} />
                {olympiad.phase === "running" && olympiad.is_registered && (
                  <SubmitForm
                    olympiadId={olympiad.id}
                    task={task}
                    submission={submission}
                    onSaved={(saved) => setData((prev) => ({ ...prev!, submissions: [...prev!.submissions.filter((s) => s.task_id !== saved.task_id), saved] }))}
                  />
                )}
                {olympiad.phase === "finished" && (
                  <div className="space-y-2 border-t border-border pt-4 text-sm">
                    {task.answer && (
                      <p className="text-muted">
                        Ответ: <span className="font-mono text-fg">{task.answer}{task.unit ? ` ${task.unit}` : ""}</span>
                      </p>
                    )}
                    {submission && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={submission.points === task.max_points ? "success" : submission.points > 0 ? "warning" : "danger"}>
                          {submission.points} / {task.max_points}
                        </Badge>
                        <span className="font-mono text-fg">{submission.answer || "—"}</span>
                        <button className="text-xs text-primary hover:underline" onClick={() => setZoom(submission.image_url)}>
                          моё фото
                        </button>
                        {submission.jury_comment && <span className="text-muted">Жюри: «{submission.jury_comment}»</span>}
                      </div>
                    )}
                  </div>
                )}
                {olympiad.phase === "checking" && submission && (
                  <p className="border-t border-border pt-4 text-sm text-muted">✓ Решение отправлено, ждёт проверки жюри</p>
                )}
              </Card>
            );
          })}
        </section>
      )}

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Фото решения">
        {zoom && <img src={zoom} alt="Фото решения" className="max-h-[80vh] rounded-lg object-contain" />}
      </Modal>
    </div>
  );
}

export function DiplomaPage() {
  const olympiadId = Number(useParams().olympiadId);
  const { user } = useAuth();
  const { data, error, loading } = useAsync(async () => {
    const [olympiad, results] = await Promise.all([api.olympiads.get(olympiadId), api.olympiads.results(olympiadId)]);
    return { olympiad, results };
  }, [olympiadId]);
  useDocumentTitle("Диплом");

  if (loading) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? "Диплом не найден"}</ErrorMessage>;
  const row = data.results.rows.find((r) => r.user_id === user?.id);
  if (!row) return <EmptyState title="Вы не участвовали в этой олимпиаде" />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between print:hidden">
        <ButtonLink to={`/olympiads/${olympiadId}`} variant="ghost">
          ← К олимпиаде
        </ButtonLink>
        <Button onClick={() => window.print()}>🖨 Распечатать / сохранить PDF</Button>
      </div>
      <div className="mx-auto aspect-[1.414] max-w-4xl rounded-2xl border-[10px] border-double border-amber-500/70 bg-white p-10 text-center text-slate-900 shadow-card print:shadow-none">
        <div className="flex h-full flex-col items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-600">Kinematics</p>
            <h1 className="font-serif text-5xl font-bold tracking-wide">{row.diploma ? "ДИПЛОМ" : "СЕРТИФИКАТ"}</h1>
            <p className="text-xl font-semibold text-amber-600">{row.diploma ? `${["I", "II", "III"][row.diploma - 1]} степени` : "участника"}</p>
          </div>
          <div className="space-y-3">
            <p className="text-slate-500">награждается</p>
            <p className="font-serif text-4xl font-semibold">{row.name || row.username}</p>
            {(row.school || row.city) && <p className="text-slate-600">{[row.school, row.city].filter(Boolean).join(", ")}</p>}
            <p className="mx-auto max-w-xl text-slate-700">
              {row.diploma ? `за ${row.place} место` : "за участие"} в олимпиаде «{data.olympiad.title}»
              {data.olympiad.subject_title ? ` по предмету «${data.olympiad.subject_title}»` : ""} — {row.total} из {data.results.max_score} баллов
            </p>
          </div>
          <div className="flex w-full items-end justify-between text-sm text-slate-600">
            <div className="text-left">
              <p className="border-t border-slate-400 pt-1">{data.olympiad.organizer_name}</p>
              <p className="text-xs">организатор</p>
            </div>
            <span className="text-6xl" aria-hidden>
              {row.diploma ? MEDAL[row.diploma] : "🎓"}
            </span>
            <div className="text-right">
              <p className="border-t border-slate-400 pt-1">{new Date(data.olympiad.ends_at).toLocaleDateString("ru-RU")}</p>
              <p className="text-xs">дата проведения</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
