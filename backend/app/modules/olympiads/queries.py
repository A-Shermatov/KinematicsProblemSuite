"""SQL для олимпиад."""

# Этап считается из времени: до начала, идёт, проверка, итоги опубликованы.
PHASE = """
CASE WHEN now() < o.starts_at THEN 'upcoming'
     WHEN now() < o.ends_at THEN 'running'
     WHEN NOT o.results_published THEN 'checking'
     ELSE 'finished' END
"""

# Разбор открывается через сутки после окончания олимпиады.
EDITORIAL_DELAY = "interval '24 hours'"

# $viewer — параметр с id текущего пользователя (или NULL), подставляется в каждом запросе.
_COLUMNS = f"""
o.id, o.title, o.description, o.subject_id, s.title AS subject_title,
o.level_id, lv.title AS level_title, lv.min_rating AS level_min_rating, lv.max_rating AS level_max_rating,
o.organizer_id, trim(u.first_name || ' ' || u.last_name) AS organizer_name,
o.starts_at, o.ends_at, o.status, o.reject_reason, o.results_published, o.created_at,
{PHASE} AS phase,
o.ends_at + {EDITORIAL_DELAY} AS editorial_at,
(o.editorial <> '' OR EXISTS (SELECT 1 FROM olympiad_tasks et WHERE et.olympiad_id = o.id AND et.solution <> ''))
    AS has_editorial,
(SELECT count(*) FROM olympiad_participants p WHERE p.olympiad_id = o.id) AS participants_count,
(SELECT count(*) FROM olympiad_tasks t WHERE t.olympiad_id = o.id) AS tasks_count,
(SELECT COALESCE(sum(t.max_points), 0) FROM olympiad_tasks t WHERE t.olympiad_id = o.id)::int AS max_score
"""

_FROM = """
FROM olympiads o
JOIN users u ON u.id = o.organizer_id
LEFT JOIN subjects s ON s.id = o.subject_id
LEFT JOIN olympiad_levels lv ON lv.id = o.level_id
"""

_VIEWER = """
EXISTS (SELECT 1 FROM olympiad_participants p WHERE p.olympiad_id = o.id AND p.user_id = $2) AS is_registered,
(SELECT p.official FROM olympiad_participants p WHERE p.olympiad_id = o.id AND p.user_id = $2) AS is_official,
EXISTS (SELECT 1 FROM olympiad_jury j WHERE j.olympiad_id = o.id AND j.user_id = $2) AS is_jury
"""

# $1 этап (NULL — все), $2 id зрителя, $3 уровень (NULL — все).
LIST_PUBLISHED = f"""
SELECT * FROM (
    SELECT {_COLUMNS}, {_VIEWER}
    {_FROM}
    WHERE o.status = 'published' AND ($3::bigint IS NULL OR o.level_id = $3)
) x
WHERE ($1::text IS NULL OR x.phase = $1)
ORDER BY CASE WHEN x.ends_at > now() THEN x.starts_at END ASC NULLS LAST, x.starts_at DESC
LIMIT 100
"""

# Олимпиады учителя: свои и те, где он в жюри.
LIST_BY_ORGANIZER = f"""
SELECT {_COLUMNS}, FALSE AS is_registered, NULL::boolean AS is_official,
       EXISTS (SELECT 1 FROM olympiad_jury j WHERE j.olympiad_id = o.id AND j.user_id = $1) AS is_jury
{_FROM}
WHERE o.organizer_id = $1 OR EXISTS (SELECT 1 FROM olympiad_jury j WHERE j.olympiad_id = o.id AND j.user_id = $1)
ORDER BY o.starts_at DESC
"""

ADMIN_LIST = f"""
SELECT {_COLUMNS}, FALSE AS is_registered, NULL::boolean AS is_official, FALSE AS is_jury
{_FROM}
WHERE ($1::text IS NULL OR o.status = $1)
ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.starts_at DESC
LIMIT 200
"""

GET = f"""
SELECT {_COLUMNS}, {_VIEWER}
{_FROM}
WHERE o.id = $1
"""

INSERT = """
INSERT INTO olympiads (title, description, subject_id, organizer_id, starts_at, ends_at, level_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id
"""

