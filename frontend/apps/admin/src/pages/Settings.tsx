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
  Input,
  levelRange,
  type OlympiadLevel,
  type OlympiadLevelInput,
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
      <LevelsCard />
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

const EMPTY_LEVEL: OlympiadLevelInput = { title: "", description: "", min_rating: null, max_rating: null, position: 0 };
const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

/** Уровни олимпиад (как Div. 1/2/3 на Codeforces): учитель выбирает уровень при создании олимпиады. */
function LevelsCard() {
  const { data: levels, reload, error } = useAsync(() => api.olympiads.levels(), []);
  const [editing, setEditing] = useState<OlympiadLevel | "new" | null>(null);
  const [form, setForm] = useState<OlympiadLevelInput>(EMPTY_LEVEL);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const open = (level: OlympiadLevel | "new") => {
    setEditing(level);
    setMessage(null);
    setForm(level === "new" ? { ...EMPTY_LEVEL, position: (levels?.length ?? 0) + 1 } : { ...level });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (editing === "new") await api.admin.createLevel(form);
      else if (editing) await api.admin.updateLevel(editing.id, form);
      setEditing(null);
      reload();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (level: OlympiadLevel) => {
    if (!window.confirm(`Удалить уровень «${level.title}»? Олимпиады с ним останутся без уровня — все участники будут официальными.`)) return;
    try {
      await api.admin.removeLevel(level.id);
      reload();
    } catch (err) {
      setMessage(errorText(err));
    }
  };

  return (
    <Card className="mt-6 max-w-3xl space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-fg">Уровни олимпиад</h2>
          <p className="text-sm text-muted">
            Учитель выбирает уровень при создании олимпиады. Официально участвуют ученики с рейтингом <b>ниже верхней границы</b> (и все, у кого
            рейтинга ещё нет); у кого выше — решают вне конкурса: без места, диплома и изменения рейтинга. Нижняя граница — подсказка, для кого
            уровень.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => open("new")}>
          + Уровень
        </Button>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="divide-y divide-border rounded-xl border border-border">
        {levels?.map((level) => (
          <div key={level.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="w-6 text-muted">{level.position}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{level.title}</p>
              {level.description && <p className="text-xs text-muted">{level.description}</p>}
            </div>
            <span className="font-mono text-xs text-fg">{levelRange(level.min_rating, level.max_rating) || "любой рейтинг"}</span>
            <Button size="sm" variant="ghost" onClick={() => open(level)}>
              Изменить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove(level)}>
              Удалить
            </Button>
          </div>
        ))}
        {levels?.length === 0 && <p className="px-4 py-3 text-sm text-muted">Уровней нет — все олимпиады для всех.</p>}
      </div>
      {editing && (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-primary/30 bg-primary-soft/30 p-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_80px]">
            <Input label="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={2} maxLength={60} placeholder="5–8 класс" />
            <Input label="Рейтинг от" type="number" min={0} value={form.min_rating ?? ""} onChange={(e) => setForm({ ...form, min_rating: numberOrNull(e.target.value) })} placeholder="—" />
            <Input
              label="Рейтинг до (не вкл.)"
              type="number"
              min={1}
              value={form.max_rating ?? ""}
              onChange={(e) => setForm({ ...form, max_rating: numberOrNull(e.target.value) })}
              placeholder="без границы"
            />
            <Input label="Порядок" type="number" min={0} value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} />
          </div>
          <Input label="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} placeholder="Для кого этот уровень" />
          {message && <ErrorMessage>{message}</ErrorMessage>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={saving}>
              Сохранить
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Отмена
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
