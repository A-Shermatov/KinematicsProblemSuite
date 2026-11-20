import { useMemo } from "react";
import { Card, cx, plural, type Activity } from "@kps/shared";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const LEVELS = [
  "bg-surface-2",
  "bg-emerald-200 dark:bg-emerald-900",
  "bg-emerald-400 dark:bg-emerald-700",
  "bg-emerald-500 dark:bg-emerald-500",
  "bg-emerald-700 dark:bg-emerald-300",
];
const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

function level(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Тепловая карта активности за год, как на GitHub/Codeforces: столбец — неделя, строка — день недели. */
export function ActivityHeatmap({ activity }: { activity: Activity }) {
  const { weeks, months } = useMemo(() => {
    const counts = new Map(activity.days.map((d) => [d.date, d.count]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Начинаем с понедельника 52 недели назад.
    const start = new Date(today);
    start.setDate(start.getDate() - 7 * 52 - ((today.getDay() + 6) % 7));
    const weeks: { date: Date; count: number; future: boolean }[][] = [];
    const months: { index: number; label: string }[] = [];
    for (let cursor = new Date(start), week = 0; cursor <= today; week += 1) {
      const column = [];
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const date = new Date(cursor);
        column.push({ date, count: counts.get(isoDay(date)) ?? 0, future: date > today });
        if (date.getDate() === 1 && date <= today) months.push({ index: week, label: MONTHS[date.getMonth()] });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(column);
    }
    return { weeks, months };
  }, [activity]);

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-fg">
          {activity.total} {plural(activity.total, ["попытка", "попытки", "попыток"])} за год
        </h2>
        <p className="text-xs text-muted">
          Активных дней: {activity.active_days} · лучшая серия: {activity.best_streak}{" "}
          {plural(activity.best_streak, ["день", "дня", "дней"])}
        </p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="relative ml-[31px] h-4 text-[10px] text-muted">
            {months.map((month) => (
              <span key={`${month.index}-${month.label}`} className="absolute" style={{ left: month.index * 14 }}>
                {month.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="mr-1 grid w-6 grid-rows-7 gap-[3px] text-[10px] leading-[11px] text-muted">
              {["пн", "", "ср", "", "пт", "", ""].map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
            {weeks.map((week, i) => (
              <div key={i} className="grid grid-rows-7 gap-[3px]">
                {week.map((day) => (
                  <span
                    key={day.date.toISOString()}
                    className={cx("h-[11px] w-[11px] rounded-[3px]", day.future ? "bg-transparent" : LEVELS[level(day.count)])}
                    title={day.future ? undefined : `${day.count} ${plural(day.count, ["попытка", "попытки", "попыток"])} · ${dayFormat.format(day.date)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] text-muted">
        меньше
        {LEVELS.map((cls) => (
          <span key={cls} className={cx("h-[11px] w-[11px] rounded-[3px]", cls)} />
        ))}
        больше
      </div>
    </Card>
  );
}
