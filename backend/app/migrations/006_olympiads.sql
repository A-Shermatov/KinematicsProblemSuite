-- Олимпиады: общее окно для всех участников, учитель создаёт, админ публикует,
-- фото решения обязательно, проверка автоматическая + жюри.

CREATE TABLE olympiads (
    id                BIGSERIAL PRIMARY KEY,
    title             TEXT        NOT NULL,
    description       TEXT        NOT NULL DEFAULT '',
    subject_id        BIGINT REFERENCES subjects (id),
    organizer_id      BIGINT      NOT NULL REFERENCES users (id),
    starts_at         TIMESTAMPTZ NOT NULL,
    ends_at           TIMESTAMPTZ NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
    reject_reason     TEXT        NOT NULL DEFAULT '',
    results_published BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);
CREATE INDEX olympiads_status_idx ON olympiads (status, starts_at);
CREATE INDEX olympiads_organizer_idx ON olympiads (organizer_id);

-- Задачи олимпиады хранятся отдельно от общего каталога: до начала их никто, кроме автора и админа, не видит.
CREATE TABLE olympiad_tasks (
    id          BIGSERIAL PRIMARY KEY,
    olympiad_id BIGINT           NOT NULL REFERENCES olympiads (id) ON DELETE CASCADE,
    position    INTEGER          NOT NULL DEFAULT 0,
    title       TEXT             NOT NULL,
    condition   TEXT             NOT NULL DEFAULT '',
    answer_type TEXT             NOT NULL DEFAULT 'number' CHECK (answer_type IN ('number', 'text')),
    answer      TEXT             NOT NULL,
    unit        TEXT,
    tolerance   DOUBLE PRECISION NOT NULL DEFAULT 0.01 CHECK (tolerance >= 0 AND tolerance < 1),
    max_points  SMALLINT         NOT NULL DEFAULT 10 CHECK (max_points BETWEEN 1 AND 100)
);
CREATE INDEX olympiad_tasks_olympiad_idx ON olympiad_tasks (olympiad_id, position);

CREATE TABLE olympiad_participants (
    olympiad_id   BIGINT      NOT NULL REFERENCES olympiads (id) ON DELETE CASCADE,
    user_id       BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (olympiad_id, user_id)
);

-- Одно решение на задачу от участника: повторная отправка заменяет предыдущую (засчитывается последняя).
CREATE TABLE olympiad_submissions (
    id           BIGSERIAL PRIMARY KEY,
    olympiad_id  BIGINT      NOT NULL REFERENCES olympiads (id) ON DELETE CASCADE,
    task_id      BIGINT      NOT NULL REFERENCES olympiad_tasks (id) ON DELETE CASCADE,
    user_id      BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    answer       TEXT        NOT NULL DEFAULT '',
    image_path   TEXT        NOT NULL,
    auto_correct BOOLEAN     NOT NULL,
    auto_points  SMALLINT    NOT NULL,
    jury_points  SMALLINT,
    jury_comment TEXT        NOT NULL DEFAULT '',
    graded_by    BIGINT REFERENCES users (id),
    graded_at    TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (task_id, user_id)
);
CREATE INDEX olympiad_submissions_olympiad_idx ON olympiad_submissions (olympiad_id, user_id);
