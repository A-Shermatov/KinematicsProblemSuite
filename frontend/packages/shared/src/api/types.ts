export type Role = "student" | "teacher" | "admin";
export type CheckMode = "auto" | "manual";
export type AnswerType = "number" | "text";
export type AttemptStatus = "correct" | "incorrect" | "pending" | "graded";
export type AttemptScope = "mine" | "authored";
export type SourceType = "book" | "olympiad" | "exam" | "own";

export interface TaskSource {
  source_type: SourceType | null;
  source_title: string | null;
  source_year: number | null;
  source_number: string | null;
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
}

export interface TaskFull extends Task {
  answer: string;
  tolerance: number;
}

export interface TaskInput extends TaskSource {
  theme_id: number;
  title: string;
  condition: string;
  difficulty: number;
  check_mode: CheckMode;
  answer_type: AnswerType;
  answer: string;
  unit: string | null;
  tolerance: number;
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

export interface AchievementBadge {
  code: string;
  icon: string;
  title: string;
  description: string;
  earned: boolean;
  progress: number;
  target: number;
}

export interface Achievements {
  solved_tasks: number;
  points: number;
  hard_solved: number;
  best_streak: number;
  current_streak: number;
  mastered_themes: number;
  badges: AchievementBadge[];
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
