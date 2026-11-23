import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { t } from "../i18n";
import { passwordChecks, passwordStrength } from "../lib/password";
import { cx } from "./ui";

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | null; hint?: ReactNode };

/** Поле пароля с «глазком»: показать/скрыть то, что вводите. */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput({ label, error, hint, className, id, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-fg">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={cx(
            "h-11 w-full rounded-xl border border-border bg-surface pl-3.5 pr-11 text-sm text-fg placeholder:text-muted/70 transition",
            "focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-60",
            error && "border-danger focus:border-danger focus:ring-danger/20",
            className,
          )}
          autoCapitalize="off"
          spellCheck={false}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-fg"
          aria-label={visible ? t("Скрыть пароль") : t("Показать пароль")}
          aria-pressed={visible}
          title={visible ? t("Скрыть пароль") : t("Показать пароль")}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7a12.6 12.6 0 01-3.1 4.3M6.6 6.6A12.7 12.7 0 002 12c1 2.5 5 7 10 7a9.7 9.7 0 004.4-1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <p id={`${fieldId}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});

const STRENGTH = [
  { label: "Не подходит", bar: "bg-danger", width: "w-1/12" },
  { label: "Слабый", bar: "bg-danger", width: "w-1/3" },
  { label: "Средний", bar: "bg-warning", width: "w-2/3" },
  { label: "Сильный", bar: "bg-success", width: "w-full" },
];

/** Требования к паролю — обновляются после каждого введённого символа. */
export function PasswordRequirements({ password, minLength, username }: { password: string; minLength: number; username?: string }) {
  const checks = passwordChecks(password, minLength, username);
  const strength = passwordStrength(checks, password);
  const meta = STRENGTH[strength];
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-2/60 p-3" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <div className={cx("h-full rounded-full transition-all", password ? meta.bar : "", password ? meta.width : "w-0")} />
        </div>
        <span className="w-24 text-right text-xs font-medium text-fg">
          {password ? t(meta.label) : ""} <span className="tabular-nums text-muted">{password.length}</span>
        </span>
      </div>
      <ul className="grid gap-1 text-xs sm:grid-cols-2">
        {checks.map((check) => (
          <li key={check.key} className={cx("flex items-start gap-1.5", check.ok ? "text-success" : "text-muted")}>
            <span aria-hidden className="w-3 shrink-0 text-center">
              {check.ok ? "✓" : check.required ? "○" : "+"}
            </span>
            <span>
              {t(check.label[0], check.label[1])}
              {!check.required && <span className="ml-1 text-muted/70">· {t("по желанию")}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
