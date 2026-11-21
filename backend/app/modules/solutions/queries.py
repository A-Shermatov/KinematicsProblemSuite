"""SQL для попыток решения. Один JOIN вместо десятков HTTP-запросов между сервисами."""

ATTEMPT_COLUMNS = """
a.id, a.task_id, k.title AS task_title, k.theme_id, t.title AS theme_title,
k.author_id AS task_author_id,
a.student_id, st.username AS student_username,
trim(st.first_name || ' ' || st.last_name) AS student_name,
a.answer, a.image_path, a.status, a.system_grade, a.teacher_grade, a.feedback,
a.graded_by, a.graded_at, a.created_at,
COALESCE(a.expected, k.answer) AS correct_answer, k.unit AS task_unit,
a.mistake_hint, EXISTS (SELECT 1 FROM attempt_hint_opens ho WHERE ho.attempt_id = a.id) AS mistake_hint_opened
"""

ATTEMPT_FROM = """
FROM attempts a
JOIN tasks k ON k.id = a.task_id
JOIN themes t ON t.id = k.theme_id
JOIN users st ON st.id = a.student_id
"""

INSERT_ATTEMPT = """
INSERT INTO attempts (task_id, student_id, answer, image_path, status, system_grade, feedback, hints_used, expected,
                      mistake_hint)
VALUES ($1, $2, $3, $4, $5, $6, $7,
        -- Обычные подсказки и открытые подсказки к неверным ответам снижают очки одинаково.
        (SELECT count(*) FROM task_hint_opens WHERE task_id = $1 AND user_id = $2)
        + (SELECT count(*) FROM attempt_hint_opens ho JOIN attempts x ON x.id = ho.attempt_id
           WHERE x.task_id = $1 AND x.student_id = $2),
        $8, $9)
RETURNING id
"""

GET_ATTEMPT = f"""
SELECT {ATTEMPT_COLUMNS}
{ATTEMPT_FROM}
WHERE a.id = $1
"""

# Область видимости задаётся параметрами: $1 — только попытки этого ученика, $2 — только по задачам этого автора.
# $3 статус, $4 задача, $5 limit, $6 offset. NULL — без фильтра.
LIST_ATTEMPTS = f"""
SELECT {ATTEMPT_COLUMNS}
{ATTEMPT_FROM}
WHERE ($1::bigint IS NULL OR a.student_id = $1)
  AND ($2::bigint IS NULL OR k.author_id = $2)
  AND ($3::text IS NULL OR a.status = $3)
  AND ($4::bigint IS NULL OR a.task_id = $4)
ORDER BY a.created_at DESC, a.id DESC
LIMIT $5 OFFSET $6
"""

GRADE_ATTEMPT = """
UPDATE attempts
SET teacher_grade = $2, status = 'graded', feedback = $3, graded_by = $4, graded_at = now()
WHERE id = $1
RETURNING id
"""

# Защита от спама: сколько попыток ученик отправил по задаче за последнюю минуту.
RECENT_ATTEMPTS_COUNT = """
SELECT count(*) FROM attempts
WHERE task_id = $1 AND student_id = $2 AND created_at > now() - interval '1 minute'
"""

OPEN_MISTAKE_HINT = "INSERT INTO attempt_hint_opens (attempt_id) VALUES ($1) ON CONFLICT DO NOTHING"
