"""SQL для статистики и рейтинга."""

STUDENT_SUMMARY = """
SELECT count(*)                                         AS attempts,
       count(*) FILTER (WHERE status = 'correct')       AS correct,
       count(*) FILTER (WHERE status = 'incorrect')     AS incorrect,
       count(*) FILTER (WHERE status = 'pending')       AS pending,
       count(*) FILTER (WHERE status = 'graded')        AS graded,
       count(DISTINCT task_id) FILTER (
           WHERE status IN ('correct', 'graded') AND COALESCE(teacher_grade, system_grade, 0) >= 50
       )                                                AS solved_tasks
FROM attempts
WHERE student_id = $1
"""

STUDENT_BY_THEME = """
SELECT t.id AS theme_id, t.title AS theme_title,
       (SELECT count(*) FROM tasks k2 WHERE k2.theme_id = t.id AND k2.is_active) AS total_tasks,
       count(DISTINCT a.task_id) FILTER (
           WHERE a.status IN ('correct', 'graded') AND COALESCE(a.teacher_grade, a.system_grade, 0) >= 50
       ) AS solved_tasks
FROM attempts a
JOIN tasks k ON k.id = a.task_id
JOIN themes t ON t.id = k.theme_id
WHERE a.student_id = $1 AND t.is_active
GROUP BY t.id, t.title
ORDER BY t.title
"""

TEACHER_SUMMARY = """
SELECT (SELECT count(*) FROM tasks WHERE author_id = $1 AND is_active)                AS tasks,
       count(a.id)                                                                   AS attempts,
       count(a.id) FILTER (WHERE a.status = 'pending')                               AS pending,
       count(a.id) FILTER (WHERE a.status = 'correct')                               AS correct,
       count(a.id) FILTER (WHERE a.status = 'incorrect')                             AS incorrect,
       count(DISTINCT a.student_id)                                                  AS students
FROM tasks k
LEFT JOIN attempts a ON a.task_id = k.id
WHERE k.author_id = $1
"""

ADMIN_SUMMARY = """
SELECT (SELECT count(*) FROM users WHERE role = 'student')  AS students,
       (SELECT count(*) FROM users WHERE role = 'teacher')  AS teachers,
       (SELECT count(*) FROM users WHERE NOT is_active)     AS blocked,
       (SELECT count(*) FROM subjects WHERE is_active)      AS subjects,
       (SELECT count(*) FROM themes WHERE is_active)        AS themes,
       (SELECT count(*) FROM tasks WHERE is_active)         AS tasks,
       (SELECT count(*) FROM attempts)                      AS attempts,
       (SELECT count(*) FROM attempts WHERE status = 'pending') AS pending
"""

# Задача считается решённой, если есть верная автопроверка или оценка учителя не ниже 50.
SOLVED_CONDITION = "a.status IN ('correct', 'graded') AND COALESCE(a.teacher_grade, a.system_grade, 0) >= 50"

# Решённые задачи (каждая один раз) за период, по предмету. Очки = сумма сложностей.
_SOLVED_CTE = f"""
solved AS (
    SELECT DISTINCT a.student_id, a.task_id
    FROM attempts a
    JOIN tasks k ON k.id = a.task_id AND k.is_active
    JOIN themes t ON t.id = k.theme_id
    WHERE {SOLVED_CONDITION}
      AND a.created_at > COALESCE($2::timestamptz, '-infinity')
      AND ($3::bigint IS NULL OR t.subject_id = $3)
),
per_student AS (
    SELECT sv.student_id, count(*) AS solved_tasks, sum(k.difficulty) AS points
    FROM solved sv JOIN tasks k ON k.id = sv.task_id
    GROUP BY sv.student_id
)
"""

# $1 limit, $2 с какой даты, $3 предмет, $4 город, $5 школа, $6 метрика ('points' | 'solved').
LEADERBOARD = f"""
WITH {_SOLVED_CTE}
SELECT u.id AS user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS name, u.avatar_path,
       u.city, u.school, ps.solved_tasks, ps.points
FROM per_student ps
JOIN users u ON u.id = ps.student_id AND u.is_active AND u.role = 'student'
WHERE ($4::text IS NULL OR lower(u.city) = lower($4))
  AND ($5::text IS NULL OR lower(u.school) = lower($5))
ORDER BY CASE WHEN $6::text = 'solved' THEN ps.solved_tasks ELSE ps.points END DESC,
         ps.points DESC, ps.solved_tasks DESC, u.id
LIMIT $1
"""

# Школы: сумма очков учеников школы. $4 — фильтр по городу.
SCHOOL_LEADERBOARD = f"""
WITH {_SOLVED_CTE}
SELECT min(u.school) AS school, min(u.city) AS city,
       count(*) AS students, sum(ps.solved_tasks)::bigint AS solved_tasks, sum(ps.points)::bigint AS points
FROM per_student ps
JOIN users u ON u.id = ps.student_id AND u.is_active AND u.role = 'student'
WHERE u.school IS NOT NULL AND ($4::text IS NULL OR lower(u.city) = lower($4))
GROUP BY lower(COALESCE(u.city, '')), lower(u.school)
ORDER BY points DESC, students DESC
LIMIT $1
"""

