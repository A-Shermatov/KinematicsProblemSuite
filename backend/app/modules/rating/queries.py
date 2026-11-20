"""SQL рейтинга олимпиадника."""

# Текущий рейтинг — после последней по времени окончания олимпиады.
_CURRENT = """
current AS (
    SELECT DISTINCT ON (rc.user_id) rc.user_id, rc.new_rating AS rating
    FROM rating_changes rc
    JOIN olympiads o ON o.id = rc.olympiad_id
    ORDER BY rc.user_id, o.ends_at DESC, o.id DESC
)"""

CURRENT_RATINGS = f"""
WITH {_CURRENT}
SELECT user_id, rating FROM current WHERE user_id = ANY($1::bigint[])
"""

LOCK = "SELECT pg_advisory_xact_lock(727274)"

PENDING = """
SELECT id FROM olympiads
WHERE results_published AND rated_at IS NULL AND status = 'published'
ORDER BY ends_at, id
"""

INSERT_CHANGE = """
INSERT INTO rating_changes (olympiad_id, user_id, place, total, old_rating, new_rating)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (olympiad_id, user_id) DO NOTHING
"""

MARK_RATED = "UPDATE olympiads SET rated_at = now() WHERE id = $1"

RESET = """
WITH cleared AS (DELETE FROM rating_changes RETURNING 1)
UPDATE olympiads SET rated_at = NULL WHERE rated_at IS NOT NULL
"""

HISTORY = """
SELECT rc.olympiad_id, o.title, o.ends_at, rc.place, rc.total, rc.old_rating, rc.new_rating,
       (SELECT count(*) FROM rating_changes x WHERE x.olympiad_id = rc.olympiad_id)::int AS participants
FROM rating_changes rc
JOIN olympiads o ON o.id = rc.olympiad_id
WHERE rc.user_id = $1
ORDER BY o.ends_at, o.id
"""

CHANGES_COUNT = "SELECT count(*) FROM rating_changes WHERE user_id = $1"

OLYMPIAD_CHANGES = "SELECT user_id, old_rating, new_rating FROM rating_changes WHERE olympiad_id = $1"

LEADERBOARD = f"""
WITH {_CURRENT},
counts AS (
    SELECT user_id, count(*)::int AS olympiads, max(new_rating) AS max_rating,
           count(*) FILTER (WHERE place = 1 AND total > 0)::int AS gold,
           count(*) FILTER (WHERE place = 2 AND total > 0)::int AS silver,
           count(*) FILTER (WHERE place = 3 AND total > 0)::int AS bronze
    FROM rating_changes GROUP BY user_id
)
SELECT u.id AS user_id, u.username, trim(u.first_name || ' ' || u.last_name) AS name, u.avatar_path,
       u.city, u.school, c.rating, k.max_rating, k.olympiads, k.gold, k.silver, k.bronze
FROM current c
JOIN counts k USING (user_id)
JOIN users u ON u.id = c.user_id AND u.is_active
WHERE ($2::text IS NULL OR lower(u.city) = lower($2))
ORDER BY c.rating DESC, k.max_rating DESC, u.id
LIMIT $1
"""
