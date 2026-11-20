import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  ErrorMessage,
  Input,
  api,
  errorText,
  useAuth,
  useDocumentTitle,
} from "@kps/shared";

function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        <p className="text-muted">{subtitle}</p>
      </div>
      <Card className="p-6 sm:p-8">{children}</Card>
      <p className="text-center text-sm text-muted">{footer}</p>
    </div>
  );
}

export function Login() {
  useDocumentTitle("Вход");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const from = (location.state as { from?: string; registered?: boolean } | null) ?? {};

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate(from.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="С возвращением"
      subtitle="Войдите, чтобы продолжить решать задачи"
      footer={
        <>
          Нет аккаунта?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Зарегистрируйтесь
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {from.registered && !error && (
          <div className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">Аккаунт создан — теперь войдите.</div>
        )}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Input label="Имя пользователя" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        <Input label="Пароль" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Войти
        </Button>
      </form>
    </AuthCard>
  );
}

export function Register() {
  useDocumentTitle("Регистрация");
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", username: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.auth.register({
        username: form.username.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Создать аккаунт"
      subtitle="Регистрация занимает меньше минуты"
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Войти
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Имя" value={form.first_name} onChange={set("first_name")} required maxLength={50} autoComplete="given-name" />
          <Input label="Фамилия" value={form.last_name} onChange={set("last_name")} maxLength={50} autoComplete="family-name" />
        </div>
        <Input
          label="Имя пользователя"
          value={form.username}
          onChange={set("username")}
          required
          minLength={3}
          maxLength={50}
          pattern="[A-Za-z0-9_.\-]+"
          hint="Латиница, цифры, точка, дефис и подчёркивание"
          autoComplete="username"
        />
        <Input label="Пароль" type="password" value={form.password} onChange={set("password")} required minLength={8} maxLength={72} hint="Не меньше 8 символов" autoComplete="new-password" />
        <Input label="Повторите пароль" type="password" value={form.confirm} onChange={set("confirm")} required autoComplete="new-password" />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Зарегистрироваться
        </Button>
        <p className="text-center text-xs text-muted">Аккаунт учителя выдаёт администратор платформы.</p>
      </form>
    </AuthCard>
  );
}
