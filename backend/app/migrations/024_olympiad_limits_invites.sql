-- Длительность олимпиады ограничена уровнем (администратор задаёт для каждого уровня своё).
ALTER TABLE olympiad_levels ADD COLUMN max_duration_minutes INT CHECK (max_duration_minutes BETWEEN 15 AND 1440);
UPDATE olympiad_levels SET max_duration_minutes = 120 WHERE title = 'До 5 класса';
UPDATE olympiad_levels SET max_duration_minutes = 180 WHERE title = '5–8 класс';
UPDATE olympiad_levels SET max_duration_minutes = 240 WHERE title = '9–11 класс';

-- Приглашение в жюри: учитель становится членом жюри, только когда примет приглашение.
ALTER TABLE olympiad_jury ADD COLUMN status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted'));
ALTER TABLE olympiad_jury ADD COLUMN invited_by BIGINT REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE olympiad_jury ADD COLUMN responded_at TIMESTAMPTZ;
