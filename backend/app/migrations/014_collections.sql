-- Подборки задач: учитель собирает задачи (из любых тем и авторов) в тренировку, у ученика — прогресс.
CREATE TABLE collections (
    id          BIGSERIAL PRIMARY KEY,
    title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
    description TEXT        NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
    author_id   BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    is_public   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE collection_tasks (
    collection_id BIGINT   NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
    task_id       BIGINT   NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    position      SMALLINT NOT NULL,
    PRIMARY KEY (collection_id, task_id)
);
CREATE INDEX collection_tasks_task_idx ON collection_tasks (task_id);
