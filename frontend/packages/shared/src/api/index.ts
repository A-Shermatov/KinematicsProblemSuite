import { request } from "./client";
import type {
  Achievements,
  Activity,
  DifficultyBreakdown,
  PlatformSettings,
  Olympiad,
  OlympiadDetail,
  OlympiadInput,
  OlympiadLeaderRow,
  OlympiadPhase,
  OlympiadResults,
  Source,
  SourceInput,
  VirtualRun,
  VirtualStandingRow,
  OlympiadStatus,
  OlympiadSubmission,
  OlympiadTask,
  OlympiadTaskInput,
  AdminStats,
  CityRow,
  Period,
  SchoolRow,
  Attempt,
  Certificate,
  CertificateStatus,
  Review,
  TeacherCard,
  TeacherProfile,
  TeacherProfileInput,
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

type ThemeInput = TitledInput & { subject_id: number };

type LeaderboardQuery = {
  period?: Period;
  subject_id?: number;
  city?: string;
};

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<TokenPair>("/api/auth/login", { method: "POST", json: { username, password }, auth: false }),
    register: (data: {
      username: string;
      password: string;
      first_name: string;
      last_name: string;
      city: string | null;
      school: string | null;
    }) =>
      request<User>("/api/auth/register", { method: "POST", json: data, auth: false }),
    logout: (refreshToken: string) =>
      request<void>("/api/auth/logout", { method: "POST", json: { refresh_token: refreshToken }, auth: false }),
  },

  users: {
    me: () => request<User>("/api/users/me"),
    updateMe: (data: { username: string; first_name: string; last_name: string; city: string | null; school: string | null }) =>
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
  },

  subjects: {
    list: () => request<Subject[]>("/api/subjects"),
  },

  themes: {
    list: (subjectId?: number) => request<Theme[]>("/api/themes", { query: { subject_id: subjectId } }),
    get: (id: number) => request<Theme>(`/api/themes/${id}`),
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
        source_id?: number;
      } = {},
    ) =>
      request<Task[]>("/api/tasks", { query: { ...query, limit: 200 } }),
    get: (id: number) => request<Task>(`/api/tasks/${id}`),
    getFull: (id: number) => request<TaskFull>(`/api/tasks/${id}/full`),
    create: (data: TaskInput) => request<TaskFull>("/api/tasks", { method: "POST", json: data }),
    update: (id: number, data: TaskInput) => request<TaskFull>(`/api/tasks/${id}`, { method: "PUT", json: data }),
    remove: (id: number) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  },

  sources: {
    list: (query: { search?: string; type?: SourceType; limit?: number } = {}) => request<Source[]>("/api/sources", { query }),
    get: (id: number) => request<Source>(`/api/sources/${id}`),
    create: (data: SourceInput) => request<Source>("/api/sources", { method: "POST", json: data }),
    update: (id: number, data: SourceInput) => request<Source>(`/api/sources/${id}`, { method: "PUT", json: data }),
    remove: (id: number) => request<void>(`/api/sources/${id}`, { method: "DELETE" }),
    merge: (id: number, intoId: number) => request<Source>(`/api/sources/${id}/merge`, { method: "POST", json: { into_id: intoId } }),
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
    leaderboard: (query: LeaderboardQuery & { metric?: "points" | "solved"; school?: string }) =>
      request<LeaderboardRow[]>("/api/stats/leaderboard", { query, auth: false }),
    schools: (query: LeaderboardQuery) => request<SchoolRow[]>("/api/stats/leaderboard/schools", { query, auth: false }),
    cities: (query: Omit<LeaderboardQuery, "city">) =>
      request<CityRow[]>("/api/stats/leaderboard/cities", { query, auth: false }),
    olympiadLeaderboard: (query: LeaderboardQuery) =>
      request<OlympiadLeaderRow[]>("/api/stats/leaderboard/olympiads", { query, auth: false }),
    activity: (userId: number, days = 365) =>
      request<Activity>(`/api/stats/activity/${userId}`, { query: { days }, auth: false }),
    difficulty: (userId: number) => request<DifficultyBreakdown>(`/api/stats/difficulty/${userId}`, { auth: false }),
    achievements: (userId: number) => request<Achievements>(`/api/stats/achievements/${userId}`, { auth: false }),
    places: (city?: string) =>
      request<{ cities: string[]; schools: string[] }>("/api/stats/places", { query: { city }, auth: false }),
  },

  teachers: {
    list: (query: { subject_id?: number; search?: string; sort?: "rating" | "tasks" | "new" } = {}) =>
      request<TeacherCard[]>("/api/teachers", { query }),
    get: (id: number) => request<TeacherProfile>(`/api/teachers/${id}`),
    me: () => request<TeacherProfile>("/api/teachers/me"),
    updateMe: (data: TeacherProfileInput) => request<TeacherProfile>("/api/teachers/me", { method: "PUT", json: data }),
    addCertificate: (data: { title: string; issuer: string; year: number | null; file: File }) => {
      const form = new FormData();
      form.append("title", data.title);
      form.append("issuer", data.issuer);
      if (data.year) form.append("year", String(data.year));
      form.append("file", data.file);
      return request<Certificate>("/api/teachers/me/certificates", { method: "POST", form });
    },
    deleteCertificate: (id: number) => request<void>(`/api/teachers/me/certificates/${id}`, { method: "DELETE" }),
    reply: (reviewId: number, text: string) =>
      request<Review>(`/api/teachers/me/reviews/${reviewId}/reply`, { method: "POST", json: { text } }),
    reviews: (teacherId: number) => request<Review[]>(`/api/teachers/${teacherId}/reviews`),
    writeReview: (teacherId: number, rating: number, text: string) =>
      request<Review>(`/api/teachers/${teacherId}/reviews/me`, { method: "PUT", json: { rating, text } }),
    deleteReview: (teacherId: number) => request<void>(`/api/teachers/${teacherId}/reviews/me`, { method: "DELETE" }),
  },

  olympiads: {
    list: (phase?: OlympiadPhase) => request<Olympiad[]>("/api/olympiads", { query: { phase } }),
    mine: () => request<Olympiad[]>("/api/olympiads/mine"),
    get: (id: number) => request<OlympiadDetail>(`/api/olympiads/${id}`),
    create: (data: OlympiadInput) => request<OlympiadDetail>("/api/olympiads", { method: "POST", json: data }),
    update: (id: number, data: OlympiadInput) => request<OlympiadDetail>(`/api/olympiads/${id}`, { method: "PUT", json: data }),
    remove: (id: number) => request<void>(`/api/olympiads/${id}`, { method: "DELETE" }),
    addTask: (id: number, data: OlympiadTaskInput) =>
      request<OlympiadTask>(`/api/olympiads/${id}/tasks`, { method: "POST", json: data }),
    updateTask: (id: number, taskId: number, data: OlympiadTaskInput) =>
      request<OlympiadTask>(`/api/olympiads/${id}/tasks/${taskId}`, { method: "PUT", json: data }),
    removeTask: (id: number, taskId: number) => request<void>(`/api/olympiads/${id}/tasks/${taskId}`, { method: "DELETE" }),
    submitForReview: (id: number) => request<OlympiadDetail>(`/api/olympiads/${id}/submit-for-review`, { method: "POST" }),
    register: (id: number) => request<OlympiadDetail>(`/api/olympiads/${id}/register`, { method: "POST" }),
    unregister: (id: number) => request<void>(`/api/olympiads/${id}/register`, { method: "DELETE" }),
    submit: (id: number, taskId: number, answer: string, image: File) => {
      const form = new FormData();
      form.append("answer", answer);
      form.append("image", image);
      return request<OlympiadSubmission>(`/api/olympiads/${id}/tasks/${taskId}/submit`, { method: "POST", form });
    },
    mySubmissions: (id: number) => request<OlympiadSubmission[]>(`/api/olympiads/${id}/my-submissions`),
    results: (id: number) => request<OlympiadResults>(`/api/olympiads/${id}/results`),
    virtual: (id: number) => request<VirtualRun | null>(`/api/olympiads/${id}/virtual`),
    startVirtual: (id: number) => request<VirtualRun>(`/api/olympiads/${id}/virtual`, { method: "POST" }),
    submitVirtual: (id: number, taskId: number, answer: string) =>
      request<VirtualRun>(`/api/olympiads/${id}/virtual/tasks/${taskId}`, { method: "POST", json: { answer } }),
    finishVirtual: (id: number) => request<VirtualRun>(`/api/olympiads/${id}/virtual/finish`, { method: "POST" }),
    virtualStandings: (id: number) =>
      request<VirtualStandingRow[]>(`/api/olympiads/${id}/virtual/standings`, { auth: false }),
    jury: (id: number, query: { task_id?: number; ungraded?: boolean } = {}) =>
      request<OlympiadSubmission[]>(`/api/olympiads/${id}/submissions`, { query }),
    grade: (id: number, submissionId: number, points: number, comment: string) =>
      request<OlympiadSubmission>(`/api/olympiads/${id}/submissions/${submissionId}/grade`, {
        method: "POST",
        json: { points, comment },
      }),
    publishResults: (id: number, force = false) =>
      request<OlympiadDetail>(`/api/olympiads/${id}/publish-results`, { method: "POST", query: { force: force || undefined } }),
  },

  settings: {
    get: () => request<PlatformSettings>("/api/settings", { auth: false }),
  },

  /** Только для админ-панели: всё под /api/admin. */
  admin: {
    settings: () => request<{ difficulty_max: number }>("/api/admin/settings"),
    updateSettings: (data: { difficulty_max: number }) =>
      request<{ difficulty_max: number }>("/api/admin/settings", { method: "PUT", json: data }),
    stats: () => request<AdminStats>("/api/admin/stats"),
    users: (query: { role?: Role; search?: string } = {}) =>
      request<User[]>("/api/admin/users", { query: { ...query, limit: 200 } }),
    setActive: (id: number, is_active: boolean) =>
      request<User>(`/api/admin/users/${id}/active`, { method: "PATCH", json: { is_active } }),
    setRole: (id: number, role: Role) =>
      request<User>(`/api/admin/users/${id}/role`, { method: "PATCH", json: { role } }),
    createSubject: (data: TitledInput) => request<Subject>("/api/admin/subjects", { method: "POST", json: data }),
    updateSubject: (id: number, data: TitledInput) =>
      request<Subject>(`/api/admin/subjects/${id}`, { method: "PUT", json: data }),
    removeSubject: (id: number) => request<void>(`/api/admin/subjects/${id}`, { method: "DELETE" }),
    createTheme: (data: ThemeInput) => request<Theme>("/api/admin/themes", { method: "POST", json: data }),
    updateTheme: (id: number, data: ThemeInput) => request<Theme>(`/api/admin/themes/${id}`, { method: "PUT", json: data }),
    removeTheme: (id: number) => request<void>(`/api/admin/themes/${id}`, { method: "DELETE" }),
    attempts: (query: { status?: AttemptStatus; task_id?: number; student_id?: number } = {}) =>
      request<Attempt[]>("/api/admin/attempts", { query: { ...query, limit: 200 } }),
    certificates: (status?: CertificateStatus) =>
      request<Certificate[]>("/api/admin/certificates", { query: { status } }),
    reviewCertificate: (id: number, status: "verified" | "rejected", reason = "") =>
      request<Certificate>(`/api/admin/certificates/${id}/review`, { method: "POST", json: { status, reason } }),
    reviews: (hidden?: boolean) => request<Review[]>("/api/admin/reviews", { query: { hidden } }),
    olympiads: (status?: OlympiadStatus) => request<Olympiad[]>("/api/admin/olympiads", { query: { status } }),
    reviewOlympiad: (id: number, status: "published" | "rejected", reason = "") =>
      request<Olympiad>(`/api/admin/olympiads/${id}/review`, { method: "POST", json: { status, reason } }),
    setReviewHidden: (id: number, is_hidden: boolean) =>
      request<Review>(`/api/admin/reviews/${id}`, { method: "PATCH", json: { is_hidden } }),
  },
};
