-- Рейтинг олимпиадника (как на Codeforces). Текущий рейтинг — new_rating последней олимпиады участника.
CREATE TABLE rating_changes (
    olympiad_id BIGINT      NOT NULL REFERENCES olympiads (id) ON DELETE CASCADE,
    user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    place       INT         NOT NULL,
    total       INT         NOT NULL,
    old_rating  INT         NOT NULL,
    new_rating  INT         NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (olympiad_id, user_id)
);
CREATE INDEX rating_changes_user_idx ON rating_changes (user_id);

-- Когда по олимпиаде пересчитан рейтинг; NULL — итоги ещё не учтены.
ALTER TABLE olympiads ADD COLUMN rated_at TIMESTAMPTZ;
