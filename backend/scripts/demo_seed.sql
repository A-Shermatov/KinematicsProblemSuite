-- Демо-данные для ручного тестирования. НЕ для продакшена.
--
-- Запуск (после первого старта, когда миграции уже применены):
--   docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/scripts/demo_seed.sql
--
-- Все демо-пользователи: пароль demo12345.
--   учителя:  teacher (Азиз Каримов), teacher2 (Нилуфар Рахимова)
--   ученики:  farrukh, malika, dilshod, zarina, rustam
-- Администратор создаётся отдельно из ADMIN_USERNAME / ADMIN_PASSWORD в .env.
--
-- Фото решений и файлы сертификатов в демо — несуществующие пути (картинки не откроются).

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE username = 'farrukh') THEN
        RAISE EXCEPTION 'Демо-данные уже загружены';
    END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Пользователи ----------

INSERT INTO users (username, first_name, last_name, password_hash, role, city, school, created_at)
SELECT u.username, u.first_name, u.last_name, crypt('demo12345', gen_salt('bf', 12)), u.role, u.city, u.school,
       now() - u.age
FROM (VALUES
    ('teacher',  'Азиз',    'Каримов',  'teacher', 'Худжанд', 'Лицей №1',            interval '400 days'),
    ('teacher2', 'Нилуфар', 'Рахимова', 'teacher', 'Душанбе', 'Президентский лицей', interval '300 days'),
    ('farrukh',  'Фаррух',  'Шерматов', 'student', 'Худжанд', 'Лицей №1',            interval '370 days'),
    ('malika',   'Малика',  'Юсупова',  'student', 'Худжанд', 'Лицей №1',            interval '250 days'),
    ('dilshod',  'Дилшод',  'Рахимов',  'student', 'Душанбе', 'Президентский лицей', interval '200 days'),
    ('zarina',   'Зарина',  'Алиева',   'student', 'Бохтар',  'Гимназия №3',         interval '120 days'),
    ('rustam',   'Рустам',  'Каримов',  'student', NULL,      NULL,                  interval '30 days')
) AS u(username, first_name, last_name, role, city, school, age);

INSERT INTO teacher_profiles (user_id, headline, bio, experience_years)
SELECT id, headline, bio, exp FROM users JOIN (VALUES
    ('teacher', 'Учитель физики, лицей №1 г. Худжанда',
     E'Готовлю к республиканской олимпиаде по физике.\n\n- 12 призёров республики\n- Авторский курс по кинематике', 14),
    ('teacher2', 'Учитель математики, Президентский лицей',
     E'Алгебра и геометрия, подготовка к ЦТТ и олимпиадам.', 9)
) AS p(username, headline, bio, exp) USING (username);

INSERT INTO teacher_subjects (user_id, subject_id)
SELECT u.id, s.id FROM users u, subjects s
WHERE (u.username = 'teacher' AND s.title = 'Физика') OR (u.username = 'teacher2' AND s.title = 'Математика');

INSERT INTO certificates (teacher_id, title, issuer, year, file_path, status, reviewed_at)
SELECT u.id, c.title, c.issuer, c.year, 'demo/certificate.pdf', c.status, CASE WHEN c.status = 'verified' THEN now() END
FROM users u JOIN (VALUES
    ('teacher',  'Победитель конкурса «Учитель года»',   'Министерство образования', 2023, 'verified'),
    ('teacher',  'Подготовка призёров республиканской олимпиады', 'Министерство образования', 2025, 'pending'),
    ('teacher2', 'Курсы повышения квалификации',          'ТНУ',                      2024, 'verified')
) AS c(username, title, issuer, year, status) USING (username);

-- ---------- Темы и задачи ----------

INSERT INTO themes (subject_id, title, description, position)
SELECT s.id, t.title, t.description, t.position FROM subjects s JOIN (VALUES
    ('Физика',     'Динамика',  'Законы Ньютона, силы трения и упругости', 2),
    ('Физика',     'Энергия',   'Работа, мощность, законы сохранения',     3),
    ('Математика', 'Алгебра',   'Уравнения, неравенства, прогрессии',      1),
    ('Математика', 'Геометрия', 'Планиметрия и стереометрия',              2)
) AS t(subject, title, description, position) ON s.title = t.subject;

