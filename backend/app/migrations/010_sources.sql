-- Каталог источников: книга / сборник / олимпиада / экзамен / авторский сборник.
-- Много задач ссылаются на один источник; у задачи остаётся только номер в источнике.

CREATE TABLE sources (
    id         BIGSERIAL PRIMARY KEY,
    type       TEXT        NOT NULL CHECK (type IN ('book', 'olympiad', 'exam', 'own')),
    title      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    author     TEXT        NOT NULL DEFAULT '' CHECK (char_length(author) <= 120),
    year       SMALLINT CHECK (year BETWEEN 1800 AND 2100),
    created_by BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Один и тот же источник (название + год) не заводится дважды.
CREATE UNIQUE INDEX sources_title_year_uq ON sources (lower(title), COALESCE(year, 0));

ALTER TABLE tasks
    ADD COLUMN source_id   BIGINT REFERENCES sources (id) ON DELETE SET NULL,
    ADD COLUMN is_original BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX tasks_source_idx ON tasks (source_id);

-- Переносим старые текстовые источники в каталог.
INSERT INTO sources (type, title, year, created_by)
SELECT DISTINCT ON (lower(trim(source_title)), COALESCE(source_year, 0))
       source_type, trim(source_title), source_year, author_id
FROM tasks
WHERE source_type IS NOT NULL AND COALESCE(trim(source_title), '') <> ''
ORDER BY lower(trim(source_title)), COALESCE(source_year, 0), id;

UPDATE tasks k
SET source_id = s.id
FROM sources s
WHERE COALESCE(trim(k.source_title), '') <> ''
  AND lower(s.title) = lower(trim(k.source_title))
  AND COALESCE(s.year, 0) = COALESCE(k.source_year, 0);

UPDATE tasks SET is_original = TRUE WHERE source_type = 'own' AND source_id IS NULL;

ALTER TABLE tasks
    DROP COLUMN source_type,
    DROP COLUMN source_title,
    DROP COLUMN source_year;
