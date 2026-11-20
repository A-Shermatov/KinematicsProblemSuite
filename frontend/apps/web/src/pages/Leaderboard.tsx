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
} from "@kps/shared";

type Tab = "students" | "olympiads" | "schools" | "cities";

const TABS: { key: Tab; label: string }[] = [
  { key: "students", label: "Ученики" },
  { key: "olympiads", label: "Олимпиады" },
  { key: "schools", label: "Школы" },
  { key: "cities", label: "Города" },
];
const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "all", label: "Всё время" },
];
const MEDALS = ["🥇", "🥈", "🥉"];

function Segmented<T extends string>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl border border-border bg-surface p-1 text-sm">
      {items.map((item) => (
        <button
          key={item.key}
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
  useDocumentTitle("Рейтинг");
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
    if (tab === "olympiads") return { tab, rows: await api.stats.olympiadLeaderboard({ ...base, city: city || undefined }) } as const;
    return {
      tab,
      rows: await api.stats.leaderboard({ ...base, metric, city: city || undefined, school: school || undefined }),
    } as const;
  }, [tab, period, metric, subjectId, city, school]);

  const subtitle =
    tab === "students"
      ? "Очки — сумма сложностей решённых задач, каждая задача засчитывается один раз."
      : tab === "olympiads"
        ? "Очки — сумма процентов от максимума по всем олимпиадам. Медали — призовые места."
        : tab === "schools"
          ? "Сумма очков всех учеников школы. Укажите школу в профиле, чтобы играть за неё."
          : "Сумма очков всех учеников города.";

  return (
    <>
      <PageHeader title="Рейтинг" subtitle={subtitle} actions={<Segmented items={TABS} value={tab} onChange={(t) => update({ tab: t, school: null })} />} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented items={PERIODS} value={period} onChange={(p) => update({ period: p })} />
        {tab === "students" && (
          <Segmented
            items={[
              { key: "points", label: "По очкам" },
              { key: "solved", label: "По задачам" },
            ]}
            value={metric}
            onChange={(m) => update({ metric: m === "points" ? null : m })}
          />
        )}
        <select
          value={subjectId ?? ""}
          onChange={(e) => update({ subject: e.target.value || null })}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          aria-label="Предмет"
        >
          <option value="">Все предметы</option>
          {subjects?.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.title}
            </option>
          ))}
        </select>
        {tab !== "cities" && (
          <form
            className="w-48"
            onSubmit={(event) => {
              event.preventDefault();
              update({ city: cityInput.trim() || null, school: null });
            }}
          >
            <Input placeholder="Город, Enter" value={cityInput} onChange={(e) => setCityInput(e.target.value)} aria-label="Город" className="h-10" />
          </form>
        )}
        {school && (
          <button onClick={() => update({ school: null })} className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
            {school} ✕
          </button>
        )}
        {user?.school && tab === "students" && !school && (
          <button onClick={() => update({ city: user.city, school: user.school })} className="text-sm text-primary hover:underline">
            Моя школа
          </button>
        )}
      </div>

      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.rows.length === 0 && <EmptyState icon="🏆" title="За этот период пока никого нет" />}

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
                <p className="truncate font-medium text-fg">{row.name || row.username}</p>
                <p className="truncate text-xs text-muted">{[row.school, row.city].filter(Boolean).join(", ") || `@${row.username}`}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{metric === "solved" ? row.solved_tasks : row.points}</p>
                <p className="text-xs text-muted">
                  {metric === "solved" ? `${row.points} очк.` : `${row.solved_tasks} ${plural(row.solved_tasks, ["задача", "задачи", "задач"])}`}
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
                <p className="truncate font-medium text-fg">{row.name || row.username}</p>
                <p className="truncate text-xs text-muted">
                  {row.olympiads} {plural(row.olympiads, ["олимпиада", "олимпиады", "олимпиад"])}
                  {(row.school || row.city) && ` · ${[row.school, row.city].filter(Boolean).join(", ")}`}
                </p>
              </div>
              <div className="hidden gap-2 text-sm sm:flex" aria-label="Медали">
                {row.gold > 0 && <span>🥇{row.gold}</span>}
                {row.silver > 0 && <span>🥈{row.silver}</span>}
                {row.bronze > 0 && <span>🥉{row.bronze}</span>}
              </div>
              <p className="w-14 text-right text-lg font-bold text-primary">{row.points}</p>
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
                  {row.city ?? "Город не указан"} · {row.students} {plural(row.students, ["ученик", "ученика", "учеников"])}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{row.points}</p>
                <p className="text-xs text-muted">{row.solved_tasks} решений</p>
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
