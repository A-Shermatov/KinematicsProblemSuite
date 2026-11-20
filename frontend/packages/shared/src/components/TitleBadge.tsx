import type { UserTitle } from "../api";
import { t } from "../i18n";
import { cx } from "./ui";

/** Звание за олимпиады рядом с именем. */
export function TitleBadge({ title, className }: { title: UserTitle | null | undefined; className?: string }) {
  if (!title) return null;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
        className,
      )}
      title={t("Звание за олимпиады")}
    >
      <span aria-hidden>{title.icon}</span>
      {t(title.name)}
    </span>
  );
}
