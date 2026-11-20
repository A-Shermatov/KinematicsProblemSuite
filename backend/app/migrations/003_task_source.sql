-- Источник задачи: откуда она взята (учебник, олимпиада, экзамен) или авторская.
ALTER TABLE tasks
    ADD COLUMN source_type   TEXT CHECK (source_type IN ('book', 'olympiad', 'exam', 'own')),
    ADD COLUMN source_title  TEXT,
    ADD COLUMN source_year   SMALLINT CHECK (source_year BETWEEN 1800 AND 2100),
    ADD COLUMN source_number TEXT;
