CREATE TABLE IF NOT EXISTS "car_telemetry" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL REFERENCES "race_sessions"("id") ON DELETE CASCADE,
  "driver_id" integer NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "lap_number" integer NOT NULL,
  "sample_index" integer NOT NULL,
  "speed" integer NOT NULL,
  "throttle" integer NOT NULL,
  "brake" integer NOT NULL DEFAULT 0,
  "rpm" integer NOT NULL,
  "gear" integer NOT NULL,
  "drs" integer NOT NULL DEFAULT 0,
  "recorded_at_utc" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "car_telemetry_session_driver_lap_sample_idx" ON "car_telemetry" ("session_id", "driver_id", "lap_number", "sample_index");
CREATE INDEX "car_telemetry_session_driver_lap_idx" ON "car_telemetry" ("session_id", "driver_id", "lap_number");
