-- Профиль учителя: описание, предметы, сертификаты (с проверкой админом) и отзывы учеников.

CREATE TABLE teacher_profiles (
    user_id          BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    headline         TEXT        NOT NULL DEFAULT '',
    bio              TEXT        NOT NULL DEFAULT '',
    experience_years SMALLINT CHECK (experience_years BETWEEN 0 AND 70),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teacher_subjects (
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    subject_id BIGINT NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, subject_id)
);

CREATE TABLE certificates (
    id            BIGSERIAL PRIMARY KEY,
    teacher_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title         TEXT        NOT NULL,
    issuer        TEXT        NOT NULL DEFAULT '',
    year          SMALLINT CHECK (year BETWEEN 1950 AND 2100),
    file_path     TEXT        NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    reject_reason TEXT        NOT NULL DEFAULT '',
    reviewed_by   BIGINT REFERENCES users (id),
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX certificates_teacher_idx ON certificates (teacher_id);
CREATE INDEX certificates_pending_idx ON certificates (created_at) WHERE status = 'pending';

CREATE TABLE reviews (
    id          BIGSERIAL PRIMARY KEY,
    teacher_id  BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    student_id  BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text        TEXT        NOT NULL DEFAULT '',
    reply       TEXT        NOT NULL DEFAULT '',
    replied_at  TIMESTAMPTZ,
    is_hidden   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (teacher_id, student_id),
    CHECK (teacher_id <> student_id)
);
CREATE INDEX reviews_teacher_idx ON reviews (teacher_id, created_at DESC) WHERE NOT is_hidden;
