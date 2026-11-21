import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  PageHeader,
  api,
  cx,
  plural,
  useAsync,
  useAuth,
  useDocumentTitle,
  type Period,
  t,
  TitleBadge,
  rankTextClass,
  UserCell,
} from "@kps/shared";

type Tab = "students" | "olympiads" | "schools" | "cities";

const TABS: { key: Tab; label: string }[] = [
  { key: "students", label: t("Участники") },
  { key: "olympiads", label: t("Олимпиадники") },
  { key: "schools", label: t("Школы") },
  { key: "cities", label: t("Города") },
];
const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: t("Неделя") },
  { key: "month", label: t("Месяц") },
  { key: "all", label: t("Всё время") },
];
const MEDALS = ["🥇", "🥈", "🥉"];

function Segmented<T extends string>({
  items,
  value,
  onChange,
  disabled,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cx("flex rounded-xl border border-border bg-surface p-1 text-sm", disabled && "pointer-events-none opacity-40")} aria-disabled={disabled}>
      {items.map((item) => (
        <button
          key={item.key}
          disabled={disabled}
          onClick={() => onChange(item.key)}
          className={cx("rounded-lg px-3 py-1.5 font-medium", value === item.key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Rank({ rank }: { rank: number }) {
  return <span className="w-8 shrink-0 text-center text-lg font-bold text-muted">{MEDALS[rank - 1] ?? rank}</span>;
}

export function Leaderboard() {
  useDocumentTitle(t("Рейтинг"));
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "students";
  const period = (params.get("period") as Period | null) ?? "week";
  const metric = params.get("metric") === "solved" ? "solved" : "points";
  const subjectId = params.get("subject") ? Number(params.get("subject")) : undefined;
  const city = params.get("city") ?? "";
  const school = params.get("school") ?? "";
  const [cityInput, setCityInput] = useState(city);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  const { data: subjects } = useAsync(() => api.subjects.list(), []);
  const { data, error, loading } = useAsync(async () => {
    const base = { period, subject_id: subjectId };
    if (tab === "schools") return { tab, rows: await api.stats.schools({ ...base, city: city || undefined }) } as const;
    if (tab === "cities") return { tab, rows: await api.stats.cities(base) } as const;
    if (tab === "olympiads") return { tab, rows: await api.stats.olympiadLeaderboard({ city: city || undefined }) } as const;
    return {
      tab,
      rows: await api.stats.leaderboard({ ...base, metric, city: city || undefined, school: school || undefined }),
    } as const;
  }, [tab, period, metric, subjectId, city, school]);

  const subtitle =
    tab === "students"
      ? t("Очки — сумма сложностей решённых задач, каждая задача засчитывается один раз.")
      : tab === "olympiads"
        ? t("Рейтинг олимпиадника, как на Codeforces: все начинают с 1200, после каждой олимпиады рейтинг растёт или падает в зависимости от места и силы соперников. От рейтинга зависит звание.")
        : tab === "schools"
          ? t("Сумма очков всех учеников школы. Укажите школу в профиле, чтобы играть за неё.")
          : t("Сумма очков всех учеников города.");

  return (
    <>
      {/* Вкладки и фильтры всегда на одном месте: неподходящие для вкладки фильтры не исчезают, а гаснут. */}
      <PageHeader title={t("Рейтинг")} />
      <nav className="-mt-2 mb-4 overflow-x-auto" aria-label={t("Рейтинг")}>
        <div className="inline-flex">
          <Segmented items={TABS} value={tab} onChange={(next) => update({ tab: next, school: null })} />
        </div>
      </nav>

      <div className="mb-3 flex min-h-10 flex-wrap items-center gap-3">
        <Segmented items={PERIODS} value={period} onChange={(p) => update({ period: p })} disabled={tab === "olympiads"} />
        <Segmented
          items={[
            { key: "points", label: t("По очкам") },
            { key: "solved", label: t("По задачам") },
          ]}
          value={metric}
          onChange={(m) => update({ metric: m === "points" ? null : m })}
          disabled={tab !== "students"}
        />
        <select
          disabled={tab === "olympiads"}
          value={subjectId ?? ""}
          onChange={(e) => update({ subject: e.target.value || null })}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-fg disabled:opacity-40"
          aria-label={t("Предмет")}
        >
          <option value="">{t("Все предметы")}</option>
          {subjects?.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.title}
            </option>
          ))}
        </select>
        <form
          className={cx("w-48", tab === "cities" && "pointer-events-none opacity-40")}
          onSubmit={(event) => {
            event.preventDefault();
            update({ city: cityInput.trim() || null, school: null });
          }}
        >
          <Input disabled={tab === "cities"} placeholder={t("Город, Enter")} value={cityInput} onChange={(e) => setCityInput(e.target.value)} aria-label={t("Город")} className="h-10" />
        </form>
        {school && (
          <button onClick={() => update({ school: null })} className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
            {school} ✕
          </button>
        )}
        {user?.school && tab === "students" && !school && (
          <button onClick={() => update({ city: user.city, school: user.school })} className="text-sm text-primary hover:underline">
            {t("Моя школа")}
          </button>
        )}
      </div>

      <p className="mb-6 text-sm text-muted">{subtitle}</p>

      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.rows.length === 0 && <EmptyState icon="🏆" title={t("За этот период пока никого нет")} />}

      {data?.tab === "students" && data.rows.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.rows.map((row) => (
            <Link
              key={row.user_id}
              to={`/users/${row.user_id}`}
              className={cx("flex items-center gap-4 px-5 py-3.5 transition hover:bg-surface-2", row.user_id === user?.id && "bg-primary-soft/60")}
            >
              <Rank rank={row.rank} />
              <Avatar src={row.avatar_url} name={row.name || row.username} size={40} />
              <div className="min-w-0 flex-1">
                <UserCell
                  name={row.name}
                  username={row.username}
                  countryCode={row.country_code}
                  school={row.school}
                  city={row.city}
                  nameClass={rankTextClass(row.title?.code)}
                  extra={
                    <>
                      <TitleBadge title={row.title} className="hidden sm:inline-flex" />
                      {row.role === "teacher" && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">{t("учитель")}</span>
                      )}
                    </>
                  }
                />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{metric === "solved" ? row.solved_tasks : row.points}</p>
                <p className="text-xs text-muted">
                  {metric === "solved" ? t("{0} очк.", [row.points]) : `${row.solved_tasks} ${plural(row.solved_tasks, ["задача", "задачи", "задач"])}`}
                </p>
              </div>
            </Link>
          ))}
        </Card>
      )}

      {data?.tab === "olympiads" && data.rows.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.rows.map((row) => (
            <Link
              key={row.user_id}
              to={`/users/${row.user_id}`}
              className={cx("flex items-center gap-4 px-5 py-3.5 transition hover:bg-surface-2", row.user_id === user?.id && "bg-primary-soft/60")}
            >
              <Rank rank={row.rank} />
              <Avatar src={row.avatar_url} name={row.name || row.username} size={40} />
              <div className="min-w-0 flex-1">
                <UserCell
                  name={row.name}
                  username={row.username}
                  countryCode={row.country_code}
                  school={row.school}
                  city={row.city}
                  nameClass={rankTextClass(row.title?.code)}
                  extra={
                    <>
                      <TitleBadge title={row.title} className="hidden sm:inline-flex" />
                      <span className="hidden shrink-0 text-xs text-muted md:inline">
                        · {row.olympiads} {plural(row.olympiads, ["олимпиада", "олимпиады", "олимпиад"])}
                      </span>
                    </>
                  }
                />
              </div>
              <div className="hidden gap-2 text-sm sm:flex" aria-label={t("Медали")}>
                {row.gold > 0 && <span>🥇{row.gold}</span>}
                {row.silver > 0 && <span>🥈{row.silver}</span>}
                {row.bronze > 0 && <span>🥉{row.bronze}</span>}
              </div>
              <div className="w-20 text-right">
                <p className={cx("text-lg font-bold tabular-nums", rankTextClass(row.title?.code))}>{row.rating}</p>
                <p className="text-[11px] text-muted">{t("макс. {0}", [row.max_rating])}</p>
              </div>
            </Link>
          ))}
        </Card>
      )}

      {data?.tab === "schools" && data.rows.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.rows.map((row) => (
            <button
              key={`${row.city}-${row.school}`}
              onClick={() => update({ tab: "students", city: row.city, school: row.school })}
              className={cx(
                "flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-surface-2",
                user?.school?.toLowerCase() === row.school.toLowerCase() && "bg-primary-soft/60",
              )}
            >
              <Rank rank={row.rank} />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lg" aria-hidden>
                🏫
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{row.school}</p>
                <p className="text-xs text-muted">
                  {row.city ?? t("Город не указан")} · {row.students} {plural(row.students, ["ученик", "ученика", "учеников"])}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{row.points}</p>
                <p className="text-xs text-muted">{row.solved_tasks}  {t("решений")}</p>
              </div>
            </button>
          ))}
        </Card>
      )}

      {data?.tab === "cities" && data.rows.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.rows.map((row) => (
            <button
              key={row.city}
              onClick={() => {
                setCityInput(row.city);
                update({ tab: "schools", city: row.city });
              }}
              className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-surface-2"
            >
              <Rank rank={row.rank} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{row.city}</p>
                <p className="text-xs text-muted">
                  {row.students} {plural(row.students, ["ученик", "ученика", "учеников"])} · {row.schools}{" "}
                  {plural(row.schools, ["школа", "школы", "школ"])}
                </p>
              </div>
              <p className="text-lg font-bold text-primary">{row.points}</p>
            </button>
          ))}
        </Card>
      )}
    </>
  );
}
