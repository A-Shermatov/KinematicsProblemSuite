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
