import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { Role } from "../api";
import { displayName, roleLabel, useAuth } from "../auth/AuthContext";
import { useTheme, type ThemeMode } from "../theme/ThemeContext";
import { Avatar, ButtonLink, Loading, cx } from "./ui";

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: "/catalog", label: "Задачи" },
  { to: "/leaderboard", label: "Рейтинг" },
  { to: "/attempts", label: "Решения", roles: ["student", "teacher", "admin"] },
  { to: "/manage/tasks", label: "Мои задачи", roles: ["teacher", "admin"] },
  { to: "/manage/catalog", label: "Каталог", roles: ["admin"] },
  { to: "/manage/users", label: "Пользователи", roles: ["admin"] },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-fg">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 18 L12 5 L20 18" />
        </svg>
      </span>
      <span className="text-lg">Kinematics</span>
    </Link>
  );
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "light", label: "Светлая", icon: "☀" },
  { mode: "dark", label: "Тёмная", icon: "☾" },
  { mode: "system", label: "Как в системе", icon: "◐" },
];

export function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-muted hover:bg-surface-2 hover:text-fg"
        aria-label={`Тема: ${resolved === "dark" ? "тёмная" : "светлая"}. Сменить тему`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {resolved === "dark" ? "☾" : "☀"}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-border bg-surface p-1 shadow-card">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.mode}
              role="menuitemradio"
              aria-checked={mode === option.mode}
              onClick={() => {
                setMode(option.mode);
                setOpen(false);
              }}
              className={cx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                mode === option.mode ? "bg-primary-soft text-primary" : "text-fg hover:bg-surface-2",
              )}
            >
              <span className="w-4 text-center" aria-hidden>
                {option.icon}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useClickOutside(ref: RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  if (!user) return null;

  const item = "block w-full rounded-lg px-3 py-2 text-left text-sm text-fg hover:bg-surface-2";
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-full p-0.5 hover:ring-4 hover:ring-[var(--ring)]" aria-label="Меню пользователя" aria-expanded={open}>
        <Avatar src={user.avatar_url} name={displayName(user)} size={36} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-border bg-surface p-1 shadow-card" onClick={() => setOpen(false)}>
          <div className="px-3 py-2.5">
            <p className="truncate font-semibold text-fg">{displayName(user)}</p>
            <p className="text-xs text-muted">
              @{user.username} · {roleLabel[user.role]}
            </p>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link to="/dashboard" className={item}>
            Личный кабинет
          </Link>
          <Link to="/profile" className={item}>
            Настройки профиля
          </Link>
          <div className="my-1 h-px bg-border" />
          <button
            className={cx(item, "text-danger")}
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const items = NAV.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx("rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-primary-soft text-primary" : "text-muted hover:text-fg hover:bg-surface-2");

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Основное меню">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <UserMenu />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <ButtonLink to="/login" variant="ghost" size="sm">
                Войти
              </ButtonLink>
              <ButtonLink to="/register" size="sm">
                Регистрация
              </ButtonLink>
            </div>
          )}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Открыть меню"
            aria-expanded={mobileOpen}
          >
            ☰
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="border-t border-border px-4 py-3 md:hidden" aria-label="Мобильное меню">
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
            {!user && (
              <>
                <NavLink to="/login" className={linkClass}>
                  Войти
                </NavLink>
                <NavLink to="/register" className={linkClass}>
                  Регистрация
                </NavLink>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted">
        Kinematics — задачи по физике и математике · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
