import type { ReactNode } from "react";
import { t } from "../i18n";
import { countryName, flagEmoji } from "../lib/geo";
import { cx } from "./ui";

interface Props {
  name: string;
  username: string;
  countryCode?: string | null;
  school?: string | null;
  city?: string | null;
  /** Цвет имени (звание по рейтингу) и т. п. */
  nameClass?: string;
  /** Рядом с именем — например, звание. */
  extra?: ReactNode;
}

/** Ученик в списках: ФИО и флаг, ниже логин, третьей строкой школа и город (если чего-то нет — дефис). */
export function UserCell({ name, username, countryCode, school, city, nameClass, extra }: Props) {
  const flag = flagEmoji(countryCode);
  return (
    <div className="min-w-0 leading-tight">
      <p className="flex min-w-0 items-center gap-1.5">
        <span className={cx("truncate font-semibold", nameClass || "text-fg")}>{name || username}</span>
        {flag && (
          <span className="shrink-0 text-base" title={countryName(countryCode!)} aria-label={countryName(countryCode!)} role="img">
            {flag}
          </span>
        )}
        {extra}
      </p>
      <p className="truncate text-xs text-muted">@{username}</p>
      <p className="truncate text-xs text-muted" title={t("Школа, город")}>
        {school || "—"}, {city || "—"}
      </p>
    </div>
  );
}
