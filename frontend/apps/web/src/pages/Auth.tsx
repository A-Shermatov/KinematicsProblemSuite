import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  ErrorMessage,
  Input,
  PasswordInput,
  PasswordRequirements,
  PlaceFields,
  api,
  passwordValid,
  placeOf,
  placePayload,
  usePlatformSettings,
  type Place,
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
        <PasswordInput label={t("Пароль")} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {t("Войти")}
        </Button>
      </form>
    </AuthCard>
  );
}

const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

/** Ошибки полей регистрации — показываются сразу, как только поле начали заполнять. */
function registerErrors(form: { first_name: string; username: string; password: string; confirm: string }, minLength: number) {
  const username = form.username.trim();
  return {
    first_name: form.first_name.trim() ? null : t("Укажите имя"),
    username: !username
      ? t("Придумайте имя пользователя")
      : !USERNAME_RE.test(username)
        ? t("Только латиница, цифры, точка, дефис и подчёркивание")
        : username.length < 3
          ? t("Не короче 3 символов")
          : null,
    password: passwordValid(form.password, minLength, username) ? null : t("Пароль не подходит под требования ниже"),
    confirm: !form.confirm ? t("Повторите пароль") : form.confirm !== form.password ? t("Пароли не совпадают") : null,
  };
}

export function Register() {
  useDocumentTitle(t("Регистрация"));
  const navigate = useNavigate();
  const { settings } = usePlatformSettings();
  const [form, setForm] = useState({ first_name: "", last_name: "", username: "", password: "", confirm: "" });
  const [place, setPlace] = useState<Place>(placeOf(null));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errors = registerErrors(form, settings.password_min_length);
  const shown = (key: keyof typeof errors) => (touched[key] ? errors[key] : null);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => {
    setForm({ ...form, [key]: event.target.value });
    setTouched((prev) => ({ ...prev, [key]: true }));
  };
  const blur = (key: string) => () => setTouched((prev) => ({ ...prev, [key]: true }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (Object.values(errors).some(Boolean)) {
      setTouched({ first_name: true, username: true, password: true, confirm: true });
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
        ...placePayload(place),
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
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t("Имя")} value={form.first_name} onChange={set("first_name")} onBlur={blur("first_name")} error={shown("first_name")} required maxLength={50} autoComplete="given-name" />
          <Input label={t("Фамилия")} value={form.last_name} onChange={set("last_name")} maxLength={50} autoComplete="family-name" />
        </div>
        <Input
          label={t("Имя пользователя")}
          value={form.username}
          onChange={set("username")}
          onBlur={blur("username")}
          error={shown("username")}
          required
          maxLength={50}
          hint={t("Латиница, цифры, точка, дефис и подчёркивание")}
          autoComplete="username"
          autoCapitalize="off"
        />
        <PasswordInput label={t("Пароль")} value={form.password} onChange={set("password")} onBlur={blur("password")} error={shown("password")} required maxLength={72} autoComplete="new-password" />
        <PasswordRequirements password={form.password} minLength={settings.password_min_length} username={form.username} />
        <PasswordInput label={t("Повторите пароль")} value={form.confirm} onChange={set("confirm")} onBlur={blur("confirm")} error={shown("confirm")} required autoComplete="new-password" />
        <PlaceFields value={place} onChange={setPlace} showCountry={settings.show_country_field} />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {t("Зарегистрироваться")}
        </Button>
        <p className="text-center text-xs text-muted">{t("Аккаунт учителя выдаёт администратор платформы.")}</p>
      </form>
    </AuthCard>
  );
}
