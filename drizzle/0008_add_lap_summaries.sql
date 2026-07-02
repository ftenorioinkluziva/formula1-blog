CREATE TABLE IF NOT EXISTS lap_summaries (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES race_sessions(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  lap_number INTEGER NOT NULL,
  lap_time TEXT,
  sector_1 TEXT,
  sector_2 TEXT,
  sector_3 TEXT,
  pit_in BOOLEAN NOT NULL DEFAULT false,
  pit_out BOOLEAN NOT NULL DEFAULT false,
  occurred_at_utc TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lap_summaries_session_driver_lap_unique_idx
  ON lap_summaries(session_id, driver_id, lap_number);

CREATE INDEX IF NOT EXISTS lap_summaries_session_driver_lap_idx
  ON lap_summaries(session_id, driver_id, lap_number);

CREATE INDEX IF NOT EXISTS lap_summaries_session_occurred_idx
  ON lap_summaries(session_id, occurred_at_utc DESC);
