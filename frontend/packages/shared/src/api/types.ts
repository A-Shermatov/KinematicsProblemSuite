export type Role = "student" | "teacher" | "admin";
export type CheckMode = "auto" | "manual";
export type AnswerType = "number" | "text";
export type AttemptStatus = "correct" | "incorrect" | "pending" | "graded";
export type AttemptScope = "mine" | "authored";
export type SourceType = "book" | "olympiad" | "exam" | "own";

/** Источник задачи в том виде, в каком его отдаёт API задачи (поля из каталога источников). */
export interface TaskSource {
  source_id?: number | null;
  source_type: SourceType | null;
  source_title: string | null;
  source_year: number | null;
  source_author?: string;
  source_number: string | null;
  is_original?: boolean;
}

/** Книга, сборник, олимпиада или экзамен из общего каталога. */
export interface Source {
  id: number;
  type: SourceType;
  title: string;
  author: string;
  year: number | null;
  created_by: number | null;
  created_at: string;
  tasks_count: number;
}

export interface SourceInput {
  type: SourceType;
  title: string;
  author: string;
  year: number | null;
}

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
  avatar_url: string | null;
  city: string | null;
  school: string | null;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Subject {
  id: number;
  title: string;
  description: string;
  position: number;
  themes_count: number;
}

export interface Theme {
  id: number;
  subject_id: number;
  subject_title: string;
  title: string;
  description: string;
  position: number;
  tasks_count: number;
}

export type TranslationLang = "en" | "tg";
export type TaskTranslations = Partial<Record<TranslationLang, { title: string; condition: string }>>;

export interface Task extends TaskSource {
  id: number;
  theme_id: number;
  theme_title: string;
  subject_id: number;
  subject_title: string;
  author_id: number;
  author_name: string;
  title: string;
  condition: string;
  difficulty: number;
  check_mode: CheckMode;
  answer_type: AnswerType;
  unit: string | null;
  solved: boolean;
  created_at: string;
  updated_at: string;
  /** На каком языке фактически показано условие (нет перевода — ru). */
  lang: string;
  available_langs: string[];
  /** Дубликат, оставшийся с тех пор, когда проверки уникальности не было. */
  duplicate_of?: number | null;
  /** У каждого ученика свои числа в условии. */
  is_parametric?: boolean;
}

export interface TaskFull extends Task {
  answer: string;
  tolerance: number;
  /** Переводы для редактора; title/condition при этом — русский оригинал. */
  translations: TaskTranslations;
  hints: string[];
  explanation: string;
  mistakes: TaskMistake[];
  params: TaskParams;
  answer_formula: string;
}

/** Параметры задачи: {v} в условии — у каждого ученика своё значение из диапазона. */
export type TaskParams = Record<string, { min: number; max: number; step: number }>;

/** Частый неверный ответ и пояснение, которое увидит ученик. */
export interface TaskMistake {
  answer: string;
  message: string;
}

/** Подсказки и разбор на странице задачи. */
export interface TaskHelp {
  hints_total: number;
  hints: string[];
  points: number;
  hint_penalty: number;
  has_explanation: boolean;
  explanation: string | null;
  attempts_until_explanation: number;
  can_open_hints: boolean;
}

/** Задача, совпадающая или похожая на ту, что сейчас редактируют. */
export interface DuplicateHit {
  id: number;
  title: string;
  author_id: number;
  author_name: string;
  theme_title: string;
  exact: boolean;
  similarity: number;
}

export interface DuplicateCheck {
  exact: DuplicateHit | null;
  similar: DuplicateHit[];
}

export interface TaskInput {
  source_id: number | null;
  source_number: string | null;
  is_original: boolean;
  theme_id: number;
  title: string;
  condition: string;
  difficulty: number;
  check_mode: CheckMode;
  answer_type: AnswerType;
  answer: string;
  unit: string | null;
  tolerance: number;
  translations: TaskTranslations;
  hints: string[];
  explanation: string;
  mistakes: TaskMistake[];
  params: TaskParams;
  answer_formula: string;
}

export interface Attempt {
  id: number;
  task_id: number;
  task_title: string;
  theme_id: number;
  theme_title: string;
  task_author_id: number;
  student_id: number;
  student_username: string;
  student_name: string;
  answer: string;
  image_url: string | null;
  status: AttemptStatus;
  system_grade: number | null;
  teacher_grade: number | null;
  feedback: string;
  graded_at: string | null;
  created_at: string;
  correct_answer: string | null;
  task_unit: string | null;
}

export interface StudentStats {
  role: "student";
  attempts: number;
  correct: number;
  incorrect: number;
  pending: number;
  graded: number;
  solved_tasks: number;
  by_theme: { theme_id: number; theme_title: string; total_tasks: number; solved_tasks: number }[];
}

