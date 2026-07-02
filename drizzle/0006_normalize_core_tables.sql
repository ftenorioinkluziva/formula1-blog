ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS team_id INTEGER;

UPDATE drivers d
SET team_id = t.id
FROM teams t
WHERE d.team_id IS NULL
  AND lower(trim(d.team_name)) = lower(trim(t.name));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM drivers WHERE team_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot normalize drivers.team_id: unresolved team mapping for one or more drivers';
  END IF;
END $$;

ALTER TABLE drivers
  ALTER COLUMN team_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drivers_team_id_fkey'
  ) THEN
    ALTER TABLE drivers
      ADD CONSTRAINT drivers_team_id_fkey
      FOREIGN KEY (team_id)
      REFERENCES teams(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS drivers_team_idx
  ON drivers(team_id);

ALTER TABLE drivers
  DROP COLUMN IF EXISTS team_name,
  DROP COLUMN IF EXISTS team_color;

ALTER TABLE teams
  DROP COLUMN IF EXISTS driver1,
  DROP COLUMN IF EXISTS driver2;

UPDATE race_sessions
SET session_code = CASE
  WHEN lower(session_type) = 'race' THEN 'R'
  WHEN lower(session_type) = 'qualifying' THEN 'Q'
  WHEN lower(session_type) = 'sprint qualifying' THEN 'SQ'
  WHEN lower(session_type) = 'sprint' THEN 'SPR'
  WHEN lower(session_type) LIKE 'practice %' THEN concat('P', regexp_replace(lower(session_type), '[^0-9]', '', 'g'))
  ELSE upper(replace(session_type, ' ', '_'))
END
WHERE session_code IS NULL;

ALTER TABLE race_sessions
  ALTER COLUMN session_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS race_sessions_weekend_session_code_unique_idx
  ON race_sessions(weekend_id, session_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'race_sessions_source_check'
  ) THEN
    ALTER TABLE race_sessions
      ADD CONSTRAINT race_sessions_source_check
      CHECK (source IN ('seed', 'api', 'manual'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'race_sessions_status_check'
  ) THEN
    ALTER TABLE race_sessions
      ADD CONSTRAINT race_sessions_status_check
      CHECK (status IN ('scheduled', 'started', 'inactive', 'in_progress', 'live', 'finalised', 'finished', 'aborted', 'cancelled', 'completed', 'red_flag'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_results_status_check'
  ) THEN
    ALTER TABLE session_results
      ADD CONSTRAINT session_results_status_check
      CHECK (status IN ('finished', 'dnf', 'dns', 'dsq'));
  END IF;
END $$;

DROP INDEX IF EXISTS race_sessions_season_round_idx;

ALTER TABLE race_sessions
  DROP COLUMN IF EXISTS season,
  DROP COLUMN IF EXISTS round,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS circuit,
  DROP COLUMN IF EXISTS country;

CREATE INDEX IF NOT EXISTS race_sessions_weekend_start_idx
  ON race_sessions(weekend_id, start_time_utc);
