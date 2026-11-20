import type { RankCode, UserTitle } from "../api";
import { t } from "../i18n";
import { cx } from "./ui";

/** Цвета званий, как на Codeforces: серый → зелёный → бирюзовый → синий → фиолетовый → оранжевый → красный. */
const RANK_STYLE: Record<RankCode, { text: string; badge: string; hex: string }> = {
  newbie: { text: "text-slate-500 dark:text-slate-400", badge: "bg-slate-100 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300", hex: "#94a3b8" },
  pupil: { text: "text-green-600 dark:text-green-400", badge: "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300", hex: "#22c55e" },
  specialist: { text: "text-cyan-600 dark:text-cyan-400", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-400/15 dark:text-cyan-300", hex: "#06b6d4" },
  expert: { text: "text-blue-600 dark:text-blue-400", badge: "bg-blue-100 text-blue-800 dark:bg-blue-400/15 dark:text-blue-300", hex: "#3b82f6" },
  candidate: { text: "text-violet-600 dark:text-violet-400", badge: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300", hex: "#8b5cf6" },
  master: { text: "text-orange-500 dark:text-orange-400", badge: "bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-300", hex: "#f97316" },
  grandmaster: { text: "text-red-600 dark:text-red-400", badge: "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-300", hex: "#ef4444" },
  legend: { text: "text-red-700 dark:text-red-400 font-bold", badge: "bg-red-600 text-white dark:bg-red-500", hex: "#b91c1c" },
};

/** Границы званий — для графика рейтинга (совпадают с бэкендом, app/modules/rating/ranks.py). */
export const RANK_BANDS: { code: RankCode; min: number }[] = [
  { code: "newbie", min: 0 },
  { code: "pupil", min: 1200 },
  { code: "specialist", min: 1400 },
  { code: "expert", min: 1600 },
  { code: "candidate", min: 1900 },
  { code: "master", min: 2100 },
  { code: "grandmaster", min: 2400 },
  { code: "legend", min: 3000 },
];

export function rankCodeFor(rating: number): RankCode {
  return [...RANK_BANDS].reverse().find((band) => rating >= band.min)!.code;
}

/** Класс цвета имени по званию (пусто — без рейтинга). */
export function rankTextClass(code: RankCode | null | undefined): string {
  return code ? RANK_STYLE[code].text : "";
}

export function rankHex(code: RankCode): string {
  return RANK_STYLE[code].hex;
}

/** Звание по рейтингу олимпиадника рядом с именем. */
export function TitleBadge({ title, className, showRating }: { title: UserTitle | null | undefined; className?: string; showRating?: boolean }) {
  if (!title) return null;
  return (
    <span
      className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", RANK_STYLE[title.code].badge, className)}
      title={t("Звание по рейтингу олимпиадника: {0}", [title.rating])}
    >
      <span aria-hidden>{title.icon}</span>
      {t(title.name)}
      {showRating && <span className="tabular-nums opacity-80">· {title.rating}</span>}
    </span>
  );
}
