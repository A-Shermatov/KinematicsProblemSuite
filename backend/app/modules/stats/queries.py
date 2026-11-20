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

# Рейтинг: очки = сумма сложностей решённых задач (каждая задача считается один раз).
LEADERBOARD = """
WITH solved AS (
    SELECT DISTINCT a.student_id, a.task_id
    FROM attempts a
    WHERE a.status IN ('correct', 'graded') AND COALESCE(a.teacher_grade, a.system_grade, 0) >= 50
      AND a.created_at > COALESCE($2::timestamptz, '-infinity')
)
SELECT u.id AS user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS name, u.avatar_path,
       count(*) AS solved_tasks, sum(k.difficulty) AS points
FROM solved sv
JOIN users u ON u.id = sv.student_id AND u.is_active AND u.role = 'student'
JOIN tasks k ON k.id = sv.task_id AND k.is_active
GROUP BY u.id
ORDER BY points DESC, solved_tasks DESC, u.id
LIMIT $1
"""
