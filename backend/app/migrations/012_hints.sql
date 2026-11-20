-- Подсказки, разбор решения и частые ошибки к задаче.
ALTER TABLE tasks
    ADD COLUMN hints       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- до 3 подсказок (Markdown), открываются по очереди
    ADD COLUMN explanation TEXT  NOT NULL DEFAULT '',            -- разбор: после верного ответа или 3 неверных попыток
    ADD COLUMN mistakes    JSONB NOT NULL DEFAULT '[]'::jsonb;  -- [{"answer": "72", "message": "Не перевели км/ч в м/с"}]

-- Какие подсказки ученик открыл. Каждая открытая подсказка снижает очки за задачу на 20%.
CREATE TABLE task_hint_opens (
    task_id    BIGINT      NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    hint_index SMALLINT    NOT NULL CHECK (hint_index BETWEEN 0 AND 2),
    opened_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id, hint_index)
);

-- Сколько подсказок было открыто к моменту попытки: очки считаются по первой верной.
ALTER TABLE attempts ADD COLUMN hints_used SMALLINT NOT NULL DEFAULT 0;
