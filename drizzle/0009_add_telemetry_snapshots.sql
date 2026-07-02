CREATE TABLE IF NOT EXISTS telemetry_snapshots (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES race_sessions(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  captured_at_utc TIMESTAMPTZ NOT NULL,
  speed INTEGER,
  rpm INTEGER,
  gear INTEGER,
  throttle INTEGER,
  brake INTEGER,
  drs INTEGER,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS telemetry_snapshots_session_driver_captured_unique_idx
  ON telemetry_snapshots(session_id, driver_id, captured_at_utc);

CREATE INDEX IF NOT EXISTS telemetry_snapshots_session_captured_idx
  ON telemetry_snapshots(session_id, captured_at_utc DESC);

CREATE INDEX IF NOT EXISTS telemetry_snapshots_driver_captured_idx
  ON telemetry_snapshots(driver_id, captured_at_utc DESC);