# Редактировать можно только черновик или отклонённую. После правки отклонённая снова становится черновиком.
UPDATE = """
UPDATE olympiads
SET title = $2, description = $3, subject_id = $4, starts_at = $5, ends_at = $6, level_id = $7,
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

# Досрочное завершение: олимпиада заканчивается сейчас, дальше — проверка жюри.
FINISH_EARLY = """
UPDATE olympiads SET ends_at = now(), updated_at = now()
WHERE id = $1 AND status = 'published' AND starts_at <= now() AND now() < ends_at
RETURNING id
"""

PUBLISH_RESULTS = """
UPDATE olympiads SET results_published = TRUE, updated_at = now()
WHERE id = $1 AND status = 'published' AND ends_at <= now()
RETURNING id
"""

# ---------- Задачи ----------

TASK_COLUMNS = """
ot.id, ot.olympiad_id, ot.position, ot.title, ot.condition, ot.answer_type, ot.answer, ot.unit, ot.tolerance,
ot.max_points, ot.translations, ot.difficulty, ot.source_id, ot.source_number, ot.is_original,
src.type AS source_type, src.title AS source_title, src.year AS source_year, src.author AS source_author
"""

_TASK_FROM = "FROM olympiad_tasks ot LEFT JOIN sources src ON src.id = ot.source_id"

LIST_TASKS = f"SELECT {TASK_COLUMNS} {_TASK_FROM} WHERE ot.olympiad_id = $1 ORDER BY ot.position, ot.id"

GET_TASK = f"SELECT {TASK_COLUMNS} {_TASK_FROM} WHERE ot.id = $1 AND ot.olympiad_id = $2"

INSERT_TASK = """
INSERT INTO olympiad_tasks (olympiad_id, position, title, condition, answer_type, answer, unit, tolerance, max_points,
                            translations, difficulty, source_id, source_number, is_original)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)
RETURNING id
"""

UPDATE_TASK = """
UPDATE olympiad_tasks
SET position = $3, title = $4, condition = $5, answer_type = $6, answer = $7, unit = $8, tolerance = $9,
    max_points = $10, translations = $11::jsonb, difficulty = $12, source_id = $13, source_number = $14,
    is_original = $15
WHERE id = $1 AND olympiad_id = $2
RETURNING id
"""

# Перепроверка после исправления ответа: новые баллы автопроверки (балл жюри остаётся).
TASK_SUBMISSIONS = "SELECT id, answer FROM olympiad_submissions WHERE task_id = $1"
REJUDGE = "UPDATE olympiad_submissions SET auto_correct = $2, auto_points = $3 WHERE id = $1"

# ---------- Разбор ----------

GET_EDITORIAL = "SELECT editorial FROM olympiads WHERE id = $1"
EDITORIAL_TASKS = (
    "SELECT id, title, translations, answer, unit, max_points, solution FROM olympiad_tasks "
    "WHERE olympiad_id = $1 ORDER BY position, id"
)
SET_EDITORIAL = "UPDATE olympiads SET editorial = $2, updated_at = now() WHERE id = $1"
SET_SOLUTION = "UPDATE olympiad_tasks SET solution = $3 WHERE id = $2 AND olympiad_id = $1"

# ---------- Объявления ----------

ANNOUNCEMENT_COLUMNS = "a.id, a.olympiad_id, a.task_id, a.text, a.changes::text AS changes, a.created_at"
LIST_ANNOUNCEMENTS = f"""
SELECT {ANNOUNCEMENT_COLUMNS} FROM olympiad_announcements a
WHERE a.olympiad_id = $1
ORDER BY a.created_at DESC, a.id DESC
"""
INSERT_ANNOUNCEMENT = f"""
INSERT INTO olympiad_announcements AS a (olympiad_id, task_id, text, changes, created_by)
VALUES ($1, $2, $3, $4::jsonb, $5)
RETURNING {ANNOUNCEMENT_COLUMNS}
"""
PARTICIPANT_IDS = "SELECT user_id FROM olympiad_participants WHERE olympiad_id = $1"

DELETE_TASK = "DELETE FROM olympiad_tasks WHERE id = $1 AND olympiad_id = $2 RETURNING id"

# ---------- Участники ----------

REGISTER = """
INSERT INTO olympiad_participants (olympiad_id, user_id, official, rating_at_registration) VALUES ($1, $2, $3, $4)
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


