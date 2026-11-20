-- Все отправки участника (в olympiad_submissions хранится только последняя, она и засчитывается).
CREATE TABLE olympiad_submission_history (
    id           BIGSERIAL PRIMARY KEY,
    olympiad_id  BIGINT      NOT NULL REFERENCES olympiads (id) ON DELETE CASCADE,
    task_id      BIGINT      NOT NULL REFERENCES olympiad_tasks (id) ON DELETE CASCADE,
    user_id      BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    answer       TEXT        NOT NULL DEFAULT '',
    auto_correct BOOLEAN     NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX olympiad_submission_history_user_idx ON olympiad_submission_history (olympiad_id, user_id);

INSERT INTO olympiad_submission_history (olympiad_id, task_id, user_id, answer, auto_correct, submitted_at)
SELECT olympiad_id, task_id, user_id, answer, auto_correct, submitted_at FROM olympiad_submissions;
