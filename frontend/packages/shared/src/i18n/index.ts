/**
 * Языки интерфейса: русский (основной), английский, таджикский.
 *
 * Ключ перевода — сама русская строка: t("Задачи") → "Tasks". Нет перевода — показываем русский.
 * Подстановки — {0}, {1}: t("Ваш результат: {0} из {1}", [total, max]).
 * Язык выбирается один раз при загрузке страницы; смена языка перезагружает страницу, поэтому t() можно
 * вызывать и в константах модулей. Админка всегда на русском: <html data-i18n="off">.
 */
import en from "./en";
import tg from "./tg";

export type Lang = "ru" | "en" | "tg";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "ru", label: "Русский", short: "RU" },
  { code: "en", label: "English", short: "EN" },
  { code: "tg", label: "Тоҷикӣ", short: "TJ" },
];

export type Dictionary = Record<string, string | string[]>;
const DICTS: Record<Exclude<Lang, "ru">, Dictionary> = { en, tg };
const STORAGE_KEY = "kps.lang";

function detect(): Lang {
  if (typeof document === "undefined" || document.documentElement.dataset.i18n === "off") return "ru";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "tg" || saved === "ru") return saved;
  } catch {
    /* приватный режим */
  }
  return "ru";
}

let current: Lang = detect();
if (typeof document !== "undefined") document.documentElement.lang = current;

export const getLang = (): Lang => current;

/** Для тестов: сменить язык без перезагрузки. */
export function setLangForTests(lang: Lang): void {
  current = lang;
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export function t(text: string, args?: unknown[]): string {
  const found = current === "ru" ? undefined : DICTS[current][text];
  const out = typeof found === "string" && found ? found : text;
  return args ? out.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? "")) : out;
}

/** Формы слова после числа. Ключ — три русские формы через «|»; en: [one, other], tg: [форма] (после числа — ед. ч.). */
export function pluralLocalized(n: number, forms: [string, string, string]): string | null {
  if (current === "ru") return null;
  const found = DICTS[current][forms.join("|")];
  if (!Array.isArray(found) || found.length === 0) return null;
  return current === "en" && found.length > 1 && Math.abs(n) !== 1 ? found[1] : found[0];
}

/** Локаль для Intl: таджикских названий месяцев в браузерах обычно нет — берём русские. */
export const intlLocale = (): string => (current === "en" ? "en-GB" : "ru-RU");
