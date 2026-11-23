import type { Lang } from "../i18n";
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
  DuplicateCheck,
  OlympiadStandings,
  OlympiadLevel,
  Region,
  PlaceInput,
  AdminSettings,
  JuryMember,
  JuryCandidate,
  JuryInvitation,
  OlympiadEditorial,
  ArchiveProblem,
  ArchiveQuery,
  OlympiadLevelInput,
  OlympiadHistoryItem,
  OlympiadAnnouncement,
  OlympiadAttempt,
  TelegramStatus,
  Collection,
  CollectionDetail,
  CollectionInput,
  TaskProgress,
  TaskHelp,
  ImportCapabilities,
  ImportInput,
  ImportParseResult,
  ImportResult,
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
  geo: {
    regions: (country: string) => request<Region[]>("/api/geo/regions", { query: { country }, auth: false }),
  },

  auth: {
    login: (username: string, password: string) =>
      request<TokenPair>("/api/auth/login", { method: "POST", json: { username, password }, auth: false }),
    register: (data: { username: string; password: string; first_name: string; last_name: string } & PlaceInput) =>
      request<User>("/api/auth/register", { method: "POST", json: data, auth: false }),
    logout: (refreshToken: string) =>
      request<void>("/api/auth/logout", { method: "POST", json: { refresh_token: refreshToken }, auth: false }),
  },

  users: {
    me: () => request<User>("/api/users/me"),
    updateMe: (data: { username: string; first_name: string; last_name: string } & PlaceInput) =>
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
        progress?: TaskProgress;
        limit?: number;
      } = {},
    ) =>
      request<Task[]>("/api/tasks", { query: { ...query, limit: 200 } }),
    get: (id: number) => request<Task>(`/api/tasks/${id}`),
    getFull: (id: number) => request<TaskFull>(`/api/tasks/${id}/full`),
    create: (data: TaskInput) => request<TaskFull>("/api/tasks", { method: "POST", json: data }),
    update: (id: number, data: TaskInput) => request<TaskFull>(`/api/tasks/${id}`, { method: "PUT", json: data }),
    remove: (id: number) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
    help: (id: number) => request<TaskHelp>(`/api/tasks/${id}/help`),
    openHint: (id: number) => request<TaskHelp>(`/api/tasks/${id}/hints`, { method: "POST" }),
    checkDuplicates: (title: string, condition: string, excludeId?: number | null) =>
      request<DuplicateCheck>("/api/tasks/check-duplicates", { method: "POST", json: { title, condition, exclude_id: excludeId ?? null } }),
  },

  imports: {
    capabilities: () => request<ImportCapabilities>("/api/tasks/import/capabilities"),
    translate: (data: { source: Lang; target: Lang; title: string; condition: string; hints?: string[]; explanation?: string }) =>
      request<{ title: string; condition: string; hints: string[]; explanation: string; model: string }>("/api/tasks/import/translate", {
        method: "POST",
        json: data,
      }),
    parse: (file: File, model?: string) => {
      const form = new FormData();
      form.append("file", file);
      if (model) form.append("model", model);
      return request<ImportParseResult>("/api/tasks/import/parse", { method: "POST", form });
    },
    commit: (data: ImportInput) => request<ImportResult>("/api/tasks/import/commit", { method: "POST", json: data }),
    uploadImage: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await request<{ url: string }>("/api/tasks/import/image", { method: "POST", form })).url;
    },
  },

  telegram: {
    status: () => request<TelegramStatus>("/api/telegram"),
    link: () => request<{ code: string; url: string }>("/api/telegram/link", { method: "POST" }),
    update: (data: { daily_task: boolean; notify: boolean }) => request<TelegramStatus>("/api/telegram", { method: "PUT", json: data }),
    unlink: () => request<void>("/api/telegram", { method: "DELETE" }),
  },

  collections: {
    list: (query: { author_id?: number; search?: string; mine?: boolean } = {}) => request<Collection[]>("/api/collections", { query }),
    get: (id: number) => request<CollectionDetail>(`/api/collections/${id}`),
    create: (data: CollectionInput) => request<Collection>("/api/collections", { method: "POST", json: data }),
    update: (id: number, data: CollectionInput) => request<Collection>(`/api/collections/${id}`, { method: "PUT", json: data }),
    remove: (id: number) => request<void>(`/api/collections/${id}`, { method: "DELETE" }),
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
    olympiadLeaderboard: (query: { city?: string; limit?: number }) =>
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
    list: (phase?: OlympiadPhase, levelId?: number) => request<Olympiad[]>("/api/olympiads", { query: { phase, level_id: levelId } }),
    archive: (query: ArchiveQuery) => request<{ total: number; items: ArchiveProblem[] }>("/api/olympiads/problems", { query }),
    editorial: (id: number) => request<OlympiadEditorial>(`/api/olympiads/${id}/editorial`),
    saveEditorial: (id: number, data: { text: string; solutions: Record<number, string> }) =>
      request<{ saved: boolean }>(`/api/olympiads/${id}/editorial`, { method: "PUT", json: data }),
    juryMembers: (id: number) => request<JuryMember[]>(`/api/olympiads/${id}/jury-members`),
    addJury: (id: number, who: { user_id?: number; username?: string }) =>
      request<JuryMember[]>(`/api/olympiads/${id}/jury-members`, { method: "POST", json: who }),
    juryCandidates: (id: number, q?: string) => request<JuryCandidate[]>(`/api/olympiads/${id}/jury-candidates`, { query: { q } }),
    myJuryInvitations: () => request<JuryInvitation[]>("/api/olympiads/jury-invitations/mine"),
    acceptJury: (id: number) => request<OlympiadDetail>(`/api/olympiads/${id}/jury-invitation/accept`, { method: "POST" }),
    declineJury: (id: number) => request<void>(`/api/olympiads/${id}/jury-invitation/decline`, { method: "POST" }),
    removeJury: (id: number, userId: number) => request<void>(`/api/olympiads/${id}/jury-members/${userId}`, { method: "DELETE" }),
    levels: () => request<OlympiadLevel[]>("/api/olympiads/levels", { auth: false }),
    finish: (id: number) => request<OlympiadDetail>(`/api/olympiads/${id}/finish`, { method: "POST" }),
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
    standings: (id: number) => request<OlympiadStandings>(`/api/olympiads/${id}/standings`),
    announcements: (id: number) => request<OlympiadAnnouncement[]>(`/api/olympiads/${id}/announcements`),
    announce: (id: number, text: string, taskId?: number | null) =>
      request<OlympiadAnnouncement>(`/api/olympiads/${id}/announcements`, { method: "POST", json: { text, task_id: taskId ?? null } }),
    attempts: (id: number, query: { user_id?: number; task_id?: number; rejected?: boolean } = {}) =>
      request<OlympiadAttempt[]>(`/api/olympiads/${id}/attempts`, { query }),
    myHistory: (id: number) => request<OlympiadHistoryItem[]>(`/api/olympiads/${id}/my-history`),
    virtual: (id: number) => request<VirtualRun | null>(`/api/olympiads/${id}/virtual`),
    startVirtual: (id: number, delayMinutes = 0) =>
      request<VirtualRun>(`/api/olympiads/${id}/virtual`, { method: "POST", json: { delay_minutes: delayMinutes } }),
    cancelVirtual: (id: number) => request<void>(`/api/olympiads/${id}/virtual`, { method: "DELETE" }),
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
    createLevel: (data: OlympiadLevelInput) => request<OlympiadLevel>("/api/admin/olympiad-levels", { method: "POST", json: data }),
    updateLevel: (id: number, data: OlympiadLevelInput) =>
      request<OlympiadLevel>(`/api/admin/olympiad-levels/${id}`, { method: "PUT", json: data }),
    removeLevel: (id: number) => request<void>(`/api/admin/olympiad-levels/${id}`, { method: "DELETE" }),
    recomputeRating: () => request<{ olympiads: number }>("/api/admin/rating/recompute", { method: "POST" }),
    settings: () => request<AdminSettings>("/api/admin/settings"),
    updateSettings: (data: AdminSettings) => request<AdminSettings>("/api/admin/settings", { method: "PUT", json: data }),
    createRegion: (data: { country_code: string; name: string; position?: number }) =>
      request<{ id: number }>("/api/admin/geo/regions", { method: "POST", json: data }),
    removeRegion: (id: number) => request<void>(`/api/admin/geo/regions/${id}`, { method: "DELETE" }),
    createCity: (regionId: number, name: string) =>
      request<{ id: number }>("/api/admin/geo/cities", { method: "POST", json: { region_id: regionId, name } }),
    removeCity: (id: number) => request<void>(`/api/admin/geo/cities/${id}`, { method: "DELETE" }),
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
