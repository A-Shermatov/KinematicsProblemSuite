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
k.source_id, COALESCE(src.type, CASE WHEN k.is_original THEN 'own' END) AS source_type,
src.title AS source_title, src.year AS source_year, COALESCE(src.author, '') AS source_author, k.source_number,
k.is_original, k.duplicate_of, k.created_at, k.updated_at, k.translations, k.params
"""

TASK_FROM = """
FROM tasks k
JOIN themes t ON t.id = k.theme_id
JOIN subjects s ON s.id = t.subject_id
JOIN users u ON u.id = k.author_id
LEFT JOIN sources src ON src.id = k.source_id
"""

# $1 theme_id, $2 subject_id, $3 author_id, $4 difficulty, $5 поиск, $6 id текущего пользователя (для отметки «решено»),
# $7 limit, $8 offset, $9 тип источника, $10 id источника. NULL — без фильтра.
_SOLVED_BY_VIEWER = """SELECT 1 FROM attempts a
               WHERE a.task_id = k.id AND a.student_id = $6 AND a.status IN ('correct', 'graded')
                 AND COALESCE(a.teacher_grade, a.system_grade, 0) >= 50"""

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
       OR src.title ILIKE '%' || $5 || '%' OR k.translations::text ILIKE '%' || $5 || '%')
  AND ($9::text IS NULL OR COALESCE(src.type, CASE WHEN k.is_original THEN 'own' END) = $9)
  AND ($10::bigint IS NULL OR k.source_id = $10)
  -- $11 прогресс ученика $6: solved — решённые, unsolved — пробовал, но не решил, new — ещё не пробовал.
  AND ($11::text IS NULL OR CASE $11
        WHEN 'solved' THEN EXISTS ({_SOLVED_BY_VIEWER})
        WHEN 'unsolved' THEN EXISTS (SELECT 1 FROM attempts a WHERE a.task_id = k.id AND a.student_id = $6)
                             AND NOT EXISTS ({_SOLVED_BY_VIEWER})
        ELSE NOT EXISTS (SELECT 1 FROM attempts a WHERE a.task_id = k.id AND a.student_id = $6)
      END)
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
SELECT {TASK_PUBLIC_COLUMNS}, k.answer, k.tolerance, FALSE AS solved, k.hints, k.explanation, k.mistakes,
       k.answer_formula
{TASK_FROM}
WHERE k.id = $1 AND k.is_active
"""

INSERT_TASK = """
INSERT INTO tasks (theme_id, author_id, title, condition, difficulty, check_mode, answer_type, answer, unit, tolerance,
                   source_id, source_number, is_original, translations, hints, explanation, mistakes,
                   params, answer_formula)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17::jsonb,
        $18::jsonb, $19)
RETURNING id
"""

UPDATE_TASK = """
UPDATE tasks
SET theme_id = $2, title = $3, condition = $4, difficulty = $5, check_mode = $6,
    answer_type = $7, answer = $8, unit = $9, tolerance = $10,
    source_id = $11, source_number = $12, is_original = $13,
    translations = $14::jsonb, hints = $15::jsonb, explanation = $16, mistakes = $17::jsonb,
    params = $18::jsonb, answer_formula = $19, updated_at = now()
WHERE id = $1 AND is_active
RETURNING id
"""

DEACTIVATE_TASK = "UPDATE tasks SET is_active = FALSE, updated_at = now() WHERE id = $1 AND is_active RETURNING id"

GET_TASK_AUTHOR = "SELECT author_id FROM tasks WHERE id = $1 AND is_active"

# ---------- Дубликаты ----------

