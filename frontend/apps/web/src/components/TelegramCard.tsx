import { useState } from "react";
import { Button, Card, ErrorMessage, api, errorText, t, useAsync, type TelegramStatus } from "@kps/shared";

/** Привязка Telegram-бота и настройки уведомлений. */
export function TelegramCard() {
  const { data, setData, error } = useAsync(() => api.telegram.status(), []);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  // Бот не настроен на сервере — карточку не показываем.
  if (error || !data || (!data.bot_username && !data.linked)) return null;

  const act = async (fn: () => Promise<TelegramStatus | void>) => {
    setBusy(true);
    setProblem(null);
    try {
      const next = await fn();
      setData(next ?? (await api.telegram.status()));
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const { url } = await api.telegram.link();
      setLink(url);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: "daily_task" | "notify") => act(() => api.telegram.update({ daily_task: data.daily_task, notify: data.notify, [key]: !data[key] }));

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          ✈️
        </span>
        <div>
          <h2 className="font-semibold text-fg">Telegram</h2>
          <p className="text-sm text-muted">{t("Задача дня по утрам, напоминания об олимпиадах и уведомления о проверке решений.")}</p>
        </div>
      </div>
      {problem && <ErrorMessage>{problem}</ErrorMessage>}
      {data.linked ? (
        <>
          <p className="text-sm text-fg">
            ✅ {t("Подключено")}
            {data.username && <span className="text-muted"> · @{data.username}</span>}
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-fg">
              <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={data.daily_task} disabled={busy} onChange={() => toggle("daily_task")} />
              {t("Задача дня каждое утро в 9:00")}
            </label>
            <label className="flex items-center gap-2 text-sm text-fg">
              <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={data.notify} disabled={busy} onChange={() => toggle("notify")} />
              {t("Уведомления: проверка решений, олимпиады, звания")}
            </label>
          </div>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(() => api.telegram.unlink())}>
            {t("Отключить")}
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <Button onClick={connect} loading={busy}>
            {t("Подключить Telegram")}
          </Button>
          {link && (
            <p className="text-sm text-muted">
              {t("Откройте бота и нажмите «Start». Если окно не открылось —")}{" "}
              <a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {t("ссылка")}
              </a>
              . {t("Ссылка действует 15 минут.")}{" "}
              <button type="button" className="text-primary hover:underline" onClick={() => act(() => api.telegram.status())}>
                {t("Я подключил(а)")}
              </button>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
