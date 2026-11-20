import { Card, difficultyClass, plural, usePlatformSettings, type DifficultyBreakdown, t } from "@kps/shared";

/** Столбчатая диаграмма: сколько задач решено (и пробовалось без успеха) на каждом уровне сложности. */
export function DifficultyChart({ data }: { data: DifficultyBreakdown }) {
  const { settings } = usePlatformSettings();
  const byLevel = new Map(data.levels.map((l) => [l.difficulty, l]));
  const maxLevel = Math.max(settings.difficulty_max, ...data.levels.map((l) => l.difficulty));
  const levels = Array.from({ length: maxLevel / 100 }, (_, i) => (i + 1) * 100);
  const top = Math.max(1, ...data.levels.map((l) => l.solved + l.unsolved));
  const solvedTotal = data.levels.reduce((sum, l) => sum + l.solved, 0);
  const subjectTop = Math.max(1, ...data.subjects.map((s) => s.solved));

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-fg">{t("Задачи по сложности")}</h2>
          <div className="flex gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" />  {t("решено")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-border" />  {t("пробовал(а)")}
            </span>
          </div>
        </div>
        <div className="flex h-48 items-end gap-1.5" role="img" aria-label={t("Решено {0} задач по уровням сложности", [solvedTotal])}>
          {levels.map((lvl) => {
            const item = byLevel.get(lvl);
            const solved = item?.solved ?? 0;
            const unsolved = item?.unsolved ?? 0;
            return (
              <div key={lvl} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={t("{0}: решено {1}, без решения {2}", [lvl, solved, unsolved])}>
                <span className="text-[11px] font-medium text-muted opacity-0 transition group-hover:opacity-100">{solved || ""}</span>
                <div className="flex w-full max-w-10 flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${((solved + unsolved) / top) * 100}%` }}>
                  <div className="w-full bg-border" style={{ flexGrow: unsolved }} />
                  <div className="w-full bg-primary" style={{ flexGrow: solved }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5">
          {levels.map((lvl) => (
            <span key={lvl} className={`flex-1 rounded py-0.5 text-center font-mono text-[11px] font-semibold ${difficultyClass(lvl, settings.difficulty_max)}`}>
              {lvl}
            </span>
          ))}
        </div>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold text-fg">{t("По предметам")}</h2>
        {data.subjects.length === 0 && <p className="text-sm text-muted">{t("Пока нет решённых задач")}</p>}
        {data.subjects.map((subject) => (
          <div key={subject.subject_id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-fg">{subject.subject_title}</span>
              <span className="text-muted">
                {subject.solved} {plural(subject.solved, ["задача", "задачи", "задач"])}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(subject.solved / subjectTop) * 100}%` }} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
