import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  PageHeader,
  ProgressBar,
  api,
  plural,
  t,
  useAsync,
  useAuth,
  useDocumentTitle,
  type Collection,
  type TaskProgress,
  Pagination,
  usePaged,
} from "@kps/shared";
import { TaskRow } from "./Catalog";

function CollectionCard({ collection, showProgress }: { collection: Collection; showProgress: boolean }) {
  const done = collection.tasks_count > 0 && collection.solved_count === collection.tasks_count;
  return (
    <Link to={`/collections/${collection.id}`} className="group">
      <Card className="flex h-full flex-col gap-3 p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-fg group-hover:text-primary">{collection.title}</p>
          {done && <Badge tone="success">✓</Badge>}
          {!collection.is_public && <Badge>{t("Скрыта")}</Badge>}
        </div>
        {collection.description && <p className="line-clamp-2 text-sm text-muted">{collection.description}</p>}
        <p className="mt-auto text-sm text-muted">
          {collection.author_name} · {collection.tasks_count} {plural(collection.tasks_count, ["задача", "задачи", "задач"])}
        </p>
        {showProgress && collection.tasks_count > 0 && (
          <div className="space-y-1">
            <ProgressBar value={collection.solved_count} max={collection.tasks_count} />
            <p className="text-xs text-muted">
              {t("Решено")} {collection.solved_count} {t("из")} {collection.tasks_count}
            </p>
          </div>
        )}
      </Card>
    </Link>
  );
}

export function CollectionsPage() {
  useDocumentTitle(t("Подборки"));
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading } = useAsync(() => api.collections.list({ search: query || undefined }), [query, user?.id]);
  const paged = usePaged(data ?? [], 24, query);
  return (
    <>
      <PageHeader
        title={t("Подборки задач")}
        subtitle={t("Готовые тренировки от учителей: задачи из разных тем и книг с вашим прогрессом")}
        actions={
          <div className="flex flex-wrap gap-2">
            {user?.role === "student" && (
              <ButtonLink to="/practice/unsolved" variant="secondary">
                🔁 {t("Мои нерешённые")}
              </ButtonLink>
            )}
            {user && user.role !== "student" && <ButtonLink to="/manage/collections/new">{t("+ Новая подборка")}</ButtonLink>}
          </div>
        }
      />
      <form
        className="mb-6 w-full sm:w-96"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input placeholder={t("Поиск подборок, Enter")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("Поиск подборок")} />
      </form>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState icon="🗂" title={t("Подборок пока нет")} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {paged.pageItems.map((collection) => <CollectionCard key={collection.id} collection={collection} showProgress={user?.role === "student"} />)}
      </div>
      <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} total={paged.total} />
    </>
  );
}

export function CollectionPage() {
  const collectionId = Number(useParams().collectionId);
  const { user } = useAuth();
  const { data, error, loading } = useAsync(() => api.collections.get(collectionId), [collectionId, user?.id]);
  useDocumentTitle(data?.title);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorMessage>{error ?? t("Подборка не найдена")}</ErrorMessage>;
  const next = data.tasks.find((task) => !task.solved);
  return (
    <>
      <PageHeader
        title={data.title}
        subtitle={`${data.author_name} · ${data.tasks_count} ${plural(data.tasks_count, ["задача", "задачи", "задач"])}`}
        breadcrumbs={[{ label: t("Подборки"), to: "/collections" }, { label: data.title }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {data.can_edit && (
              <ButtonLink to={`/manage/collections/${data.id}/edit`} variant="secondary">
                {t("Изменить")}
              </ButtonLink>
            )}
            {user?.role === "student" && next && <ButtonLink to={`/tasks/${next.id}`}>{data.solved_count ? t("Продолжить") : t("Начать")} →</ButtonLink>}
          </div>
        }
      />
      {data.description && <p className="mb-6 max-w-3xl whitespace-pre-line text-fg">{data.description}</p>}
      {user?.role === "student" && data.tasks_count > 0 && (
        <Card className="mb-6 space-y-2 p-5">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-fg">{t("Ваш прогресс")}</span>
            <span className="text-muted">
              {data.solved_count} / {data.tasks_count}
            </span>
          </div>
          <ProgressBar value={data.solved_count} max={data.tasks_count} />
        </Card>
      )}
      {data.tasks.length === 0 ? (
        <EmptyState title={t("В подборке пока нет задач")} />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {data.tasks.map((task) => (
            <TaskRow key={task.id} task={task} to={`/tasks/${task.id}`} />
          ))}
        </Card>
      )}
    </>
  );
}

const PROGRESS_TABS: { key: TaskProgress; label: string; empty: string }[] = [
  { key: "unsolved", label: t("Нерешённые"), empty: t("Нерешённых задач нет — отличная работа!") },
  { key: "new", label: t("Ещё не пробовал(а)"), empty: t("Вы попробовали все задачи") },
  { key: "solved", label: t("Решённые"), empty: t("Решённых задач пока нет") },
];

/** Повторение: задачи, которые ученик пробовал, но не решил, — и остальные по прогрессу. */
export function PracticePage() {
  const progress = (useParams().progress as TaskProgress) || "unsolved";
  const tab = PROGRESS_TABS.find((item) => item.key === progress) ?? PROGRESS_TABS[0];
  useDocumentTitle(tab.label);
  const { data, error, loading } = useAsync(() => api.tasks.list({ progress: tab.key, limit: 1000 }), [tab.key]);
  const paged = usePaged(data ?? [], 25, tab.key);
  return (
    <>
      <PageHeader title={t("Мои задачи для повторения")} subtitle={t("Вернитесь к задачам, которые не получились с первого раза")} />
      <div className="mb-6 flex flex-wrap gap-2">
        {PROGRESS_TABS.map((item) => (
          <ButtonLink key={item.key} to={`/practice/${item.key}`} variant={item.key === tab.key ? "primary" : "secondary"} size="sm">
            {item.label}
          </ButtonLink>
        ))}
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && data.length === 0 && <EmptyState icon="🎉" title={tab.empty} />}
      {data && data.length > 0 && (
        <>
          <Card className="divide-y divide-border overflow-hidden">
            {paged.pageItems.map((task) => (
              <TaskRow key={task.id} task={task} to={`/tasks/${task.id}`} />
            ))}
          </Card>
          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} total={paged.total} />
        </>
      )}
    </>
  );
}
