-- Переводы условий задач: {"en": {"title": "...", "condition": "..."}, "tg": {...}}.
-- Основной язык — русский (поля title/condition). Если перевода на выбранный язык нет — показываем русский.
ALTER TABLE tasks ADD COLUMN translations JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE olympiad_tasks ADD COLUMN translations JSONB NOT NULL DEFAULT '{}'::jsonb;
