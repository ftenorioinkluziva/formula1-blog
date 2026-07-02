CREATE TABLE IF NOT EXISTS "pit_stops" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL REFERENCES "race_sessions"("id") ON DELETE CASCADE,
  "driver_id" integer NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "lap" integer NOT NULL,
  "stop_number" integer NOT NULL,
  "duration" text,
  "time_of_day" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pit_stops_session_driver_stop_unique_idx" ON "pit_stops" ("session_id", "driver_id", "stop_number");
CREATE INDEX IF NOT EXISTS "pit_stops_session_idx" ON "pit_stops" ("session_id");
