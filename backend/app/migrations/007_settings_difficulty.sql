-- Системные настройки (меняет администратор) и сложность задач по шкале 100, 200, 300, …

CREATE TABLE app_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB       NOT NULL,
    updated_by BIGINT REFERENCES users (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES ('difficulty_max', '1000');

-- Было 1–5, стало 100–500. Верхний предел проверяет приложение по настройке difficulty_max.
ALTER TABLE tasks DROP CONSTRAINT tasks_difficulty_check;
UPDATE tasks SET difficulty = difficulty * 100;
ALTER TABLE tasks ALTER COLUMN difficulty SET DEFAULT 100;
ALTER TABLE tasks ADD CONSTRAINT tasks_difficulty_check
    CHECK (difficulty BETWEEN 100 AND 10000 AND difficulty % 100 = 0);
