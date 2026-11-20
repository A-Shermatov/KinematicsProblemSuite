import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorMessage,
  Loading,
  PageHeader,
  api,
  cx,
  useAsync,
  useAuth,
  useDocumentTitle,
} from "@kps/shared";

type Period = "week" | "month" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "all", label: "Всё время" },
];
const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard() {
  useDocumentTitle("Рейтинг");
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("week");
  const { data, error, loading } = useAsync(() => api.stats.leaderboard(period), [period]);

  return (
    <>
      <PageHeader
        title="Рейтинг учеников"
        subtitle="Очки — сумма сложностей решённых задач. Каждая задача засчитывается один раз."
        actions={
          <div className="flex rounded-xl border border-border bg-surface p-1 text-sm">
            {PERIODS.map((item) => (
              <button
                key={item.key}
                onClick={() => setPeriod(item.key)}
                className={cx("rounded-lg px-3 py-1.5 font-medium", period === item.key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState icon="🏆" title="За этот период ещё никто не решал задачи" />}
      {data && data.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.map((row) => (
            <Link
              key={row.user_id}
              to={`/users/${row.user_id}`}
              className={cx("flex items-center gap-4 px-5 py-3.5 transition hover:bg-surface-2", row.user_id === user?.id && "bg-primary-soft/60")}
            >
              <span className="w-8 text-center text-lg font-bold text-muted">{MEDALS[row.rank - 1] ?? row.rank}</span>
              <Avatar src={row.avatar_url} name={row.name || row.username} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{row.name || row.username}</p>
                <p className="text-xs text-muted">
                  @{row.username} · решено {row.solved_tasks}
                </p>
              </div>
              <span className="text-lg font-bold text-primary">{row.points}</span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
