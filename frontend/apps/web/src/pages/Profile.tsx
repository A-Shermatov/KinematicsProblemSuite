import { useRef, useState, type FormEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  ErrorMessage,
  Input,
  Loading,
  PageHeader,
  PlaceFields,
  api,
  cx,
  displayName,
  errorText,
  formatDate,
  roleLabel,
  useAsync,
  useAuth,
  useDocumentTitle,
  useTheme,
  type ThemeMode,
  t,
  TitleBadge,
  plural,
} from "@kps/shared";
import { Achievements } from "../components/Achievements";
import { TelegramCard } from "../components/TelegramCard";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { DifficultyChart } from "../components/DifficultyChart";

function Notice({ text }: { text: string | null }) {
  return text ? <div className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{text}</div> : null;
}

export function Profile() {
  useDocumentTitle(t("Настройки профиля"));
  const { user, setUser } = useAuth();
  const { mode, setMode } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    username: user?.username ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    city: user?.city ?? "",
    school: user?.school ?? "",
  });
  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [status, setStatus] = useState<{ profile?: string; password?: string; avatar?: string }>({});
  const [errors, setErrors] = useState<{ profile?: string; password?: string; avatar?: string }>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (!user) return null;

  const run = async (key: "profile" | "password" | "avatar", action: () => Promise<string>) => {
    setBusy(key);
    setErrors((e) => ({ ...e, [key]: undefined }));
    setStatus((s) => ({ ...s, [key]: undefined }));
    try {
      const message = await action();
      setStatus((s) => ({ ...s, [key]: message }));
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: errorText(err) }));
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    void run("profile", async () => {
      setUser(
        await api.users.updateMe({
          ...form,
          username: form.username.trim(),
          city: form.city.trim() || null,
          school: form.school.trim() || null,
        }),
      );
      return t("Профиль сохранён");
    });
  };

  const changePassword = (event: FormEvent) => {
    event.preventDefault();
    void run("password", async () => {
      await api.users.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "" });
      return t("Пароль изменён. На других устройствах нужно будет войти заново.");
    });
  };

  const uploadAvatar = (file: File | undefined) => {
    if (!file) return;
    void run("avatar", async () => {
      setUser(await api.users.uploadAvatar(file));
      return t("Аватар обновлён");
    });
  };

  const themes: { mode: ThemeMode; label: string }[] = [
    { mode: "light", label: t("☀ Светлая") },
    { mode: "dark", label: t("☾ Тёмная") },
    { mode: "system", label: t("◐ Как в системе") },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("Настройки профиля")} />
      <div className="space-y-6">
        <Card className="flex flex-wrap items-center gap-5 p-6">
          <Avatar src={user.avatar_url} name={displayName(user)} size={72} />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-fg">{displayName(user)}</p>
            <p className="text-sm text-muted">
              {roleLabel[user.role]}  {t("· с")} {formatDate(user.created_at)}
            </p>
            <Notice text={status.avatar ?? null} />
            {errors.avatar && <ErrorMessage>{errors.avatar}</ErrorMessage>}
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            <Button variant="secondary" size="sm" loading={busy === "avatar"} onClick={() => fileRef.current?.click()}>
              {t("Загрузить фото")}
            </Button>
            {user.avatar_url && (
              <Button variant="ghost" size="sm" onClick={() => void run("avatar", async () => (setUser(await api.users.deleteAvatar()), t("Фото удалено")))}>
                {t("Удалить")}
              </Button>
            )}
          </div>
        </Card>

        {user.role === "teacher" && (
          <Card className="flex flex-wrap items-center gap-4 border-primary/30 bg-primary-soft p-5">
            <p className="flex-1 text-sm text-fg">{t("Описание, предметы, сертификаты и отзывы — в профиле учителя.")}</p>
            <ButtonLink to="/profile/teacher" size="sm">
              {t("Профиль учителя")}
            </ButtonLink>
          </Card>
        )}

        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-fg">{t("Оформление")}</h2>
          <div className="flex flex-wrap gap-2">
            {themes.map((item) => (
              <button
                key={item.mode}
                onClick={() => setMode(item.mode)}
                className={cx(
                  "rounded-xl border px-4 py-2 text-sm font-medium transition",
                  mode === item.mode ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-fg",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-fg">{t("Личные данные")}</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <Notice text={status.profile ?? null} />
            {errors.profile && <ErrorMessage>{errors.profile}</ErrorMessage>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t("Имя")} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
              <Input label={t("Фамилия")} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <Input label={t("Имя пользователя")} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            <PlaceFields city={form.city} school={form.school} onChange={(place) => setForm({ ...form, ...place })} />
            <Button type="submit" loading={busy === "profile"}>
              {t("Сохранить")}
            </Button>
          </form>
        </Card>

        <TelegramCard />

        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-fg">{t("Смена пароля")}</h2>
          <form onSubmit={changePassword} className="space-y-4">
            <Notice text={status.password ?? null} />
            {errors.password && <ErrorMessage>{errors.password}</ErrorMessage>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t("Текущий пароль")} type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} required />
              <Input label={t("Новый пароль")} type="password" autoComplete="new-password" minLength={8} maxLength={72} value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} required />
            </div>
            <Button type="submit" variant="secondary" loading={busy === "password"}>
              {t("Изменить пароль")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function UserPage() {
  const userId = Number(useParams().userId);
  const { data, error, loading } = useAsync(async () => {
    const user = await api.users.get(userId);
    if (user.role !== "student") return { user, achievements: null, activity: null, difficulty: null };
    const [achievements, activity, difficulty] = await Promise.all([
      api.stats.achievements(userId),
      api.stats.activity(userId),
      api.stats.difficulty(userId),
    ]);
    return { user, achievements, activity, difficulty };
  }, [userId]);
  const user = data?.user;
  useDocumentTitle(user ? displayName(user) : undefined);

  if (loading) return <Loading />;
  if (error || !user) return <ErrorMessage>{error ?? t("Пользователь не найден")}</ErrorMessage>;
  if (user.role === "teacher") return <Navigate to={`/teachers/${user.id}`} replace />;
  return (
    <div className="space-y-8">
      <Card className="flex flex-wrap items-center gap-6 p-6 sm:p-8">
        <Avatar src={user.avatar_url} name={displayName(user)} size={96} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-fg">{displayName(user)}</h1>
            <TitleBadge title={data?.achievements?.title} className="text-sm" />
          </div>
          <p className="text-muted">
            @{user.username} · {roleLabel[user.role]}
          </p>
          {(user.school || user.city) && <p className="text-sm text-fg">🏫 {[user.school, user.city].filter(Boolean).join(", ")}</p>}
          <p className="text-sm text-muted">{t("На платформе с")} {formatDate(user.created_at)}</p>
          {!user.is_active && <p className="text-sm font-medium text-danger">{t("Аккаунт заблокирован")}</p>}
        </div>
        {data?.achievements && (
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{data.achievements.points}</p>
              <p className="text-xs text-muted">{t("очков")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-fg">{data.achievements.solved_tasks}</p>
              <p className="text-xs text-muted">{t("решено")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-fg">{data.achievements.olympiad_prizes}</p>
              <p className="text-xs text-muted">{plural(data.achievements.olympiad_prizes, ["призовое место", "призовых места", "призовых мест"])}</p>
            </div>
          </div>
        )}
      </Card>
      {data?.activity && <ActivityHeatmap activity={data.activity} />}
      {data?.difficulty && <DifficultyChart data={data.difficulty} />}
      {data?.achievements && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-fg">{t("Звания за олимпиады")}</h2>
          <Achievements data={data.achievements} />
        </section>
      )}
    </div>
  );
}
