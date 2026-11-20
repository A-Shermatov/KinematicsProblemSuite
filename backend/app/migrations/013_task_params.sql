-- Задачи с параметрами: {v} в условии, у каждого ученика свои значения, ответ — формула.
ALTER TABLE tasks
    ADD COLUMN params         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"v": {"min": 36, "max": 108, "step": 18}}
    ADD COLUMN answer_formula TEXT  NOT NULL DEFAULT '';          -- например «v / 3.6»

-- Правильный ответ, посчитанный для конкретного ученика в момент попытки.
ALTER TABLE attempts ADD COLUMN expected TEXT;
