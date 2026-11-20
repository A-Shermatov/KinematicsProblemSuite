import { request } from "./client";
import type {
  Attempt,
  AttemptScope,
  AttemptStatus,
  LeaderboardRow,
  Role,
  SourceType,
  Stats,
  Subject,
  Task,
  TaskFull,
  TaskInput,
  Theme,
  TokenPair,
  User,
} from "./types";

export { ApiError, tokenStore } from "./client";
export * from "./types";

interface TitledInput {
  title: string;
  description: string;
  position: number;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<TokenPair>("/api/auth/login", { method: "POST", json: { username, password }, auth: false }),
    register: (data: { username: string; password: string; first_name: string; last_name: string }) =>
      request<User>("/api/auth/register", { method: "POST", json: data, auth: false }),
    logout: (refreshToken: string) =>
      request<void>("/api/auth/logout", { method: "POST", json: { refresh_token: refreshToken }, auth: false }),
  },

  users: {
    me: () => request<User>("/api/users/me"),
    updateMe: (data: { username: string; first_name: string; last_name: string }) =>
      request<User>("/api/users/me", { method: "PATCH", json: data }),
    changePassword: (current_password: string, new_password: string) =>
      request<void>("/api/users/me/password", { method: "POST", json: { current_password, new_password } }),
    uploadAvatar: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<User>("/api/users/me/avatar", { method: "PUT", form });
    },
    deleteAvatar: () => request<User>("/api/users/me/avatar", { method: "DELETE" }),
    get: (id: number) => request<User>(`/api/users/${id}`),
    list: (query: { role?: Role; search?: string } = {}) => request<User[]>("/api/users", { query: { ...query, limit: 200 } }),
    setActive: (id: number, is_active: boolean) =>
      request<User>(`/api/users/${id}/active`, { method: "PATCH", json: { is_active } }),
    setRole: (id: number, role: Role) => request<User>(`/api/users/${id}/role`, { method: "PATCH", json: { role } }),
  },

  subjects: {
    list: () => request<Subject[]>("/api/subjects"),
    create: (data: TitledInput) => request<Subject>("/api/subjects", { method: "POST", json: data }),
    update: (id: number, data: TitledInput) => request<Subject>(`/api/subjects/${id}`, { method: "PUT", json: data }),
    remove: (id: number) => request<void>(`/api/subjects/${id}`, { method: "DELETE" }),
  },

  themes: {
    list: (subjectId?: number) => request<Theme[]>("/api/themes", { query: { subject_id: subjectId } }),
    get: (id: number) => request<Theme>(`/api/themes/${id}`),
    create: (data: TitledInput & { subject_id: number }) => request<Theme>("/api/themes", { method: "POST", json: data }),
    update: (id: number, data: TitledInput & { subject_id: number }) =>
      request<Theme>(`/api/themes/${id}`, { method: "PUT", json: data }),
    remove: (id: number) => request<void>(`/api/themes/${id}`, { method: "DELETE" }),
  },

  tasks: {
    list: (
      query: {
        theme_id?: number;
        subject_id?: number;
        author_id?: number;
        difficulty?: number;
        search?: string;
        source_type?: SourceType;
      } = {},
    ) =>
      request<Task[]>("/api/tasks", { query: { ...query, limit: 200 } }),
    get: (id: number) => request<Task>(`/api/tasks/${id}`),
    getFull: (id: number) => request<TaskFull>(`/api/tasks/${id}/full`),
    create: (data: TaskInput) => request<TaskFull>("/api/tasks", { method: "POST", json: data }),
    update: (id: number, data: TaskInput) => request<TaskFull>(`/api/tasks/${id}`, { method: "PUT", json: data }),
    remove: (id: number) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  },

  attempts: {
    submit: (taskId: number, answer: string, image?: File | null) => {
      const form = new FormData();
      form.append("task_id", String(taskId));
      form.append("answer", answer);
      if (image) form.append("image", image);
      return request<Attempt>("/api/attempts", { method: "POST", form });
    },
    list: (query: { scope?: AttemptScope; status?: AttemptStatus; task_id?: number } = {}) =>
      request<Attempt[]>("/api/attempts", { query: { ...query, limit: 200 } }),
    grade: (id: number, grade: number, feedback: string) =>
      request<Attempt>(`/api/attempts/${id}/grade`, { method: "POST", json: { grade, feedback } }),
  },

  stats: {
    me: () => request<Stats>("/api/stats/me"),
    leaderboard: (period: "week" | "month" | "all" = "all") =>
      request<LeaderboardRow[]>("/api/stats/leaderboard", { query: { period }, auth: false }),
  },
};
