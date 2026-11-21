import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { t } from "../i18n";
import { cx } from "./ui";

/** Номера страниц: 1 … 4 5 [6] 7 8 … 20. */
export function pageNumbers(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((p) => p > 1 && p < count);
  const result: (number | "…")[] = [1];
  if (around[0] > 2) result.push("…");
  result.push(...around);
  if (around[around.length - 1] < count - 1) result.push("…");
  result.push(count);
  return result;
}

interface Props {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  total?: number;
  className?: string;
}

/** Переключатель страниц под списком. Не показывается, если страница одна. */
export function Pagination({ page, pageCount, onChange, total, className }: Props) {
  if (pageCount <= 1) return null;
  const go = (next: number) => {
    onChange(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const button = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition";
  return (
    <nav className={cx("mt-4 flex flex-wrap items-center justify-center gap-1", className)} aria-label={t("Страницы")}>
      <button type="button" className={cx(button, "text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40")} disabled={page <= 1} onClick={() => go(page - 1)} aria-label={t("Предыдущая страница")}>
        ←
      </button>
      {pageNumbers(page, pageCount).map((item, index) =>
        item === "…" ? (
          <span key={`gap-${index}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => go(item)}
            aria-current={item === page ? "page" : undefined}
            className={cx(button, item === page ? "bg-primary text-primary-fg" : "text-fg hover:bg-surface-2")}
          >
            {item}
          </button>
        ),
      )}
      <button type="button" className={cx(button, "text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40")} disabled={page >= pageCount} onClick={() => go(page + 1)} aria-label={t("Следующая страница")}>
        →
      </button>
      {total !== undefined && <span className="ml-2 text-xs text-muted">{t("всего {0}", [total])}</span>}
    </nav>
  );
}

/**
 * Постраничный показ списка; номер страницы хранится в адресе (?page=2), так что «назад» и ссылки работают.
 * resetKey — фильтры: при их смене возвращаемся на первую страницу.
 */
export function usePaged<T>(items: T[], pageSize: number, resetKey = "") {
  const [params, setParams] = useSearchParams();
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const raw = Number(params.get("page") ?? 1);
  const page = Math.min(Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1), pageCount);
  const setPage = (next: number) => {
    const copy = new URLSearchParams(params);
    if (next <= 1) copy.delete("page");
    else copy.set("page", String(next));
    setParams(copy, { replace: false });
  };
  // Фильтры поменялись — на первую страницу (но не при первом показе: ссылка на ?page=3 должна работать).
  const previousKey = useRef(resetKey);
  useEffect(() => {
    if (previousKey.current === resetKey) return;
    previousKey.current = resetKey;
    if (params.get("page")) {
      const copy = new URLSearchParams(params);
      copy.delete("page");
      setParams(copy, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  return { pageItems, page, pageCount, setPage, total: items.length };
}