CREATE TEMP TABLE demo_tasks ON COMMIT DROP AS
SELECT * FROM (VALUES
    ('Кинематика', 'teacher', 'Скорость поезда', 'Поезд едет со скоростью $v = 72$ км/ч. Найдите скорость в м/с.',
     100, 'auto', 'number', '20', 'м/с', 'book', 'Рымкевич. Задачник по физике 10–11', 2019, '12',
     '{"en": {"title": "Train speed", "condition": "A train moves at $v = 72$ km/h. Find its speed in m/s."}, "tg": {"title": "Суръати қатора", "condition": "Қатора бо суръати $v = 72$ км/соат ҳаракат мекунад. Суръатро бо м/с ёбед."}}'),
    ('Кинематика', 'teacher', 'Свободное падение', E'Камень падает с высоты $h = 20$ м. Найдите время падения ($g = 10$ м/с²).\n\n$$h = \\frac{g t^2}{2}$$',
     200, 'auto', 'number', '2', 'с', 'book', 'Рымкевич. Задачник по физике 10–11', 2019, '45',
     '{"en": {"title": "Free fall", "condition": "A stone falls from $h = 20$ m. Find the fall time ($g = 10$ m/s²)."}}'),
    ('Кинематика', 'teacher', 'Путь при разгоне', 'Автомобиль разгоняется из покоя с ускорением $a = 2$ м/с². Какой путь он пройдёт за $t = 5$ с?',
     200, 'auto', 'number', '25', 'м', NULL, NULL, NULL, NULL, '{}'),
    ('Кинематика', 'teacher', 'Встреча поездов', 'Два поезда идут навстречу со скоростями 54 км/ч и 72 км/ч. Через какое время они встретятся, если расстояние 35 км?',
     300, 'auto', 'number', '16.7', 'мин', 'olympiad', 'Республиканская олимпиада', 2021, '1', '{}'),
    ('Кинематика', 'teacher', 'Дальность полёта', 'С обрыва высотой $h = 45$ м бросают камень горизонтально со скоростью $v_0 = 10$ м/с. Найдите дальность полёта.',
     400, 'auto', 'number', '30', 'м', NULL, NULL, NULL, NULL, '{}'),
    ('Кинематика', 'teacher', 'Движение по окружности', 'Точка движется по окружности радиусом 2 м с периодом 4 с. Найдите центростремительное ускорение.',
     500, 'auto', 'number', '4.93', 'м/с^2', NULL, NULL, NULL, NULL, '{}'),
    ('Кинематика', 'teacher', 'Лодка и течение', 'Лодка пересекает реку шириной 120 м, скорость лодки 4 м/с, течения 3 м/с. Под каким углом к берегу (в градусах) надо держать курс, чтобы пересечь реку перпендикулярно?',
     700, 'auto', 'number', '41.4', NULL, 'olympiad', 'Республиканская олимпиада, финал', 2022, '3', '{}'),
    ('Динамика', 'teacher', 'Второй закон Ньютона', 'На тело массой 2 кг действует сила 10 Н. Найдите ускорение.',
     100, 'auto', 'number', '5', 'м/с^2', NULL, NULL, NULL, NULL, '{}'),
    ('Динамика', 'teacher', 'Брусок на наклонной плоскости', 'Брусок соскальзывает с наклонной плоскости с углом 30° без трения. Найдите ускорение ($g = 10$ м/с²).',
     300, 'auto', 'number', '5', 'м/с^2', NULL, NULL, NULL, NULL, '{}'),
    ('Динамика', 'teacher', 'Объясните опыт', 'Почему при резком торможении автобуса пассажиры наклоняются вперёд? Сфотографируйте развёрнутое решение.',
     200, 'manual', 'text', 'инерция', NULL, 'own', NULL, NULL, NULL, '{}'),
    ('Энергия', 'teacher', 'Кинетическая энергия', 'Найдите кинетическую энергию тела массой 4 кг, движущегося со скоростью 3 м/с.',
     100, 'auto', 'number', '18', 'Дж', NULL, NULL, NULL, NULL, '{}'),
    ('Энергия', 'teacher', 'Маятник', 'Маятник отклонили на высоту 0,2 м и отпустили. Найдите скорость в нижней точке ($g = 10$ м/с²).',
     400, 'auto', 'number', '2', 'м/с', NULL, NULL, NULL, NULL, '{}'),
    ('Алгебра', 'teacher2', 'Линейное уравнение', 'Решите уравнение $3x - 7 = 11$.',
     100, 'auto', 'number', '6', NULL, NULL, NULL, NULL, NULL,
     '{"en": {"title": "Linear equation", "condition": "Solve $3x - 7 = 11$."}, "tg": {"title": "Муодилаи хаттӣ", "condition": "Муодилаи $3x - 7 = 11$-ро ҳал кунед."}}'),
    ('Алгебра', 'teacher2', 'Арифметическая прогрессия', 'Найдите сумму первых 20 членов прогрессии $1, 4, 7, \dots$',
     300, 'auto', 'number', '590', NULL, 'exam', 'Вступительный тест ЦТТ', 2023, '17', '{}'),
    ('Алгебра', 'teacher2', 'Олимпиадное неравенство', 'Найдите наименьшее значение $x + \frac{9}{x}$ при $x > 0$.',
     600, 'auto', 'number', '6', NULL, 'olympiad', 'Республиканская олимпиада', 2020, '2', '{}'),
    ('Геометрия', 'teacher2', 'Площадь треугольника', 'Стороны прямоугольного треугольника 6 и 8 (катеты). Найдите площадь.',
     100, 'auto', 'number', '24', NULL, NULL, NULL, NULL, NULL, '{}'),
    ('Геометрия', 'teacher2', 'Вписанная окружность', 'Найдите радиус окружности, вписанной в треугольник со сторонами 13, 14, 15.',
     500, 'auto', 'number', '4', NULL, NULL, NULL, NULL, NULL, '{}')
) AS k(theme, author, title, condition, difficulty, check_mode, answer_type, answer, unit,
       source_type, source_title, source_year, source_number, translations);

