"""SQL для олимпиад."""

# Этап считается из времени: до начала, идёт, проверка, итоги опубликованы.
PHASE = """
CASE WHEN now() < o.starts_at THEN 'upcoming'
     WHEN now() < o.ends_at THEN 'running'
     WHEN NOT o.results_published THEN 'checking'
     ELSE 'finished' END
"""

# $viewer — параметр с id текущего пользователя (или NULL), подставляется в каждом запросе.
_COLUMNS = f"""
o.id, o.title, o.description, o.subject_id, s.title AS subject_title,
o.organizer_id, trim(u.first_name || ' ' || u.last_name) AS organizer_name,
o.starts_at, o.ends_at, o.status, o.reject_reason, o.results_published, o.created_at,
{PHASE} AS phase,
(SELECT count(*) FROM olympiad_participants p WHERE p.olympiad_id = o.id) AS participants_count,
(SELECT count(*) FROM olympiad_tasks t WHERE t.olympiad_id = o.id) AS tasks_count,
(SELECT COALESCE(sum(t.max_points), 0) FROM olympiad_tasks t WHERE t.olympiad_id = o.id)::int AS max_score
"""

_FROM = """
FROM olympiads o
JOIN users u ON u.id = o.organizer_id
LEFT JOIN subjects s ON s.id = o.subject_id
"""

# $1 этап (NULL — все), $2 id зрителя.
LIST_PUBLISHED = f"""
SELECT * FROM (
    SELECT {_COLUMNS},
           EXISTS (SELECT 1 FROM olympiad_participants p WHERE p.olympiad_id = o.id AND p.user_id = $2) AS is_registered
    {_FROM}
    WHERE o.status = 'published'
) x
WHERE ($1::text IS NULL OR x.phase = $1)
ORDER BY CASE WHEN x.ends_at > now() THEN x.starts_at END ASC NULLS LAST, x.starts_at DESC
LIMIT 100
"""

LIST_BY_ORGANIZER = f"""
SELECT {_COLUMNS}, FALSE AS is_registered
{_FROM}
WHERE o.organizer_id = $1
ORDER BY o.starts_at DESC
"""

ADMIN_LIST = f"""
SELECT {_COLUMNS}, FALSE AS is_registered
{_FROM}
WHERE ($1::text IS NULL OR o.status = $1)
ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.starts_at DESC
LIMIT 200
"""

GET = f"""
SELECT {_COLUMNS},
       EXISTS (SELECT 1 FROM olympiad_participants p WHERE p.olympiad_id = o.id AND p.user_id = $2) AS is_registered
{_FROM}
WHERE o.id = $1
"""

INSERT = """
INSERT INTO olympiads (title, description, subject_id, organizer_id, starts_at, ends_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
"""

# Редактировать можно только черновик или отклонённую. После правки отклонённая снова становится черновиком.
UPDATE = """
UPDATE olympiads
SET title = $2, description = $3, subject_id = $4, starts_at = $5, ends_at = $6,
    status = 'draft', reject_reason = '', updated_at = now()
WHERE id = $1 AND status IN ('draft', 'rejected')
RETURNING id
"""

DELETE = "DELETE FROM olympiads WHERE id = $1 AND status IN ('draft', 'rejected') RETURNING id"

SUBMIT_FOR_REVIEW = """
UPDATE olympiads SET status = 'pending', updated_at = now()
WHERE id = $1 AND status IN ('draft', 'rejected')
RETURNING id
"""

REVIEW = """
UPDATE olympiads SET status = $2, reject_reason = $3, updated_at = now()
WHERE id = $1 AND status = 'pending'
RETURNING id
"""

PUBLISH_RESULTS = """
UPDATE olympiads SET results_published = TRUE, updated_at = now()
WHERE id = $1 AND status = 'published' AND ends_at <= now()
RETURNING id
"""

# ---------- Задачи ----------

TASK_COLUMNS = "id, olympiad_id, position, title, condition, answer_type, answer, unit, tolerance, max_points"

LIST_TASKS = f"SELECT {TASK_COLUMNS} FROM olympiad_tasks WHERE olympiad_id = $1 ORDER BY position, id"

GET_TASK = f"SELECT {TASK_COLUMNS} FROM olympiad_tasks WHERE id = $1 AND olympiad_id = $2"

INSERT_TASK = f"""
INSERT INTO olympiad_tasks (olympiad_id, position, title, condition, answer_type, answer, unit, tolerance, max_points)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING {TASK_COLUMNS}
"""

UPDATE_TASK = f"""
UPDATE olympiad_tasks
SET position = $3, title = $4, condition = $5, answer_type = $6, answer = $7, unit = $8, tolerance = $9,
    max_points = $10
WHERE id = $1 AND olympiad_id = $2
RETURNING {TASK_COLUMNS}
"""

DELETE_TASK = "DELETE FROM olympiad_tasks WHERE id = $1 AND olympiad_id = $2 RETURNING id"

# ---------- Участники ----------

REGISTER = """
INSERT INTO olympiad_participants (olympiad_id, user_id) VALUES ($1, $2)
ON CONFLICT DO NOTHING
"""

UNREGISTER = "DELETE FROM olympiad_participants WHERE olympiad_id = $1 AND user_id = $2 RETURNING user_id"

IS_REGISTERED = "SELECT EXISTS (SELECT 1 FROM olympiad_participants WHERE olympiad_id = $1 AND user_id = $2)"

# ---------- Решения ----------

