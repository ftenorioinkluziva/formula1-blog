CREATE TABLE IF NOT EXISTS race_control_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES race_sessions(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'Other',
  flag TEXT NOT NULL DEFAULT '',
  lap INTEGER NOT NULL DEFAULT -1,
  message_text TEXT NOT NULL,
  racing_number TEXT NOT NULL DEFAULT '',
  occurred_at_utc TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS race_control_messages_session_occurred_idx
  ON race_control_messages(session_id, occurred_at_utc DESC);

CREATE UNIQUE INDEX IF NOT EXISTS race_control_messages_dedupe_idx
  ON race_control_messages(
    session_id,
    occurred_at_utc,
    message_type,
    flag,
    lap,
    message_text,
    racing_number
  );

CREATE UNIQUE INDEX IF NOT EXISTS session_status_events_dedupe_idx
  ON session_status_events(session_id, status, occurred_at_utc);
