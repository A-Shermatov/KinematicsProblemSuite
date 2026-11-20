"""SQL для профилей учителей, сертификатов и отзывов."""

# Рейтинг и счётчики считаются по видимым отзывам и активным задачам.
_TEACHER_STATS = """
(SELECT round(avg(r.rating)::numeric, 2) FROM reviews r WHERE r.teacher_id = u.id AND NOT r.is_hidden) AS rating,
(SELECT count(*) FROM reviews r WHERE r.teacher_id = u.id AND NOT r.is_hidden) AS reviews_count,
(SELECT count(*) FROM tasks k WHERE k.author_id = u.id AND k.is_active) AS tasks_count,
(SELECT count(*) FROM certificates c WHERE c.teacher_id = u.id AND c.status = 'verified') AS verified_certificates,
COALESCE((SELECT array_agg(s.title ORDER BY s.position, s.id)
          FROM teacher_subjects ts JOIN subjects s ON s.id = ts.subject_id AND s.is_active
          WHERE ts.user_id = u.id), '{}') AS subjects
"""

# $1 subject_id, $2 поиск, $3 сортировка ('rating' | 'tasks' | 'new'), $4 limit, $5 offset.
LIST_TEACHERS = f"""
SELECT * FROM (
    SELECT u.id, u.username, u.first_name, u.last_name, u.avatar_path, u.created_at,
           COALESCE(p.headline, '') AS headline, p.experience_years,
           {_TEACHER_STATS}
    FROM users u
    LEFT JOIN teacher_profiles p ON p.user_id = u.id
    WHERE u.role = 'teacher' AND u.is_active
      AND ($1::bigint IS NULL OR EXISTS (
          SELECT 1 FROM teacher_subjects ts WHERE ts.user_id = u.id AND ts.subject_id = $1))
      AND ($2::text IS NULL OR u.first_name ILIKE '%' || $2 || '%' OR u.last_name ILIKE '%' || $2 || '%'
           OR p.headline ILIKE '%' || $2 || '%')
) t
ORDER BY
    CASE WHEN $3::text = 'rating' THEN COALESCE(t.rating, 0) END DESC,
    CASE WHEN $3::text = 'rating' THEN t.reviews_count END DESC,
    CASE WHEN $3::text = 'tasks' THEN t.tasks_count END DESC,
    t.created_at DESC
LIMIT $4 OFFSET $5
"""

GET_TEACHER = f"""
SELECT u.id, u.username, u.first_name, u.last_name, u.avatar_path, u.created_at,
       COALESCE(p.headline, '') AS headline, COALESCE(p.bio, '') AS bio, p.experience_years,
       ARRAY(SELECT ts.subject_id FROM teacher_subjects ts
             WHERE ts.user_id = u.id ORDER BY ts.subject_id) AS subject_ids,
       (SELECT count(DISTINCT a.student_id) FROM attempts a JOIN tasks k ON k.id = a.task_id
        WHERE k.author_id = u.id) AS students_count,
       (SELECT count(*) FROM attempts a JOIN tasks k ON k.id = a.task_id WHERE k.author_id = u.id) AS attempts_count,
       {_TEACHER_STATS}
FROM users u
LEFT JOIN teacher_profiles p ON p.user_id = u.id
WHERE u.id = $1 AND u.role = 'teacher' AND u.is_active
"""

RATING_DISTRIBUTION = """
SELECT rating, count(*) AS count FROM reviews
WHERE teacher_id = $1 AND NOT is_hidden
GROUP BY rating
"""

UPSERT_PROFILE = """
INSERT INTO teacher_profiles (user_id, headline, bio, experience_years)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id) DO UPDATE
SET headline = EXCLUDED.headline, bio = EXCLUDED.bio, experience_years = EXCLUDED.experience_years, updated_at = now()
"""

CLEAR_SUBJECTS = "DELETE FROM teacher_subjects WHERE user_id = $1"

# Неизвестные или удалённые предметы молча пропускаются.
SET_SUBJECTS = """
INSERT INTO teacher_subjects (user_id, subject_id)
SELECT $1, s.id FROM subjects s WHERE s.id = ANY($2::bigint[]) AND s.is_active
ON CONFLICT DO NOTHING
"""

# ---------- Сертификаты ----------

