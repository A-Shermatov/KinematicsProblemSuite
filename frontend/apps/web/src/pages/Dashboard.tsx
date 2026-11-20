import { Link } from "react-router-dom";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  ErrorMessage,
  Loading,
  PageHeader,
  ProgressBar,
  StatCard,
  api,
  buttonClass,
  displayName,
  formatDateTime,
  roleLabel,
  statusMeta,
  useAsync,
  useAuth,
  useDocumentTitle,
  type Attempt,
  type StudentStats,
  type TeacherStats,
} from "@kps/shared";
import { ADMIN_URL } from "../config";

function RecentAttempts({ attempts, showStudent }: { attempts: Attempt[]; showStudent?: boolean }) {
  if (attempts.length === 0) return <EmptyState title="Пока пусто" />;
  return (
    <ul className="divide-y divide-border">
      {attempts.map((attempt) => (
        <li key={attempt.id} className="flex items-center gap-3 px-5 py-3 text-sm">
          <Badge tone={statusMeta[attempt.status].tone}>{statusMeta[attempt.status].label}</Badge>
          <div className="min-w-0 flex-1">
            <Link to={`/tasks/${attempt.task_id}`} className="block truncate font-medium text-fg hover:text-primary">
              {attempt.task_title}
            </Link>
            {showStudent && <p className="text-xs text-muted">{attempt.student_name || attempt.student_username}</p>}
          </div>
          <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(attempt.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function StudentDashboard({ stats, attempts }: { stats: StudentStats; attempts: Attempt[] }) {
  const accuracy = stats.correct + stats.incorrect > 0 ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100) : 0;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Решено задач" value={stats.solved_tasks} tone="success" />
        <StatCard label="Всего попыток" value={stats.attempts} />
        <StatCard label="Точность" value={`${accuracy}%`} hint="доля верных автопроверок" tone="primary" />
        <StatCard label="На проверке" value={stats.pending} tone="warning" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-5 font-semibold text-fg">Прогресс по темам</h2>
          {stats.by_theme.length === 0 ? (
            <EmptyState title="Вы ещё не решали задачи">
              <Link to="/catalog" className="text-primary hover:underline">
                Выбрать тему
              </Link>
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {stats.by_theme.map((theme) => (
                <Link key={theme.theme_id} to={`/themes/${theme.theme_id}`} className="block space-y-1.5 group">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-fg group-hover:text-primary">{theme.theme_title}</span>
                    <span className="text-muted">
                      {theme.solved_tasks} / {theme.total_tasks}
                    </span>
                  </div>
                  <ProgressBar value={theme.solved_tasks} max={theme.total_tasks} />
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold text-fg">Последние решения</h2>
            <Link to="/attempts" className="text-sm text-primary hover:underline">
              Все
            </Link>
          </div>
          <RecentAttempts attempts={attempts.slice(0, 6)} />
        </Card>
      </div>
    </div>
  );
}

function TeacherDashboard({ stats, attempts }: { stats: TeacherStats; attempts: Attempt[] }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Мои задачи" value={stats.tasks} tone="primary" />
        <StatCard label="Ждут проверки" value={stats.pending} tone="warning" />
        <StatCard label="Решений получено" value={stats.attempts} />
        <StatCard label="Учеников" value={stats.students} tone="success" />
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold text-fg">Ждут вашей проверки</h2>
          <Link to="/attempts?status=pending" className="text-sm text-primary hover:underline">
            Проверить
          </Link>
        </div>
        <RecentAttempts attempts={attempts.slice(0, 8)} showStudent />
      </Card>
    </div>
  );
}

export function Dashboard() {
  useDocumentTitle("Личный кабинет");
  const { user } = useAuth();
  const { data, error, loading } = useAsync(async () => {
    const stats = await api.stats.me();
    const attempts =
      stats.role === "student"
        ? await api.attempts.list({ scope: "mine" })
        : await api.attempts.list({ scope: "authored", status: "pending" });
    return { stats, attempts };
  }, [user?.id]);

  if (!user) return null;
  const stats = data?.stats;
  const attempts = data?.attempts ?? [];
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-4">
            <Avatar src={user.avatar_url} name={displayName(user)} size={56} />
            <span>
              Привет, {user.first_name || user.username}!
              <span className="block text-sm font-normal text-muted">{roleLabel[user.role]}</span>
            </span>
          </span>
        }
        actions={
          user.role === "student" ? (
            <ButtonLink to="/catalog">Решать задачи</ButtonLink>
          ) : (
            <ButtonLink to="/manage/tasks/new">+ Новая задача</ButtonLink>
          )
        }
      />
      {user.role === "admin" && (
        <Card className="mb-8 flex flex-wrap items-center gap-4 border-primary/30 bg-primary-soft p-5">
          <p className="flex-1 text-sm text-fg">
            Управление пользователями, каталогом и всеми решениями — в отдельной админ-панели.
          </p>
          <a href={ADMIN_URL} className={buttonClass("primary", "sm")}>
            Открыть админ-панель ↗
          </a>
        </Card>
      )}
      {loading && <Loading />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {stats?.role === "student" && <StudentDashboard stats={stats} attempts={attempts} />}
      {stats && stats.role !== "student" && <TeacherDashboard stats={stats} attempts={attempts} />}
    </>
  );
}
