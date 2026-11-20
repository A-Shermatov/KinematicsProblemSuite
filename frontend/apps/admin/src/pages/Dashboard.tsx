import { Link } from "react-router-dom";
import { ButtonLink, Card, ErrorMessage, Loading, PageHeader, StatCard, api, useAsync, useDocumentTitle } from "@kps/shared";

export function Dashboard() {
  useDocumentTitle("Обзор");
  const { data: stats, error, loading } = useAsync(() => api.admin.stats(), []);

  return (
    <>
      <PageHeader title="Обзор платформы" subtitle="Ключевые цифры и задачи, требующие внимания" />
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {stats && (
        <div className="space-y-8">
          {stats.pending > 0 && (
            <Card className="flex flex-wrap items-center gap-4 border-warning/40 bg-warning-soft p-5">
              <p className="flex-1 text-sm text-fg">
                <span className="font-semibold">{stats.pending}</span> решений ждут проверки учителями.
              </p>
              <ButtonLink to="/attempts?status=pending" size="sm" variant="secondary">
                Посмотреть
              </ButtonLink>
            </Card>
          )}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Пользователи</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard label="Учеников" value={stats.students} tone="primary" />
              <StatCard label="Учителей" value={stats.teachers} tone="success" />
              <StatCard label="Заблокировано" value={stats.blocked} tone="danger" />
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Контент</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Предметов" value={stats.subjects} />
              <StatCard label="Тем" value={stats.themes} />
              <StatCard label="Задач" value={stats.tasks} />
              <StatCard label="Решений" value={stats.attempts} hint={`${stats.pending} на проверке`} />
            </div>
          </section>
          <section className="grid gap-4 md:grid-cols-3">
            {[
              { to: "/users", title: "Назначить учителя", text: "Найдите пользователя и смените роль" },
              { to: "/catalog", title: "Добавить тему", text: "Структура каталога предметов и тем" },
              { to: "/tasks", title: "Проверить задачи", text: "Все задачи учителей с редактированием" },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="group">
                <Card className="h-full p-5 transition group-hover:border-primary/50">
                  <p className="font-semibold text-fg group-hover:text-primary">{item.title} →</p>
                  <p className="mt-1 text-sm text-muted">{item.text}</p>
                </Card>
              </Link>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
