"""SQL справочника мест."""

REGIONS = """
SELECT r.id, r.country_code, r.name, r.position,
       COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY c.name)
                FILTER (WHERE c.id IS NOT NULL), '[]')::text AS cities
FROM regions r
LEFT JOIN cities c ON c.region_id = r.id
WHERE r.country_code = $1
GROUP BY r.id
ORDER BY r.position, r.name
"""

# Страны, для которых в справочнике есть области.
COUNTRIES_WITH_REGIONS = "SELECT DISTINCT country_code FROM regions ORDER BY country_code"

GET_REGION = "SELECT id, country_code, name, position FROM regions WHERE id = $1"
INSERT_REGION = "INSERT INTO regions (country_code, name, position) VALUES ($1, $2, $3) RETURNING id"
UPDATE_REGION = "UPDATE regions SET name = $2, position = $3 WHERE id = $1 RETURNING id"
DELETE_REGION = "DELETE FROM regions WHERE id = $1 RETURNING id"
INSERT_CITY = "INSERT INTO cities (region_id, name) VALUES ($1, $2) RETURNING id"
DELETE_CITY = "DELETE FROM cities WHERE id = $1 RETURNING id"
