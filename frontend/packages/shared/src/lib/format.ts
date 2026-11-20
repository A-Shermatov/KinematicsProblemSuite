import { intlLocale, pluralLocalized, t } from "../i18n";
import type { AttemptStatus, SourceType, TaskSource } from "../api";

const dateTime = new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "long", year: "numeric" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

export const statusMeta: Record<AttemptStatus, { label: string; tone: "success" | "danger" | "warning" | "primary" }> = {
  correct: { label: t("Верно"), tone: "success" },
  incorrect: { label: t("Неверно"), tone: "danger" },
  pending: { label: t("На проверке"), tone: "warning" },
  graded: { label: t("Проверено"), tone: "primary" },
};

export const sourceTypeLabel: Record<SourceType, string> = {
  book: t("Учебник / сборник"),
  olympiad: t("Олимпиада"),
  exam: t("Экзамен"),
  own: t("Авторская"),
};

/** «Рымкевич. Задачник, 2019, №123» или null, если источник не указан. */
export function formatSource(source: TaskSource): string | null {
  if (!source.source_type) return null;
  if (source.source_type === "own" && !source.source_title) return t("Авторская задача");
  const parts = [source.source_title ?? sourceTypeLabel[source.source_type]];
  if (source.source_author) parts.push(source.source_author);
  if (source.source_year) parts.push(String(source.source_year));
  if (source.source_number) parts.push(`№${source.source_number}`);
  return parts.join(", ");
}

/** Цвет уровня сложности относительно верхнего предела — от серого к красному, как на Codeforces. */
const DIFFICULTY_TIERS = [
  "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  "bg-green-500/15 text-green-700 dark:text-green-400",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "bg-red-500/15 text-red-700 dark:text-red-400",
];

export function difficultyTier(value: number, max: number): number {
  if (max <= 100) return DIFFICULTY_TIERS.length - 1;
  const ratio = Math.min(1, Math.max(0, (value - 100) / (max - 100)));
  return Math.round(ratio * (DIFFICULTY_TIERS.length - 1));
}

export function difficultyClass(value: number, max: number): string {
  return DIFFICULTY_TIERS[difficultyTier(value, max)];
}

/** Склонение: plural(5, ["задача", "задачи", "задач"]) → «задач». */
export function plural(n: number, forms: [string, string, string]): string {
  const localized = pluralLocalized(n, forms);
  if (localized !== null) return localized;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export const certificateStatusMeta: Record<"pending" | "verified" | "rejected", { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: t("На проверке"), tone: "warning" },
  verified: { label: t("Проверено"), tone: "success" },
  rejected: { label: t("Отклонено"), tone: "danger" },
};

export function formatRating(rating: number | null): string {
  return rating === null ? "—" : rating.toFixed(1).replace(".", ",");
}

export const olympiadPhaseMeta: Record<"upcoming" | "running" | "checking" | "finished", { label: string; tone: "primary" | "success" | "warning" | "neutral" }> = {
  upcoming: { label: t("Скоро"), tone: "primary" },
  running: { label: t("Идёт сейчас"), tone: "success" },
  checking: { label: t("Проверка жюри"), tone: "warning" },
  finished: { label: t("Итоги"), tone: "neutral" },
};

export const olympiadStatusMeta: Record<"draft" | "pending" | "published" | "rejected", { label: string; tone: "neutral" | "warning" | "success" | "danger" }> = {
  draft: { label: t("Черновик"), tone: "neutral" },
  pending: { label: t("На проверке у админа"), tone: "warning" },
  published: { label: t("Опубликована"), tone: "success" },
  rejected: { label: t("Возвращена на доработку"), tone: "danger" },
};

const timeOnly = new Intl.DateTimeFormat(intlLocale(), { hour: "2-digit", minute: "2-digit" });

/** «21 нояб., 10:00 – 13:00» или «21 нояб., 10:00 – 23 нояб., 18:00». */
export function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  return `${formatDateTime(startIso)} – ${sameDay ? timeOnly.format(end) : formatDateTime(endIso)}`;
}

/** «2 д 03:15:09» до указанного момента. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? t("{0} д {1}", [days, hms]) : hms;
}

/** ISO → значение для <input type="datetime-local"> в местном времени. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Значение <input type="datetime-local"> → ISO с часовым поясом. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

/** «рейтинг < 1200», «1200–1599», «1600+» — диапазон уровня олимпиады. */
export function levelRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "";
  if (min === null) return `< ${max}`;
  if (max === null) return `${min}+`;
  return `${min}–${max - 1}`;
}
