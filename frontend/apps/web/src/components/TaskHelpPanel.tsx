import { useState } from "react";
import { Button, Card, Markdown, api, errorText, plural, t, type TaskHelp } from "@kps/shared";

/** Подсказки (по очереди, со снижением очков) и разбор решения. */
export function TaskHelpPanel({ taskId, help, onChange }: { taskId: number; help: TaskHelp; onChange: (help: TaskHelp) => void }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  if (help.hints_total === 0 && !help.has_explanation) return null;

  const openHint = async () => {
    // Очки без подсказок → с ещё одной открытой подсказкой.
    const base = (help.points * 100) / (100 - help.hint_penalty * help.hints.length);
    const next = Math.floor((base * (100 - help.hint_penalty * (help.hints.length + 1))) / 100);
    if (!window.confirm(t("Открыть подсказку? Задача принесёт меньше очков: {0} → {1}.", [help.points, next]))) return;
    setOpening(true);
    setError(null);
    try {
      onChange(await api.tasks.openHint(taskId));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      {help.hints_total > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-fg">
              💡 {t("Подсказки")} <span className="text-sm font-normal text-muted">{help.hints.length} / {help.hints_total}</span>
            </h2>
            <span className="text-sm text-muted">
              {t("Задача принесёт")} <b className="text-fg">{help.points}</b> {plural(help.points, ["очко", "очка", "очков"])}
            </span>
          </div>
          {help.hints.map((hint, index) => (
            <div key={index} className="rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-400/10">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {t("Подсказка {0}", [index + 1])}
              </p>
              <Markdown source={hint} className="text-sm text-fg" />
            </div>
          ))}
          {error && <p className="text-sm text-danger">{error}</p>}
          {help.can_open_hints && (
            <Button variant="secondary" size="sm" loading={opening} onClick={openHint}>
              {t("Открыть подсказку {0} (−{1}% очков)", [help.hints.length + 1, help.hint_penalty])}
            </Button>
          )}
        </section>
      )}
      {help.has_explanation && (
        <section className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
          <h2 className="font-semibold text-fg">📖 {t("Разбор решения")}</h2>
          {help.explanation ? (
            showExplanation ? (
              <Markdown source={help.explanation} className="text-[15px] text-fg" />
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setShowExplanation(true)}>
                {t("Показать разбор")}
              </Button>
            )
          ) : (
            <p className="text-sm text-muted">
              {help.attempts_until_explanation > 0
                ? t("Откроется после верного ответа или ещё {0} неверных попыток.", [help.attempts_until_explanation])
                : t("Откроется после верного ответа.")}
            </p>
          )}
        </section>
      )}
    </Card>
  );
}
