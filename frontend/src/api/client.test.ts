import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, buildUrl, extractErrorMessage, request, setSessionExpiredHandler, tokenStore } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setSessionExpiredHandler(null);
});

describe("buildUrl", () => {
  it("skips empty query values", () => {
    expect(buildUrl("/api/tasks", { theme_id: 3, search: "", author_id: undefined, difficulty: null })).toBe("/api/tasks?theme_id=3");
  });
});

describe("extractErrorMessage", () => {
  it("uses string detail", () => {
    expect(extractErrorMessage(409, { detail: "Имя пользователя уже занято" })).toBe("Имя пользователя уже занято");
  });

  it("uses first validation error", () => {
    const body = { detail: [{ loc: ["body", "answer"], msg: "Value error, Ответ не может быть пустым" }] };
    expect(extractErrorMessage(422, body)).toBe("answer: Ответ не может быть пустым");
  });

  it("falls back to generic messages", () => {
    expect(extractErrorMessage(500, null)).toBe("Ошибка сервера, попробуйте позже");
    expect(extractErrorMessage(0, null)).toBe("Нет соединения с сервером");
  });
});

describe("request", () => {
  it("sends bearer token and parses json", async () => {
    tokenStore.set("access-1", "refresh-1");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/api/users/me")).resolves.toEqual({ ok: true });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer access-1");
  });

  it("refreshes the token once on 401 and retries", async () => {
    tokenStore.set("old-access", "old-refresh");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Срок действия токена истёк" }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "new-access", refresh_token: "new-refresh" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/api/users/me")).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(tokenStore.access).toBe("new-access");
    expect(tokenStore.refresh).toBe("new-refresh");
  });

  it("clears the session when refresh fails", async () => {
    tokenStore.set("old-access", "old-refresh");
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(401, { detail: "Срок действия токена истёк" }))
        .mockResolvedValueOnce(jsonResponse(401, { detail: "Сессия завершена" })),
    );

    await expect(request("/api/users/me")).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledOnce();
    expect(tokenStore.access).toBeNull();
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(request("/api/tasks/1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
