-- Жюри олимпиады: учителя, которых пригласил организатор. Проверяют решения и делают объявления,
-- но сами в этой олимпиаде не участвуют (как и автор).
CREATE TABLE olympiad_jury (
    olympiad_id BIGINT      NOT NULL REFERENCES olympiads (id) ON DELETE CASCADE,
    user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (olympiad_id, user_id)
);
CREATE INDEX olympiad_jury_user_idx ON olympiad_jury (user_id);
