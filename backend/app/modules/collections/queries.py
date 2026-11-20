# Подборки задач. Число задач и прогресс зрителя считаются по активным задачам.

_COLUMNS = """
c.id, c.title, c.description, c.author_id, c.is_public, c.created_at, c.updated_at,
trim(u.first_name || ' ' || u.last_name) AS author_name,
(SELECT count(*) FROM collection_tasks ct JOIN tasks k ON k.id = ct.task_id AND k.is_active
 WHERE ct.collection_id = c.id)::int AS tasks_count,
(SELECT count(DISTINCT ct.task_id) FROM collection_tasks ct
 JOIN tasks k ON k.id = ct.task_id AND k.is_active
 JOIN attempts a ON a.task_id = ct.task_id AND a.student_id = $1
      AND a.status IN ('correct', 'graded') AND COALESCE(a.teacher_grade, a.system_grade, 0) >= 50
 WHERE ct.collection_id = c.id)::int AS solved_count
"""

# $1 зритель (для прогресса), $2 автор-фильтр, $3 поиск, $4 только мои (включая скрытые)
LIST = f"""
SELECT {_COLUMNS}
FROM collections c
JOIN users u ON u.id = c.author_id
WHERE (c.is_public OR c.author_id = $1)
  AND ($2::bigint IS NULL OR c.author_id = $2)
  AND ($3::text IS NULL OR c.title ILIKE '%' || $3 || '%' OR c.description ILIKE '%' || $3 || '%')
  AND (NOT $4 OR c.author_id = $1)
ORDER BY c.updated_at DESC
LIMIT 200
"""

GET = f"""
SELECT {_COLUMNS}
FROM collections c
JOIN users u ON u.id = c.author_id
WHERE c.id = $2
"""

TASK_IDS = "SELECT task_id FROM collection_tasks WHERE collection_id = $1 ORDER BY position"

INSERT = """
INSERT INTO collections (title, description, author_id, is_public) VALUES ($1, $2, $3, $4) RETURNING id
"""

UPDATE = """
UPDATE collections SET title = $2, description = $3, is_public = $4, updated_at = now() WHERE id = $1
"""

CLEAR_TASKS = "DELETE FROM collection_tasks WHERE collection_id = $1"

# $1 подборка, $2 массив id задач по порядку
SET_TASKS = """
INSERT INTO collection_tasks (collection_id, task_id, position)
SELECT $1, id, ord::smallint
FROM unnest($2::bigint[]) WITH ORDINALITY AS x(id, ord)
"""

EXISTING_TASKS = "SELECT id FROM tasks WHERE id = ANY($1::bigint[]) AND is_active"

DELETE = "DELETE FROM collections WHERE id = $1"
