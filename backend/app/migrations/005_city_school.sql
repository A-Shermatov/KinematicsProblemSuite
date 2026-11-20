-- Город и школа — необязательно: нужны для рейтингов школ и городов.
ALTER TABLE users
    ADD COLUMN city   TEXT CHECK (char_length(city) <= 60),
    ADD COLUMN school TEXT CHECK (char_length(school) <= 120);

-- Группировка рейтингов идёт без учёта регистра.
CREATE INDEX users_city_idx ON users (lower(city)) WHERE city IS NOT NULL;
CREATE INDEX users_school_idx ON users (lower(city), lower(school)) WHERE school IS NOT NULL;