/** Учитель и админ видят в кабинете сводку по своим задачам. */
export interface TeacherStats {
  role: "teacher" | "admin";
  tasks: number;
  attempts: number;
  pending: number;
  correct: number;
  incorrect: number;
  students: number;
}

export interface AdminStats {
  students: number;
  teachers: number;
  blocked: number;
  subjects: number;
  themes: number;
  tasks: number;
  attempts: number;
  pending: number;
}

export type Stats = StudentStats | TeacherStats;

export type Period = "week" | "month" | "all";

export interface LeaderboardRow {
  rank: number;
  user_id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
  school: string | null;
  solved_tasks: number;
  points: number;
  title: UserTitle | null;
}

export interface SchoolRow {
  rank: number;
  school: string;
  city: string | null;
  students: number;
  solved_tasks: number;
  points: number;
}

export interface CityRow {
  rank: number;
  city: string;
  students: number;
  schools: number;
  solved_tasks: number;
  points: number;
}

/** Звание за олимпиады (только за призовые места и победы). */
export interface UserTitle {
  code: string;
  icon: string;
  name: string;
}

export interface TitleProgress extends UserTitle {
  description: string;
  earned: boolean;
  progress: number;
  target: number;
}

export interface Achievements {
  solved_tasks: number;
  points: number;
  olympiads: number;
  olympiad_prizes: number;
  olympiad_wins: number;
  title: UserTitle | null;
  titles: TitleProgress[];
}

export type CertificateStatus = "pending" | "verified" | "rejected";

export interface TeacherCard {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  headline: string;
  experience_years: number | null;
  subjects: string[];
  rating: number | null;
  reviews_count: number;
  tasks_count: number;
  verified_certificates: number;
}

