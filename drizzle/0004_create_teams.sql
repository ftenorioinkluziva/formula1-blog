CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  driver1 TEXT NOT NULL,
  driver2 TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  podiums INTEGER NOT NULL DEFAULT 0,
  base TEXT NOT NULL,
  full_name TEXT NOT NULL,
  team_chief TEXT NOT NULL,
  technical_chief TEXT NOT NULL,
  chassis TEXT NOT NULL,
  power_unit TEXT NOT NULL,
  first_entry TEXT NOT NULL,
  championships INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS teams_name_unique_idx
  ON teams(name);

CREATE INDEX IF NOT EXISTS teams_position_idx
  ON teams(position);
