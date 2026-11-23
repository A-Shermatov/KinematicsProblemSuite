import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Avatar, Card, EmptyState, ErrorMessage, Loading, api, cx, rankTextClass, t, useAsync, UserCell, type StandingsCell } from "@kps/shared";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const REFRESH_MS = 30_000;

/** 0:42 — часы:минуты от начала олимпиады. */
function clock(minute: number): string {
  const hours = Math.floor(minute / 60);
  return `${hours}:${String(minute % 60).padStart(2, "0")}`;
}

function Cell({ cell, max }: { cell: StandingsCell | undefined; max: number }) {
  if (!cell) return <span className="text-muted/50">·</span>;
  const full = cell.points >= max;
  const tone = cell.points <= 0 ? "text-danger" : full ? "text-success" : "text-amber-600 dark:text-amber-400";
  return (
    <div className="flex flex-col items-center leading-tight" title={cell.graded ? t("Проверено жюри") : t("Автопроверка — может измениться после проверки жюри")}>
      <span className={cx("font-bold tabular-nums", tone)}>
        {cell.points > 0 ? cell.points : "−"}
        {!cell.graded && <sup className="ml-0.5 text-[10px] font-normal text-muted">?</sup>}
      </span>
      <span className="text-[11px] tabular-nums text-muted">
        {cell.points > 0 ? clock(cell.minute) : ""}
        {cell.attempts > 1 && <span className="ml-1">×{cell.attempts}</span>}
      </span>
    </div>
  );
}

/** Таблица олимпиады как на Codeforces: во время олимпиады обновляется сама, после — итоговая. */
export function OlympiadStandingsTable({ olympiadId, live, highlight }: { olympiadId: number; live: boolean; highlight?: number }) {
  const { data, error, loading, reload } = useAsync(() => api.olympiads.standings(olympiadId), [olympiadId]);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(reload, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live, reload]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return null;
  if (data.rows.length === 0) return <EmptyState title={t("Пока никто не отправил решений")} />;

  return (
    <div className="space-y-2">
      {data.provisional && (
        <p className="text-sm text-muted">
          {data.phase === "running" ? "🔴 " : ""}
          {t("Таблица предварительная: баллы автопроверки (со знаком ?) изменятся после проверки жюри. При равных баллах выше тот, кто решил быстрее.")}
          {live && ` ${t("Обновляется каждые 30 секунд.")}`}
        </p>
      )}
      {data.rows.some((row) => !row.official) && (
        <p className="text-sm text-muted">{t("* — вне конкурса: рейтинг выше уровня олимпиады, без места, диплома и изменения рейтинга.")}</p>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="w-14 px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">{t("Участник")}</th>
              {data.tasks.map((task) => (
                <th key={task.id} className="w-20 px-2 py-3 text-center font-medium" title={t("Максимум {0}", [task.max_points])}>
                  {task.label}
                  <span className="block text-[10px] font-normal normal-case">{task.max_points}</span>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium">{t("Баллы")}</th>
              <th className="px-4 py-3 text-right font-medium" title={t("Сумма минут до решений: при равных баллах выше тот, у кого меньше")}>
                {t("Штраф")}
              </th>
              {data.rated && (
                <th className="px-4 py-3 text-right font-medium" title={t("Изменение рейтинга после олимпиады")}>
                  Δ
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.map((row) => {
              const medal = !data.provisional && row.total > 0 && row.place !== null ? MEDAL[row.place] : undefined;
              return (
                <tr key={row.user_id} className={cx(row.user_id === highlight && "bg-primary-soft/60", !row.official && "bg-surface-2/50")}>
                  <td className="px-4 py-3 text-lg font-bold text-muted">
                    {row.official ? (
                      (medal ?? row.place)
                    ) : (
                      <span title={t("Вне конкурса: рейтинг выше уровня олимпиады")} className="text-base">
                        *
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={row.avatar_url} name={row.name || row.username} size={32} />
                      <div className="min-w-0">
                        <Link
                          to={`/users/${row.user_id}`}
                          className="hover:underline"
                          title={row.title ? `${t(row.title.name)} · ${row.title.rating}` : undefined}
                        >
                          <UserCell
                            name={row.name}
                            username={row.username}
                            countryCode={row.country_code}
                            school={row.school}
                            city={row.city}
                            nameClass={rankTextClass(row.title?.code)}
                          />
                        </Link>
                      </div>
                    </div>
                  </td>
                  {data.tasks.map((task) => (
                    <td key={task.id} className="px-2 py-2 text-center">
                      <Cell cell={row.cells[String(task.id)]} max={task.max_points} />
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-primary">
                    {row.total}
                    <span className="text-xs font-normal text-muted"> / {data.max_score}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{row.penalty}</td>
                  {data.rated && (
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.rating_change && (
                        <span title={`${row.rating_change.old} → ${row.rating_change.new}`}>
                          <span
                            className={cx(
                              "font-semibold",
                              row.rating_change.new > row.rating_change.old ? "text-success" : row.rating_change.new < row.rating_change.old ? "text-danger" : "text-muted",
                            )}
                          >
                            {row.rating_change.new > row.rating_change.old ? "+" : ""}
                            {row.rating_change.new - row.rating_change.old}
                          </span>
                          <span className="ml-1.5 text-xs text-muted">{row.rating_change.new}</span>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
