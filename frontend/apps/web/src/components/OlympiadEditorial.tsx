import { useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Loading,
  Markdown,
  MarkdownEditor,
  api,
  errorText,
  formatCountdown,
  formatDateTime,
  t,
  useAsync,
  useNow,
  type OlympiadDetail,
  type OlympiadEditorial,
} from "@kps/shared";

/** Редактор разбора для организатора: общий текст и решение каждой задачи. */
function EditorialForm({ olympiadId, data, onSaved, onCancel }: { olympiadId: number; data: OlympiadEditorial; onSaved: () => void; onCancel: () => void }) {
  const [text, setText] = useState(data.text);
  const [solutions, setSolutions] = useState<Record<number, string>>(Object.fromEntries(data.tasks.map((task) => [task.id, task.solution])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.olympiads.saveEditorial(olympiadId, { text, solutions });
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4">
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Card className="p-5">
        <MarkdownEditor label={t("Общий разбор")} value={text} onChange={setText} rows={6} placeholder={t("Как прошла олимпиада, типичные ошибки, что почитать…")} onUploadImage={api.imports.uploadImage} />
      </Card>
      {data.tasks.map((task) => (
        <Card key={task.id} className="p-5">
          <MarkdownEditor
            label={`${task.label}. ${task.title} — ${t("ответ")} ${task.answer}${task.unit ? ` ${task.unit}` : ""}`}
            value={solutions[task.id] ?? ""}
            onChange={(value) => setSolutions((prev) => ({ ...prev, [task.id]: value }))}
            rows={8}
            placeholder={t("Решение: идея, формулы, рисунок…")}
            onUploadImage={api.imports.uploadImage}
          />
        </Card>
      ))}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t("Отмена")}
        </Button>
        <Button onClick={save} loading={saving}>
          {t("Сохранить разбор")}
        </Button>
      </div>
    </div>
  );
}

/** Вкладка «Разбор»: открывается через сутки после окончания олимпиады. */
export function EditorialTab({ olympiad, virtualActive }: { olympiad: OlympiadDetail; virtualActive: boolean }) {
  const now = useNow(1000);
  const [editing, setEditing] = useState(false);
  const opensAt = olympiad.editorial_at ? new Date(olympiad.editorial_at).getTime() : Infinity;
  const open = olympiad.can_manage || (olympiad.status === "published" && now >= opensAt && !virtualActive);
  const { data, error, loading, reload } = useAsync(() => (open ? api.olympiads.editorial(olympiad.id) : Promise.resolve(null)), [olympiad.id, open]);

  if (!open) {
    if (virtualActive) return <EmptyState icon="⏱" title={t("Разбор откроется, когда закончится ваше виртуальное участие")} />;
    return (
      <EmptyState icon="📖" title={t("Разбор откроется на следующий день после олимпиады")}>
        {olympiad.editorial_at && (
          <span>
            {formatDateTime(olympiad.editorial_at)}
            {opensAt - now < 2 * 86400_000 && <span className="ml-2 font-mono tabular-nums text-fg">⏳ {formatCountdown(opensAt - now)}</span>}
          </span>
        )}
      </EmptyState>
    );
  }
  if (loading && !data) return <Loading />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return null;
  if (editing) return <EditorialForm olympiadId={olympiad.id} data={data} onSaved={() => { setEditing(false); reload(); }} onCancel={() => setEditing(false)} />;

  const empty = !data.text && data.tasks.every((task) => !task.solution);
  return (
    <div className="space-y-4">
      {olympiad.can_manage && (
        <Card className="flex flex-wrap items-center gap-3 border-primary/30 bg-primary-soft/40 p-4 text-sm">
          <p className="flex-1 text-fg">
            {now < opensAt ? t("Участники увидят разбор {0}. Пока его видите только вы.", [formatDateTime(olympiad.editorial_at!)]) : t("Разбор открыт для всех.")}
          </p>
          <Button size="sm" onClick={() => setEditing(true)}>
            {empty ? t("Написать разбор") : t("Редактировать")}
          </Button>
        </Card>
      )}
      {empty && !olympiad.can_manage && <EmptyState icon="📖" title={t("Организатор пока не написал разбор")} />}
      {data.text && (
        <Card className="p-6">
          <Markdown source={data.text} />
        </Card>
      )}
      {!empty &&
        data.tasks.map((task) => (
          <Card key={task.id} className="space-y-3 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-fg">
                {task.label}. {task.title}
              </h3>
              <span className="text-sm text-muted">
                {t("Ответ:")}{" "}
                <span className="font-mono text-fg">
                  {task.answer}
                  {task.unit ? ` ${task.unit}` : ""}
                </span>
              </span>
            </div>
            {task.solution ? <Markdown source={task.solution} /> : <p className="text-sm text-muted">{t("Разбора этой задачи нет.")}</p>}
          </Card>
        ))}
    </div>
  );
}
