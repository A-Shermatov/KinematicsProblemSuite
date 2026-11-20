-- Разбор олимпиады: общий текст и решение каждой задачи. Открывается через сутки после окончания.
ALTER TABLE olympiads ADD COLUMN editorial TEXT NOT NULL DEFAULT '';
ALTER TABLE olympiad_tasks ADD COLUMN solution TEXT NOT NULL DEFAULT '';