CERTIFICATE_COLUMNS = """
c.id, c.teacher_id, trim(u.first_name || ' ' || u.last_name) AS teacher_name, c.title, c.issuer, c.year,
c.file_path, c.status, c.reject_reason, c.reviewed_at, c.created_at
"""

LIST_CERTIFICATES = f"""
SELECT {CERTIFICATE_COLUMNS}
FROM certificates c JOIN users u ON u.id = c.teacher_id
WHERE c.teacher_id = $1 AND ($2::bool OR c.status = 'verified')
ORDER BY c.year DESC NULLS LAST, c.created_at DESC
"""

ADMIN_LIST_CERTIFICATES = f"""
SELECT {CERTIFICATE_COLUMNS}
FROM certificates c JOIN users u ON u.id = c.teacher_id
WHERE ($1::text IS NULL OR c.status = $1)
ORDER BY c.created_at
LIMIT $2 OFFSET $3
"""

GET_CERTIFICATE = f"""
SELECT {CERTIFICATE_COLUMNS}
FROM certificates c JOIN users u ON u.id = c.teacher_id
WHERE c.id = $1
"""

INSERT_CERTIFICATE = """
INSERT INTO certificates (teacher_id, title, issuer, year, file_path)
VALUES ($1, $2, $3, $4, $5)
RETURNING id
"""

DELETE_CERTIFICATE = "DELETE FROM certificates WHERE id = $1 AND teacher_id = $2 RETURNING file_path"

REVIEW_CERTIFICATE = """
UPDATE certificates
SET status = $2, reject_reason = $3, reviewed_by = $4, reviewed_at = now()
WHERE id = $1
RETURNING id
"""

# ---------- Отзывы ----------

REVIEW_COLUMNS = """
r.id, r.teacher_id, trim(t.first_name || ' ' || t.last_name) AS teacher_name,
r.student_id, s.username AS student_username, trim(s.first_name || ' ' || s.last_name) AS student_name,
s.avatar_path AS student_avatar_path,
r.rating, r.text, r.reply, r.replied_at, r.is_hidden, r.created_at, r.updated_at
"""

REVIEW_FROM = """
FROM reviews r
JOIN users t ON t.id = r.teacher_id
JOIN users s ON s.id = r.student_id
"""

LIST_REVIEWS = f"""
SELECT {REVIEW_COLUMNS}
{REVIEW_FROM}
WHERE r.teacher_id = $1 AND NOT r.is_hidden
ORDER BY r.created_at DESC
LIMIT $2 OFFSET $3
"""

ADMIN_LIST_REVIEWS = f"""
SELECT {REVIEW_COLUMNS}
{REVIEW_FROM}
WHERE ($1::bool IS NULL OR r.is_hidden = $1)
ORDER BY r.created_at DESC
LIMIT $2 OFFSET $3
"""

GET_REVIEW = f"""
SELECT {REVIEW_COLUMNS}
{REVIEW_FROM}
WHERE r.id = $1
"""

GET_MY_REVIEW = f"""
SELECT {REVIEW_COLUMNS}
{REVIEW_FROM}
WHERE r.teacher_id = $1 AND r.student_id = $2
"""

# Отзыв может оставить ученик, который отправлял решения задач этого учителя.
CAN_REVIEW = """
SELECT EXISTS (
    SELECT 1 FROM attempts a JOIN tasks k ON k.id = a.task_id
    WHERE k.author_id = $1 AND a.student_id = $2
)
"""

UPSERT_REVIEW = """
INSERT INTO reviews (teacher_id, student_id, rating, text)
VALUES ($1, $2, $3, $4)
ON CONFLICT (teacher_id, student_id) DO UPDATE
SET rating = EXCLUDED.rating, text = EXCLUDED.text, updated_at = now()
RETURNING id
"""

DELETE_REVIEW = "DELETE FROM reviews WHERE teacher_id = $1 AND student_id = $2 RETURNING id"

REPLY_REVIEW = """
UPDATE reviews SET reply = $3, replied_at = CASE WHEN $3 = '' THEN NULL ELSE now() END
WHERE id = $1 AND teacher_id = $2
RETURNING id
"""

SET_REVIEW_HIDDEN = "UPDATE reviews SET is_hidden = $2 WHERE id = $1 RETURNING id"

IS_ACTIVE_TEACHER = "SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND role = 'teacher' AND is_active)"
