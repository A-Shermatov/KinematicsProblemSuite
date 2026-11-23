-- Подсказка по неверному ответу («ваш ответ в 2 раза меньше…») больше не показывается сразу:
-- она хранится у попытки и открывается кнопкой — как обычная подсказка, со снижением очков.
ALTER TABLE attempts ADD COLUMN mistake_hint TEXT;

CREATE TABLE attempt_hint_opens (
    attempt_id BIGINT      PRIMARY KEY REFERENCES attempts (id) ON DELETE CASCADE,
    opened_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
