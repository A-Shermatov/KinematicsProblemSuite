import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  ErrorMessage,
  Loading,
  PageHeader,
  Select,
  api,
  difficultyClass,
  errorText,
  plural,
  useAsync,
  useDocumentTitle,
  usePlatformSettings,
} from "@kps/shared";

const MAX_OPTIONS = Array.from({ length: 100 }, (_, i) => (i + 1) * 100);

export function Settings() {
  useDocumentTitle("Настройки");
  const { reload } = usePlatformSettings();
  const { data, error, loading } = useAsync(() => api.admin.settings(), []);
  const [max, setMax] = useState(1000);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setMax(data.difficulty_max);
  }, [data]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setSaveError(null);
    try {
      await api.admin.updateSettings({ difficulty_max: max });
      reload();
      setMessage("Настройки сохранены");
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const preview = Array.from({ length: max / 100 }, (_, i) => (i + 1) * 100);

  return (
    <>
      <PageHeader title="Системные настройки" subtitle="Параметры, общие для всей платформы" />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && (
        <Card className="max-w-3xl p-6">
          <form onSubmit={save} className="space-y-5">
            <div>
              <h2 className="font-semibold text-fg">Шкала сложности задач</h2>
              <p className="text-sm text-muted">
                Уровни идут шагом 100: 100, 200, 300 и так далее до верхнего предела. Задачи с уровнем выше нового предела сохранят свой уровень,
                но новые задачи сложнее предела создать будет нельзя.
              </p>
            </div>
            {message && <div className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{message}</div>}
            {saveError && <ErrorMessage>{saveError}</ErrorMessage>}
            <div className="max-w-xs">
              <Select label="Верхний уровень" value={max} onChange={(e) => setMax(Number(e.target.value))}>
                {MAX_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} ({value / 100} {plural(value / 100, ["уровень", "уровня", "уровней"])})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-fg">Как будут выглядеть уровни</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.map((level) => (
                  <span key={level} className={`rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold ${difficultyClass(level, max)}`}>
                    {level}
                  </span>
                ))}
              </div>
            </div>
            <Button type="submit" loading={saving}>
              Сохранить
            </Button>
          </form>
        </Card>
      )}
      <RatingCard />
    </>
  );
}

/** Пересчёт рейтинга олимпиадников с нуля — после удаления олимпиады или ручной правки итогов. */
function RatingCard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const recompute = async () => {
    if (!window.confirm("Пересчитать рейтинг всех олимпиадников с нуля по всем олимпиадам с опубликованными итогами?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const { olympiads } = await api.admin.recomputeRating();
      setMessage(`Готово: учтено ${olympiads} ${plural(olympiads, ["олимпиада", "олимпиады", "олимпиад"])}.`);
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mt-6 max-w-3xl space-y-3 p-6">
      <h2 className="font-semibold text-fg">Рейтинг олимпиадников</h2>
      <p className="text-sm text-muted">
        Рейтинг пересчитывается сам после публикации итогов каждой олимпиады. Полный пересчёт нужен, если олимпиаду удалили или итоги
        изменили вручную в базе.
      </p>
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={recompute} loading={busy}>
          Пересчитать рейтинг
        </Button>
        {message && <span className="text-sm text-fg">{message}</span>}
      </div>
    </Card>
  );
}
