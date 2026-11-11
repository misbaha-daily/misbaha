CREATE TABLE IF NOT EXISTS reminders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,time TEXT NOT NULL,timezone TEXT NOT NULL,dhikr INTEGER NOT NULL,next_run INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,last_sent INTEGER,last_error INTEGER,retries INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS reminders_due ON reminders(enabled,next_run);
CREATE INDEX IF NOT EXISTS reminders_user ON reminders(user_id);
CREATE TABLE IF NOT EXISTS delivery_timing(reminder_id TEXT PRIMARY KEY,due_ms INTEGER NOT NULL,started_ms INTEGER NOT NULL,ack_ms INTEGER NOT NULL,telegram_ms INTEGER,source TEXT NOT NULL);
