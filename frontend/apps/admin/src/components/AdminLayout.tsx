import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  APP_NAME,
  Avatar,
  Button,
  Card,
  ErrorMessage,
  Input,
  Loading,
  ThemeToggle,
  cx,
  displayName,
  errorText,
  useAuth,
  useDocumentTitle,
} from "@kps/shared";
import { PUBLIC_URL } from "../config";

const NAV = [
  { to: "/", label: "Обзор", icon: "◧", end: true },
  { to: "/users", label: "Пользователи", icon: "👥" },
  { to: "/catalog", label: "Предметы и темы", icon: "▤" },
  { to: "/tasks", label: "Задачи", icon: "✎" },
  { to: "/attempts", label: "Решения", icon: "✓" },
  { to: "/olympiads", label: "Олимпиады", icon: "🏁" },
  { to: "/certificates", label: "Сертификаты", icon: "🎓" },
  { to: "/reviews", label: "Отзывы", icon: "💬" },
  { to: "/settings", label: "Настройки", icon: "⚙" },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg">D</span>
        <div className="leading-tight">
          <p className="font-bold text-fg">{APP_NAME}</p>
          <p className="text-xs text-muted">Админ-панель</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Разделы">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
                isActive ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
              )
            }
          >
            <span className="w-6 text-center text-lg" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-border p-3">
        <a href={PUBLIC_URL} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg">
          <span className="w-5 text-center" aria-hidden>
            ↗
          </span>
          Открыть сайт
        </a>
        {user && (
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <Avatar src={user.avatar_url} name={displayName(user)} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{displayName(user)}</p>
              <button
                className="text-xs text-muted hover:text-danger"
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
              >
                Выйти
              </button>
            </div>
            <ThemeToggle placement="top" />
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-surface lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-surface" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur lg:hidden">
        <button className="rounded-lg p-2 text-muted hover:bg-surface-2" onClick={() => setOpen(true)} aria-label="Открыть меню">
          ☰
        </button>
        <p className="font-semibold text-fg">Админ-панель</p>
      </header>
      <main className="mx-auto w-full max-w-[1760px] px-4 py-8 sm:px-8 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user || user.role !== "admin") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function AdminLogin() {
  useDocumentTitle("Вход");
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (user?.role === "admin") return <Navigate to={from} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const me = await login(username.trim(), password);
      if (me.role !== "admin") {
        await logout();
        setError("У этого аккаунта нет прав администратора");
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-fg">D</span>
          <h1 className="text-2xl font-bold text-fg">Админ-панель</h1>
          <p className="text-sm text-muted">Вход только для администраторов</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <Input label="Имя пользователя" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            <Input label="Пароль" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" className="w-full" loading={loading}>
              Войти
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