# Повторная отправка заменяет решение и сбрасывает оценку жюри.
UPSERT_SUBMISSION = """
INSERT INTO olympiad_submissions (olympiad_id, task_id, user_id, answer, image_path, auto_correct, auto_points)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (task_id, user_id) DO UPDATE
SET answer = EXCLUDED.answer, image_path = EXCLUDED.image_path, auto_correct = EXCLUDED.auto_correct,
    auto_points = EXCLUDED.auto_points, jury_points = NULL, jury_comment = '', graded_by = NULL,
    graded_at = NULL, submitted_at = now(), attempts = olympiad_submissions.attempts + 1
RETURNING id
"""

INSERT_HISTORY = """
INSERT INTO olympiad_submission_history (olympiad_id, task_id, user_id, answer, auto_correct, image_path, image_sha256,
                                         image_phash, rejected, matched_user_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
"""

# Отпечатки фото других участников этой олимпиады — для проверки на списывание.
OTHER_PHOTOS = """
SELECT user_id, image_sha256, image_phash FROM olympiad_submission_history
WHERE olympiad_id = $1 AND user_id <> $2 AND NOT rejected AND image_sha256 IS NOT NULL
"""

# Попытки: засчитывается последняя не отклонённая по задаче (current). $2 участник (NULL — все), $3 задача,
# $4 только отклонённые (списывание).
HISTORY = """
SELECT h.id, h.task_id, h.user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS user_name,
       h.answer, h.auto_correct, h.submitted_at, h.image_path, h.rejected, h.matched_user_id,
       mu.username AS matched_username, trim(mu.first_name || ' ' || mu.last_name) AS matched_name,
       NOT h.rejected AND h.id = max(h.id) FILTER (WHERE NOT h.rejected) OVER (PARTITION BY h.user_id, h.task_id)
           AS current
FROM olympiad_submission_history h
JOIN users u ON u.id = h.user_id
LEFT JOIN users mu ON mu.id = h.matched_user_id
WHERE h.olympiad_id = $1 AND ($2::bigint IS NULL OR h.user_id = $2) AND ($3::bigint IS NULL OR h.task_id = $3)
  AND (NOT $4::boolean OR h.rejected)
ORDER BY h.submitted_at DESC, h.id DESC
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
# Как на Codeforces: больше баллов — выше; при равных баллах выше тот, кто быстрее.
# Штраф (penalty) — сумма минут от начала олимпиады до последней отправки по задачам, за которые есть баллы.
# Баллы — жюри, если проверено, иначе автопроверка: после проверки жюри места могут поменяться.
POINTS = "COALESCE(sb.jury_points, sb.auto_points)"
MINUTE = "floor(extract(epoch FROM sb.submitted_at - o.starts_at) / 60)::int"
PENALTY = f"COALESCE(sum({MINUTE}) FILTER (WHERE {POINTS} > 0), 0)::int"

RESULTS = f"""
WITH scores AS (
    SELECT sb.user_id, sum({POINTS})::int AS total, {PENALTY} AS penalty,
           jsonb_object_agg(sb.task_id::text, {POINTS}) AS task_points,
           jsonb_object_agg(sb.task_id::text, jsonb_build_object(
               'points', {POINTS}, 'minute', {MINUTE}, 'attempts', sb.attempts,
               'graded', sb.jury_points IS NOT NULL)) AS cells
    FROM olympiad_submissions sb
    JOIN olympiads o ON o.id = sb.olympiad_id
    WHERE sb.olympiad_id = $1
    GROUP BY sb.user_id
),
official AS (
    SELECT sc.*, COALESCE(p.official, TRUE) AS official
    FROM scores sc
    LEFT JOIN olympiad_participants p ON p.olympiad_id = $1 AND p.user_id = sc.user_id
)
-- Место — только среди официальных участников; вне конкурса — place NULL, но в таблице по баллам.
SELECT CASE WHEN sc.official
            THEN RANK() OVER (PARTITION BY sc.official ORDER BY sc.total DESC, sc.penalty) END::int AS place,
       sc.official,
       u.id AS user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS name, u.avatar_path, u.city, u.school,
       sc.total, sc.penalty, sc.task_points::text AS task_points, sc.cells::text AS cells