-- Каталог источников: одна книга — много задач.
INSERT INTO sources (type, title, author, year, created_by)
SELECT DISTINCT k.source_type, k.source_title,
       CASE WHEN k.source_title LIKE 'Рымкевич%' THEN 'А. П. Рымкевич' ELSE '' END, k.source_year::smallint, u.id
FROM demo_tasks k JOIN users u ON u.username = k.author
WHERE k.source_title IS NOT NULL;

INSERT INTO tasks (theme_id, author_id, title, condition, difficulty, check_mode, answer_type, answer, unit,
                   source_id, source_number, is_original, translations, created_at)
SELECT th.id, u.id, k.title, k.condition, k.difficulty, k.check_mode, k.answer_type, k.answer, k.unit,
       src.id, k.source_number, k.source_type IS NOT DISTINCT FROM 'own', k.translations::jsonb, now() - interval '200 days'
FROM demo_tasks k
JOIN themes th ON th.title = k.theme
JOIN users u ON u.username = k.author
LEFT JOIN sources src ON src.title = k.source_title AND src.year IS NOT DISTINCT FROM k.source_year::smallint;

-- ---------- История решений (для тепловой карты, рейтинга и значков) ----------
-- Каждый ученик в «активные» дни отправляет 1–3 попытки; верность зависит от сложности и «силы» ученика.

DO $$
DECLARE
    p RECORD;
    k RECORD;
    day TIMESTAMPTZ;
    ok BOOLEAN;
BEGIN
    FOR p IN
        SELECT u.id, u.created_at, x.activity, x.strength
        FROM (VALUES ('farrukh', 0.55, 0.85), ('malika', 0.45, 0.9), ('dilshod', 0.35, 0.75),
                     ('zarina', 0.25, 0.6), ('rustam', 0.5, 0.5)) AS x(username, activity, strength)
        JOIN users u ON u.username = x.username
    LOOP
        FOR day IN
            SELECT generate_series(greatest(date_trunc('day', p.created_at), date_trunc('day', now()) - interval '365 days'),
                                   now() - interval '1 day', interval '1 day')
        LOOP
            CONTINUE WHEN random() >= p.activity;
            FOR k IN
                SELECT id, answer, difficulty FROM tasks WHERE check_mode = 'auto' ORDER BY random() LIMIT 1 + floor(random() * 3)::int
            LOOP
                ok := random() < p.strength - k.difficulty / 2000.0;
                INSERT INTO attempts (task_id, student_id, answer, status, system_grade, created_at)
                VALUES (k.id, p.id, CASE WHEN ok THEN k.answer ELSE '1' END, CASE WHEN ok THEN 'correct' ELSE 'incorrect' END,
                        CASE WHEN ok THEN 100 ELSE 0 END, day + interval '8 hours' + random() * interval '10 hours');
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- Ручная задача: одно решение ждёт проверки, одно проверено.
INSERT INTO attempts (task_id, student_id, answer, image_path, status, teacher_grade, feedback, graded_by, graded_at, created_at)
SELECT k.id, s.id, 'По инерции тело сохраняет скорость', 'demo/solution.png', st, grade, fb,
       CASE WHEN st = 'graded' THEN t.id END, CASE WHEN st = 'graded' THEN now() - interval '1 day' END,
       now() - interval '2 days'
