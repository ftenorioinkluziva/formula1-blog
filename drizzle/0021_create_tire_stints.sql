CREATE TABLE IF NOT EXISTS "tire_stints" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL REFERENCES "race_sessions"("id") ON DELETE CASCADE,
  "driver_id" integer NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "stint_number" integer NOT NULL,
  "compound" text NOT NULL,
  "lap_start" integer NOT NULL,
  "lap_end" integer NOT NULL,
  "tyre_age_at_start" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "tire_stints_session_driver_stint_unique_idx" ON "tire_stints" ("session_id", "driver_id", "stint_number");
CREATE INDEX IF NOT EXISTS "tire_stints_session_idx" ON "tire_stints" ("session_id");
