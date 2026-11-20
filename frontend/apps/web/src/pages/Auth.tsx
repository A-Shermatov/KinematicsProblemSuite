import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  ErrorMessage,
  Input,
  PlaceFields,
  api,
  errorText,
  useAuth,
  useDocumentTitle,
  t,
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
  useDocumentTitle(t("Вход"));
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
      title={t("С возвращением")}
      subtitle={t("Войдите, чтобы продолжить решать задачи")}
      footer={
        <>
          {t("Нет аккаунта?")}{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t("Зарегистрируйтесь")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {from.registered && !error && (
          <div className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{t("Аккаунт создан — теперь войдите.")}</div>
        )}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Input label={t("Имя пользователя")} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        <Input label={t("Пароль")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {t("Войти")}
        </Button>
      </form>
    </AuthCard>
  );
}

export function Register() {
  useDocumentTitle(t("Регистрация"));
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", username: "", password: "", confirm: "", city: "", school: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError(t("Пароли не совпадают"));
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
        city: form.city.trim() || null,
        school: form.school.trim() || null,
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
      title={t("Создать аккаунт")}
      subtitle={t("Регистрация занимает меньше минуты")}
      footer={
        <>
          {t("Уже есть аккаунт?")}{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("Войти")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t("Имя")} value={form.first_name} onChange={set("first_name")} required maxLength={50} autoComplete="given-name" />
          <Input label={t("Фамилия")} value={form.last_name} onChange={set("last_name")} maxLength={50} autoComplete="family-name" />
        </div>
        <Input
          label={t("Имя пользователя")}
          value={form.username}
          onChange={set("username")}
          required
          minLength={3}
          maxLength={50}
          pattern="[A-Za-z0-9_.\-]+"
          hint={t("Латиница, цифры, точка, дефис и подчёркивание")}
          autoComplete="username"
        />
        <Input label={t("Пароль")} type="password" value={form.password} onChange={set("password")} required minLength={8} maxLength={72} hint={t("Не меньше 8 символов")} autoComplete="new-password" />
        <Input label={t("Повторите пароль")} type="password" value={form.confirm} onChange={set("confirm")} required autoComplete="new-password" />
        <PlaceFields city={form.city} school={form.school} onChange={(place) => setForm({ ...form, ...place })} />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {t("Зарегистрироваться")}
        </Button>
        <p className="text-center text-xs text-muted">{t("Аккаунт учителя выдаёт администратор платформы.")}</p>
      </form>
    </AuthCard>
  );
}
