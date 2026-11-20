import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  PageHeader,
  api,
  cx,
  difficultyClass,
  formatDate,
  formatSource,
  t,
  useAsync,
  useAuth,
  useDocumentTitle,
  usePlatformSettings,
  type ArchiveProblem,
  type ArchiveQuery,
  type ArchiveSort,
} from "@kps/shared";

const PAGE = 30;
const SORTS: { key: ArchiveSort; label: string }[] = [
  { key: "new", label: t("Сначала новые") },
  { key: "old", label: t("Сначала старые") },
  { key: "difficulty_asc", label: t("Сначала простые") },
  { key: "difficulty_desc", label: t("Сначала сложные") },
  { key: "solved_desc", label: t("Чаще решают") },
  { key: "solved_asc", label: t("Реже решают") },
];
const PROGRESS = [
  { key: "", label: t("Все") },
  { key: "unsolved", label: t("Нерешённые") },
  { key: "solved", label: t("Решённые") },
  { key: "tried", label: t("Пробовал") },
] as const;

const selectClass = "h-10 rounded-xl border border-border bg-surface px-3 text-sm text-fg";

function MyResult({ item }: { item: ArchiveProblem }) {
  if (item.my_best === null) return <span className="text-muted">—</span>;
  const tone = item.my_best >= item.max_points ? "success" : item.my_best > 0 ? "warning" : "danger";
  return (
    <Badge tone={tone}>
      {item.my_best} / {item.max_points}
    </Badge>
  );
}

/** Архив задач олимпиад, прошедших на платформе, — как Problemset на Codeforces. */
export function OlympiadArchive() {
  useDocumentTitle(t("Задачи олимпиад"));
  const { user } = useAuth();
  const { settings } = usePlatformSettings();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [pages, setPages] = useState(1);
  const num = (key: string) => (params.get(key) ? Number(params.get(key)) : undefined);
  const query: ArchiveQuery = {
    subject_id: num("subject"),
    level_id: num("level"),
    difficulty_min: num("from"),
    difficulty_max: num("to"),
    q: params.get("q") || undefined,
    progress: (params.get("progress") as ArchiveQuery["progress"]) || undefined,
    sort: (params.get("sort") as ArchiveSort | null) ?? "new",
  };
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setPages(1);
    setParams(next, { replace: true });
  };

  const { data: filters } = useAsync(async () => {
    const [subjects, levels] = await Promise.all([api.subjects.list(), api.olympiads.levels()]);
    return { subjects, levels };
  }, []);
  const { data, error, loading } = useAsync(() => api.olympiads.archive({ ...query, limit: PAGE * pages, offset: 0 }), [params.toString(), pages, user?.id]);

  return (
    <>
      <PageHeader
        title={t("Задачи олимпиад")}
        subtitle={t("Все задачи олимпиад, прошедших на платформе. Решайте их виртуально — с тем же таймером, что был у участников.")}
        actions={
          <ButtonLink to="/olympiads" variant="secondary">
            {t("← Олимпиады")}
          </ButtonLink>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <form
          className="w-64"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: search.trim() || null });
          }}
        >
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Название задачи или олимпиады, Enter")} aria-label={t("Поиск")} className="h-10" />
        </form>
        <select value={query.subject_id ?? ""} onChange={(e) => update({ subject: e.target.value || null })} className={selectClass} aria-label={t("Предмет")}>
          <option value="">{t("Все предметы")}</option>
          {filters?.subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.title}
            </option>
          ))}
        </select>
        <select value={query.level_id ?? ""} onChange={(e) => update({ level: e.target.value || null })} className={selectClass} aria-label={t("Уровень")}>
          <option value="">{t("Все уровни")}</option>
          {filters?.levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.title}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 text-sm text-muted">
          {t("Сложность")}
          <select value={query.difficulty_min ?? ""} onChange={(e) => update({ from: e.target.value || null })} className={selectClass} aria-label={t("Сложность от")}>
            <option value="">{t("от")}</option>
            {settings.difficulty_levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          —
          <select value={query.difficulty_max ?? ""} onChange={(e) => update({ to: e.target.value || null })} className={selectClass} aria-label={t("Сложность до")}>
            <option value="">{t("до")}</option>
            {settings.difficulty_levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        <select value={query.sort} onChange={(e) => update({ sort: e.target.value === "new" ? null : e.target.value })} className={selectClass} aria-label={t("Сортировка")}>
          {SORTS.map((sort) => (
            <option key={sort.key} value={sort.key}>
              {sort.label}
            </option>
          ))}
        </select>
        {user && (
          <div className="flex rounded-xl border border-border bg-surface p-1 text-sm">
            {PROGRESS.map((item) => (
              <button
                key={item.key}
                onClick={() => update({ progress: item.key || null })}
                className={cx("rounded-lg px-3 py-1.5 font-medium", (query.progress ?? "") === item.key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.items.length === 0 && <EmptyState icon="🗂" title={t("Задач не найдено")} />}
      {data && data.items.length > 0 && (
        <>
          <p className="mb-2 text-sm text-muted">{t("Найдено: {0}", [data.total])}</p>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">{t("Задача")}</th>
                  <th className="px-4 py-3 font-medium">{t("Олимпиада")}</th>
                  <th className="px-4 py-3 text-center font-medium">{t("Сложность")}</th>
                  <th className="px-4 py-3 text-right font-medium" title={t("Решили полностью из отправивших")}>
                    {t("Решили")}
                  </th>
                  {user && <th className="px-4 py-3 text-right font-medium">{t("Моё")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => {
                  const source = formatSource(item);
                  return (
                    <tr key={item.id} className="hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <Link to={`/olympiads/${item.olympiad_id}/problems/${item.label}`} className="font-medium text-fg hover:text-primary">
                          <span className="mr-1.5 font-bold text-primary">{item.label}.</span>
                          {item.title}
                        </Link>
                        {source && <p className="text-xs text-muted">{source}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/olympiads/${item.olympiad_id}`} className="text-fg hover:text-primary">
                          {item.olympiad_title}
                        </Link>
                        <p className="text-xs text-muted">
                          {formatDate(item.ends_at)}
                          {item.subject_title && ` · ${item.subject_title}`}
                          {item.level_title && ` · ${item.level_title}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.difficulty ? (
                          <span className={cx("rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold", difficultyClass(item.difficulty, settings.difficulty_max))}>{item.difficulty}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="text-fg">👤 ×{item.solved}</span>
                        <span className="ml-1 text-xs text-muted">/ {item.tried}</span>
                        {item.avg_percent !== null && <p className="text-[11px] text-muted">{t("средний балл {0}%", [item.avg_percent])}</p>}
                      </td>
                      {user && (
                        <td className="px-4 py-3 text-right">
                          <MyResult item={item} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          {data.items.length < data.total && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => setPages((n) => n + 1)} loading={loading}>
                {t("Показать ещё")}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
