import { Card, ProgressBar, cx, plural, type Achievements as AchievementsData } from "@kps/shared";

/** Очки, серия дней и значки ученика. */
export function Achievements({ data, compact }: { data: AchievementsData; compact?: boolean }) {
  const earned = data.badges.filter((badge) => badge.earned);
  const next = data.badges.filter((badge) => !badge.earned).sort((a, b) => b.progress / b.target - a.progress / a.target);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{data.points}</p>
          <p className="text-xs text-muted">очков</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-fg">
            {data.current_streak > 0 && "🔥"}
            {data.current_streak}
          </p>
          <p className="text-xs text-muted">{plural(data.current_streak, ["день", "дня", "дней"])} подряд</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-fg">
            {earned.length}/{data.badges.length}
          </p>
          <p className="text-xs text-muted">значков</p>
        </Card>
      </div>
      <div className={cx("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
        {[...earned, ...(compact ? next.slice(0, 3) : next)].map((badge) => (
          <Card key={badge.code} className={cx("flex flex-col items-center gap-1.5 p-4 text-center", !badge.earned && "opacity-60")}>
            <span className={cx("text-3xl", !badge.earned && "grayscale")} aria-hidden>
              {badge.icon}
            </span>
            <p className="text-sm font-semibold text-fg">{badge.title}</p>
            <p className="text-xs text-muted">{badge.description}</p>
            {!badge.earned && (
              <div className="mt-1 w-full space-y-1">
                <ProgressBar value={badge.progress} max={badge.target} />
                <p className="text-[11px] text-muted">
                  {badge.progress} / {badge.target}
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
