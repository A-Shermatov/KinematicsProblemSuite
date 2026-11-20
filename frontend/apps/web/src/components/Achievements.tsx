import { Card, ProgressBar, cx, plural, t, type Achievements as AchievementsData } from "@kps/shared";

/** Звания за олимпиады: заработанные и прогресс к следующим. */
export function Achievements({ data, compact }: { data: AchievementsData; compact?: boolean }) {
  const earned = data.titles.filter((title) => title.earned);
  const next = data.titles.filter((title) => !title.earned);
  const shown = compact ? [...earned, ...next.slice(0, 2)] : data.titles;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-fg">{data.olympiads}</p>
          <p className="text-xs text-muted">{plural(data.olympiads, ["олимпиада", "олимпиады", "олимпиад"])}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-fg">{data.olympiad_prizes}</p>
          <p className="text-xs text-muted">{plural(data.olympiad_prizes, ["призовое место", "призовых места", "призовых мест"])}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{data.olympiad_wins}</p>
          <p className="text-xs text-muted">{plural(data.olympiad_wins, ["победа", "победы", "побед"])}</p>
        </Card>
      </div>
      <div className={cx("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6")}>
        {shown.map((title) => (
          <Card key={title.code} className={cx("flex flex-col items-center gap-1.5 p-4 text-center", !title.earned && "opacity-60")}>
            <span className={cx("text-3xl", !title.earned && "grayscale")} aria-hidden>
              {title.icon}
            </span>
            <p className="text-sm font-semibold text-fg">{t(title.name)}</p>
            <p className="text-xs text-muted">{t(title.description)}</p>
            {!title.earned && (
              <div className="mt-1 w-full space-y-1">
                <ProgressBar value={title.progress} max={title.target} />
                <p className="text-[11px] text-muted">
                  {title.progress} / {title.target}
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
