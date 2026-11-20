-- Уровни олимпиад (как Div. 1/2/3 на Codeforces). Задаёт администратор.
-- Официально участвуют те, у кого рейтинг ниже max_rating (или ещё нет рейтинга);
-- остальные — вне конкурса: в таблице видны, но без места, диплома и изменения рейтинга.
CREATE TABLE olympiad_levels (
    id          BIGSERIAL PRIMARY KEY,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    min_rating  INT,
    max_rating  INT,
    position    INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (min_rating IS NULL OR max_rating IS NULL OR min_rating < max_rating)
);

INSERT INTO olympiad_levels (title, description, min_rating, max_rating, position) VALUES
    ('До 5 класса', 'Для начинающих', NULL, 1200, 1),
    ('5–8 класс', 'Средний уровень', 1200, 1600, 2),
    ('9–11 класс', 'Старшие классы и сильные участники', 1600, NULL, 3);

ALTER TABLE olympiads ADD COLUMN level_id BIGINT REFERENCES olympiad_levels (id) ON DELETE SET NULL;

-- Официальный участник или вне конкурса — решается при регистрации по рейтингу.
ALTER TABLE olympiad_participants ADD COLUMN official BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE olympiad_participants ADD COLUMN rating_at_registration INT;
