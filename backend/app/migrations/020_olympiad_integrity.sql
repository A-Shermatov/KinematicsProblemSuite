-- Задачи олимпиады: уровень сложности и источник, как у задач платформы (для архива олимпиадных задач).
ALTER TABLE olympiad_tasks ADD COLUMN difficulty SMALLINT CHECK (difficulty IS NULL OR difficulty > 0);
ALTER TABLE olympiad_tasks ADD COLUMN source_id BIGINT REFERENCES sources (id) ON DELETE SET NULL;
ALTER TABLE olympiad_tasks ADD COLUMN source_number TEXT CHECK (source_number IS NULL OR char_length(source_number) <= 30);
ALTER TABLE olympiad_tasks ADD COLUMN is_original BOOLEAN NOT NULL DEFAULT FALSE;

-- Объявления во время олимпиады: исправления условий (с тем, что именно изменилось) и сообщения жюри.
CREATE TABLE olympiad_announcements (
    id          BIGSERIAL PRIMARY KEY,
    olympiad_id BIGINT      NOT NULL REFERENCES olympiads (id) ON DELETE CASCADE,
    task_id     BIGINT      REFERENCES olympiad_tasks (id) ON DELETE SET NULL,
    text        TEXT        NOT NULL DEFAULT '',
    changes     JSONB       NOT NULL DEFAULT '[]',
    created_by  BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX olympiad_announcements_olympiad_idx ON olympiad_announcements (olympiad_id, created_at);

-- Все попытки хранятся с фото (видят только сам участник и админ) и отпечатками фото для проверки на списывание.
ALTER TABLE olympiad_submission_history ADD COLUMN image_path TEXT;
ALTER TABLE olympiad_submission_history ADD COLUMN image_sha256 TEXT;
ALTER TABLE olympiad_submission_history ADD COLUMN image_phash BIGINT;
-- Отклонённые попытки (фото совпало с чужим) — не засчитываются, но видны жюри и админу.
ALTER TABLE olympiad_submission_history ADD COLUMN rejected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE olympiad_submission_history ADD COLUMN matched_user_id BIGINT REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX olympiad_submission_history_sha_idx ON olympiad_submission_history (olympiad_id, image_sha256);

UPDATE olympiad_submission_history h SET image_path = sb.image_path
FROM olympiad_submissions sb
WHERE sb.task_id = h.task_id AND sb.user_id = h.user_id AND sb.submitted_at = h.submitted_at;
