import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  RANK_BANDS,
  TitleBadge,
  cx,
  formatDate,
  plural,
  rankCodeFor,
  rankHex,
  rankTextClass,
  t,
  type Achievements as AchievementsData,
  type RatingHistoryItem,
} from "@kps/shared";

const W = 760;
const H = 240;
const PAD = { left: 44, right: 16, top: 12, bottom: 28 };

/** График рейтинга, как в профиле Codeforces: цветные полосы званий и точка за каждую олимпиаду. */
function RatingChart({ history }: { history: RatingHistoryItem[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = history.flatMap((h) => [h.old_rating, h.new_rating]);
  const low = Math.floor((Math.min(...values) - 100) / 100) * 100;
  const high = Math.ceil((Math.max(...values) + 100) / 100) * 100;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const y = (rating: number) => PAD.top + innerH * (1 - (rating - low) / (high - low));
  // Точки по порядку олимпиад; первая — стартовый рейтинг до первой олимпиады.
  const points = [{ rating: history[0].old_rating, item: null as RatingHistoryItem | null }, ...history.map((item) => ({ rating: item.new_rating, item }))];
  const x = (index: number) => PAD.left + (points.length === 1 ? innerW / 2 : (innerW * index) / (points.length - 1));
  const ticks = RANK_BANDS.map((band) => band.min).filter((min) => min > low && min < high);
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("График рейтинга")}>
        {RANK_BANDS.map((band, index) => {
          const top = Math.min(high, RANK_BANDS[index + 1]?.min ?? Infinity);
          const bottom = Math.max(low, band.min);
          if (top <= bottom) return null;
          return <rect key={band.code} x={PAD.left} width={innerW} y={y(top)} height={y(bottom) - y(top)} fill={rankHex(band.code)} opacity={0.12} />;
        })}
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" className="text-border" strokeDasharray="3 4" />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className="fill-muted text-[11px]">
              {tick}
            </text>
          </g>
        ))}
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.rating)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-fg/70"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
            <circle cx={x(i)} cy={y(p.rating)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(p.rating)} r={hover === i ? 6 : 4.5} fill={rankHex(rankCodeFor(p.rating))} stroke="var(--surface)" strokeWidth={2} />
          </g>
        ))}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 rounded-xl border border-border bg-surface p-3 text-xs shadow-card"
          style={{ left: `${(x(hover!) / W) * 100}%`, top: `${(y(active.rating) / H) * 100}%`, transform: "translate(-50%, calc(-100% - 12px))" }}
        >
          {active.item ? (
            <>
              <p className="font-semibold text-fg">{active.item.title}</p>
              <p className="text-muted">{formatDate(active.item.ends_at)}</p>
              <p className="mt-1 text-fg">
                {t("Место {0} из {1}", [active.item.place, active.item.participants])} ·{" "}
                <span className={cx("font-semibold", active.item.new_rating >= active.item.old_rating ? "text-success" : "text-danger")}>
                  {active.item.new_rating >= active.item.old_rating ? "+" : ""}
                  {active.item.new_rating - active.item.old_rating}
                </span>
              </p>
              <p className="text-fg">
                {t("Рейтинг")}: <b className={rankTextClass(rankCodeFor(active.rating))}>{active.rating}</b>
              </p>
            </>
          ) : (
            <p className="text-fg">{t("Стартовый рейтинг: {0}", [active.rating])}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Рейтинг олимпиадника и звание (как на Codeforces): после каждой олимпиады рейтинг меняется. */
export function Achievements({ data, compact }: { data: AchievementsData; compact?: boolean }) {
  const next = data.titles.find((step) => !step.earned && data.rating !== null);
  const history = [...data.history].reverse();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <p className={cx("text-2xl font-bold tabular-nums", data.title ? rankTextClass(data.title.code) : "text-muted")}>{data.rating ?? "—"}</p>
          <p className="text-xs text-muted">{t("рейтинг")}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className={cx("text-2xl font-bold tabular-nums", data.max_rating ? rankTextClass(rankCodeFor(data.max_rating)) : "text-muted")}>{data.max_rating ?? "—"}</p>
          <p className="text-xs text-muted">{t("максимум")}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-fg">{data.olympiads}</p>
          <p className="text-xs text-muted">{plural(data.olympiads, ["олимпиада", "олимпиады", "олимпиад"])}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-fg">
            {data.olympiad_prizes}
            {data.olympiad_wins > 0 && <span className="ml-1 text-base text-muted">({data.olympiad_wins} 🥇)</span>}
          </p>
          <p className="text-xs text-muted">{plural(data.olympiad_prizes, ["призовое место", "призовых места", "призовых мест"])}</p>
        </Card>
      </div>

      {data.history.length > 0 ? (
        <Card className="space-y-2 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <TitleBadge title={data.title} className="text-sm" />
            {next && data.rating !== null && (
              <span className="text-sm text-muted">
                {t("до звания «{0}» — {1}", [t(next.name), next.min_rating - data.rating])}
              </span>
            )}
          </div>
          <RatingChart history={data.history} />
        </Card>
      ) : (
        <Card className="p-5 text-sm text-muted">
          {t("Рейтинг появится после первой олимпиады с опубликованными итогами. Все начинают с 1200; займёте место выше ожидаемого — рейтинг вырастет, ниже — снизится.")}
        </Card>
      )}

      <div className="flex flex-wrap gap-2" aria-label={t("Звания")}>
        {data.titles.map((step) => (
          <span
            key={step.code}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
              step.current ? "border-current font-semibold" : "border-border",
              step.earned ? rankTextClass(step.code) : "text-muted opacity-60",
            )}
            title={step.max_rating ? `${step.min_rating}–${step.max_rating}` : `${step.min_rating}+`}
          >
            <span aria-hidden>{step.icon}</span>
            {t(step.name)}
            <span className="tabular-nums text-muted">{step.min_rating}+</span>
          </span>
        ))}
      </div>

      {!compact && history.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">{t("Олимпиада")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("Место")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("Изменение")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("Рейтинг")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((item) => {
                const delta = item.new_rating - item.old_rating;
                return (
                  <tr key={item.olympiad_id}>
                    <td className="px-4 py-3">
                      <Link to={`/olympiads/${item.olympiad_id}/standings`} className="font-medium text-fg hover:text-primary">
                        {item.title}
                      </Link>
                      <p className="text-xs text-muted">{formatDate(item.ends_at)}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg">
                      {item.place} <span className="text-muted">/ {item.participants}</span>
                    </td>
                    <td className={cx("px-4 py-3 text-right font-semibold tabular-nums", delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted")}>
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </td>
                    <td className={cx("px-4 py-3 text-right font-bold tabular-nums", rankTextClass(rankCodeFor(item.new_rating)))}>{item.new_rating}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
