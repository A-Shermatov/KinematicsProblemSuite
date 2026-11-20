/** Базовые UI-компоненты. Цвета берутся из семантических токенов (index.css), поэтому тёмная тема работает сама. */
import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link, type LinkProps } from "react-router-dom";
import { difficultyClass } from "../../lib/format";
import { usePlatformSettings } from "../../settings/SettingsContext";
import { t } from "../../i18n";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------- Кнопки ----------

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-sm",
  secondary: "bg-surface text-fg border border-border hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors whitespace-nowrap",
    "disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
    variantClass[variant],
    sizeClass[size],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant, size, loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

// ---------- Поля формы ----------

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-fg placeholder:text-muted/70 " +
  "transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-60";

interface FieldWrapperProps {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
}

function FieldWrapper({ label, hint, error, id, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-fg">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

type FieldProps = { label?: string; hint?: ReactNode; error?: string | null };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  function Input({ label, hint, error, className, id, ...rest }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldWrapper label={label} hint={hint} error={error} id={fieldId}>
        <input ref={ref} id={fieldId} className={cx(fieldClass, "h-11", className)} {...rest} />
      </FieldWrapper>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ label, hint, error, className, id, ...rest }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldWrapper label={label} hint={hint} error={error} id={fieldId}>
        <textarea ref={ref} id={fieldId} className={cx(fieldClass, "py-2.5 leading-relaxed", className)} {...rest} />
      </FieldWrapper>
    );
  },
);

export function Select({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} error={error} id={fieldId}>
      <select id={fieldId} className={cx(fieldClass, "h-11 pr-8", className)} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  );
}

// ---------- Контейнеры ----------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-border bg-surface shadow-card", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
}) {
  return (
    <div className="mb-8 space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted" aria-label={t("Навигация")}>
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden>/</span>}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-fg">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-fg">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
          {subtitle && <p className="text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// ---------- Индикаторы ----------

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className ?? "h-5 w-5")} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label = t("Загрузка…") }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </div>
  );
}

export function EmptyState({ icon = "∅", title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <div className="text-3xl text-muted" aria-hidden>
        {icon}
      </div>
      <p className="font-medium text-fg">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}

type Tone = "neutral" | "primary" | "success" | "danger" | "warning";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: string; tone?: Tone }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={cx("mt-1 text-3xl font-bold tracking-tight", tone === "neutral" ? "text-fg" : toneClass[tone].split(" ")[1])}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (src) return <img src={src} alt={name} style={style} className="shrink-0 rounded-full object-cover ring-2 ring-surface" />;
  return (
    <span style={style} className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary" aria-hidden>
      {initials || "?"}
    </span>
  );
}

/** Уровень сложности: 100, 200, 300… Цвет — относительно верхнего предела из настроек. */
export function Difficulty({ value }: { value: number }) {
  const { settings } = usePlatformSettings();
  return (
    <span
      className={cx("inline-flex min-w-11 justify-center rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums", difficultyClass(value, settings.difficulty_max))}
      title={t("Сложность {0} из {1}", [value, settings.difficulty_max])}
      aria-label={t("Сложность {0}", [value])}
    >
      {value}
    </span>
  );
}

// ---------- Модальное окно ----------

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative max-h-[90vh] max-w-4xl overflow-auto rounded-2xl bg-surface p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label={t("Закрыть")}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

// ---------- Рейтинг ----------

export function Stars({ value, size = "md" }: { value: number | null; size?: "sm" | "md" | "lg" }) {
  const rating = value ?? 0;
  const text = { sm: "text-sm", md: "text-base", lg: "text-2xl" }[size];
  return (
    <span className={cx("inline-flex tracking-tight", text)} aria-label={value === null ? t("Нет оценок") : t("Рейтинг {0} из 5", [value.toFixed(1)])}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= Math.round(rating) ? "text-amber-400" : "text-border"} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="inline-flex text-3xl" role="radiogroup" aria-label={t("Оценка")}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={t("{0} из 5", [star])}
          onClick={() => onChange(star)}
          className={cx("px-0.5 transition-transform hover:scale-110", star <= value ? "text-amber-400" : "text-border")}
        >
          ★
        </button>
      ))}
    </div>
  );
}