export interface Certificate {
  id: number;
  teacher_id: number;
  teacher_name: string;
  title: string;
  issuer: string;
  year: number | null;
  file_url: string;
  is_pdf: boolean;
  status: CertificateStatus;
  reject_reason: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface Review {
  id: number;
  teacher_id: number;
  teacher_name: string;
  student_id: number;
  student_username: string;
  student_name: string;
  student_avatar_url: string | null;
  rating: number;
  text: string;
  reply: string;
  replied_at: string | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeacherProfile extends TeacherCard {
  bio: string;
  subject_ids: number[];
  students_count: number;
  attempts_count: number;
  created_at: string;
  rating_distribution: Record<string, number>;
  certificates: Certificate[];
  can_review: boolean;
  my_review: Review | null;
}

export interface TeacherProfileInput {
  headline: string;
  bio: string;
  experience_years: number | null;
  subject_ids: number[];
}

export type OlympiadStatus = "draft" | "pending" | "published" | "rejected";
export type OlympiadPhase = "upcoming" | "running" | "checking" | "finished";

export interface Olympiad {
  id: number;
  title: string;
  description: string;
  subject_id: number | null;
  subject_title: string | null;
  organizer_id: number;
  organizer_name: string;
  starts_at: string;
  ends_at: string;
  status: OlympiadStatus;
  reject_reason: string;
  results_published: boolean;
  phase: OlympiadPhase;
  participants_count: number;
  tasks_count: number;
  max_score: number;
  is_registered: boolean;
  created_at: string;
}

export interface OlympiadTask {
  id: number;
  olympiad_id: number;
  position: number;
  title: string;
  condition: string;
  answer_type: AnswerType;
  unit: string | null;
  max_points: number;
  answer: string | null;
  tolerance: number | null;
  lang: string;
  available_langs: string[];
  /** Только организатору. */
  translations: TaskTranslations | null;
}

export interface OlympiadDetail extends Olympiad {
  tasks: OlympiadTask[];
  can_manage: boolean;
  ungraded_count: number | null;
}

export interface OlympiadInput {
  title: string;
  description: string;
  subject_id: number | null;
  starts_at: string;
  ends_at: string;
}

export interface OlympiadTaskInput {
  position: number;
  title: string;
  condition: string;
  answer_type: AnswerType;
  answer: string;
  unit: string | null;
  tolerance: number;
  max_points: number;
  translations: TaskTranslations;
}

export interface OlympiadSubmission {
  id: number;
  olympiad_id: number;
  task_id: number;
  task_title: string;
  task_position: number;
  max_points: number;
  user_id: number;
  username: string;
  user_name: string;
  school: string | null;
  city: string | null;
  answer: string;
  image_url: string;
  auto_correct: boolean;
  auto_points: number;
  jury_points: number | null;
  jury_comment: string;
  points: number;
  graded_at: string | null;
  submitted_at: string;
  correct_answer: string | null;
  task_unit: string | null;
}

export interface OlympiadResultRow {
  place: number;
  user_id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
  school: string | null;
  total: number;
  /** Штраф: сумма минут от начала до отправки по задачам с баллами (при равных баллах выше тот, у кого меньше). */
  penalty: number;
  task_points: Record<string, number>;
  diploma: 1 | 2 | 3 | null;
}

export interface OlympiadResults {
  max_score: number;
  published: boolean;
  rows: OlympiadResultRow[];
}

export interface VirtualSubmission {
  task_id: number;
  task_title: string;
  task_position: number;
  max_points: number;
  answer: string;
  correct: boolean | null;
  points: number | null;
  submitted_at: string;
  correct_answer: string | null;
  task_unit: string | null;
}

/** Виртуальное участие в прошедшей олимпиаде. Баллы и место — после окончания личного времени. */
export interface VirtualRun {
  started_at: string;
  ends_at: string;
  active: boolean;
  submissions: VirtualSubmission[];
  total: number | null;
  max_score: number;
  would_place: number | null;
  official_participants: number;
}

export interface VirtualStandingRow {
  user_id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
  school: string | null;
  total: number;
  started_at: string;
  would_place: number;
}

export interface OlympiadLeaderRow {
  rank: number;
  user_id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
  school: string | null;
  olympiads: number;
  points: number;
  gold: number;
  silver: number;
  bronze: number;
  title: UserTitle | null;
}

export interface PlatformSettings {
  difficulty_max: number;
  difficulty_step: number;
  difficulty_levels: number[];
}

export interface Activity {
  days: { date: string; count: number }[];
  total: number;
  active_days: number;
  timezone: string;
}

export interface DifficultyBreakdown {
  levels: { difficulty: number; solved: number; unsolved: number }[];
  subjects: { subject_id: number; subject_title: string; solved: number }[];
}

// ---------- Импорт задач ----------

export interface TaskDraft {
  title: string;
  condition: string;
  answer: string;
  unit: string | null;
  answer_type: AnswerType;
  difficulty: number | null;
  source_number: string | null;
  /** Ответа в источнике не было — его предложил ИИ, учителю нужно проверить. */
  answer_is_guess: boolean;
  duplicate: DuplicateHit | null;
  similar: DuplicateHit[];
}

export interface ImportParseResult {
  method: "file" | "ai";
  drafts: TaskDraft[];
  notes: string;
  /** Какая модель Gemini распознала (если выбранная была занята — запасная). */
  model: string | null;
}

export interface AiModel {
  id: string;
  label: string;
  hint: string;
}

export interface ImportCapabilities {
  file_formats: string[];
  ai_formats: string[];
  ai_enabled: boolean;
  ai_models: AiModel[];
}

export interface ImportItem {
  title: string;
  condition: string;
  answer: string;
  unit: string | null;
  answer_type: AnswerType;
  difficulty: number;
  source_number: string | null;
}

export interface ImportInput {
  theme_id: number;
  check_mode: CheckMode;
  source_id: number | null;
  is_original: boolean;
  tasks: ImportItem[];
}

export interface ImportResult {
  created: number[];
  failed: { index: number; title: string; error: string }[];
}

// ---------- Подборки ----------

export interface Collection {
  id: number;
  title: string;
  description: string;
  author_id: number;
  author_name: string;
  is_public: boolean;
  tasks_count: number;
  /** Сколько задач подборки решил текущий пользователь. */
  solved_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionDetail extends Collection {
  tasks: Task[];
  can_edit: boolean;
}

export interface CollectionInput {
  title: string;
  description: string;
  is_public: boolean;
  task_ids: number[];
}

export type TaskProgress = "solved" | "unsolved" | "new";

export interface TelegramStatus {
  enabled: boolean;
  bot_username: string;
  linked: boolean;
  username: string;
  daily_task: boolean;
  notify: boolean;
}

/** Клетка живой таблицы олимпиады. */
export interface StandingsCell {
  points: number;
  /** Минута от начала олимпиады, когда отправлено последнее решение. */
  minute: number;
  attempts: number;
  /** Проверено жюри; иначе — балл автопроверки, может измениться. */
  graded: boolean;
}

export interface StandingsRow {
  place: number;
  user_id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  school: string | null;
  city: string | null;
  total: number;
  penalty: number;
  cells: Record<string, StandingsCell>;
}

export interface OlympiadStandings {
  phase: OlympiadPhase;
  starts_at: string;
  max_score: number;
  provisional: boolean;
  tasks: { id: number; label: string; max_points: number }[];
  rows: StandingsRow[];
}
