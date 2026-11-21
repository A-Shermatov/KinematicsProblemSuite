"""SQL для пользователей. Плейсхолдеры $1, $2… — нативный синтаксис PostgreSQL/asyncpg."""

USER_COLUMNS = """
id, username, first_name, last_name, role, is_active, avatar_path, country_code, region_id,
(SELECT r.name FROM regions r WHERE r.id = users.region_id) AS region_name, city, school, created_at
"""

GET_BY_ID = f"SELECT {USER_COLUMNS} FROM users WHERE id = $1"

GET_ACTIVE_BY_ID = f"SELECT {USER_COLUMNS} FROM users WHERE id = $1 AND is_active"

GET_AUTH_BY_USERNAME = f"""
SELECT {USER_COLUMNS}, password_hash
FROM users
WHERE lower(username) = lower($1)
"""

USERNAME_TAKEN = """
SELECT EXISTS (SELECT 1 FROM users WHERE lower(username) = lower($1) AND id <> COALESCE($2::bigint, 0))
"""

INSERT = f"""
INSERT INTO users (username, first_name, last_name, password_hash, role, city, school, country_code, region_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'TJ'), $9)
RETURNING {USER_COLUMNS}
"""

UPDATE_PROFILE = f"""
UPDATE users
SET username = $2, first_name = $3, last_name = $4, city = $5, school = $6, country_code = $7, region_id = $8,
    updated_at = now()
WHERE id = $1
RETURNING {USER_COLUMNS}
"""

UPDATE_PASSWORD = "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1"

UPDATE_AVATAR = f"""
UPDATE users SET avatar_path = $2, updated_at = now()
WHERE id = $1
RETURNING {USER_COLUMNS}
"""

SET_ACTIVE = f"""
UPDATE users SET is_active = $2, updated_at = now()
WHERE id = $1
RETURNING {USER_COLUMNS}
"""

SET_ROLE = f"""
UPDATE users SET role = $2, updated_at = now()
WHERE id = $1
RETURNING {USER_COLUMNS}
"""

# Фильтры необязательные: NULL означает «без фильтра».
LIST = f"""
SELECT {USER_COLUMNS}
FROM users
WHERE ($1::text IS NULL OR role = $1)
  AND ($2::text IS NULL OR username ILIKE '%' || $2 || '%'
       OR first_name ILIKE '%' || $2 || '%' OR last_name ILIKE '%' || $2 || '%')
ORDER BY created_at DESC
LIMIT $3 OFFSET $4
"""

ADMIN_EXISTS = "SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin')"

# Область должна быть из выбранной страны.
REGION_COUNTRY = "SELECT country_code FROM regions WHERE id = $1"
