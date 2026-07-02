CREATE TABLE IF NOT EXISTS race_weekends (
  id SERIAL PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  grand_prix_name TEXT NOT NULL,
  circuit TEXT NOT NULL,
  country TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS race_weekends_season_round_unique_idx
  ON race_weekends(season, round);
INSERT INTO race_weekends (season, round, grand_prix_name, circuit, country, location)
SELECT
  rs.season,
  rs.round,
  rs.name,
  rs.circuit,
  rs.country,
  NULL
FROM race_sessions rs
GROUP BY rs.season, rs.round, rs.name, rs.circuit, rs.country
ON CONFLICT (season, round) DO NOTHING;

ALTER TABLE race_sessions
  ADD COLUMN IF NOT EXISTS weekend_id INTEGER,
  ADD COLUMN IF NOT EXISTS session_code TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS is_sprint_weekend BOOLEAN NOT NULL DEFAULT false;

UPDATE race_sessions rs
SET weekend_id = rw.id
FROM race_weekends rw
WHERE rw.season = rs.season
  AND rw.round = rs.round
  AND rs.weekend_id IS NULL;

ALTER TABLE race_sessions
  ALTER COLUMN weekend_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'race_sessions_weekend_id_fkey'
  ) THEN
    ALTER TABLE race_sessions
      ADD CONSTRAINT race_sessions_weekend_id_fkey
      FOREIGN KEY (weekend_id)
      REFERENCES race_weekends(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS race_sessions_weekend_idx
  ON race_sessions(weekend_id);

CREATE TABLE IF NOT EXISTS session_status_events (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES race_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  status_reason TEXT,
  occurred_at_utc TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_status_events_session_occurred_idx
  ON session_status_events(session_id, occurred_at_utc);