SUBMISSION_COLUMNS = """
sb.id, sb.olympiad_id, sb.task_id, t.title AS task_title, t.position AS task_position, t.max_points,
t.answer AS correct_answer, t.unit AS task_unit,
sb.user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS user_name, u.school, u.city,
sb.answer, sb.image_path, sb.auto_correct, sb.auto_points, sb.jury_points, sb.jury_comment,
COALESCE(sb.jury_points, sb.auto_points) AS points, sb.graded_at, sb.submitted_at
"""

SUBMISSION_FROM = """
FROM olympiad_submissions sb
JOIN olympiad_tasks t ON t.id = sb.task_id
JOIN users u ON u.id = sb.user_id
"""

GET_SUBMISSION_IMAGE = "SELECT image_path FROM olympiad_submissions WHERE task_id = $1 AND user_id = $2"

# Повторная отправка заменяет решение и сбрасывает оценку жюри.
UPSERT_SUBMISSION = """
INSERT INTO olympiad_submissions (olympiad_id, task_id, user_id, answer, image_path, auto_correct, auto_points)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (task_id, user_id) DO UPDATE
SET answer = EXCLUDED.answer, image_path = EXCLUDED.image_path, auto_correct = EXCLUDED.auto_correct,
    auto_points = EXCLUDED.auto_points, jury_points = NULL, jury_comment = '', graded_by = NULL,
    graded_at = NULL, submitted_at = now()
RETURNING id
"""

GET_SUBMISSION = f"""
SELECT {SUBMISSION_COLUMNS}
{SUBMISSION_FROM}
WHERE sb.id = $1 AND sb.olympiad_id = $2
"""

MY_SUBMISSIONS = f"""
SELECT {SUBMISSION_COLUMNS}
{SUBMISSION_FROM}
WHERE sb.olympiad_id = $1 AND sb.user_id = $2
ORDER BY t.position, t.id
"""

# $2 задача (NULL — все), $3 только непроверенные.
JURY_SUBMISSIONS = f"""
SELECT {SUBMISSION_COLUMNS}
{SUBMISSION_FROM}
WHERE sb.olympiad_id = $1
  AND ($2::bigint IS NULL OR sb.task_id = $2)
  AND (NOT $3::bool OR sb.jury_points IS NULL)
ORDER BY t.position, t.id, sb.submitted_at
"""

GRADE_SUBMISSION = """
UPDATE olympiad_submissions
SET jury_points = $3, jury_comment = $4, graded_by = $5, graded_at = now()
WHERE id = $1 AND olympiad_id = $2
RETURNING id
"""

UNGRADED_COUNT = "SELECT count(*) FROM olympiad_submissions WHERE olympiad_id = $1 AND jury_points IS NULL"

# Итоговая таблица: балл = оценка жюри, а если её нет — автопроверка. Место — RANK (одинаковые баллы делят место).
RESULTS = """
WITH scores AS (
    SELECT sb.user_id, sum(COALESCE(sb.jury_points, sb.auto_points))::int AS total,
           jsonb_object_agg(sb.task_id::text, COALESCE(sb.jury_points, sb.auto_points)) AS task_points
    FROM olympiad_submissions sb
    WHERE sb.olympiad_id = $1
    GROUP BY sb.user_id
)
SELECT RANK() OVER (ORDER BY sc.total DESC)::int AS place,
       u.id AS user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS name, u.avatar_path, u.city, u.school,
       sc.total, sc.task_points::text AS task_points
FROM scores sc
JOIN users u ON u.id = sc.user_id
ORDER BY place, u.id
"""

# ---------- Рейтинг по олимпиадам ----------

# $1 limit, $2 с какой даты, $3 предмет, $4 город. Очки — сумма процентов от максимума по всем олимпиадам.
LEADERBOARD = """
WITH maxes AS (
    SELECT olympiad_id, sum(max_points) AS max_score FROM olympiad_tasks GROUP BY olympiad_id
),
scores AS (
    SELECT sb.olympiad_id, sb.user_id, sum(COALESCE(sb.jury_points, sb.auto_points)) AS total
    FROM olympiad_submissions sb
    JOIN olympiads o ON o.id = sb.olympiad_id AND o.results_published
    WHERE o.ends_at > COALESCE($2::timestamptz, '-infinity') AND ($3::bigint IS NULL OR o.subject_id = $3)
    GROUP BY sb.olympiad_id, sb.user_id
),
ranked AS (
    SELECT sc.*, m.max_score, RANK() OVER (PARTITION BY sc.olympiad_id ORDER BY sc.total DESC) AS place
    FROM scores sc JOIN maxes m USING (olympiad_id)
)
SELECT u.id AS user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS name, u.avatar_path, u.city, u.school,
       count(*) AS olympiads,
       round(sum(100.0 * r.total / NULLIF(r.max_score, 0)))::bigint AS points,
       count(*) FILTER (WHERE r.place = 1 AND r.total > 0) AS gold,
       count(*) FILTER (WHERE r.place = 2 AND r.total > 0) AS silver,
       count(*) FILTER (WHERE r.place = 3 AND r.total > 0) AS bronze
FROM ranked r
JOIN users u ON u.id = r.user_id AND u.is_active
WHERE ($4::text IS NULL OR lower(u.city) = lower($4))
GROUP BY u.id
ORDER BY points DESC NULLS LAST, gold DESC, silver DESC, bronze DESC, u.id
LIMIT $1
"""
