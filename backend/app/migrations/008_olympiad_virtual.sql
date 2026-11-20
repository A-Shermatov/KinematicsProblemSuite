-- Виртуальное участие в прошедших олимпиадах: своё окно той же длительности, только ответы (без фото),
-- только автопроверка. На официальные места, дипломы и рейтинг не влияет.

CREATE TABLE olympiad_virtual_runs (
    id          BIGSERIAL PRIMARY KEY,
    olympiad_id BIGINT      NOT NULL REFERENCES olympiads (id) ON DELETE CASCADE,
    user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at     TIMESTAMPTZ NOT NULL,
    UNIQUE (olympiad_id, user_id)
);

CREATE TABLE olympiad_virtual_submissions (
    id           BIGSERIAL PRIMARY KEY,
    run_id       BIGINT      NOT NULL REFERENCES olympiad_virtual_runs (id) ON DELETE CASCADE,
    task_id      BIGINT      NOT NULL REFERENCES olympiad_tasks (id) ON DELETE CASCADE,
    answer       TEXT        NOT NULL,
    correct      BOOLEAN     NOT NULL,
    points       SMALLINT    NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, task_id)
);