FROM official sc
JOIN users u ON u.id = sc.user_id
ORDER BY sc.total DESC, sc.penalty, NOT sc.official, u.id
"""

# ---------- Виртуальное участие ----------

RUN_COLUMNS = "r.id, r.olympiad_id, r.user_id, r.started_at, r.ends_at, (now() < r.ends_at) AS active"

GET_RUN = f"SELECT {RUN_COLUMNS} FROM olympiad_virtual_runs r WHERE r.olympiad_id = $1 AND r.user_id = $2"

START_RUN = """
INSERT INTO olympiad_virtual_runs (olympiad_id, user_id, ends_at)
VALUES ($1, $2, now() + $3::interval)
ON CONFLICT (olympiad_id, user_id) DO NOTHING
RETURNING id
"""

FINISH_RUN = "UPDATE olympiad_virtual_runs SET ends_at = now() WHERE id = $1 AND ends_at > now() RETURNING id"

UPSERT_VIRTUAL_SUBMISSION = """
INSERT INTO olympiad_virtual_submissions (run_id, task_id, answer, correct, points)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (run_id, task_id) DO UPDATE
SET answer = EXCLUDED.answer, correct = EXCLUDED.correct, points = EXCLUDED.points, submitted_at = now()
"""

RUN_SUBMISSIONS = """
SELECT vs.task_id, t.title AS task_title, t.position AS task_position, t.max_points,
       vs.answer, vs.correct, vs.points, vs.submitted_at, t.answer AS correct_answer, t.unit AS task_unit
FROM olympiad_virtual_submissions vs
JOIN olympiad_tasks t ON t.id = vs.task_id
WHERE vs.run_id = $1
ORDER BY t.position, t.id
"""

# Место, которое виртуальный участник занял бы среди официальных: 1 + число тех, кто набрал больше.
_OFFICIAL_TOTALS = """
official AS (
    SELECT sb.user_id, sum(COALESCE(sb.jury_points, sb.auto_points)) AS total
    FROM olympiad_submissions sb WHERE sb.olympiad_id = $1
    GROUP BY sb.user_id
)
"""

VIRTUAL_STANDINGS = f"""
WITH {_OFFICIAL_TOTALS},
virtual AS (
    SELECT r.id AS run_id, r.user_id, r.started_at, COALESCE(sum(vs.points), 0)::int AS total
    FROM olympiad_virtual_runs r
    LEFT JOIN olympiad_virtual_submissions vs ON vs.run_id = r.id
    WHERE r.olympiad_id = $1 AND r.ends_at <= now()
    GROUP BY r.id
)
SELECT v.user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS name, u.avatar_path, u.city, u.school,
       v.total, v.started_at,
       (1 + (SELECT count(*) FROM official o WHERE o.total > v.total))::int AS would_place
