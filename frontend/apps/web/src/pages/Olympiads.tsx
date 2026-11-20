import { useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from "react-router-dom";
import {
  APP_NAME,
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
  type OlympiadHistoryItem,
  type OlympiadResults,
  type OlympiadPhase,
  type OlympiadSubmission,
  type OlympiadTask,
  type VirtualRun,
  type VirtualStandingRow,
  t,
  UntranslatedNote,
  intlLocale,
  levelRange,
} from "@kps/shared";
import { OlympiadStandingsTable } from "../components/OlympiadStandings";

const PHASE_TABS: { key: OlympiadPhase; label: string }[] = [
  { key: "running", label: t("Идут сейчас") },
  { key: "upcoming", label: t("Скоро") },
  { key: "finished", label: t("Архив") },
];
const DIPLOMA = { 1: t("Диплом I степени"), 2: t("Диплом II степени"), 3: t("Диплом III степени") } as const;
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

/** Уровень олимпиады с диапазоном рейтинга: «5–8 класс · 1200–1599». */
function LevelTag({ olympiad, className }: { olympiad: Olympiad; className?: string }) {
  const range = levelRange(olympiad.level_min_rating, olympiad.level_max_rating);
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-fg", className)}
      title={olympiad.level_max_rating ? t("Официально — рейтинг ниже {0}; выше — вне конкурса", [olympiad.level_max_rating]) : undefined}
    >
      🎯 {olympiad.level_title}
      {range && <span className="text-muted">· {range}</span>}
    </span>
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
          {olympiad.is_registered && <Badge tone="primary">{olympiad.is_official === false ? t("Вне конкурса") : t("✓ Вы участник")}</Badge>}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-fg group-hover:text-primary">{olympiad.title}</p>
          <p className="mt-1 text-sm text-muted">
            {olympiad.subject_title ?? t("Разные предметы")}
            {olympiad.level_title && <LevelTag olympiad={olympiad} className="ml-2" />}
          </p>
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
  useDocumentTitle(t("Олимпиады"));
  const { user } = useAuth();
  const [phase, setPhase] = useState<OlympiadPhase>("running");
  const [levelId, setLevelId] = useState<number | undefined>();
  const { data: levels } = useAsync(() => api.olympiads.levels(), []);
  const { data, error, loading } = useAsync(() => api.olympiads.list(phase, levelId), [phase, levelId, user?.id]);

  return (
    <>
      <PageHeader
        title={t("Олимпиады")}
        subtitle={t("Решайте в общее время со всеми, прикладывайте фото решения — жюри проверит и выдаст дипломы призёрам. Прошедшие олимпиады можно решить виртуально.")}
        actions={
          user?.role === "teacher" && (
            <ButtonLink to="/manage/olympiads" variant="secondary">
              {t("Мои олимпиады")}
            </ButtonLink>
          )
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-border bg-surface p-1 text-sm">
          {PHASE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPhase(tab.key)}
              className={cx("flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 font-medium", phase === tab.key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {levels && levels.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Уровень")}>
            {[{ id: undefined, title: t("Все уровни"), min_rating: null, max_rating: null }, ...levels].map((level) => (
              <button
                key={level.id ?? "all"}
                onClick={() => setLevelId(level.id)}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-sm",
                  levelId === level.id ? "border-primary bg-primary-soft font-medium text-primary" : "border-border text-muted hover:text-fg",
                )}
              >
                {level.title}
                {levelRange(level.min_rating, level.max_rating) && <span className="ml-1 text-xs opacity-70">{levelRange(level.min_rating, level.max_rating)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {phase === "finished" && data && data.length > 0 && (
        <p className="mb-4 text-sm text-muted">
          {t("⏱ Любую олимпиаду из архива можно решить виртуально: личный таймер той же длительности, только ответы, автопроверка.")}
        </p>
      )}
      {data && data.length === 0 && (
        <EmptyState icon="🏁" title={phase === "running" ? t("Сейчас олимпиад нет") : phase === "upcoming" ? t("Скоро олимпиад нет") : t("В архиве пока пусто")}>
          {phase === "running" && (
            <button className="text-primary hover:underline" onClick={() => setPhase("upcoming")}>
              {t("Посмотреть ближайшие")}
            </button>
          )}
        </EmptyState>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
      setError(t("Фото решения обязательно"));
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
          {t("✓ Решение отправлено в")} {formatDateTime(submission.submitted_at)}
          {submission.answer && (
            <span className="text-fg">
              {t("· ответ:")} <span className="font-mono">{submission.answer}</span>
            </span>
          )}
          <a href={submission.image_url} target="_blank" rel="noreferrer" className="ml-auto text-xs underline">
            {t("фото")}
          </a>
        </div>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-start">
        <Input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={task.answer_type === "number" ? t("Ответ{0}", [task.unit ? `, ${task.unit}` : ""]) : t("Ответ")}
          aria-label={t("Ответ к задаче {0}", [task.title])}
          className="font-mono"
        />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        <Button variant={image ? "secondary" : "primary"} onClick={() => fileRef.current?.click()} className={cx(!image && "bg-warning-soft text-warning hover:bg-warning-soft")}>
          📷 {image ? image.name.slice(0, 18) : t("Фото решения *")}
        </Button>
        <Button type="submit" loading={saving}>
          {submission ? t("Отправить заново") : t("Отправить")}
        </Button>
      </div>
      <p className="text-xs text-muted">{t("Засчитывается последнее отправленное решение. Без фото решения ответ не принимается.")}</p>
    </form>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} ${plural(hours, ["час", "часа", "часов"])}`);
  if (rest) parts.push(`${rest} ${plural(rest, ["минута", "минуты", "минут"])}`);
  return parts.join(" ") || t("меньше минуты");
}

function VirtualAnswerForm({ olympiadId, task, saved, onSaved }: { olympiadId: number; task: OlympiadTask; saved?: string; onSaved: (run: VirtualRun) => void }) {
  const [answer, setAnswer] = useState(saved ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.olympiads.submitVirtual(olympiadId, task.id, answer));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <Input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={task.answer_type === "number" ? t("Ответ{0}", [task.unit ? `, ${task.unit}` : ""]) : t("Ответ")}
          aria-label={t("Ответ к задаче {0}", [task.title])}
          className="font-mono"
          required
        />
        <Button type="submit" loading={saving} variant={saved !== undefined && saved === answer.trim() ? "secondary" : "primary"}>
          {saved !== undefined ? t("Изменить ответ") : t("Сохранить ответ")}
        </Button>
      </div>
      {saved !== undefined && (
        <p className="text-xs text-success">
          {t("✓ Сохранён ответ")} <span className="font-mono">{saved}</span>  {t("— результат увидите после окончания")}
        </p>
      )}
    </form>
  );
}

function VirtualStartCard({ olympiad, onStarted }: { olympiad: OlympiadDetail; onStarted: (run: VirtualRun) => void }) {
  const [busy, setBusy] = useState(false);
  const duration = formatDuration(new Date(olympiad.ends_at).getTime() - new Date(olympiad.starts_at).getTime());
  const start = async () => {
    if (!window.confirm(t("Таймер на {0} запустится сразу и не остановится. Начать?", [duration]))) return;
    setBusy(true);
    try {
      onStarted(await api.olympiads.startVirtual(olympiad.id));
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="flex flex-wrap items-center gap-5 border-primary/30 bg-primary-soft/40 p-5">
      <span className="text-4xl" aria-hidden>
        ⏱
      </span>
      <div className="min-w-[14rem] flex-1 space-y-1">
        <p className="font-semibold text-fg">{t("Решите эту олимпиаду виртуально")}</p>
        <p className="text-sm text-muted">
          {t("Личный таймер на")} {duration}{t(", как у участников. Только ответы, без фото — проверка автоматическая. Ответы и итоги скроются, пока идёт ваше время. На официальные места, дипломы и рейтинг не влияет.")}
        </p>
      </div>
      <Button onClick={start} loading={busy} size="lg">
        {t("Решить виртуально")}
      </Button>
    </Card>
  );
}

function VirtualResultCard({ run }: { run: VirtualRun }) {
  return (
    <Card className="flex flex-wrap items-center gap-4 border-primary/30 p-5">
      <span className="text-4xl" aria-hidden>
        ⏱
      </span>
      <div className="flex-1">
        <p className="font-semibold text-fg">
          {t("Виртуальный результат:")} {run.total}  {t("из")} {run.max_score}
        </p>
        <p className="text-sm text-muted">
          {run.official_participants > 0
            ? t("Среди официальных участников это было бы {0} место из {1}", [run.would_place, run.official_participants + 1])
            : t("Официальных участников не было")}
          {" · "}
          {formatDateTime(run.started_at)}
        </p>
      </div>
      <Badge tone="primary">{t("вне зачёта")}</Badge>
    </Card>
  );
}

function VirtualStandings({ rows, maxScore, highlight }: { rows: VirtualStandingRow[]; maxScore: number; highlight?: number }) {
  return (
    <Card className="divide-y divide-border">
      {rows.map((row, index) => (
        <div key={row.user_id} className={cx("flex items-center gap-3 px-4 py-3 text-sm", row.user_id === highlight && "bg-primary-soft/60")}>
          <span className="w-6 text-center font-bold text-muted">{index + 1}</span>
          <Avatar src={row.avatar_url} name={row.name || row.username} size={32} />
          <div className="min-w-0 flex-1">
            <Link to={`/users/${row.user_id}`} className="font-medium text-fg hover:text-primary">
              {row.name || row.username}
            </Link>
            <p className="truncate text-xs text-muted">{[row.school, row.city].filter(Boolean).join(", ")}</p>
          </div>
          <span className="hidden text-xs text-muted sm:inline">{t("было бы")} {row.would_place}  {t("место")}</span>
          <span className="w-16 text-right font-bold tabular-nums text-primary">
            {row.total}
            <span className="text-xs font-normal text-muted"> / {maxScore}</span>
          </span>
        </div>
      ))}
    </Card>
  );
}

/** Буква задачи, как на Codeforces: A, B, C… */
const taskLabel = (index: number) => String.fromCharCode(65 + index);

interface OlympiadContext {
  olympiad: OlympiadDetail;
  submissions: OlympiadSubmission[];
  results: OlympiadResults | null;
  run: VirtualRun | null;
  virtualRows: VirtualStandingRow[];
  virtualActive: boolean;
  setRun: (run: VirtualRun) => void;
  saveSubmission: (submission: OlympiadSubmission) => void;
  zoom: (url: string) => void;
}

const useOlympiad = () => useOutletContext<OlympiadContext>();

/** Оболочка страницы олимпиады: шапка с таймером и вкладки «Задачи · Таблица · Мои отправки · Проверка». */
export function OlympiadPage() {
  const olympiadId = Number(useParams().olympiadId);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const now = useNow(5000);
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, setData, reload } = useAsync(async () => {
    const olympiad = await api.olympiads.get(olympiadId);
    const finished = olympiad.phase === "finished";
    const [submissions, results, run, virtualRows] = await Promise.all([
      olympiad.is_registered ? api.olympiads.mySubmissions(olympiadId) : Promise.resolve([] as OlympiadSubmission[]),
      finished ? api.olympiads.results(olympiadId) : Promise.resolve(null),
      finished && user ? api.olympiads.virtual(olympiadId) : Promise.resolve(null),
      finished ? api.olympiads.virtualStandings(olympiadId) : Promise.resolve([] as VirtualStandingRow[]),
    ]);
    return { olympiad, submissions, results, run, virtualRows };
  }, [olympiadId, user?.id]);
  useDocumentTitle(data?.olympiad.title);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? t("Олимпиада не найдена")}</ErrorMessage>;
  const { olympiad, results, run } = data;
  const virtualActive = !!run?.active;
  const canVirtual = !!user && olympiad.phase === "finished" && !olympiad.can_manage && !olympiad.is_registered && !run;
  const setRun = (next: VirtualRun) => {
    // Начало и конец виртуального участия меняют то, что видно на странице (ответы), — перезагружаем.
    if (next.active !== run?.active) reload();
    else setData((prev) => ({ ...prev!, run: next }));
  };
  const finishVirtual = async () => {
    if (!window.confirm(t("Завершить досрочно? Изменить ответы будет нельзя."))) return;
    try {
      setRun(await api.olympiads.finishVirtual(olympiad.id));
    } catch (err) {
      window.alert(errorText(err));
    }
  };
  const phase = olympiadPhaseMeta[olympiad.phase];
  const myRow = results?.rows.find((row) => row.user_id === user?.id);
  // Этап мог смениться, пока страница открыта.
  const phaseChanged =
    (olympiad.phase === "upcoming" && now >= new Date(olympiad.starts_at).getTime()) ||
    (olympiad.phase === "running" && now >= new Date(olympiad.ends_at).getTime()) ||
    (virtualActive && now >= new Date(run!.ends_at).getTime());

  const finishEarly = async () => {
    if (!window.confirm(t("Завершить олимпиаду сейчас? Отправка решений закроется для всех, начнётся проверка жюри."))) return;
    setBusy(true);
    try {
      const updated = await api.olympiads.finish(olympiad.id);
      setData((prev) => ({ ...prev!, olympiad: updated }));
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

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

  const base = `/olympiads/${olympiad.id}`;
  const tabs = [
    { to: base, label: t("Задачи"), end: true, show: true },
    { to: `${base}/standings`, label: t("Таблица"), show: olympiad.phase !== "upcoming" },
    { to: `${base}/submissions`, label: t("Мои отправки"), show: olympiad.is_registered || !!run },
    { to: `${base}/jury`, label: t("Проверка"), show: olympiad.can_manage && olympiad.phase !== "upcoming" },
  ].filter((tab) => tab.show);

  const context: OlympiadContext = {
    ...data,
    virtualActive,
    setRun,
    saveSubmission: (saved) => setData((prev) => ({ ...prev!, submissions: [...prev!.submissions.filter((s) => s.task_id !== saved.task_id), saved] })),
    zoom: setZoom,
  };

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={phase.tone}>{phase.label}</Badge>
              {olympiad.subject_title && <Badge>{olympiad.subject_title}</Badge>}
              {olympiad.level_title && <LevelTag olympiad={olympiad} />}
              {olympiad.is_registered && olympiad.is_official !== false && <Badge tone="primary">{t("✓ Вы участник")}</Badge>}
              {olympiad.is_registered && olympiad.is_official === false && (
                <span title={t("Ваш рейтинг выше уровня олимпиады: решаете со всеми, но без места, диплома и изменения рейтинга")}>
                  <Badge tone="warning">{t("Вне конкурса")}</Badge>
                </span>
              )}
              {virtualActive && <Badge tone="warning">{t("⏱ Виртуальное участие")}</Badge>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{olympiad.title}</h1>
            <p className="text-sm text-muted">
              🗓 {formatRange(olympiad.starts_at, olympiad.ends_at)}  {t("· организатор")}{" "}
              <Link to={`/teachers/${olympiad.organizer_id}`} className="text-primary hover:underline">
                {olympiad.organizer_name}
              </Link>
              {" · "}
              {olympiad.tasks_count} {plural(olympiad.tasks_count, ["задача", "задачи", "задач"])}  {t("· максимум")} {olympiad.max_score}  {t("баллов ·")}{" "}
              {olympiad.participants_count} {plural(olympiad.participants_count, ["участник", "участника", "участников"])}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {olympiad.phase === "upcoming" && <Countdown to={olympiad.starts_at} label={t("До начала")} />}
            {olympiad.phase === "running" && <Countdown to={olympiad.ends_at} label={t("До конца")} />}
            {virtualActive && <Countdown to={run!.ends_at} label={t("Ваше время")} />}
            {virtualActive && (
              <Button variant="secondary" size="sm" onClick={finishVirtual}>
                {t("Завершить досрочно")}
              </Button>
            )}
            {user?.role === "student" && (olympiad.phase === "upcoming" || (olympiad.phase === "running" && !olympiad.is_registered)) && (
              <Button onClick={toggleRegistration} loading={busy} variant={olympiad.is_registered ? "secondary" : "primary"} size="lg">
                {olympiad.is_registered ? t("Отменить участие") : t("Участвовать")}
              </Button>
            )}
            {!user && (
              <ButtonLink to="/login" state={{ from: base }} size="lg">
                {olympiad.phase === "finished" ? t("Войти, чтобы решить виртуально") : t("Войти, чтобы участвовать")}
              </ButtonLink>
            )}
            {olympiad.can_manage && (
              <ButtonLink to={`/manage/olympiads/${olympiad.id}`} variant="secondary" size="sm">
                {t("Управление")}
              </ButtonLink>
            )}
            {olympiad.can_manage && olympiad.phase === "running" && (
              <Button variant="danger" size="sm" onClick={finishEarly} loading={busy}>
                {t("Завершить олимпиаду")}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {phaseChanged && (
        <Card className="flex flex-wrap items-center gap-4 border-primary/40 bg-primary-soft p-4">
          <p className="flex-1 text-sm text-fg">
            {olympiad.phase === "upcoming" ? t("Олимпиада началась!") : virtualActive ? t("Ваше время вышло — посмотрите результат.") : t("Время вышло — олимпиада завершена.")}
          </p>
          <Button size="sm" onClick={reload}>
            {t("Обновить")}
          </Button>
        </Card>
      )}

      {canVirtual && <VirtualStartCard olympiad={olympiad} onStarted={setRun} />}
      {run && !run.active && <VirtualResultCard run={run} />}

      {myRow && !virtualActive && (
        <Card className="flex flex-wrap items-center gap-4 border-primary/30 p-5">
          <span className="text-4xl" aria-hidden>
            {myRow.diploma ? MEDAL[myRow.diploma] : "🎓"}
          </span>
          <div className="flex-1">
            <p className="font-semibold text-fg">
              {t("Ваш результат:")} {myRow.total}  {t("из")} {results?.max_score} ·{" "}
              {myRow.place !== null ? `${myRow.place} ${t("место")}` : t("вне конкурса")}
            </p>
            <p className="text-sm text-muted">{myRow.diploma ? DIPLOMA[myRow.diploma] : t("Сертификат участника")}</p>
          </div>
          <ButtonLink to={`${base}/diploma`}>{myRow.diploma ? t("Открыть диплом") : t("Сертификат участника")}</ButtonLink>
        </Card>
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label={t("Разделы олимпиады")}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }: { isActive: boolean }) =>
              cx(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                isActive || (tab.end && pathname.startsWith(`${base}/problems/`)) ? "border-primary text-primary" : "border-transparent text-muted hover:text-fg",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={context} />

      <Modal open={!!zoom} onClose={() => setZoom(null)} title={t("Фото решения")}>
        {zoom && <img src={zoom} alt={t("Фото решения")} className="max-h-[80vh] rounded-lg object-contain" />}
      </Modal>
    </div>
  );
}

/** Статус задачи для участника — колонка «Моё» в списке задач. */
function MyTaskStatus({ task }: { task: OlympiadTask }) {
  const { olympiad, submissions, run, virtualActive } = useOlympiad();
  const submission = submissions.find((s) => s.task_id === task.id);
  const virtual = run?.submissions.find((s) => s.task_id === task.id);
  if (virtual) {
    if (virtualActive) return <Badge>{t("ответ сохранён")}</Badge>;
    return <Badge tone={virtual.correct ? "success" : "danger"}>{virtual.points} / {task.max_points}</Badge>;
  }
  if (!submission) return <span className="text-muted">—</span>;
  if (olympiad.phase === "finished") {
    return (
      <Badge tone={submission.points === task.max_points ? "success" : submission.points > 0 ? "warning" : "danger"}>
        {submission.points} / {task.max_points}
      </Badge>
    );
  }
  if (olympiad.phase === "checking") return <Badge tone="warning">{t("ждёт проверки")}</Badge>;
  return <Badge tone="primary">{t("✓ отправлено")}</Badge>;
}

/** Вкладка «Задачи»: список A, B, C… со счётчиком решивших. */
export function OlympiadProblems() {
  const { olympiad, virtualActive } = useOlympiad();
  const showSolved = olympiad.phase !== "upcoming" && !virtualActive;
  const { data: standings } = useAsync(
    () => (showSolved ? api.olympiads.standings(olympiad.id) : Promise.resolve(null)),
    [olympiad.id, showSolved],
  );
  const solved = (taskId: number) => standings?.rows.filter((row) => (row.cells[String(taskId)]?.points ?? 0) > 0).length ?? 0;

  return (
    <div className="space-y-6">
      {olympiad.description && (
        <Card className="p-6">
          <Markdown source={olympiad.description} />
        </Card>
      )}
      {olympiad.phase === "upcoming" && (
        <EmptyState icon="🔒" title={t("Условия откроются в момент начала")}>
          {t("Зарегистрируйтесь заранее — в")} {formatDateTime(olympiad.starts_at)}  {t("задачи появятся на этой странице.")}
        </EmptyState>
      )}
      {olympiad.phase === "checking" && (
        <Card className="border-warning/40 p-4 text-sm text-fg">
          🧐 {t("Олимпиада завершена, жюри проверяет решения")}. {t("Итоги и дипломы появятся здесь после публикации.")}
        </Card>
      )}
      {olympiad.tasks.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="w-14 px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">{t("Название")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("Баллы")}</th>
                {showSolved && <th className="px-4 py-3 text-right font-medium">{t("Решили")}</th>}
                <th className="px-4 py-3 text-right font-medium">{t("Моё")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {olympiad.tasks.map((task, index) => (
                <tr key={task.id} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3">
                    <Link to={`/olympiads/${olympiad.id}/problems/${taskLabel(index)}`} className="text-base font-bold text-primary">
                      {taskLabel(index)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/olympiads/${olympiad.id}/problems/${taskLabel(index)}`} className="font-medium text-fg hover:text-primary">
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{task.max_points}</td>
                  {showSolved && (
                    <td className="px-4 py-3 text-right tabular-nums text-fg">
                      <Link to={`/olympiads/${olympiad.id}/standings`} className="hover:text-primary" title={t("Сколько участников получили баллы")}>
                        👤 ×{solved(task.id)}
                      </Link>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <MyTaskStatus task={task} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/** Отдельная задача: /olympiads/:id/problems/A — условие и отправка. */
export function OlympiadProblem() {
  const { label = "" } = useParams();
  const { olympiad, submissions, run, virtualActive, setRun, saveSubmission, zoom } = useOlympiad();
  const index = label.toUpperCase().charCodeAt(0) - 65;
  const task = olympiad.tasks[index];
  if (!task) return <EmptyState icon="🔍" title={t("Задача не найдена")} />;
  const submission = submissions.find((s) => s.task_id === task.id);
  const virtual = run?.submissions.find((s) => s.task_id === task.id);
  const base = `/olympiads/${olympiad.id}/problems`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {olympiad.tasks.map((other, i) => (
          <Link
            key={other.id}
            to={`${base}/${taskLabel(i)}`}
            className={cx(
              "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-colors",
              i === index ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-fg",
            )}
            title={other.title}
          >
            {taskLabel(i)}
          </Link>
        ))}
      </div>
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-fg">
            {taskLabel(index)}. {task.title}
          </h2>
          <Badge>{task.max_points}  {t("баллов")}</Badge>
        </div>
        <UntranslatedNote lang={task.lang} />
        <Markdown source={task.condition} />
        {olympiad.phase === "running" && olympiad.is_registered && (
          <SubmitForm olympiadId={olympiad.id} task={task} submission={submission} onSaved={saveSubmission} />
        )}
        {virtualActive && <VirtualAnswerForm olympiadId={olympiad.id} task={task} saved={virtual?.answer} onSaved={setRun} />}
        {olympiad.phase === "finished" && !virtualActive && (
          <div className="space-y-2 border-t border-border pt-4 text-sm">
            {task.answer && (
              <p className="text-muted">
                {t("Ответ:")} <span className="font-mono text-fg">{task.answer}{task.unit ? ` ${task.unit}` : ""}</span>
              </p>
            )}
            {submission && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={submission.points === task.max_points ? "success" : submission.points > 0 ? "warning" : "danger"}>
                  {submission.points} / {task.max_points}
                </Badge>
                <span className="font-mono text-fg">{submission.answer || "—"}</span>
                <button className="text-xs text-primary hover:underline" onClick={() => zoom(submission.image_url)}>
                  {t("моё фото")}
                </button>
                {submission.jury_comment && <span className="text-muted">{t("Жюри: «")}{submission.jury_comment}»</span>}
              </div>
            )}
            {virtual && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={virtual.correct ? "success" : "danger"}>
                  {virtual.points} / {task.max_points}
                </Badge>
                <span className="font-mono text-fg">{virtual.answer}</span>
                <span className="text-xs text-muted">{t("виртуально")}</span>
              </div>
            )}
          </div>
        )}
        {olympiad.phase === "checking" && submission && (
          <p className="border-t border-border pt-4 text-sm text-muted">{t("✓ Решение отправлено, ждёт проверки жюри")}</p>
        )}
      </Card>
      <div className="flex justify-between">
        {index > 0 ? (
          <ButtonLink to={`${base}/${taskLabel(index - 1)}`} variant="ghost">
            ← {taskLabel(index - 1)}
          </ButtonLink>
        ) : (
          <span />
        )}
        {index < olympiad.tasks.length - 1 && (
          <ButtonLink to={`${base}/${taskLabel(index + 1)}`} variant="ghost">
            {taskLabel(index + 1)} →
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

/** Вкладка «Таблица»: живая во время олимпиады, итоговая после, плюс виртуальные участники. */
export function OlympiadStandingsTab() {
  const { olympiad, virtualRows, virtualActive } = useOlympiad();
  const { user } = useAuth();
  if (olympiad.phase === "upcoming") return <EmptyState icon="🔒" title={t("Таблица появится после начала")} />;
  if (virtualActive) return <EmptyState icon="⏱" title={t("Таблица скрыта, пока идёт ваше виртуальное участие")} />;
  return (
    <div className="space-y-6">
      <OlympiadStandingsTable olympiadId={olympiad.id} live={olympiad.phase !== "finished"} highlight={user?.id} />
      {virtualRows.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-fg">{t("Виртуальные участники")}</h2>
            <p className="text-sm text-muted">{t("Решали после олимпиады, вне зачёта")}</p>
          </div>
          <VirtualStandings rows={virtualRows} maxScore={olympiad.max_score} highlight={user?.id} />
        </section>
      )}
    </div>
  );
}

/** Вкладка «Мои отправки» — все попытки, как «Мои посылки» на Codeforces. */
export function OlympiadMySubmissions() {
  const { olympiad, submissions, run, zoom } = useOlympiad();
  const { data, error, loading } = useAsync(
    () => (olympiad.is_registered ? api.olympiads.myHistory(olympiad.id) : Promise.resolve([])),
    [olympiad.id, olympiad.is_registered, submissions.length, submissions.map((s) => s.submitted_at).join()],
  );
  if (loading && !data) return <Loading />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  const labelOf = new Map(olympiad.tasks.map((task, index) => [task.id, { label: taskLabel(index), task }]));
  const start = new Date(olympiad.starts_at).getTime();
  const finished = olympiad.phase === "finished";

  const verdict = (item: OlympiadHistoryItem) => {
    const max = labelOf.get(item.task_id)?.task.max_points ?? 0;
    if (!item.current) {
      return finished && item.auto_correct !== null ? (
        <span className={item.auto_correct ? "text-success" : "text-danger"}>{item.auto_correct ? t("верно") : t("неверно")} · {t("заменено")}</span>
      ) : (
        <span className="text-muted">{t("заменено следующей отправкой")}</span>
      );
    }
    const current = submissions.find((s) => s.task_id === item.task_id);
    if (finished && current) {
      return (
        <Badge tone={current.points === max ? "success" : current.points > 0 ? "warning" : "danger"}>
          {current.points} / {max}
        </Badge>
      );
    }
    if (current?.jury_points !== null && current?.jury_points !== undefined) return <Badge tone="success">{t("проверено жюри")}</Badge>;
    return <Badge tone="primary">{olympiad.phase === "running" ? t("засчитывается") : t("ждёт проверки")}</Badge>;
  };

  return (
    <div className="space-y-6">
      {data && data.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">{t("Когда")}</th>
                <th className="px-4 py-3 font-medium">{t("Задача")}</th>
                <th className="px-4 py-3 font-medium">{t("Ответ")}</th>
                <th className="px-4 py-3 font-medium">{t("Вердикт")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item) => {
                const meta = labelOf.get(item.task_id);
                const current = item.current ? submissions.find((s) => s.task_id === item.task_id) : undefined;
                const minute = Math.max(0, Math.floor((new Date(item.submitted_at).getTime() - start) / 60000));
                return (
                  <tr key={item.id} className={cx(!item.current && "opacity-70")}>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="font-medium text-fg">{Math.floor(minute / 60)}:{String(minute % 60).padStart(2, "0")}</span>
                      <span className="ml-2 text-xs text-muted">{formatDateTime(item.submitted_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {meta && (
                        <Link to={`/olympiads/${olympiad.id}/problems/${meta.label}`} className="text-fg hover:text-primary">
                          <b>{meta.label}</b>. {meta.task.title}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-fg">{item.answer || "—"}</span>
                      {current && (
                        <button className="ml-2 text-xs text-primary hover:underline" onClick={() => zoom(current.image_url)}>
                          {t("фото")}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {verdict(item)}
                        {current?.jury_comment && <span className="text-xs text-muted">{t("Жюри: «")}{current.jury_comment}»</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        olympiad.is_registered && <EmptyState icon="📭" title={t("Вы ещё ничего не отправили")} />
      )}
      {run && run.submissions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">{t("Виртуальное участие")}</h2>
          <Card className="divide-y divide-border">
            {run.submissions.map((s) => {
              const meta = labelOf.get(s.task_id);
              return (
                <div key={s.task_id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="text-fg">
                    <b>{meta?.label}</b>. {meta?.task.title}
                  </span>
                  <span className="font-mono text-fg">{s.answer}</span>
                  {!run.active && (
                    <Badge tone={s.correct ? "success" : "danger"}>
                      {s.points} / {meta?.task.max_points}
                    </Badge>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      )}
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
  useDocumentTitle(t("Диплом"));

  if (loading) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? t("Диплом не найден")}</ErrorMessage>;
  const row = data.results.rows.find((r) => r.user_id === user?.id);
  if (!row) return <EmptyState title={t("Вы не участвовали в этой олимпиаде")} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between print:hidden">
        <ButtonLink to={`/olympiads/${olympiadId}`} variant="ghost">
          {t("← К олимпиаде")}
        </ButtonLink>
        <Button onClick={() => window.print()}>{t("🖨 Распечатать / сохранить PDF")}</Button>
      </div>
      <div className="mx-auto aspect-[1.414] max-w-4xl rounded-2xl border-[10px] border-double border-amber-500/70 bg-white p-10 text-center text-slate-900 shadow-card print:shadow-none">
        <div className="flex h-full flex-col items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-600">{APP_NAME}</p>
            <h1 className="font-serif text-5xl font-bold tracking-wide">{row.diploma ? t("ДИПЛОМ") : t("СЕРТИФИКАТ")}</h1>
            <p className="text-xl font-semibold text-amber-600">{row.diploma ? t("{0} степени", [["I", "II", "III"][row.diploma - 1]]) : t("участника")}</p>
          </div>
          <div className="space-y-3">
            <p className="text-slate-500">{t("награждается")}</p>
            <p className="font-serif text-4xl font-semibold">{row.name || row.username}</p>
            {(row.school || row.city) && <p className="text-slate-600">{[row.school, row.city].filter(Boolean).join(", ")}</p>}
            <p className="mx-auto max-w-xl text-slate-700">
              {row.diploma ? t("за {0} место", [row.place]) : t("за участие")}  {t("в олимпиаде «")}{data.olympiad.title}»
              {data.olympiad.subject_title ? t(" по предмету «{0}»", [data.olympiad.subject_title]) : ""} — {row.total}  {t("из")} {data.results.max_score}  {t("баллов")}
            </p>
          </div>
          <div className="flex w-full items-end justify-between text-sm text-slate-600">
            <div className="text-left">
              <p className="border-t border-slate-400 pt-1">{data.olympiad.organizer_name}</p>
              <p className="text-xs">{t("организатор")}</p>
            </div>
            <span className="text-6xl" aria-hidden>
              {row.diploma ? MEDAL[row.diploma] : "🎓"}
            </span>
            <div className="text-right">
              <p className="border-t border-slate-400 pt-1">{new Date(data.olympiad.ends_at).toLocaleDateString(intlLocale())}</p>
              <p className="text-xs">{t("дата проведения")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
