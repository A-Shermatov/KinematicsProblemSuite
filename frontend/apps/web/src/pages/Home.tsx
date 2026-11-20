import { Link } from "react-router-dom";
import {
  ButtonLink,
  Card,
  Markdown,
  api,
  plural,
  useAsync,
  useAuth,
  useDocumentTitle,
  t,
} from "@kps/shared";

const FEATURES = [
  {
    icon: "✓",
    title: t("Умная автопроверка"),
    text: t("Ответ «72 км/ч» засчитается в задаче, где ждут «20 м/с»: система понимает числа, погрешность и единицы измерения."),
  },
  {
    icon: "∫",
    title: t("Формулы как в учебнике"),
    text: t("Условия задач поддерживают Markdown и LaTeX — учитель видит предпросмотр прямо во время набора."),
  },
  {
    icon: "↗",
    title: t("Прогресс и рейтинг"),
    text: t("Статистика по темам, история решений и рейтинг учеников за неделю, месяц и всё время."),
  },
];

const SAMPLE = t("Автомобиль разгоняется из состояния покоя с ускорением $a = 2\\ \\text{м/с}^2$.\n\n$$s = \\frac{a t^2}{2}$$\n\nКакой путь он пройдёт за $t = 5$ с?");

export function Home() {
  useDocumentTitle(t("Главная"));
  const { user } = useAuth();
  const { data: subjects } = useAsync(() => api.subjects.list(), []);

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="h-2 w-2 rounded-full bg-success" />  {t("Подготовка к олимпиадам и экзаменам")}
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            {t("Решайте задачи по физике и математике —")}{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">{t("с мгновенной проверкой")}</span>
          </h1>
          <p className="max-w-xl text-lg text-muted">
            {t("Кинематика, динамика, алгебра и олимпиадные задачи. Тренируйтесь в своём темпе, а учителя создают задачи и проверяют решения в одном месте.")}
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/catalog" size="lg">
              {t("Начать решать")}
            </ButtonLink>
            {!user && (
              <ButtonLink to="/register" size="lg" variant="secondary">
                {t("Создать аккаунт")}
              </ButtonLink>
            )}
          </div>
        </div>

        <Card className="relative overflow-hidden p-6">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">{t("Пример задачи")}</p>
          <Markdown source={SAMPLE} />
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm">
            <span className="font-mono text-fg">{t("25 м")}</span>
            <span className="ml-auto font-medium text-success">{t("✓ Верно!")}</span>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-xl font-bold text-primary">
              {feature.icon}
            </div>
            <h3 className="mb-2 font-semibold text-fg">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-muted">{feature.text}</p>
          </Card>
        ))}
      </section>

      {subjects && subjects.length > 0 && (
        <section className="space-y-5">
          <h2 className="text-2xl font-bold tracking-tight text-fg">{t("Предметы")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <Link key={subject.id} to={`/catalog#subject-${subject.id}`} className="group">
                <Card className="h-full p-5 transition group-hover:border-primary/50 group-hover:shadow-lg">
                  <p className="font-semibold text-fg group-hover:text-primary">{subject.title}</p>
                  <p className="mt-1 text-sm text-muted">{subject.description}</p>
                  <p className="mt-3 text-xs font-medium text-muted">
                    {subject.themes_count} {plural(subject.themes_count, ["тема", "темы", "тем"])}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