FROM (VALUES ('farrukh', 'graded', 90, 'Хорошо, но добавьте рисунок'), ('zarina', 'pending', NULL, '')) AS a(username, st, grade, fb)
JOIN users s ON s.username = a.username
JOIN tasks k ON k.title = 'Объясните опыт'
JOIN users t ON t.username = 'teacher';

-- ---------- Отзывы ----------

INSERT INTO reviews (teacher_id, student_id, rating, text, reply, replied_at)
SELECT t.id, s.id, r.rating, r.text, COALESCE(r.reply, ''), CASE WHEN r.reply IS NOT NULL THEN now() END
FROM (VALUES
    ('teacher', 'farrukh', 5, 'Отличные задачи по кинематике, понятные разборы.', 'Спасибо, Фаррух! Ждём на олимпиаде.'),
    ('teacher', 'malika',  5, 'Задачи сложные, но интересные.', NULL),
    ('teacher', 'zarina',  4, 'Хотелось бы больше простых задач для начала.', NULL),
    ('teacher2', 'dilshod', 5, 'Лучшая подготовка к ЦТТ.', NULL)
) AS r(teacher, student, rating, text, reply)
JOIN users t ON t.username = r.teacher
JOIN users s ON s.username = r.student;

-- ---------- Олимпиады: по одной в каждом состоянии ----------

INSERT INTO olympiads (title, description, subject_id, organizer_id, starts_at, ends_at, status, results_published)
SELECT o.title, o.description, s.id, u.id, now() + o.starts, now() + o.ends, o.status, o.published
FROM (VALUES
    ('Осенняя олимпиада по физике', E'Для учеников **9–11 классов**. Три часа, три задачи.\n\nПризёры получают дипломы I–III степени.',
     'Физика', 'teacher', interval '-14 days', interval '-14 days' + interval '3 hours', 'published', TRUE),
    ('Олимпиада по кинематике (идёт сейчас)', 'Решайте и прикладывайте фото решения.',
     'Физика', 'teacher', interval '-1 hour', interval '2 hours', 'published', FALSE),
    ('Математический турнир (проверка жюри)', 'Олимпиада завершена, жюри проверяет решения.',
     'Математика', 'teacher2', interval '-2 days', interval '-2 days' + interval '2 hours', 'published', FALSE),
    ('Зимняя олимпиада по физике', 'Регистрация открыта. Условия появятся в момент начала.',
     'Физика', 'teacher', interval '7 days', interval '7 days' + interval '3 hours', 'published', FALSE),
    ('Олимпиада по геометрии (на модерации)', 'Ждёт проверки администратором.',
     'Математика', 'teacher2', interval '10 days', interval '10 days' + interval '2 hours', 'pending', FALSE)
) AS o(title, description, subject, organizer, starts, ends, status, published)
JOIN subjects s ON s.title = o.subject
JOIN users u ON u.username = o.organizer;

INSERT INTO olympiad_tasks (olympiad_id, position, title, condition, answer, unit, max_points, translations)
SELECT o.id, t.position, t.title, t.condition, t.answer, t.unit, t.points, t.tr::jsonb
FROM (VALUES
    ('Осенняя олимпиада по физике', 0, 'Камень на краю обрыва',
     'С обрыва высотой $h = 45$ м бросают камень горизонтально со скоростью $v_0 = 10$ м/с. Найдите дальность полёта.', '30', 'м', 10,
     '{"tg": {"title": "Санг дар лаби ҷарӣ", "condition": "Аз ҷарии баландиаш $h = 45$ м сангро бо суръати $v_0 = 10$ м/с уфуқӣ мепартоянд. Масофаи паровозро ёбед."}}'),
    ('Осенняя олимпиада по физике', 1, 'Два поезда',
     'Два поезда идут навстречу со скоростями 54 км/ч и 72 км/ч. Через какое время (в минутах) они встретятся, если расстояние 35 км?', '16.7', 'мин', 5, '{}'),
    ('Осенняя олимпиада по физике', 2, 'Брусок',
     'Брусок соскальзывает с наклонной плоскости с углом 30° без трения. Найдите ускорение ($g = 10$ м/с²).', '5', 'м/с^2', 5, '{}'),
    ('Олимпиада по кинематике (идёт сейчас)', 0, 'Свободное падение',
     'Камень падает с высоты 80 м. Найдите время падения ($g = 10$ м/с²).', '4', 'с', 10, '{}'),
    ('Олимпиада по кинематике (идёт сейчас)', 1, 'Скорость в конце',
     'Какую скорость наберёт камень из предыдущей задачи к моменту удара?', '40', 'м/с', 10, '{}'),
    ('Математический турнир (проверка жюри)', 0, 'Уравнение', 'Решите $x^2 - 5x + 6 = 0$. Укажите больший корень.', '3', NULL, 10, '{}'),
    ('Математический турнир (проверка жюри)', 1, 'Прогрессия', 'Сумма первых 10 натуральных чисел?', '55', NULL, 10, '{}'),
    ('Зимняя олимпиада по физике', 0, 'Маятник', 'Найдите период маятника длиной 2,5 м ($g = 10$).', '3.14', 'с', 10, '{}'),
    ('Олимпиада по геометрии (на модерации)', 0, 'Треугольник', 'Найдите площадь треугольника со сторонами 13, 14, 15.', '84', NULL, 10, '{}')
) AS t(olympiad, position, title, condition, answer, unit, points, tr)
JOIN olympiads o ON o.title = t.olympiad;

