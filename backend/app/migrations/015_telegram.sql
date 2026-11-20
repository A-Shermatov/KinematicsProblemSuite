-- Telegram-бот: привязка аккаунта, настройки и очередь уведомлений.
CREATE TABLE telegram_links (
    user_id    BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    chat_id    BIGINT      NOT NULL UNIQUE,
    username   TEXT        NOT NULL DEFAULT '',
    daily_task BOOLEAN     NOT NULL DEFAULT TRUE,  -- «задача дня» утром
    notify     BOOLEAN     NOT NULL DEFAULT TRUE,  -- проверка решений, олимпиады, звания
    linked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Одноразовый код для привязки: ссылка t.me/<бот>?start=<код>, живёт 15 минут.
CREATE TABLE telegram_link_codes (
    code       TEXT PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Очередь уведомлений: сайт кладёт, бот отправляет. ref — ключ от дублей (одно напоминание на олимпиаду и т.п.).
CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind       TEXT        NOT NULL,
    ref        TEXT        NOT NULL,
    text       TEXT        NOT NULL,
    url        TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at    TIMESTAMPTZ,
    UNIQUE (user_id, kind, ref)
);
CREATE INDEX notifications_pending_idx ON notifications (created_at) WHERE sent_at IS NULL;
