"""SQL для refresh-токенов."""

INSERT_REFRESH = """
INSERT INTO refresh_tokens (user_id, jti, expires_at)
VALUES ($1, $2::uuid, $3)
"""

# Атомарно «погасить» refresh-токен: вернёт строку, только если токен был живой.
REVOKE_IF_VALID = """
UPDATE refresh_tokens
SET revoked_at = now()
WHERE jti = $1::uuid AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()
RETURNING id
"""

REVOKE = "UPDATE refresh_tokens SET revoked_at = now() WHERE jti = $1::uuid AND revoked_at IS NULL"

REVOKE_ALL_FOR_USER = "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL"

DELETE_EXPIRED = "DELETE FROM refresh_tokens WHERE expires_at < now() - interval '1 day'"
