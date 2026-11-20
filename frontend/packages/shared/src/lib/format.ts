import type { AttemptStatus, SourceType, TaskSource } from "../api";

const dateTime = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

export const statusMeta: Record<AttemptStatus, { label: string; tone: "success" | "danger" | "warning" | "primary" }> = {
  correct: { label: "Верно", tone: "success" },
  incorrect: { label: "Неверно", tone: "danger" },
  pending: { label: "На проверке", tone: "warning" },
  graded: { label: "Проверено", tone: "primary" },
};

export const sourceTypeLabel: Record<SourceType, string> = {
  book: "Учебник / сборник",
  olympiad: "Олимпиада",
  exam: "Экзамен",
  own: "Авторская",
};

/** «Рымкевич. Задачник, 2019, №123» или null, если источник не указан. */
export function formatSource(source: TaskSource): string | null {
  if (!source.source_type) return null;
  if (source.source_type === "own" && !source.source_title) return "Авторская задача";
  const parts = [source.source_title ?? sourceTypeLabel[source.source_type]];
  if (source.source_year) parts.push(String(source.source_year));
  if (source.source_number) parts.push(`№${source.source_number}`);
  return parts.join(", ");
}

export const difficultyLabel = ["", "Лёгкая", "Простая", "Средняя", "Сложная", "Олимпиадная"];

/** Склонение: plural(5, ["задача", "задачи", "задач"]) → «задач». */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export const certificateStatusMeta: Record<"pending" | "verified" | "rejected", { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "На проверке", tone: "warning" },
  verified: { label: "Проверено", tone: "success" },
  rejected: { label: "Отклонено", tone: "danger" },
};

export function formatRating(rating: number | null): string {
  return rating === null ? "—" : rating.toFixed(1).replace(".", ",");
}

export const olympiadPhaseMeta: Record<"upcoming" | "running" | "checking" | "finished", { label: string; tone: "primary" | "success" | "warning" | "neutral" }> = {
  upcoming: { label: "Скоро", tone: "primary" },
  running: { label: "Идёт сейчас", tone: "success" },
  checking: { label: "Проверка жюри", tone: "warning" },
  finished: { label: "Итоги", tone: "neutral" },
};

export const olympiadStatusMeta: Record<"draft" | "pending" | "published" | "rejected", { label: string; tone: "neutral" | "warning" | "success" | "danger" }> = {
  draft: { label: "Черновик", tone: "neutral" },
  pending: { label: "На проверке у админа", tone: "warning" },
  published: { label: "Опубликована", tone: "success" },
  rejected: { label: "Возвращена на доработку", tone: "danger" },
};

const timeOnly = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

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
  return days > 0 ? `${days} д ${hms}` : hms;
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