-- Участники
INSERT INTO olympiad_participants (olympiad_id, user_id)
SELECT o.id, u.id FROM (VALUES
    ('Осенняя олимпиада по физике', 'farrukh'), ('Осенняя олимпиада по физике', 'malika'),
    ('Осенняя олимпиада по физике', 'dilshod'), ('Осенняя олимпиада по физике', 'zarina'),
    ('Олимпиада по кинематике (идёт сейчас)', 'farrukh'), ('Олимпиада по кинематике (идёт сейчас)', 'malika'),
    ('Математический турнир (проверка жюри)', 'malika'), ('Математический турнир (проверка жюри)', 'dilshod'),
    ('Зимняя олимпиада по физике', 'farrukh')
) AS p(olympiad, username)
JOIN olympiads o ON o.title = p.olympiad
JOIN users u ON u.username = p.username;
-- rustam ни в чём не участвовал — им удобно проверить виртуальное участие в «Осенней олимпиаде».

-- Решения: (олимпиада, ученик, позиция задачи, ответ, балл жюри; NULL — ещё не проверено)
INSERT INTO olympiad_submissions (olympiad_id, task_id, user_id, answer, image_path, auto_correct, auto_points,
                                  jury_points, jury_comment, graded_by, graded_at, submitted_at)
SELECT o.id, t.id, u.id, s.answer, 'demo/solution.png', s.answer = t.answer,
       CASE WHEN s.answer = t.answer THEN t.max_points ELSE 0 END,
       s.jury, s.comment, CASE WHEN s.jury IS NOT NULL THEN o.organizer_id END,
       CASE WHEN s.jury IS NOT NULL THEN o.ends_at + interval '1 day' END,
       o.starts_at + interval '1 hour'
FROM (VALUES
    ('Осенняя олимпиада по физике', 'malika',  0, '30',   10, ''),
    ('Осенняя олимпиада по физике', 'malika',  1, '16.7', 5,  ''),
    ('Осенняя олимпиада по физике', 'malika',  2, '5',    5,  ''),
    ('Осенняя олимпиада по физике', 'farrukh', 0, '30',   8,  'Не хватает рисунка'),
    ('Осенняя олимпиада по физике', 'farrukh', 1, '16.7', 5,  ''),
    ('Осенняя олимпиада по физике', 'farrukh', 2, '5',    5,  ''),
    ('Осенняя олимпиада по физике', 'dilshod', 0, '30',   10, ''),
    ('Осенняя олимпиада по физике', 'dilshod', 1, '20',   2,  'Ошибка в переводе единиц'),
    ('Осенняя олимпиада по физике', 'zarina',  0, '25',   3,  'Верная идея, ошибка в вычислениях'),
    ('Олимпиада по кинематике (идёт сейчас)', 'malika', 0, '4', NULL, ''),
    ('Математический турнир (проверка жюри)', 'malika',  0, '3',  NULL, ''),
    ('Математический турнир (проверка жюри)', 'malika',  1, '55', NULL, ''),
    ('Математический турнир (проверка жюри)', 'dilshod', 0, '2',  NULL, ''),
    ('Математический турнир (проверка жюри)', 'dilshod', 1, '55', 10,   '')
) AS s(olympiad, username, position, answer, jury, comment)
JOIN olympiads o ON o.title = s.olympiad
JOIN olympiad_tasks t ON t.olympiad_id = o.id AND t.position = s.position
JOIN users u ON u.username = s.username;

COMMIT;

SELECT 'Демо-данные загружены. Пароль всех демо-пользователей: demo12345' AS result;
