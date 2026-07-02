CREATE TABLE IF NOT EXISTS "race_intervals" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL REFERENCES "race_sessions"("id") ON DELETE CASCADE,
  "driver_id" integer NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "lap_number" integer NOT NULL,
  "gap_to_leader" real,
  "interval_to_ahead" real,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "race_intervals_session_driver_lap_idx" ON "race_intervals" ("session_id", "driver_id", "lap_number");
CREATE INDEX "race_intervals_session_idx" ON "race_intervals" ("session_id");
