-- Сколько раз участник отправлял решение задачи (для живой таблицы, как на Codeforces).
ALTER TABLE olympiad_submissions ADD COLUMN attempts SMALLINT NOT NULL DEFAULT 1;
