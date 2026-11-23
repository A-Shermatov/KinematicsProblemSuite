/** Те же правила, что на бэкенде (app/modules/auth/passwords.py): длина из настроек, буква, цифра, без логина. */
export interface PasswordCheck {
  key: string;
  ok: boolean;
  required: boolean;
  /** Аргументы для t(). */
  label: [string, unknown[]?];
}

export function passwordChecks(password: string, minLength: number, username = ""): PasswordCheck[] {
  const name = username.trim().toLowerCase();
  return [
    { key: "length", required: true, ok: password.length >= minLength, label: ["Не короче {0} символов", [minLength]] },
    { key: "letter", required: true, ok: /\p{L}/u.test(password), label: ["Есть буква"] },
    { key: "digit", required: true, ok: /\d/.test(password), label: ["Есть цифра"] },
    { key: "username", required: true, ok: !(name.length >= 3 && password.toLowerCase().includes(name)), label: ["Не содержит имя пользователя"] },
    { key: "case", required: false, ok: /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password), label: ["Строчные и ЗАГЛАВНЫЕ буквы"] },
    { key: "special", required: false, ok: /[^\p{L}\d]/u.test(password), label: ["Спецсимвол: ! ? # _ -"] },
  ];
}

/** 0 — не подходит, 1 — слабый (только обязательное), 2 — средний, 3 — сильный. */
export function passwordStrength(checks: PasswordCheck[], password: string): 0 | 1 | 2 | 3 {
  if (checks.some((c) => c.required && !c.ok)) return 0;
  const bonus = checks.filter((c) => !c.required && c.ok).length + (password.length >= 14 ? 1 : 0);
  return bonus >= 2 ? 3 : bonus === 1 ? 2 : 1;
}

export const passwordValid = (password: string, minLength: number, username = "") =>
  passwordChecks(password, minLength, username).every((c) => !c.required || c.ok);