# Точные дубли (тот же нормализованный ключ, см. миграцию 011) и похожие по триграммам.
# $1 название, $2 условие, $3 id задачи, которую редактируют (её не считаем), $4 порог похожести, $5 limit
FIND_DUPLICATES = """
WITH probe AS (SELECT task_text_key($1, $2) AS key)
SELECT k.id, k.title, k.author_id, trim(u.first_name || ' ' || u.last_name) AS author_name, t.title AS theme_title,
       (k.condition_key = probe.key) AS exact, similarity(k.condition_key, probe.key)::float AS similarity
FROM tasks k
CROSS JOIN probe
JOIN users u ON u.id = k.author_id
JOIN themes t ON t.id = k.theme_id
WHERE k.is_active
  AND ($3::bigint IS NULL OR k.id <> $3)
  AND (k.condition_key = probe.key OR (k.condition_key % probe.key AND similarity(k.condition_key, probe.key) >= $4))
ORDER BY exact DESC, similarity DESC, k.id
LIMIT $5
"""


# ---------- Источники ----------

SOURCE_COLUMNS = """
src.id, src.type, src.title, src.author, src.year, src.created_by, src.created_at,
(SELECT count(*) FROM tasks k WHERE k.source_id = src.id AND k.is_active)::int AS tasks_count
"""

# $1 поиск, $2 тип, $3 limit
LIST_SOURCES = f"""
SELECT {SOURCE_COLUMNS}
FROM sources src
WHERE ($1::text IS NULL OR src.title ILIKE '%' || $1 || '%' OR src.author ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR src.type = $2)
ORDER BY tasks_count DESC, lower(src.title), src.year NULLS LAST
LIMIT $3
"""

GET_SOURCE = f"SELECT {SOURCE_COLUMNS} FROM sources src WHERE src.id = $1"

FIND_SOURCE = "SELECT id FROM sources WHERE lower(title) = lower($1) AND COALESCE(year, 0) = COALESCE($2::smallint, 0)"

INSERT_SOURCE = """
INSERT INTO sources (type, title, author, year, created_by) VALUES ($1, $2, $3, $4, $5)
ON CONFLICT DO NOTHING
RETURNING id
"""

UPDATE_SOURCE = """
UPDATE sources SET type = $2, title = $3, author = $4, year = $5, updated_at = now() WHERE id = $1 RETURNING id
"""

SOURCE_EXISTS = "SELECT EXISTS (SELECT 1 FROM sources WHERE id = $1)"

# Задачи других авторов в источнике: создатель источника может править его, только пока он «свой».
SOURCE_FOREIGN_TASKS = "SELECT EXISTS (SELECT 1 FROM tasks WHERE source_id = $1 AND author_id <> $2 AND is_active)"

MERGE_SOURCE = "UPDATE tasks SET source_id = $2, updated_at = now() WHERE source_id = $1"

DELETE_SOURCE = "DELETE FROM sources WHERE id = $1 RETURNING id"


# ---------- Подсказки и разбор ----------

# $1 задача, $2 ученик (может быть NULL)
TASK_HELP = """
SELECT k.id, k.author_id, k.difficulty, k.hints, k.explanation,
       (SELECT count(*) FROM task_hint_opens h WHERE h.task_id = k.id AND h.user_id = $2)::int AS opened,
       EXISTS (SELECT 1 FROM attempts a WHERE a.task_id = k.id AND a.student_id = $2
               AND a.status IN ('correct', 'graded') AND COALESCE(a.teacher_grade, a.system_grade, 0) >= 50) AS solved,
       (SELECT count(*) FROM attempts a
        WHERE a.task_id = k.id AND a.student_id = $2 AND a.status = 'incorrect')::int AS wrong_attempts
FROM tasks k
WHERE k.id = $1 AND k.is_active
"""

OPEN_HINT = """
INSERT INTO task_hint_opens (task_id, user_id, hint_index) VALUES ($1, $2, $3)
ON CONFLICT DO NOTHING
"""


# Задачи по списку id (для подборок). $1 — массив id, $2 — ученик для отметки «решено».
TASKS_BY_IDS = f"""
SELECT {TASK_PUBLIC_COLUMNS},
       EXISTS (SELECT 1 FROM attempts a
               WHERE a.task_id = k.id AND a.student_id = $2 AND a.status IN ('correct', 'graded')
                 AND COALESCE(a.teacher_grade, a.system_grade, 0) >= 50) AS solved
{TASK_FROM}
WHERE k.is_active AND k.id = ANY($1::bigint[])
"""