CITY_LEADERBOARD = f"""
WITH {_SOLVED_CTE}
SELECT min(u.city) AS city, count(*) AS students, count(DISTINCT lower(u.school)) AS schools,
       sum(ps.solved_tasks)::bigint AS solved_tasks, sum(ps.points)::bigint AS points
FROM per_student ps
JOIN users u ON u.id = ps.student_id AND u.is_active AND u.role = 'student'
WHERE u.city IS NOT NULL
GROUP BY lower(u.city)
ORDER BY points DESC, students DESC
LIMIT $1
"""

# Подсказки для полей «город» и «школа».
CITIES = """
SELECT min(city) AS name, count(*) AS users FROM users
WHERE city IS NOT NULL AND is_active
GROUP BY lower(city) ORDER BY users DESC, name LIMIT 50
"""

SCHOOLS = """
SELECT min(school) AS name, count(*) AS users FROM users
WHERE school IS NOT NULL AND is_active AND ($1::text IS NULL OR lower(city) = lower($1))
GROUP BY lower(school) ORDER BY users DESC, name LIMIT 100
"""

# Всё для значков одним запросом. $1 ученик, $2 часовой пояс (для серий по дням), $3 высший уровень сложности.
ACHIEVEMENTS = f"""
WITH solved AS (
    SELECT DISTINCT ON (a.task_id) a.task_id, a.created_at
    FROM attempts a
    JOIN tasks k ON k.id = a.task_id AND k.is_active
    WHERE a.student_id = $1 AND {SOLVED_CONDITION}
    ORDER BY a.task_id, a.created_at
),
days AS (
    SELECT DISTINCT (a.created_at AT TIME ZONE $2::text)::date AS d
    FROM attempts a
    WHERE a.student_id = $1 AND {SOLVED_CONDITION}
),
islands AS (
    SELECT d, d - (row_number() OVER (ORDER BY d))::int AS grp FROM days
),
streaks AS (
    SELECT count(*) AS len, max(d) AS last_day FROM islands GROUP BY grp
),
olympiad_scores AS (
    SELECT sb.olympiad_id, sb.user_id, sum(COALESCE(sb.jury_points, sb.auto_points)) AS total
    FROM olympiad_submissions sb
    JOIN olympiads o ON o.id = sb.olympiad_id AND o.results_published
    GROUP BY sb.olympiad_id, sb.user_id
),
olympiad_places AS (
    SELECT *, RANK() OVER (PARTITION BY olympiad_id ORDER BY total DESC) AS place FROM olympiad_scores
)
SELECT
    (SELECT count(*) FROM solved) AS solved_tasks,
    (SELECT COALESCE(sum(k.difficulty), 0) FROM solved s JOIN tasks k ON k.id = s.task_id) AS points,
    (SELECT count(*) FROM solved s JOIN tasks k ON k.id = s.task_id WHERE k.difficulty >= $3) AS hard_solved,
    COALESCE((SELECT max(len) FROM streaks), 0) AS best_streak,
    COALESCE((SELECT len FROM streaks
              WHERE last_day >= (now() AT TIME ZONE $2::text)::date - 1
              ORDER BY last_day DESC LIMIT 1), 0) AS current_streak,
    (SELECT count(*) FROM themes t
     WHERE t.is_active
       AND (SELECT count(*) FROM tasks k WHERE k.theme_id = t.id AND k.is_active) >= 3
       AND NOT EXISTS (SELECT 1 FROM tasks k
                       WHERE k.theme_id = t.id AND k.is_active
                         AND k.id NOT IN (SELECT task_id FROM solved))) AS mastered_themes,
    (SELECT count(*) FROM olympiad_places WHERE user_id = $1) AS olympiads,
    (SELECT count(*) FROM olympiad_places WHERE user_id = $1 AND place <= 3 AND total > 0) AS olympiad_prizes,
    (SELECT count(*) FROM olympiad_places WHERE user_id = $1 AND place = 1 AND total > 0) AS olympiad_wins
"""

# Активность по дням за последний год: любая отправленная попытка (задачи и олимпиады).
# $1 пользователь, $2 часовой пояс, $3 сколько дней назад.
ACTIVITY = """
WITH events AS (
    SELECT created_at AS at FROM attempts WHERE student_id = $1
    UNION ALL
    SELECT submitted_at FROM olympiad_submissions WHERE user_id = $1
)
SELECT (at AT TIME ZONE $2::text)::date AS day, count(*) AS count
FROM events
WHERE at >= now() - make_interval(days => $3::int)
GROUP BY day
ORDER BY day
"""

# Решённые и нерешённые задачи по уровням сложности.
BY_DIFFICULTY = f"""
WITH tried AS (
    SELECT a.task_id, bool_or({SOLVED_CONDITION}) AS solved
    FROM attempts a
    WHERE a.student_id = $1
    GROUP BY a.task_id
)
SELECT k.difficulty, count(*) FILTER (WHERE tr.solved) AS solved, count(*) FILTER (WHERE NOT tr.solved) AS unsolved
FROM tried tr
JOIN tasks k ON k.id = tr.task_id
GROUP BY k.difficulty
ORDER BY k.difficulty
"""

BY_SUBJECT = f"""
SELECT s.id AS subject_id, s.title AS subject_title, count(DISTINCT a.task_id) AS solved
FROM attempts a
JOIN tasks k ON k.id = a.task_id
JOIN themes t ON t.id = k.theme_id
JOIN subjects s ON s.id = t.subject_id
WHERE a.student_id = $1 AND {SOLVED_CONDITION}
GROUP BY s.id, s.title
ORDER BY solved DESC
"""
