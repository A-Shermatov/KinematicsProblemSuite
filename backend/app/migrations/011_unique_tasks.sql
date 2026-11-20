-- Одна и та же задача не может быть добавлена дважды — ни одним учителем, ни разными.
--
-- Ключ задачи — нормализованное условие: регистр, ё/е, пробелы, знаки препинания, разметка Markdown
-- и пробельные команды LaTeX не важны; «0,5» и «0.5» — одно и то же. Если условие короткое (или пустое),
-- к ключу добавляется название.

CREATE OR REPLACE FUNCTION task_text_norm(value TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    -- 1) регистр, ё → е, десятичная запятая → точка; 2) пробельные команды LaTeX;
    -- 3) точка остаётся только внутри чисел; 4) всё, кроме букв, цифр и знаков формул, убирается.
    SELECT regexp_replace(
               regexp_replace(
                   regexp_replace(
                       regexp_replace(translate(lower(COALESCE(value, '')), 'ёЁ', 'ее'), '(\d),(\d)', '\1.\2', 'g'),
                       '\\(quad|qquad|left|right|displaystyle|text|mathrm|[,;:! ])', '', 'g'),
                   '(?<!\d)\.|\.(?!\d)', '', 'g'),
               '[^0-9a-zа-яәғқҳҷӣӯ+/=^<>.-]+', '', 'g')
$$;

CREATE OR REPLACE FUNCTION task_text_key(title TEXT, condition TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE WHEN char_length(c) >= 20 THEN c ELSE task_text_norm(title) || '|' || c END
    FROM (SELECT task_text_norm(condition) AS c) AS normalized
$$;

ALTER TABLE tasks
    ADD COLUMN condition_key TEXT GENERATED ALWAYS AS (task_text_key(title, condition)) STORED,
    -- Дубликаты, которые уже были в базе до этой миграции: остаются, но отмечены (их видно в админке).
    ADD COLUMN duplicate_of BIGINT REFERENCES tasks (id) ON DELETE SET NULL;

UPDATE tasks k
SET duplicate_of = first.id
FROM (
    SELECT DISTINCT ON (condition_key) id, condition_key
    FROM tasks WHERE is_active
    ORDER BY condition_key, id
) AS first
WHERE k.is_active AND k.condition_key = first.condition_key AND k.id <> first.id;

CREATE UNIQUE INDEX tasks_condition_key_uq ON tasks (condition_key) WHERE is_active AND duplicate_of IS NULL;

-- Поиск похожих задач (не точных дублей) — по триграммам.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX tasks_condition_key_trgm ON tasks USING gin (condition_key gin_trgm_ops) WHERE is_active;
