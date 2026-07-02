CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  driver_number INTEGER NOT NULL,
  code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS drivers_code_unique_idx
  ON drivers(code);

CREATE UNIQUE INDEX IF NOT EXISTS drivers_number_unique_idx
  ON drivers(driver_number);

CREATE TABLE IF NOT EXISTS session_results (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES race_sessions(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  best_lap_time TEXT,
  gap_to_leader TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'finished',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS session_results_session_driver_unique_idx
  ON session_results(session_id, driver_id);

CREATE UNIQUE INDEX IF NOT EXISTS session_results_session_position_unique_idx
  ON session_results(session_id, position);

CREATE INDEX IF NOT EXISTS session_results_session_position_idx
  ON session_results(session_id, position);
