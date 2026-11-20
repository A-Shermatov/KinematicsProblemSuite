/**
 * Тонкая обёртка над fetch: базовый URL, токены, автоматический refresh при 401
 * и понятные сообщения об ошибках из ответов FastAPI.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const ACCESS_KEY = "kps.access";
const REFRESH_KEY = "kps.refresh";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let onSessionExpired: (() => void) | null = null;

/** AuthContext подписывается, чтобы разлогинить пользователя, если refresh не удался. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  json?: unknown;
  form?: FormData;
  query?: Query;
  auth?: boolean;
  signal?: AbortSignal;
}

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_URL}${path}${qs ? `?${qs}` : ""}`;
}

/** Превращает ответ FastAPI с ошибкой в текст для пользователя. */
export function extractErrorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined;
    const msg = (first.msg ?? "Некорректные данные").replace(/^Value error, /, "");
    return field && typeof field === "string" && !msg.includes(field) ? `${field}: ${msg}` : msg;
  }
  if (status === 0) return "Нет соединения с сервером";
  if (status >= 500) return "Ошибка сервера, попробуйте позже";
  return `Ошибка ${status}`;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  // Несколько параллельных запросов получили 401 — обновляем токен один раз.
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(buildUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { access_token: string; refresh_token: string };
      tokenStore.set(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { method = "GET", json, form, query, auth = true, signal } = options;
  const headers: Record<string, string> = {};
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const access = tokenStore.access;
  if (auth && access) headers.Authorization = `Bearer ${access}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, extractErrorMessage(0, null));
  }

  if (response.status === 401 && auth && access && !retried) {
    if (await refreshTokens()) return request<T>(path, options, true);
    tokenStore.clear();
    onSessionExpired?.();
  }

  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, extractErrorMessage(response.status, body));
  return body as T;
}