FROM virtual v
JOIN users u ON u.id = v.user_id
ORDER BY v.total DESC, v.started_at
LIMIT 200
"""

WOULD_PLACE = f"""
WITH {_OFFICIAL_TOTALS}
SELECT (1 + count(*))::int FROM official WHERE total > $2
"""

# ---------- Уровни ----------

LEVEL_COLUMNS = "id, title, description, min_rating, max_rating, position"
LIST_LEVELS = f"SELECT {LEVEL_COLUMNS} FROM olympiad_levels ORDER BY position, id"
GET_LEVEL = f"SELECT {LEVEL_COLUMNS} FROM olympiad_levels WHERE id = $1"
INSERT_LEVEL = f"""
INSERT INTO olympiad_levels (title, description, min_rating, max_rating, position) VALUES ($1, $2, $3, $4, $5)
RETURNING {LEVEL_COLUMNS}
"""
UPDATE_LEVEL = f"""
UPDATE olympiad_levels SET title = $2, description = $3, min_rating = $4, max_rating = $5, position = $6
WHERE id = $1
RETURNING {LEVEL_COLUMNS}
"""
DELETE_LEVEL = "DELETE FROM olympiad_levels WHERE id = $1 RETURNING id"

# ---------- Архив задач олимпиад ----------

# Задачи олимпиад, прошедших на платформе (итоги опубликованы). $1 зритель, $2 предмет, $3 уровень, $4 сложность от,
# $5 сложность до, $6 поиск, $7 прогресс зрителя (solved|unsolved|tried|NULL), $8 сортировка, $9 limit, $10 offset,
# $11 олимпиада.
ARCHIVE = """
WITH numbered AS (
    SELECT ot.*, row_number() OVER (PARTITION BY ot.olympiad_id ORDER BY ot.position, ot.id)::int AS num
    FROM olympiad_tasks ot
),
stats AS (
    SELECT sb.task_id, count(*)::int AS tried,
           count(*) FILTER (WHERE COALESCE(sb.jury_points, sb.auto_points) >= t.max_points)::int AS solved,
           round(100.0 * avg(COALESCE(sb.jury_points, sb.auto_points)) / NULLIF(max(t.max_points), 0))::int
               AS avg_percent
    FROM olympiad_submissions sb
    JOIN olympiad_tasks t ON t.id = sb.task_id
    GROUP BY sb.task_id
),
rows AS (
    SELECT t.id, t.olympiad_id, t.num, t.title, t.translations, t.difficulty, t.max_points, t.source_number,
           t.is_original, src.type AS source_type, src.title AS source_title, src.year AS source_year,
           src.author AS source_author,
           o.title AS olympiad_title, o.starts_at, o.ends_at, o.subject_id, s.title AS subject_title,
           o.level_id, lv.title AS level_title,
           COALESCE(st.tried, 0) AS tried, COALESCE(st.solved, 0) AS solved, st.avg_percent,
           CASE WHEN COALESCE(st.tried, 0) > 0 THEN st.solved::float / st.tried END AS solved_ratio,
           (SELECT COALESCE(sb.jury_points, sb.auto_points) FROM olympiad_submissions sb
            WHERE sb.task_id = t.id AND sb.user_id = $1) AS my_points,
           (SELECT vs.points FROM olympiad_virtual_submissions vs
            JOIN olympiad_virtual_runs r ON r.id = vs.run_id
            WHERE vs.task_id = t.id AND r.user_id = $1 AND now() >= r.ends_at) AS my_virtual_points
    FROM numbered t
    JOIN olympiads o ON o.id = t.olympiad_id AND o.status = 'published' AND o.results_published
    LEFT JOIN subjects s ON s.id = o.subject_id
    LEFT JOIN olympiad_levels lv ON lv.id = o.level_id
    LEFT JOIN sources src ON src.id = t.source_id
    LEFT JOIN stats st ON st.task_id = t.id
    WHERE ($2::bigint IS NULL OR o.subject_id = $2)
      AND ($3::bigint IS NULL OR o.level_id = $3)
      AND ($4::int IS NULL OR t.difficulty >= $4)
      AND ($5::int IS NULL OR t.difficulty <= $5)
      AND ($6::text IS NULL OR t.title ILIKE '%' || $6 || '%' OR o.title ILIKE '%' || $6 || '%'
           OR t.condition ILIKE '%' || $6 || '%')
      AND ($11::bigint IS NULL OR o.id = $11)
)
SELECT *, count(*) OVER ()::int AS total
FROM rows r
WHERE $7::text IS NULL
   OR ($7 = 'solved' AND GREATEST(r.my_points, r.my_virtual_points) >= r.max_points)
   OR ($7 = 'unsolved' AND COALESCE(GREATEST(r.my_points, r.my_virtual_points), 0) < r.max_points)
   OR ($7 = 'tried' AND (r.my_points IS NOT NULL OR r.my_virtual_points IS NOT NULL))
ORDER BY
    CASE WHEN $8 = 'difficulty_asc' THEN r.difficulty END ASC NULLS LAST,
    CASE WHEN $8 = 'difficulty_desc' THEN r.difficulty END DESC NULLS LAST,
    CASE WHEN $8 = 'solved_desc' THEN r.solved_ratio END DESC NULLS LAST,
    CASE WHEN $8 = 'solved_asc' THEN r.solved_ratio END ASC NULLS LAST,
    CASE WHEN $8 = 'old' THEN r.ends_at END ASC,
    r.ends_at DESC, r.olympiad_id DESC, r.num
LIMIT $9 OFFSET $10
"""

# ---------- Состав жюри ----------

JURY_MEMBERS = """
SELECT u.id AS user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS name, u.avatar_path, j.added_at
FROM olympiad_jury j JOIN users u ON u.id = j.user_id
WHERE j.olympiad_id = $1
ORDER BY j.added_at
"""
FIND_TEACHER = "SELECT id, role FROM users WHERE lower(username) = lower($1) AND is_active"
ADD_JURY = "INSERT INTO olympiad_jury (olympiad_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
REMOVE_JURY = "DELETE FROM olympiad_jury WHERE olympiad_id = $1 AND user_id = $2 RETURNING user_id"
