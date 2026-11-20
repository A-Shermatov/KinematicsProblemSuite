import { useEffect, useState } from "react";
import { Badge, Card, cx, formatDateTime, t, type AnnouncementChange, type OlympiadAnnouncement } from "@kps/shared";

const SEEN_KEY = (olympiadId: number) => `kps.announcements.${olympiadId}`;

function readSeen(olympiadId: number): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY(olympiadId)) ?? 0);
  } catch {
    return 0;
  }
}

/** Что исправлено: удалённое зачёркнуто красным, добавленное — зелёным, как в диффе. */
export function ChangeDiff({ change }: { change: AnnouncementChange }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(change.label)}</p>
      {change.hidden ? (
        <p className="text-fg">{t("Ответ исправлен, автопроверка пересчитана.")}</p>
      ) : change.diff ? (
        <p className="whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 leading-relaxed text-fg">
          {change.diff.map((segment, index) =>
            segment.op === "equal" ? (
              <span key={index} className="text-muted">
                {segment.text}
              </span>
            ) : segment.op === "delete" ? (
              <del key={index} className="rounded bg-danger-soft px-0.5 text-danger" aria-label={t("убрано")}>
                {segment.text}
              </del>
            ) : (
              <ins key={index} className="rounded bg-success-soft px-0.5 font-medium text-success no-underline" aria-label={t("добавлено")}>
                {segment.text}
              </ins>
            ),
          )}
        </p>
      ) : (
        <p className="text-fg">
          <del className="text-danger">{change.before}</del> → <b className="text-success">{change.after}</b>
        </p>
      )}
    </div>
  );
}

function Item({ item, fresh, label }: { item: OlympiadAnnouncement; fresh: boolean; label?: string }) {
  return (
    <div className={cx("space-y-2 px-4 py-3", fresh && "bg-warning-soft/50")}>
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden>{item.changes.length ? "✏️" : "📢"}</span>
        <p className="flex-1 text-sm font-medium text-fg">{item.text}</p>
        {label && <Badge>{label}</Badge>}
        {fresh && <Badge tone="warning">{t("новое")}</Badge>}
        <span className="text-xs text-muted">{formatDateTime(item.created_at)}</span>
      </div>
      {item.changes.map((change) => (
        <ChangeDiff key={change.field} change={change} />
      ))}
    </div>
  );
}

/** Объявления и исправления условий — над вкладками, как на Codeforces. Новые подсвечены, пока их не прочитали. */
export function OlympiadAnnouncements({ olympiadId, items, taskLabel }: { olympiadId: number; items: OlympiadAnnouncement[]; taskLabel: (taskId: number | null) => string | undefined }) {
  const [seen, setSeen] = useState(() => readSeen(olympiadId));
  const [expanded, setExpanded] = useState(false);
  const newest = items[0]?.id ?? 0;
  const unread = items.filter((item) => item.id > seen).length;

  useEffect(() => {
    // Новые объявления — короткий сигнал во вкладке браузера.
    if (unread > 0) document.title = `(${unread}) ${document.title.replace(/^\(\d+\) /, "")}`;
    else document.title = document.title.replace(/^\(\d+\) /, "");
  }, [unread]);

  if (items.length === 0) return null;
  const markRead = () => {
    setSeen(newest);
    try {
      localStorage.setItem(SEEN_KEY(olympiadId), String(newest));
    } catch {
      /* приватный режим — просто не запоминаем */
    }
  };
  const shown = expanded ? items : items.slice(0, Math.max(2, unread));

  return (
    <Card className={cx("overflow-hidden", unread > 0 && "border-warning/60")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <h2 className="flex-1 text-sm font-semibold text-fg">
          📢 {t("Объявления жюри")} <span className="font-normal text-muted">· {items.length}</span>
        </h2>
        {unread > 0 && (
          <button onClick={markRead} className="text-xs font-medium text-primary hover:underline">
            {t("Прочитано")}
          </button>
        )}
      </div>
      <div className="divide-y divide-border">
        {shown.map((item) => (
          <Item key={item.id} item={item} fresh={item.id > seen} label={taskLabel(item.task_id)} />
        ))}
      </div>
      {items.length > shown.length && (
        <button onClick={() => setExpanded(true)} className="w-full border-t border-border py-2 text-xs font-medium text-primary hover:bg-surface-2">
          {t("Показать все ({0})", [items.length])}
        </button>
      )}
    </Card>
  );
}
