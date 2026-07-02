CREATE TABLE IF NOT EXISTS race_sessions (
  id SERIAL PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  name TEXT NOT NULL,
  session_type TEXT NOT NULL,
  part INTEGER,
  circuit TEXT NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  start_time_utc TIMESTAMPTZ NOT NULL,
  end_time_utc TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS race_sessions_status_start_idx
  ON race_sessions(status, start_time_utc);

CREATE INDEX IF NOT EXISTS race_sessions_season_round_idx
  ON race_sessions(season, round);
