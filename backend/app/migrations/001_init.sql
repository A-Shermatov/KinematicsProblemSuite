-- Базовая схема: пользователи, токены, предметы, темы, задачи, попытки.

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT        NOT NULL,
    first_name    TEXT        NOT NULL,
    last_name     TEXT        NOT NULL DEFAULT '',
    password_hash TEXT        NOT NULL,
    role          TEXT        NOT NULL DEFAULT 'student'
                  CHECK (role IN ('student', 'teacher', 'admin')),
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    avatar_path   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9_.-]{3,50}$')
);
CREATE UNIQUE INDEX users_username_lower_uq ON users (lower(username));

CREATE TABLE refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    jti        UUID        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

CREATE TABLE subjects (
    id          BIGSERIAL PRIMARY KEY,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    position    INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subjects_title_active_uq ON subjects (lower(title)) WHERE is_active;

CREATE TABLE themes (
    id          BIGSERIAL PRIMARY KEY,
    subject_id  BIGINT      NOT NULL REFERENCES subjects (id),
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    position    INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX themes_subject_idx ON themes (subject_id) WHERE is_active;

CREATE TABLE tasks (
    id          BIGSERIAL PRIMARY KEY,
    theme_id    BIGINT           NOT NULL REFERENCES themes (id),
    author_id   BIGINT           NOT NULL REFERENCES users (id),
    title       TEXT             NOT NULL,
    condition   TEXT             NOT NULL DEFAULT '',
    difficulty  SMALLINT         NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    check_mode  TEXT             NOT NULL DEFAULT 'auto' CHECK (check_mode IN ('auto', 'manual')),
    answer_type TEXT             NOT NULL DEFAULT 'number' CHECK (answer_type IN ('number', 'text')),
    answer      TEXT             NOT NULL,
    unit        TEXT,
    tolerance   DOUBLE PRECISION NOT NULL DEFAULT 0.01 CHECK (tolerance >= 0 AND tolerance < 1),
    is_active   BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX tasks_theme_idx ON tasks (theme_id) WHERE is_active;
CREATE INDEX tasks_author_idx ON tasks (author_id) WHERE is_active;

CREATE TABLE attempts (
    id            BIGSERIAL PRIMARY KEY,
    task_id       BIGINT      NOT NULL REFERENCES tasks (id),
    student_id    BIGINT      NOT NULL REFERENCES users (id),
    answer        TEXT        NOT NULL,
    image_path    TEXT,
    status        TEXT        NOT NULL CHECK (status IN ('correct', 'incorrect', 'pending', 'graded')),
    system_grade  SMALLINT CHECK (system_grade BETWEEN 0 AND 100),
    teacher_grade SMALLINT CHECK (teacher_grade BETWEEN 0 AND 100),
    feedback      TEXT        NOT NULL DEFAULT '',
    graded_by     BIGINT REFERENCES users (id),
    graded_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attempts_student_idx ON attempts (student_id, created_at DESC);
CREATE INDEX attempts_task_idx ON attempts (task_id);
CREATE INDEX attempts_pending_idx ON attempts (task_id) WHERE status = 'pending';
