"""SQL для предметов, тем и задач."""

# ---------- Предметы ----------

SUBJECT_COLUMNS = "s.id, s.title, s.description, s.position"

LIST_SUBJECTS = f"""
SELECT {SUBJECT_COLUMNS},
       (SELECT count(*) FROM themes t WHERE t.subject_id = s.id AND t.is_active) AS themes_count
FROM subjects s
WHERE s.is_active
ORDER BY s.position, s.id
"""

GET_SUBJECT = f"""
SELECT {SUBJECT_COLUMNS},
       (SELECT count(*) FROM themes t WHERE t.subject_id = s.id AND t.is_active) AS themes_count
FROM subjects s
WHERE s.id = $1 AND s.is_active
"""

INSERT_SUBJECT = f"""
INSERT INTO subjects AS s (title, description, position)
VALUES ($1, $2, $3)
RETURNING {SUBJECT_COLUMNS}, 0::bigint AS themes_count
"""

UPDATE_SUBJECT = f"""
UPDATE subjects AS s
SET title = $2, description = $3, position = $4, updated_at = now()
WHERE s.id = $1 AND s.is_active
RETURNING {SUBJECT_COLUMNS},
          (SELECT count(*) FROM themes t WHERE t.subject_id = s.id AND t.is_active) AS themes_count
"""

DEACTIVATE_SUBJECT = """
UPDATE subjects SET is_active = FALSE, updated_at = now()
WHERE id = $1 AND is_active
  AND NOT EXISTS (SELECT 1 FROM themes WHERE subject_id = $1 AND is_active)
RETURNING id
"""

SUBJECT_TITLE_TAKEN = """
SELECT EXISTS (
    SELECT 1 FROM subjects WHERE lower(title) = lower($1) AND is_active AND id <> COALESCE($2::bigint, 0)
)
"""

# ---------- Темы ----------

THEME_COLUMNS = "t.id, t.subject_id, s.title AS subject_title, t.title, t.description, t.position"

LIST_THEMES = f"""
SELECT {THEME_COLUMNS},
       (SELECT count(*) FROM tasks k WHERE k.theme_id = t.id AND k.is_active) AS tasks_count
FROM themes t
JOIN subjects s ON s.id = t.subject_id
WHERE t.is_active AND ($1::bigint IS NULL OR t.subject_id = $1)
ORDER BY s.position, t.position, t.id
"""

GET_THEME = f"""
SELECT {THEME_COLUMNS},
       (SELECT count(*) FROM tasks k WHERE k.theme_id = t.id AND k.is_active) AS tasks_count
FROM themes t
JOIN subjects s ON s.id = t.subject_id
WHERE t.id = $1 AND t.is_active
"""

INSERT_THEME = """
INSERT INTO themes (subject_id, title, description, position)
SELECT $1, $2, $3, $4
WHERE EXISTS (SELECT 1 FROM subjects WHERE id = $1 AND is_active)
RETURNING id
"""

UPDATE_THEME = """
UPDATE themes
SET subject_id = $2, title = $3, description = $4, position = $5, updated_at = now()
WHERE id = $1 AND is_active
  AND EXISTS (SELECT 1 FROM subjects WHERE id = $2 AND is_active)
RETURNING id
"""

DEACTIVATE_THEME = """
UPDATE themes SET is_active = FALSE, updated_at = now()
WHERE id = $1 AND is_active
  AND NOT EXISTS (SELECT 1 FROM tasks WHERE theme_id = $1 AND is_active)
RETURNING id
"""

THEME_EXISTS = "SELECT EXISTS (SELECT 1 FROM themes WHERE id = $1 AND is_active)"

# ---------- Задачи ----------

# Публичные поля задачи — без правильного ответа.
TASK_PUBLIC_COLUMNS = """
k.id, k.theme_id, t.title AS theme_title, t.subject_id, s.title AS subject_title,
k.author_id, trim(u.first_name || ' ' || u.last_name) AS author_name,
k.title, k.condition, k.difficulty, k.check_mode, k.answer_type, k.unit,
k.source_type, k.source_title, k.source_year, k.source_number, k.created_at, k.updated_at, k.translations
"""

TASK_FROM = """
FROM tasks k
JOIN themes t ON t.id = k.theme_id
JOIN subjects s ON s.id = t.subject_id
JOIN users u ON u.id = k.author_id
"""

# $1 theme_id, $2 subject_id, $3 author_id, $4 difficulty, $5 поиск, $6 id текущего пользователя (для отметки «решено»),
# $7 limit, $8 offset, $9 тип источника. NULL — без фильтра.
LIST_TASKS = f"""
SELECT {TASK_PUBLIC_COLUMNS},
       EXISTS (SELECT 1 FROM attempts a
               WHERE a.task_id = k.id AND a.student_id = $6 AND a.status IN ('correct', 'graded')
                 AND COALESCE(a.teacher_grade, a.system_grade, 0) >= 50) AS solved
{TASK_FROM}
WHERE k.is_active
  AND ($1::bigint IS NULL OR k.theme_id = $1)
  AND ($2::bigint IS NULL OR t.subject_id = $2)
  AND ($3::bigint IS NULL OR k.author_id = $3)
  AND ($4::smallint IS NULL OR k.difficulty = $4)
  AND ($5::text IS NULL OR k.title ILIKE '%' || $5 || '%' OR k.condition ILIKE '%' || $5 || '%'
       OR k.source_title ILIKE '%' || $5 || '%' OR k.translations::text ILIKE '%' || $5 || '%')
  AND ($9::text IS NULL OR k.source_type = $9)
ORDER BY t.position, k.difficulty, k.id
LIMIT $7 OFFSET $8
"""

GET_TASK_PUBLIC = f"""
SELECT {TASK_PUBLIC_COLUMNS},
       EXISTS (SELECT 1 FROM attempts a
               WHERE a.task_id = k.id AND a.student_id = $2 AND a.status IN ('correct', 'graded')
                 AND COALESCE(a.teacher_grade, a.system_grade, 0) >= 50) AS solved
{TASK_FROM}
WHERE k.id = $1 AND k.is_active
"""

GET_TASK_FULL = f"""
SELECT {TASK_PUBLIC_COLUMNS}, k.answer, k.tolerance, FALSE AS solved
{TASK_FROM}
WHERE k.id = $1 AND k.is_active
"""

INSERT_TASK = """
INSERT INTO tasks (theme_id, author_id, title, condition, difficulty, check_mode, answer_type, answer, unit, tolerance,
                   source_type, source_title, source_year, source_number, translations)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
RETURNING id
"""

UPDATE_TASK = """
UPDATE tasks
SET theme_id = $2, title = $3, condition = $4, difficulty = $5, check_mode = $6,
    answer_type = $7, answer = $8, unit = $9, tolerance = $10,
    source_type = $11, source_title = $12, source_year = $13, source_number = $14,
    translations = $15::jsonb, updated_at = now()
WHERE id = $1 AND is_active
RETURNING id
"""

DEACTIVATE_TASK = "UPDATE tasks SET is_active = FALSE, updated_at = now() WHERE id = $1 AND is_active RETURNING id"

GET_TASK_AUTHOR = "SELECT author_id FROM tasks WHERE id = $1 AND is_active"
